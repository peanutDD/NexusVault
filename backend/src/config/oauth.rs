use serde::Deserialize;

#[derive(Debug, Clone, Deserialize)]
pub struct OAuthConfig {
    pub github_client_id: Option<String>,
    pub github_client_secret: Option<String>,
    pub github_oauth_redirect_uri: Option<String>,
    pub google_client_id: Option<String>,
    pub google_client_secret: Option<String>,
    pub google_oauth_redirect_uri: Option<String>,
}
