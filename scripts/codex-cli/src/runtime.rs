use crate::llm::CodexClient;
use crate::pipeline::Pipeline;
use crate::repo;
use crate::skills::{
    BatchFixSkill, DecisionSkill, DocumentationSkill, DryRunFeedbackSkill, FeedbackSkill,
    QualityScoreSkill, ReadReviewSkill, SecurityCheckSkill, SkillContext, SkillContextInit,
    review_issue_key,
};
use crate::types::PrAutoFixOutput;
use std::env;

#[derive(Debug, Clone)]
pub struct AutoFixOptions {
    pub repo_root: String,
    pub rules_file: Option<String>,
    pub changelog_path: Option<String>,
    pub disable_changelog: bool,
    pub enable_pr_comments: bool,
}

/// GitHub Actions 的主入口：对指定 PR 的 Gemini Review 进行解析并尝试自动修复。
///
/// 输出约定：
/// - 返回值为 JSON 字符串（供 workflow 用 `jq` 解析）
/// - 运行过程中的日志应由各 Skill 输出到 stderr，避免污染 JSON
pub async fn pr_auto_fix(
    pr_number: u32,
    gemini_review: &str,
    max_rounds: u8,
    yes: bool,
    client: &CodexClient,
) -> Result<String, Box<dyn std::error::Error>> {
    let repo_root = env::var("GITHUB_WORKSPACE")
        .ok()
        .or_else(|| repo::git_repo_root().ok())
        .unwrap_or_else(|| ".".to_string());
    let options = AutoFixOptions {
        repo_root,
        rules_file: None,
        changelog_path: None,
        disable_changelog: false,
        enable_pr_comments: true,
    };
    pr_auto_fix_with_options(pr_number, gemini_review, max_rounds, yes, options, client).await
}

pub async fn pr_auto_fix_with_options(
    pr_number: u32,
    gemini_review: &str,
    max_rounds: u8,
    yes: bool,
    options: AutoFixOptions,
    client: &CodexClient,
) -> Result<String, Box<dyn std::error::Error>> {
    let repo_name = env::var("GITHUB_REPOSITORY").unwrap_or_default();
    let rules_text = repo::read_rules(Some(&options.repo_root), options.rules_file.as_deref());
    let ctx = SkillContext::new(SkillContextInit {
        pr_number,
        repo: repo_name,
        repo_root: options.repo_root,
        rules_text,
        raw_input: gemini_review.to_string(),
        rounds: max_rounds,
        auto_push: yes,
        enable_pr_comments: options.enable_pr_comments,
        changelog_path: options.changelog_path,
        disable_changelog: options.disable_changelog,
    });
    run_auto_fix_loop(ctx, client).await
}

pub async fn auto_fix_local(
    review_text: &str,
    max_rounds: u8,
    yes: bool,
    options: AutoFixOptions,
    client: &CodexClient,
) -> Result<String, Box<dyn std::error::Error>> {
    let rules_text = repo::read_rules(Some(&options.repo_root), options.rules_file.as_deref());
    let ctx = SkillContext::new(SkillContextInit {
        pr_number: 0,
        repo: String::new(),
        repo_root: options.repo_root,
        rules_text,
        raw_input: review_text.to_string(),
        rounds: max_rounds,
        auto_push: yes,
        enable_pr_comments: options.enable_pr_comments,
        changelog_path: options.changelog_path,
        disable_changelog: options.disable_changelog,
    });
    run_auto_fix_loop(ctx, client).await
}

async fn run_auto_fix_loop(
    mut ctx: SkillContext,
    client: &CodexClient,
) -> Result<String, Box<dyn std::error::Error>> {
    let round_pipeline = Pipeline::new()
        .with_skill(Box::new(ReadReviewSkill))
        .with_skill(Box::new(DecisionSkill))
        .with_skill(Box::new(BatchFixSkill))
        .with_skill(Box::new(SecurityCheckSkill))
        .with_skill(Box::new(QualityScoreSkill))
        .with_skill(Box::new(DocumentationSkill));

    ctx.current_round = 1;
    if ctx.max_rounds > 1 {
        eprintln!(
            "🔁 [AutoFix] 单次处理当前 Gemini Review；外层 PR 标签负责最多 {} 轮 Review",
            ctx.max_rounds
        );
    }
    round_pipeline.run(&mut ctx, client).await?;

    enforce_review_policy(&mut ctx);

    let feedback_pipeline = Pipeline::new()
        .with_skill(Box::new(DryRunFeedbackSkill))
        .with_skill(Box::new(FeedbackSkill));
    feedback_pipeline.run(&mut ctx, client).await?;

    let summary = ctx.parsed_data.as_ref().map(|d| d.summary.clone());
    let mut files = ctx.fixed_files.clone();
    files.sort();
    files.dedup();

    let output = PrAutoFixOutput {
        fixed: if ctx.auto_push {
            !files.is_empty() && !ctx.push_blocked
        } else {
            !files.is_empty()
        },
        files,
        quality_score: ctx.quality_score,
        quality_score_available: ctx.quality_score_available,
        security_passed: ctx.security_passed,
        push_blocked: ctx.push_blocked,
        summary,
        pending_explanations: ctx.pending_explanations,
    };

    Ok(serde_json::to_string(&output)?)
}

