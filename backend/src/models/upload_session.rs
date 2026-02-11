use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct UploadSession {
    pub id: Uuid,
    pub user_id: Uuid,
    pub filename: String,
    pub mime_type: String,
    pub total_size: i64,
    pub chunk_size: i32,
    pub temp_path: String,
    #[serde(skip_serializing)]
    pub uploaded_parts: Vec<i32>,
    pub created_at: DateTime<Utc>,
    pub expires_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct InitChunkedUploadRequest {
    pub filename: String,
    pub mime_type: String,
    pub total_size: u64,
}

/// 初始化分片上传的响应模型。
///
/// 目前 Handler 直接用 `json!({...})` 手写返回体，因此该结构体未被
/// 序列化路径引用；预留给未来统一使用「强类型 DTO + 自动序列化」
/// 风格时启用。
#[derive(Debug, Serialize)]
#[allow(dead_code)] // constructed via manual json in handler
pub struct InitChunkedUploadResponse {
    pub upload_id: Uuid,
    pub chunk_size: u32,
    pub total_parts: u32,
}

/// 查询分片上传状态的响应模型。
///
/// 同上，当前为手写 JSON 返回；若改为统一 DTO，则可直接使用。
#[derive(Debug, Serialize)]
#[allow(dead_code)] // constructed via manual json in handler
pub struct ChunkedUploadStatusResponse {
    pub upload_id: Uuid,
    pub uploaded_parts: Vec<i32>,
    pub total_parts: u32,
}

/// 完成分片上传的请求模型。
///
/// `filename` / `mime_type` 目前在 Handler 层做校验并通过
/// 会话数据继续传递，因此这两个字段在 Service 中未直接使用，
/// 编译器会视为未读字段。
#[derive(Debug, Deserialize)]
pub struct CompleteChunkedUploadRequest {
    #[allow(dead_code)] // validated by handler; service uses session data
    pub filename: String,
    #[allow(dead_code)]
    pub mime_type: String,
    /// 目标文件夹 ID（可选，None 表示根目录）
    pub folder_id: Option<Uuid>,
}
