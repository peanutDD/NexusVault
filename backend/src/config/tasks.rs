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
    pub task_type_concurrency: HashMap<String, usize>,
    
    // ZIP tasks
    pub zip_cache_enabled: bool,
    pub zip_cache_backend: String,
    pub zip_cache_ttl_secs: u64,
    pub zip_build_max_concurrent: usize,
}
