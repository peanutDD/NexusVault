use codex_cli::auto_fix_report::build_weekly_failure_report;
use std::fs;
use std::process::Command;

#[test]
fn weekly_report_groups_top_failures_by_reason_file_fallback_and_status() {
    let input = r#"
{"files":["src/a.rs"],"apply_fail_reason":"context_mismatch","fallback_used":false,"final_status":"pending","pending_explanations":[]}
{"files":["src/a.rs"],"apply_fail_reason":"context_mismatch","fallback_used":false,"final_status":"pending","pending_explanations":[]}
{"files":[],"apply_fail_reason":"malformed_diff","fallback_used":true,"final_status":"clean","pending_explanations":["[Medium] `src/b.rs`:20 未自动修复：git apply 重试后仍未能应用补丁: malformed_diff"]}
{"files":["src/c.rs"],"apply_fail_reason":"drift","fallback_used":false,"final_status":"needs-human","pending_explanations":[]}
{"files":["src/d.rs"],"apply_fail_reason":null,"fallback_used":false,"final_status":"clean","pending_explanations":[]}
"#;

    let report = build_weekly_failure_report(input).expect("report should build");

    assert!(report.contains("# Codex Auto-Fix Failure Samples Weekly Report"));
    assert!(report.contains("| 2 | context_mismatch | `src/a.rs` | false | pending |"));
    assert!(report.contains("| 1 | malformed_diff | `src/b.rs` | true | clean |"));
    assert!(report.contains("| 1 | drift | `src/c.rs` | false | needs-human |"));
    assert!(!report.contains("src/d.rs"));
}

#[test]
fn weekly_report_cli_writes_markdown_file() {
    let workspace =
        std::env::temp_dir().join(format!("codex-auto-fix-report-{}", std::process::id()));
    let _ = fs::remove_dir_all(&workspace);
    fs::create_dir_all(&workspace).unwrap();
    let input = workspace.join("auto-fix-results.jsonl");
    let output = workspace.join("weekly-report.md");
    fs::write(
        &input,
        r#"{"files":["src/lib.rs"],"apply_fail_reason":"context_mismatch","fallback_used":false,"final_status":"pending","pending_explanations":[]}
"#,
    )
    .unwrap();

    let command_output = Command::new(env!("CARGO_BIN_EXE_codex-auto-fix"))
        .args([
            "auto-fix-weekly-report",
            "--input",
            input.to_str().unwrap(),
            "--output",
            output.to_str().unwrap(),
        ])
        .output()
        .unwrap();

    assert!(
        command_output.status.success(),
        "stderr={}",
        String::from_utf8_lossy(&command_output.stderr)
    );
    let report = fs::read_to_string(output).unwrap();
    assert!(report.contains("| 1 | context_mismatch | `src/lib.rs` | false | pending |"));
    assert!(String::from_utf8_lossy(&command_output.stdout).contains("wrote"));

    let _ = fs::remove_dir_all(&workspace);
}
