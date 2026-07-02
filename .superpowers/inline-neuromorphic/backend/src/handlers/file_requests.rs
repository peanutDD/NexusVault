use axum::extract::{ConnectInfo, Multipart, Path, Query, State};
use axum::http::{header, HeaderMap, HeaderValue, Method, StatusCode};
use axum::response::Response;
use axum::Extension;
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine as _};
use chrono::Utc;
use serde::Deserialize;
use serde_json::json;
use std::net::{IpAddr, SocketAddr};
use uuid::Uuid;

use crate::extractors::{AuthenticatedUser, AuthenticatedUserQuery};
use crate::models::file::File;
use crate::services::activity::{AuditEventInput, AuditService};
use crate::services::file::CreateFileFromPathInput;
use crate::types::file_request::{
    CreateFileRequestLinkRequest, FileRequestResponse, FileRequestSubmissionResponse,
    FileRequestSubmissionRow, FileRequestUploadResponse, ReviewFileRequestUploadRequest,
    ReviewFolderSelection, UpdateFileRequestLinkRequest,
};
use crate::utils::{
    calculate_expiration, effective_file_mime_type, generate_random_token, json_response,
    sha256_file_hex, sha256_hex, AppError,
};
use crate::AppState;

fn frontend_url() -> String {
    std::env::var("FRONTEND_URL")
        .or_else(|_| std::env::var("FRONTEND_BASE_URL"))
        .unwrap_or_else(|_| "http://localhost:5173".to_string())
}

fn public_url(token: &str) -> String {
    format!("{}/request/{}", frontend_url(), token)
}

pub async fn create_file_request_handler(
    State(state): State<AppState>,
    AuthenticatedUser(user_id): AuthenticatedUser,
    axum::Json(req): axum::Json<CreateFileRequestLinkRequest>,
) -> Result<Response, AppError> {
    state
        .file_service
        .ensure_folder_belongs_to_user(user_id, req.folder_id)
        .await?;
    let title = req.title.trim();
    if title.is_empty() {
        return Err(AppError::Validation("请求标题不能为空".to_string()));
    }
    let token = generate_random_token(48);
    let token_hash = sha256_hex(token.as_bytes());
    let token_prefix = token.chars().take(8).collect::<String>();
    let row = sqlx::query_as::<_, FileRequestResponse>(
        "WITH inserted AS (
            INSERT INTO file_requests (
                user_id, folder_id, token_hash, token_prefix, title, description,
                allowed_mime_prefixes, max_file_size, max_uploads, expires_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING id, user_id, folder_id, token_prefix, title, description,
                      allowed_mime_prefixes, max_file_size, max_uploads, upload_count,
                      expires_at, revoked_at, created_at, token_hash
         )
         SELECT inserted.id, inserted.folder_id, folders.name AS folder_name,
                inserted.token_prefix, inserted.title, inserted.description,
                inserted.allowed_mime_prefixes, inserted.max_file_size, inserted.max_uploads,
                inserted.upload_count, inserted.expires_at, inserted.revoked_at,
                inserted.created_at, NULL::text AS public_url, inserted.token_hash
         FROM inserted
         LEFT JOIN folders ON folders.id = inserted.folder_id AND folders.user_id = inserted.user_id",
    )
    .bind(user_id)
    .bind(req.folder_id)
    .bind(&token_hash)
    .bind(&token_prefix)
    .bind(title)
    .bind(req.description.as_deref())
    .bind(req.allowed_mime_prefixes.unwrap_or_default())
    .bind(req.max_file_size)
    .bind(req.max_uploads)
    .bind(calculate_expiration(req.expires_in_days))
    .fetch_one(&state.pool)
    .await
    .map_err(AppError::from)?;
    AuditService::from_state(&state)
        .record(AuditEventInput {
            user_id,
            actor_type: "user",
            actor_user_id: Some(user_id),
            source: "file_request",
            event_type: "file_request.created",
            target_type: "file_request",
            file_id: None,
            folder_id: row.folder_id,
            share_id: None,
            file_request_id: Some(row.id),
            api_token_id: None,
            status: Some(200),
            ip_address: None,
            user_agent: None,
            metadata: json!({
                "title": row.title,
                "token_prefix": row.token_prefix,
                "max_uploads": row.max_uploads,
            }),
        })
        .await?;
    Ok(json_response(json!({
        "request": {
            "id": row.id,
            "folder_id": row.folder_id,
            "folder_name": row.folder_name,
            "token_prefix": row.token_prefix,
            "title": row.title,
            "description": row.description,
            "allowed_mime_prefixes": row.allowed_mime_prefixes,
            "max_file_size": row.max_file_size,
            "max_uploads": row.max_uploads,
            "upload_count": row.upload_count,
            "expires_at": row.expires_at,
            "revoked_at": row.revoked_at,
            "created_at": row.created_at,
            "public_url": public_url(&token),
            "token": null,
        }
    })))
}

