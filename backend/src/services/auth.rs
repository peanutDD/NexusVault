//! # 认证服务模块
//!
//! 提供用户认证相关的业务逻辑，包括：
//!
//! - **用户注册**: 创建新用户，密码哈希存储
//! - **用户登录**: 验证凭据，生成 JWT token
//! - **Token 管理**: 生成和验证 JWT token
//! - **密码管理**: 修改密码
//!
//! ## 设计
//!
//! - 依赖 `DynUsersRepo`（通过 Trait 抽象），便于测试时 mock
//! - 使用 bcrypt 进行密码哈希
//! - JWT token 有过期时间
//! - 所有认证失败返回统一错误，防止信息泄露

use chrono::Utc;
use jsonwebtoken::{decode, encode, Algorithm, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::{
    config::Config,
    models::user::{
        LoginRequest, RegisterRequest, SendEmailVerificationRequest, UpdateProfileRequest,
        UserResponse,
    },
    repositories::{DynUsersRepo, SqlxUsersRepo},
    services::cache::CacheService,
    utils::{hash_password, now_timestamp, parse_jwt_expiry, verify_password, AppError},
};
use lettre::message::header::ContentType;
use lettre::transport::smtp::authentication::Credentials;
use lettre::{AsyncSmtpTransport, AsyncTransport, Message, Tokio1Executor};
use rand::Rng;

/// JWT Claims 结构
#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    /// Subject (用户 ID)
    pub sub: String,
    /// Expiration time (Unix timestamp)
    pub exp: usize,
    /// Issued at (Unix timestamp)
    pub iat: usize,
}

/// 认证服务
///
/// 通过 `DynUsersRepo` 依赖抽象，而非具体的 SQLx 实现。
pub struct AuthService {
    users_repo: DynUsersRepo,
    config: Config,
    cache: CacheService,
    redis: Option<crate::services::redis::RedisService>,
}

impl AuthService {
    /// 创建新的 AuthService 实例
    pub fn new(
        users_repo: DynUsersRepo,
        config: Config,
        cache: CacheService,
        redis: Option<crate::services::redis::RedisService>,
    ) -> Self {
        Self {
            users_repo,
            config,
            cache,
            redis,
        }
    }

    /// 从 AppState 创建 AuthService（工厂方法）
    pub fn from_state(state: &crate::AppState) -> Self {
        let users_repo: DynUsersRepo = std::sync::Arc::new(SqlxUsersRepo::new(state.pool.clone()));
        let redis = state
            .redis
            .as_ref()
            .cloned()
            .map(crate::services::redis::RedisService::new);
        Self::new(
            users_repo,
            (*state.config).clone(),
            state.cache.clone(),
            redis,
        )
    }

    /// 用户注册
    pub async fn register(&self, req: RegisterRequest) -> Result<UserResponse, AppError> {
        // 验证输入
        Self::validate_register_input(&req)?;

        // 检查用户是否已存在
        if self
            .users_repo
            .exists_by_email_or_username(&req.email, &req.username)
            .await?
        {
            return Err(AppError::Validation(
                "Email or username already exists".to_string(),
            ));
        }

        // 哈希密码
        let password_hash = hash_password(&req.password)?;

        // 创建用户
        let user = self
            .users_repo
            .create(&req.username, &req.email, &password_hash)
            .await?;

        Ok(UserResponse::from(user))
    }

    /// 用户登录
    pub async fn login(&self, req: LoginRequest) -> Result<String, AppError> {
        // 查找用户
        let user = self
            .users_repo
            .find_by_email(&req.email)
            .await?
            .ok_or_else(|| AppError::Auth("Invalid email or password".to_string()))?;

        // 验证密码
        if !verify_password(&req.password, &user.password_hash)? {
            return Err(AppError::Auth("Invalid email or password".to_string()));
        }

        // 生成 token
        self.generate_token(&user.id)
    }

