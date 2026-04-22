use crate::models::error::AppError;
use crate::models::HealthResponse;

#[derive(Clone)]
pub struct BackendRepository {
    client: reqwest::Client,
    base_url: String,
}

impl BackendRepository {
    pub fn new(client: reqwest::Client, base_url: String) -> Self {
        Self { client, base_url }
    }

    pub async fn health(&self) -> Result<HealthResponse, AppError> {
        let url = format!("{}/health", self.base_url.trim_end_matches('/'));
        let resp = self.client.get(url).send().await?;
        let status = resp.status();
        if !status.is_success() {
            let body = resp.text().await.unwrap_or_default();
            return Err(AppError::Api {
                status: status.as_u16(),
                message: body,
            });
        }
        Ok(resp.json::<serde_json::Value>().await?)
    }
}
