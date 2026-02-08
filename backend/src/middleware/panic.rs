//! Panic 捕获中间件
//!
//! 请求处理过程中发生 panic 时返回与 AppError 一致的 JSON 响应，不向用户暴露 panic 内容。

use axum::body::Body;
use axum::http::header;
use axum::response::Response;
use serde_json::json;
use tower_http::catch_panic::ResponseForPanic;

/// panic 时返回与 AppError 一致的 JSON 响应（不向用户暴露 panic 内容）
#[derive(Clone)]
pub struct JsonPanicHandler;

impl ResponseForPanic for JsonPanicHandler {
    type ResponseBody = Body;

    fn response_for_panic(
        &mut self,
        _err: Box<dyn std::any::Any + Send + 'static>,
    ) -> Response<Self::ResponseBody> {
        let error_id = uuid::Uuid::new_v4().to_string()[..8].to_string();
        tracing::error!(error_id = %error_id, "request panic caught");
        let body = json!({
            "message": "服务器内部错误，请稍后重试",
            "code": "INTERNAL_ERROR",
            "error_id": error_id,
            "timestamp": chrono::Utc::now().to_rfc3339(),
        });
        let body_bytes = serde_json::to_vec(&body).unwrap_or_default();
        Response::builder()
            .status(500)
            .header(header::CONTENT_TYPE, "application/json")
            .body(Body::from(body_bytes))
            .unwrap()
    }
}
