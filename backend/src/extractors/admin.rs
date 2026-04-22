use axum::{async_trait, extract::FromRequestParts, http::request::Parts};

use crate::{utils::AppError, AppState};

#[derive(Debug, Clone, Copy)]
pub struct AdminToken;

fn constant_time_eq(a: &str, b: &str) -> bool {
    let a_bytes = a.as_bytes();
    let b_bytes = b.as_bytes();
    if a_bytes.len() != b_bytes.len() {
        return false;
    }
    let mut diff: u8 = 0;
    for i in 0..a_bytes.len() {
        diff |= a_bytes[i] ^ b_bytes[i];
    }
    diff == 0
}

fn extract_admin_token(parts: &Parts) -> Option<String> {
    if let Some(v) = parts.headers.get(axum::http::header::AUTHORIZATION) {
        if let Ok(s) = v.to_str() {
            if let Some(rest) = s.strip_prefix("Bearer ") {
                let t = rest.trim();
                if !t.is_empty() {
                    return Some(t.to_string());
                }
            }
        }
    }

    if let Some(v) = parts.headers.get("x-admin-token") {
        if let Ok(s) = v.to_str() {
            let t = s.trim();
            if !t.is_empty() {
                return Some(t.to_string());
            }
        }
    }

    None
}

#[async_trait]
impl FromRequestParts<AppState> for AdminToken {
    type Rejection = AppError;

    async fn from_request_parts(
        parts: &mut Parts,
        state: &AppState,
    ) -> Result<Self, Self::Rejection> {
        let Some(expected) = state.config.auth.admin_token.as_deref() else {
            return Err(AppError::Unauthorized);
        };
        let Some(provided) = extract_admin_token(parts) else {
            return Err(AppError::Unauthorized);
        };
        if !constant_time_eq(expected, &provided) {
            return Err(AppError::Unauthorized);
        }
        Ok(AdminToken)
    }
}
