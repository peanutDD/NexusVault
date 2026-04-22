use std::env;

/// Codex 使用的模型名。
///
/// 约定：
/// - CI/Runner 环境通过 `CODEX_MODEL` 指定
/// - 本地未设置时给出可用默认值，避免“空模型名”导致 API 请求失败
pub fn codex_model() -> String {
    env::var("CODEX_MODEL").unwrap_or_else(|_| "gpt-4-turbo-preview".to_string())
}

/// OpenAI 兼容 API Base URL。
///
/// 支持自定义网关/代理（例如内网转发），未设置时使用官方默认。
pub fn openai_api_base() -> String {
    env::var("OPENAI_API_BASE").unwrap_or_else(|_| "https://api.openai.com/v1".to_string())
}
