//! # File Storage Backend
//!
//! 基于 Axum、SQLx 和 Tokio 的文件存储后端服务。
//!
//! ## 架构
//! - api/: 路由定义
//! - app.rs: 应用构建（CORS、中间件、路由挂载）
//! - handlers/: HTTP 请求处理
//! - services/: 业务逻辑层
//! - models/: 数据模型
//! - middleware/: 中间件（认证、限流、指标、panic、请求日志）
//! - extractors/: Axum extractors（认证等）
//! - database/: 数据库连接池
//! - utils/: 工具函数
//! - config.rs: 配置管理

// =============================================================================
// 标准库与第三方 use
// =============================================================================

use std::net::SocketAddr;
use std::sync::Arc;
use std::time::Duration;

use file_storage_backend::config::Config;
use file_storage_backend::database::pool::create_pool;
use file_storage_backend::services::file::create_storage;
use file_storage_backend::services::maintenance::{
    run_orphan_cleanup_once, spawn_direct_upload_session_cleanup, spawn_files_consistency_checker,
    spawn_orphan_storage_files_cleanup, spawn_upload_session_cleanup, spawn_zip_cache_cleanup,
};
use file_storage_backend::services::redis::create_pool as create_redis_pool;
use file_storage_backend::tracing::init_tracing as otel_init_tracing;
use file_storage_backend::AppState;

fn main() -> anyhow::Result<()> {
    let runtime = build_runtime()?;
    runtime.block_on(async_main())
}

fn build_runtime() -> anyhow::Result<tokio::runtime::Runtime> {
    let worker_threads = std::env::var("TOKIO_WORKER_THREADS")
        .ok()
        .and_then(|v| v.parse::<usize>().ok())
        .unwrap_or_else(|| {
            std::thread::available_parallelism()
                .map(|n| n.get())
                .unwrap_or(10)
        });

    let max_blocking_threads = std::env::var("TOKIO_MAX_BLOCKING_THREADS")
        .ok()
        .and_then(|v| v.parse::<usize>().ok())
        .unwrap_or(512);

    tokio::runtime::Builder::new_multi_thread()
        .enable_all()
        .worker_threads(worker_threads)
        .max_blocking_threads(max_blocking_threads)
        .build()
        .map_err(Into::into)
}