    /// 生成 JWT token
    pub fn generate_token(&self, user_id: &Uuid) -> Result<String, AppError> {
        let now = now_timestamp();
        let exp = parse_jwt_expiry(&self.config.jwt_expiry);

        let claims = Claims {
            sub: user_id.to_string(),
            exp,
            iat: now,
        };

        let token = encode(
            &Header::default(),
            &claims,
            &EncodingKey::from_secret(self.config.jwt_secret.as_ref()),
        )
        .map_err(|e| AppError::Auth(format!("Failed to generate token: {}", e)))?;

        Ok(token)
    }

    /// 验证 JWT token
    pub fn verify_token(&self, token: &str) -> Result<Uuid, AppError> {
        // 明确指定 HS256 算法，防止算法混淆攻击
        let mut validation = Validation::new(Algorithm::HS256);
        validation.validate_exp = true;

        let token_data = decode::<Claims>(
            token,
            &DecodingKey::from_secret(self.config.jwt_secret.as_ref()),
            &validation,
        )
        .map_err(|_| AppError::Unauthorized)?;

        let user_id =
            Uuid::parse_str(&token_data.claims.sub).map_err(|_| AppError::Unauthorized)?;

        Ok(user_id)
    }

    /// 第三方登录（如 GitHub）时，根据邮箱查找或创建用户
    ///
    /// - 若邮箱已存在，则返回对应用户
    /// - 若不存在，则以 username_hint 为基础生成唯一用户名并创建用户
    pub async fn find_or_create_oauth_user(
        &self,
        username_hint: &str,
        email: &str,
    ) -> Result<UserResponse, AppError> {
        // 1. 先尝试按邮箱查找已存在用户
        if let Some(user) = self.users_repo.find_by_email(email).await? {
            tracing::info!(
                "oauth_login_existing_user: user_id={}, username={}, email={}, provider=github",
                user.id,
                user.username,
                user.email
            );
            return Ok(UserResponse::from(user));
        }

        // 2. 生成唯一用户名：以 hint 为基础，必要时追加 -1/-2/...
        let base = username_hint.trim();
        let mut candidate = if base.is_empty() {
            email.split('@').next().unwrap_or("user").to_string()
        } else {
            base.to_string()
        };

        // 简单清洗：去掉空白
        candidate = candidate.replace(char::is_whitespace, "");

        // 限制最大长度，避免超出 username 字段限制
        if candidate.len() > 50 {
            candidate.truncate(50);
        }

        let mut username = candidate.clone();
        let mut suffix = 1u32;
        while self
            .users_repo
            .exists_by_email_or_username(email, &username)
            .await?
        {
            let trimmed = if candidate.len() > 45 {
                &candidate[..45]
            } else {
                &candidate
            };
            username = format!("{}-{}", trimmed, suffix);
            suffix += 1;
        }

        // 3. 创建用户（OAuth 登录不需要本地密码，使用随机哈希占位）
        let random_password = Uuid::new_v4().to_string();
        let password_hash = hash_password(&random_password)?;
        let user = self
            .users_repo
            .create(&username, email, &password_hash)
            .await?;

        tracing::info!(
            "oauth_login_new_user_created: user_id={}, username={}, email={}, provider=github",
            user.id,
            user.username,
            user.email
        );

        Ok(UserResponse::from(user))
    }

    /// 获取用户信息
    pub async fn get_user(&self, user_id: Uuid) -> Result<UserResponse, AppError> {
        let user = self
            .users_repo
            .find_by_id(user_id)
            .await?
            .ok_or(AppError::NotFound)?;

        Ok(UserResponse::from(user))
    }

    /// 修改密码
    pub async fn change_password(
        &self,
        user_id: Uuid,
        current_password: String,
        new_password: String,
    ) -> Result<(), AppError> {
        // 验证新密码：与注册规则一致（长度 8–64，且至少包含 1 个字母和 1 个数字）
        let len = new_password.len();
        if !(8..=64).contains(&len) {
            return Err(AppError::Validation(
                "New password must be between 8 and 64 characters".to_string(),
            ));
        }
        let has_letter = new_password.chars().any(|c| c.is_ascii_alphabetic());
        let has_digit = new_password.chars().any(|c| c.is_ascii_digit());
        if !has_letter || !has_digit {
            return Err(AppError::Validation(
                "New password must contain at least one letter and one digit".to_string(),
            ));
        }

        // 获取用户
        let user = self
            .users_repo
            .find_by_id(user_id)
            .await?
            .ok_or(AppError::NotFound)?;

        // 验证当前密码
        if !verify_password(&current_password, &user.password_hash)? {
            return Err(AppError::Validation(
                "Current password is incorrect".to_string(),
            ));
        }

        // 哈希新密码
        let new_password_hash = hash_password(&new_password)?;

        // 更新密码
        self.users_repo
            .update_password(user_id, &new_password_hash, Utc::now())
            .await?;

        Ok(())
    }

