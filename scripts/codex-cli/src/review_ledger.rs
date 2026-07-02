use crate::repo;
use crate::skills::{SkillContext, review_issue_key};
use crate::types::{
    ReviewIssue, ReviewIssueStatus, ReviewLedgerEntryInput, is_review_severity_medium_or_higher,
};
use std::collections::HashSet;
use std::fs;
use std::path::PathBuf;
use std::thread;
use std::time::{Duration, Instant};

const GLOBAL_LEDGER_PATH: &str = "docs/auto-review-ledger.md";
const LEDGER_LOCK_TIMEOUT: Duration = Duration::from_secs(30);
const LEDGER_LOCK_RETRY: Duration = Duration::from_millis(50);

pub fn scoped_path(pr_number: u32) -> String {
    if pr_number == 0 {
        "docs/auto-review-ledgers/local.md".to_string()
    } else {
        format!("docs/auto-review-ledgers/pr-{}.md", pr_number)
    }
}

pub fn append_from_context(
    ctx: &mut SkillContext,
    summary: Option<String>,
) -> Result<Option<String>, Box<dyn std::error::Error>> {
    if ctx.disable_changelog {
        return Ok(None);
    }

    let statuses = issue_statuses(ctx);
    if statuses.is_empty() {
        return Ok(None);
    }

    let input = ReviewLedgerEntryInput {
        pr_number: ctx.pr_number,
        round: ctx.current_round,
        unix_ts: repo::now_unix_ts()?,
        summary,
        files: ctx.fixed_files.clone(),
        statuses,
    };

    append_in(&ctx.repo_root, &mut ctx.fixed_files, &input)
}

pub fn append_in(
    repo_root: &str,
    fixed_files: &mut Vec<String>,
    input: &ReviewLedgerEntryInput,
) -> Result<Option<String>, Box<dyn std::error::Error>> {
    if input.statuses.is_empty() {
        return Ok(None);
    }

    let entry = build_entry(input);
    append_ledger_file(
        repo_root,
        GLOBAL_LEDGER_PATH,
        "# Auto Review Ledger",
        &entry,
        fixed_files,
    )?;

    let scoped_rel_path = scoped_path(input.pr_number);
    let scoped_title = if input.pr_number == 0 {
        "# Auto Review Ledger - local".to_string()
    } else {
        format!("# Auto Review Ledger - PR #{}", input.pr_number)
    };
    append_ledger_file(
        repo_root,
        &scoped_rel_path,
        &scoped_title,
        &entry,
        fixed_files,
    )?;

    Ok(Some(GLOBAL_LEDGER_PATH.to_string()))
}

pub fn build_entry(input: &ReviewLedgerEntryInput) -> String {
    let mut files = input.files.clone();
    files.sort();
    files.dedup();

    let pr_label = if input.pr_number == 0 {
        "local".to_string()
    } else {
        format!("#{}", input.pr_number)
    };
    let mut entry = format!(
        "## Codex Auto Review - PR {} round {} - ts={}\n\n",
        pr_label, input.round, input.unix_ts
    );

    if let Some(summary) = input.summary.as_deref().filter(|s| !s.trim().is_empty()) {
        entry.push_str(&format!("总结：{}\n\n", markdown_table_cell(summary)));
    }

    entry.push_str("修改文件：\n");
    if files.is_empty() {
        entry.push_str("- 无代码或文档文件变更\n");
    } else {
        for file in &files {
            entry.push_str(&format!("- `{}`\n", file));
        }
    }

    entry.push_str("\n| # | Severity | File:line | 原始问题 | Suggestion | Constraints | Auto-fix scope | 状态 | Failure class | Failure stage | Retryable | Blocked action | 修复方式 / 失败原因 | 关联文件 | 解决答案 / 未解决原因 | Remediation |\n");
    entry.push_str("|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|\n");
    for (index, status) in input.statuses.iter().enumerate() {
        let constraints = if status.constraints.is_empty() {
            "(none)".to_string()
        } else {
            status.constraints.join("; ")
        };
        let related_files = if status.related_files.is_empty() {
            "(none)".to_string()
        } else {
            status
                .related_files
                .iter()
                .map(|file| format!("`{}`", file))
                .collect::<Vec<_>>()
                .join("<br>")
        };
        let method_or_failure = if status.status == "resolved" {
            &status.fix_method
        } else {
            status
                .failure_reason
                .as_deref()
                .filter(|reason| !reason.trim().is_empty())
                .unwrap_or(&status.fix_method)
        };
        entry.push_str(&format!(
            "| {} | {} | `{}`:{} | {} | {} | {} | {} | {} | {} | {} | {} | {} | {} | {} | {} | {} |\n",
            index + 1,
            markdown_table_cell(&status.severity),
            markdown_table_cell(&status.file),
            status.line,
            markdown_table_cell(&status.description),
            markdown_table_cell(&status.suggestion),
            markdown_table_cell(&constraints),
            markdown_table_cell(&status.auto_fix_scope),
            markdown_table_cell(&status.status),
            markdown_table_cell(&status.failure_class),
            markdown_table_cell(&status.failure_stage),
            status.retryable,
            markdown_table_cell(&status.blocked_action),
            markdown_table_cell(method_or_failure),
            markdown_table_cell(&related_files),
            markdown_table_cell(&status.explanation),
            markdown_table_cell(&status.remediation)
        ));
    }
    entry.push('\n');
    entry
}

