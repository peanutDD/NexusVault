use std::collections::HashMap;
use std::env;
use std::path::PathBuf;
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
pub struct HlsAbrVariant {
    pub height: u32,
    pub video_bitrate_kbps: u32,
}

#[derive(Debug, Clone)]
#[allow(dead_code)]
pub struct Config {
    pub database_url: String,
    pub read_replica_database_url: Option<String>,
    pub redis_url: Option<String>,
    pub jwt_secret: String,
    pub api_token_hmac_secret: Option<String>,
    pub api_token_hmac_secret_previous: Option<String>,
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
    pub hls_abr_max_variants: usize,
    pub hls_abr_variants: Vec<HlsAbrVariant>,

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

    // ---------- 限流 ----------
    /// IP 级限流：每窗口内最大请求数，默认 600
    pub ip_rate_limit: u32,
    /// 已登录用户写操作限流：每窗口内最大请求数，默认 600
    pub user_rate_limit: u32,
    /// 限流窗口大小（秒），默认 60
    pub rate_limit_window_secs: u64,
    /// 限流缓存最大 key 数，默认 20_000
    pub rate_limit_max_keys: u64,
    pub trust_proxy_headers: bool,

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

    // ---------- 语义搜索（Hugging Face） ----------
    /// Hugging Face API Token（可选，未配置则禁用语义搜索）
    pub huggingface_api_token: Option<String>,
    /// Hugging Face 嵌入模型 ID（默认：sentence-transformers/all-MiniLM-L6-v2）
    pub huggingface_model_id: String,
    /// Hugging Face Inference API 基础 URL（默认：https://api-inference.huggingface.co）
    pub huggingface_api_url: String,

    /// 管理接口专用 Token（可选；未配置则禁用 /api/admin/*）
    pub admin_token: Option<String>,

    pub download_mode: String,
    pub presign_ttl_secs: u64,

    pub task_queue_backend: String,

    pub zip_cache_enabled: bool,
    pub zip_cache_backend: String,
    pub zip_cache_ttl_secs: u64,
    pub zip_build_max_concurrent: usize,

    pub cache_enabled: bool,
    pub cache_default_ttl_secs: u64,
    pub list_cache_ttl_secs: u64,

    pub transcode_max_concurrent: usize,
    pub task_type_concurrency: HashMap<String, usize>,
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
        let hls_abr_variants = parse_hls_abr_variants()?;
        let default_storage_path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .parent()
            .unwrap_or_else(|| std::path::Path::new(env!("CARGO_MANIFEST_DIR")))
            .join("uploads")
            .to_string_lossy()
            .to_string();

