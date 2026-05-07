use crate::llm::CodexClient;
use crate::repo;
use crate::types::{
    ChangelogEntryInput, ReviewData, ReviewIssue, is_review_severity_medium_or_higher,
    review_severity_matches_allowed,
};
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
    pub fixed_issue_keys: Vec<String>,
    pub quality_score: u8,
    pub quality_score_available: bool,
    pub quality_score_reason: Option<String>,
    pub security_passed: bool,
    pub security_findings: Vec<String>,
    pub push_blocked: bool,
    pub auto_push: bool,
    pub enable_pr_comments: bool,
    pub changelog_path: Option<String>,
    pub disable_changelog: bool,
    pub max_rounds: u8,
    pub current_round: u8,
    pub rounds: u8,
    pub fix_attempts: Vec<FixAttempt>,
    pub pending_explanations: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct FixAttempt {
    pub round: u8,
    pub issue_key: String,
    pub file: String,
    pub stage: String,
    pub success: bool,
    pub reason: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct SecurityAuditResult {
    passed: bool,
    reason: String,
}

#[derive(Debug, Deserialize)]
struct QualityScoreResult {
    score: u16,
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
            fixed_issue_keys: Vec::new(),
            quality_score: 0,
            quality_score_available: false,
            quality_score_reason: None,
            security_passed: false,
            security_findings: Vec::new(),
            push_blocked: false,
            auto_push: init.auto_push,
            enable_pr_comments: init.enable_pr_comments,
            changelog_path: init.changelog_path,
            disable_changelog: init.disable_changelog,
            max_rounds: init.rounds.max(1),
            current_round: 1,
            rounds: init.rounds,
            fix_attempts: Vec::new(),
            pending_explanations: Vec::new(),
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
        if ctx.parsed_data.is_some() {
            eprintln!("🧾 [Skill: ReadReview] 使用预解析 Review JSON 输入");
            return Ok(());
        }
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
        let issues = ctx.selected_issues.clone();
        for issue in issues {
            let issue_key = review_issue_key(&issue);
            let patch = match generate_fix_patch(&issue, ctx, client).await {
                Ok(Some(patch)) => patch,
                Ok(None) => {
                    eprintln!(
                        "❌ [BatchFix] 补丁为空 - 文件: {}, 问题: {}, 原因: 模型未返回可应用的 unified diff",
                        issue.file, issue.description
                    );
                    ctx.fix_attempts.push(FixAttempt {
                        round: ctx.current_round,
                        issue_key,
                        file: issue.file,
                        stage: "patch_generation".to_string(),
                        success: false,
                        reason: Some("模型未返回可应用的 unified diff".to_string()),
                    });
                    continue;
                }
                Err(e) => {
                    eprintln!(
                        "❌ [BatchFix] 补丁生成失败 - 文件: {}, 问题: {}, 原因: {}",
                        issue.file, issue.description, e
                    );
                    ctx.fix_attempts.push(FixAttempt {
                        round: ctx.current_round,
                        issue_key,
                        file: issue.file,
                        stage: "patch_generation".to_string(),
                        success: false,
                        reason: Some(e.to_string()),
                    });
                    continue;
                }
            };

            let apply_result =
                repo::apply_patch_with_details_in(&ctx.repo_root, &issue.file, &patch)
                    .map_err(|e| e.to_string());

            match apply_result {
                Ok(result) if result.applied => {
                    ctx.fixed_files.push(issue.file.clone());
                    ctx.fixed_issue_keys.push(issue_key.clone());
                    ctx.fix_attempts.push(FixAttempt {
                        round: ctx.current_round,
                        issue_key,
                        file: issue.file,
                        stage: "patch_apply".to_string(),
                        success: true,
                        reason: None,
                    });
                }
                Ok(result) => {
                    let apply_reason = result
                        .fail_reason
                        .clone()
                        .unwrap_or_else(|| "unknown".to_string());
                    eprintln!(
                        "❌ [BatchFix] 补丁应用失败，准备重试 - 文件: {}, 原因: {}",
                        issue.file, apply_reason
                    );
                    ctx.fix_attempts.push(FixAttempt {
                        round: ctx.current_round,
                        issue_key,
                        file: issue.file.clone(),
                        stage: "patch_apply".to_string(),
                        success: false,
                        reason: Some(format!("git apply 未能应用补丁: {apply_reason}")),
                    });

                    let issue_key = review_issue_key(&issue);
                    let retry_patch = match generate_retry_fix_patch(
                        &issue,
                        ctx,
                        client,
                        &patch,
                        &result.stderr,
                        &apply_reason,
                    )
                    .await
                    {
                        Ok(Some(patch)) => patch,
                        Ok(None) => {
                            ctx.fix_attempts.push(FixAttempt {
                                round: ctx.current_round,
                                issue_key,
                                file: issue.file,
                                stage: "patch_generation_retry".to_string(),
                                success: false,
                                reason: Some("重试后模型未返回可应用的 unified diff".to_string()),
                            });
                            continue;
                        }
                        Err(e) => {
                            ctx.fix_attempts.push(FixAttempt {
                                round: ctx.current_round,
                                issue_key,
                                file: issue.file,
                                stage: "patch_generation_retry".to_string(),
                                success: false,
                                reason: Some(e.to_string()),
                            });
                            continue;
                        }
                    };

                    let retry_apply_result = repo::apply_patch_with_details_in(
                        &ctx.repo_root,
                        &issue.file,
                        &retry_patch,
                    )
                    .map_err(|e| e.to_string());
                    match retry_apply_result {
                        Ok(result) if result.applied => {
                            ctx.fixed_files.push(issue.file.clone());
                            ctx.fixed_issue_keys.push(issue_key.clone());
                            ctx.fix_attempts.push(FixAttempt {
                                round: ctx.current_round,
                                issue_key,
                                file: issue.file,
                                stage: "patch_apply_retry".to_string(),
                                success: true,
                                reason: None,
                            });
                        }
                        Ok(result) => {
                            let retry_reason = result
                                .fail_reason
                                .clone()
                                .unwrap_or_else(|| "unknown".to_string());
                            eprintln!(
                                "❌ [BatchFix] 补丁重试仍失败，尝试完整文件兜底 - 文件: {}",
                                issue.file
                            );
                            ctx.fix_attempts.push(FixAttempt {
                                round: ctx.current_round,
                                issue_key: issue_key.clone(),
                                file: issue.file.clone(),
                                stage: "patch_apply_retry".to_string(),
                                success: false,
                                reason: Some(format!(
                                    "git apply 重试后仍未能应用补丁: {retry_reason}"
                                )),
                            });
                            match apply_full_file_fallback(
                                &issue,
                                ctx,
                                client,
                                &retry_patch,
                                &issue_key,
                            )
                            .await
                            {
                                Ok(true) => {}
                                Ok(false) => {}
                                Err(e) => {
                                    ctx.fix_attempts.push(FixAttempt {
                                        round: ctx.current_round,
                                        issue_key,
                                        file: issue.file,
                                        stage: "file_replacement_fallback".to_string(),
                                        success: false,
                                        reason: Some(e.to_string()),
                                    });
                                }
                            }
                        }
                        Err(e) => {
                            eprintln!(
                                "❌ [BatchFix] 补丁重试执行错误，尝试完整文件兜底 - 文件: {}, 原因: {}",
                                issue.file, e
                            );
                            ctx.fix_attempts.push(FixAttempt {
                                round: ctx.current_round,
                                issue_key: issue_key.clone(),
                                file: issue.file.clone(),
                                stage: "patch_apply_retry".to_string(),
                                success: false,
                                reason: Some(e),
                            });
                            match apply_full_file_fallback(
                                &issue,
                                ctx,
                                client,
                                &retry_patch,
                                &issue_key,
                            )
                            .await
                            {
                                Ok(true) => {}
                                Ok(false) => {}
                                Err(e) => {
                                    ctx.fix_attempts.push(FixAttempt {
                                        round: ctx.current_round,
                                        issue_key,
                                        file: issue.file,
                                        stage: "file_replacement_fallback".to_string(),
                                        success: false,
                                        reason: Some(e.to_string()),
                                    });
                                }
                            }
                        }
                    }
                }
                Err(e) => {
                    eprintln!(
                        "❌ [BatchFix] 补丁应用错误 - 文件: {}, 原因: {}",
                        issue.file, e
                    );
                    ctx.fix_attempts.push(FixAttempt {
                        round: ctx.current_round,
                        issue_key,
                        file: issue.file,
                        stage: "patch_apply".to_string(),
                        success: false,
                        reason: Some(e.to_string()),
                    })
                }
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

        ctx.security_findings.clear();
        let mut all_passed = true;
        for file in &ctx.fixed_files {
            let content = repo::read_repo_file(&ctx.repo_root, file)?;
            let system_prompt = "你是一个安全审计专家。请检查代码是否存在注入、密钥泄露或严重逻辑漏洞。\n仅输出严格 JSON，不要 markdown，不要解释。Schema: {\"passed\": true, \"reason\": \"原因\"}";
            let user_prompt = format!("文件: {}\n内容: \n```\n{}\n```", file, content);

            let result = client.call(system_prompt, &user_prompt).await?;
            let audit = parse_security_audit(&result)?;
            if !audit.passed {
                all_passed = false;
                let finding = format!("{}: {}", file, audit.reason);
                ctx.security_findings.push(finding.clone());
                eprintln!("⚠️ 文件 {} 未通过安全扫描: {}", file, finding);
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

        let system_prompt = "你是一个代码质量专家。请根据 AGENTS.md 的 15 条铁律为本次修复打分 (0-100)。\n仅输出严格 JSON，不要 markdown，不要解释。Schema: {\"score\": 87, \"reason\": \"简短原因\"}";
        let user_prompt = format!(
            "修复的文件: {:?}\nGemini 原始意见: {}",
            ctx.fixed_files, ctx.raw_input
        );

        let first = client.call(system_prompt, &user_prompt).await?;
        let parsed = match parse_quality_score(&first) {
            Ok(score) => Ok(score),
            Err(first_err) => {
                eprintln!("⚠️ 质量评分解析失败，正在重试: {}", first_err);
                let retry = client.call(system_prompt, &user_prompt).await?;
                parse_quality_score(&retry).map_err(|second_err| {
                    format!("首次解析失败: {}; 重试解析失败: {}", first_err, second_err)
                })
            }
        };

        match parsed {
            Ok(score) => {
                ctx.quality_score = score;
                ctx.quality_score_available = true;
                ctx.quality_score_reason = None;
                eprintln!("📈 本次修复质量评分: {} 分", score);
            }
            Err(e) => {
                ctx.quality_score = 0;
                ctx.quality_score_available = false;
                ctx.quality_score_reason = Some(e);
                eprintln!("⚠️ 质量评分不可用");
            }
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
            round: ctx.current_round,
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
/// 若本轮没有产生修改，则按 clean / pending 状态发布对应总结。
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

            if !ctx.security_passed {
                ctx.push_blocked = true;
                let gh_msg = format!(
                    "🤖 **Codex 自动修复已生成，但未推送**\n\n⚠️ 安全扫描未通过，已按 fail-closed 策略停止提交。\n\n{}\n{}",
                    build_security_findings(ctx),
                    review_status_block(ctx)
                );
                if ctx.enable_pr_comments {
                    repo::post_comment(ctx.pr_number, &gh_msg)?;
                } else {
                    eprintln!("{}", gh_msg);
                }
                return Ok(());
            }

            let security_info = if ctx.security_passed {
                "✅ 安全扫描通过"
            } else {
                "⚠️ 安全扫描发现潜在风险"
            };
            let score_info = quality_score_label(ctx);

            repo::commit_and_push_in(&ctx.repo_root, &ctx.fixed_files, true)?;

            let gh_msg = format!(
                "🤖 **Codex 自动修复完成**\n\n{}\n{}\n{}\n\n✅ 已修复文件：\n{}{}",
                security_info,
                score_info,
                build_fix_attempt_summary(&ctx.fix_attempts),
                ctx.fixed_files
                    .iter()
                    .map(|f| format!("- `{}`", f))
                    .collect::<Vec<_>>()
                    .join("\n"),
                review_status_block(ctx)
            );
            if ctx.enable_pr_comments {
                repo::post_comment(ctx.pr_number, &gh_msg)?;
            } else {
                eprintln!("{}", gh_msg);
            }
        } else if let Some(data) = &ctx.parsed_data {
            let msg = if ctx.pending_explanations.is_empty() {
                format!(
                    "🤖 **Codex GPT-5.5 分析**: 未发现需要自动修复的高优先级问题。\n\n**总结**: {}",
                    data.summary
                )
            } else {
                format!(
                    "🤖 **Codex GPT-5.5 分析**: 存在未自动修复的问题，已保留原因。\n\n**总结**: {}\n{}",
                    data.summary,
                    review_status_block(ctx)
                )
            };
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
    let score_info = quality_score_label(ctx);

    let mut files = ctx.fixed_files.clone();
    files.sort();
    files.dedup();

    format!(
        "🤖 **Codex 已在本地生成并应用补丁，但未推送**\n\n原因：未传 `--yes`（auto_push=false），系统已进入 Dry-Run 模式。\n\n{}\n{}\n{}\n\n📄 本地变更文件：\n{}{}\n\n如确认无误，请在同一环境重新运行并加上 `--yes` 以提交并推送。",
        security_info,
        score_info,
        build_fix_attempt_summary(&ctx.fix_attempts),
        files
            .iter()
            .map(|f| format!("- `{}`", f))
            .collect::<Vec<_>>()
            .join("\n"),
        review_status_block(ctx)
    )
}

pub(crate) fn fixed_explanations(ctx: &SkillContext) -> Vec<String> {
    let fixed = fixed_issue_keys(ctx);
    let Some(data) = &ctx.parsed_data else {
        return Vec::new();
    };

    data.issues
        .iter()
        .filter(|issue| is_review_severity_medium_or_higher(&issue.severity))
        .filter(|issue| fixed.contains(&review_issue_key(issue)))
        .map(|issue| {
            format!(
                "[{}] `{}`:{} 已自动修复：{}",
                issue.severity,
                issue.file,
                issue.line.unwrap_or(0),
                issue.description
            )
        })
        .collect()
}

fn pending_explanations(ctx: &SkillContext) -> Vec<String> {
    if !ctx.pending_explanations.is_empty() {
        return ctx.pending_explanations.clone();
    }

    let fixed = fixed_issue_keys(ctx);
    let selected: HashSet<String> = ctx.selected_issues.iter().map(review_issue_key).collect();
    let Some(data) = &ctx.parsed_data else {
        return Vec::new();
    };

    data.issues
        .iter()
        .filter(|issue| is_review_severity_medium_or_higher(&issue.severity))
        .filter_map(|issue| {
            let issue_key = review_issue_key(issue);
            if fixed.contains(&issue_key) {
                return None;
            }
            let latest_attempt = ctx
                .fix_attempts
                .iter()
                .rev()
                .find(|attempt| attempt.issue_key == issue_key && !attempt.success)
                .and_then(|attempt| attempt.reason.as_deref());
            let reason = latest_attempt.unwrap_or_else(|| {
                if selected.contains(&issue_key) {
                    "未产生可应用补丁"
                } else {
                    "策略过滤或受保护路径，未自动修复"
                }
            });
            Some(format!(
                "[{}] `{}`:{} 未自动修复：{}",
                issue.severity,
                issue.file,
                issue.line.unwrap_or(0),
                reason
            ))
        })
        .collect()
}

fn fixed_issue_keys(ctx: &SkillContext) -> HashSet<String> {
    ctx.fix_attempts
        .iter()
        .filter(|attempt| attempt.success)
        .map(|attempt| attempt.issue_key.clone())
        .chain(ctx.fixed_issue_keys.iter().cloned())
        .collect()
}

fn review_status_block(ctx: &SkillContext) -> String {
    let fixed = fixed_explanations(ctx);
    let pending = pending_explanations(ctx);
    if fixed.is_empty() && pending.is_empty() {
        return String::new();
    }

    let mut sections = Vec::new();
    if !fixed.is_empty() {
        sections.push(format!(
            "✅ 已自动修复问题：\n{}",
            fixed
                .iter()
                .map(|explanation| format!("- {}", explanation))
                .collect::<Vec<_>>()
                .join("\n")
        ));
    }
    if !pending.is_empty() {
        sections.push(format!(
            "🧭 未自动修复问题：\n{}",
            pending
                .iter()
                .map(|explanation| format!("- {}", explanation))
                .collect::<Vec<_>>()
                .join("\n")
        ));
    }

    format!("\n\n{}", sections.join("\n\n"))
}

fn build_security_findings(ctx: &SkillContext) -> String {
    if ctx.security_findings.is_empty() {
        return "安全扫描未通过，但没有可展示的结构化 finding。".to_string();
    }

    format!(
        "安全扫描发现：\n{}",
        ctx.security_findings
            .iter()
            .map(|f| format!("- {}", f))
            .collect::<Vec<_>>()
            .join("\n")
    )
}

fn parse_security_audit(raw: &str) -> Result<SecurityAuditResult, Box<dyn std::error::Error>> {
    let json = clean_json_response(raw);
    match serde_json::from_str::<SecurityAuditResult>(&json) {
        Ok(result) => Ok(result),
        Err(e) => Ok(SecurityAuditResult {
            passed: false,
            reason: format!("无法解析安全审计 JSON: {}; 原始输出: {}", e, raw.trim()),
        }),
    }
}

fn parse_quality_score(raw: &str) -> Result<u8, String> {
    let trimmed = raw.trim();
    if let Ok(score) = trimmed.parse::<u8>()
        && score <= 100
    {
        return Ok(score);
    }

    let json = clean_json_response(raw);
    let parsed: QualityScoreResult =
        serde_json::from_str(&json).map_err(|e| format!("无法解析质量评分 JSON: {}", e))?;
    if parsed.score > 100 {
        return Err(format!("质量评分超出范围: {}", parsed.score));
    }
    Ok(parsed.score as u8)
}

fn clean_json_response(raw: &str) -> String {
    let trimmed = raw.trim();
    if trimmed.starts_with("```") {
        let without_start = trimmed
            .trim_start_matches("```json")
            .trim_start_matches("```")
            .trim();
        return without_start.trim_end_matches("```").trim().to_string();
    }
    trimmed.to_string()
}

fn quality_score_label(ctx: &SkillContext) -> String {
    if ctx.quality_score_available {
        format!("🏆 质量评分: {} 分", ctx.quality_score)
    } else {
        format!(
            "🏆 质量评分: 不可用 ({})",
            ctx.quality_score_reason
                .as_deref()
                .unwrap_or("模型输出不可解析")
        )
    }
}

fn build_fix_attempt_summary(attempts: &[FixAttempt]) -> String {
    if attempts.is_empty() {
        return "🧾 修复尝试：0 次".to_string();
    }

    let success = attempts.iter().filter(|a| a.success).count();
    let failure = attempts.len().saturating_sub(success);
    let reasons = attempts
        .iter()
        .filter(|a| !a.success)
        .filter_map(|a| a.reason.as_ref())
        .take(3)
        .map(|r| format!("- {}", r))
        .collect::<Vec<_>>()
        .join("\n");

    if reasons.is_empty() {
        format!("🧾 修复尝试：成功 {}，失败 {}", success, failure)
    } else {
        format!(
            "🧾 修复尝试：成功 {}，失败 {}\n{}",
            success, failure, reasons
        )
    }
}

pub(crate) fn review_issue_key(issue: &ReviewIssue) -> String {
    format!(
        "{}:{}:{}:{}",
        issue.file,
        issue.line.unwrap_or(0),
        issue.severity,
        issue.description
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
    let system_prompt = "你是代码审查专家。现在有一个 Gemini Code Assist 对 PR 的完整 Review 评论。\n请严格按以下 JSON Schema 解析，不要添加任何额外文字：\n\n{\n  \"summary\": \"Gemini 对本次 PR 的整体总结（1-2 句话）\",\n  \"issues\": [\n    {\n      \"severity\": \"Critical | High | Medium+ | Medium | Low\",\n      \"file\": \"具体文件路径（如果 Gemini 没给就填 unknown）\",\n      \"line\": 行号（整数，如果是多行就取起始行）, \n      \"description\": \"问题详细描述（保留 Gemini 原意）\",\n      \"suggestion\": \"Gemini 给出的修复建议代码（如果有 ```suggestion 块就完整保留，否则为空字符串）\",\n      \"constraints\": [\"明确约束，例如 only modify src/lib.rs；没有则为空数组\"],\n      \"reason\": \"Gemini 原评论中对应的原文片段（用于溯源）\"\n    }\n  ]\n}\n\n只输出合法 JSON，不要 markdown，不要解释。";

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
    let protected = protected_files();

    let allowed = env::var("CODEX_ALLOWED_SEVERITIES")
        .unwrap_or_else(|_| "Critical,High,Medium+,Medium".to_string());
    let allowed: HashSet<String> = allowed
        .split(',')
        .map(|s| {
            s.chars()
                .filter(|c| !c.is_whitespace())
                .collect::<String>()
                .to_ascii_lowercase()
        })
        .filter(|s| !s.is_empty())
        .collect();

    let exclude_docs = env::var("CODEX_EXCLUDE_DOCS")
        .map(|v| v != "0" && v.to_lowercase() != "false")
        .unwrap_or(true);

    issues
        .iter()
        .filter(|i| review_severity_matches_allowed(&i.severity, &allowed))
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
    let constraints = if issue.constraints.is_empty() {
        "(none)".to_string()
    } else {
        issue
            .constraints
            .iter()
            .map(|constraint| format!("- {}", constraint))
            .collect::<Vec<_>>()
            .join("\n")
    };

    let system_prompt = format!(
        "你是一个高级工程师。请严格遵循以下规则完成修复：\n\n{}\n\n请根据提供的审查意见，为目标文件生成 unified diff 格式的修复补丁。\n仅返回补丁内容，不要任何其他解释文字。如果没有需要修复的，返回空。",
        ctx.rules_text
    );

    let user_prompt = format!(
        "文件: {}\n问题: {}\n建议: {}\n约束:\n{}\n\n源码:\n```\n{}\n```",
        issue.file, issue.description, issue.suggestion, constraints, content
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

async fn generate_retry_fix_patch(
    issue: &ReviewIssue,
    ctx: &SkillContext,
    client: &CodexClient,
    failed_patch: &str,
    apply_stderr: &str,
    apply_reason: &str,
) -> Result<Option<String>, Box<dyn std::error::Error>> {
    let content = repo::read_repo_file(&ctx.repo_root, &issue.file)?;

    let system_prompt = format!(
        "你是一个高级工程师。请严格遵循以下规则完成修复：\n\n{}\n\n上一版补丁应用失败。请基于最新源码重新生成更小、更精确的 unified diff。\n硬性约束：Allowed file: {}；max hunks: 3；max changed lines: 80；只输出 unified diff；禁止解释文本；禁止修改 allowed file 以外的文件。如果没有需要修复的，返回空。",
        ctx.rules_text, issue.file
    );

    let constraints = if issue.constraints.is_empty() {
        "(none)".to_string()
    } else {
        issue
            .constraints
            .iter()
            .map(|constraint| format!("- {}", constraint))
            .collect::<Vec<_>>()
            .join("\n")
    };
    let user_prompt = format!(
        "Allowed file: {}\n问题: {}\n建议: {}\n约束:\n{}\n\ngit apply failure classification: {}\ngit apply stderr:\n```\n{}\n```\n\n上一版补丁应用失败，失败补丁如下：\n```\n{}\n```\n\n最新源码:\n```\n{}\n```",
        issue.file,
        issue.description,
        issue.suggestion,
        constraints,
        apply_reason,
        apply_stderr,
        failed_patch,
        content
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

async fn apply_full_file_fallback(
    issue: &ReviewIssue,
    ctx: &mut SkillContext,
    client: &CodexClient,
    failed_patch: &str,
    issue_key: &str,
) -> Result<bool, Box<dyn std::error::Error>> {
    if let Some(reason) = full_file_fallback_block_reason(issue, ctx)? {
        ctx.fix_attempts.push(FixAttempt {
            round: ctx.current_round,
            issue_key: issue_key.to_string(),
            file: issue.file.clone(),
            stage: "file_replacement_fallback".to_string(),
            success: false,
            reason: Some(reason),
        });
        return Ok(false);
    }

    let Some(replacement) = generate_replacement_file(issue, ctx, client, failed_patch).await?
    else {
        ctx.fix_attempts.push(FixAttempt {
            round: ctx.current_round,
            issue_key: issue_key.to_string(),
            file: issue.file.clone(),
            stage: "file_replacement_fallback".to_string(),
            success: false,
            reason: Some("完整文件兜底未返回有效变更".to_string()),
        });
        return Ok(false);
    };

    repo::write_repo_file(&ctx.repo_root, &issue.file, &replacement)?;
    ctx.fixed_files.push(issue.file.clone());
    ctx.fixed_issue_keys.push(issue_key.to_string());
    ctx.fix_attempts.push(FixAttempt {
        round: ctx.current_round,
        issue_key: issue_key.to_string(),
        file: issue.file.clone(),
        stage: "file_replacement_fallback".to_string(),
        success: true,
        reason: None,
    });
    Ok(true)
}

fn full_file_fallback_block_reason(
    issue: &ReviewIssue,
    ctx: &SkillContext,
) -> Result<Option<String>, Box<dyn std::error::Error>> {
    let protected = protected_files();
    if protected.iter().any(|p| issue.file.contains(p)) {
        return Ok(Some(format!(
            "完整文件兜底被阻止：受保护路径 `{}`",
            issue.file
        )));
    }

    let prefixes = fallback_allowed_prefixes();
    if !prefixes.iter().any(|prefix| issue.file.starts_with(prefix)) {
        return Ok(Some(format!(
            "完整文件兜底被阻止：路径 `{}` 不在允许目录内",
            issue.file
        )));
    }

    let content = repo::read_repo_file(&ctx.repo_root, &issue.file)?;
    let max_lines = fallback_max_lines();
    let line_count = content.lines().count();
    if line_count > max_lines {
        return Ok(Some(format!(
            "完整文件兜底被阻止：文件 `{}` 有 {} 行，超过上限 {} 行",
            issue.file, line_count, max_lines
        )));
    }

    Ok(None)
}

fn protected_files() -> Vec<String> {
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
                .map(str::trim)
                .filter(|s| !s.is_empty())
                .map(ToString::to_string),
        );
    }
    protected
}

fn fallback_allowed_prefixes() -> Vec<String> {
    env::var("CODEX_FULL_FILE_FALLBACK_ALLOWED_PREFIXES")
        .unwrap_or_else(|_| "src/,backend/src/,frontend/src/,scripts/,.github/scripts/".to_string())
        .split(',')
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(ToString::to_string)
        .collect()
}

fn fallback_max_lines() -> usize {
    env::var("CODEX_FULL_FILE_FALLBACK_MAX_LINES")
        .ok()
        .and_then(|value| value.parse::<usize>().ok())
        .filter(|value| *value > 0)
        .unwrap_or(300)
}

async fn generate_replacement_file(
    issue: &ReviewIssue,
    ctx: &SkillContext,
    client: &CodexClient,
    failed_patch: &str,
) -> Result<Option<String>, Box<dyn std::error::Error>> {
    let content = repo::read_repo_file(&ctx.repo_root, &issue.file)?;

    let system_prompt = format!(
        "你是一个高级工程师。请严格遵循以下规则完成修复：\n\n{}\n\n前两次 unified diff 补丁均无法应用。请改为返回修复后的完整目标文件内容。\n只返回完整文件内容，不要 diff，不要解释文字；如果没有需要修复的，返回空。",
        ctx.rules_text
    );

    let user_prompt = format!(
        "文件: {}\n问题: {}\n建议: {}\n\n最后一次失败补丁如下：\n```\n{}\n```\n\n当前完整源码:\n```\n{}\n```",
        issue.file, issue.description, issue.suggestion, failed_patch, content
    );

    let mut replacement = client.call(&system_prompt, &user_prompt).await?;
    if replacement.contains("```")
        && let Some(extracted) = repo::extract_code_block(&replacement)
    {
        replacement = extracted;
    }

    let replacement = normalize_replacement_file(&replacement, &content);
    if replacement.is_empty() || replacement == content {
        Ok(None)
    } else {
        Ok(Some(replacement))
    }
}

fn normalize_replacement_file(candidate: &str, original: &str) -> String {
    let mut replacement = candidate.trim_matches('\n').to_string();
    if replacement.is_empty() {
        return String::new();
    }
    if original.ends_with('\n') {
        replacement.push('\n');
    }
    replacement
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_security_audit_ignores_false_inside_reason_when_passed() {
        let parsed = parse_security_audit(
            r#"{"passed": true, "reason": "no false positive secrets found"}"#,
        )
        .unwrap();

        assert!(parsed.passed);
    }

    #[test]
    fn parse_security_audit_fails_closed_on_non_json() {
        let parsed = parse_security_audit("passed: true").unwrap();

        assert!(!parsed.passed);
        assert!(parsed.reason.contains("无法解析安全审计 JSON"));
    }

    #[test]
    fn parse_quality_score_accepts_json_and_numbers() {
        assert_eq!(
            parse_quality_score(r#"{"score": 91, "reason": "ok"}"#).unwrap(),
            91
        );
        assert_eq!(parse_quality_score("87").unwrap(), 87);
    }

    #[test]
    fn build_attempt_summary_counts_success_and_failure() {
        let attempts = vec![
            FixAttempt {
                round: 1,
                issue_key: "src/a.rs:1:Medium:a".to_string(),
                file: "src/a.rs".to_string(),
                stage: "patch_apply".to_string(),
                success: true,
                reason: None,
            },
            FixAttempt {
                round: 1,
                issue_key: "src/b.rs:1:Medium:b".to_string(),
                file: "src/b.rs".to_string(),
                stage: "patch_generation".to_string(),
                success: false,
                reason: Some("empty patch".to_string()),
            },
        ];

        let summary = build_fix_attempt_summary(&attempts);

        assert!(summary.contains("成功 1"));
        assert!(summary.contains("失败 1"));
        assert!(summary.contains("empty patch"));
    }

    #[test]
    fn review_status_block_lists_fixed_and_unfixed_medium_items() {
        let mut ctx = SkillContext::new(SkillContextInit {
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
        });
        ctx.parsed_data = Some(ReviewData {
            summary: "summary".to_string(),
            issues: vec![
                ReviewIssue {
                    file: "src/a.rs".to_string(),
                    line: Some(10),
                    severity: "Medium".to_string(),
                    description: "first".to_string(),
                    suggestion: "fix".to_string(),
                    constraints: Vec::new(),
                    reason: None,
                },
                ReviewIssue {
                    file: "src/b.rs".to_string(),
                    line: Some(20),
                    severity: "Medium+".to_string(),
                    description: "second".to_string(),
                    suggestion: "fix".to_string(),
                    constraints: Vec::new(),
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
            issue_key: "src/b.rs:20:Medium+:second".to_string(),
            file: "src/b.rs".to_string(),
            stage: "patch_generation".to_string(),
            success: false,
            reason: Some("empty patch".to_string()),
        });

        let block = review_status_block(&ctx);

        assert!(block.contains("✅ 已自动修复问题"));
        assert!(block.contains("[Medium] `src/a.rs`:10 已自动修复：first"));
        assert!(block.contains("🧭 未自动修复问题"));
        assert!(block.contains("[Medium+] `src/b.rs`:20 未自动修复：empty patch"));
    }

    #[test]
    fn review_issue_key_distinguishes_same_file_issues() {
        let first = ReviewIssue {
            file: "src/a.rs".to_string(),
            line: Some(10),
            severity: "Medium".to_string(),
            description: "first".to_string(),
            suggestion: String::new(),
            constraints: Vec::new(),
            reason: None,
        };
        let second = ReviewIssue {
            description: "second".to_string(),
            ..first.clone()
        };

        assert_ne!(review_issue_key(&first), review_issue_key(&second));
    }

    #[test]
    fn decide_fix_or_skip_selects_medium_and_literal_medium_plus() {
        let issues = vec![
            ReviewIssue {
                file: "src/a.rs".to_string(),
                line: Some(10),
                severity: "Medium".to_string(),
                description: "medium".to_string(),
                suggestion: String::new(),
                constraints: Vec::new(),
                reason: None,
            },
            ReviewIssue {
                file: "src/b.rs".to_string(),
                line: Some(20),
                severity: "Medium+".to_string(),
                description: "medium plus".to_string(),
                suggestion: String::new(),
                constraints: Vec::new(),
                reason: None,
            },
            ReviewIssue {
                file: "src/c.rs".to_string(),
                line: Some(30),
                severity: "Low".to_string(),
                description: "low".to_string(),
                suggestion: String::new(),
                constraints: Vec::new(),
                reason: None,
            },
        ];

        let selected = decide_fix_or_skip(&issues);

        assert_eq!(selected.len(), 2);
        assert_eq!(selected[0].severity, "Medium");
        assert_eq!(selected[1].severity, "Medium+");
    }
}