    /// 发送邮箱验证码（修改邮箱时用）
    ///
    /// 先校验邮箱格式、是否被其他用户占用，通过后才生成并发送验证码。
    pub async fn send_email_verification_code(
        &self,
        user_id: Uuid,
        req: SendEmailVerificationRequest,
    ) -> Result<(), AppError> {
        validator::Validate::validate(&req)
            .map_err(|e| AppError::Validation(format!("邮箱格式无效: {}", e)))?;

        // 检查邮箱是否被其他用户占用
        if let Some(other) = self.users_repo.find_by_email(&req.email).await? {
            if other.id != user_id {
                return Err(AppError::Conflict("该邮箱已被其他用户使用".to_string()));
            }
        }

        let code = {
            let mut rng = rand::rng();
            (0..6)
                .map(|_| rng.random_range(0..10).to_string())
                .collect::<String>()
        };
        if let Some(redis) = &self.redis {
            redis
                .set_email_verification_code(user_id, &req.email, &code)
                .await
                .map_err(|_| AppError::Internal)?;
        } else {
            self.cache
                .set_email_verification_code(user_id, &req.email, &code);
        }

        // SMTP 已配置则发送邮件，否则写入日志（开发环境）
        if let (Some(host), Some(from)) = (&self.config.smtp_host, &self.config.smtp_from) {
            let to_addr = req
                .email
                .parse()
                .map_err(|_| AppError::Validation("无效的收件人邮箱".to_string()))?;
            let from_addr = from
                .parse()
                .map_err(|_| AppError::Validation("无效的发件人邮箱配置".to_string()))?;

            let email = Message::builder()
                .from(from_addr)
                .to(to_addr)
                .subject("邮箱验证码")
                .header(ContentType::TEXT_PLAIN)
                .body(format!("您的验证码是：{}，10 分钟内有效。", code))
                .map_err(|e| AppError::Validation(format!("构建邮件失败: {}", e)))?;

            let mut builder = AsyncSmtpTransport::<Tokio1Executor>::relay(host)
                .map_err(|e| AppError::Validation(format!("SMTP 配置失败: {}", e)))?;

            if let (Some(u), Some(p)) = (&self.config.smtp_username, &self.config.smtp_password) {
                builder = builder.credentials(Credentials::new(u.clone(), p.clone()));
            }
            if let Some(port) = self.config.smtp_port {
                builder = builder.port(port);
            }

            let mailer = builder.build();
            if let Err(e) = mailer.send(email).await {
                tracing::warn!("发送邮箱验证码失败: {}", e);
                return Err(AppError::Validation(
                    "发送验证码失败，请稍后重试".to_string(),
                ));
            }
        } else {
            tracing::info!(
                "SMTP 未配置，邮箱验证码已写入日志: email={}, code={}",
                req.email,
                code
            );
        }

        Ok(())
    }

