use axum::extract::{Query, State};
use axum::response::Response;
use serde_json::json;
use sqlx::{Postgres, QueryBuilder, Row};
use std::collections::HashMap;
use uuid::Uuid;

use crate::extractors::AuthenticatedUser;
use crate::models::file::{FileCollectionCountsResponse, FileListQuery};
use crate::types::file::{LARGE_COLLECTION_BYTES, SMART_COLLECTION_FILTERS};
use crate::utils::{json_response, AppError};
use crate::AppState;

// =============================================================================
// 文件列表
// =============================================================================
/// 获取文件列表
///
/// 支持分页、搜索、过滤等功能。
///
/// # 查询参数
/// - `page`: 页码（默认: 1）
/// - `limit`: 每页数量（默认: 20，最大: 100）
/// - `search`: 搜索关键词（文件名）
/// - `mime_type`: MIME 类型过滤
/// - `category`: 分类过滤
/// - `date_from`, `date_to`: 日期范围
/// - `size_min`, `size_max`: 文件大小范围
///
/// # 响应
/// ```json
/// {
///   "files": [...],
///   "total": 100,
///   "page": 1,
///   "limit": 20
/// }
/// ```
///
/// 与前端 `FileListResponse` 一致，使用 `files` 字段。
pub async fn list_files_handler(
    State(state): State<AppState>,
    AuthenticatedUser(user_id): AuthenticatedUser,
    Query(query): Query<FileListQuery>,
) -> Result<Response, AppError> {
    let page = query.page.unwrap_or(1);
    let limit = query.limit.unwrap_or(20);
    let is_cursor_pagination =
        query.cursor.is_some() || matches!(query.pagination.as_deref(), Some("cursor"));

    let (files, total, next_cursor) = state
        .file_service
        .list_files_cached(user_id, query, state.redis.as_ref(), &state.config.cache)
        .await?;

    // 构建响应：如果使用游标分页，返回 next_cursor；否则返回 total 和 page
    let mut response = json!({
        "files": files,
    });

    if is_cursor_pagination {
        // 游标分页响应
        response["next_cursor"] = json!(next_cursor);
    } else {
        // 传统分页响应
        response["total"] = json!(total.unwrap_or(0));
        response["page"] = json!(page);
        response["limit"] = json!(limit);
    }

    Ok(json_response(response))
}

