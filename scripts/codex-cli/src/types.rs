use serde::{Deserialize, Serialize};
use std::collections::HashSet;

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
    #[serde(default)]
    pub constraints: Vec<String>,
    pub reason: Option<String>,
}

/// 从 Review 评论中解析出的结构化情报。
#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct ReviewData {
    pub summary: String,
    pub issues: Vec<ReviewIssue>,
}

/// Deterministic JSON produced from a standardized Markdown review.
#[derive(Debug, Deserialize, Serialize, Clone, PartialEq, Eq)]
pub struct StructuredReview {
    pub review_id: String,
    pub summary: String,
    pub issues: Vec<StructuredReviewIssue>,
}

/// Single actionable issue in the review JSON input.
#[derive(Debug, Deserialize, Serialize, Clone, PartialEq, Eq)]
pub struct StructuredReviewIssue {
    pub id: String,
    pub severity: String,
    pub file: String,
    pub line: u32,
    pub rule: String,
    pub problem: String,
    pub expected: String,
    pub constraints: Vec<String>,
    pub acceptance: Vec<String>,
}

pub fn review_severity_token(severity: &str) -> String {
    let compact = severity
        .chars()
        .filter_map(|c| {
            if c.is_ascii_alphanumeric() || c == '+' {
                Some(c.to_ascii_lowercase())
            } else {
                None
            }
        })
        .collect::<String>();

    compact
        .strip_suffix("priority")
        .unwrap_or(compact.as_str())
        .to_string()
}

pub fn is_review_severity_medium_or_higher(severity: &str) -> bool {
    matches!(
        review_severity_token(severity).as_str(),
        "critical" | "high" | "medium+" | "medium"
    )
}

pub fn review_severity_matches_allowed(severity: &str, allowed: &HashSet<String>) -> bool {
    let severity = review_severity_token(severity);
    allowed.contains(&severity) || (severity == "medium+" && allowed.contains("medium"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn medium_allowed_severity_includes_literal_medium_plus() {
        let allowed = HashSet::from(["medium".to_string()]);

        assert!(review_severity_matches_allowed("Medium", &allowed));
        assert!(review_severity_matches_allowed("Medium+", &allowed));
        assert!(!review_severity_matches_allowed("Low", &allowed));
    }

    #[test]
    fn priority_suffix_severities_are_actionable() {
        assert!(is_review_severity_medium_or_higher("medium priority"));
        assert!(is_review_severity_medium_or_higher("medium+ priority"));
        assert!(is_review_severity_medium_or_higher("high priority"));
        assert!(is_review_severity_medium_or_higher("critical priority"));
        assert!(!is_review_severity_medium_or_higher("low priority"));

        let allowed = HashSet::from(["medium".to_string(), "high".to_string()]);
        assert!(review_severity_matches_allowed("Medium Priority", &allowed));
        assert!(review_severity_matches_allowed(
            "Medium+ Priority",
            &allowed
        ));
        assert!(review_severity_matches_allowed("High Priority", &allowed));
        assert!(!review_severity_matches_allowed(
            "Critical Priority",
            &allowed
        ));
    }
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

/// `codex-auto-fix pr-auto-fix` 的机器可读输出（供 GitHub Actions 解析）。
///
/// 约定：stdout 只输出该 JSON（日志请走 stderr），避免破坏 workflow 里的 `jq` 解析。
#[derive(Debug, Serialize)]
pub struct PrAutoFixOutput {
    pub fixed: bool,
    pub files: Vec<String>,
    pub quality_score: u8,
    pub quality_score_available: bool,
    pub security_passed: bool,
    pub push_blocked: bool,
    pub has_pending: bool,
    pub pending_count: usize,
    pub review_clean: bool,
    pub apply_fail_reason: Option<String>,
    pub retry_count: usize,
    pub fallback_used: bool,
    pub final_status: String,
    pub summary: Option<String>,
    pub fixed_explanations: Vec<String>,
    pub pending_explanations: Vec<String>,
    pub issue_statuses: Vec<ReviewIssueStatus>,
}

/// One-to-one status for a Medium/Medium+/High/Critical review issue.
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
pub struct ReviewIssueStatus {
    pub severity: String,
    pub file: String,
    pub line: u32,
    pub description: String,
    pub status: String,
    pub explanation: String,
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