pub async fn list_file_requests_handler(
    State(state): State<AppState>,
    AuthenticatedUser(user_id): AuthenticatedUser,
) -> Result<Response, AppError> {
    let requests = sqlx::query_as::<_, FileRequestResponse>(
        "SELECT fr.id, fr.folder_id, folders.name AS folder_name,
                fr.token_prefix, fr.title, fr.description, fr.allowed_mime_prefixes,
                fr.max_file_size, fr.max_uploads, fr.upload_count, fr.expires_at, fr.revoked_at,
                fr.created_at, NULL::text AS public_url, fr.token_hash
         FROM file_requests fr
         LEFT JOIN folders ON folders.id = fr.folder_id AND folders.user_id = fr.user_id
         WHERE fr.user_id = $1
         ORDER BY fr.created_at DESC",
    )
    .bind(user_id)
    .fetch_all(&state.pool)
    .await
    .map_err(AppError::from)?;
    Ok(json_response(json!({ "requests": requests })))
}

pub async fn update_file_request_handler(
    State(state): State<AppState>,
    AuthenticatedUser(user_id): AuthenticatedUser,
    Path(request_id): Path<Uuid>,
    axum::Json(req): axum::Json<UpdateFileRequestLinkRequest>,
) -> Result<Response, AppError> {
    let revoked_at = req
        .revoked
        .map(|revoked| if revoked { Some(Utc::now()) } else { None });
    let request = sqlx::query_as::<_, FileRequestResponse>(
        "WITH updated AS (
            UPDATE file_requests
            SET title = COALESCE(NULLIF(TRIM($1), ''), title),
                description = COALESCE($2, description),
                allowed_mime_prefixes = COALESCE($3, allowed_mime_prefixes),
                max_file_size = COALESCE($4, max_file_size),
                max_uploads = COALESCE($5, max_uploads),
                expires_at = COALESCE($6, expires_at),
                revoked_at = COALESCE($7, revoked_at),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $8 AND user_id = $9
            RETURNING id, user_id, folder_id, token_prefix, title, description,
                      allowed_mime_prefixes, max_file_size, max_uploads, upload_count,
                      expires_at, revoked_at, created_at, token_hash
         )
         SELECT updated.id, updated.folder_id, folders.name AS folder_name,
                updated.token_prefix, updated.title, updated.description,
                updated.allowed_mime_prefixes, updated.max_file_size, updated.max_uploads,
                updated.upload_count, updated.expires_at, updated.revoked_at,
                updated.created_at, NULL::text AS public_url, updated.token_hash
         FROM updated
         LEFT JOIN folders ON folders.id = updated.folder_id AND folders.user_id = updated.user_id",
    )
    .bind(req.title.as_deref())
    .bind(req.description.as_deref())
    .bind(req.allowed_mime_prefixes)
    .bind(req.max_file_size)
    .bind(req.max_uploads)
    .bind(calculate_expiration(req.expires_in_days))
    .bind(revoked_at.flatten())
    .bind(request_id)
    .bind(user_id)
    .fetch_optional(&state.pool)
    .await
    .map_err(AppError::from)?
    .ok_or(AppError::NotFound)?;
    let event_type = if request.revoked_at.is_some() {
        "file_request.revoked"
    } else {
        "file_request.updated"
    };
    AuditService::from_state(&state)
        .record(AuditEventInput {
            user_id,
            actor_type: "user",
            actor_user_id: Some(user_id),
            source: "file_request",
            event_type,
            target_type: "file_request",
            file_id: None,
            folder_id: request.folder_id,
            share_id: None,
            file_request_id: Some(request.id),
            api_token_id: None,
            status: Some(200),
            ip_address: None,
            user_agent: None,
            metadata: json!({
                "title": request.title,
                "token_prefix": request.token_prefix,
            }),
        })
        .await?;
    Ok(json_response(json!({ "request": request })))
}

pub async fn list_file_request_uploads_handler(
    State(state): State<AppState>,
    AuthenticatedUser(user_id): AuthenticatedUser,
    Path(request_id): Path<Uuid>,
) -> Result<Response, AppError> {
    let uploads = sqlx::query_as::<_, FileRequestUploadResponse>(
        "SELECT fru.id, fru.request_id, fru.submission_id, fru.file_id, fru.filename, fru.file_size,
                fru.mime_type, fru.status,
                fru.reviewed_at, fru.reviewer_user_id, fru.review_note,
                fru.scan_status, fru.scan_message,
                f.folder_id, folders.name AS folder_name, fru.created_at
         FROM file_request_uploads fru
         JOIN file_requests fr ON fr.id = fru.request_id
         JOIN files f ON f.id = fru.file_id AND f.user_id = fr.user_id
         LEFT JOIN folders ON folders.id = f.folder_id AND folders.user_id = fr.user_id
         WHERE fru.request_id = $1 AND fr.user_id = $2
         ORDER BY fru.created_at DESC",
    )
    .bind(request_id)
    .bind(user_id)
    .fetch_all(&state.pool)
    .await
    .map_err(AppError::from)?;
    Ok(json_response(json!({ "uploads": uploads })))
}

