use crate::llm::CodexClient;
use crate::pipeline::Pipeline;
use crate::skills::{
    BatchFixSkill, DecisionSkill, DocumentationSkill, DryRunFeedbackSkill, FeedbackSkill,
    QualityScoreSkill, ReadReviewSkill, SecurityCheckSkill, SkillContext,
};
use crate::types::PrAutoFixOutput;
use std::env;

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
    let repo = env::var("GITHUB_REPOSITORY").unwrap_or_default();
    let mut ctx = SkillContext::new(pr_number, repo, gemini_review.to_string(), max_rounds, yes);

    // Pipeline 负责顺序编排；每个 Skill 只做一件事（解析/决策/修复/审计/入档/反馈）。
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

    // 统一输出结构，便于 workflow 稳定解析并进行后续动作（打标签、写输出、发通知等）。
    let output = PrAutoFixOutput {
        fixed: !files.is_empty(),
        files,
        quality_score: ctx.quality_score,
        security_passed: ctx.security_passed,
        summary,
    };

    Ok(serde_json::to_string(&output)?)
}
