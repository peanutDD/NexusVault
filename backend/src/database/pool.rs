use sqlx::postgres::{PgPool, PgPoolOptions};
use std::time::Duration;

pub async fn create_pool(database_url: &str) -> anyhow::Result<PgPool> {
    let pool = PgPoolOptions::new()
        .max_connections(20) // 最大连接数
        .min_connections(5) // 最小连接数（保持连接池预热）
        // 高并发下建议更快失败，避免请求长期排队占用内存/任务调度资源
        .acquire_timeout(Duration::from_secs(5)) // 获取连接超时
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