#[derive(Debug, Deserialize)]
pub struct FileRequestInboxQuery {
    status: Option<String>,
    request_id: Option<Uuid>,
    cursor: Option<String>,
    limit: Option<i64>,
}

pub async fn list_file_request_inbox_handler(
    State(state): State<AppState>,
    AuthenticatedUser(user_id): AuthenticatedUser,
    Query(query): Query<FileRequestInboxQuery>,
) -> Result<Response, AppError> {
    let limit = query.limit.unwrap_or(20).clamp(1, 100);
    let cursor = query
        .cursor
        .as_deref()
        .map(parse_submission_cursor)
        .transpose()?;
    let fetch_limit = limit + 1;
    let mut submissions_qb = sqlx::QueryBuilder::<sqlx::Postgres>::new(
        "SELECT DISTINCT frs.id, frs.request_id, fr.title AS request_title,
                fr.folder_id AS request_folder_id, folders.name AS request_folder_name,
                frs.submitter_email, frs.submitter_note, frs.file_count, frs.created_at
         FROM file_request_submissions frs
         JOIN file_requests fr ON fr.id = frs.request_id
         JOIN file_request_uploads fru ON fru.submission_id = frs.id
         LEFT JOIN folders ON folders.id = fr.folder_id AND folders.user_id = fr.user_id
         WHERE fr.user_id = ",
    );
    submissions_qb.push_bind(user_id);
    if let Some(request_id) = query.request_id {
        submissions_qb.push(" AND frs.request_id = ");
        submissions_qb.push_bind(request_id);
    }
    if let Some(status) = query.status.as_deref().filter(|s| !s.trim().is_empty()) {
        submissions_qb.push(" AND fru.status = ");
        submissions_qb.push_bind(status.trim());
    }
    if let Some((created_at, id)) = cursor {
        submissions_qb.push(" AND (frs.created_at < ");
        submissions_qb.push_bind(created_at);
        submissions_qb.push(" OR (frs.created_at = ");
        submissions_qb.push_bind(created_at);
        submissions_qb.push(" AND frs.id < ");
        submissions_qb.push_bind(id);
        submissions_qb.push("))");
    }
    submissions_qb.push(" ORDER BY frs.created_at DESC, frs.id DESC LIMIT ");
    submissions_qb.push_bind(fetch_limit);

    let mut submissions = submissions_qb
        .build_query_as::<FileRequestSubmissionRow>()
        .fetch_all(&state.pool)
        .await
        .map_err(AppError::from)?;
    let next_cursor = if submissions.len() > limit as usize {
        submissions.truncate(limit as usize);
        submissions
            .last()
            .map(|submission| encode_submission_cursor(submission.created_at, submission.id))
    } else {
        None
    };

    let submission_ids = submissions.iter().map(|s| s.id).collect::<Vec<_>>();
    let uploads = if submission_ids.is_empty() {
        Vec::new()
    } else {
        sqlx::query_as::<_, FileRequestUploadResponse>(
            "SELECT fru.id, fru.request_id, fru.submission_id, fru.file_id, fru.filename,
                    fru.file_size, fru.mime_type, fru.status, fru.reviewed_at,
                    fru.reviewer_user_id, fru.review_note, fru.scan_status, fru.scan_message,
                    f.folder_id, folders.name AS folder_name, fru.created_at
             FROM file_request_uploads fru
             JOIN files f ON f.id = fru.file_id
             JOIN file_requests fr ON fr.id = fru.request_id AND fr.user_id = f.user_id
             LEFT JOIN folders ON folders.id = f.folder_id AND folders.user_id = fr.user_id
             WHERE fru.submission_id = ANY($1)
             ORDER BY fru.created_at DESC",
        )
        .bind(&submission_ids)
        .fetch_all(&state.pool)
        .await
        .map_err(AppError::from)?
    };

    let response = submissions
        .into_iter()
        .map(|submission| FileRequestSubmissionResponse {
            uploads: uploads
                .iter()
                .filter(|upload| upload.submission_id == Some(submission.id))
                .cloned()
                .collect(),
            id: submission.id,
            request_id: submission.request_id,
            request_title: submission.request_title,
            request_folder_id: submission.request_folder_id,
            request_folder_name: submission.request_folder_name,
            submitter_email: submission.submitter_email,
            submitter_note: submission.submitter_note,
            file_count: submission.file_count,
            created_at: submission.created_at,
        })
        .collect::<Vec<_>>();

    Ok(json_response(json!({
        "submissions": response,
        "next_cursor": next_cursor,
    })))
}

pub async fn public_file_request_handler(
    State(state): State<AppState>,
    Path(token): Path<String>,
) -> Result<Response, AppError> {
    let request = find_active_request(&state, &token).await?;
    Ok(json_response(json!({
        "request": {
            "id": request.id,
            "title": request.title,
            "description": request.description,
            "allowed_mime_prefixes": request.allowed_mime_prefixes,
            "max_file_size": request.max_file_size,
            "max_uploads": request.max_uploads,
            "upload_count": request.upload_count,
            "expires_at": request.expires_at,
        }
    })))
}

