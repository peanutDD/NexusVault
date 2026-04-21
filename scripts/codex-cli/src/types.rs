use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Message {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Serialize)]
pub struct ChatRequest {
    pub model: String,
    pub messages: Vec<Message>,
    pub temperature: f32,
}

#[derive(Debug, Deserialize)]
pub struct ChatResponse {
    pub choices: Vec<Choice>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Choice {
    pub message: Message,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct ReviewIssue {
    pub file: String,
    pub line: Option<u32>,
    pub severity: String,
    pub description: String,
    pub suggestion: String,
    pub reason: Option<String>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct ReviewData {
    pub summary: String,
    pub issues: Vec<ReviewIssue>,
}

#[derive(Debug, Clone)]
pub struct ChangelogEntryInput {
    pub pr_number: u32,
    pub round: u8,
    pub unix_ts: u64,
    pub files: Vec<String>,
    pub security_passed: bool,
    pub quality_score: u8,
}

#[derive(Debug, Serialize)]
pub struct PrAutoFixOutput {
    pub fixed: bool,
    pub files: Vec<String>,
    pub quality_score: u8,
    pub security_passed: bool,
    pub summary: Option<String>,
}
