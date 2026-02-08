//! # File Storage Backend
//!
//! 基于 Axum、SQLx 和 Tokio 的文件存储后端服务。
//!
//! ## 架构
//!
//! - `api/`: 路由定义
//! - `app.rs`: 应用构建（CORS、中间件、路由挂载）
//! - `handlers/`: HTTP 请求处理
//! - `services/`: 业务逻辑层
//! - `models/`: 数据模型
//! - `middleware/`: 中间件（认证、限流、指标、panic、请求日志）
//! - `extractors/`: Axum extractors（认证等）
//! - `database/`: 数据库连接池
//! - `utils/`: 工具函数
//! - `config.rs`: 配置管理

// =============================================================================
// 模块声明：按功能划分的 crate 内部模块
// =============================================================================

mod api;         // HTTP 路由注册（auth、files、folders、share、tokens 等）
mod app;         // 应用组装：CORS、中间件栈、路由挂载、全局错误处理
mod config;      // 配置：从环境变量加载（数据库、JWT、存储、端口等）
mod constants;   // 常量（上传大小、并发数、分片参数等）
mod database;    // 数据库连接池（SQLx PgPool 创建与配置）
mod extractors;  // Axum 提取器（认证用户、Query token 等）
mod handlers;    // HTTP 处理器（认证、文件、文件夹、分享、API Token）
mod middleware; // 中间件（认证、限流、指标、panic 捕获、请求日志）
mod models;      // 数据模型与 DTO（User、File、Folder、Share 等）
mod repositories; // 数据访问层（users、files、folders、shares、upload_sessions）
mod services;    // 业务逻辑层（auth、file、folder、share、maintenance）
mod state;       // 应用状态 AppState（config、pool、storage 等共享）
mod utils;       // 工具（错误类型、响应构造、加密、校验等）

// 对外暴露应用状态类型，供 handler 与中间件通过 State<T> 注入
pub use state::AppState;

// =============================================================================
// 标准库与第三方 use
// =============================================================================

use std::sync::Arc;   // 多线程共享配置与连接池的引用计数指针
use std::time::Duration; // 定时任务间隔（如清理周期）

use config::Config;                           // 应用配置
use database::pool::create_pool;              // 创建 PostgreSQL 连接池
use services::file::create_storage;           // 根据配置创建存储后端（本地 / S3）
use services::maintenance::{                  // 维护任务：孤儿清理、一致性检查、上传会话清理
    run_orphan_cleanup_once,
    spawn_files_consistency_checker,
    spawn_orphan_storage_files_cleanup,
    spawn_upload_session_cleanup,
};

// =============================================================================
// 程序入口
// =============================================================================

/// 同步入口：构建运行时并在其上执行异步主逻辑
fn main() -> anyhow::Result<()> {
    let runtime = build_runtime()?;  // 创建多线程 Tokio 运行时
    runtime.block_on(async_main())   // 阻塞直到 async_main 完成
}

// =============================================================================
// 运行时构建
// =============================================================================

/// 构建 Tokio 多线程运行时，可通过环境变量调优。
///
/// - `TOKIO_WORKER_THREADS`: 工作线程数，默认 = CPU 核心数
/// - `TOKIO_MAX_BLOCKING_THREADS`: 阻塞线程池上限，默认 512
fn build_runtime() -> anyhow::Result<tokio::runtime::Runtime> {
    // 工作线程数：优先读环境变量，否则取 CPU 核心数，兜底 10
    let worker_threads = std::env::var("TOKIO_WORKER_THREADS")
        .ok()
        .and_then(|v| v.parse::<usize>().ok())
        .unwrap_or_else(|| {
            std::thread::available_parallelism()
                .map(|n| n.get())
                .unwrap_or(10)
        });

    // 阻塞线程池上限：用于 spawn_blocking，默认 512
    let max_blocking_threads = std::env::var("TOKIO_MAX_BLOCKING_THREADS")
        .ok()
        .and_then(|v| v.parse::<usize>().ok())
        .unwrap_or(512);

    // 构建多线程运行时并启用 IO/时间驱动
    tokio::runtime::Builder::new_multi_thread()
        .enable_all()                      // 启用 io、time 等
        .worker_threads(worker_threads)
        .max_blocking_threads(max_blocking_threads)
        .build()
        .map_err(Into::into)
}

// =============================================================================
// 异步主流程：初始化 → 状态 → 后台任务 → 启动 HTTP
// =============================================================================

