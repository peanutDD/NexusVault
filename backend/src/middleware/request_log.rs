//! 请求日志中间件
//!
//! 记录每个 HTTP 请求的 method、path、status、elapsed_ms，
//! 并注入 request_id（X-Request-ID）便于链路追踪与 error_id 关联。
//!
//! 通过 Tower 的 `RequestLogLayer` 挂载到 `middleware_stack`，避免 axum `route_layer(from_fn(...))`
//! 在带 state 路由上的 `Service<Request>` 类型不满足问题；Layer 与 Service 均实现 `Clone` 以符合栈要求。

use axum::http::{header, Request, Response};
use std::future::Future;
use std::pin::Pin;
use std::task::{Context, Poll};
use std::time::Instant;
use tower::{Layer, Service};

/// Tower 请求日志层：为每条请求打日志并回写 X-Request-ID。
#[derive(Clone, Default)]
pub struct RequestLogLayer;

impl<S> Layer<S> for RequestLogLayer {
    type Service = RequestLogService<S>;

    fn layer(&self, inner: S) -> Self::Service {
        RequestLogService { inner }
    }
}

/// 请求日志服务：包装内层 Service，在调用前后打 span 并写响应头。
#[derive(Clone)]
pub struct RequestLogService<S> {
    inner: S,
}

impl<S, ReqBody, ResBody> Service<Request<ReqBody>> for RequestLogService<S>
where
    S: Service<Request<ReqBody>, Response = Response<ResBody>> + Clone + Send + 'static,
    S::Future: Send,
    ReqBody: Send + 'static,
    ResBody: Send + 'static,
{
    type Response = Response<ResBody>;
    type Error = S::Error;
    type Future = Pin<Box<dyn std::future::Future<Output = Result<Self::Response, Self::Error>> + Send>>;

    fn poll_ready(&mut self, cx: &mut Context<'_>) -> Poll<Result<(), Self::Error>> {
        self.inner.poll_ready(cx)
    }

    fn call(&mut self, req: Request<ReqBody>) -> Self::Future {
        let method = req.method().clone();
        let path = req.uri().path().to_string();
        let request_id = req
            .headers()
            .get("x-request-id")
            .and_then(|v| v.to_str().ok())
            .map(|s| s.to_string())
            .filter(|s| s.len() <= 64)
            .unwrap_or_else(|| uuid::Uuid::new_v4().to_string()[..8].to_string());

        let _guard = tracing::info_span!("request", request_id = %request_id).entered();
        let start = Instant::now();

        let mut inner = self.inner.clone();
        let fut = inner.call(req);

        Box::pin(async move {
            let mut res = fut.await?;
            let elapsed = start.elapsed();

            tracing::info!(
                request_id = %request_id,
                method = %method,
                path = %path,
                status = %res.status(),
                elapsed_ms = elapsed.as_millis(),
                "request"
            );

            if let Ok(v) = header::HeaderValue::try_from(request_id.as_str()) {
                res.headers_mut()
                    .insert(header::HeaderName::from_static("x-request-id"), v);
            }
            Ok(res)
        })
    }
}
