//! # 认证服务模块
//!
//! 提供用户认证相关的业务逻辑，包括：
//!
//! - **用户注册**: 创建新用户，密码哈希存储
//! - **用户登录**: 验证凭据，生成 JWT token
//! - **Token 管理**: 生成和验证 JWT token
//! - **密码管理**: 修改密码
//!
//! ## 安全特性
//!
//! - 使用 bcrypt 进行密码哈希
//! - JWT token 有过期时间
//! - 所有认证失败返回统一错误，防止信息泄露

use chrono::Utc;
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

use crate::{
    config::Config,
    models::user::{LoginRequest, RegisterRequest, User, UserResponse},
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

pub struct AuthService {
    pool: PgPool,
    config: Config,
}

impl AuthService {
    pub fn new(pool: PgPool, config: Config) -> Self {
        Self { pool, config }
    }

    /// 从 AppState 创建 AuthService（工厂方法）
    pub fn from_state(state: &crate::AppState) -> Self {
        Self::new(state.pool.clone(), (*state.config).clone())
    }

    pub async fn register(&self, req: RegisterRequest) -> Result<UserResponse, AppError> {
        // Validate input manually
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

        // Check if user exists
        let existing =
            sqlx::query_as::<_, User>("SELECT * FROM users WHERE email = $1 OR username = $2")
                .bind(&req.email)
                .bind(&req.username)
                .fetch_optional(&self.pool)
                .await?;

        if existing.is_some() {
            return Err(AppError::Validation(
                "Email or username already exists".to_string(),
            ));
        }

        // Hash password
        let password_hash = hash_password(&req.password)?;

        // Create user
        let user = sqlx::query_as::<_, User>(
            "INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING *",
        )
        .bind(&req.username)
        .bind(&req.email)
        .bind(&password_hash)
        .fetch_one(&self.pool)
        .await?;

        Ok(UserResponse::from(user))
    }

    pub async fn login(&self, req: LoginRequest) -> Result<String, AppError> {
        // Find user
        let user = sqlx::query_as::<_, User>("SELECT * FROM users WHERE email = $1")
            .bind(&req.email)
            .fetch_optional(&self.pool)
            .await?
            .ok_or_else(|| AppError::Auth("Invalid email or password".to_string()))?;

        // Verify password
        if !verify_password(&req.password, &user.password_hash)? {
            return Err(AppError::Auth("Invalid email or password".to_string()));
        }

        // Generate token
        self.generate_token(&user.id)
    }

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

    pub fn verify_token(&self, token: &str) -> Result<Uuid, AppError> {
        let token_data = decode::<Claims>(
            token,
            &DecodingKey::from_secret(self.config.jwt_secret.as_ref()),
            &Validation::default(),
        )
        .map_err(|_| AppError::Unauthorized)?;

        let user_id =
            Uuid::parse_str(&token_data.claims.sub).map_err(|_| AppError::Unauthorized)?;

        Ok(user_id)
    }

    pub async fn get_user(&self, user_id: Uuid) -> Result<UserResponse, AppError> {
        let user = sqlx::query_as::<_, User>("SELECT * FROM users WHERE id = $1")
            .bind(user_id)
            .fetch_optional(&self.pool)
            .await?
            .ok_or(AppError::NotFound)?;

        Ok(UserResponse::from(user))
    }

    pub async fn change_password(
        &self,
        user_id: Uuid,
        current_password: String,
        new_password: String,
    ) -> Result<(), AppError> {
        // Validate new password
        if new_password.len() < 8 {
            return Err(AppError::Validation(
                "New password must be at least 8 characters".to_string(),
            ));
        }

        // Get user
        let user = sqlx::query_as::<_, User>("SELECT * FROM users WHERE id = $1")
            .bind(user_id)
            .fetch_optional(&self.pool)
            .await?
            .ok_or(AppError::NotFound)?;

        // Verify current password
        if !verify_password(&current_password, &user.password_hash)? {
            return Err(AppError::Auth("Current password is incorrect".to_string()));
        }

        // Hash new password
        let new_password_hash = hash_password(&new_password)?;

        // Update password
        sqlx::query("UPDATE users SET password_hash = $1, updated_at = $2 WHERE id = $3")
            .bind(&new_password_hash)
            .bind(Utc::now())
            .bind(user_id)
            .execute(&self.pool)
            .await?;

        Ok(())
    }
}
