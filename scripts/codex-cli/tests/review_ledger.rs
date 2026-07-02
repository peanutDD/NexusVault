use codex_cli::review_ledger;
use codex_cli::skills::{FixAttempt, SkillContext, SkillContextInit};
use codex_cli::types::{ReviewData, ReviewIssue, ReviewIssueStatus, ReviewLedgerEntryInput};

#[test]
fn scoped_path_is_stable() {
    assert_eq!(
        review_ledger::scoped_path(26),
        "docs/auto-review-ledgers/pr-26.md"
    );
    assert_eq!(
        review_ledger::scoped_path(0),
        "docs/auto-review-ledgers/local.md"
    );
}

#[test]
fn entry_renders_all_audit_columns() {
    let entry = review_ledger::build_entry(&ReviewLedgerEntryInput {
        pr_number: 7,
        round: 2,
        unix_ts: 1_762_877_600,
        summary: Some("full audit".to_string()),
        files: vec!["src/lib.rs".to_string()],
        statuses: vec![ReviewIssueStatus {
            severity: "Low".to_string(),
            file: "src/lib.rs".to_string(),
            line: 12,
            description: "原始问题".to_string(),
            suggestion: "建议".to_string(),
            constraints: vec!["约束 A".to_string()],
            auto_fix_scope: "not_selected".to_string(),
            status: "tracked".to_string(),
            explanation: "审计追踪".to_string(),
            fix_method: "not_attempted".to_string(),
            failure_reason: Some("not selected".to_string()),
            related_files: vec!["src/lib.rs".to_string()],
            failure_class: "blocked_policy".to_string(),
            failure_stage: "decision_filter".to_string(),
            retryable: false,
            blocked_action: "automatic source modification".to_string(),
            remediation: "人工批准修改受保护文件后重跑".to_string(),
        }],
    });

    assert!(entry.contains("| # | Severity | File:line | 原始问题 | Suggestion | Constraints | Auto-fix scope | 状态 | Failure class | Failure stage | Retryable | Blocked action | 修复方式 / 失败原因 | 关联文件 | 解决答案 / 未解决原因 | Remediation |"));
    assert!(entry.contains("| 1 | Low | `src/lib.rs`:12 | 原始问题 | 建议 | 约束 A | not_selected | tracked | blocked_policy | decision_filter | false | automatic source modification | not selected | `src/lib.rs` | 审计追踪 | 人工批准修改受保护文件后重跑 |"));
}

#[test]
fn tracked_low_info_does_not_count_as_pending() {
    let mut ctx = context_with_issues(vec![
        issue("Low", "src/lib.rs", 10, "low issue"),
        issue("Info", "src/main.rs", 20, "info issue"),
    ]);

    let statuses = review_ledger::issue_statuses(&ctx);

    assert_eq!(statuses.len(), 2);
    assert!(statuses.iter().all(|status| status.status == "tracked"));
    assert!(
        statuses
            .iter()
            .all(|status| status.auto_fix_scope == "not_selected")
    );
    assert!(review_ledger::pending_count(&statuses) == 0);

    ctx.selected_issues = vec![issue("Low", "src/lib.rs", 10, "low issue")];
    let statuses = review_ledger::issue_statuses(&ctx);
    assert_eq!(statuses[0].status, "tracked");
}

#[test]
fn resolved_uses_fix_summary() {
    let issue = issue("Medium", "src/lib.rs", 42, "缺少边界校验");
    let issue_key = "src/lib.rs:42:Medium:缺少边界校验".to_string();
    let mut ctx = context_with_issues(vec![issue.clone()]);
    ctx.selected_issues = vec![issue];
    ctx.fixed_issue_keys.push(issue_key.clone());
    ctx.fixed_files.push("src/lib.rs".to_string());
    ctx.fix_attempts.push(FixAttempt {
        round: 1,
        issue_key,
        file: "src/lib.rs".to_string(),
        stage: "patch_apply".to_string(),
        success: true,
        reason: Some("fix_method:search_replace".to_string()),
    });

    let statuses = review_ledger::issue_statuses(&ctx);

    assert_eq!(statuses[0].status, "resolved");
    assert_eq!(statuses[0].fix_method, "search_replace");
    assert!(
        statuses[0]
            .explanation
            .starts_with("修复摘要：通过 search_replace 更新 `src/lib.rs`")
    );
    assert!(statuses[0].explanation.contains("按建议处理：请补充校验"));
}

