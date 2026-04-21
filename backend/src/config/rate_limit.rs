use serde::Deserialize;

#[derive(Debug, Clone, Deserialize)]
pub struct RateLimitConfig {
    pub ip_rate_limit: u32,
    pub user_rate_limit: u32,
    pub rate_limit_window_secs: u64,
    pub rate_limit_max_keys: u64,
}
