use axum::{
    extract::{Request, State},
    http::HeaderMap,
    middleware::Next,
    response::Response,
};
use uuid::Uuid;

use crate::{config::Config, utils::AppError};

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

// Better approach: Extract user from token in handlers
pub fn extract_user_id_from_token(config: &Config, token: &str) -> Result<Uuid, AppError> {
    verify_token_simple(config, token)
}