#[test]
fn push_blocked_status_includes_stage_cause_remediation_and_retryability() {
    let issue = issue("High", "src/lib.rs", 42, "修复后需要发布");
    let issue_key = "src/lib.rs:42:High:修复后需要发布".to_string();
    let mut ctx = context_with_issues(vec![issue.clone()]);
    ctx.selected_issues = vec![issue];
    ctx.fixed_issue_keys.push(issue_key.clone());
    ctx.fixed_files.push("src/lib.rs".to_string());
    ctx.push_blocked = true;
    ctx.pending_explanations.push(
        "自动修复提交前验证或推送失败：CODEX_AUTO_FIX_VERIFY_COMMANDS 验证失败，已阻止自动修复提交/推送。"
            .to_string(),
    );
    ctx.fix_attempts.push(FixAttempt {
        round: 1,
        issue_key,
        file: "src/lib.rs".to_string(),
        stage: "patch_apply".to_string(),
        success: true,
        reason: Some("fix_method:search_replace".to_string()),
    });

    let statuses = review_ledger::issue_statuses(&ctx);

    assert_eq!(statuses[0].status, "blocked_push");
    assert_eq!(statuses[0].failure_class, "blocked_push");
    assert_eq!(statuses[0].failure_stage, "pre-push validation");
    assert!(statuses[0].retryable);
    assert!(statuses[0].blocked_action.contains("commit/push"));
    assert!(
        statuses[0]
            .failure_reason
            .as_deref()
            .unwrap()
            .contains("CODEX_AUTO_FIX_VERIFY_COMMANDS")
    );
    assert!(
        statuses[0]
            .remediation
            .contains("修复验证命令失败原因后重新运行")
    );
}

#[test]
fn external_timeout_status_is_retryable_and_actionable() {
    let issue = issue("Medium", "src/lib.rs", 10, "需要继续修复");
    let issue_key = "src/lib.rs:10:Medium:需要继续修复".to_string();
    let mut ctx = context_with_issues(vec![issue.clone()]);
    ctx.selected_issues = vec![issue];
    ctx.fix_attempts.push(FixAttempt {
        round: 1,
        issue_key,
        file: "src/lib.rs".to_string(),
        stage: "patch_generation".to_string(),
        success: false,
        reason: Some("自动修复剩余时间不足：remaining=10s".to_string()),
    });

    let statuses = review_ledger::issue_statuses(&ctx);

    assert_eq!(statuses[0].status, "blocked_external");
    assert_eq!(statuses[0].failure_class, "blocked_external");
    assert_eq!(statuses[0].failure_stage, "patch_generation");
    assert!(statuses[0].retryable);
    assert!(statuses[0].remediation.contains("手动触发第 3 轮或更多轮"));
}

#[test]
fn policy_filtered_actionable_issue_is_not_clean_or_retryable_without_human_change() {
    let ctx = context_with_issues(vec![issue("Critical", "Cargo.lock", 1, "锁文件问题")]);

    let statuses = review_ledger::issue_statuses(&ctx);

    assert_eq!(statuses[0].status, "blocked_policy");
    assert_eq!(statuses[0].failure_class, "blocked_policy");
    assert!(!statuses[0].retryable);
    assert!(statuses[0].remediation.contains("人工批准"));
}

fn context_with_issues(issues: Vec<ReviewIssue>) -> SkillContext {
    let mut ctx = SkillContext::new(SkillContextInit {
        pr_number: 0,
        repo: "owner/repo".to_string(),
        repo_root: ".".to_string(),
        rules_text: String::new(),
        raw_input: String::new(),
        rounds: 1,
        auto_push: false,
        enable_pr_comments: false,
        changelog_path: None,
        disable_changelog: false,
    });
    ctx.parsed_data = Some(ReviewData {
        summary: "summary".to_string(),
        issues,
    });
    ctx
}

fn issue(severity: &str, file: &str, line: u32, description: &str) -> ReviewIssue {
    ReviewIssue {
        file: file.to_string(),
        line: Some(line),
        severity: severity.to_string(),
        description: description.to_string(),
        suggestion: "请补充校验".to_string(),
        constraints: vec!["只改当前文件".to_string()],
        reason: None,
    }
}
