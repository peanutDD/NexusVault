use crate::llm::CodexClient;
use crate::repo;
use crate::types::{ChangelogEntryInput, ReviewData, ReviewIssue};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::env;

/// Pipeline 运行期共享上下文。
///
/// 设计原则：
/// - Skill 只读/只写自己负责的字段，避免“全局脚本”式的隐式耦合
/// - `auto_push` 用于区分 CI/Runner 与本地 Dry-Run：是否允许提交/推送
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkillContext {
    pub pr_number: u32,
    pub repo: String,
    pub repo_root: String,
    pub rules_text: String,
    pub raw_input: String,
    pub parsed_data: Option<ReviewData>,
    pub selected_issues: Vec<ReviewIssue>,
    pub fixed_files: Vec<String>,
    pub quality_score: u8,
    pub security_passed: bool,
    pub auto_push: bool,
    pub enable_pr_comments: bool,
    pub changelog_path: Option<String>,
    pub disable_changelog: bool,
    pub rounds: u8,
}

#[derive(Debug, Clone)]
pub struct SkillContextInit {
    pub pr_number: u32,
    pub repo: String,
    pub repo_root: String,
    pub rules_text: String,
    pub raw_input: String,
    pub rounds: u8,
    pub auto_push: bool,
    pub enable_pr_comments: bool,
    pub changelog_path: Option<String>,
    pub disable_changelog: bool,
}

impl SkillContext {
    /// 构建一个新的上下文。
    ///
    /// 注意：`rounds` 是“上限/轮次配置”，不是“已执行轮次计数”。
    pub fn new(init: SkillContextInit) -> Self {
        Self {
            pr_number: init.pr_number,
            repo: init.repo,
            repo_root: init.repo_root,
            rules_text: init.rules_text,
            raw_input: init.raw_input,
            parsed_data: None,
            selected_issues: Vec::new(),
            fixed_files: Vec::new(),
            quality_score: 0,
            security_passed: false,
            auto_push: init.auto_push,
            enable_pr_comments: init.enable_pr_comments,
            changelog_path: init.changelog_path,
            disable_changelog: init.disable_changelog,
            rounds: init.rounds,
        }
    }
}

/// Skill 抽象：每个 Skill 负责一个原子步骤。
///
/// 约定：
/// - 进度/诊断日志应写 stderr
/// - `execute` 失败即终止 pipeline（让 workflow 看到明确失败）
#[async_trait::async_trait]
pub trait Skill {
    fn name(&self) -> &'static str;
    async fn execute(
        &self,
        ctx: &mut SkillContext,
        client: &CodexClient,
    ) -> Result<(), Box<dyn std::error::Error>>;
}

/// 解析 Gemini Review（Markdown）为结构化 `ReviewData`。
pub struct ReadReviewSkill;
#[async_trait::async_trait]
impl Skill for ReadReviewSkill {
    fn name(&self) -> &'static str {
        "ReadReview"
    }
    async fn execute(
        &self,
        ctx: &mut SkillContext,
        client: &CodexClient,
    ) -> Result<(), Box<dyn std::error::Error>> {
        let data = read_gemini_review(&ctx.raw_input, &ctx.repo, client).await?;
        ctx.parsed_data = Some(data);
        Ok(())
    }
}

/// 根据规则过滤/选择需要修复的问题（硬过滤：严重级别、受保护文件、文档路径等）。
pub struct DecisionSkill;
#[async_trait::async_trait]
impl Skill for DecisionSkill {
    fn name(&self) -> &'static str {
        "Decision"
    }
    async fn execute(
        &self,
        ctx: &mut SkillContext,
        _client: &CodexClient,
    ) -> Result<(), Box<dyn std::error::Error>> {
        if let Some(data) = &ctx.parsed_data {
            ctx.selected_issues = decide_fix_or_skip(&data.issues);
        }
        Ok(())
    }
}

/// 对筛选后的问题逐个生成补丁并尝试应用到工作区。
///
/// 失败策略：单个 issue 的补丁生成或应用失败不会中断整个流程（跳过该条）。
pub struct BatchFixSkill;
#[async_trait::async_trait]
impl Skill for BatchFixSkill {
    fn name(&self) -> &'static str {
        "BatchFix"
    }
    async fn execute(
        &self,
        ctx: &mut SkillContext,
        client: &CodexClient,
    ) -> Result<(), Box<dyn std::error::Error>> {
        for issue in &ctx.selected_issues {
            if let Ok(Some(patch)) = generate_fix_patch(issue, ctx, client).await
                && repo::apply_patch_safely_in(&ctx.repo_root, &issue.file, &patch)?
            {
                ctx.fixed_files.push(issue.file.clone());
            }
        }
        Ok(())
    }
}

