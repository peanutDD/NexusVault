//! # Metrics 中间件
//!
//! 提供 Prometheus 格式的应用指标。

use axum::extract::{Request, State};
use axum::middleware::Next;
use axum::response::Response;
use metrics::{counter, gauge, histogram};
use std::time::Instant;

use crate::AppState;

/// 初始化 Prometheus metrics exporter
///
/// 返回一个可以挂载的 metrics 端点处理器；安装失败时返回错误，由调用方统一处理。
pub fn init_metrics() -> Result<impl Fn() -> String + Clone, metrics_exporter_prometheus::BuildError>
{
    let builder = metrics_exporter_prometheus::PrometheusBuilder::new();
    let handle = builder.install_recorder()?;
    Ok(move || handle.render())
}

/// HTTP 请求 metrics 中间件
///
/// 记录以下指标：
/// - `http_requests_total`: HTTP 请求总数（按方法、路径、状态码分组）
/// - `http_request_duration_seconds`: HTTP 请求延迟直方图
/// - `http_requests_in_flight`: 当前正在处理的请求数
pub async fn metrics_middleware(State(_): State<AppState>, req: Request, next: Next) -> Response {
    let method = req.method().to_string();
    let path = req.uri().path().to_string();

    // 简化路径（移除动态参数）
    let path_pattern = simplify_path(&path);

    // 记录 in-flight 请求
    gauge!("http_requests_in_flight").increment(1.0);

    let start = Instant::now();
    let response = next.run(req).await;
    let duration = start.elapsed();

    // 减少 in-flight 请求
    gauge!("http_requests_in_flight").decrement(1.0);

    let status = response.status().as_u16().to_string();
    let status_class = match response.status().as_u16() {
        200..=299 => "2xx",
        300..=399 => "3xx",
        400..=499 => "4xx",
        500..=599 => "5xx",
        _ => "other",
    };

    // 记录请求计数
    counter!(
        "http_requests_total",
        "method" => method.clone(),
        "path" => path_pattern.clone(),
        "status" => status,
        "status_class" => status_class
    )
    .increment(1);

    // 记录请求延迟
    histogram!(
        "http_request_duration_seconds",
        "method" => method,
        "path" => path_pattern
    )
    .record(duration.as_secs_f64());

    response
}

/// 简化路径，将动态参数替换为占位符
///
/// 例如：/api/v1/files/123e4567-e89b-12d3-a456-426614174000 -> /api/v1/files/:id
fn simplify_path(path: &str) -> String {
    let parts: Vec<&str> = path.split('/').collect();
    let simplified: Vec<String> = parts
        .iter()
        .map(|part| {
            // UUID 模式
            if (part.len() == 36 && part.chars().filter(|c| *c == '-').count() == 4)
                || (part.chars().all(|c| c.is_ascii_digit()) && !part.is_empty())
            {
                ":id".to_string()
            } else {
                part.to_string()
            }
        })
        .collect();
    simplified.join("/")
}

/// 记录数据库查询指标。
///
/// 当前项目尚未在具体 Handler / Service 中显式调用该函数，预留给
/// 「接入 Prometheus / Grafana 等完整监控体系」时使用。
/// 当你需要对单条 SQL 的耗时与成功率打点时，可在相应位置调用。
#[allow(dead_code)]
pub fn record_db_query(operation: &str, table: &str, duration_ms: u64, success: bool) {
    let status = if success { "success" } else { "error" };

    counter!(
        "db_queries_total",
        "operation" => operation.to_string(),
        "table" => table.to_string(),
        "status" => status
    )
    .increment(1);

    histogram!(
        "db_query_duration_seconds",
        "operation" => operation.to_string(),
        "table" => table.to_string()
    )
    .record(duration_ms as f64 / 1000.0);
}

/// 记录文件操作指标。
///
/// 当前未在上传/下载逻辑中显式调用，预留给「统计文件操作 QPS /
/// 平均大小」等监控需求。未来接入统一 metrics 中间件后，可以在
/// 文件 Service 中按操作类型调用。
#[allow(dead_code)]
pub fn record_file_operation(operation: &str, size_bytes: u64, success: bool) {
    let status = if success { "success" } else { "error" };

    counter!(
        "file_operations_total",
        "operation" => operation.to_string(),
        "status" => status
    )
    .increment(1);

    if success && size_bytes > 0 {
        histogram!(
            "file_operation_size_bytes",
            "operation" => operation.to_string()
        )
        .record(size_bytes as f64);
    }
}

/// 记录认证指标。
///
/// 目前认证流程只通过日志追踪，不上报指标；当你需要在监控系统中
/// 查看登录/注册的成功率与错误率曲线时，可在 auth Handler 中
/// 调用该函数。
#[allow(dead_code)]
pub fn record_auth_attempt(method: &str, success: bool) {
    let status = if success { "success" } else { "failure" };

    counter!(
        "auth_attempts_total",
        "method" => method.to_string(),
        "status" => status
    )
    .increment(1);
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_simplify_path() {
        assert_eq!(
            simplify_path("/api/v1/files/123e4567-e89b-12d3-a456-426614174000"),
            "/api/v1/files/:id"
        );
        assert_eq!(simplify_path("/api/v1/users/123"), "/api/v1/users/:id");
        assert_eq!(simplify_path("/health"), "/health");
    }
}
