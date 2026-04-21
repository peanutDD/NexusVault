use serde::Deserialize;

#[derive(Debug, Clone, Deserialize)]
pub struct DatabaseConfig {
    pub url: String,
    pub read_replica_url: Option<String>,
    pub redis_url: Option<String>,
}