pub async fn public_file_request_upload_handler(
    State(state): State<AppState>,
    Path(token): Path<String>,
    headers: HeaderMap,
    connect_info: Option<Extension<ConnectInfo<SocketAddr>>>,
    multipart: Multipart,
) -> Result<Response, AppError> {
    use tokio::io::AsyncWriteExt;
    let request = find_active_request(&state, &token).await?;
    let peer_addr = connect_info.map(|Extension(ConnectInfo(addr))| addr);
    let ip_address = client_ip(&headers, state.config.server.trust_proxy_headers, peer_addr);
    let user_agent = sanitized_user_agent(&headers);
    let mut multipart = multipart;
    let mut files: Vec<(String, String, u64, std::path::PathBuf, Option<String>)> = Vec::new();
    let mut submitter_email: Option<String> = None;
    let mut submitter_note: Option<String> = None;

    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|e| AppError::File(format!("Failed to parse multipart: {}", e)))?
    {
        let field_name = field.name().unwrap_or("").to_string();
        if field_name == "submitter_email" {
            let value = field
                .text()
                .await
                .map_err(|e| AppError::File(format!("Failed to read submitter email: {e}")))?;
            let trimmed = value.trim();
            if !trimmed.is_empty() {
                if trimmed.len() > 320 || !trimmed.contains('@') {
                    return Err(AppError::Validation("提交者邮箱格式不正确".to_string()));
                }
                submitter_email = Some(trimmed.to_string());
            }
            continue;
        }
        if field_name == "submitter_note" {
            let value = field
                .text()
                .await
                .map_err(|e| AppError::File(format!("Failed to read submitter note: {e}")))?;
            let trimmed = value.trim();
            if !trimmed.is_empty() {
                submitter_note = Some(trimmed.chars().take(2000).collect());
            }
            continue;
        }
        if field_name != "file" {
            continue;
        }
        let filename = field
            .file_name()
            .ok_or_else(|| AppError::File("Missing filename".to_string()))?
            .to_string();
        let mime_type = effective_file_mime_type(&filename, field.content_type());
        validate_public_upload(&request, &mime_type, 0)?;
        let tmp_dir = std::env::temp_dir().join("file-storage-backend-requests");
        tokio::fs::create_dir_all(&tmp_dir)
            .await
            .map_err(|e| AppError::Storage(format!("Failed to create temp dir: {e}")))?;
        let tmp_path = tmp_dir.join(format!("file_request_{}", Uuid::new_v4()));
        let mut out = tokio::fs::File::create(&tmp_path)
            .await
            .map_err(|e| AppError::Storage(format!("Failed to create temp file: {e}")))?;
        let mut file_size = 0u64;
        let mut field = field;
        while let Some(chunk) = field
            .chunk()
            .await
            .map_err(|e| AppError::File(format!("Failed to read upload chunk: {e}")))?
        {
            file_size = file_size.saturating_add(chunk.len() as u64);
            validate_public_upload(&request, &mime_type, file_size as i64)?;
            out.write_all(&chunk)
                .await
                .map_err(|e| AppError::Storage(format!("Failed to write temp file: {e}")))?;
        }
        out.flush()
            .await
            .map_err(|e| AppError::Storage(format!("Failed to flush temp file: {e}")))?;
        let content_sha256 = tokio::task::spawn_blocking({
            let p = tmp_path.clone();
            move || sha256_file_hex(&p).ok()
        })
        .await
        .ok()
        .flatten();
        files.push((filename, mime_type, file_size, tmp_path, content_sha256));
    }

    if files.is_empty() {
        return Err(AppError::File("No file provided".to_string()));
    }
    if let Some(max_uploads) = request.max_uploads {
        if request.upload_count.saturating_add(files.len() as i32) > max_uploads {
            return Err(AppError::Validation("上传次数已达上限".to_string()));
        }
    }

    let mut created_files = Vec::with_capacity(files.len());
    for (original_filename, mime_type, file_size, tmp_path, content_sha256) in &files {
        let file = state
            .file_service
            .create_file_from_path(CreateFileFromPathInput {
                user_id: request.user_id,
                original_filename: original_filename.clone(),
                mime_type: mime_type.clone(),
                file_size: *file_size,
                source_path: tmp_path,
                content_sha256: content_sha256.as_deref(),
                folder_id: request.folder_id,
                allow_versioning: false,
                review_status: "pending",
            })
            .await?;
        created_files.push(file);
    }

    let mut tx = state.pool.begin().await.map_err(AppError::from)?;
    let submission_id: Uuid = sqlx::query_scalar(
        "INSERT INTO file_request_submissions (
            request_id, submitter_email, submitter_note, ip_address, user_agent, file_count
         )
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id",
    )
    .bind(request.id)
    .bind(&submitter_email)
    .bind(&submitter_note)
    .bind(&ip_address)
    .bind(&user_agent)
    .bind(files.len() as i32)
    .fetch_one(&mut *tx)
    .await
    .map_err(AppError::from)?;

    let upload_count_result = sqlx::query(
        "UPDATE file_requests
         SET upload_count = upload_count + $1, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2 AND upload_count = $3",
    )
    .bind(files.len() as i32)
    .bind(request.id)
    .bind(request.upload_count)
    .execute(&mut *tx)
    .await
    .map_err(AppError::from)?;
    if upload_count_result.rows_affected() != 1 {
        tx.rollback().await.map_err(AppError::from)?;
        return Err(AppError::Validation("上传次数已达上限".to_string()));
    }
    for (idx, file) in created_files.iter().enumerate() {
        let (original_filename, mime_type, file_size, _, _) = &files[idx];
        sqlx::query(
            "UPDATE files
             SET review_status = 'pending', updated_at = CURRENT_TIMESTAMP
             WHERE id = $1 AND user_id = $2",
        )
        .bind(file.id)
        .bind(request.user_id)
        .execute(&mut *tx)
        .await
        .map_err(AppError::from)?;
        sqlx::query(
            "INSERT INTO file_request_uploads (
                request_id, submission_id, file_id, filename, file_size, mime_type, status, scan_status
             )
             VALUES ($1, $2, $3, $4, $5, $6, 'pending', 'not_scanned')",
        )
        .bind(request.id)
        .bind(submission_id)
        .bind(file.id)
        .bind(original_filename)
        .bind(*file_size as i64)
        .bind(mime_type)
        .execute(&mut *tx)
        .await
        .map_err(AppError::from)?;
    }
    tx.commit().await.map_err(AppError::from)?;

    AuditService::from_state(&state)
        .record(AuditEventInput {
            user_id: request.user_id,
            actor_type: "file_request",
            actor_user_id: None,
            source: "file_request",
            event_type: "file_request.submitted",
            target_type: "file_request_submission",
            file_id: None,
            folder_id: request.folder_id,
            share_id: None,
            file_request_id: Some(request.id),
            api_token_id: None,
            status: Some(200),
            ip_address: ip_address.as_deref(),
            user_agent: user_agent.as_deref(),
            metadata: json!({
                "submission_id": submission_id,
                "submitter_email": submitter_email,
                "file_count": files.len(),
                "files": files.iter().map(|(filename, mime_type, file_size, _, _)| json!({
                    "filename": filename,
                    "file_size": file_size,
                    "mime_type": mime_type,
                })).collect::<Vec<_>>(),
                "request_title": request.title,
            }),
        })
        .await?;

    Ok(json_response(json!({
        "submission": {
            "id": submission_id,
            "request_id": request.id,
            "submitter_email": submitter_email,
            "submitter_note": submitter_note,
            "file_count": files.len(),
        },
        "message": "已提交，等待审核"
    })))
}

