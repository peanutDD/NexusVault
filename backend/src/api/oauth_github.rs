//! GitHub OAuth 登录路由
//!
//! 提供两类能力：
//! - 获取 GitHub 授权 URL：`GET /api/auth/oauth/github/url`
//! - 处理 GitHub 回调：`GET /api/auth/oauth/github/callback?code=...&state=...`

use axum::extract::{Query, State};
use axum::response::{IntoResponse, Redirect, Response};
use serde::Deserialize;
use serde_json::json;
use uuid::Uuid;

use crate::services::auth::AuthService;
use crate::utils::{json_response, AppError};
use crate::AppState;

/// 返回前端应跳转的 GitHub 授权地址
pub async fn github_oauth_url_handler(State(state): State<AppState>) -> Result<Response, AppError> {
    let config = &state.config;

    let client_id = config
        .github_client_id
        .clone()
        .ok_or_else(|| AppError::Validation("GitHub OAuth is not configured".to_string()))?;
    let redirect_uri = config.github_oauth_redirect_uri.clone().ok_or_else(|| {
        AppError::Validation("GITHUB_OAUTH_REDIRECT_URI is not configured".to_string())
    })?;

    // 生成随机 state，并缓存起来用于回调时校验，防止 CSRF
    let state_str = Uuid::new_v4().to_string();
    if let Some(pool) = &state.redis {
        crate::services::redis::RedisService::new(pool.clone())
            .set_oauth_state("github", &state_str)
            .await
            .map_err(|_| AppError::Internal)?;
    } else {
        state.cache.set_oauth_state("github", &state_str);
    }

    let authorize_url = format!(
        "https://github.com/login/oauth/authorize?client_id={}&redirect_uri={}&scope={}&state={}",
        urlencoding::encode(&client_id),
        urlencoding::encode(&redirect_uri),
        // 读取基础用户信息 + 邮箱
        urlencoding::encode("read:user user:email"),
        urlencoding::encode(&state_str),
    );

    Ok(json_response(json!({ "url": authorize_url })))
}

#[derive(Debug, Deserialize)]
pub struct GithubCallbackQuery {
    pub code: String,
    pub state: String,
}

