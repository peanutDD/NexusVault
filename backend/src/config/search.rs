use serde::Deserialize;

#[derive(Debug, Clone, Deserialize)]
pub struct SearchConfig {
    pub huggingface_api_token: Option<String>,
    pub huggingface_model_id: String,
    pub huggingface_api_url: String,
}