/// 对已修改文件做安全检查（prompt-based）。
///
/// 这是“软审计”：结果来自模型判断，因此用于提示/拦截高风险，而不是替代真实安全扫描。
pub struct SecurityCheckSkill;
#[async_trait::async_trait]
impl Skill for SecurityCheckSkill {
    fn name(&self) -> &'static str {
        "SecurityCheck"
    }
    async fn execute(
        &self,
        ctx: &mut SkillContext,
        client: &CodexClient,
    ) -> Result<(), Box<dyn std::error::Error>> {
        eprintln!("🛡️ [Skill: SecurityCheck] 正在扫描修复后的代码安全性...");

        let mut all_passed = true;
        for file in &ctx.fixed_files {
            let content = repo::read_repo_file(&ctx.repo_root, file)?;
            let system_prompt = "你是一个安全审计专家。请检查代码是否存在注入、密钥泄露或严重逻辑漏洞。\n仅返回 JSON: {\"passed\": true/false, \"reason\": \"原因\"}";
            let user_prompt = format!("文件: {}\n内容: \n```\n{}\n```", file, content);

            let result = client.call(system_prompt, &user_prompt).await?;
            if result.contains("false") {
                all_passed = false;
                eprintln!("⚠️ 文件 {} 未通过安全扫描: {}", file, result);
                break;
            }
        }
        ctx.security_passed = all_passed;
        Ok(())
    }
}

/// 对本轮修改给出质量评分（0-100），用于在 PR 评论中回传结果。
pub struct QualityScoreSkill;
#[async_trait::async_trait]
impl Skill for QualityScoreSkill {
    fn name(&self) -> &'static str {
        "QualityScore"
    }
    async fn execute(
        &self,
        ctx: &mut SkillContext,
        client: &CodexClient,
    ) -> Result<(), Box<dyn std::error::Error>> {
        eprintln!("📊 [Skill: QualityScore] 正在评估修复质量...");

        let system_prompt = "你是一个代码质量专家。请根据 AGENTS.md 的 15 条铁律为本次修复打分 (0-100)。\n仅返回数字评分。";
        let user_prompt = format!(
            "修复的文件: {:?}\nGemini 原始意见: {}",
            ctx.fixed_files, ctx.raw_input
        );

        let result = client.call(system_prompt, &user_prompt).await?;
        if let Ok(score) = result.trim().parse::<u8>() {
            ctx.quality_score = score;
            eprintln!("📈 本次修复质量评分: {} 分", score);
        }
        Ok(())
    }
}

/// 将本轮修复信息写入 `docs/CHANGELOG.md`（可追溯性要求）。
pub struct DocumentationSkill;
#[async_trait::async_trait]
impl Skill for DocumentationSkill {
    fn name(&self) -> &'static str {
        "Documentation"
    }
    async fn execute(
        &self,
        ctx: &mut SkillContext,
        _client: &CodexClient,
    ) -> Result<(), Box<dyn std::error::Error>> {
        if ctx.disable_changelog || ctx.fixed_files.is_empty() {
            return Ok(());
        }

        let input = ChangelogEntryInput {
            pr_number: ctx.pr_number,
            round: ctx.rounds,
            unix_ts: repo::now_unix_ts()?,
            files: ctx.fixed_files.clone(),
            security_passed: ctx.security_passed,
            quality_score: ctx.quality_score,
        };

        repo::append_ai_changelog_in(
            &ctx.repo_root,
            &mut ctx.fixed_files,
            &input,
            ctx.changelog_path.as_deref(),
        )?;
        Ok(())
    }
}

