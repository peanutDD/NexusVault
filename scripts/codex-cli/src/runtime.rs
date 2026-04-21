use crate::llm::CodexClient;
use crate::pipeline::Pipeline;
use crate::skills::{
    BatchFixSkill, DecisionSkill, DocumentationSkill, DryRunFeedbackSkill, FeedbackSkill,
    QualityScoreSkill, ReadReviewSkill, SecurityCheckSkill, SkillContext,
};
use crate::types::PrAutoFixOutput;
use std::env;

pub async fn pr_auto_fix(
    pr_number: u32,
    gemini_review: &str,
    max_rounds: u8,
    yes: bool,
    client: &CodexClient,
) -> Result<String, Box<dyn std::error::Error>> {
    let repo = env::var("GITHUB_REPOSITORY").unwrap_or_default();
    let mut ctx = SkillContext::new(pr_number, repo, gemini_review.to_string(), max_rounds, yes);

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
