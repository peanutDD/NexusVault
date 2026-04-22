use crate::config;
use crate::types::{ChatRequest, ChatResponse, Message};
use dotenvy::dotenv;
use std::env;

/// 负责与 OpenAI 兼容 Chat Completions API 通信的轻量客户端。
///
/// 设计要点：
/// - API Key 仅保存在内存字段中，不落盘、不打印
/// - base/model 从环境变量读取，便于在 GitHub Runner 与本地切换
pub struct CodexClient {
    api_key: String,
    api_base: String,
    client: reqwest::Client,
}

impl CodexClient {
    /// 初始化客户端。
    ///
    /// - 先尝试加载 `.env`（允许本地开发便捷配置）
    /// - 缺少 `OPENAI_API_KEY` 直接失败：这是硬依赖，避免“静默空跑”
    pub fn new() -> Result<Self, Box<dyn std::error::Error>> {
        dotenv().ok();
        let api_key = env::var("OPENAI_API_KEY").map_err(|_| "请在 .env 中设置 OPENAI_API_KEY")?;
        let api_base = config::openai_api_base();

        Ok(Self {
            api_key,
            api_base,
            client: reqwest::Client::new(),
        })
    }

    /// 执行一次对话调用并返回模型输出的文本。
    ///
    /// 约定：
    /// - 仅返回 `choices[0].message.content`
    /// - 非 2xx 响应会返回带 body 的错误，便于排障（但不包含密钥）
    pub async fn call(
        &self,
        system_prompt: &str,
        user_prompt: &str,
    ) -> Result<String, Box<dyn std::error::Error>> {
        let url = format!("{}/chat/completions", self.api_base);

        let request = ChatRequest {
            model: config::codex_model(),
            messages: vec![
                Message {
                    role: "system".to_string(),
                    content: system_prompt.to_string(),
                },
                Message {
                    role: "user".to_string(),
                    content: user_prompt.to_string(),
                },
            ],
            temperature: 0.2,
        };

        let response = self
            .client
            .post(&url)
            .header("Authorization", format!("Bearer {}", self.api_key))
            .json(&request)
            .send()
            .await?;

        if !response.status().is_success() {
            let err_text = response.text().await?;
            return Err(format!("API 请求失败: {}", err_text).into());
        }

        let body: ChatResponse = response.json().await?;
        Ok(body
            .choices
            .first()
            .ok_or("API 响应缺少 choices[0]")?
            .message
            .content
            .clone())
    }
}
