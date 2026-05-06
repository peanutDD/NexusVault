use std::fs;
use std::path::PathBuf;

fn repo_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .and_then(|p| p.parent())
        .expect("manifest should be under scripts/codex-cli")
        .to_path_buf()
}

#[test]
fn code_review_guide_contains_auto_fix_reviewer_template() {
    let guide = fs::read_to_string(repo_root().join("docs/CODE_REVIEW_GUIDE.md")).unwrap();

    assert!(guide.contains("自动修复友好的 Review 模板"));
    for field in [
        "- Severity:",
        "- File:",
        "- Line:",
        "- Rule:",
        "- Problem:",
        "- Expected:",
        "- Constraints:",
    ] {
        assert!(guide.contains(field), "missing template field {field}");
    }
}

#[test]
fn constraints_record_weekly_report_and_apply_check_policy() {
    let constraint = fs::read_to_string(
        repo_root().join("docs/constraints/C-040-auto-fix-weekly-failure-report.md"),
    )
    .unwrap();

    assert!(constraint.contains("Top 5"));
    assert!(constraint.contains("apply_fail_reason"));
    assert!(constraint.contains("fallback_used"));
    assert!(constraint.contains("final_status"));
    assert!(constraint.contains("git apply --check"));
    assert!(constraint.contains("不得默认增加"));
}
