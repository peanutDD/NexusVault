//! # Authentication Extractor
//!
//! 提供统一的用户认证提取器，支持 JWT token 和 API token。
//!
//! ## 使用示例
//!
//! ```rust
//! use axum::extract::State;
//! use axum::response::Response;
//! use file_storage_backend::extractors::AuthenticatedUser;
//! use file_storage_backend::utils::AppError;
//! use file_storage_backend::AppState;
//!
//! pub async fn handler(
//!     State(_state): State<AppState>,
//!     AuthenticatedUser(_user_id): AuthenticatedUser,
//!     // ...
//! ) -> Result<Response, AppError> {
//!     // user_id 已经验证，可以直接使用
//!     unimplemented!()
//! }
//! ```

use axum::{
    async_trait,
    extract::FromRequestParts,
    http::{request::Parts, HeaderMap, Method},
};
use percent_encoding::percent_decode_str;
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
        let user_id = extract_user_id_from_headers(headers, &state.config, &state.pool).await?;

        Ok(AuthenticatedUser(user_id))
    }
}

/// 允许从 query 中读取 token 的认证提取器（仅用于预览/下载等 GET 场景）。
///
/// **安全说明**：仅当请求为 **GET** 时接受 `?token=xxx`；POST/PUT 等必须使用 Authorization header。
/// 勿在不可信环境（如第三方站点、Referer 会泄露的页面）将 token 放在 URL，否则可能出现在 Referer、服务器日志中。
#[derive(Debug, Clone, Copy)]
pub struct AuthenticatedUserQuery(pub Uuid);

#[async_trait]
impl FromRequestParts<AppState> for AuthenticatedUserQuery {
    type Rejection = AppError;

    async fn from_request_parts(
        parts: &mut Parts,
        state: &AppState,
    ) -> Result<Self, Self::Rejection> {
        // 先尝试 Authorization header（任意方法均允许）
        if let Ok(user_id) =
            extract_user_id_from_headers(&parts.headers, &state.config, &state.pool).await
        {
            return Ok(AuthenticatedUserQuery(user_id));
        }

        // 再尝试 query token：仅 GET 允许，避免 token 随 POST body 等进入日志
        if let Some(token) = extract_token_from_query(parts) {
            if parts.method != Method::GET {
                return Err(AppError::Unauthorized);
            }
            let user_id = extract_user_id_from_token(&token, &state.config, &state.pool).await?;
            return Ok(AuthenticatedUserQuery(user_id));
        }

        Err(AppError::Unauthorized)
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
pub(crate) async fn extract_user_id_from_headers(
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
    extract_user_id_from_token(token, config, pool).await
}

/// 从 token 字符串中提取并验证用户 ID（JWT 或 API token）
pub(crate) async fn extract_user_id_from_token(
    token: &str,
    config: &Config,
    pool: &PgPool,
) -> Result<Uuid, AppError> {
    // 优先尝试 JWT token
    if let Ok(user_id) = extract_user_id_from_jwt_token(config, token) {
        tracing::debug!(user_id = %user_id, "Authenticated via JWT token");
        return Ok(user_id);
    }

    // 如果 JWT 失败，尝试 API token
    let token_service = crate::services::api_token::ApiTokenService::new(
        pool.clone(),
        config.api_token_hmac_secrets(),
    );
    let user_id = token_service.verify_token(token).await?;
    tracing::debug!(user_id = %user_id, "Authenticated via API token");
    Ok(user_id)
}

/// 从 query string 中提取 token 参数（如 ?token=xxx）
fn extract_token_from_query(parts: &Parts) -> Option<String> {
    let query = parts.uri.query()?;
    for pair in query.split('&') {
        let mut iter = pair.splitn(2, '=');
        let key = iter.next()?;
        let value = iter.next().unwrap_or_default();
        if key == "token" && !value.is_empty() {
            let decoded = percent_decode_str(value).decode_utf8_lossy();
            return Some(decoded.to_string());
        }
    }
    None
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
    use jsonwebtoken::{decode, Algorithm, DecodingKey, Validation};
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

    // 明确指定 HS256 算法，防止算法混淆攻击
    let mut validation = Validation::new(Algorithm::HS256);
    validation.validate_exp = true;

    // 解码并验证 token
    let token_data = decode::<Claims>(
        token,
        &DecodingKey::from_secret(config.jwt_secret.as_ref()),
        &validation,
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