#[derive(sqlx::FromRow)]
struct OwnedUploadRow {
    id: Uuid,
    request_id: Uuid,
    submission_id: Option<Uuid>,
    file_id: Uuid,
    filename: String,
    file_size: i64,
    mime_type: String,
    status: String,
    reviewed_at: Option<chrono::DateTime<Utc>>,
    reviewer_user_id: Option<Uuid>,
    review_note: Option<String>,
    scan_status: String,
    scan_message: Option<String>,
    created_at: chrono::DateTime<Utc>,
    folder_id: Option<Uuid>,
    folder_name: Option<String>,
}

impl From<OwnedUploadRow> for FileRequestUploadResponse {
    fn from(row: OwnedUploadRow) -> Self {
        Self {
            id: row.id,
            request_id: row.request_id,
            submission_id: row.submission_id,
            file_id: row.file_id,
            filename: row.filename,
            file_size: row.file_size,
            mime_type: row.mime_type,
            status: row.status,
            reviewed_at: row.reviewed_at,
            reviewer_user_id: row.reviewer_user_id,
            review_note: row.review_note,
            scan_status: row.scan_status,
            scan_message: row.scan_message,
            folder_id: row.folder_id,
            folder_name: row.folder_name,
            created_at: row.created_at,
        }
    }
}