async fn async_main() -> anyhow::Result<()> {
    // ---------- 日志 ----------
    init_tracing();

    // ---------- 指标（Prometheus） ----------
    let metrics_renderer = middleware::metrics::init_metrics()
        .map_err(|e| anyhow::anyhow!("Failed to install Prometheus recorder: {}", e))?;
    tracing::info!("Prometheus metrics initialized");

    // ---------- 配置与数据源 ----------
    dotenv::dotenv().ok();                          // 加载 .env，忽略缺失
    let config = Arc::new(Config::from_env()?);      // 从环境变量构建配置并共享
    let pool = create_pool(&config.database_url).await?;  // 创建 SQLx 连接池

    // 执行 migrations 目录下的 SQL 迁移
    sqlx::migrate!("./migrations")
        .run(&pool)
        .await
        .map_err(|e| anyhow::anyhow!("Failed to run migrations: {}", e))?;

    // 根据 STORAGE_BACKEND 创建本地或 S3 存储实现
    let storage = create_storage(config.clone())
        .await
        .map_err(|e| anyhow::anyhow!("Failed to create storage backend: {}", e))?;

    // ---------- 可选：单次孤儿清理后退出 ----------
    // 用于一次性运维任务：清理 DB 无引用或磁盘孤立的文件后退出
    if std::env::var("RUN_ORPHAN_CLEANUP_ONCE").as_deref() == Ok("1") {
        let n = run_orphan_cleanup_once(
            &pool,
            &config.storage_path,
            config.orphan_cleanup_batch_limit,
        )
        .await?;
        tracing::info!("orphan cleanup once done, removed {} file(s), exiting", n);
        return Ok(());
    }

    // ---------- 应用状态（注入到路由与 handler） ----------
    let app_state = AppState::new(config.clone(), pool, storage);

    // ---------- 后台维护任务（常驻定时） ----------
    // 定期清理过期的分片上传会话与临时文件
    spawn_upload_session_cleanup(
        app_state.pool.clone(),
        Duration::from_secs(config.upload_session_cleanup_interval_secs),
        config.upload_session_cleanup_batch_size,
    );
    // 定期检查 DB 与存储一致性，修复孤立记录
    spawn_files_consistency_checker(
        app_state.pool.clone(),
        app_state.storage.clone(),
        Duration::from_secs(config.files_consistency_check_interval_secs),
        config.files_consistency_check_batch_size,
    );
    // 仅本地存储时：定期清理磁盘上无 DB 引用的文件
    if config.storage_backend == "local" {
        spawn_orphan_storage_files_cleanup(
            app_state.pool.clone(),
            config.storage_path.clone(),
            Duration::from_secs(config.orphan_cleanup_interval_secs),
            config.orphan_cleanup_batch_limit,
        );
        tracing::info!(
            "orphan storage files cleanup started (interval={}s, batch_limit={})",
            config.orphan_cleanup_interval_secs,
            config.orphan_cleanup_batch_limit
        );
    }

    // ---------- 构建 Axum 应用并启动 HTTP 服务 ----------
    let app = app::create_app(app_state, &config, metrics_renderer).await;
    let addr = format!("0.0.0.0:{}", config.port);  // 监听所有网卡
    tracing::info!("Server listening on {}", addr);

    let listener = tokio::net::TcpListener::bind(&addr).await?;
    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())  // 收到 SIGINT/SIGTERM 后优雅关闭
        .await?;

    Ok(())
}

// =============================================================================
// 日志初始化
// =============================================================================

/// 初始化 tracing 日志；未设置 RUST_LOG 时默认 `file_storage_backend=debug,axum=info`。
/// 生产环境建议设置 `RUST_LOG=info` 或按模块细化。
fn init_tracing() {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "file_storage_backend=debug,axum=info".into()),
        )
        .init();
}

// =============================================================================
// 优雅关闭
// =============================================================================

/// 等待进程终止信号（Ctrl+C 或 SIGTERM），用于 graceful shutdown。
/// Unix 下同时监听 SIGTERM，非 Unix 仅监听 Ctrl+C。
async fn shutdown_signal() {
    // Ctrl+C (SIGINT)
    let ctrl_c = async {
        let _ = tokio::signal::ctrl_c().await;
    };

    // Unix: SIGTERM（如 systemd stop、docker stop）
    #[cfg(unix)]
    let terminate = async {
        use tokio::signal::unix::{signal, SignalKind};
        if let Ok(mut sig) = signal(SignalKind::terminate()) {
            sig.recv().await;
        }
    };

    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        _ = ctrl_c => {}
        _ = terminate => {}
    }
    tracing::info!("Shutdown signal received");
}
