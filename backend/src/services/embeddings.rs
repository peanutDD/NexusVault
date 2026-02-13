//! 语义搜索嵌入服务
//!
//! 使用 Hugging Face Inference API 生成文本向量嵌入，用于语义搜索。

use serde::{Deserialize, Serialize};
use std::sync::Arc;

use crate::config::Config;
use crate::utils::AppError;

/// Hugging Face Inference API 请求体
#[derive(Debug, Serialize)]
struct EmbeddingRequest {
    inputs: String,
}

/// Hugging Face Inference API 响应体
#[derive(Debug, Deserialize)]
struct EmbeddingResponse {
    #[serde(default)]
    embeddings: Vec<Vec<f32>>,
    #[serde(default)]
    error: Option<String>,
}

/// 嵌入服务
pub struct EmbeddingService {
    client: reqwest::Client,
    api_url: String,
    model_id: String,
    api_token: Option<String>,
}

impl EmbeddingService {
    pub fn new(config: &Config) -> Self {
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(30))
            .build()
            .expect("Failed to create HTTP client");

        Self {
            client,
            api_url: config.huggingface_api_url.clone(),
            model_id: config.huggingface_model_id.clone(),
            api_token: config.huggingface_api_token.clone(),
        }
    }

    /// 生成文本的向量嵌入
    ///
    /// # 参数
    /// - `text`: 要生成嵌入的文本（如文件名+内容）
    ///
    /// # 返回
    /// - `Ok(Vec<f32>)`: 384 维向量（all-MiniLM-L6-v2 模型）
    /// - `Err(AppError)`: 生成失败
    pub async fn generate_embedding(&self, text: &str) -> Result<Vec<f32>, AppError> {
        if text.trim().is_empty() {
            return Err(AppError::Validation("文本不能为空".to_string()));
        }

        let url = format!(
            "{}/pipeline/feature-extraction/{}",
            self.api_url, self.model_id
        );

        let mut request = self.client.post(&url).json(&EmbeddingRequest {
            inputs: text.to_string(),
        });

        // 如果提供了 API Token，添加到请求头
        if let Some(token) = &self.api_token {
            request = request.header("Authorization", format!("Bearer {}", token));
        }

        let response = request.send().await.map_err(|e| {
            tracing::error!("Hugging Face API request failed: {}", e);
            AppError::File(format!("嵌入生成失败: {}", e))
        })?;

        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_default();
            tracing::error!(
                "Hugging Face API error: status={}, body={}",
                status,
                error_text
            );
            return Err(AppError::File(format!("嵌入生成失败: HTTP {}", status)));
        }

        // 解析响应：Hugging Face API 返回的是二维数组 [[f32, f32, ...]]
        let embeddings: Vec<Vec<f32>> = response.json().await.map_err(|e| {
            tracing::error!("Failed to parse Hugging Face API response: {}", e);
            AppError::File("嵌入响应解析失败".to_string())
        })?;

        // 取第一个向量（如果输入是单个文本，返回的是 [[...]]）
        embeddings
            .into_iter()
            .next()
            .ok_or_else(|| AppError::File("嵌入响应为空".to_string()))
    }

    /// 批量生成向量嵌入（用于批量更新现有文件）
    ///
    /// # 参数
    /// - `texts`: 文本列表
    ///
    /// # 返回
    /// - `Ok(Vec<Vec<f32>>)`: 每个文本对应的向量列表
    pub async fn generate_embeddings_batch(
        &self,
        texts: &[String],
    ) -> Result<Vec<Vec<f32>>, AppError> {
        if texts.is_empty() {
            return Ok(Vec::new());
        }

        let url = format!(
            "{}/pipeline/feature-extraction/{}",
            self.api_url, self.model_id
        );

        let mut request = self.client.post(&url).json(&serde_json::json!({
            "inputs": texts
        }));

        if let Some(token) = &self.api_token {
            request = request.header("Authorization", format!("Bearer {}", token));
        }

        let response = request.send().await.map_err(|e| {
            tracing::error!("Hugging Face API batch request failed: {}", e);
            AppError::File(format!("批量嵌入生成失败: {}", e))
        })?;

        if !response.status().is_success() {
            let status = response.status();
            let error_text = response.text().await.unwrap_or_default();
            tracing::error!(
                "Hugging Face API batch error: status={}, body={}",
                status,
                error_text
            );
            return Err(AppError::File(format!("批量嵌入生成失败: HTTP {}", status)));
        }

        let embeddings: Vec<Vec<f32>> = response.json().await.map_err(|e| {
            tracing::error!("Failed to parse Hugging Face API batch response: {}", e);
            AppError::File("批量嵌入响应解析失败".to_string())
        })?;

        Ok(embeddings)
    }
}