/// Dry-Run 模式反馈：当 `auto_push=false` 时，不推送，但仍在 PR 留评论说明当前状态。
pub struct DryRunFeedbackSkill;
#[async_trait::async_trait]
impl Skill for DryRunFeedbackSkill {
    fn name(&self) -> &'static str {
        "DryRunFeedback"
    }
    async fn execute(
        &self,
        ctx: &mut SkillContext,
        _client: &CodexClient,
    ) -> Result<(), Box<dyn std::error::Error>> {
        if ctx.auto_push || ctx.fixed_files.is_empty() || !ctx.enable_pr_comments {
            return Ok(());
        }

        let msg = build_dry_run_comment(ctx);
        repo::post_comment(ctx.pr_number, &msg).map_err(|e| {
            format!(
                "DryRunFeedbackSkill: PR 评论发布失败（pr_number={}）。原始错误: {}",
                ctx.pr_number, e
            )
        })?;
        Ok(())
    }
}

/// 推送与反馈：提交/推送变更，并在 PR 下发布“修复完成”评论。
///
/// 若本轮没有产生修改，则发布“无需修复”的总结。
pub struct FeedbackSkill;
#[async_trait::async_trait]
impl Skill for FeedbackSkill {
    fn name(&self) -> &'static str {
        "Feedback"
    }
    async fn execute(
        &self,
        ctx: &mut SkillContext,
        _client: &CodexClient,
    ) -> Result<(), Box<dyn std::error::Error>> {
        if !ctx.fixed_files.is_empty() {
            if !ctx.auto_push {
                return Ok(());
            }

            let security_info = if ctx.security_passed {
                "✅ 安全扫描通过"
            } else {
                "⚠️ 安全扫描发现潜在风险"
            };
            let score_info = format!("🏆 质量评分: {} 分", ctx.quality_score);

            repo::commit_and_push_in(&ctx.repo_root, &ctx.fixed_files, true)?;

            let gh_msg = format!(
                "🤖 **Codex 自动修复完成**\n\n{}\n{}\n\n✅ 已修复文件：\n{}",
                security_info,
                score_info,
                ctx.fixed_files
                    .iter()
                    .map(|f| format!("- `{}`", f))
                    .collect::<Vec<_>>()
                    .join("\n")
            );
            if ctx.enable_pr_comments {
                repo::post_comment(ctx.pr_number, &gh_msg)?;
            } else {
                eprintln!("{}", gh_msg);
            }
        } else if let Some(data) = &ctx.parsed_data {
            let msg = format!(
                "🤖 **GPT-5.4 分析**: 未发现需要自动修复的高优先级问题。\n\n**总结**: {}",
                data.summary
            );
            if ctx.enable_pr_comments {
                repo::post_comment(ctx.pr_number, &msg)?;
            } else {
                eprintln!("{}", msg);
            }
        }
        Ok(())
    }
}

/// 生成 Dry-Run 的 PR 评论正文（稳定格式，便于人类快速判断是否需要 `--yes` 推送）。
fn build_dry_run_comment(ctx: &SkillContext) -> String {
    let security_info = if ctx.security_passed {
        "✅ 安全扫描通过"
    } else {
        "⚠️ 安全扫描发现潜在风险"
    };
    let score_info = format!("🏆 质量评分: {} 分", ctx.quality_score);

    let mut files = ctx.fixed_files.clone();
    files.sort();
    files.dedup();

    format!(
        "🤖 **Codex 已在本地生成并应用补丁，但未推送**\n\n原因：未传 `--yes`（auto_push=false），系统已进入 Dry-Run 模式。\n\n{}\n{}\n\n📄 本地变更文件：\n{}\n\n如确认无误，请在同一环境重新运行并加上 `--yes` 以提交并推送。",
        security_info,
        score_info,
        files
            .iter()
            .map(|f| format!("- `{}`", f))
            .collect::<Vec<_>>()
            .join("\n")
    )
}

