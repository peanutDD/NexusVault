use std::env;
use thiserror::Error;

#[derive(Debug, Clone)]
#[allow(dead_code)]
pub struct Config {
    pub database_url: String,
    pub jwt_secret: String,
    pub jwt_expiry: String,
    pub storage_backend: String,
    pub storage_path: String,
    pub aws_access_key_id: String,
    pub aws_secret_access_key: String,
    pub aws_region: String,
    pub aws_bucket: String,
    pub max_file_size: u64,
    pub allowed_mime_types: Vec<String>,
    pub port: u16,
    pub cors_origin: String,
    /// 超过此大小的视频使用 HLS 转码预览（字节），默认 100MB
    pub hls_threshold_bytes: u64,
}

#[derive(Error, Debug)]
pub enum ConfigError {
    #[error("Missing environment variable: {0}")]
    MissingEnvVar(String),
    #[error("Invalid configuration: {0}")]
    InvalidConfig(String),
}

impl Config {
    pub fn from_env() -> Result<Self, ConfigError> {
        Ok(Config {
            database_url: env::var("DATABASE_URL")
                .map_err(|_| ConfigError::MissingEnvVar("DATABASE_URL".to_string()))?,
            jwt_secret: env::var("JWT_SECRET")
                .map_err(|_| ConfigError::MissingEnvVar("JWT_SECRET".to_string()))?,
            jwt_expiry: env::var("JWT_EXPIRY").unwrap_or_else(|_| "24h".to_string()),
            storage_backend: env::var("STORAGE_BACKEND").unwrap_or_else(|_| "local".to_string()),
            storage_path: env::var("STORAGE_PATH").unwrap_or_else(|_| "./uploads".to_string()),
            aws_access_key_id: env::var("AWS_ACCESS_KEY_ID").unwrap_or_default(),
            aws_secret_access_key: env::var("AWS_SECRET_ACCESS_KEY").unwrap_or_default(),
            aws_region: env::var("AWS_REGION").unwrap_or_else(|_| "us-east-1".to_string()),
            aws_bucket: env::var("AWS_BUCKET").unwrap_or_default(),
            max_file_size: env::var("MAX_FILE_SIZE")
                .unwrap_or_else(|_| "2147483648".to_string())
                .parse()
                .map_err(|_| {
                    ConfigError::InvalidConfig("MAX_FILE_SIZE must be a number".to_string())
                })?,
            allowed_mime_types: env::var("ALLOWED_MIME_TYPES")
                .unwrap_or_else(|_| "image/*,video/*,audio/*,application/pdf,text/*".to_string())
                .split(',')
                .map(|s| s.trim().to_string())
                .collect(),
            port: env::var("PORT")
                .unwrap_or_else(|_| "3000".to_string())
                .parse()
                .unwrap_or(3000),
            cors_origin: env::var("CORS_ORIGIN").unwrap_or_else(|_| "*".to_string()),
            hls_threshold_bytes: env::var("HLS_THRESHOLD_BYTES")
                .unwrap_or_else(|_| "104857600".to_string()) // 100MB
                .parse()
                .unwrap_or(104_857_600),
        })
    }
}
