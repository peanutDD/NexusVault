use opentelemetry::global;
use opentelemetry::trace::TracerProvider as _;
use opentelemetry::KeyValue;
use opentelemetry_otlp::{SpanExporter, WithExportConfig};
use opentelemetry_semantic_conventions as semconv;
use opentelemetry_sdk::propagation::TraceContextPropagator;
use opentelemetry_sdk::runtime::Tokio;
use opentelemetry_sdk::trace::{self as sdktrace, TracerProvider};
use opentelemetry_sdk::Resource;
use tracing_subscriber::fmt::format::FmtSpan;
use tracing_subscriber::layer::SubscriberExt;
use tracing_subscriber::util::SubscriberInitExt;
use tracing_subscriber::EnvFilter;

/// 初始化 OpenTelemetry 分布式追踪系统。
///
/// 支持以下环境变量配置：
/// - `OTEL_EXPORTER_OTLP_ENDPOINT`: OTLP gRPC 端点（默认: http://localhost:4317）
/// - `OTEL_SERVICE_NAME`: 服务名称（默认: file-storage-backend）
/// - `OTEL_TRACES_SAMPLER`: 采样策略（always_on/always_off/parentbased_traceidbased，默认: parentbased_traceidbased）
/// - `OTEL_TRACES_SAMPLER_ARG`: 采样率（0.0-1.0，默认: 0.1）
pub fn init_tracing() {
    let service_name = std::env::var("OTEL_SERVICE_NAME")
        .unwrap_or_else(|_| "file-storage-backend".to_string());

    // 构建资源（服务名称 + 版本 + OS 信息）
    let resource = Resource::new(vec![
        KeyValue::new(semconv::resource::SERVICE_NAME, service_name.clone()),
        KeyValue::new("service.version", env!("CARGO_PKG_VERSION")),
        KeyValue::new("os.name", std::env::consts::OS),
        KeyValue::new("os.version", std::env::consts::ARCH),
    ]);

    // 读取采样配置
    let sampler = match std::env::var("OTEL_TRACES_SAMPLER").as_deref() {
        Ok("always_on") => sdktrace::Sampler::AlwaysOn,
        Ok("always_off") => sdktrace::Sampler::AlwaysOff,
        Ok("parentbased_always_on") => sdktrace::Sampler::ParentBased(Box::new(sdktrace::Sampler::AlwaysOn)),
        Ok("parentbased_always_off") => sdktrace::Sampler::ParentBased(Box::new(sdktrace::Sampler::AlwaysOff)),
        Ok("parentbased_traceidbased") => {
            let rate: f64 = std::env::var("OTEL_TRACES_SAMPLER_ARG")
                .ok()
                .and_then(|s| s.parse().ok())
                .unwrap_or(0.1);
            sdktrace::Sampler::ParentBased(Box::new(sdktrace::Sampler::TraceIdRatioBased(rate)))
        }
        _ => {
            // 如果没配置且环境不可用，默认关闭以减少报错
            if std::env::var("OTEL_EXPORTER_OTLP_ENDPOINT").is_err() {
                sdktrace::Sampler::AlwaysOff
            } else {
                sdktrace::Sampler::ParentBased(Box::new(sdktrace::Sampler::TraceIdRatioBased(0.1)))
            }
        }
    };

    // 构建 OTLP 导出器
    let otlp_endpoint = std::env::var("OTEL_EXPORTER_OTLP_ENDPOINT")
        .unwrap_or_else(|_| "http://localhost:4317".to_string());

    let exporter = SpanExporter::builder()
        .with_tonic()
        .with_endpoint(otlp_endpoint.clone())
        .with_timeout(std::time::Duration::from_secs(2));

    let exporter = match exporter.build() {
        Ok(exp) => exp,
        Err(e) => {
            tracing::warn!(error = %e, "Failed to build OTLP span exporter, tracing will be disabled");
            return;
        }
    };

    let provider = TracerProvider::builder()
        .with_batch_exporter(exporter, Tokio)
        .with_resource(resource)
        .with_sampler(sampler.clone())
        .build();

    global::set_tracer_provider(provider.clone());
    let tracer = provider.tracer("file-storage-backend");

    // 设置全局 TraceContextPropagator（W3C Trace Context）
    global::set_text_map_propagator(TraceContextPropagator::new());

    // 构建 tracing 层
    let telemetry = tracing_opentelemetry::layer().with_tracer(tracer);

    let env_filter = EnvFilter::try_from_default_env().unwrap_or_else(|_| {
        EnvFilter::new("file_storage_backend=debug,axum=info,opentelemetry=info,tonic=info")
    });

    let fmt_layer = tracing_subscriber::fmt::layer()
        .with_span_events(FmtSpan::CLOSE)
        .with_thread_names(true)
        .with_line_number(true)
        .with_file(true);

    // 注册所有层
    tracing_subscriber::registry()
        .with(env_filter)
        .with(fmt_layer)
        .with(telemetry)
        .init();

    tracing::info!(
        service.name = %service_name,
        otel.endpoint = %otlp_endpoint,
        sampler = ?sampler,
        "OpenTelemetry tracing initialized"
    );
}

/// 获取当前 Tracer 实例（用于手动创建 Span）
pub fn get_tracer() -> global::BoxedTracer {
    global::tracer_provider().tracer("file-storage-backend")
}
