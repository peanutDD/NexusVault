use std::sync::Arc;
use std::time::Duration;

use axum::routing::get;
use axum::Router;
use metrics::gauge;

use file_storage_backend::config::Config;
use file_storage_backend::database::pool::create_pool;
use file_storage_backend::middleware::metrics::init_metrics;
use file_storage_backend::services::file::create_storage;
use file_storage_backend::services::task_queue::run_gif_preview_worker;
use file_storage_backend::AppState;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    init_tracing();

    let metrics_renderer =
        init_metrics().map_err(|e| anyhow::anyhow!("Failed to install Prometheus recorder: {}", e))?;

    dotenv::dotenv().ok();
    let config = Arc::new(Config::from_env()?);
    let pool = create_pool(&config.database_url).await?;
    let storage = create_storage(config.clone()).await?;
    let state = AppState::new(config.clone(), pool, storage, None);

    let concurrency: usize = std::env::var("WORKER_CONCURRENCY")
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(2);

    for _ in 0..concurrency {
        let state_for_worker = state.clone();
        tokio::spawn(async move {
            loop {
                if let Err(e) = run_gif_preview_worker(&state_for_worker).await {
                    tracing::error!("gif_preview worker iteration failed: {}", e);
                }
                tokio::time::sleep(Duration::from_secs(2)).await;
            }
        });
    }

    {
        let state_for_maintenance = state.clone();
        tokio::spawn(async move {
            loop {
                if let Ok(n) = state_for_maintenance
                    .task_queue
                    .requeue_stuck_tasks("gif_preview", 200)
                    .await
                {
                    if n > 0 {
                        tracing::warn!(requeued = n, "requeued stuck gif_preview tasks");
                    }
                }
                tokio::time::sleep(Duration::from_secs(30)).await;
            }
        });
    }

    {
        let state_for_metrics = state.clone();
        tokio::spawn(async move {
            loop {
                if let Ok(depth) = state_for_metrics.task_queue.get_queue_depth("gif_preview").await {
                    gauge!("background_tasks_pending_total", "task_type" => "gif_preview")
                        .set(depth.pending_total as f64);
                    gauge!("background_tasks_pending_ready", "task_type" => "gif_preview")
                        .set(depth.pending_ready as f64);
                    gauge!("background_tasks_running", "task_type" => "gif_preview")
                        .set(depth.running as f64);
                    gauge!("background_tasks_failed", "task_type" => "gif_preview")
                        .set(depth.failed as f64);
                }
                tokio::time::sleep(Duration::from_secs(5)).await;
            }
        });
    }

    let metrics_handler = {
        let renderer = metrics_renderer.clone();
        move || {
            let r = renderer.clone();
            async move { r() }
        }
    };

    let app = Router::new()
        .route("/health", get(|| async { "ok" }))
        .route("/metrics", get(metrics_handler));

    let port: u16 = std::env::var("WORKER_PORT")
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(3001);
    let addr = format!("0.0.0.0:{}", port);
    tracing::info!("Worker listening on {}", addr);

    let listener = tokio::net::TcpListener::bind(&addr).await?;
    axum::serve(listener, app).await?;
    Ok(())
}

fn init_tracing() {
    use tracing_subscriber::fmt;
    use tracing_subscriber::EnvFilter;
    let filter = EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info"));
    fmt().with_env_filter(filter).init();
}

