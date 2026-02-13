use sqlx::postgres::{PgPool, PgPoolOptions};
use std::time::Duration;

fn env_u32(key: &str, default: u32) -> u32 {
    std::env::var(key)
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(default)
}

pub async fn create_pool(database_url: &str) -> anyhow::Result<PgPool> {
    let max_connections = env_u32("DB_POOL_MAX_CONNECTIONS", 40);
    let acquire_timeout_secs = env_u32("DB_POOL_ACQUIRE_TIMEOUT_SECS", 15);
    tracing::info!(
        max_connections,
        acquire_timeout_secs,
        "database pool configured"
    );

    let pool = PgPoolOptions::new()
        .max_connections(max_connections)
        .min_connections(5)
        .acquire_timeout(Duration::from_secs(acquire_timeout_secs as u64))
        .idle_timeout(Some(Duration::from_secs(600))) // 空闲连接超时（10分钟）
        .max_lifetime(Some(Duration::from_secs(1800))) // 连接最大生命周期（30分钟）
        .test_before_acquire(true) // 获取连接前测试连接是否有效
        .after_connect(|conn, _meta| {
            Box::pin(async move {
                // 防止慢查询长时间占用连接导致“雪崩”
                // 说明：可按接口粒度（list vs upload）进一步用 SET LOCAL 调整
                sqlx::query("SET statement_timeout = '20s'")
                    .execute(conn)
                    .await?;
                Ok(())
            })
        })
        .connect(database_url)
        .await?;

    Ok(pool)
}
