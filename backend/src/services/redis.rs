use deadpool_redis::redis::cmd;
use deadpool_redis::{Pool, Runtime};
use uuid::Uuid;

// =============================================================================
// 连接池
// =============================================================================
pub fn create_pool(redis_url: &str) -> anyhow::Result<Pool> {
    let cfg = deadpool_redis::Config::from_url(redis_url);
    Ok(cfg.create_pool(Some(Runtime::Tokio1))?)
}

// =============================================================================
// 服务封装
// =============================================================================
#[derive(Clone)]
pub struct RedisService {
    pool: Pool,
}

impl RedisService {
    // -------------------------------------------------------------------------
    // 基础能力
    // -------------------------------------------------------------------------
    pub fn new(pool: Pool) -> Self {
        Self { pool }
    }

    // -------------------------------------------------------------------------
    // 邮箱验证码
    // -------------------------------------------------------------------------
    //
    // 选择 Redis 的原因：
    // - 多实例一致性：多个后端副本共享同一份验证码状态
    // - 短 TTL 状态：验证码天然有过期时间，适合 KV 存储
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

    // 原子校验并消费，避免并发竞态（若先 GET 再 DEL，可能出现多请求同时通过校验）。
    pub async fn verify_and_consume_email_code(
        &self,
        user_id: Uuid,
        email: &str,
        code: &str,
    ) -> anyhow::Result<bool> {
        let mut conn = self.pool.get().await?;
        let key = format!("email_verify:{}:{}", user_id, email);
        let script = "local v = redis.call('GET', KEYS[1]); \
                      if v and v == ARGV[1] then \
                        redis.call('DEL', KEYS[1]); \
                        return 1; \
                      end; \
                      return 0;";
        let ok: i32 = cmd("EVAL")
            .arg(script)
            .arg(1)
            .arg(&key)
            .arg(code)
            .query_async(&mut conn)
            .await?;
        Ok(ok == 1)
    }

    // -------------------------------------------------------------------------
    // OAuth state（CSRF 防护）
    // -------------------------------------------------------------------------
    //
    // state 必须是一次性、短期有效的随机串；回调时校验通过后立刻消费掉。
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

    // 通过 DEL 消费，保证一次性使用。
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

    // -------------------------------------------------------------------------
    // 用户缓存版本号（粗粒度失效）
    // -------------------------------------------------------------------------
    //
    // 采用“版本号”失效的原因：
    // - 避免用 SCAN/KEYS 做模式删除（成本高且可能阻塞）
    // - 一次 INCR 即可使该用户所有派生 key 自动失效（key 中带版本号）
    pub async fn get_user_cache_version(&self, user_id: Uuid) -> anyhow::Result<i64> {
        let mut conn = self.pool.get().await?;
        let key = format!("cachever:user:{}", user_id);
        let v: Option<i64> = cmd("GET").arg(key).query_async(&mut conn).await?;
        Ok(v.unwrap_or(1))
    }

    // 写路径调用：用于使读缓存（文件列表/分类/配额等）整体失效。
    pub async fn bump_user_cache_version(&self, user_id: Uuid) -> anyhow::Result<i64> {
        let mut conn = self.pool.get().await?;
        let key = format!("cachever:user:{}", user_id);
        let v: i64 = cmd("INCR").arg(key).query_async(&mut conn).await?;
        Ok(v)
    }
}