    /// 更新用户资料（用户名、邮箱）
    pub async fn update_profile(
        &self,
        user_id: Uuid,
        req: UpdateProfileRequest,
    ) -> Result<UserResponse, AppError> {
        validator::Validate::validate(&req)
            .map_err(|e| AppError::Validation(format!("Validation error: {}", e)))?;

        let current = self
            .users_repo
            .find_by_id(user_id)
            .await?
            .ok_or(AppError::NotFound)?;

        // 修改邮箱时必须提供验证码
        if req.email != current.email {
            let code = req
                .email_verification_code
                .as_deref()
                .filter(|s| !s.trim().is_empty())
                .ok_or_else(|| {
                    AppError::Validation("修改邮箱需要先获取并填写验证码".to_string())
                })?;

            let ok = if let Some(redis) = &self.redis {
                redis
                    .verify_and_consume_email_code(user_id, &req.email, code)
                    .await
                    .map_err(|_| AppError::Internal)?
            } else {
                self.cache
                    .verify_and_consume_email_code(user_id, &req.email, code)
            };
            if !ok {
                return Err(AppError::Validation("验证码错误或已过期".to_string()));
            }
        }

        // 检查用户名是否被其他用户占用
        if let Some(other) = self.users_repo.find_by_username(&req.username).await? {
            tracing::info!(
                "update_profile 用户名检查: username={} 已存在, 占用者 user_id={}, 当前 user_id={}, 冲突={}",
                req.username,
                other.id,
                user_id,
                other.id != user_id
            );
            if other.id != user_id {
                return Err(AppError::Conflict("用户名已被占用".to_string()));
            }
        } else {
            tracing::info!(
                "update_profile 用户名检查: username={} 未被占用",
                req.username
            );
        }
        // 检查邮箱是否被其他用户占用
        if let Some(other) = self.users_repo.find_by_email(&req.email).await? {
            tracing::info!(
                "update_profile 邮箱检查: email={} 已存在, 占用者 user_id={}, 当前 user_id={}, 冲突={}",
                req.email,
                other.id,
                user_id,
                other.id != user_id
            );
            if other.id != user_id {
                return Err(AppError::Conflict("邮箱已被占用".to_string()));
            }
        } else {
            tracing::info!("update_profile 邮箱检查: email={} 未被占用", req.email);
        }

        let now = Utc::now();
        self.users_repo
            .update_profile(user_id, &req.username, &req.email, now)
            .await?;

        self.get_user(user_id).await
    }

    /// 检查用户名和邮箱是否可用（排除当前用户）
    pub async fn check_profile_availability(
        &self,
        user_id: Uuid,
        username: &str,
        email: &str,
    ) -> Result<(bool, bool), AppError> {
        let username_available = match self.users_repo.find_by_username(username).await? {
            Some(other) => {
                tracing::info!(
                    "check_profile_availability: username={} 已存在, 占用者 user_id={}, 当前 user_id={}, 是否本人={}",
                    username,
                    other.id,
                    user_id,
                    other.id == user_id
                );
                other.id == user_id
            }
            None => {
                tracing::info!("check_profile_availability: username={} 未被占用", username);
                true
            }
        };
        let email_available = match self.users_repo.find_by_email(email).await? {
            Some(other) => {
                tracing::info!(
                    "check_profile_availability: email={} 已存在, 占用者 user_id={}, 当前 user_id={}, 是否本人={}",
                    email,
                    other.id,
                    user_id,
                    other.id == user_id
                );
                other.id == user_id
            }
            None => {
                tracing::info!("check_profile_availability: email={} 未被占用", email);
                true
            }
        };
        Ok((username_available, email_available))
    }

    // ========================================================================
    // 私有辅助方法
    // ========================================================================

    /// 验证注册输入
    fn validate_register_input(req: &RegisterRequest) -> Result<(), AppError> {
        if req.username.len() < 3 || req.username.len() > 50 {
            return Err(AppError::Validation(
                "Username must be between 3 and 50 characters".to_string(),
            ));
        }
        if !req.email.contains('@') {
            return Err(AppError::Validation("Invalid email format".to_string()));
        }
        let len = req.password.len();
        if !(8..=64).contains(&len) {
            return Err(AppError::Validation(
                "Password must be between 8 and 64 characters".to_string(),
            ));
        }
        let has_letter = req.password.chars().any(|c| c.is_ascii_alphabetic());
        let has_digit = req.password.chars().any(|c| c.is_ascii_digit());
        if !has_letter || !has_digit {
            return Err(AppError::Validation(
                "Password must contain at least one letter and one digit".to_string(),
            ));
        }
        Ok(())
    }
}
