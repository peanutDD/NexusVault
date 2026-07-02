//! API Token 相关 DTO

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use validator::{Validate, ValidationErrors};

use super::validation::{finish_validation, validate_length_field};

#[derive(Debug, Deserialize)]
pub struct CreateApiTokenRequest {
    pub name: String,
    pub expires_in_days: Option<u32>,
    pub webdav_enabled: Option<bool>,
    pub webdav_read_only: Option<bool>,
    pub webdav_root_folder_id: Option<Uuid>,
}

impl Validate for CreateApiTokenRequest {
    fn validate(&self) -> Result<(), ValidationErrors> {
        let mut errors = ValidationErrors::new();
        validate_length_field(&self.name, "name", 1, 255, &mut errors);
        finish_validation(errors)
    }
}

#[derive(Debug, Serialize)]
pub struct ApiTokenResponse {
    pub id: Uuid,
    pub name: String,
    pub token: String,
    pub expires_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub webdav_enabled: bool,
    pub webdav_read_only: bool,
    pub webdav_root_folder_id: Option<Uuid>,
}

#[derive(Debug, Serialize)]
pub struct ApiTokenListItem {
    pub id: Uuid,
    pub name: String,
    pub last_used_at: Option<DateTime<Utc>>,
    pub expires_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub webdav_enabled: bool,
    pub webdav_read_only: bool,
    pub webdav_root_folder_id: Option<Uuid>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn create_api_token_validation_rejects_empty_name() {
        let request = CreateApiTokenRequest {
            name: String::new(),
            expires_in_days: None,
            webdav_enabled: None,
            webdav_read_only: None,
            webdav_root_folder_id: None,
        };

        let errors = request.validate().expect_err("invalid token request");

        assert!(errors.field_errors().contains_key("name"));
    }

    #[test]
    fn create_api_token_validation_accepts_valid_name() {
        let request = CreateApiTokenRequest {
            name: "webdav".to_string(),
            expires_in_days: Some(30),
            webdav_enabled: Some(true),
            webdav_read_only: Some(false),
            webdav_root_folder_id: None,
        };

        assert!(request.validate().is_ok());
    }
}