pub(crate) fn enforce_review_policy(ctx: &mut SkillContext) {
    ctx.pending_explanations.clear();
    let fixed: std::collections::HashSet<String> = ctx
        .fix_attempts
        .iter()
        .filter(|a| a.success)
        .map(|a| a.issue_key.clone())
        .chain(ctx.fixed_issue_keys.iter().cloned())
        .collect();
    let selected: std::collections::HashSet<String> =
        ctx.selected_issues.iter().map(review_issue_key).collect();

    let Some(data) = &ctx.parsed_data else {
        return;
    };

    for issue in data
        .issues
        .iter()
        .filter(|i| is_medium_or_above(&i.severity))
    {
        let issue_key = review_issue_key(issue);
        if fixed.contains(&issue_key) {
            continue;
        }

        let latest_attempt = ctx
            .fix_attempts
            .iter()
            .rev()
            .find(|a| a.issue_key == issue_key && !a.success)
            .and_then(|a| a.reason.as_deref());
        let reason = latest_attempt.unwrap_or_else(|| {
            if selected.contains(&issue_key) {
                "未产生可应用补丁"
            } else {
                "策略过滤或受保护路径，未自动修复"
            }
        });
        ctx.pending_explanations.push(format!(
            "[{}] `{}`:{} 未自动修复：{}",
            issue.severity,
            issue.file,
            issue.line.unwrap_or(0),
            reason
        ));
    }

    if !ctx.pending_explanations.is_empty() && !ctx.enable_pr_comments {
        eprintln!(
            "⚠️ 存在未发布到 PR 的未修复说明: {} 条",
            ctx.pending_explanations.len()
        );
    }
}

fn is_medium_or_above(severity: &str) -> bool {
    matches!(severity, "Critical" | "High" | "Medium")
}

pub async fn run_skill_pack_skill(
    plugin_root: &str,
    skill: &str,
    input: &str,
    client: &CodexClient,
) -> Result<String, Box<dyn std::error::Error>> {
    let agents_rules = repo::read_skill_pack_agents_rules(plugin_root);
    let resolved = repo::resolve_skill_pack_skill(plugin_root, skill)?;

    let skill_body = resolved
        .body
        .replace("${CLAUDE_PLUGIN_ROOT}", plugin_root)
        .trim()
        .to_string();
    let skill_name = resolved
        .meta
        .name
        .as_deref()
        .unwrap_or(resolved.meta.id.as_str());

    let system_prompt = format!(
        "你是一个可执行 Skill Pack 的资深软件工程师。\n\n\
必须严格遵守以下 AGENTS.md 规则：\n\n{}\n\n\
现在执行 Skill：{}\n\
Skill Id：{}\n\n\
Skill 指令如下（来自 SKILL.md）：\n\n{}\n",
        agents_rules, skill_name, resolved.meta.id, skill_body
    );
    let user_prompt = input;
    client.call(&system_prompt, user_prompt).await
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::skills::{FixAttempt, SkillContextInit};
    use crate::types::{ReviewData, ReviewIssue};

    fn test_ctx() -> SkillContext {
        SkillContext::new(SkillContextInit {
            pr_number: 1,
            repo: "owner/repo".to_string(),
            repo_root: ".".to_string(),
            rules_text: "rules".to_string(),
            raw_input: "review".to_string(),
            rounds: 2,
            auto_push: false,
            enable_pr_comments: false,
            changelog_path: None,
            disable_changelog: true,
        })
    }

    #[test]
    fn enforce_review_policy_records_pending_explanations_when_comments_disabled() {
        let mut ctx = test_ctx();
        ctx.parsed_data = Some(ReviewData {
            summary: "summary".to_string(),
            issues: vec![ReviewIssue {
                file: "src/a.rs".to_string(),
                line: Some(10),
                severity: "Medium".to_string(),
                description: "bug".to_string(),
                suggestion: "fix".to_string(),
                reason: Some("review text".to_string()),
            }],
        });
        ctx.fix_attempts.push(FixAttempt {
            round: 1,
            issue_key: "src/a.rs:10:Medium:bug".to_string(),
            file: "src/a.rs".to_string(),
            stage: "patch_generation".to_string(),
            success: false,
            reason: Some("empty patch".to_string()),
        });

        enforce_review_policy(&mut ctx);

        assert_eq!(ctx.pending_explanations.len(), 1);
        assert!(ctx.pending_explanations[0].contains("empty patch"));
    }

    #[test]
    fn enforce_review_policy_tracks_same_file_issues_independently() {
        let mut ctx = test_ctx();
        ctx.parsed_data = Some(ReviewData {
            summary: "summary".to_string(),
            issues: vec![
                ReviewIssue {
                    file: "src/a.rs".to_string(),
                    line: Some(10),
                    severity: "Medium".to_string(),
                    description: "first".to_string(),
                    suggestion: "fix".to_string(),
                    reason: None,
                },
                ReviewIssue {
                    file: "src/a.rs".to_string(),
                    line: Some(20),
                    severity: "Medium".to_string(),
                    description: "second".to_string(),
                    suggestion: "fix".to_string(),
                    reason: None,
                },
            ],
        });
        ctx.fix_attempts.push(FixAttempt {
            round: 1,
            issue_key: "src/a.rs:10:Medium:first".to_string(),
            file: "src/a.rs".to_string(),
            stage: "patch_apply".to_string(),
            success: true,
            reason: None,
        });
        ctx.fix_attempts.push(FixAttempt {
            round: 1,
            issue_key: "src/a.rs:20:Medium:second".to_string(),
            file: "src/a.rs".to_string(),
            stage: "patch_generation".to_string(),
            success: false,
            reason: Some("empty patch".to_string()),
        });

        enforce_review_policy(&mut ctx);

        assert_eq!(ctx.pending_explanations.len(), 1);
        assert!(ctx.pending_explanations[0].contains("`:20"));
        assert!(ctx.pending_explanations[0].contains("empty patch"));
    }
}