pub async fn review_file_request_upload_handler(
    State(state): State<AppState>,
    AuthenticatedUser(user_id): AuthenticatedUser,
    Path(upload_id): Path<Uuid>,
    axum::Json(req): axum::Json<ReviewFileRequestUploadRequest>,
) -> Result<Response, AppError> {
    let upload = find_owned_upload(&state, user_id, upload_id).await?;
    let action = req.action.trim().to_ascii_lowercase();
    let audit = AuditService::from_state(&state);
    if upload.status != "pending" {
        return Err(AppError::Conflict(
            "该上传已完成审核，不能重复处理".to_string(),
        ));
    }

    match action.as_str() {
        "approve" => {
            let target_folder_id = match req.folder_id {
                ReviewFolderSelection::Unspecified => upload.folder_id,
                ReviewFolderSelection::Root => None,
                ReviewFolderSelection::Folder(folder_id) => Some(folder_id),
            };
            state
                .file_service
                .ensure_folder_belongs_to_user(user_id, target_folder_id)
                .await?;
            let filename = req
                .filename
                .as_deref()
                .map(str::trim)
                .filter(|name| !name.is_empty())
                .unwrap_or(&upload.filename)
                .to_string();
            validate_review_filename(&filename)?;
            if let Some(existing) = state
                .file_service
                .find_file_by_name_and_folder(user_id, &filename, target_folder_id)
                .await?
            {
                if existing.id != upload.file_id {
                    return Err(AppError::Conflict("目标文件夹中已存在同名文件".to_string()));
                }
            }

            let updated = sqlx::query_as::<_, OwnedUploadRow>(
                "WITH updated_file AS (
                    UPDATE files
                    SET review_status = 'approved',
                        original_filename = $1,
                        folder_id = $2,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = $3 AND user_id = $4 AND deleted_at IS NULL
                    RETURNING id, folder_id
                 ),
                 updated_upload AS (
                    UPDATE file_request_uploads
                    SET status = 'approved',
                        filename = $1,
                        reviewed_at = CURRENT_TIMESTAMP,
                        reviewer_user_id = $4,
                        review_note = $5
                    WHERE id = $6
                    RETURNING *
                 )
                 SELECT uu.id, uu.request_id, uu.submission_id, uu.file_id, uu.filename,
                        uu.file_size, uu.mime_type, uu.status, uu.reviewed_at,
                        uu.reviewer_user_id, uu.review_note, uu.scan_status, uu.scan_message,
                        uu.created_at, uf.folder_id, folders.name AS folder_name
                 FROM updated_upload uu
                 JOIN updated_file uf ON uf.id = uu.file_id
                 LEFT JOIN folders ON folders.id = uf.folder_id AND folders.user_id = $4",
            )
            .bind(&filename)
            .bind(target_folder_id)
            .bind(upload.file_id)
            .bind(user_id)
            .bind(req.review_note.as_deref())
            .bind(upload_id)
            .fetch_one(&state.pool)
            .await
            .map_err(AppError::from)?;

            audit
                .record(AuditEventInput {
                    user_id,
                    actor_type: "user",
                    actor_user_id: Some(user_id),
                    source: "file_request",
                    event_type: "file_request.upload.approved",
                    target_type: "file",
                    file_id: Some(updated.file_id),
                    folder_id: updated.folder_id,
                    share_id: None,
                    file_request_id: Some(updated.request_id),
                    api_token_id: None,
                    status: Some(200),
                    ip_address: None,
                    user_agent: None,
                    metadata: json!({
                        "filename": updated.filename,
                        "file_size": updated.file_size,
                        "mime_type": updated.mime_type,
                        "submission_id": updated.submission_id,
                    }),
                })
                .await?;

            Ok(json_response(
                json!({ "upload": FileRequestUploadResponse::from(updated) }),
            ))
        }
        "reject" => {
            let updated = sqlx::query_as::<_, OwnedUploadRow>(
                "WITH updated_file AS (
                    UPDATE files
                    SET review_status = 'rejected', updated_at = CURRENT_TIMESTAMP
                    WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
                    RETURNING id, folder_id
                 ),
                 updated_upload AS (
                    UPDATE file_request_uploads
                    SET status = 'rejected',
                        reviewed_at = CURRENT_TIMESTAMP,
                        reviewer_user_id = $2,
                        review_note = $3
                    WHERE id = $4
                    RETURNING *
                 )
                 SELECT uu.id, uu.request_id, uu.submission_id, uu.file_id, uu.filename,
                        uu.file_size, uu.mime_type, uu.status, uu.reviewed_at,
                        uu.reviewer_user_id, uu.review_note, uu.scan_status, uu.scan_message,
                        uu.created_at, uf.folder_id, folders.name AS folder_name
                 FROM updated_upload uu
                 JOIN updated_file uf ON uf.id = uu.file_id
                 LEFT JOIN folders ON folders.id = uf.folder_id AND folders.user_id = $2",
            )
            .bind(upload.file_id)
            .bind(user_id)
            .bind(req.review_note.as_deref())
            .bind(upload_id)
            .fetch_one(&state.pool)
            .await
            .map_err(AppError::from)?;

            audit
                .record(AuditEventInput {
                    user_id,
                    actor_type: "user",
                    actor_user_id: Some(user_id),
                    source: "file_request",
                    event_type: "file_request.upload.rejected",
                    target_type: "file",
                    file_id: Some(updated.file_id),
                    folder_id: updated.folder_id,
                    share_id: None,
                    file_request_id: Some(updated.request_id),
                    api_token_id: None,
                    status: Some(200),
                    ip_address: None,
                    user_agent: None,
                    metadata: json!({
                        "filename": updated.filename,
                        "file_size": updated.file_size,
                        "mime_type": updated.mime_type,
                        "submission_id": updated.submission_id,
                    }),
                })
                .await?;

            Ok(json_response(
                json!({ "upload": FileRequestUploadResponse::from(updated) }),
            ))
        }
        _ => Err(AppError::Validation(
            "action 必须是 approve 或 reject".to_string(),
        )),
    }
}

