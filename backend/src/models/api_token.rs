use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;
use validator::Validate;

#[derive(Debug, Clone, Serialize, FromRow)]
pub struct ApiToken {
    pub id: Uuid,
    pub user_id: Uuid,
    #[serde(skip_serializing)]
    /// 存储在数据库中的 Token 哈希值。
    ///
    /// 实际验证时由 Auth 层读取该字段与传入明文 Token 做比对，
    /// 当前未直接在序列化/响应中使用，因此标记为 `dead_code`。
    #[allow(dead_code)] // used for verification in auth, not read directly
    pub token_hash: String,
    pub name: String,
    pub last_used_at: Option<DateTime<Utc>>,
    pub expires_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize, Validate)]
pub struct CreateApiTokenRequest {
    #[validate(length(min = 1, max = 255))]
    pub name: String,
    pub expires_in_days: Option<u32>, // Optional expiration in days
}

#[derive(Debug, Serialize)]
pub struct ApiTokenResponse {
    pub id: Uuid,
    pub name: String,
    pub token: String, // Only shown once on creation
    pub expires_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
pub struct ApiTokenListItem {
    pub id: Uuid,
    pub name: String,
    pub last_used_at: Option<DateTime<Utc>>,
    pub expires_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
}

impl From<ApiToken> for ApiTokenListItem {
    fn from(token: ApiToken) -> Self {
        ApiTokenListItem {
            id: token.id,
            name: token.name,
            last_used_at: token.last_used_at,
            expires_at: token.expires_at,
            created_at: token.created_at,
        }
    }
}
