use std::env;
use thiserror::Error;

/// 端口有效范围（含）
const PORT_MIN: u16 = 1;
const PORT_MAX: u16 = 65535;

/// 应用配置总结构。
///
/// 部分字段（如 S3 相关配置、某些清理任务间隔、第三方登录）在
/// 当前部署中可能尚未启用，但为了便于按需打开功能，这里保留了
/// 完整字段集合，因此整体标记为 `allow(dead_code)`。
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

    // ---------- 后台维护任务（可经环境变量调参） ----------
    /// 过期分块上传会话清理间隔（秒），默认 300
    pub upload_session_cleanup_interval_secs: u64,
    /// 过期会话单批数量，默认 200
    pub upload_session_cleanup_batch_size: i64,
    /// 文件一致性检查间隔（秒），默认 600
    pub files_consistency_check_interval_secs: u64,
    /// 一致性检查单批数量，默认 500
    pub files_consistency_check_batch_size: i64,
    /// 孤儿文件清理间隔（秒），默认 600
    pub orphan_cleanup_interval_secs: u64,
    /// 孤儿清理单轮最大删除文件数，默认 500
    pub orphan_cleanup_batch_limit: u32,

    /// 邮箱验证码发送：SMTP 服务器（可选，不配置则仅将验证码写入日志，适用于开发）
    pub smtp_host: Option<String>,
    pub smtp_port: Option<u16>,
    pub smtp_username: Option<String>,
    pub smtp_password: Option<String>,
    /// 发件人地址
    pub smtp_from: Option<String>,

    // ---------- 第三方登录（OAuth） ----------
    /// GitHub OAuth 应用的 Client ID（可选，未配置则禁用 GitHub 登录）
    pub github_client_id: Option<String>,
    /// GitHub OAuth 应用的 Client Secret
    pub github_client_secret: Option<String>,
    /// GitHub 回调地址（需与 GitHub 应用配置一致），例如：https://your-backend.com/api/auth/oauth/github/callback
    pub github_oauth_redirect_uri: Option<String>,

    /// Google OAuth 应用的 Client ID（可选，未配置则禁用 Google 登录）
    pub google_client_id: Option<String>,
    /// Google OAuth 应用的 Client Secret
    pub google_client_secret: Option<String>,
    /// Google 回调地址（需与 Google 控制台配置一致），例如：https://your-backend.com/api/auth/oauth/google/callback
    pub google_oauth_redirect_uri: Option<String>,
    
    /// 前端基础地址，用于 OAuth 登录成功后重定向前端（如 https://app.example.com）
    pub frontend_base_url: Option<String>,
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
        let port = parse_port()?;
        let hls_threshold_bytes = parse_hls_threshold_bytes()?;

        let config = Config {
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
                    ConfigError::InvalidConfig("MAX_FILE_SIZE must be a positive number".to_string())
                })?,
            // 与前端 uploadValidation 默认值保持一致：允许常见图片/视频/音频/PDF/文本、
            // Office 文档、OpenDocument、电子书和常见压缩包格式，避免「看得见却传不上」的情况。
            allowed_mime_types: env::var("ALLOWED_MIME_TYPES").unwrap_or_else(|_| {
                "image/*,\
                 video/*,\
                 audio/*,\
                 application/pdf,\
                 text/*,\
                 application/msword,\
                 application/vnd.openxmlformats-officedocument.wordprocessingml.document,\
                 application/vnd.ms-excel,\
                 application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,\
                 application/vnd.ms-powerpoint,\
                 application/vnd.openxmlformats-officedocument.presentationml.presentation,\
                 application/vnd.oasis.opendocument.text,\
                 application/vnd.oasis.opendocument.spreadsheet,\
                 application/vnd.oasis.opendocument.presentation,\
                 application/epub+zip,\
                 application/x-mobipocket-ebook,\
                 application/zip,\
                 application/x-7z-compressed,\
                 application/x-rar-compressed,\
                 application/x-tar,\
                 application/gzip,\
                 application/x-bzip2"
                    .to_string()
            })
                .split(',')
                .map(|s| s.trim().to_string())
                .collect(),
            port,
            cors_origin: env::var("CORS_ORIGIN").unwrap_or_else(|_| "*".to_string()),
            hls_threshold_bytes,

            upload_session_cleanup_interval_secs: env_u64(
                "UPLOAD_SESSION_CLEANUP_INTERVAL_SECS",
                300,
            )?,
            upload_session_cleanup_batch_size: env_i64(
                "UPLOAD_SESSION_CLEANUP_BATCH_SIZE",
                200,
            )?,
            files_consistency_check_interval_secs: env_u64(
                "FILES_CONSISTENCY_CHECK_INTERVAL_SECS",
                600,
            )?,
            files_consistency_check_batch_size: env_i64(
                "FILES_CONSISTENCY_CHECK_BATCH_SIZE",
                500,
            )?,
            orphan_cleanup_interval_secs: env_u64("ORPHAN_CLEANUP_INTERVAL_SECS", 600)?,
            orphan_cleanup_batch_limit: env_u32("ORPHAN_CLEANUP_BATCH_LIMIT", 500)?,

            smtp_host: env::var("SMTP_HOST").ok().filter(|s| !s.is_empty()),
            smtp_port: env::var("SMTP_PORT")
                .ok()
                .and_then(|s| s.parse().ok()),
            smtp_username: env::var("SMTP_USERNAME").ok().filter(|s| !s.is_empty()),
            smtp_password: env::var("SMTP_PASSWORD").ok().filter(|s| !s.is_empty()),
            smtp_from: env::var("SMTP_FROM").ok().filter(|s| !s.is_empty()),

            github_client_id: env::var("GITHUB_CLIENT_ID").ok().filter(|s| !s.is_empty()),
            github_client_secret: env::var("GITHUB_CLIENT_SECRET").ok().filter(|s| !s.is_empty()),
            github_oauth_redirect_uri: env::var("GITHUB_OAUTH_REDIRECT_URI")
                .ok()
                .filter(|s| !s.is_empty()),
            google_client_id: env::var("GOOGLE_CLIENT_ID").ok().filter(|s| !s.is_empty()),
            google_client_secret: env::var("GOOGLE_CLIENT_SECRET").ok().filter(|s| !s.is_empty()),
            google_oauth_redirect_uri: env::var("GOOGLE_OAUTH_REDIRECT_URI")
                .ok()
                .filter(|s| !s.is_empty()),
            frontend_base_url: env::var("FRONTEND_BASE_URL").ok().filter(|s| !s.is_empty()),
        };

        config.validate()?;
        Ok(config)
    }

    /// 启动时完整校验，非法则返回 ConfigError 并退出
    fn validate(&self) -> Result<(), ConfigError> {
        if self.port < PORT_MIN || self.port > PORT_MAX {
            return Err(ConfigError::InvalidConfig(format!(
                "PORT must be in range {}..={}",
                PORT_MIN, PORT_MAX
            )));
        }
        if self.max_file_size == 0 {
            return Err(ConfigError::InvalidConfig(
                "MAX_FILE_SIZE must be greater than 0".to_string(),
            ));
        }
        if self.jwt_secret.trim().is_empty() {
            return Err(ConfigError::InvalidConfig(
                "JWT_SECRET must be non-empty".to_string(),
            ));
        }
        if self.storage_backend == "local" && self.storage_path.trim().is_empty() {
            return Err(ConfigError::InvalidConfig(
                "STORAGE_PATH must be non-empty when STORAGE_BACKEND=local".to_string(),
            ));
        }
        if self.upload_session_cleanup_interval_secs == 0
            || self.files_consistency_check_interval_secs == 0
            || self.orphan_cleanup_interval_secs == 0
        {
            return Err(ConfigError::InvalidConfig(
                "Maintenance task interval env vars must be greater than 0".to_string(),
            ));
        }
        Ok(())
    }
}