        let config = Config {
            database_url: env::var("DATABASE_URL")
                .map_err(|_| ConfigError::MissingEnvVar("DATABASE_URL".to_string()))?,
            read_replica_database_url: env::var("READ_REPLICA_DATABASE_URL")
                .ok()
                .filter(|s| !s.is_empty()),
            redis_url: env::var("REDIS_URL").ok().filter(|s| !s.is_empty()),
            jwt_secret: env::var("JWT_SECRET")
                .map_err(|_| ConfigError::MissingEnvVar("JWT_SECRET".to_string()))?,
            api_token_hmac_secret: env::var("API_TOKEN_HMAC_SECRET")
                .ok()
                .filter(|s| !s.trim().is_empty()),
            api_token_hmac_secret_previous: env::var("API_TOKEN_HMAC_SECRET_PREVIOUS")
                .ok()
                .filter(|s| !s.trim().is_empty()),
            jwt_expiry: env::var("JWT_EXPIRY").unwrap_or_else(|_| "24h".to_string()),
            storage_backend: env::var("STORAGE_BACKEND").unwrap_or_else(|_| "local".to_string()),
            storage_path: env::var("STORAGE_PATH").unwrap_or(default_storage_path),
            aws_access_key_id: env::var("AWS_ACCESS_KEY_ID").unwrap_or_default(),
            aws_secret_access_key: env::var("AWS_SECRET_ACCESS_KEY").unwrap_or_default(),
            aws_region: env::var("AWS_REGION").unwrap_or_else(|_| "us-east-1".to_string()),
            aws_bucket: env::var("AWS_BUCKET").unwrap_or_default(),
            max_file_size: env::var("MAX_FILE_SIZE")
                .unwrap_or_else(|_| "2147483648".to_string())
                .parse()
                .map_err(|_| {
                    ConfigError::InvalidConfig(
                        "MAX_FILE_SIZE must be a positive number".to_string(),
                    )
                })?,
            // 与前端 uploadValidation 默认值保持一致：允许常见图片/视频/音频/PDF/文本、
            // Office 文档、OpenDocument、电子书和常见压缩包格式，避免「看得见却传不上」的情况。
            allowed_mime_types: env::var("ALLOWED_MIME_TYPES")
                .unwrap_or_else(|_| {
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
            hls_abr_max_variants: env_usize("HLS_ABR_MAX_VARIANTS", 1)?,
            hls_abr_variants,

            upload_session_cleanup_interval_secs: env_u64(
                "UPLOAD_SESSION_CLEANUP_INTERVAL_SECS",
                300,
            )?,
            upload_session_cleanup_batch_size: env_i64("UPLOAD_SESSION_CLEANUP_BATCH_SIZE", 200)?,
            files_consistency_check_interval_secs: env_u64(
                "FILES_CONSISTENCY_CHECK_INTERVAL_SECS",
                600,
            )?,
            files_consistency_check_batch_size: env_i64("FILES_CONSISTENCY_CHECK_BATCH_SIZE", 500)?,
            orphan_cleanup_interval_secs: env_u64("ORPHAN_CLEANUP_INTERVAL_SECS", 600)?,
            orphan_cleanup_batch_limit: env_u32("ORPHAN_CLEANUP_BATCH_LIMIT", 500)?,

            ip_rate_limit: env_u32("IP_RATE_LIMIT", 600)?,
            user_rate_limit: env_u32("USER_RATE_LIMIT", 600)?,
            rate_limit_window_secs: env_u64("RATE_LIMIT_WINDOW_SECS", 60)?,
            rate_limit_max_keys: env_u64("RATE_LIMIT_MAX_KEYS", 20_000)?,
            trust_proxy_headers: env_bool("TRUST_PROXY_HEADERS", false)?,

            smtp_host: env::var("SMTP_HOST").ok().filter(|s| !s.is_empty()),
            smtp_port: env::var("SMTP_PORT").ok().and_then(|s| s.parse().ok()),
            smtp_username: env::var("SMTP_USERNAME").ok().filter(|s| !s.is_empty()),
            smtp_password: env::var("SMTP_PASSWORD").ok().filter(|s| !s.is_empty()),
            smtp_from: env::var("SMTP_FROM").ok().filter(|s| !s.is_empty()),

            github_client_id: env::var("GITHUB_CLIENT_ID").ok().filter(|s| !s.is_empty()),
            github_client_secret: env::var("GITHUB_CLIENT_SECRET")
                .ok()
                .filter(|s| !s.is_empty()),
            github_oauth_redirect_uri: env::var("GITHUB_OAUTH_REDIRECT_URI")
                .ok()
                .filter(|s| !s.is_empty()),
            google_client_id: env::var("GOOGLE_CLIENT_ID").ok().filter(|s| !s.is_empty()),
            google_client_secret: env::var("GOOGLE_CLIENT_SECRET")
                .ok()
                .filter(|s| !s.is_empty()),
            google_oauth_redirect_uri: env::var("GOOGLE_OAUTH_REDIRECT_URI")
                .ok()
                .filter(|s| !s.is_empty()),
            frontend_base_url: env::var("FRONTEND_BASE_URL").ok().filter(|s| !s.is_empty()),

            huggingface_api_token: env::var("HUGGINGFACE_API_TOKEN")
                .ok()
                .filter(|s| !s.is_empty()),
            huggingface_model_id: env::var("HUGGINGFACE_MODEL_ID")
                .unwrap_or_else(|_| "sentence-transformers/all-MiniLM-L6-v2".to_string()),
            huggingface_api_url: env::var("HUGGINGFACE_API_URL")
                .unwrap_or_else(|_| "https://api-inference.huggingface.co".to_string()),

            admin_token: env::var("ADMIN_TOKEN").ok().filter(|s| !s.is_empty()),

            download_mode: env::var("DOWNLOAD_MODE").unwrap_or_else(|_| "proxy".to_string()),
            presign_ttl_secs: env_u64("PRESIGN_TTL_SECS", 300)?,

            task_queue_backend: env::var("TASK_QUEUE_BACKEND")
                .unwrap_or_else(|_| "postgres".to_string()),

            zip_cache_enabled: env_bool("ZIP_CACHE_ENABLED", false)?,
            zip_cache_backend: env::var("ZIP_CACHE_BACKEND")
                .unwrap_or_else(|_| "local".to_string()),
            zip_cache_ttl_secs: env_u64("ZIP_CACHE_TTL_SECS", 3600)?,
            zip_build_max_concurrent: env_usize("ZIP_BUILD_MAX_CONCURRENT", 2)?,

            cache_enabled: env_bool("CACHE_ENABLED", true)?,
            cache_default_ttl_secs: env_u64("CACHE_DEFAULT_TTL_SECS", 60)?,
            list_cache_ttl_secs: env_u64("LIST_CACHE_TTL_SECS", 20)?,

            transcode_max_concurrent: env_usize("TRANSCODE_MAX_CONCURRENT", 2)?,
            task_type_concurrency: env_usize_map("TASK_TYPE_CONCURRENCY_")?,
        };

        config.validate()?;
        Ok(config)
    }

    pub fn api_token_hmac_secret_effective(&self) -> &str {
        self.api_token_hmac_secret
            .as_deref()
            .unwrap_or(self.jwt_secret.as_str())
    }

    pub fn api_token_hmac_secrets(&self) -> Vec<String> {
        let primary = self.api_token_hmac_secret_effective().to_string();
        let mut secrets = vec![primary.clone()];

        if let Some(previous) = self.api_token_hmac_secret_previous.as_ref() {
            if previous != &primary {
                secrets.push(previous.clone());
            }
        }

        if self.jwt_secret != primary
            && self
                .api_token_hmac_secret_previous
                .as_ref()
                .is_none_or(|s| s != &self.jwt_secret)
        {
            secrets.push(self.jwt_secret.clone());
        }

        secrets
    }

    /// 启动时完整校验，非法则返回 ConfigError 并退出
    fn validate(&self) -> Result<(), ConfigError> {
        if !(PORT_MIN..=PORT_MAX).contains(&self.port) {
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
        if let Some(secret) = &self.api_token_hmac_secret {
            if secret.trim().is_empty() {
                return Err(ConfigError::InvalidConfig(
                    "API_TOKEN_HMAC_SECRET must be non-empty when provided".to_string(),
                ));
            }
        }
        if let Some(secret) = &self.api_token_hmac_secret_previous {
            if secret.trim().is_empty() {
                return Err(ConfigError::InvalidConfig(
                    "API_TOKEN_HMAC_SECRET_PREVIOUS must be non-empty when provided".to_string(),
                ));
            }
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
        if self.ip_rate_limit == 0 || self.user_rate_limit == 0 || self.rate_limit_window_secs == 0
        {
            return Err(ConfigError::InvalidConfig(
                "IP_RATE_LIMIT, USER_RATE_LIMIT, RATE_LIMIT_WINDOW_SECS must be greater than 0"
                    .to_string(),
            ));
        }
        if self.zip_cache_enabled && self.zip_cache_ttl_secs == 0 {
            return Err(ConfigError::InvalidConfig(
                "ZIP_CACHE_TTL_SECS must be greater than 0 when ZIP_CACHE_ENABLED=1".to_string(),
            ));
        }
        if self.zip_build_max_concurrent == 0 {
            return Err(ConfigError::InvalidConfig(
                "ZIP_BUILD_MAX_CONCURRENT must be greater than 0".to_string(),
            ));
        }
        if self.cache_enabled && (self.cache_default_ttl_secs == 0 || self.list_cache_ttl_secs == 0)
        {
            return Err(ConfigError::InvalidConfig(
                "CACHE_DEFAULT_TTL_SECS and LIST_CACHE_TTL_SECS must be greater than 0 when CACHE_ENABLED=1"
                    .to_string(),
            ));
        }
        if self.transcode_max_concurrent == 0 {
            return Err(ConfigError::InvalidConfig(
                "TRANSCODE_MAX_CONCURRENT must be greater than 0".to_string(),
            ));
        }
        if self.hls_abr_max_variants == 0 {
            return Err(ConfigError::InvalidConfig(
                "HLS_ABR_MAX_VARIANTS must be greater than 0".to_string(),
            ));
        }
        if self.hls_abr_max_variants > self.hls_abr_variants.len() {
            return Err(ConfigError::InvalidConfig(
                "HLS_ABR_MAX_VARIANTS exceeds HLS_ABR_VARIANTS count".to_string(),
            ));
        }
        match self.download_mode.as_str() {
            "proxy" => {}
            "redirect" | "presigned" => {
                if self.storage_backend != "s3" {
                    return Err(ConfigError::InvalidConfig(
                        "DOWNLOAD_MODE=redirect/presigned requires STORAGE_BACKEND=s3".to_string(),
                    ));
                }
                if self.presign_ttl_secs == 0 {
                    return Err(ConfigError::InvalidConfig(
                        "PRESIGN_TTL_SECS must be greater than 0".to_string(),
                    ));
                }
            }
            _ => {
                return Err(ConfigError::InvalidConfig(
                    "DOWNLOAD_MODE must be one of: proxy, redirect, presigned".to_string(),
                ))
            }
        }
        if self.task_queue_backend != "postgres" {
            return Err(ConfigError::InvalidConfig(
                "TASK_QUEUE_BACKEND currently only supports postgres".to_string(),
            ));
        }
        Ok(())
    }
}

fn parse_port() -> Result<u16, ConfigError> {
    let raw = env::var("PORT").unwrap_or_else(|_| "3000".to_string());
    let port: u16 = raw.parse().map_err(|_| {
        ConfigError::InvalidConfig(format!(
            "PORT must be a number in range {}..={}",
            PORT_MIN, PORT_MAX
        ))
    })?;
    if !(PORT_MIN..=PORT_MAX).contains(&port) {
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

fn parse_hls_abr_variants() -> Result<Vec<HlsAbrVariant>, ConfigError> {
    let raw = env::var("HLS_ABR_VARIANTS")
        .unwrap_or_else(|_| "240:350,360:700,480:1200,720:2500".to_string());
    let mut out: Vec<HlsAbrVariant> = Vec::new();
    for part in raw.split(',') {
        let t = part.trim();
        if t.is_empty() {
            continue;
        }
        let Some((h, br)) = t.split_once(':') else {
            return Err(ConfigError::InvalidConfig(
                "HLS_ABR_VARIANTS must be like: 240:350,360:700".to_string(),
            ));
        };
        let height: u32 = h.trim().parse().map_err(|_| {
            ConfigError::InvalidConfig("HLS_ABR_VARIANTS height must be integer".to_string())
        })?;
        let video_bitrate_kbps: u32 = br.trim().parse().map_err(|_| {
            ConfigError::InvalidConfig("HLS_ABR_VARIANTS bitrate must be integer".to_string())
        })?;
        if !(144..=2160).contains(&height) || video_bitrate_kbps == 0 {
            return Err(ConfigError::InvalidConfig(
                "HLS_ABR_VARIANTS contains invalid height/bitrate".to_string(),
            ));
        }
        if out.iter().any(|v| v.height == height) {
            continue;
        }
        out.push(HlsAbrVariant {
            height,
            video_bitrate_kbps,
        });
    }
    if out.is_empty() {
        return Err(ConfigError::InvalidConfig(
            "HLS_ABR_VARIANTS must not be empty".to_string(),
        ));
    }
    out.sort_by_key(|v| v.height);
    Ok(out)
}

fn env_u64(key: &str, default: u64) -> Result<u64, ConfigError> {
    match env::var(key) {
        Ok(s) => s.parse().map_err(|_| {
            ConfigError::InvalidConfig(format!("{} must be a non-negative integer", key))
        }),
        Err(_) => Ok(default),
    }
}

fn env_usize(key: &str, default: usize) -> Result<usize, ConfigError> {
    match env::var(key) {
        Ok(v) => v
            .parse::<usize>()
            .map_err(|_| ConfigError::InvalidConfig(format!("{} must be a valid integer", key))),
        Err(_) => Ok(default),
    }
}

fn env_usize_map(prefix: &str) -> Result<HashMap<String, usize>, ConfigError> {
    let mut map = HashMap::new();
    for (k, v) in env::vars() {
        if !k.starts_with(prefix) {
            continue;
        }
        let key = k[prefix.len()..].to_string();
        if key.is_empty() {
            continue;
        }
        let n = v
            .parse::<usize>()
            .map_err(|_| ConfigError::InvalidConfig(format!("{} must be a valid integer", k)))?;
        if n == 0 {
            return Err(ConfigError::InvalidConfig(format!(
                "{} must be greater than 0",
                k
            )));
        }
        map.insert(key.to_ascii_lowercase(), n);
    }
    Ok(map)
}

fn env_bool(key: &str, default: bool) -> Result<bool, ConfigError> {
    match env::var(key) {
        Ok(s) => match s.trim().to_ascii_lowercase().as_str() {
            "1" | "true" | "yes" | "on" => Ok(true),
            "0" | "false" | "no" | "off" => Ok(false),
            _ => Err(ConfigError::InvalidConfig(format!(
                "{} must be a boolean (1/0/true/false)",
                key
            ))),
        },
        Err(_) => Ok(default),
    }
}

fn env_i64(key: &str, default: i64) -> Result<i64, ConfigError> {
    match env::var(key) {
        Ok(s) => s
            .parse()
            .map_err(|_| ConfigError::InvalidConfig(format!("{} must be an integer", key))),
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
