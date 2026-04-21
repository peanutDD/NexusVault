use std::env;

pub fn codex_model() -> String {
    env::var("CODEX_MODEL").unwrap_or_else(|_| "gpt-4-turbo-preview".to_string())
}

pub fn openai_api_base() -> String {
    env::var("OPENAI_API_BASE").unwrap_or_else(|_| "https://api.openai.com/v1".to_string())
}
