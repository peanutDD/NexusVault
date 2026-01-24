use crate::{
    config::Config,
    models::user::{LoginRequest, RegisterRequest, User, UserResponse},
    utils::AppError,
};
use bcrypt::{hash, verify, DEFAULT_COST};
use chrono::Utc;
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String, // user id
    pub exp: usize,
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
        let password_hash = hash(&req.password, DEFAULT_COST).map_err(|_| AppError::Internal)?;

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
        if !verify(&req.password, &user.password_hash)
            .map_err(|_| AppError::Auth("Invalid email or password".to_string()))?
        {
            return Err(AppError::Auth("Invalid email or password".to_string()));
        }

        // Generate token
        self.generate_token(&user.id)
    }

    pub fn generate_token(&self, user_id: &Uuid) -> Result<String, AppError> {
        let now = Utc::now().timestamp() as usize;
        let exp = match self.config.jwt_expiry.as_str() {
            s if s.ends_with('h') => {
                let hours: usize = s.trim_end_matches('h').parse().unwrap_or(24);
                now + hours * 3600
            }
            s if s.ends_with('d') => {
                let days: usize = s.trim_end_matches('d').parse().unwrap_or(1);
                now + days * 86400
            }
            _ => now + 86400, // Default 24 hours
        };

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
        if !verify(&current_password, &user.password_hash)
            .map_err(|_| AppError::Auth("Current password is incorrect".to_string()))?
        {
            return Err(AppError::Auth("Current password is incorrect".to_string()));
        }

        // Hash new password
        let new_password_hash =
            hash(&new_password, DEFAULT_COST).map_err(|_| AppError::Internal)?;

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