fn parse_port() -> Result<u16, ConfigError> {
    let raw = env::var("PORT").unwrap_or_else(|_| "3000".to_string());
    let port: u16 = raw.parse().map_err(|_| {
        ConfigError::InvalidConfig(format!("PORT must be a number in range {}..={}", PORT_MIN, PORT_MAX))
    })?;
    if port < PORT_MIN || port > PORT_MAX {
        return Err(ConfigError::InvalidConfig(format!(
            "PORT must be in range {}..={}",
            PORT_MIN, PORT_MAX
        )));
    }
    Ok(port)
}

fn parse_hls_threshold_bytes() -> Result<u64, ConfigError> {
    let raw = env::var("HLS_THRESHOLD_BYTES").unwrap_or_else(|_| "104857600".to_string());
    raw.parse().map_err(|_| {
        ConfigError::InvalidConfig("HLS_THRESHOLD_BYTES must be a non-negative number".to_string())
    })
}

fn env_u64(key: &str, default: u64) -> Result<u64, ConfigError> {
    match env::var(key) {
        Ok(s) => s.parse().map_err(|_| {
            ConfigError::InvalidConfig(format!("{} must be a non-negative integer", key))
        }),
        Err(_) => Ok(default),
    }
}

fn env_i64(key: &str, default: i64) -> Result<i64, ConfigError> {
    match env::var(key) {
        Ok(s) => s.parse().map_err(|_| {
            ConfigError::InvalidConfig(format!("{} must be an integer", key))
        }),
        Err(_) => Ok(default),
    }
}

fn env_u32(key: &str, default: u32) -> Result<u32, ConfigError> {
    match env::var(key) {
        Ok(s) => s.parse().map_err(|_| {
            ConfigError::InvalidConfig(format!("{} must be a non-negative integer", key))
        }),
        Err(_) => Ok(default),
    }
}
