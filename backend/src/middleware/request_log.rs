//! 请求日志中间件
//!
//! 记录每个 HTTP 请求的 `trace_id`、`user_id`、`method`、`path`、`status`、`latency_ms`，
//! 并注入 `X-Trace-Id` / `X-Request-Id` 便于前后端链路追踪与告警关联。
//!
//! 通过 Tower 的 `RequestLogLayer` 挂载到 `middleware_stack`，避免 axum `route_layer(from_fn(...))`
//! 在带 state 路由上的 `Service<Request>` 类型不满足问题；Layer 与 Service 均实现 `Clone` 以符合栈要求。

use axum::http::{header, Request, Response};
use std::pin::Pin;
use std::task::{Context, Poll};
use std::time::Instant;
use tower::{Layer, Service};

/// Tower 请求日志层：为每条请求打日志并回写 X-Trace-Id / X-Request-Id。
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
        let headers = req.headers();

        // 优先复用上游传入的 trace_id（支持 X-Trace-Id / X-Request-Id），否则本地生成 UUID。
        let trace_id = headers
            .get("x-trace-id")
            .or_else(|| headers.get("x-request-id"))
            .and_then(|v| v.to_str().ok())
            .map(|s| s.to_string())
            .filter(|s| s.len() <= 64)
            .unwrap_or_else(|| uuid::Uuid::new_v4().to_string());

        // 从上游注入的 X-User-Id 读取用户标识（由网关或上游服务负责注入），否则为 "-"
        let user_id = headers
            .get("x-user-id")
            .and_then(|v| v.to_str().ok())
            .map(|s| s.to_string())
            .unwrap_or_else(|| "-".to_string());

        let _guard = tracing::info_span!("request", trace_id = %trace_id, user_id = %user_id).entered();
        let start = Instant::now();

        let mut inner = self.inner.clone();
        let fut = inner.call(req);

        Box::pin(async move {
            let mut res = fut.await?;
            let elapsed = start.elapsed();
            let latency_ms = elapsed.as_millis() as u64;

            tracing::info!(
                trace_id = %trace_id,
                user_id = %user_id,
                method = %method,
                path = %path,
                status = %res.status(),
                latency_ms = latency_ms,
                "request"
            );

            if let Ok(trace_val) = header::HeaderValue::try_from(trace_id.as_str()) {
                let headers = res.headers_mut();
                headers.insert(
                    header::HeaderName::from_static("x-trace-id"),
                    trace_val.clone(),
                );
                // 兼容旧客户端：继续写入 X-Request-Id
                headers.insert(
                    header::HeaderName::from_static("x-request-id"),
                    trace_val,
                );
            }
            Ok(res)
        })
    }
}
