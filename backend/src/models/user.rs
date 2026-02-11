use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct User {
    pub id: Uuid,
    pub username: String,
    pub email: String,
    #[serde(skip_serializing)]
    pub password_hash: String,
    pub storage_quota: Option<i64>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize, validator::Validate)]
pub struct RegisterRequest {
    #[validate(length(min = 3, max = 50))]
    pub username: String,
    #[validate(email)]
    pub email: String,
    /// 密码：长度至少 8，最多 64。具体复杂度校验在 AuthService::validate_register_input 中完成。
    #[validate(length(min = 8, max = 64))]
    pub password: String,
}

#[derive(Debug, Deserialize)]
pub struct LoginRequest {
    pub email: String,
    pub password: String,
}

#[derive(Debug, Deserialize)]
pub struct ChangePasswordRequest {
    pub current_password: String,
    pub new_password: String,
}

#[derive(Debug, Deserialize, validator::Validate)]
pub struct UpdateProfileRequest {
    #[validate(length(min = 3, max = 50))]
    pub username: String,
    #[validate(email)]
    pub email: String,
    /// 修改邮箱时必填：新邮箱收到的 6 位验证码
    pub email_verification_code: Option<String>,
}

#[derive(Debug, Deserialize, validator::Validate)]
pub struct SendEmailVerificationRequest {
    #[validate(email)]
    pub email: String,
}

/// 登录响应模型（预留）。
///
/// 目前登录接口主要返回「单独的 token + 通过 `/api/auth/me` 获取用户信息」，
/// 尚未使用这种「一次性返回 token + user 对象」的复合响应。
/// 若你将来希望在登录接口中直接返回完整用户信息，可以启用此结构体。
#[derive(Debug, Serialize)]
#[allow(dead_code)]
pub struct AuthResponse {
    pub token: String,
    pub user: UserResponse,
}

#[derive(Debug, Serialize)]
pub struct UserResponse {
    pub id: Uuid,
    pub username: String,
    pub email: String,
    pub created_at: DateTime<Utc>,
}

impl From<User> for UserResponse {
    fn from(user: User) -> Self {
        UserResponse {
            id: user.id,
            username: user.username,
            email: user.email,
            created_at: user.created_at,
        }
    }
}
