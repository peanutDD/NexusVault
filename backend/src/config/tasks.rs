use serde::Deserialize;
use std::collections::HashMap;

#[derive(Debug, Clone, Deserialize)]
pub struct TasksConfig {
    pub queue_backend: String,
    pub upload_session_cleanup_interval_secs: u64,
    pub upload_session_cleanup_batch_size: i64,
    pub files_consistency_check_interval_secs: u64,
    pub files_consistency_check_batch_size: i64,
    pub orphan_cleanup_interval_secs: u64,
    pub orphan_cleanup_batch_limit: u32,
    pub transcode_max_concurrent: usize,
    #[serde(default)]
    pub task_type_concurrency: HashMap<String, usize>,

    // ZIP tasks
    pub zip_cache_enabled: bool,
    pub zip_cache_backend: String,
    pub zip_cache_ttl_secs: u64,
    pub zip_build_max_concurrent: usize,
}

#[cfg(test)]
mod tests {
    use super::TasksConfig;

    #[test]
    fn task_type_concurrency_defaults_to_empty_when_missing() {
        let v = serde_json::json!({
            "queue_backend": "postgres",
            "upload_session_cleanup_interval_secs": 300u64,
            "upload_session_cleanup_batch_size": 200i64,
            "files_consistency_check_interval_secs": 600u64,
            "files_consistency_check_batch_size": 500i64,
            "orphan_cleanup_interval_secs": 600u64,
            "orphan_cleanup_batch_limit": 500u32,
            "transcode_max_concurrent": 2u64,
            "zip_cache_enabled": false,
            "zip_cache_backend": "local",
            "zip_cache_ttl_secs": 3600u64,
            "zip_build_max_concurrent": 2u64
        });

        let parsed: TasksConfig = serde_json::from_value(v).unwrap();
        assert!(parsed.task_type_concurrency.is_empty());
    }
}