/// 处理 GitHub OAuth 回调
pub async fn github_oauth_callback_handler(
    State(state): State<AppState>,
    Query(query): Query<GithubCallbackQuery>,
) -> Result<impl IntoResponse, AppError> {
    // 校验 state，防止 CSRF
    let ok = if let Some(pool) = &state.redis {
        crate::services::redis::RedisService::new(pool.clone())
            .verify_and_consume_oauth_state("github", &query.state)
            .await
            .map_err(|_| AppError::Internal)?
    } else {
        state
            .cache
            .verify_and_consume_oauth_state("github", &query.state)
    };
    if !ok {
        return Err(AppError::Auth("Invalid OAuth state".to_string()));
    }

    let config = &state.config;
    let client_id = config
        .github_client_id
        .clone()
        .ok_or_else(|| AppError::Validation("GitHub OAuth is not configured".to_string()))?;
    let client_secret = config.github_client_secret.clone().ok_or_else(|| {
        AppError::Validation("GITHUB_CLIENT_SECRET is not configured".to_string())
    })?;
    let redirect_uri = config.github_oauth_redirect_uri.clone().ok_or_else(|| {
        AppError::Validation("GITHUB_OAUTH_REDIRECT_URI is not configured".to_string())
    })?;

    let frontend_base = config
        .frontend_base_url
        .clone()
        .or_else(|| {
            // 尝试从 CORS_ORIGIN 中取第一个作为前端地址（逗号分隔）
            let first = config
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

    // 1. 用 code 向 GitHub 换取 access_token
    #[derive(Deserialize)]
    struct AccessTokenResponse {
        access_token: String,
        // token_type: String,
        // scope: String,
    }

    let client = reqwest::Client::new();

    let token_res = client
        .post("https://github.com/login/oauth/access_token")
        .header(reqwest::header::ACCEPT, "application/json")
        .form(&json!({
            "client_id": client_id,
            "client_secret": client_secret,
            "code": query.code,
            "redirect_uri": redirect_uri,
        }))
        .send()
        .await
        .map_err(|e| AppError::Auth(format!("Failed to exchange GitHub code: {}", e)))?;

    let status = token_res.status();
    if !status.is_success() {
        let body = token_res
            .text()
            .await
            .unwrap_or_else(|_| "<failed to read body>".to_string());
        return Err(AppError::Auth(format!(
            "GitHub token endpoint returned {}: {}",
            status, body
        )));
    }

    let token_body: AccessTokenResponse = token_res
        .json()
        .await
        .map_err(|e| AppError::Auth(format!("Failed to parse GitHub token response: {}", e)))?;

    let access_token = token_body.access_token;

    // 2. 用 access_token 获取 GitHub 用户信息
    #[derive(Debug, Deserialize)]
    struct GithubUser {
        id: i64,
        login: String,
        name: Option<String>,
        email: Option<String>,
    }

    #[derive(Debug, Deserialize, Clone)]
    struct GithubEmail {
        email: String,
        primary: bool,
        verified: bool,
        // visibility: Option<String>,
    }

    let user_res = client
        .get("https://api.github.com/user")
        .header(reqwest::header::ACCEPT, "application/json")
        .header(
            reqwest::header::AUTHORIZATION,
            format!("token {}", access_token),
        )
        .header(reqwest::header::USER_AGENT, "upload-download-util/1.0")
        .send()
        .await
        .map_err(|e| AppError::Auth(format!("Failed to fetch GitHub user: {}", e)))?;

    let status = user_res.status();
    if !status.is_success() {
        let body = user_res
            .text()
            .await
            .unwrap_or_else(|_| "<failed to read body>".to_string());
        return Err(AppError::Auth(format!(
            "GitHub user endpoint returned {}: {}",
            status, body
        )));
    }

    let gh_user: GithubUser = user_res
        .json()
        .await
        .map_err(|e| AppError::Auth(format!("Failed to parse GitHub user: {}", e)))?;

    // 3. 解析邮箱：
    //    - 优先从 /user/emails 中选择 primary + verified（如果没有，则退而求其次）
    //    - 如 /user/emails 调用失败或列表为空，再回退到 gh_user.email
    let email = {
        let emails_res = client
            .get("https://api.github.com/user/emails")
            .header(reqwest::header::ACCEPT, "application/json")
            .header(
                reqwest::header::AUTHORIZATION,
                format!("token {}", access_token),
            )
            .header(reqwest::header::USER_AGENT, "upload-download-util/1.0")
            .send()
            .await
            .map_err(|e| AppError::Auth(format!("Failed to fetch GitHub emails: {}", e)))?;

        let status = emails_res.status();
        if !status.is_success() {
            let body = emails_res
                .text()
                .await
                .unwrap_or_else(|_| "<failed to read body>".to_string());
            return Err(AppError::Auth(format!(
                "GitHub emails endpoint returned {}: {}",
                status, body
            )));
        }

        let emails: Vec<GithubEmail> = emails_res
            .json()
            .await
            .map_err(|e| AppError::Auth(format!("Failed to parse GitHub emails: {}", e)))?;

        let primary = emails
            .iter()
            .find(|e| e.primary && e.verified)
            .or_else(|| emails.iter().find(|e| e.primary))
            .or_else(|| emails.iter().find(|e| e.verified))
            .cloned();

        if let Some(email) = primary
            .or_else(|| emails.into_iter().next())
            .map(|e| e.email)
        {
            email
        } else if let Some(ref email) = gh_user.email {
            email.clone()
        } else {
            return Err(AppError::Auth(
                "GitHub account has no accessible email address".to_string(),
            ));
        }
    };

    let username_hint = gh_user
        .name
        .clone()
        .filter(|s| !s.trim().is_empty())
        .unwrap_or_else(|| gh_user.login.clone());

    // 记录 GitHub 回调中解析出的关键信息，便于调试「究竟是哪一个邮箱/用户在登录」
    tracing::info!(
        "github_oauth_callback: github_id={}, login={}, raw_email={:?}, selected_email={}, username_hint={}",
        gh_user.id,
        gh_user.login,
        gh_user.email,
        email,
        username_hint
    );

    // 4. 在本地用户系统中查找或创建用户，并生成 JWT
    let auth_service = AuthService::from_state(&state);
    let user = auth_service
        .find_or_create_oauth_user(&username_hint, &email)
        .await?;
    let token = auth_service.generate_token(&user.id)?;

    // 5. 重定向回前端，携带 token 让前端完成 setAuth + 跳转
    let redirect_url = format!(
        "{}/auth/callback/github?token={}",
        frontend_base,
        urlencoding::encode(&token)
    );

    Ok(Redirect::temporary(&redirect_url))
}