pub fn issue_statuses(ctx: &SkillContext) -> Vec<ReviewIssueStatus> {
    let Some(data) = &ctx.parsed_data else {
        return Vec::new();
    };

    let fixed = fixed_issue_keys(ctx);
    let selected: HashSet<String> = ctx.selected_issues.iter().map(review_issue_key).collect();

    data.issues
        .iter()
        .map(|issue| {
            let issue_key = review_issue_key(issue);
            let line = issue.line.unwrap_or(0);
            let is_actionable = is_review_severity_medium_or_higher(&issue.severity);
            let was_selected = selected.contains(&issue_key);
            let latest_failure_reason = latest_failure_reason_for_issue(ctx, &issue_key);
            let fix_method = fix_method_for_issue(ctx, &issue_key);
            let related_files = related_files_for_issue(ctx, issue, fixed.contains(&issue_key));
            let failure_stage = latest_failure_stage_for_issue(ctx, &issue_key);
            let mut failure = FailureDetails::empty();
            let (status, explanation) = if fixed.contains(&issue_key) && ctx.push_blocked {
                failure = push_blocked_details(ctx);
                (
                    failure.failure_class.clone(),
                    format!(
                        "本地修复已生成，但发布链路被阻塞。具体原因：{}；解决办法：{}；可重试：{}",
                        failure
                            .failure_reason
                            .as_deref()
                            .unwrap_or("发布链路失败，未捕获到更具体错误"),
                        failure.remediation,
                        if failure.retryable { "true" } else { "false" }
                    ),
                )
            } else if fixed.contains(&issue_key) {
                (
                    "resolved".to_string(),
                    resolved_summary_for_issue(issue, &fix_method),
                )
            } else if !is_actionable {
                (
                    "tracked".to_string(),
                    "审计追踪：Low/Info 问题未进入自动修复范围".to_string(),
                )
            } else {
                let reason = pending_reason_for_issue(ctx, &issue_key, was_selected);
                failure = unresolved_issue_details(&reason, failure_stage.as_deref(), was_selected);
                (
                    failure.failure_class.clone(),
                    format!(
                        "具体原因：{}；解决办法：{}；可重试：{}",
                        reason,
                        failure.remediation,
                        if failure.retryable { "true" } else { "false" }
                    ),
                )
            };
            let failure_reason = if status == "resolved" || status == "tracked" {
                latest_failure_reason
            } else {
                failure.failure_reason.clone().or(latest_failure_reason)
            };

            ReviewIssueStatus {
                severity: issue.severity.clone(),
                file: issue.file.clone(),
                line,
                description: issue.description.clone(),
                suggestion: issue.suggestion.clone(),
                constraints: issue.constraints.clone(),
                auto_fix_scope: if was_selected {
                    "selected".to_string()
                } else {
                    "not_selected".to_string()
                },
                status,
                explanation,
                fix_method,
                failure_reason,
                related_files,
                failure_class: failure.failure_class,
                failure_stage: failure.failure_stage,
                retryable: failure.retryable,
                blocked_action: failure.blocked_action,
                remediation: failure.remediation,
            }
        })
        .collect()
}

pub fn pending_count(statuses: &[ReviewIssueStatus]) -> usize {
    statuses
        .iter()
        .filter(|status| !matches!(status.status.as_str(), "resolved" | "tracked"))
        .count()
}

pub(crate) fn source_fix_created(ctx: &SkillContext) -> bool {
    !ctx.fixed_issue_keys.is_empty() || ctx.fix_attempts.iter().any(|attempt| attempt.success)
}

pub(crate) fn fixed_issue_keys(ctx: &SkillContext) -> HashSet<String> {
    ctx.fix_attempts
        .iter()
        .filter(|attempt| attempt.success)
        .map(|attempt| attempt.issue_key.clone())
        .chain(ctx.fixed_issue_keys.iter().cloned())
        .collect()
}

