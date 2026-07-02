use axum::extract::{Query, State};
use axum::response::Response;
use chrono::{Duration, Utc};
use serde::Deserialize;
use serde_json::json;
use uuid::Uuid;

use crate::types::file::{
    parse_collection_filters, FileListQuery, LARGE_COLLECTION_BYTES, RECENT_COLLECTION_DAYS,
};
use crate::{
    extractors::auth::AuthenticatedUser,
    models::file::FileResponse,
    services::{
        fulltext_search::{SearchDocument, SearchHit},
        ocr::OcrExtractor,
    },
    utils::{json_response, AppError},
    AppState,
};

#[derive(Debug, Deserialize)]
pub struct FulltextSearchQuery {
    pub q: String,
    #[serde(default = "default_limit")]
    pub limit: usize,
    pub folder_id: Option<Uuid>,
    pub mime_type: Option<String>,
    pub tag_id: Option<Uuid>,
    pub collection: Option<String>,
}

#[derive(Clone, Copy)]
struct FulltextFilters<'a> {
    tag_id: Option<Uuid>,
    collection: Option<&'a str>,
}

fn default_limit() -> usize {
    20
}

const MIN_FULLTEXT_QUERY_CHARS: usize = 2;

fn should_bypass_fulltext_search(query: &str) -> bool {
    let char_count = query.chars().count();
    if char_count < MIN_FULLTEXT_QUERY_CHARS {
        return true;
    }
    char_count < 3 && !query.chars().any(char::is_alphabetic)
}

pub async fn fulltext_search_handler(
    State(state): State<AppState>,
    AuthenticatedUser(user_id): AuthenticatedUser,
    Query(params): Query<FulltextSearchQuery>,
) -> Result<Response, AppError> {
    let query = params.q.trim();
    if query.is_empty() {
        return Err(AppError::Validation("查询文本不能为空".to_string()));
    }
    if params.limit == 0 || params.limit > 100 {
        return Err(AppError::Validation(
            "结果数量限制必须在 1 到 100 之间".to_string(),
        ));
    }
    if !state.config.search.fulltext_search_enabled {
        return Err(AppError::File("全文搜索功能未启用".to_string()));
    }

    let folder_prefix = params.folder_id.map(|id| format!("/{id}/"));
    let filters = FulltextFilters {
        tag_id: params.tag_id,
        collection: params.collection.as_deref(),
    };
    let mut index_status = "ready";
    let hits = if should_bypass_fulltext_search(query) {
        index_status = "fallback";
        fallback_search(
            &state,
            user_id,
            query,
            params.limit,
            params.folder_id,
            params.mime_type.as_deref(),
            filters,
        )
        .await?
    } else {
        let hits = match state.search_index.search(
            user_id,
            query,
            params.limit,
            folder_prefix.as_deref(),
            params.mime_type.as_deref(),
        ) {
            Ok(hits) => hits,
            Err(error) => {
                tracing::warn!(
                    query = %query,
                    user_id = %user_id,
                    error = %error,
                    "fulltext search failed, falling back to filename search"
                );
                index_status = "fallback";
                fallback_search(
                    &state,
                    user_id,
                    query,
                    params.limit,
                    params.folder_id,
                    params.mime_type.as_deref(),
                    filters,
                )
                .await?
            }
        };
        if hits.is_empty() {
            index_status = "fallback";
            fallback_search(
                &state,
                user_id,
                query,
                params.limit,
                params.folder_id,
                params.mime_type.as_deref(),
                filters,
            )
            .await?
        } else {
            hits
        }
    };

    let mut files = materialize_hits(&state, user_id, hits, filters).await?;
    if parse_collection_filters(filters.collection).contains(&"recent") {
        files.sort_by(|a, b| {
            b["file"]["last_opened_at"]
                .as_str()
                .cmp(&a["file"]["last_opened_at"].as_str())
        });
    }
    let ocr = ocr_readiness(&state);

    Ok(json_response(json!({
        "query": query,
        "count": files.len(),
        "index_status": index_status,
        "search": {
            "index_status": index_status,
            "count": files.len(),
            "ocr": ocr,
        },
        "files": files,
    })))
}

pub async fn fulltext_rebuild_handler(
    State(state): State<AppState>,
    AuthenticatedUser(user_id): AuthenticatedUser,
) -> Result<Response, AppError> {
    if !state.config.search.fulltext_search_enabled {
        return Err(AppError::File("全文搜索功能未启用".to_string()));
    }

    let queued = state
        .file_service
        .enqueue_fulltext_rebuild_for_user(user_id)
        .await?;

    Ok(json_response(json!({ "queued": queued })))
}

pub async fn ocr_status_handler(
    State(state): State<AppState>,
    AuthenticatedUser(_user_id): AuthenticatedUser,
) -> Result<Response, AppError> {
    Ok(json_response(json!({
        "enabled": state.config.search.ocr_enabled,
        "pdf_max_pages": state.config.search.ocr_pdf_max_pages,
        "tesseract": {
            "bin": state.config.search.ocr_tesseract_bin,
            "available": OcrExtractor::command_available(&state.config.search.ocr_tesseract_bin),
        },
        "poppler": {
            "bin": state.config.search.ocr_pdftoppm_bin,
            "available": OcrExtractor::command_available(&state.config.search.ocr_pdftoppm_bin),
        },
    })))
}

