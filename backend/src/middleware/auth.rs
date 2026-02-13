use axum::{
    extract::{Request, State},
    http::HeaderMap,
    middleware::Next,
    response::Response,
};
use uuid::Uuid;

use crate::{config::Config, utils::AppError};

/// 简单版 JWT 鉴权中间件（预留）。
///
/// 当前项目已经通过 `extractors::auth::AuthenticatedUser` 在 Handler
/// 层完成鉴权与 user_id 提取，因此没有在路由上挂载本中间件。
/// 如果你未来希望以「全局中间件 + 扁平 Handler」的风格组织代码，
/// 可以改为在路由层使用本方法，并逐步迁移现有 Handler。
#[allow(dead_code)]
pub async fn auth_middleware(
    State(config): State<Config>,
    headers: HeaderMap,
    request: Request,
    next: Next,
) -> Result<Response, AppError> {
    let auth_header = headers
        .get("authorization")
        .and_then(|h| h.to_str().ok())
        .ok_or(AppError::Unauthorized)?;

    if !auth_header.starts_with("Bearer ") {
        return Err(AppError::Unauthorized);
    }

    let token = auth_header.trim_start_matches("Bearer ");
    let _user_id = verify_token_simple(&config, token)?;
    Ok(next.run(request).await)
}

fn verify_token_simple(config: &Config, token: &str) -> Result<Uuid, AppError> {
    use jsonwebtoken::{decode, DecodingKey, Validation};
    use serde::{Deserialize, Serialize};

    #[derive(Debug, Serialize, Deserialize)]
    struct Claims {
        sub: String,
        exp: usize,
        iat: usize,
    }

    let token_data = decode::<Claims>(
        token,
        &DecodingKey::from_secret(config.jwt_secret.as_ref()),
        &Validation::default(),
    )
    .map_err(|_| AppError::Unauthorized)?;

    let user_id = Uuid::parse_str(&token_data.claims.sub).map_err(|_| AppError::Unauthorized)?;

    Ok(user_id)
}