/// 把 Gemini Review 的 Markdown 文本转成严格 JSON（Schema 由 system prompt 指定）。
///
/// 由于模型可能用 ```json/``` 包裹输出，这里做一次提取/清理再反序列化。
async fn read_gemini_review(
    gemini_comment: &str,
    repo_context: &str,
    client: &CodexClient,
) -> Result<ReviewData, Box<dyn std::error::Error>> {
    let system_prompt = "你是代码审查专家。现在有一个 Gemini Code Assist 对 PR 的完整 Review 评论。\n请严格按以下 JSON Schema 解析，不要添加任何额外文字：\n\n{\n  \"summary\": \"Gemini 对本次 PR 的整体总结（1-2 句话）\",\n  \"issues\": [\n    {\n      \"severity\": \"Critical | High | Medium | Low\",\n      \"file\": \"具体文件路径（如果 Gemini 没给就填 unknown）\",\n      \"line\": 行号（整数，如果是多行就取起始行）, \n      \"description\": \"问题详细描述（保留 Gemini 原意）\",\n      \"suggestion\": \"Gemini 给出的修复建议代码（如果有 ```suggestion 块就完整保留，否则为空字符串）\",\n      \"reason\": \"Gemini 原评论中对应的原文片段（用于溯源）\"\n    }\n  ]\n}\n\n只输出合法 JSON，不要 markdown，不要解释。";

    let user_prompt = format!(
        "Gemini 评论全文：\n--- START ---\n{}\n--- END ---\n\n仓库上下文: {}",
        gemini_comment, repo_context
    );

    let result = client.call(system_prompt, &user_prompt).await?;
    let mut json_str = result.trim();
    if json_str.starts_with("```json") {
        json_str = json_str
            .trim_start_matches("```json")
            .trim_end_matches("```")
            .trim();
    } else if json_str.starts_with("```") {
        json_str = json_str
            .trim_start_matches("```")
            .trim_end_matches("```")
            .trim();
    }

    let data: ReviewData = serde_json::from_str(json_str)
        .map_err(|e| format!("解析 Gemini Review JSON 失败: {}\n原始文本: {}", e, result))?;
    Ok(data)
}

/// “硬过滤”规则：决定哪些问题允许进入自动修复。
///
/// - 仅处理 High/Medium（避免低优先级噪声）
/// - 排除锁文件/配置文件等高风险路径
/// - 排除 docs/*.md（避免自动改文档造成 review 噪声与误改）
fn decide_fix_or_skip(issues: &[ReviewIssue]) -> Vec<ReviewIssue> {
    let mut protected = vec![
        "Cargo.lock".to_string(),
        "package-lock.json".to_string(),
        "bun.lock".to_string(),
        "Cargo.toml".to_string(),
        "package.json".to_string(),
        "pyproject.toml".to_string(),
        ".env".to_string(),
    ];
    if let Ok(extra) = env::var("CODEX_PROTECTED_FILES") {
        protected.extend(
            extra
                .split(',')
                .map(|s| s.trim())
                .filter(|s| !s.is_empty())
                .map(|s| s.to_string()),
        );
    }

    let allowed =
        env::var("CODEX_ALLOWED_SEVERITIES").unwrap_or_else(|_| "Critical,High,Medium".to_string());
    let allowed: HashSet<String> = allowed
        .split(',')
        .map(|s| s.trim())
        .filter(|s| !s.is_empty())
        .map(|s| s.to_string())
        .collect();

    let exclude_docs = env::var("CODEX_EXCLUDE_DOCS")
        .map(|v| v != "0" && v.to_lowercase() != "false")
        .unwrap_or(true);

    issues
        .iter()
        .filter(|i| allowed.contains(&i.severity))
        .filter(|i| !protected.iter().any(|p| i.file.contains(p)))
        .filter(|i| {
            if exclude_docs {
                !i.file.starts_with("docs/") && !i.file.ends_with(".md")
            } else {
                true
            }
        })
        .cloned()
        .collect()
}

/// 针对单条 issue 生成 unified diff 补丁。
///
/// 返回 `None` 表示无需修复或模型未生成有效补丁（例如缺少 @@ hunk）。
async fn generate_fix_patch(
    issue: &ReviewIssue,
    ctx: &SkillContext,
    client: &CodexClient,
) -> Result<Option<String>, Box<dyn std::error::Error>> {
    let content = repo::read_repo_file(&ctx.repo_root, &issue.file)?;

    let system_prompt = format!(
        "你是一个高级工程师。请严格遵循以下规则完成修复：\n\n{}\n\n请根据提供的审查意见，为目标文件生成 unified diff 格式的修复补丁。\n仅返回补丁内容，不要任何其他解释文字。如果没有需要修复的，返回空。",
        ctx.rules_text
    );

    let user_prompt = format!(
        "文件: {}\n问题: {}\n建议: {}\n\n源码:\n```\n{}\n```",
        issue.file, issue.description, issue.suggestion, content
    );

    let mut patch = client.call(&system_prompt, &user_prompt).await?;

    if patch.contains("```")
        && let Some(extracted) = repo::extract_code_block(&patch)
    {
        patch = extracted;
    }

    if patch.trim().is_empty() || !patch.contains("@@") {
        Ok(None)
    } else {
        Ok(Some(patch))
    }
}
