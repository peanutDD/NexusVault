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
        }],
    });

    assert!(entry.contains("| # | Severity | File:line | 原始问题 | Suggestion | Constraints | Auto-fix scope | 状态 | 修复方式 / 失败原因 | 关联文件 | 解决答案 / 未解决原因 |"));
    assert!(entry.contains("| 1 | Low | `src/lib.rs`:12 | 原始问题 | 建议 | 约束 A | not_selected | tracked | not selected | `src/lib.rs` | 审计追踪 |"));
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
