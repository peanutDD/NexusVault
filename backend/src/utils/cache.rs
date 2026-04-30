//! # Cache Utilities
//! 
//! 提供统一的缓存辅助函数，用于简化 handler 层的缓存逻辑。

use axum::response::Response;
use deadpool_redis::{redis::cmd, Pool};
use serde_json::Value;
use uuid::Uuid;

use crate::services::redis::RedisService;
use crate::utils::json_response;

/// 获取 Redis 缓存
/// 
/// # 参数
/// - `pool`: Redis 连接池
/// - `user_id`: 用户 ID
/// - `prefix`: 缓存键前缀
/// - `sub_key`: 子键（如 parent_id）
/// 
/// # 返回
/// - Some(Response): 缓存命中时返回缓存的响应
/// - None: 缓存未命中或 Redis 不可用
pub async fn get_cached_response(
    pool: &Pool,
    user_id: Uuid,
    prefix: &str,
    sub_key: &str,
) -> Option<Response> {
    let redis = RedisService::new(pool.clone());
    let ver = match redis.get_user_cache_version(user_id).await {
        Ok(v) => v,
        Err(_) => return None,
    };

    let cache_key = format!("{}:{}:{}:{}", prefix, user_id, ver, sub_key);

    let mut conn = match pool.get().await {
        Ok(c) => c,
        Err(_) => return None,
    };

    let cached: Result<Option<String>, _> = cmd("GET").arg(&cache_key).query_async(&mut conn).await;
    
    match cached {
        Ok(Some(s)) => match serde_json::from_str::<Value>(&s) {
            Ok(v) => Some(json_response(v)),
            Err(_) => None,
        },
        _ => None,
    }
}

/// 设置 Redis 缓存
/// 
/// # 参数
/// - `pool`: Redis 连接池
/// - `user_id`: 用户 ID
/// - `prefix`: 缓存键前缀
/// - `sub_key`: 子键（如 parent_id）
/// - `body`: 要缓存的内容
/// - `ttl_secs`: 缓存过期时间（秒）
pub async fn set_cached_response(
    pool: &Pool,
    user_id: Uuid,
    prefix: &str,
    sub_key: &str,
    body: &Value,
    ttl_secs: u64,
) {
    let redis = RedisService::new(pool.clone());
    let ver = match redis.get_user_cache_version(user_id).await {
        Ok(v) => v,
        Err(_) => return,
    };

    let cache_key = format!("{}:{}:{}:{}", prefix, user_id, ver, sub_key);
    
    match serde_json::to_string(body) {
        Ok(s) => {
            if let Ok(mut conn) = pool.get().await {
                let _: Result<(), _> = cmd("SETEX")
                    .arg(&cache_key)
                    .arg(ttl_secs)
                    .arg(s)
                    .query_async(&mut conn)
                    .await;
            }
        }
        Err(_) => return,
    }
}
