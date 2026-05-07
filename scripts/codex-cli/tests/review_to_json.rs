use codex_cli::review_json::{parse_structured_review, structured_review_to_review_data};
use codex_cli::types::{StructuredReview, StructuredReviewIssue};
use serde_json::Value;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::{SystemTime, UNIX_EPOCH};

#[test]
fn parses_complete_review_with_constraints() {
    let review = r#"## Gemini Code Assist Review

- Severity: Medium
- File: src/lib.rs
- Line: 42
- Rule: no-unused-branch
- Problem: 条件恒为 true。
- Expected: 基于输入判断，避免死分支。
- Constraints:
  - only modify src/lib.rs
  - no signature change
"#;

    let parsed = parse_structured_review(review);

    assert_eq!(parsed.review_id, "");
    assert_eq!(parsed.summary, "1 actionable issues");
    assert_eq!(parsed.issues.len(), 1);
    let issue = &parsed.issues[0];
    assert_eq!(issue.id, "ISSUE-001");
    assert_eq!(issue.severity, "Medium");
    assert_eq!(issue.file, "src/lib.rs");
    assert_eq!(issue.line, 42);
    assert_eq!(issue.rule, "no-unused-branch");
    assert_eq!(issue.problem, "条件恒为 true。");
    assert_eq!(issue.expected, "基于输入判断，避免死分支。");
    assert_eq!(
        issue.constraints,
        vec!["only modify src/lib.rs", "no signature change"]
    );
    assert!(issue.acceptance.is_empty());
}

#[test]
fn assigns_incrementing_ids_skips_incomplete_blocks_and_normalizes_bad_line() {
    let review = r#"- Severity: Medium
- File: src/lib.rs
- Line: abc
- Rule: bad-line
- Problem: Line is not numeric.
- Expected: Normalize line.

- Severity: High
- File: src/skip.rs
- Line: 7
- Problem: Missing expected should be skipped.

- Severity: Critical
- File: src/main.rs
- Line: 9
- Problem: Crash.
- Expected: Avoid crash.
"#;

    let parsed = parse_structured_review(review);

    assert_eq!(parsed.summary, "2 actionable issues");
    assert_eq!(parsed.issues.len(), 2);
    assert_eq!(parsed.issues[0].id, "ISSUE-001");
    assert_eq!(parsed.issues[0].line, 0);
    assert_eq!(parsed.issues[1].id, "ISSUE-002");
    assert_eq!(parsed.issues[1].file, "src/main.rs");
}

