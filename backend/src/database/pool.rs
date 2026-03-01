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

pub async fn pre_migration_repairs(pool: &PgPool) -> anyhow::Result<()> {
    let needs_dedupe: bool = sqlx::query_scalar(
        "SELECT to_regclass('public.background_tasks') IS NOT NULL
             AND to_regclass('public.uq_background_tasks_active_dedupe') IS NULL",
    )
    .fetch_one(pool)
    .await
    .unwrap_or(false);

    if needs_dedupe {
        sqlx::query(
            "WITH ranked AS (
               SELECT
                 id,
                 ROW_NUMBER() OVER (
                   PARTITION BY task_type, dedupe_key
                   ORDER BY (status = 'running') DESC, created_at ASC, id ASC
                 ) AS rn
               FROM background_tasks
               WHERE dedupe_key IS NOT NULL
                 AND status IN ('pending', 'running')
             )
             UPDATE background_tasks t
             SET status = 'failed',
                 last_error = 'deduped before migrations',
                 completed_at = NOW(),
                 updated_at = NOW()
             FROM ranked r
             WHERE t.id = r.id
               AND r.rn > 1",
        )
        .execute(pool)
        .await?;
    }

    Ok(())
}

pub async fn reset_public_schema(pool: &PgPool) -> anyhow::Result<()> {
    sqlx::query("DROP SCHEMA IF EXISTS public CASCADE")
        .execute(pool)
        .await?;
    sqlx::query("CREATE SCHEMA public").execute(pool).await?;
    Ok(())
}

pub async fn repair_migration_checksum(
    pool: &PgPool,
    migrator: &sqlx::migrate::Migrator,
    version: i64,
) -> anyhow::Result<bool> {
    let Some(migration) = migrator.iter().find(|m| m.version == version) else {
        return Ok(false);
    };

    let res = sqlx::query("UPDATE _sqlx_migrations SET checksum = $2 WHERE version = $1")
        .bind(version)
        .bind(migration.checksum.as_ref())
        .execute(pool)
        .await?;

    Ok(res.rows_affected() > 0)
}
