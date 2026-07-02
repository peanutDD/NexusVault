//! 用户相关 DTO

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use validator::{Validate, ValidationErrors};

use super::validation::{finish_validation, validate_email_field, validate_length_field};

#[derive(Debug, Deserialize)]
pub struct RegisterRequest {
    pub username: String,
    pub email: String,
    pub password: String,
}

impl Validate for RegisterRequest {
    fn validate(&self) -> Result<(), ValidationErrors> {
        let mut errors = ValidationErrors::new();
        validate_length_field(&self.username, "username", 3, 50, &mut errors);
        validate_email_field(&self.email, "email", &mut errors);
        validate_length_field(&self.password, "password", 8, 64, &mut errors);
        finish_validation(errors)
    }
}

#[derive(Debug, Deserialize)]
pub struct LoginRequest {
    pub email: String,
    pub password: String,
}

#[derive(Debug, Deserialize)]
pub struct ChangePasswordRequest {
    pub current_password: String,
    pub new_password: String,
}

#[derive(Debug, Deserialize)]
pub struct UpdateProfileRequest {
    pub username: String,
    pub email: String,
    pub email_verification_code: Option<String>,
}

impl Validate for UpdateProfileRequest {
    fn validate(&self) -> Result<(), ValidationErrors> {
        let mut errors = ValidationErrors::new();
        validate_length_field(&self.username, "username", 3, 50, &mut errors);
        validate_email_field(&self.email, "email", &mut errors);
        finish_validation(errors)
    }
}

#[derive(Debug, Deserialize)]
pub struct SendEmailVerificationRequest {
    pub email: String,
}

impl Validate for SendEmailVerificationRequest {
    fn validate(&self) -> Result<(), ValidationErrors> {
        let mut errors = ValidationErrors::new();
        validate_email_field(&self.email, "email", &mut errors);
        finish_validation(errors)
    }
}

#[derive(Debug, Serialize)]
pub struct AuthResponse {
    pub token: String,
    pub user: UserResponse,
}

#[derive(Debug, Serialize)]
pub struct UserResponse {
    pub id: Uuid,
    pub username: String,
    pub email: String,
    pub created_at: DateTime<Utc>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn register_request_validation_reports_invalid_fields() {
        let request = RegisterRequest {
            username: "ab".to_string(),
            email: "invalid-email".to_string(),
            password: "short".to_string(),
        };

        let errors = request.validate().expect_err("invalid register request");
        let fields = errors.field_errors();

        assert!(fields.contains_key("username"));
        assert!(fields.contains_key("email"));
        assert!(fields.contains_key("password"));
    }

    #[test]
    fn update_profile_validation_reports_invalid_fields() {
        let request = UpdateProfileRequest {
            username: "ab".to_string(),
            email: "invalid-email".to_string(),
            email_verification_code: None,
        };

        let errors = request.validate().expect_err("invalid profile request");
        let fields = errors.field_errors();

        assert!(fields.contains_key("username"));
        assert!(fields.contains_key("email"));
    }

    #[test]
    fn email_verification_validation_rejects_invalid_email() {
        let request = SendEmailVerificationRequest {
            email: "invalid-email".to_string(),
        };

        let errors = request.validate().expect_err("invalid email request");

        assert!(errors.field_errors().contains_key("email"));
    }

    #[test]
    fn user_requests_accept_valid_input() {
        assert!(RegisterRequest {
            username: "valid_user".to_string(),
            email: "valid@example.com".to_string(),
            password: "Password123!".to_string(),
        }
        .validate()
        .is_ok());

        assert!(UpdateProfileRequest {
            username: "valid_user".to_string(),
            email: "valid@example.com".to_string(),
            email_verification_code: None,
        }
        .validate()
        .is_ok());
    }
}
