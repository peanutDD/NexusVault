//! # Authentication Extractor
//!
//! 提供统一的用户认证提取器，支持 JWT token 和 API token。
//!
//! ## 使用示例
//!
//! ```rust
//! pub async fn handler(
//!     State(state): State<AppState>,
//!     AuthenticatedUser(user_id): AuthenticatedUser,
//!     // ...
//! ) -> Result<Response, AppError> {
//!     // user_id 已经验证，可以直接使用
//! }
//! ```

use axum::{
    async_trait,
    extract::FromRequestParts,
    http::{request::Parts, HeaderMap},
};
use sqlx::PgPool;
use uuid::Uuid;

use crate::{config::Config, utils::AppError, AppState};

/// 已认证的用户 ID
///
/// 这个 extractor 会自动从请求头中提取并验证用户身份。
/// 支持两种认证方式：
/// 1. JWT token（Bearer token）
/// 2. API token
///
/// 如果认证失败，会返回 `AppError::Unauthorized`。
#[derive(Debug, Clone, Copy)]
pub struct AuthenticatedUser(pub Uuid);

#[async_trait]
impl FromRequestParts<AppState> for AuthenticatedUser {
    type Rejection = AppError;

    async fn from_request_parts(
        parts: &mut Parts,
        state: &AppState,
    ) -> Result<Self, Self::Rejection> {
        // 从请求头中提取 Authorization token
        let headers = &parts.headers;
        let user_id =
            extract_user_id_from_headers(headers, &state.config, &state.pool).await?;

        Ok(AuthenticatedUser(user_id))
    }
}

/// 从请求头中提取并验证用户 ID
///
/// 支持两种认证方式：
/// 1. JWT token（优先）
/// 2. API token（备用）
///
/// # 参数
/// - `headers`: HTTP 请求头
/// - `config`: 应用配置
/// - `pool`: 数据库连接池
///
/// # 返回
/// - `Ok(Uuid)`: 验证成功的用户 ID
/// - `Err(AppError::Unauthorized)`: 认证失败
async fn extract_user_id_from_headers(
    headers: &HeaderMap,
    config: &Config,
    pool: &PgPool,
) -> Result<Uuid, AppError> {
    // 提取 Authorization header
    let auth_header = headers
        .get("authorization")
        .and_then(|h| h.to_str().ok())
        .ok_or_else(|| {
            tracing::debug!("Missing Authorization header");
            AppError::Unauthorized
        })?;

    // 验证 Bearer 格式
    if !auth_header.starts_with("Bearer ") {
        tracing::debug!("Invalid Authorization header format");
        return Err(AppError::Unauthorized);
    }

    let token = auth_header.trim_start_matches("Bearer ");

    // 优先尝试 JWT token
    if let Ok(user_id) = extract_user_id_from_jwt_token(config, token) {
        tracing::debug!(user_id = %user_id, "Authenticated via JWT token");
        return Ok(user_id);
    }

    // 如果 JWT 失败，尝试 API token
    let token_service = crate::services::api_token::ApiTokenService::new(pool.clone());
    let user_id = token_service.verify_token(token).await?;
    tracing::debug!(user_id = %user_id, "Authenticated via API token");
    Ok(user_id)
}

/// 从 JWT token 中提取用户 ID
///
/// # 参数
/// - `config`: 应用配置（包含 JWT secret）
/// - `token`: JWT token 字符串
///
/// # 返回
/// - `Ok(Uuid)`: 解析成功的用户 ID
/// - `Err(AppError::Unauthorized)`: token 无效或过期
fn extract_user_id_from_jwt_token(config: &Config, token: &str) -> Result<Uuid, AppError> {
    use jsonwebtoken::{decode, DecodingKey, Validation};
    use serde::{Deserialize, Serialize};

    /// JWT Claims 结构
    #[derive(Debug, Serialize, Deserialize)]
    struct Claims {
        /// Subject (用户 ID)
        sub: String,
        /// Expiration time
        exp: usize,
        /// Issued at
        iat: usize,
    }

    // 解码并验证 token
    let token_data = decode::<Claims>(
        token,
        &DecodingKey::from_secret(config.jwt_secret.as_ref()),
        &Validation::default(),
    )
    .map_err(|e| {
        tracing::debug!("JWT token decode failed: {}", e);
        AppError::Unauthorized
    })?;

    // 解析用户 ID
    let user_id = Uuid::parse_str(&token_data.claims.sub).map_err(|e| {
        tracing::debug!("Invalid user ID in JWT token: {}", e);
        AppError::Unauthorized
    })?;

    Ok(user_id)
}
