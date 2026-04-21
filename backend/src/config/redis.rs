use serde::Deserialize;

#[derive(Debug, Clone, Deserialize)]
pub struct RedisConfig {
    pub url: String,
}
