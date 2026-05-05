use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::process::Command;

#[test]
fn pending_without_fix_blocks_instead_of_claiming_clean() {
    let output = plan(&[
        ("CURRENT_ROUND", "gemini-review-round-1"),
        ("FIXED", "false"),
        ("PUSH_BLOCKED", "false"),
        ("PENDING_COUNT", "2"),
    ]);

    assert_eq!(output["action"], "needs_human");
    assert_eq!(output["request_review"], "false");
    assert_eq!(output["ready_to_merge"], "false");
    assert_eq!(output["human_block"], "true");
}

#[test]
fn clean_first_round_requests_second_review() {
    let output = plan(&[
        ("CURRENT_ROUND", "gemini-review-round-1"),
        ("FIXED", "false"),
        ("PUSH_BLOCKED", "false"),
        ("PENDING_COUNT", "0"),
    ]);

    assert_eq!(output["action"], "advance");
    assert_eq!(output["next_round"], "gemini-review-round-2");
    assert_eq!(output["request_review"], "true");
    assert_eq!(output["ready_to_merge"], "false");
}

#[test]
fn clean_second_round_marks_round_max_ready() {
    let output = plan(&[
        ("CURRENT_ROUND", "gemini-review-round-2"),
        ("FIXED", "false"),
        ("PUSH_BLOCKED", "false"),
        ("PENDING_COUNT", "0"),
    ]);

    assert_eq!(output["action"], "complete");
    assert_eq!(output["next_round"], "gemini-review-round-max");
    assert_eq!(output["request_review"], "false");
    assert_eq!(output["ready_to_merge"], "true");
}

#[test]
fn pushed_partial_fix_continues_to_second_review_but_not_ready() {
    let output = plan(&[
        ("CURRENT_ROUND", "gemini-review-round-1"),
        ("FIXED", "true"),
        ("PUSH_BLOCKED", "false"),
        ("PENDING_COUNT", "1"),
    ]);

    assert_eq!(output["action"], "advance_with_pending");
    assert_eq!(output["next_round"], "gemini-review-round-2");
    assert_eq!(output["request_review"], "true");
    assert_eq!(output["ready_to_merge"], "false");
}

#[test]
fn fail_closed_security_blocks_loop() {
    let output = plan(&[
        ("CURRENT_ROUND", "gemini-review-round-1"),
        ("FIXED", "false"),
        ("PUSH_BLOCKED", "true"),
        ("PENDING_COUNT", "0"),
    ]);

    assert_eq!(output["action"], "push_blocked");
    assert_eq!(output["request_review"], "false");
    assert_eq!(output["human_block"], "true");
}

#[test]
fn codex_auto_fix_concurrency_is_job_scoped() {
    let workflow = fs::read_to_string(codex_auto_fix_workflow())
        .expect("codex auto-fix workflow should be readable");
    let jobs_index = workflow
        .find("jobs:")
        .expect("codex auto-fix workflow should define jobs");
    let top_level = &workflow[..jobs_index];
    let jobs = &workflow[jobs_index..];

    assert!(
        !top_level.contains("\nconcurrency:"),
        "workflow-level concurrency runs before job filters and can cancel actionable review events"
    );
    assert!(
        jobs.contains("    concurrency:\n"),
        "codex-fix job should serialize actionable runs after skipped events are filtered"
    );
    assert!(
        jobs.contains("      cancel-in-progress: false"),
        "codex-fix job should queue actionable review runs instead of canceling in-progress fixes"
    );
}

fn plan(envs: &[(&str, &str)]) -> HashMap<String, String> {
    let script = workflow_script();
    let output = Command::new("bash")
        .arg(script)
        .arg("plan")
        .env("MAX_ROUNDS", "2")
        .envs(envs.iter().copied())
        .output()
        .expect("workflow state script should run");

    assert!(
        output.status.success(),
        "status={:?}\nstdout={}\nstderr={}",
        output.status,
        String::from_utf8_lossy(&output.stdout),
        String::from_utf8_lossy(&output.stderr)
    );

    String::from_utf8_lossy(&output.stdout)
        .lines()
        .filter_map(|line| line.split_once('='))
        .map(|(key, value)| (key.to_string(), value.to_string()))
        .collect()
}

fn workflow_script() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../..")
        .join(".github/scripts/codex-auto-fix-state.sh")
}

fn codex_auto_fix_workflow() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../..")
        .join(".github/workflows/codex-auto-fix.yml")
}
