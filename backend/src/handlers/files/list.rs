use axum::extract::{Query, State};
use axum::response::Response;
use serde_json::json;

use crate::extractors::AuthenticatedUser;
use crate::models::file::FileListQuery;
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