#[test]
fn parses_gemini_inline_badge_comments_from_review_body() {
    let review = r#"## Code Review

This pull request has inline comments.

## Inline Review Comments
### frontend/src/components/files/list/FileList.tsx:145
![medium](https://www.gstatic.com/codereviewagent/medium-priority.svg)

The `handleDropOnFolderAdapter` function is recreated on every render.

```suggestion
const handleDropOnFolderAdapter = useCallback(() => {}, []);
```

### frontend/src/components/files/grid/FileCard.tsx:142
![high](https://www.gstatic.com/codereviewagent/high-priority.svg)

Reset the preview suppression flag on every pointer interaction.
"#;

    let parsed = parse_structured_review(review);

    assert_eq!(parsed.summary, "2 actionable issues");
    assert_eq!(parsed.issues.len(), 2);
    assert_eq!(parsed.issues[0].severity, "Medium");
    assert_eq!(
        parsed.issues[0].file,
        "frontend/src/components/files/list/FileList.tsx"
    );
    assert_eq!(parsed.issues[0].line, 145);
    assert!(
        parsed.issues[0]
            .problem
            .contains("recreated on every render")
    );
    assert!(parsed.issues[0].expected.contains("useCallback"));
    assert_eq!(parsed.issues[1].severity, "High");
    assert_eq!(
        parsed.issues[1].file,
        "frontend/src/components/files/grid/FileCard.tsx"
    );
    assert_eq!(parsed.issues[1].line, 142);
}

#[test]
fn review_to_json_cli_writes_output_file_and_stdout_json() {
    let workspace = TestWorkspace::new("review-to-json");
    let input = workspace.path.join("review.md");
    let output = workspace.path.join("review.json");
    fs::write(
        &input,
        r#"- Severity: Medium+
- File: src/lib.rs
- Line: 3
- Rule: literal-medium-plus
- Problem: Medium+ should remain literal.
- Expected: Preserve severity.
"#,
    )
    .unwrap();

    let command_output = Command::new(env!("CARGO_BIN_EXE_codex-auto-fix"))
        .args([
            "review-to-json",
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

    let stdout_json: Value =
        serde_json::from_slice(&command_output.stdout).expect("stdout must be JSON");
    let file_json: Value =
        serde_json::from_str(&fs::read_to_string(&output).unwrap()).expect("file must be JSON");
    assert_eq!(stdout_json, file_json);
    assert_eq!(stdout_json["issues"][0]["id"], "ISSUE-001");
    assert_eq!(stdout_json["issues"][0]["severity"], "Medium+");
}

#[test]
fn review_to_json_shell_wrapper_matches_cli_output() {
    let workspace = TestWorkspace::new("review-to-json-wrapper");
    let input = workspace.path.join("review.md");
    let wrapper_output = workspace.path.join("wrapper.json");
    let cli_output = workspace.path.join("cli.json");
    fs::write(
        &input,
        r#"- Severity: Medium
- File: src/lib.rs
- Line: 42
- Rule: no-unused-branch
- Problem: 条件恒为 true。
- Expected: 基于输入判断，避免死分支。
- Constraints:
  - only modify src/lib.rs
  - no signature change
"#,
    )
    .unwrap();

    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let script = manifest_dir.join("tools/review_to_json.sh");
    assert!(
        script.exists(),
        "shell wrapper should exist at {:?}",
        script
    );

    let wrapper_result = Command::new("bash")
        .arg(&script)
        .args([
            "--input",
            input.to_str().unwrap(),
            "--output",
            wrapper_output.to_str().unwrap(),
        ])
        .output()
        .unwrap();
    assert!(
        wrapper_result.status.success(),
        "stderr={}",
        String::from_utf8_lossy(&wrapper_result.stderr)
    );

    let cli_result = Command::new(env!("CARGO_BIN_EXE_codex-auto-fix"))
        .args([
            "review-to-json",
            "--input",
            input.to_str().unwrap(),
            "--output",
            cli_output.to_str().unwrap(),
        ])
        .output()
        .unwrap();
    assert!(
        cli_result.status.success(),
        "stderr={}",
        String::from_utf8_lossy(&cli_result.stderr)
    );

    assert_eq!(
        fs::read_to_string(wrapper_output).unwrap(),
        fs::read_to_string(cli_output).unwrap()
    );
}

#[test]
fn structured_review_to_review_data_preserves_constraints() {
    let review = StructuredReview {
        review_id: "review-1".to_string(),
        summary: "summary".to_string(),
        issues: vec![StructuredReviewIssue {
            id: "ISSUE-001".to_string(),
            severity: "Medium".to_string(),
            file: "src/lib.rs".to_string(),
            line: 7,
            rule: "bounded-change".to_string(),
            problem: "fix value".to_string(),
            expected: "return 2".to_string(),
            constraints: vec![
                "only modify src/lib.rs".to_string(),
                "no signature change".to_string(),
            ],
            acceptance: vec![],
        }],
    };

    let data = structured_review_to_review_data(review);

    assert_eq!(data.summary, "summary");
    assert_eq!(data.issues.len(), 1);
    assert_eq!(
        data.issues[0].constraints,
        vec!["only modify src/lib.rs", "no signature change"]
    );
    assert!(data.issues[0].suggestion.contains("return 2"));
}

struct TestWorkspace {
    path: PathBuf,
}

impl TestWorkspace {
    fn new(name: &str) -> Self {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let path = std::env::temp_dir().join(format!("codex-cli-{name}-{now}"));
        fs::create_dir_all(&path).unwrap();
        Self { path }
    }
}

impl Drop for TestWorkspace {
    fn drop(&mut self) {
        if Path::new(&self.path).exists() {
            let _ = fs::remove_dir_all(&self.path);
        }
    }
}
