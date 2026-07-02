use serde::Deserialize;

#[derive(Debug, Clone, Deserialize)]
pub struct CacheConfig {
    pub enabled: bool,
    pub default_ttl_secs: u64,
    pub list_ttl_secs: u64,
}