pub async fn file_request_upload_preview_handler(
    State(state): State<AppState>,
    AuthenticatedUserQuery(user_id): AuthenticatedUserQuery,
    method: Method,
    headers: HeaderMap,
    Path(upload_id): Path<Uuid>,
) -> Result<Response, AppError> {
    file_request_upload_file_response(&state, user_id, method, headers, upload_id, true).await
}

pub async fn file_request_upload_download_handler(
    State(state): State<AppState>,
    AuthenticatedUserQuery(user_id): AuthenticatedUserQuery,
    method: Method,
    headers: HeaderMap,
    Path(upload_id): Path<Uuid>,
) -> Result<Response, AppError> {
    file_request_upload_file_response(&state, user_id, method, headers, upload_id, false).await
}

async fn file_request_upload_file_response(
    state: &AppState,
    user_id: Uuid,
    method: Method,
    _headers: HeaderMap,
    upload_id: Uuid,
    inline: bool,
) -> Result<Response, AppError> {
    let file = find_owned_review_file(state, user_id, upload_id).await?;
    if method == Method::HEAD {
        let mut response = Response::builder()
            .status(StatusCode::OK)
            .header(header::CONTENT_LENGTH, file.file_size.max(0).to_string())
            .body(axum::body::Body::empty())
            .map_err(|_| AppError::Internal)?;
        if let Ok(value) = HeaderValue::from_str(&file.mime_type) {
            response.headers_mut().insert(header::CONTENT_TYPE, value);
        }
        return Ok(response);
    }
    let data = state.file_service.get_file_data(&file).await?;
    crate::utils::response::file_response(data, &file.original_filename, &file.mime_type, inline)
        .map_err(|_| AppError::Internal)
}

async fn find_owned_upload(
    state: &AppState,
    user_id: Uuid,
    upload_id: Uuid,
) -> Result<OwnedUploadRow, AppError> {
    sqlx::query_as::<_, OwnedUploadRow>(
        "SELECT fru.id, fru.request_id, fru.submission_id, fru.file_id, fru.filename,
                fru.file_size, fru.mime_type, fru.status, fru.reviewed_at,
                fru.reviewer_user_id, fru.review_note, fru.scan_status, fru.scan_message,
                fru.created_at, f.folder_id, folders.name AS folder_name
         FROM file_request_uploads fru
         JOIN file_requests fr ON fr.id = fru.request_id
         JOIN files f ON f.id = fru.file_id AND f.user_id = fr.user_id
         LEFT JOIN folders ON folders.id = f.folder_id AND folders.user_id = fr.user_id
         WHERE fru.id = $1 AND fr.user_id = $2 AND f.deleted_at IS NULL",
    )
    .bind(upload_id)
    .bind(user_id)
    .fetch_optional(&state.pool)
    .await
    .map_err(AppError::from)?
    .ok_or(AppError::NotFound)
}

async fn find_owned_review_file(
    state: &AppState,
    user_id: Uuid,
    upload_id: Uuid,
) -> Result<File, AppError> {
    sqlx::query_as::<_, File>(
        "SELECT f.*
         FROM files f
         JOIN file_request_uploads fru ON fru.file_id = f.id
         JOIN file_requests fr ON fr.id = fru.request_id
         WHERE fru.id = $1 AND fr.user_id = $2 AND f.user_id = $2 AND f.deleted_at IS NULL",
    )
    .bind(upload_id)
    .bind(user_id)
    .fetch_optional(&state.pool)
    .await
    .map_err(AppError::from)?
    .ok_or(AppError::NotFound)
}

fn validate_review_filename(filename: &str) -> Result<(), AppError> {
    if filename.is_empty()
        || filename.len() > 255
        || filename.contains('/')
        || filename.contains('\\')
        || filename.contains('\0')
    {
        return Err(AppError::Validation("文件名不合法".to_string()));
    }
    Ok(())
}

fn encode_submission_cursor(created_at: chrono::DateTime<Utc>, id: Uuid) -> String {
    URL_SAFE_NO_PAD.encode(format!("{}|{}", created_at.to_rfc3339(), id))
}