fn ocr_readiness(state: &AppState) -> serde_json::Value {
    json!({
        "enabled": state.config.search.ocr_enabled,
        "pdf_max_pages": state.config.search.ocr_pdf_max_pages,
        "tesseract_available": OcrExtractor::command_available(&state.config.search.ocr_tesseract_bin),
        "poppler_available": OcrExtractor::command_available(&state.config.search.ocr_pdftoppm_bin),
    })
}

async fn materialize_hits(
    state: &AppState,
    user_id: Uuid,
    hits: Vec<SearchHit>,
    filters: FulltextFilters<'_>,
) -> Result<Vec<serde_json::Value>, AppError> {
    let mut files = Vec::with_capacity(hits.len());
    for hit in hits {
        let file = match state.file_service.get_file(hit.file_id, user_id).await {
            Ok(file) => file,
            Err(AppError::NotFound) => continue,
            Err(error) => return Err(error),
        };
        if !matches_fulltext_filters(state, user_id, &file, filters).await? {
            continue;
        }
        let file = FileResponse::from(file);
        files.push(json!({
            "file": file,
            "score": hit.score,
            "snippet": hit.snippet,
            "match_source": hit.match_source,
        }));
    }
    Ok(files)
}

async fn matches_fulltext_filters(
    state: &AppState,
    user_id: Uuid,
    file: &crate::models::file::File,
    filters: FulltextFilters<'_>,
) -> Result<bool, AppError> {
    if let Some(tag_id) = filters.tag_id {
        let assigned: Option<i32> = sqlx::query_scalar(
            "SELECT 1 FROM file_tag_assignments
             WHERE user_id = $1 AND file_id = $2 AND tag_id = $3
             LIMIT 1",
        )
        .bind(user_id)
        .bind(file.id)
        .bind(tag_id)
        .fetch_optional(&state.pool)
        .await
        .map_err(AppError::from)?;
        if assigned.is_none() {
            return Ok(false);
        }
    }

    for collection in parse_collection_filters(filters.collection) {
        let matches = match collection {
            "favorites" => file.is_favorite,
            "pinned" => file.is_pinned,
            "recent" => file
                .last_opened_at
                .map(|value| value >= Utc::now() - Duration::days(RECENT_COLLECTION_DAYS))
                .unwrap_or(false),
            "untagged" => {
                let assigned: Option<i32> = sqlx::query_scalar(
                    "SELECT 1 FROM file_tag_assignments
                     WHERE user_id = $1 AND file_id = $2
                     LIMIT 1",
                )
                .bind(user_id)
                .bind(file.id)
                .fetch_optional(&state.pool)
                .await
                .map_err(AppError::from)?;
                assigned.is_none()
            }
            "large" => file.file_size >= LARGE_COLLECTION_BYTES,
            "images" => file.mime_type.to_lowercase().starts_with("image/"),
            "pdfs" => file.mime_type.eq_ignore_ascii_case("application/pdf"),
            "videos" => file.mime_type.to_lowercase().starts_with("video/"),
            "duplicates" => {
                let Some(hash) = file.content_sha256.as_deref() else {
                    return Ok(false);
                };
                let duplicate_count: i64 = sqlx::query_scalar(
                    "SELECT COUNT(*)::BIGINT FROM files
                     WHERE user_id = $1
                       AND deleted_at IS NULL
                       AND content_sha256 = $2",
                )
                .bind(user_id)
                .bind(hash)
                .fetch_one(&state.pool)
                .await
                .map_err(AppError::from)?;
                duplicate_count > 1
            }
            _ => true,
        };
        if !matches {
            return Ok(false);
        }
    }
    Ok(true)
}

async fn fallback_search(
    state: &AppState,
    user_id: Uuid,
    query: &str,
    limit: usize,
    folder_id: Option<Uuid>,
    mime_type: Option<&str>,
    filters: FulltextFilters<'_>,
) -> Result<Vec<SearchHit>, AppError> {
    let (files, _, _) = state
        .file_service
        .list_files(
            user_id,
            FileListQuery {
                page: Some(1),
                limit: Some(limit as u32),
                search: Some(query.to_string()),
                mime_type: mime_type.map(ToOwned::to_owned),
                folder_id: folder_id.map(|id| id.to_string()),
                tag_id: filters.tag_id,
                collection: filters.collection.map(ToOwned::to_owned),
                ..FileListQuery::default()
            },
        )
        .await?;
    let mut hits = Vec::new();
    for file in files.into_iter() {
        hits.push(SearchHit {
            file_id: file.id,
            filename: file.original_filename.clone(),
            path: format!("/{}", file.original_filename),
            mime_type: file.mime_type.clone(),
            score: 0.1,
            snippet: file.original_filename.chars().take(160).collect(),
            match_source: "filename".to_string(),
        });
        if hits.len() >= limit {
            break;
        }
    }
    Ok(hits)
}

#[allow(dead_code)]
pub(crate) fn document_from_file(
    file: &crate::models::file::File,
    extracted_text: String,
) -> SearchDocument {
    SearchDocument {
        file_id: file.id,
        user_id: file.user_id,
        filename: file.original_filename.clone(),
        path: format!("/{}", file.original_filename),
        extracted_text,
        ocr_text: String::new(),
        category: file.category.clone().unwrap_or_default(),
        mime_type: file.mime_type.clone(),
    }
}