pub(crate) fn pending_reason_for_issue(
    ctx: &SkillContext,
    issue_key: &str,
    selected: bool,
) -> String {
    ctx.fix_attempts
        .iter()
        .rev()
        .find(|attempt| attempt.issue_key == issue_key && !attempt.success)
        .and_then(|attempt| attempt.reason.clone())
        .unwrap_or_else(|| {
            if selected {
                "未产生可应用补丁".to_string()
            } else {
                "策略过滤或受保护路径，未自动修复".to_string()
            }
        })
}

#[derive(Debug, Clone)]
struct FailureDetails {
    failure_class: String,
    failure_stage: String,
    retryable: bool,
    blocked_action: String,
    remediation: String,
    failure_reason: Option<String>,
}

impl FailureDetails {
    fn empty() -> Self {
        Self {
            failure_class: String::new(),
            failure_stage: String::new(),
            retryable: false,
            blocked_action: String::new(),
            remediation: String::new(),
            failure_reason: None,
        }
    }
}

fn latest_failure_stage_for_issue(ctx: &SkillContext, issue_key: &str) -> Option<String> {
    ctx.fix_attempts
        .iter()
        .rev()
        .find(|attempt| attempt.issue_key == issue_key && !attempt.success)
        .map(|attempt| attempt.stage.clone())
}

fn push_blocked_details(ctx: &SkillContext) -> FailureDetails {
    let reason = ctx
        .pending_explanations
        .iter()
        .rev()
        .find(|explanation| {
            explanation.contains("自动修复提交前验证或推送失败")
                || explanation.contains("CODEX_AUTO_FIX_VERIFY_COMMANDS")
                || explanation.contains("git push")
                || explanation.contains("GitHub API")
                || explanation.contains("PR 评论")
        })
        .cloned()
        .unwrap_or_else(|| "发布链路失败，未捕获到更具体错误".to_string());

    let stage = if reason.contains("CODEX_AUTO_FIX_VERIFY_COMMANDS") || reason.contains("验证失败")
    {
        "pre-push validation"
    } else if reason.contains("git commit") {
        "git commit"
    } else if reason.contains("git push") {
        "git push"
    } else if reason.contains("GitHub API") {
        "GitHub API fallback"
    } else if reason.contains("PR 评论") || reason.contains("gh pr comment") {
        "PR comment"
    } else {
        "publish"
    };

    let remediation = if stage == "pre-push validation" {
        "修复验证命令失败原因后重新运行；先在本地执行 CODEX_AUTO_FIX_VERIFY_COMMANDS 对应的 lint/typecheck/test/format 命令，确认通过后再触发下一轮。"
            .to_string()
    } else {
        "恢复 GitHub 网络连接，检查 gh/GITHUB_TOKEN 权限、branch protection 和远端状态；确认发布链路可用后手动触发第 3 轮或更多轮继续。"
            .to_string()
    };

    FailureDetails {
        failure_class: "blocked_push".to_string(),
        failure_stage: stage.to_string(),
        retryable: true,
        blocked_action: "commit/push/PR comment/state advancement".to_string(),
        remediation,
        failure_reason: Some(reason),
    }
}

fn unresolved_issue_details(reason: &str, stage: Option<&str>, selected: bool) -> FailureDetails {
    if !selected {
        return FailureDetails {
            failure_class: "blocked_policy".to_string(),
            failure_stage: "decision_filter".to_string(),
            retryable: false,
            blocked_action: "automatic source modification".to_string(),
            remediation:
                "人工批准修改受保护文件或调整 CODEX_EXCLUDE_DOCS/CODEX_PROTECTED_FILES/CODEX_ALLOWED_SEVERITIES 后再重跑。"
                    .to_string(),
            failure_reason: Some(reason.to_string()),
        };
    }

    if is_external_failure(reason) {
        return FailureDetails {
            failure_class: "blocked_external".to_string(),
            failure_stage: stage.unwrap_or("external_dependency").to_string(),
            retryable: true,
            blocked_action: "new Codex repair attempt".to_string(),
            remediation:
                "恢复网络、Codex 额度/GitHub 连接或 runner 状态后，手动触发第 3 轮或更多轮继续修复。"
                    .to_string(),
            failure_reason: Some(reason.to_string()),
        };
    }

    FailureDetails {
        failure_class: "pending_fix_failed".to_string(),
        failure_stage: stage.unwrap_or("auto_fix").to_string(),
        retryable: true,
        blocked_action: "automatic issue fix".to_string(),
        remediation:
            "检查目标文件、Gemini 原问题和 Codex 输出；可手动修复后重跑，或手动触发第 3 轮或更多轮让 Codex 继续尝试。"
                .to_string(),
        failure_reason: Some(reason.to_string()),
    }
}

