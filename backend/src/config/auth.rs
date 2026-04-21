use serde::Deserialize;

#[derive(Debug, Clone, Deserialize)]
pub struct AuthConfig {
    pub jwt_secret: String,
    pub jwt_expiry: String,
    pub api_token_hmac_secret: Option<String>,
    pub api_token_hmac_secret_previous: Option<String>,
    pub admin_token: Option<String>,
}

impl AuthConfig {
    pub fn api_token_hmac_secret_effective(&self) -> &str {
        self.api_token_hmac_secret
            .as_deref()
            .unwrap_or(self.jwt_secret.as_str())
    }

    pub fn api_token_hmac_secrets(&self) -> Vec<String> {
        let primary = self.api_token_hmac_secret_effective().to_string();
        let mut secrets = vec![primary.clone()];

        if let Some(previous) = self.api_token_hmac_secret_previous.as_ref() {
            if previous != &primary {
                secrets.push(previous.clone());
            }
        }

        if self.jwt_secret != primary
            && self
                .api_token_hmac_secret_previous
                .as_ref()
                .is_none_or(|s| s != &self.jwt_secret)
        {
            secrets.push(self.jwt_secret.clone());
        }

        secrets
    }
}
