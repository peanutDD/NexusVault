//! # OpenAPI 文档配置
//!
//! 使用 utoipa 生成 OpenAPI 3.0 规范文档。

use utoipa::OpenApi;

/// 错误响应结构
#[derive(utoipa::ToSchema, serde::Serialize)]
pub struct ErrorResponse {
    /// 错误消息
    pub message: String,
    /// 错误码
    pub code: String,
    /// 错误 ID（用于追踪）
    pub error_id: String,
    /// 时间戳
    pub timestamp: String,
}

/// API 文档定义
#[derive(OpenApi)]
#[openapi(
    paths(
        crate::handlers::health::readiness_check,
        crate::handlers::health::liveness_check,
    ),
    info(
        title = "File Storage Backend API",
        version = "1.0.0",
        description = "文件存储后端服务 API 文档\n\n## 认证\n\n所有需要认证的接口需要在请求头中携带 `Authorization: Bearer <token>`",
        contact(
            name = "API Support",
            email = "support@example.com"
        ),
        license(
            name = "MIT"
        )
    ),
    servers(
        (url = "/api/v1", description = "API v1")
    ),
    tags(
        (name = "auth", description = "用户认证相关接口"),
        (name = "files", description = "文件管理相关接口"),
        (name = "folders", description = "文件夹管理相关接口"),
        (name = "shares", description = "文件分享相关接口"),
        (name = "tokens", description = "API Token 管理接口"),
        (name = "health", description = "健康检查与监控接口")
    ),
    components(
        schemas(ErrorResponse)
    )
)]
pub struct ApiDoc;

/// 创建 OpenAPI 路由
///
/// 返回泛型状态的 Swagger UI 路由，可与任意 `Router<S>` 合并。
pub fn create_openapi_router<S>() -> axum::Router<S>
where
    S: Clone + Send + Sync + 'static,
{
    use utoipa_swagger_ui::SwaggerUi;

    axum::Router::new()
        .merge(SwaggerUi::new("/swagger-ui").url("/api-docs/openapi.json", ApiDoc::openapi()))
}