pub async fn collection_counts_handler(
    State(state): State<AppState>,
    AuthenticatedUser(user_id): AuthenticatedUser,
    Query(query): Query<FileListQuery>,
) -> Result<Response, AppError> {
    let folder_id_filter: Option<Option<Uuid>> = match query.folder_id.as_deref() {
        None => None,
        Some(raw) => {
            let value = raw.trim();
            if value.is_empty() || value.eq_ignore_ascii_case("null") || value == "root" {
                Some(None)
            } else {
                Uuid::parse_str(value).ok().map(Some)
            }
        }
    };
    let search_pattern = query
        .search
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(|value| format!("%{value}%"));
    let mime_type_filter = query
        .mime_type
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(|value| {
            if value.ends_with('/') {
                format!("{value}%")
            } else {
                value.to_string()
            }
        });
    let mime_type_is_prefix = query
        .mime_type
        .as_deref()
        .map(|value| value.trim().ends_with('/'))
        .unwrap_or(false);

    fn push_file_scope<'a>(
        qb: &mut QueryBuilder<'a, Postgres>,
        user_id: Uuid,
        folder_id_filter: &Option<Option<Uuid>>,
        search_pattern: &'a Option<String>,
        mime_type_filter: &'a Option<String>,
        mime_type_is_prefix: bool,
        qualifier: &str,
    ) {
        fn push_column<'a>(qb: &mut QueryBuilder<'a, Postgres>, qualifier: &str, column: &str) {
            if !qualifier.is_empty() {
                qb.push(qualifier);
                qb.push(".");
            }
            qb.push(column);
        }

        qb.push(" WHERE ");
        push_column(qb, qualifier, "user_id");
        qb.push(" = ");
        qb.push_bind(user_id);
        qb.push(" AND ");
        push_column(qb, qualifier, "review_status");
        qb.push(" = 'approved' AND ");
        push_column(qb, qualifier, "deleted_at");
        qb.push(" IS NULL AND ");
        push_column(qb, qualifier, "original_filename");
        qb.push(" NOT LIKE '._%'");
        if let Some(folder_filter) = folder_id_filter {
            match folder_filter {
                Some(folder_id) => {
                    qb.push(" AND ");
                    push_column(qb, qualifier, "folder_id");
                    qb.push(" = ");
                    qb.push_bind(*folder_id);
                }
                None => {
                    qb.push(" AND ");
                    push_column(qb, qualifier, "folder_id");
                    qb.push(" IS NULL");
                }
            }
        }
        if let Some(pattern) = search_pattern {
            qb.push(" AND (");
            push_column(qb, qualifier, "original_filename");
            qb.push(" ILIKE ");
            qb.push_bind(pattern);
            qb.push(" OR ");
            push_column(qb, qualifier, "filename");
            qb.push(" ILIKE ");
            qb.push_bind(pattern);
            qb.push(")");
        }
        if let Some(mime_type) = mime_type_filter {
            if mime_type_is_prefix {
                qb.push(" AND ");
                push_column(qb, qualifier, "mime_type");
                qb.push(" LIKE ");
            } else {
                qb.push(" AND ");
                push_column(qb, qualifier, "mime_type");
                qb.push(" = ");
            }
            qb.push_bind(mime_type);
        }
    }

    let mut collections = HashMap::new();
    for collection in SMART_COLLECTION_FILTERS {
        let mut qb = QueryBuilder::<Postgres>::new("SELECT COUNT(*)::BIGINT FROM files");
        push_file_scope(
            &mut qb,
            user_id,
            &folder_id_filter,
            &search_pattern,
            &mime_type_filter,
            mime_type_is_prefix,
            "",
        );
        match collection {
            "favorites" => qb.push(" AND is_favorite = TRUE"),
            "pinned" => qb.push(" AND is_pinned = TRUE"),
            "recent" => qb.push(" AND last_opened_at >= CURRENT_TIMESTAMP - INTERVAL '7 days'"),
            "untagged" => qb.push(" AND NOT EXISTS (SELECT 1 FROM file_tag_assignments fta WHERE fta.file_id = files.id AND fta.user_id = files.user_id)"),
            "large" => {
                qb.push(" AND file_size >= ");
                qb.push_bind(LARGE_COLLECTION_BYTES)
            }
            "duplicates" => qb.push(
                " AND content_sha256 IS NOT NULL AND content_sha256 IN (
                    SELECT duplicate_files.content_sha256 FROM files duplicate_files",
            ),
            "images" => qb.push(" AND lower(mime_type) LIKE 'image/%'"),
            "pdfs" => qb.push(" AND lower(mime_type) = 'application/pdf'"),
            "videos" => qb.push(" AND lower(mime_type) LIKE 'video/%'"),
            _ => continue,
        };
        if collection == "duplicates" {
            push_file_scope(
                &mut qb,
                user_id,
                &folder_id_filter,
                &search_pattern,
                &mime_type_filter,
                mime_type_is_prefix,
                "duplicate_files",
            );
            qb.push(
                " AND duplicate_files.content_sha256 IS NOT NULL
                    GROUP BY duplicate_files.content_sha256
                    HAVING COUNT(*) > 1
                )",
            );
        }
        let count: i64 = qb
            .build_query_scalar()
            .fetch_one(&state.pool)
            .await
            .map_err(AppError::from)?;
        collections.insert(collection.to_string(), count);
    }

    let mut tag_qb = QueryBuilder::<Postgres>::new(
        "SELECT fta.tag_id::TEXT AS tag_id, COUNT(*)::BIGINT AS file_count
         FROM file_tag_assignments fta
         JOIN files ON files.id = fta.file_id AND files.user_id = fta.user_id
         WHERE fta.user_id = ",
    );
    tag_qb.push_bind(user_id);
    tag_qb.push(" AND files.review_status = 'approved' AND files.deleted_at IS NULL AND files.original_filename NOT LIKE '._%'");
    if let Some(folder_filter) = &folder_id_filter {
        match folder_filter {
            Some(folder_id) => {
                tag_qb.push(" AND files.folder_id = ");
                tag_qb.push_bind(*folder_id);
            }
            None => {
                tag_qb.push(" AND files.folder_id IS NULL");
            }
        }
    }
    if let Some(pattern) = &search_pattern {
        tag_qb.push(" AND (files.original_filename ILIKE ");
        tag_qb.push_bind(pattern);
        tag_qb.push(" OR files.filename ILIKE ");
        tag_qb.push_bind(pattern);
        tag_qb.push(")");
    }
    if let Some(mime_type) = &mime_type_filter {
        if mime_type_is_prefix {
            tag_qb.push(" AND files.mime_type LIKE ");
        } else {
            tag_qb.push(" AND files.mime_type = ");
        }
        tag_qb.push_bind(mime_type);
    }
    tag_qb.push(" GROUP BY fta.tag_id");

    let tag_rows = tag_qb
        .build()
        .fetch_all(&state.pool)
        .await
        .map_err(AppError::from)?;
    let tags = tag_rows
        .into_iter()
        .map(|row| {
            let tag_id: String = row.get("tag_id");
            let count: i64 = row.get("file_count");
            (tag_id, count)
        })
        .collect();

    let response = FileCollectionCountsResponse { collections, tags };
    Ok(json_response(json!(response)))
}