fn parse_submission_cursor(cursor: &str) -> Result<(chrono::DateTime<Utc>, Uuid), AppError> {
    let decoded = URL_SAFE_NO_PAD
        .decode(cursor)
        .map_err(|_| AppError::Validation("cursor 不合法".to_string()))?;
    let decoded = String::from_utf8(decoded)
        .map_err(|_| AppError::Validation("cursor 不合法".to_string()))?;
    let (created_at, id) = decoded
        .split_once('|')
        .ok_or_else(|| AppError::Validation("cursor 不合法".to_string()))?;
    let created_at = chrono::DateTime::parse_from_rfc3339(created_at)
        .map_err(|_| AppError::Validation("cursor 不合法".to_string()))?
        .with_timezone(&Utc);
    let id = Uuid::parse_str(id).map_err(|_| AppError::Validation("cursor 不合法".to_string()))?;
    Ok((created_at, id))
}

fn sanitized_user_agent(headers: &HeaderMap) -> Option<String> {
    headers
        .get(header::USER_AGENT)
        .and_then(|value| value.to_str().ok())
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(|value| value.chars().take(256).collect())
}

fn client_ip(
    headers: &HeaderMap,
    trust_proxy_headers: bool,
    peer_addr: Option<SocketAddr>,
) -> Option<String> {
    let header_ip = if trust_proxy_headers {
        forwarded_for_ip(headers)
            .or_else(|| x_forwarded_for_ip(headers))
            .or_else(|| x_real_ip(headers))
    } else {
        None
    };

    header_ip
        .or_else(|| peer_addr.map(|addr| addr.ip()))
        .map(|ip| ip.to_string())
}

fn parse_ip(value: &str) -> Option<IpAddr> {
    let mut value = value.trim().trim_matches('"');
    if let Some(stripped) = value.strip_prefix('[').and_then(|v| v.strip_suffix(']')) {
        value = stripped;
    }

    if let Some(stripped) = value
        .strip_prefix("for=")
        .or_else(|| value.strip_prefix("for=\""))
    {
        value = stripped.trim_matches('"');
        if let Some(stripped) = value.strip_prefix('[').and_then(|v| v.strip_suffix(']')) {
            value = stripped;
        }
    }

    let candidate = if value.contains(':') && value.matches(':').count() > 1 {
        value
    } else {
        value.split(':').next().unwrap_or(value)
    };

    candidate.parse::<IpAddr>().ok()
}

fn forwarded_for_ip(headers: &HeaderMap) -> Option<IpAddr> {
    let value = headers.get("forwarded")?.to_str().ok()?;
    value
        .split(',')
        .flat_map(|item| item.split(';'))
        .map(str::trim)
        .find_map(|part| part.starts_with("for=").then(|| parse_ip(part)).flatten())
}

fn x_forwarded_for_ip(headers: &HeaderMap) -> Option<IpAddr> {
    let value = headers.get("x-forwarded-for")?.to_str().ok()?;
    value.split(',').find_map(parse_ip)
}

fn x_real_ip(headers: &HeaderMap) -> Option<IpAddr> {
    headers
        .get("x-real-ip")
        .and_then(|value| value.to_str().ok())
        .and_then(parse_ip)
}

#[derive(sqlx::FromRow)]
struct FileRequestRow {
    id: Uuid,
    user_id: Uuid,
    folder_id: Option<Uuid>,
    title: String,
    description: Option<String>,
    allowed_mime_prefixes: Vec<String>,
    max_file_size: Option<i64>,
    max_uploads: Option<i32>,
    upload_count: i32,
    expires_at: Option<chrono::DateTime<Utc>>,
}

async fn find_active_request(state: &AppState, token: &str) -> Result<FileRequestRow, AppError> {
    let token_hash = sha256_hex(token.as_bytes());
    let request = sqlx::query_as::<_, FileRequestRow>(
        "SELECT id, user_id, folder_id, title, description, allowed_mime_prefixes,
                max_file_size, max_uploads, upload_count, expires_at
         FROM file_requests
         WHERE token_hash = $1 AND revoked_at IS NULL
           AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)",
    )
    .bind(token_hash)
    .fetch_optional(&state.pool)
    .await
    .map_err(AppError::from)?
    .ok_or(AppError::NotFound)?;
    if let Some(max_uploads) = request.max_uploads {
        if request.upload_count >= max_uploads {
            return Err(AppError::Validation("上传次数已达上限".to_string()));
        }
    }
    if let Some(folder_id) = request.folder_id {
        state
            .file_service
            .ensure_folder_belongs_to_user(request.user_id, Some(folder_id))
            .await?;
    }
    Ok(request)
}

fn validate_public_upload(
    request: &FileRequestRow,
    mime_type: &str,
    file_size: i64,
) -> Result<(), AppError> {
    if let Some(max) = request.max_file_size {
        if file_size > max {
            return Err(AppError::PayloadTooLarge(format!(
                "文件大小超过请求链接限制（{} bytes）",
                max
            )));
        }
    }
    if !request.allowed_mime_prefixes.is_empty()
        && !request
            .allowed_mime_prefixes
            .iter()
            .any(|prefix| mime_type.starts_with(prefix))
    {
        return Err(AppError::Validation(
            "文件类型不符合请求链接限制".to_string(),
        ));
    }
    Ok(())
}
