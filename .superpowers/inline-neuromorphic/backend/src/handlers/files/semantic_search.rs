//! 语义搜索 API handlers
//!
//! 提供基于向量相似度的语义搜索功能，允许用户使用自然语言查询文件。

use axum::extract::{Query, State};
use axum::response::Response;
use serde::{Deserialize, Serialize};
use serde_json::json;
use uuid::Uuid;

use crate::extractors::auth::AuthenticatedUser;
use crate::utils::{json_response, AppError};
use crate::AppState;

/// 语义搜索查询参数
#[derive(Debug, Deserialize)]
pub struct SemanticSearchQuery {
    /// 查询文本（将转换为向量进行相似度搜索）
    pub q: String,
    /// 返回结果数量限制（默认 20）
    #[serde(default = "default_limit")]
    pub limit: usize,
    /// 相似度阈值（0-1，默认 0.5，低于此值的结果不返回）
    #[serde(default = "default_threshold")]
    pub threshold: f32,
}

fn default_limit() -> usize {
    20
}

fn default_threshold() -> f32 {
    0.5
}

/// 语义搜索响应
#[derive(Debug, Serialize)]
pub struct SemanticSearchResponse {
    /// 匹配的文件 ID 列表（按相似度降序）
    pub file_ids: Vec<Uuid>,
    /// 查询文本
    pub query: String,
    /// 返回结果数量
    pub count: usize,
}

/// 语义搜索 API
///
/// # 路径
/// `GET /api/files/search/semantic`
///
/// # 查询参数
/// - `q`（必需）：查询文本
/// - `limit`（可选，默认 20）：返回结果数量限制
/// - `threshold`（可选，默认 0.5）：相似度阈值（0-1）
///
/// # 响应示例
/// ```json
/// {
///   "file_ids": ["uuid1", "uuid2", ...],
///   "query": "项目计划文档",
///   "count": 5
/// }
/// ```
///
/// # 错误响应
/// - `400`：查询参数无效（如 `q` 为空）
/// - `503`：语义搜索功能未启用（未配置 Hugging Face API Token）
pub async fn semantic_search_handler(
    State(state): State<AppState>,
    AuthenticatedUser(user_id): AuthenticatedUser,
    Query(params): Query<SemanticSearchQuery>,
) -> Result<Response, AppError> {
    // 检查语义搜索功能是否启用
    let embedding_service = state.embedding_service.as_ref().ok_or_else(|| {
        AppError::File("语义搜索功能未启用，请配置 HUGGINGFACE_API_TOKEN 环境变量".to_string())
    })?;

    // 验证查询文本
    if params.q.trim().is_empty() {
        return Err(AppError::Validation("查询文本不能为空".to_string()));
    }

    // 验证阈值范围
    if params.threshold < 0.0 || params.threshold > 1.0 {
        return Err(AppError::Validation(
            "相似度阈值必须在 0.0 到 1.0 之间".to_string(),
        ));
    }

    // 验证 limit 范围
    if params.limit == 0 || params.limit > 100 {
        return Err(AppError::Validation(
            "结果数量限制必须在 1 到 100 之间".to_string(),
        ));
    }

    tracing::info!(
        user_id = %user_id,
        query = %params.q,
        limit = params.limit,
        threshold = params.threshold,
        "语义搜索请求"
    );

    // 1. 将查询文本转换为向量嵌入
    let query_embedding = embedding_service
        .generate_embedding(&params.q)
        .await
        .map_err(|e| {
            tracing::error!("Failed to generate query embedding: {}", e);
            AppError::File(format!("生成查询向量失败: {}", e))
        })?;

    // 2. 使用向量相似度搜索文件
    use crate::services::file::SemanticSearchService;
    let search_service = SemanticSearchService::new(state.pool.clone());
    let file_ids = search_service
        .search_files(
            user_id,
            &query_embedding,
            Some(params.limit),
            Some(params.threshold),
        )
        .await
        .map_err(|e| {
            tracing::error!("Semantic search failed: {}", e);
            AppError::File(format!("语义搜索失败: {}", e))
        })?;

    let result_count = file_ids.len();

    tracing::info!(
        user_id = %user_id,
        query = %params.q,
        result_count = result_count,
        "语义搜索完成"
    );

    // 3. 返回结果
    let response = SemanticSearchResponse {
        file_ids,
        query: params.q,
        count: result_count,
    };

    Ok(json_response(json!(response)))
}
