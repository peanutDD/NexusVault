//! 文件列表查询（分页/过滤/搜索）

use axum::extract::{Query, State};
use axum::response::Response;
use serde_json::json;

use deadpool_redis::redis::cmd;

use crate::extractors::AuthenticatedUser;
use crate::models::file::FileListQuery;
use crate::utils::crypto::sha256_hex;
use crate::utils::{json_response, AppError};
use crate::AppState;

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
    // 提取分页参数（在移动 query 之前）
    let page = query.page.unwrap_or(1);
    let limit = query.limit.unwrap_or(20);

    if let Some(pool) = &state.redis {
        let fingerprint = format!(
            "page={:?}&limit={:?}&cursor={:?}&search={:?}&mime_type={:?}&category={:?}&folder_id={:?}&date_from={:?}&date_to={:?}&size_min={:?}&size_max={:?}&sort_by={:?}&sort_order={:?}&include_total={:?}",
            query.page,
            query.limit,
            query.cursor,
            query.search,
            query.mime_type,
            query.category,
            query.folder_id,
            query.date_from,
            query.date_to,
            query.size_min,
            query.size_max,
            query.sort_by,
            query.sort_order,
            query.include_total,
        );
        let hash = sha256_hex(fingerprint.as_bytes());
        let redis = crate::services::redis::RedisService::new(pool.clone());
        let ver = redis.get_user_cache_version(user_id).await.unwrap_or(1);
        let cache_key = format!("cache:files:list:{}:{}:{}", user_id, ver, hash);

        if let Ok(mut conn) = pool.get().await {
            let cached: Result<Option<String>, _> =
                cmd("GET").arg(&cache_key).query_async(&mut conn).await;
            if let Ok(Some(s)) = cached {
                if let Ok(v) = serde_json::from_str::<serde_json::Value>(&s) {
                    return Ok(json_response(v));
                }
            }
        }

        let (files, total, next_cursor) = state.file_service.list_files(user_id, query).await?;
        let mut response = json!({ "files": files });
        if next_cursor.is_some() {
            response["next_cursor"] = json!(next_cursor);
        } else {
            response["total"] = json!(total.unwrap_or(0));
            response["page"] = json!(page);
            response["limit"] = json!(limit);
        }

        if let Ok(mut conn) = pool.get().await {
            if let Ok(body) = serde_json::to_string(&response) {
                let _: Result<(), _> = cmd("SETEX")
                    .arg(&cache_key)
                    .arg(20)
                    .arg(body)
                    .query_async(&mut conn)
                    .await;
            }
        }

        return Ok(json_response(response));
    }

    let (files, total, next_cursor) = state.file_service.list_files(user_id, query).await?;

    // 构建响应：如果使用游标分页，返回 next_cursor；否则返回 total 和 page
    let mut response = json!({
        "files": files,
    });

    if next_cursor.is_some() {
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
