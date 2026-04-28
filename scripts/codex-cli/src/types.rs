use serde::{Deserialize, Serialize};

/// OpenAI 兼容 Chat Completions API 的 message 格式。
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Message {
    pub role: String,
    pub content: String,
}

/// OpenAI 兼容 Chat Completions API 请求体（仅保留本项目需要的字段）。
#[derive(Debug, Serialize)]
pub struct ChatRequest {
    pub model: String,
    pub messages: Vec<Message>,
    pub temperature: f32,
}

/// OpenAI 兼容 Chat Completions API 响应体（仅保留本项目需要的字段）。
#[derive(Debug, Deserialize)]
pub struct ChatResponse {
    pub choices: Vec<Choice>,
}

/// 单个候选回复。
#[derive(Debug, Serialize, Deserialize)]
pub struct Choice {
    pub message: Message,
}

/// 从 Gemini Review 中抽取的单条问题。
///
/// 注意：`reason` 用于溯源（保留 Gemini 原文片段），便于在 PR 评论里做可追溯展示。
#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct ReviewIssue {
    pub file: String,
    pub line: Option<u32>,
    pub severity: String,
    pub description: String,
    pub suggestion: String,
    pub reason: Option<String>,
}

/// 从 Review 评论中解析出的结构化情报。
#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct ReviewData {
    pub summary: String,
    pub issues: Vec<ReviewIssue>,
}

/// 写入 `docs/CHANGELOG.md` 的条目输入（由 Pipeline 在运行期聚合）。
#[derive(Debug, Clone)]
pub struct ChangelogEntryInput {
    pub pr_number: u32,
    pub round: u8,
    pub unix_ts: u64,
    pub files: Vec<String>,
    pub security_passed: bool,
    pub quality_score: u8,
}

/// `codex pr-auto-fix` 的机器可读输出（供 GitHub Actions 解析）。
///
/// 约定：stdout 只输出该 JSON（日志请走 stderr），避免破坏 workflow 里的 `jq` 解析。
#[derive(Debug, Serialize)]
pub struct PrAutoFixOutput {
    pub fixed: bool,
    pub files: Vec<String>,
    pub quality_score: u8,
    pub security_passed: bool,
    pub summary: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
pub struct SkillPackSkillMeta {
    pub id: String,
    pub name: Option<String>,
    pub description: Option<String>,
    pub version: Option<String>,
    pub skill_md_path: String,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
pub struct SkillPackResolvedSkill {
    pub meta: SkillPackSkillMeta,
    pub body: String,
}
