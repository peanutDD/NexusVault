//! Google OAuth 登录路由
//!
//! 提供两类能力：
//! - 获取 Google 授权 URL：`GET /api/auth/oauth/google/url`
//! - 处理 Google 回调：`GET /api/auth/oauth/google/callback?code=...&state=...`

use axum::extract::{Query, State};
use axum::response::{IntoResponse, Redirect, Response};
use axum::Json;
use serde::Deserialize;
use serde_json::json;

use crate::services::auth::AuthService;
use crate::utils::AppError;
use crate::AppState;

/// 返回前端应跳转的 Google 授权地址
pub async fn google_oauth_url_handler(State(state): State<AppState>) -> Result<Response, AppError> {
    let config = &state.config;

    let client_id = config
        .oauth
        .google_client_id
        .clone()
        .ok_or_else(|| AppError::Validation("Google OAuth is not configured".to_string()))?;
    let redirect_uri = config.oauth.google_oauth_redirect_uri.clone().ok_or_else(|| {
        AppError::Validation("GOOGLE_OAUTH_REDIRECT_URI is not configured".to_string())
    })?;

    // 生成随机 state，并缓存起来用于回调时校验，防止 CSRF
    let state_str = uuid::Uuid::new_v4().to_string();
    if let Some(pool) = &state.redis {
        crate::services::redis::RedisService::new(pool.clone())
            .set_oauth_state("google", &state_str)
            .await
            .map_err(|_| AppError::Internal)?;
    } else {
        state.cache.set_oauth_state("google", &state_str);
    }

    // Google 授权 URL（OAuth 2.0, Authorization Code + PKCE 可选，这里用最基础模式）
    let authorize_url = format!(
        "https://accounts.google.com/o/oauth2/v2/auth?client_id={}&redirect_uri={}&response_type=code&scope={}&state={}&access_type=offline&include_granted_scopes=true",
        urlencoding::encode(&client_id),
        urlencoding::encode(&redirect_uri),
        urlencoding::encode("openid email profile"),
        urlencoding::encode(&state_str),
    );

    Ok(Json(json!({ "url": authorize_url })).into_response())
}

#[derive(Debug, Deserialize)]
pub struct GoogleCallbackQuery {
    pub code: String,
    pub state: String,
}

/// 处理 Google OAuth 回调
pub async fn google_oauth_callback_handler(
    State(state): State<AppState>,
    Query(query): Query<GoogleCallbackQuery>,
) -> Result<impl IntoResponse, AppError> {
    // 校验 state，防止 CSRF
    let ok = if let Some(pool) = &state.redis {
        crate::services::redis::RedisService::new(pool.clone())
            .verify_and_consume_oauth_state("google", &query.state)
            .await
            .map_err(|_| AppError::Internal)?
    } else {
        state
            .cache
            .verify_and_consume_oauth_state("google", &query.state)
    };
    if !ok {
        return Err(AppError::Auth("Invalid OAuth state".to_string()));
    }

    let config = &state.config;
    let client_id = config
        .oauth
        .google_client_id
        .clone()
        .ok_or_else(|| AppError::Validation("Google OAuth is not configured".to_string()))?;
    let client_secret = config.oauth.google_client_secret.clone().ok_or_else(|| {
        AppError::Validation("GOOGLE_CLIENT_SECRET is not configured".to_string())
    })?;
    let redirect_uri = config.oauth.google_oauth_redirect_uri.clone().ok_or_else(|| {
        AppError::Validation("GOOGLE_OAUTH_REDIRECT_URI is not configured".to_string())
    })?;

    let frontend_base = config
        .server
        .frontend_base_url
        .clone()
        .or_else(|| {
            let first = config
                .server
                .cors_origin
                .split(',')
                .next()
                .map(str::trim)
                .unwrap_or("");
            if first.is_empty() {
                None
            } else {
                Some(first.to_string())
            }
        })
        .ok_or_else(|| {
            AppError::Validation(
                "FRONTEND_BASE_URL or CORS_ORIGIN must be configured for OAuth redirect"
                    .to_string(),
            )
        })?;

    #[derive(Debug, Deserialize)]
    struct TokenResponse {
        access_token: String,
        // id_token: String,
        // token_type: String,
        // expires_in: i64,
        // scope: String,
    }

    let client = reqwest::Client::new();

    // 1. 用 code 换取 access_token（Google Token Endpoint）
    let token_res = client
        .post("https://oauth2.googleapis.com/token")
        .form(&json!({
            "client_id": client_id,
            "client_secret": client_secret,
            "code": query.code,
            "grant_type": "authorization_code",
            "redirect_uri": redirect_uri,
        }))
        .send()
        .await
        .map_err(|e| AppError::Auth(format!("Failed to exchange Google code: {}", e)))?;

    let status = token_res.status();
    if !status.is_success() {
        let body = token_res
            .text()
            .await
            .unwrap_or_else(|_| "<failed to read body>".to_string());
        return Err(AppError::Auth(format!(
            "Google token endpoint returned {}: {}",
            status, body
        )));
    }

    let token_body: TokenResponse = token_res
        .json()
        .await
        .map_err(|e| AppError::Auth(format!("Failed to parse Google token response: {}", e)))?;

    let access_token = token_body.access_token;

    // 2. 用 access_token 获取用户信息（OpenID Connect UserInfo）
    #[derive(Debug, Deserialize)]
    struct GoogleUserInfo {
        sub: String,
        email: String,
        email_verified: bool,
        name: Option<String>,
        given_name: Option<String>,
        #[allow(dead_code)] // 目前仅做结构预留，未来若展示更详细资料可用
        family_name: Option<String>,
        #[allow(dead_code)] // 目前未在业务中使用头像 URL
        picture: Option<String>,
    }

    let user_res = client
        .get("https://openidconnect.googleapis.com/v1/userinfo")
        .bearer_auth(&access_token)
        .send()
        .await
        .map_err(|e| AppError::Auth(format!("Failed to fetch Google userinfo: {}", e)))?;

    let status = user_res.status();
    if !status.is_success() {
        let body = user_res
            .text()
            .await
            .unwrap_or_else(|_| "<failed to read body>".to_string());
        return Err(AppError::Auth(format!(
            "Google userinfo endpoint returned {}: {}",
            status, body
        )));
    }

    let info: GoogleUserInfo = user_res
        .json()
        .await
        .map_err(|e| AppError::Auth(format!("Failed to parse Google userinfo: {}", e)))?;

    if !info.email_verified {
        return Err(AppError::Auth(
            "Google account email is not verified".to_string(),
        ));
    }

    let email = info.email;
    let username_hint = info
        .name
        .clone()
        .or(info.given_name.clone())
        .unwrap_or_else(|| format!("google-{}", &info.sub[..8]));

    tracing::info!(
        "google_oauth_callback: sub={}, name={:?}, email={}, email_verified={}, username_hint={}",
        info.sub,
        info.name,
        email,
        info.email_verified,
        username_hint
    );

    // 3. 在本地用户系统中查找或创建用户，并生成 JWT
    let auth_service = AuthService::from_state(&state);
    let user = auth_service
        .find_or_create_oauth_user(&username_hint, &email)
        .await?;
    let token = auth_service.generate_token(&user.id)?;

    // 4. 重定向回前端，携带 token 让前端完成 setAuth + 跳转
    let redirect_url = format!(
        "{}/auth/callback/google?token={}",
        frontend_base,
        urlencoding::encode(&token)
    );

    Ok(Redirect::temporary(&redirect_url))
}
