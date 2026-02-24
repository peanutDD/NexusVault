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

// =============================================================================
// 文件列表
// =============================================================================
//
// 为什么在这里做缓存：
// - 该接口属于高频路径（文件夹切换、无限滚动、筛选条件变化）
// - 响应体是小 JSON，短期缓存收益明显
//
// 缓存设计：
// - cache-aside：GET 命中直接返回；未命中则查询后 SETEX
// - 版本号失效：写路径 bump `cachever:user:{user_id}`，读 key 带版本号自动失效
// - fingerprint + hash：避免 Redis key 过长（把所有影响结果的 query 先拼串再 sha256）
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
    let is_cursor_pagination =
        query.cursor.is_some() || matches!(query.pagination.as_deref(), Some("cursor"));

    if state.config.cache_enabled
        && page == 1
        && !is_cursor_pagination
        && query.include_total.unwrap_or(true)
    {
        if let Some(pool) = &state.redis {
            // fingerprint 必须覆盖所有会影响结果的查询字段，否则可能返回“错误的缓存命中”。
            let fingerprint = format!(
            "page={:?}&limit={:?}&pagination={:?}&cursor={:?}&search={:?}&mime_type={:?}&category={:?}&folder_id={:?}&date_from={:?}&date_to={:?}&size_min={:?}&size_max={:?}&sort_by={:?}&sort_order={:?}&include_total={:?}",
            query.page,
            query.limit,
            query.pagination,
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
            if is_cursor_pagination {
                response["next_cursor"] = json!(next_cursor);
            } else {
                response["total"] = json!(total.unwrap_or(0));
                response["page"] = json!(page);
                response["limit"] = json!(limit);
            }

            if let Ok(mut conn) = pool.get().await {
                if let Ok(body) = serde_json::to_string(&response) {
                    // 仅缓存成功的 JSON 响应体；错误不缓存，避免把瞬时故障固化成“稳定失败”。
                    let _: Result<(), _> = cmd("SETEX")
                        .arg(&cache_key)
                        .arg(state.config.list_cache_ttl_secs)
                        .arg(body)
                        .query_async(&mut conn)
                        .await;
                }
            }

            return Ok(json_response(response));
        }
    }

    let (files, total, next_cursor) = state.file_service.list_files(user_id, query).await?;

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
