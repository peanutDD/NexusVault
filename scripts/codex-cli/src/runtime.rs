use crate::llm::CodexClient;
use crate::pipeline::Pipeline;
use crate::repo;
use crate::skills::{
    BatchFixSkill, DecisionSkill, DocumentationSkill, DryRunFeedbackSkill, FeedbackSkill,
    QualityScoreSkill, ReadReviewSkill, SecurityCheckSkill, SkillContext, SkillContextInit,
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
    let mut ctx = SkillContext::new(SkillContextInit {
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

    let pipeline = Pipeline::new()
        .with_skill(Box::new(ReadReviewSkill))
        .with_skill(Box::new(DecisionSkill))
        .with_skill(Box::new(BatchFixSkill))
        .with_skill(Box::new(SecurityCheckSkill))
        .with_skill(Box::new(QualityScoreSkill))
        .with_skill(Box::new(DocumentationSkill))
        .with_skill(Box::new(DryRunFeedbackSkill))
        .with_skill(Box::new(FeedbackSkill));

    pipeline.run(&mut ctx, client).await?;

    let summary = ctx.parsed_data.as_ref().map(|d| d.summary.clone());
    let mut files = ctx.fixed_files.clone();
    files.sort();
    files.dedup();

    let output = PrAutoFixOutput {
        fixed: !files.is_empty(),
        files,
        quality_score: ctx.quality_score,
        security_passed: ctx.security_passed,
        summary,
    };

    Ok(serde_json::to_string(&output)?)
}

pub async fn auto_fix_local(
    review_text: &str,
    max_rounds: u8,
    yes: bool,
    options: AutoFixOptions,
    client: &CodexClient,
) -> Result<String, Box<dyn std::error::Error>> {
    let rules_text = repo::read_rules(Some(&options.repo_root), options.rules_file.as_deref());
    let mut ctx = SkillContext::new(SkillContextInit {
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

    let pipeline = Pipeline::new()
        .with_skill(Box::new(ReadReviewSkill))
        .with_skill(Box::new(DecisionSkill))
        .with_skill(Box::new(BatchFixSkill))
        .with_skill(Box::new(SecurityCheckSkill))
        .with_skill(Box::new(QualityScoreSkill))
        .with_skill(Box::new(DocumentationSkill))
        .with_skill(Box::new(DryRunFeedbackSkill))
        .with_skill(Box::new(FeedbackSkill));

    pipeline.run(&mut ctx, client).await?;

    let summary = ctx.parsed_data.as_ref().map(|d| d.summary.clone());
    let mut files = ctx.fixed_files.clone();
    files.sort();
    files.dedup();

    let output = PrAutoFixOutput {
        fixed: !files.is_empty(),
        files,
        quality_score: ctx.quality_score,
        security_passed: ctx.security_passed,
        summary,
    };

    Ok(serde_json::to_string(&output)?)
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