fn is_external_failure(reason: &str) -> bool {
    let lower = reason.to_ascii_lowercase();
    [
        "timeout",
        "timed out",
        "connection",
        "network",
        "github",
        "gh ",
        "rate limit",
        "quota",
        "runner",
        "remaining=",
        "自动修复剩余时间不足",
        "本地 codex 命令超时",
        "断网",
        "额度",
        "连接",
        "gemini 未返回",
        "gemini review 未返回",
    ]
    .iter()
    .any(|needle| lower.contains(needle))
}

fn append_ledger_file(
    repo_root: &str,
    rel_path: &str,
    title: &str,
    entry: &str,
    fixed_files: &mut Vec<String>,
) -> Result<(), Box<dyn std::error::Error>> {
    let _lock = LedgerFileLock::acquire(repo_root, rel_path)?;
    let next = match repo::read_repo_file(repo_root, rel_path) {
        Ok(original) => format!("{}\n{}", original.trim_end(), entry.trim_end()),
        Err(_) => format!("{}\n\n{}", title, entry.trim_end()),
    };
    repo::write_repo_file_creating_parent(repo_root, rel_path, &format!("{}\n", next.trim_end()))?;

    if !fixed_files.iter().any(|f| f == rel_path) {
        fixed_files.push(rel_path.to_string());
    }

    Ok(())
}

struct LedgerFileLock {
    path: PathBuf,
}

impl LedgerFileLock {
    fn acquire(repo_root: &str, rel_path: &str) -> Result<Self, Box<dyn std::error::Error>> {
        let path = PathBuf::from(repo_root).join(format!("{}.lock", rel_path));
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)?;
        }

        let start = Instant::now();
        loop {
            match fs::create_dir(&path) {
                Ok(()) => return Ok(Self { path }),
                Err(err) if err.kind() == std::io::ErrorKind::AlreadyExists => {
                    if start.elapsed() >= LEDGER_LOCK_TIMEOUT {
                        return Err(format!(
                            "timed out waiting for ledger lock `{}`",
                            path.display()
                        )
                        .into());
                    }
                    thread::sleep(LEDGER_LOCK_RETRY);
                }
                Err(err) => return Err(err.into()),
            }
        }
    }
}

impl Drop for LedgerFileLock {
    fn drop(&mut self) {
        let _ = fs::remove_dir(&self.path);
    }
}

fn resolved_summary_for_issue(issue: &ReviewIssue, fix_method: &str) -> String {
    if issue.suggestion.trim().is_empty() {
        format!(
            "修复摘要：通过 {} 更新 `{}`，处理 review 指出的 `{}`。",
            fix_method, issue.file, issue.description
        )
    } else {
        format!(
            "修复摘要：通过 {} 更新 `{}`，按建议处理：{}",
            fix_method, issue.file, issue.suggestion
        )
    }
}

fn latest_failure_reason_for_issue(ctx: &SkillContext, issue_key: &str) -> Option<String> {
    ctx.fix_attempts
        .iter()
        .rev()
        .find(|attempt| attempt.issue_key == issue_key && !attempt.success)
        .and_then(|attempt| attempt.reason.clone())
}

fn fix_method_for_issue(ctx: &SkillContext, issue_key: &str) -> String {
    ctx.fix_attempts
        .iter()
        .rev()
        .find(|attempt| attempt.issue_key == issue_key && attempt.success)
        .map(|attempt| {
            attempt
                .reason
                .as_deref()
                .and_then(|reason| reason.strip_prefix("fix_method:"))
                .unwrap_or(match attempt.stage.as_str() {
                    "patch_apply" | "patch_apply_retry" => "generated_patch",
                    "file_replacement_fallback" => "file_replacement_fallback",
                    _ => "unknown",
                })
                .to_string()
        })
        .unwrap_or_else(|| "not_attempted".to_string())
}

fn related_files_for_issue(
    ctx: &SkillContext,
    issue: &ReviewIssue,
    issue_fixed: bool,
) -> Vec<String> {
    if !issue_fixed {
        return Vec::new();
    }

    if ctx.fixed_files.iter().any(|file| file == &issue.file) {
        vec![issue.file.clone()]
    } else {
        Vec::new()
    }
}

fn markdown_table_cell(value: &str) -> String {
    value
        .replace('|', "\\|")
        .replace('\n', " ")
        .trim()
        .to_string()
}
