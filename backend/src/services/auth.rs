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
    models::user::{LoginRequest, RegisterRequest, UpdateProfileRequest, UserResponse},
    repositories::{DynUsersRepo, SqlxUsersRepo},
    utils::{hash_password, now_timestamp, parse_jwt_expiry, verify_password, AppError},
};

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
}

impl AuthService {
    /// 创建新的 AuthService 实例
    ///
    /// # 参数
    /// - `users_repo`: 用户仓库（Trait Object）
    /// - `config`: 应用配置
    pub fn new(users_repo: DynUsersRepo, config: Config) -> Self {
        Self { users_repo, config }
    }

    /// 从 AppState 创建 AuthService（工厂方法）
    ///
    /// 使用 SQLx 实现的 UsersRepo。
    pub fn from_state(state: &crate::AppState) -> Self {
        let users_repo: DynUsersRepo =
            std::sync::Arc::new(SqlxUsersRepo::new(state.pool.clone()));
        Self::new(users_repo, (*state.config).clone())
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
        // 验证新密码
        if new_password.len() < 8 {
            return Err(AppError::Validation(
                "New password must be at least 8 characters".to_string(),
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
            return Err(AppError::Auth("Current password is incorrect".to_string()));
        }

        // 哈希新密码
        let new_password_hash = hash_password(&new_password)?;

        // 更新密码
        self.users_repo
            .update_password(user_id, &new_password_hash, Utc::now())
            .await?;

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
            tracing::info!("update_profile 用户名检查: username={} 未被占用", req.username);
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
        if req.password.len() < 8 {
            return Err(AppError::Validation(
                "Password must be at least 8 characters".to_string(),
            ));
        }
        Ok(())
    }
}