async fn async_main() -> anyhow::Result<()> {
    dotenvy::dotenv().ok();
    otel_init_tracing();

    let metrics_renderer = file_storage_backend::middleware::metrics::init_metrics()
        .map_err(|e| anyhow::anyhow!("Failed to install Prometheus recorder: {}", e))?;
    tracing::info!("Prometheus metrics initialized");

    let config = Arc::new(Config::from_env()?);
    let pool = create_pool(&config.database.url).await?;
    let read_pool = match config.database.read_replica_url.as_deref() {
        Some(url) => create_pool(url).await?,
        None => pool.clone(),
    };

    file_storage_backend::database::pool::pre_migration_repairs(&pool).await?;

    let migrator = sqlx::migrate!("./migrations");
    match migrator.run(&pool).await {
        Ok(()) => {}
        Err(sqlx::migrate::MigrateError::VersionMismatch(v)) => {
            let allow_checksum_repair =
                std::env::var("REPAIR_MIGRATION_CHECKSUM_ON_MISMATCH").as_deref() == Ok("1");
            if allow_checksum_repair {
                tracing::warn!(
                    version = v,
                    "migration checksum mismatch detected; repairing"
                );
                let repaired = file_storage_backend::database::pool::repair_migration_checksum(
                    &pool, &migrator, v,
                )
                .await?;
                if repaired {
                    migrator.run(&pool).await.map_err(|e| {
                        anyhow::anyhow!("Failed to run migrations after checksum repair: {}", e)
                    })?;
                } else {
                    return Err(anyhow::anyhow!(
                        "Failed to repair migration checksum for version {}",
                        v
                    ));
                }
            } else {
                let allow_reset =
                    std::env::var("RESET_DB_ON_MIGRATION_MISMATCH").as_deref() == Ok("1");
                if allow_reset {
                    tracing::warn!(
                        version = v,
                        "migration checksum mismatch detected; resetting public schema"
                    );
                    file_storage_backend::database::pool::reset_public_schema(&pool).await?;
                    file_storage_backend::database::pool::pre_migration_repairs(&pool).await?;
                    migrator.run(&pool).await.map_err(|e| {
                        anyhow::anyhow!("Failed to run migrations after schema reset: {}", e)
                    })?;
                } else {
                    return Err(anyhow::anyhow!("Failed to run migrations: migration {} was previously applied but has been modified", v));
                }
            }
        }
        Err(err) => {
            return Err(anyhow::anyhow!("Failed to run migrations: {}", err));
        }
    }

    let storage = create_storage(config.clone())
        .await
        .map_err(|e| anyhow::anyhow!("Failed to create storage backend: {}", e))?;

    let redis = match &config.redis {
        Some(redis_cfg) => Some(create_redis_pool(&redis_cfg.url)?),
        None => None,
    };

    if std::env::var("RUN_ORPHAN_CLEANUP_ONCE").as_deref() == Ok("1") {
        let n = run_orphan_cleanup_once(
            &pool,
            &config.storage.path,
            config.tasks.orphan_cleanup_batch_limit,
        )
        .await?;
        tracing::info!("orphan cleanup once done, removed {} file(s), exiting", n);
        return Ok(());
    }

    let app_state = AppState::new(config.clone(), pool, read_pool, storage, redis);

    spawn_upload_session_cleanup(
        app_state.pool.clone(),
        Duration::from_secs(config.tasks.upload_session_cleanup_interval_secs),
        config.tasks.upload_session_cleanup_batch_size,
    );
    spawn_direct_upload_session_cleanup(
        app_state.pool.clone(),
        app_state.storage.clone(),
        Duration::from_secs(config.tasks.upload_session_cleanup_interval_secs),
        config.tasks.upload_session_cleanup_batch_size,
    );
    spawn_files_consistency_checker(
        app_state.pool.clone(),
        app_state.storage.clone(),
        Duration::from_secs(config.tasks.files_consistency_check_interval_secs),
        config.tasks.files_consistency_check_batch_size,
    );

    if config.storage.backend == "local" {
        spawn_orphan_storage_files_cleanup(
            app_state.pool.clone(),
            config.storage.path.clone(),
            Duration::from_secs(config.tasks.orphan_cleanup_interval_secs),
            config.tasks.orphan_cleanup_batch_limit,
        );
        tracing::info!(
            "orphan storage files cleanup started (interval={}s, batch_limit={})",
            config.tasks.orphan_cleanup_interval_secs,
            config.tasks.orphan_cleanup_batch_limit
        );
    }

    if config.tasks.zip_cache_enabled && config.tasks.zip_cache_backend == "local" {
        let base_dir = std::path::Path::new(&config.storage.path).join(".zip_cache");
        spawn_zip_cache_cleanup(
            base_dir,
            Duration::from_secs(300),
            config.tasks.zip_cache_ttl_secs,
        );
    }

    let app = file_storage_backend::app::create_app(app_state, &config, metrics_renderer).await;
    let addr = server_bind_addr(config.server.port);
    let listener = bind_server_listener(&addr).await?;
    tracing::info!("Server listening on {}", addr);

    axum::serve(
        listener,
        app.into_make_service_with_connect_info::<SocketAddr>(),
    )
    .with_graceful_shutdown(shutdown_signal())
    .await?;

    Ok(())
}

fn server_bind_addr(port: u16) -> String {
    format!("0.0.0.0:{port}")
}

async fn bind_server_listener(addr: &str) -> anyhow::Result<tokio::net::TcpListener> {
    tokio::net::TcpListener::bind(addr)
        .await
        .map_err(|err| anyhow::anyhow!("failed to bind server listener on {addr}: {err}"))
}

async fn shutdown_signal() {
    let ctrl_c = async {
        let _ = tokio::signal::ctrl_c().await;
    };

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

#[cfg(test)]
mod tests {
    use super::{bind_server_listener, server_bind_addr};

    #[test]
    fn server_bind_addr_uses_public_interface_and_configured_port() {
        assert_eq!(server_bind_addr(4123), "0.0.0.0:4123");
    }

    #[tokio::test]
    async fn bind_server_listener_reports_target_address_when_port_is_busy() {
        let occupied = tokio::net::TcpListener::bind("127.0.0.1:0")
            .await
            .expect("test listener should bind");
        let addr = occupied.local_addr().expect("listener should expose addr");
        let addr = addr.to_string();

        let err = bind_server_listener(&addr)
            .await
            .expect_err("second listener should fail on occupied port");
        let message = err.to_string();

        assert!(message.contains("failed to bind server listener"));
        assert!(message.contains(&addr));
    }
}
