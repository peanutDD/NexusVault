use deadpool_redis::{Pool, Runtime};
use uuid::Uuid;
use deadpool_redis::redis::cmd;

pub fn create_pool(redis_url: &str) -> anyhow::Result<Pool> {
    let cfg = deadpool_redis::Config::from_url(redis_url);
    Ok(cfg.create_pool(Some(Runtime::Tokio1))?)
}

#[derive(Clone)]
pub struct RedisService {
    pool: Pool,
}

impl RedisService {
    pub fn new(pool: Pool) -> Self {
        Self { pool }
    }

    pub async fn set_email_verification_code(
        &self,
        user_id: Uuid,
        email: &str,
        code: &str,
    ) -> anyhow::Result<()> {
        let mut conn = self.pool.get().await?;
        let key = format!("email_verify:{}:{}", user_id, email);
        cmd("SETEX")
            .arg(key)
            .arg(600)
            .arg(code)
            .query_async::<_, ()>(&mut conn)
            .await?;
        Ok(())
    }

    pub async fn verify_and_consume_email_code(
        &self,
        user_id: Uuid,
        email: &str,
        code: &str,
    ) -> anyhow::Result<bool> {
        let mut conn = self.pool.get().await?;
        let key = format!("email_verify:{}:{}", user_id, email);
        let stored: Option<String> = cmd("GET").arg(&key).query_async(&mut conn).await?;
        if stored.as_deref() != Some(code) {
            return Ok(false);
        }
        let deleted: i32 = cmd("DEL").arg(key).query_async(&mut conn).await?;
        Ok(deleted == 1)
    }

    pub async fn set_oauth_state(&self, provider: &str, state: &str) -> anyhow::Result<()> {
        let mut conn = self.pool.get().await?;
        let key = format!("oauth_state:{}:{}", provider, state);
        cmd("SETEX")
            .arg(key)
            .arg(300)
            .arg("1")
            .query_async::<_, ()>(&mut conn)
            .await?;
        Ok(())
    }

    pub async fn verify_and_consume_oauth_state(
        &self,
        provider: &str,
        state: &str,
    ) -> anyhow::Result<bool> {
        let mut conn = self.pool.get().await?;
        let key = format!("oauth_state:{}:{}", provider, state);
        let deleted: i32 = cmd("DEL").arg(key).query_async(&mut conn).await?;
        Ok(deleted == 1)
    }

    pub async fn get_user_cache_version(&self, user_id: Uuid) -> anyhow::Result<i64> {
        let mut conn = self.pool.get().await?;
        let key = format!("cachever:user:{}", user_id);
        let v: Option<i64> = cmd("GET").arg(key).query_async(&mut conn).await?;
        Ok(v.unwrap_or(1))
    }

    pub async fn bump_user_cache_version(&self, user_id: Uuid) -> anyhow::Result<i64> {
        let mut conn = self.pool.get().await?;
        let key = format!("cachever:user:{}", user_id);
        let v: i64 = cmd("INCR").arg(key).query_async(&mut conn).await?;
        Ok(v)
    }
}
