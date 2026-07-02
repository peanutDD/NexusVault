use chrono::{DateTime, Utc};
use serde::{Deserialize, Deserializer, Serialize};
use uuid::Uuid;

#[derive(Debug, Deserialize)]
pub struct CreateFileRequestLinkRequest {
    pub title: String,
    pub description: Option<String>,
    pub folder_id: Option<Uuid>,
    pub allowed_mime_prefixes: Option<Vec<String>>,
    pub max_file_size: Option<i64>,
    pub max_uploads: Option<i32>,
    pub expires_in_days: Option<u32>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateFileRequestLinkRequest {
    pub title: Option<String>,
    pub description: Option<String>,
    pub allowed_mime_prefixes: Option<Vec<String>>,
    pub max_file_size: Option<i64>,
    pub max_uploads: Option<i32>,
    pub expires_in_days: Option<u32>,
    pub revoked: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct ReviewFileRequestUploadRequest {
    pub action: String,
    pub filename: Option<String>,
    #[serde(default, deserialize_with = "deserialize_review_folder_selection")]
    pub folder_id: ReviewFolderSelection,
    pub review_note: Option<String>,
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub enum ReviewFolderSelection {
    #[default]
    Unspecified,
    Root,
    Folder(Uuid),
}

fn deserialize_review_folder_selection<'de, D>(
    deserializer: D,
) -> Result<ReviewFolderSelection, D::Error>
where
    D: Deserializer<'de>,
{
    Ok(match Option::<Uuid>::deserialize(deserializer)? {
        Some(folder_id) => ReviewFolderSelection::Folder(folder_id),
        None => ReviewFolderSelection::Root,
    })
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct FileRequestResponse {
    pub id: Uuid,
    pub folder_id: Option<Uuid>,
    pub folder_name: Option<String>,
    pub token_prefix: String,
    pub title: String,
    pub description: Option<String>,
    pub allowed_mime_prefixes: Vec<String>,
    pub max_file_size: Option<i64>,
    pub max_uploads: Option<i32>,
    pub upload_count: i32,
    pub expires_at: Option<DateTime<Utc>>,
    pub revoked_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub public_url: Option<String>,
    #[serde(skip_serializing)]
    pub token_hash: String,
}

#[derive(Debug, Clone, Serialize, sqlx::FromRow)]
pub struct FileRequestUploadResponse {
    pub id: Uuid,
    pub request_id: Uuid,
    pub submission_id: Option<Uuid>,
    pub file_id: Uuid,
    pub filename: String,
    pub file_size: i64,
    pub mime_type: String,
    pub status: String,
    pub reviewed_at: Option<DateTime<Utc>>,
    pub reviewer_user_id: Option<Uuid>,
    pub review_note: Option<String>,
    pub scan_status: String,
    pub scan_message: Option<String>,
    pub folder_id: Option<Uuid>,
    pub folder_name: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct FileRequestSubmissionRow {
    pub id: Uuid,
    pub request_id: Uuid,
    pub request_title: String,
    pub request_folder_id: Option<Uuid>,
    pub request_folder_name: Option<String>,
    pub submitter_email: Option<String>,
    pub submitter_note: Option<String>,
    pub file_count: i32,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
pub struct FileRequestSubmissionResponse {
    pub id: Uuid,
    pub request_id: Uuid,
    pub request_title: String,
    pub request_folder_id: Option<Uuid>,
    pub request_folder_name: Option<String>,
    pub submitter_email: Option<String>,
    pub submitter_note: Option<String>,
    pub file_count: i32,
    pub created_at: DateTime<Utc>,
    pub uploads: Vec<FileRequestUploadResponse>,
}
