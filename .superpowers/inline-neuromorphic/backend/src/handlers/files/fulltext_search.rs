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
    pub page: Option<u32>,
    pub folder_id: Option<String>,
    pub mime_type: Option<String>,
    pub tag_id: Option<Uuid>,
    pub collection: Option<String>,
    pub sort_by: Option<String>,
    pub sort_order: Option<String>,
}

#[derive(Clone, Copy)]
struct FulltextFilters<'a> {
    folder_id: Option<Option<Uuid>>,
    tag_id: Option<Uuid>,
    collection: Option<&'a str>,
}

struct SearchHitPage {
    hits: Vec<SearchHit>,
    total: Option<usize>,
}

impl SearchHitPage {
    fn from_hits(hits: Vec<SearchHit>) -> Self {
        Self { hits, total: None }
    }
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

fn parse_folder_id_filter(raw: Option<&str>) -> Result<Option<Option<Uuid>>, AppError> {
    match raw {
        None => Ok(None),
        Some(value) => {
            let value = value.trim();
            if value.is_empty()
                || value.eq_ignore_ascii_case("null")
                || value.eq_ignore_ascii_case("root")
            {
                Ok(Some(None))
            } else {
                Uuid::parse_str(value)
                    .map(|id| Some(Some(id)))
                    .map_err(|_| AppError::Validation("无效的 folder_id".to_string()))
            }
        }
    }
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

    let folder_id_filter = parse_folder_id_filter(params.folder_id.as_deref())?;
    let filters = FulltextFilters {
        folder_id: folder_id_filter,
        tag_id: params.tag_id,
        collection: params.collection.as_deref(),
    };
    let mut index_status = "ready";
    let mut hit_page = if should_bypass_fulltext_search(query) {
        index_status = "fallback";
        fallback_search(&state, user_id, query, &params, folder_id_filter, filters).await?
    } else {
        let index_limit = if folder_id_filter.is_some() {
            params.limit.saturating_mul(10).clamp(params.limit, 500)
        } else {
            params.limit
        };
        let hit_page = match state.search_index.search(
            user_id,
            query,
            index_limit,
            None,
            params.mime_type.as_deref(),
        ) {
            Ok(hits) => SearchHitPage::from_hits(hits),
            Err(error) => {
                tracing::warn!(
                    query = %query,
                    user_id = %user_id,
                    error = %error,
                    "fulltext search failed, falling back to filename search"
                );
                index_status = "fallback";
                fallback_search(&state, user_id, query, &params, folder_id_filter, filters).await?
            }
        };
        if hit_page.hits.is_empty() {
            index_status = "fallback";
            fallback_search(&state, user_id, query, &params, folder_id_filter, filters).await?
        } else {
            hit_page
        }
    };

    let mut files =
        materialize_hits(&state, user_id, std::mem::take(&mut hit_page.hits), filters).await?;
    if folder_id_filter.is_some() && index_status == "ready" && files.len() < params.limit {
        let mut fallback_hit_page =
            fallback_search(&state, user_id, query, &params, folder_id_filter, filters).await?;
        let fallback_total = fallback_hit_page.total;
        let fallback_files = materialize_hits(
            &state,
            user_id,
            std::mem::take(&mut fallback_hit_page.hits),
            filters,
        )
        .await?;
        let fallback_count = fallback_total.unwrap_or(fallback_files.len());
        if files.is_empty() || fallback_count > files.len() || fallback_files.len() > files.len() {
            index_status = "fallback";
            hit_page = fallback_hit_page;
            files = fallback_files;
        }
    }
    if parse_collection_filters(filters.collection).contains(&"recent") {
        files.sort_by(|a, b| {
            b["file"]["last_opened_at"]
                .as_str()
                .cmp(&a["file"]["last_opened_at"].as_str())
        });
    }
    let total_count = hit_page.total.unwrap_or(files.len());
    files.truncate(params.limit);
    let ocr = ocr_readiness(&state);

    Ok(json_response(json!({
        "query": query,
        "count": total_count,
        "index_status": index_status,
        "search": {
            "index_status": index_status,
            "count": total_count,
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
    let hit_file_ids = hits.iter().map(|hit| hit.file_id).collect::<Vec<_>>();
    let hit_files = state
        .file_service
        .get_file_entities_by_ids(user_id, &hit_file_ids)
        .await?;
    for (hit, file) in hits.into_iter().zip(hit_files) {
        let Some(file) = file else {
            continue;
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
    if let Some(folder_id) = filters.folder_id {
        if file.folder_id != folder_id {
            return Ok(false);
        }
    }

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
    params: &FulltextSearchQuery,
    folder_id: Option<Option<Uuid>>,
    filters: FulltextFilters<'_>,
) -> Result<SearchHitPage, AppError> {
    let (files, total, _) = state
        .file_service
        .list_files(
            user_id,
            FileListQuery {
                page: params.page.or(Some(1)),
                limit: Some(params.limit as u32),
                search: Some(query.to_string()),
                mime_type: params.mime_type.clone(),
                folder_id: folder_id.map(|id| {
                    id.map(|value| value.to_string())
                        .unwrap_or_else(|| "root".to_string())
                }),
                tag_id: filters.tag_id,
                collection: filters.collection.map(ToOwned::to_owned),
                sort_by: params.sort_by.clone(),
                sort_order: params.sort_order.clone(),
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
        if hits.len() >= params.limit {
            break;
        }
    }
    Ok(SearchHitPage {
        hits,
        total: total.map(|value| value as usize),
    })
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
