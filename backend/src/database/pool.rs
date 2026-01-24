use sqlx::postgres::{PgPool, PgPoolOptions};
use std::time::Duration;

pub async fn create_pool(database_url: &str) -> anyhow::Result<PgPool> {
    let pool = PgPoolOptions::new()
        .max_connections(20) // 最大连接数
        .min_connections(5) // 最小连接数（保持连接池预热）
        .acquire_timeout(Duration::from_secs(30)) // 获取连接超时
        .idle_timeout(Some(Duration::from_secs(600))) // 空闲连接超时（10分钟）
        .max_lifetime(Some(Duration::from_secs(1800))) // 连接最大生命周期（30分钟）
        .test_before_acquire(true) // 获取连接前测试连接是否有效
        .connect(database_url)
        .await?;

    Ok(pool)
}
