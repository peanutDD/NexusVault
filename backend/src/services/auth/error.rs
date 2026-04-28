use thiserror::Error;

use crate::utils::AppError;

#[derive(Debug, Error)]
pub enum AuthServiceError {
    #[error(transparent)]
    App(#[from] AppError),

    #[error("invalid credentials")]
    InvalidCredentials,

    #[error("resource not found")]
    NotFound,

    #[error("unauthorized")]
    Unauthorized,

    #[error("validation failed: {0}")]
    Validation(String),

    #[error("resource conflict: {0}")]
    Conflict(String),

    #[error("token generation failed")]
    TokenGeneration(#[source] jsonwebtoken::errors::Error),

    #[error("email delivery failed")]
    EmailDelivery,

    #[error("internal auth service error")]
    Internal,
}

impl From<AuthServiceError> for AppError {
    fn from(err: AuthServiceError) -> Self {
        match err {
            AuthServiceError::App(app_error) => app_error,
            AuthServiceError::InvalidCredentials => {
                AppError::Auth("Invalid email or password".to_string())
            }
            AuthServiceError::NotFound => AppError::NotFound,
            AuthServiceError::Unauthorized => AppError::Unauthorized,
            AuthServiceError::Validation(message) => AppError::Validation(message),
            AuthServiceError::Conflict(message) => AppError::Conflict(message),
            AuthServiceError::TokenGeneration(_) | AuthServiceError::Internal => AppError::Internal,
            AuthServiceError::EmailDelivery => {
                AppError::Validation("发送验证码失败，请稍后重试".to_string())
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::AuthServiceError;
    use crate::utils::AppError;

    #[test]
    fn invalid_credentials_maps_to_auth_error() {
        let app_error = AppError::from(AuthServiceError::InvalidCredentials);

        assert!(matches!(
            app_error,
            AppError::Auth(message) if message == "Invalid email or password"
        ));
    }

    #[test]
    fn token_generation_maps_to_internal_error() {
        let source =
            jsonwebtoken::errors::Error::from(jsonwebtoken::errors::ErrorKind::InvalidToken);
        let app_error = AppError::from(AuthServiceError::TokenGeneration(source));

        assert!(matches!(app_error, AppError::Internal));
    }

    #[test]
    fn email_delivery_maps_to_validation_error() {
        let app_error = AppError::from(AuthServiceError::EmailDelivery);

        assert!(matches!(
            app_error,
            AppError::Validation(message) if message == "发送验证码失败，请稍后重试"
        ));
    }
}
