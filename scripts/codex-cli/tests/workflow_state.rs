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

#[test]
fn codex_auto_fix_passes_review_json_to_auto_fix() {
    let workflow = fs::read_to_string(codex_auto_fix_workflow())
        .expect("codex auto-fix workflow should be readable");

    let extract_index = workflow
        .find("name: 提取 Gemini Review 完整内容")
        .expect("workflow should extract the complete Gemini review first");
    let json_index = workflow
        .find("name: Convert review markdown to JSON primary input")
        .expect("workflow should convert extracted review markdown to primary JSON input");
    let auto_fix_index = workflow
        .find("name: 调用 codex-auto-fix pr-auto-fix")
        .expect("workflow should run codex-auto-fix after JSON validation");

    assert!(
        extract_index < json_index && json_index < auto_fix_index,
        "review extraction should feed JSON validation before auto-fix runs"
    );
    assert!(
        workflow.contains("printf '%s\\n' \"$REVIEW_TEXT\" > /tmp/review.md"),
        "workflow should persist the exact extracted review body for JSON conversion"
    );
    assert!(
        workflow.contains("review-to-json")
            && workflow.contains("--input /tmp/review.md")
            && workflow.contains("--output /tmp/review.json"),
        "workflow should call codex-auto-fix review-to-json on the extracted markdown"
    );
    assert!(
        workflow.contains("REVIEW_JSON_PATH=/tmp/review.json"),
        "workflow should expose the JSON path for downstream observability"
    );
    assert!(
        workflow.contains("--review-json \"$REVIEW_JSON_PATH\""),
        "workflow should drive pr-auto-fix from the validated JSON input"
    );
}

#[test]
fn codex_auto_fix_supports_markdown_rollback_switch() {
    let workflow = fs::read_to_string(codex_auto_fix_workflow())
        .expect("codex auto-fix workflow should be readable");

    assert!(
        workflow.contains("USE_REVIEW_JSON: true"),
        "workflow should default to JSON review input"
    );
    assert!(
        workflow.contains("env.USE_REVIEW_JSON == 'true'"),
        "JSON conversion should be skipped when USE_REVIEW_JSON=false"
    );
    assert!(
        workflow.contains("if [[ \"${USE_REVIEW_JSON}\" == \"true\" ]]"),
        "auto-fix step should branch on the rollback switch"
    );
    assert!(
        workflow.contains("--review-json \"$REVIEW_JSON_PATH\""),
        "JSON branch should pass the validated review JSON"
    );
    assert!(
        workflow.contains("--gemini-review \"$REVIEW_BODY\""),
        "Markdown rollback branch should preserve the previous input path"
    );
    assert!(
        workflow.contains("gemini-review-needs-human"),
        "JSON conversion failures should route to the human fallback label/comment"
    );
}

#[test]
fn state_script_names_medium_and_medium_plus_as_pending_scope() {
    let script =
        fs::read_to_string(workflow_script()).expect("workflow state script should be readable");

    assert!(
        script.contains("pending Medium/Medium+/High/Critical review items"),
        "pending label description should not imply Medium findings are ignored"
    );
    assert!(
        script.contains("no pending Medium/Medium+/High/Critical findings"),
        "clean label description should cover both Medium and Medium+"
    );
    assert!(
        script.contains("Gemini Review 的 Medium/Medium+/High/Critical 问题"),
        "needs-human comment should tell reviewers Medium findings are actionable"
    );
    assert!(
        script.contains("Medium/Medium+/High/Critical 未自动修复说明"),
        "pending comments should cover both Medium and Medium+ findings"
    );
    assert!(
        script.contains("问题清单见上方 Codex 分析评论"),
        "state comments should always tell reviewers where the automatic issue list is"
    );
    assert!(
        script.contains("Medium/Medium+/High/Critical 对应状态"),
        "state comments should point humans to the automatic one-to-one status table"
    );
    assert!(
        !script.contains("medium+ review items"),
        "state labels must not narrow the loop to Medium+ only"
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
