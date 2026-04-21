use serde::Deserialize;

#[derive(Debug, Clone, Deserialize)]
pub struct HlsAbrVariant {
    pub height: u32,
    pub video_bitrate_kbps: u32,
}

#[derive(Debug, Clone, Deserialize)]
pub struct StorageConfig {
    pub backend: String,
    pub path: String,
    pub max_file_size: u64,
    pub allowed_mime_types: Vec<String>,
    pub download_mode: String,
    pub presign_ttl_secs: u64,
    pub hls_threshold_bytes: u64,
    pub hls_abr_max_variants: usize,
    pub hls_abr_variants: Vec<HlsAbrVariant>,
    
    // AWS S3 settings
    pub aws_access_key_id: Option<String>,
    pub aws_secret_access_key: Option<String>,
    pub aws_region: Option<String>,
    pub aws_bucket: Option<String>,
}
