use serde_json::Value;
use std::fs;
use std::os::unix::fs::PermissionsExt;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::{SystemTime, UNIX_EPOCH};

#[test]
fn auto_fix_local_applies_patch_with_local_codex_command() {
    let workspace = TestWorkspace::new("success");
    let repo = workspace.create_repo();
    write_repo_file(&repo, "src/lib.rs", "pub fn value() -> i32 {\n    1\n}\n");
    write_repo_file(
        &repo,
        "AGENTS.md",
        "只修复 Gemini Review 指出的代码问题。\n",
    );
    workspace.git(&repo, &["add", "."]);
    workspace.git(&repo, &["commit", "-m", "initial"]);

    let review = workspace.path.join("review.md");
    fs::write(
        &review,
        "## Gemini Code Assist Review\n\nMedium: fix value.\n",
    )
    .unwrap();
    let fake_agent = workspace.fake_agent("success");

    let output = run_auto_fix(&repo, &review, &fake_agent, false);
    assert!(output.status.success(), "stderr={}", stderr(&output));

    let json = parse_stdout(&output);
    assert_eq!(json["fixed"], true);
    assert_eq!(json["security_passed"], true);
    assert_eq!(json["push_blocked"], false);
    assert_eq!(json["has_pending"], false);
    assert_eq!(json["pending_count"], 0);
    assert_eq!(json["review_clean"], true);
    assert_eq!(json["quality_score"], 95);
    assert_eq!(json["files"][0], "src/lib.rs");

    let updated = fs::read_to_string(repo.join("src/lib.rs")).unwrap();
    assert_eq!(updated, "pub fn value() -> i32 {\n    2\n}\n");
}

#[test]
fn auto_fix_local_prefers_search_replace_blocks() {
    let workspace = TestWorkspace::new("sr-success");
    let repo = workspace.create_repo();
    write_repo_file(&repo, "src/lib.rs", "pub fn value() -> i32 {\n    1\n}\n");
    write_repo_file(
        &repo,
        "AGENTS.md",
        "只修复 Gemini Review 指出的代码问题。\n",
    );
    workspace.git(&repo, &["add", "."]);
    workspace.git(&repo, &["commit", "-m", "initial"]);

    let review = workspace.path.join("review.md");
    fs::write(
        &review,
        "## Gemini Code Assist Review\n\nMedium: fix value.\n",
    )
    .unwrap();
    let fake_agent = workspace.fake_agent("sr_success");

    let output = run_auto_fix(&repo, &review, &fake_agent, false);
    assert!(output.status.success(), "stderr={}", stderr(&output));

    let json = parse_stdout(&output);
    assert_eq!(json["fixed"], true);
    assert_eq!(json["retry_count"], 0);
    assert_eq!(json["fallback_used"], false);

    let updated = fs::read_to_string(repo.join("src/lib.rs")).unwrap();
    assert_eq!(updated, "pub fn value() -> i32 {\n    2\n}\n");
}

#[test]
fn auto_fix_local_uses_review_json_as_primary_input() {
    let workspace = TestWorkspace::new("json-primary");
    let repo = workspace.create_repo();
    write_repo_file(&repo, "src/lib.rs", "pub fn value() -> i32 {\n    1\n}\n");
    write_repo_file(
        &repo,
        "AGENTS.md",
        "只修复 Gemini Review JSON 指出的代码问题。\n",
    );
    workspace.git(&repo, &["add", "."]);
    workspace.git(&repo, &["commit", "-m", "initial"]);

    let review_json = workspace.path.join("review.json");
    fs::write(
        &review_json,
        r#"{
  "review_id": "",
  "summary": "1 actionable issues",
  "issues": [
    {
      "id": "ISSUE-001",
      "severity": "Medium",
      "file": "src/lib.rs",
      "line": 1,
      "rule": "test-json-primary",
      "problem": "fix value",
      "expected": "return 2",
      "constraints": ["only modify src/lib.rs"],
      "acceptance": []
    }
  ]
}
"#,
    )
    .unwrap();
    let fake_agent = workspace.fake_agent("json_primary");

    let output = run_auto_fix_json(&repo, &review_json, &fake_agent, false);
    assert!(output.status.success(), "stderr={}", stderr(&output));

    let json = parse_stdout(&output);
    assert_eq!(json["fixed"], true);
    assert_eq!(json["summary"], "1 actionable issues");
    assert_eq!(json["has_pending"], false);
    assert_eq!(json["pending_count"], 0);

    let updated = fs::read_to_string(repo.join("src/lib.rs")).unwrap();
    assert_eq!(updated, "pub fn value() -> i32 {\n    2\n}\n");
}

#[test]
fn auto_fix_local_records_review_issue_solution_ledger_when_docs_enabled() {
    let workspace = TestWorkspace::new("review-ledger");
    let repo = workspace.create_repo();
    write_repo_file(&repo, "src/lib.rs", "pub fn value() -> i32 {\n    1\n}\n");
    write_repo_file(
        &repo,
        "AGENTS.md",
        "只修复 Gemini Review 指出的代码问题，并记录每条问题的解决状态。\n",
    );
    workspace.git(&repo, &["add", "."]);
    workspace.git(&repo, &["commit", "-m", "initial"]);

    let review = workspace.path.join("review.md");
    fs::write(
        &review,
        "## Gemini Code Assist Review\n\nMedium: fix value.\n",
    )
    .unwrap();
    let fake_agent = workspace.fake_agent("success");

    let output = run_auto_fix_with_docs(&repo, &review, &fake_agent, false);
    assert!(output.status.success(), "stderr={}", stderr(&output));

    let json = parse_stdout(&output);
    assert_eq!(json["fixed"], true);
    assert_eq!(json["review_record_path"], "docs/auto-review-ledger.md");
    assert!(
        json["files"]
            .as_array()
            .unwrap()
            .iter()
            .any(|file| { file.as_str() == Some("docs/auto-review-ledger.md") })
    );

    let ledger = fs::read_to_string(repo.join("docs/auto-review-ledger.md")).unwrap();
    assert!(ledger.contains("Medium"));
    assert!(ledger.contains("fix value"));
    assert!(ledger.contains("resolved"));
    assert!(ledger.contains("已自动修复"));
    assert!(ledger.contains("src/lib.rs"));
    assert!(ledger.contains("修改文件"));
}

#[test]
fn pr_auto_fix_posts_issue_status_checklist_comment_in_dry_run() {
    let workspace = TestWorkspace::new("pr-comment-checklist");
    let repo = workspace.create_repo();
    write_repo_file(
        &repo,
        "src/lib.rs",
        "pub fn value() -> i32 {\n    1\n}\n\npub fn other() -> i32 {\n    3\n}\n",
    );
    write_repo_file(
        &repo,
        "AGENTS.md",
        "只修复 Gemini Review 指出的问题，并在 PR 评论区逐项标记状态。\n",
    );
    workspace.git(&repo, &["add", "."]);
    workspace.git(&repo, &["commit", "-m", "initial"]);

    let review = workspace.path.join("review.md");
    fs::write(
        &review,
        "## Gemini Code Assist Review\n\nTwo Medium comments in one file.\n",
    )
    .unwrap();
    let fake_agent = workspace.fake_agent("same_file_partial");
    let fake_gh = workspace.fake_gh();
    let gh_comment = workspace.path.join("gh-comment.md");

    let output =
        run_pr_auto_fix_with_fake_gh(&repo, &review, &fake_agent, &fake_gh, &gh_comment, false);
    assert!(output.status.success(), "stderr={}", stderr(&output));

    let json = parse_stdout(&output);
    assert_eq!(json["fixed"], true);
    assert_eq!(json["has_pending"], true);
    assert_eq!(json["issue_statuses"][0]["status"], "resolved");
    assert_eq!(json["issue_statuses"][1]["status"], "pending");

    let comment = fs::read_to_string(gh_comment).unwrap();
    assert!(comment.contains("Codex 已在本地生成并应用补丁"));
    assert!(comment.contains("📋 Medium/Medium+/High/Critical 对应状态"));
    assert!(comment.contains("| # | Gemini 问题 | 状态 | 说明 |"));
    assert!(comment.contains("✅ 已解决"));
    assert!(comment.contains("🧭 未解决"));
    assert!(comment.contains("✅ 已解决明细"));
    assert!(comment.contains("🧭 未解决明细"));
    assert!(comment.contains("fix value"));
    assert!(comment.contains("fix other"));
}

#[test]
fn auto_fix_local_warns_but_pushes_when_security_audit_fails() {
    let workspace = TestWorkspace::new("security-warn");
    let repo = workspace.create_repo();
    write_repo_file(&repo, "src/lib.rs", "pub fn value() -> i32 {\n    1\n}\n");
    write_repo_file(
        &repo,
        "AGENTS.md",
        "只修复 Gemini Review 指出的代码问题。\n",
    );
    workspace.git(&repo, &["add", "."]);
    workspace.git(&repo, &["commit", "-m", "initial"]);
    let remote = workspace.create_bare_remote();
    workspace.git(
        &repo,
        &["remote", "add", "origin", remote.to_str().unwrap()],
    );
    workspace.git(&repo, &["push", "-u", "origin", "HEAD"]);

    let review = workspace.path.join("review.md");
    fs::write(
        &review,
        "## Gemini Code Assist Review\n\nMedium: fix value.\n",
    )
    .unwrap();
    let fake_agent = workspace.fake_agent("security_fail");

    let output = run_auto_fix(&repo, &review, &fake_agent, true);
    assert!(output.status.success(), "stderr={}", stderr(&output));

    let json = parse_stdout(&output);
    assert_eq!(json["fixed"], true);
    assert_eq!(json["security_passed"], false);
    assert_eq!(json["push_blocked"], false);
    assert_eq!(json["has_pending"], true);
    assert_eq!(json["pending_count"], 1);
    assert_eq!(json["review_clean"], false);
    assert_eq!(json["final_status"], "pending");
    let pending = json["pending_explanations"].as_array().unwrap();
    assert_eq!(pending.len(), 1);
    assert!(
        pending[0]
            .as_str()
            .unwrap()
            .contains("synthetic security finding")
    );
    assert_eq!(json["fixed_explanations"].as_array().unwrap().len(), 1);
    assert_eq!(json["issue_statuses"][0]["status"], "resolved");
    assert!(
        json["issue_statuses"][0]["explanation"]
            .as_str()
            .unwrap()
            .contains("已自动修复")
    );

    let commit_count = workspace.git_stdout(&repo, &["rev-list", "--count", "HEAD"]);
    assert_eq!(commit_count.trim(), "2");
    let updated = fs::read_to_string(repo.join("src/lib.rs")).unwrap();
    assert_eq!(updated, "pub fn value() -> i32 {\n    2\n}\n");
}

#[test]
fn auto_fix_local_reports_unfixed_same_file_issue_independently() {
    let workspace = TestWorkspace::new("same-file");
    let repo = workspace.create_repo();
    write_repo_file(
        &repo,
        "src/lib.rs",
        "pub fn value() -> i32 {\n    1\n}\n\npub fn other() -> i32 {\n    3\n}\n",
    );
    write_repo_file(
        &repo,
        "AGENTS.md",
        "只修复 Gemini Review 指出的代码问题。\n",
    );
    workspace.git(&repo, &["add", "."]);
    workspace.git(&repo, &["commit", "-m", "initial"]);

    let review = workspace.path.join("review.md");
    fs::write(
        &review,
        "## Gemini Code Assist Review\n\nTwo Medium comments in one file.\n",
    )
    .unwrap();
    let fake_agent = workspace.fake_agent("same_file_partial");

    let output = run_auto_fix(&repo, &review, &fake_agent, false);
    assert!(output.status.success(), "stderr={}", stderr(&output));

    let json = parse_stdout(&output);
    assert_eq!(json["fixed"], true);
    assert_eq!(json["has_pending"], true);
    assert_eq!(json["pending_count"], 1);
    assert_eq!(json["review_clean"], false);
    let pending = json["pending_explanations"].as_array().unwrap();
    assert_eq!(pending.len(), 1);
    assert!(pending[0].as_str().unwrap().contains("`:5"));
    assert!(pending[0].as_str().unwrap().contains("模型未返回可应用"));
    let fixed = json["fixed_explanations"].as_array().unwrap();
    assert_eq!(fixed.len(), 1);
    assert!(fixed[0].as_str().unwrap().contains("`:1"));
    assert!(fixed[0].as_str().unwrap().contains("已自动修复"));
    let statuses = json["issue_statuses"].as_array().unwrap();
    assert_eq!(statuses.len(), 2);
    assert_eq!(statuses[0]["status"], "resolved");
    assert_eq!(statuses[0]["line"], 1);
    assert!(
        statuses[0]["explanation"]
            .as_str()
            .unwrap()
            .contains("已自动修复")
    );
    assert_eq!(statuses[1]["status"], "pending");
    assert_eq!(statuses[1]["line"], 5);
    assert!(
        statuses[1]["explanation"]
            .as_str()
            .unwrap()
            .contains("模型未返回可应用")
    );
}

#[test]
fn auto_fix_local_retries_patch_generation_after_apply_failure() {
    let workspace = TestWorkspace::new("apply-retry");
    let repo = workspace.create_repo();
    write_repo_file(&repo, "src/lib.rs", "pub fn value() -> i32 {\n    1\n}\n");
    write_repo_file(
        &repo,
        "AGENTS.md",
        "只修复 Gemini Review 指出的代码问题。\n",
    );
    workspace.git(&repo, &["add", "."]);
    workspace.git(&repo, &["commit", "-m", "initial"]);

    let review = workspace.path.join("review.md");
    fs::write(
        &review,
        "## Gemini Code Assist Review\n\nMedium: fix value.\n",
    )
    .unwrap();
    let fake_agent = workspace.fake_agent("apply_retry");

    let output = run_auto_fix(&repo, &review, &fake_agent, false);
    assert!(output.status.success(), "stderr={}", stderr(&output));

    let json = parse_stdout(&output);
    assert_eq!(json["fixed"], true);
    assert_eq!(json["has_pending"], false);
    assert_eq!(json["pending_count"], 0);
    assert_eq!(json["review_clean"], true);
    assert_eq!(json["pending_explanations"].as_array().unwrap().len(), 0);

    let updated = fs::read_to_string(repo.join("src/lib.rs")).unwrap();
    assert_eq!(updated, "pub fn value() -> i32 {\n    2\n}\n");
    assert!(
        stderr(&output).contains("补丁应用失败，准备重试"),
        "stderr={}",
        stderr(&output)
    );
}

#[test]
fn retry_prompt_includes_apply_stderr_latest_source_and_budget() {
    let workspace = TestWorkspace::new("retry-prompt-context");
    let repo = workspace.create_repo();
    write_repo_file(&repo, "src/lib.rs", "pub fn value() -> i32 {\n    1\n}\n");
    write_repo_file(
        &repo,
        "AGENTS.md",
        "只修复 Gemini Review 指出的代码问题。\n",
    );
    workspace.git(&repo, &["add", "."]);
    workspace.git(&repo, &["commit", "-m", "initial"]);

    let review = workspace.path.join("review.md");
    fs::write(
        &review,
        "## Gemini Code Assist Review\n\nMedium: fix value.\n",
    )
    .unwrap();
    let fake_agent = workspace.fake_agent("retry_prompt_context");

    let output = run_auto_fix(&repo, &review, &fake_agent, false);
    assert!(output.status.success(), "stderr={}", stderr(&output));

    let json = parse_stdout(&output);
    assert_eq!(json["fixed"], true);
    assert_eq!(json["retry_count"], 1);
    assert_eq!(json["apply_fail_reason"], "context_mismatch");

    let updated = fs::read_to_string(repo.join("src/lib.rs")).unwrap();
    assert_eq!(updated, "pub fn value() -> i32 {\n    2\n}\n");
}

#[test]
fn full_file_fallback_allows_large_files() {
    let workspace = TestWorkspace::new("large-fallback-allowed");
    let repo = workspace.create_repo();
    let mut large_file = String::new();
    large_file.push_str("pub fn value() -> i32 {\n    1\n}\n");
    for i in 0..301 {
        large_file.push_str(&format!("// filler {i}\n"));
    }
    write_repo_file(&repo, "src/lib.rs", &large_file);
    write_repo_file(
        &repo,
        "AGENTS.md",
        "只修复 Gemini Review 指出的代码问题。\n",
    );
    workspace.git(&repo, &["add", "."]);
    workspace.git(&repo, &["commit", "-m", "initial"]);

    let review = workspace.path.join("review.md");
    fs::write(
        &review,
        "## Gemini Code Assist Review\n\nMedium: fix value.\n",
    )
    .unwrap();
    let fake_agent = workspace.fake_agent("full_file_fallback_large");

    let output = run_auto_fix(&repo, &review, &fake_agent, false);
    assert!(output.status.success(), "stderr={}", stderr(&output));

    let json = parse_stdout(&output);
    assert_eq!(json["fixed"], true);
    assert_eq!(json["fallback_used"], true);
    assert_eq!(json["final_status"], "clean");
    assert_eq!(json["pending_count"], 0);

    let updated = fs::read_to_string(repo.join("src/lib.rs")).unwrap();
    assert_eq!(updated, "pub fn value() -> i32 {\n    2\n}\n");
}

#[test]
fn malformed_diff_goes_directly_to_full_file_fallback_without_retry_patch() {
    let workspace = TestWorkspace::new("malformed-direct-fallback");
    let repo = workspace.create_repo();
    write_repo_file(&repo, "src/lib.rs", "pub fn value() -> i32 {\n    1\n}\n");
    write_repo_file(
        &repo,
        "AGENTS.md",
        "只修复 Gemini Review 指出的代码问题。\n",
    );
    workspace.git(&repo, &["add", "."]);
    workspace.git(&repo, &["commit", "-m", "initial"]);

    let review = workspace.path.join("review.md");
    fs::write(
        &review,
        "## Gemini Code Assist Review\n\nMedium: fix value.\n",
    )
    .unwrap();
    let fake_agent = workspace.fake_agent("malformed_direct_fallback");

    let output = run_auto_fix(&repo, &review, &fake_agent, false);
    assert!(output.status.success(), "stderr={}", stderr(&output));

    let json = parse_stdout(&output);
    assert_eq!(json["fixed"], true);
    assert_eq!(json["fallback_used"], true);
    assert_eq!(json["retry_count"], 0);
    assert!(
        stderr(&output).contains("补丁格式无效，直接尝试完整文件兜底"),
        "stderr={}",
        stderr(&output)
    );

    let updated = fs::read_to_string(repo.join("src/lib.rs")).unwrap();
    assert_eq!(updated, "pub fn value() -> i32 {\n    2\n}\n");
}

#[test]
fn output_json_exposes_retry_fallback_and_final_status_metrics() {
    let workspace = TestWorkspace::new("metrics");
    let repo = workspace.create_repo();
    write_repo_file(&repo, "src/lib.rs", "pub fn value() -> i32 {\n    1\n}\n");
    write_repo_file(
        &repo,
        "AGENTS.md",
        "只修复 Gemini Review 指出的代码问题。\n",
    );
    workspace.git(&repo, &["add", "."]);
    workspace.git(&repo, &["commit", "-m", "initial"]);

    let review = workspace.path.join("review.md");
    fs::write(
        &review,
        "## Gemini Code Assist Review\n\nMedium: fix value.\n",
    )
    .unwrap();
    let fake_agent = workspace.fake_agent("full_file_fallback");

    let output = run_auto_fix(&repo, &review, &fake_agent, false);
    assert!(output.status.success(), "stderr={}", stderr(&output));

    let json = parse_stdout(&output);
    assert_eq!(json["fixed"], true);
    assert_eq!(json["retry_count"], 0);
    assert_eq!(json["fallback_used"], true);
    assert_eq!(json["final_status"], "clean");
    assert_eq!(json["apply_fail_reason"], "malformed_diff");
}

#[test]
fn auto_fix_local_falls_back_to_full_file_after_corrupt_patch_retry() {
    let workspace = TestWorkspace::new("full-file-fallback");
    let repo = workspace.create_repo();
    write_repo_file(&repo, "src/lib.rs", "pub fn value() -> i32 {\n    1\n}\n");
    write_repo_file(
        &repo,
        "AGENTS.md",
        "只修复 Gemini Review 指出的代码问题。\n",
    );
    workspace.git(&repo, &["add", "."]);
    workspace.git(&repo, &["commit", "-m", "initial"]);

    let review = workspace.path.join("review.md");
    fs::write(
        &review,
        "## Gemini Code Assist Review\n\nMedium: fix value.\n",
    )
    .unwrap();
    let fake_agent = workspace.fake_agent("full_file_fallback");

    let output = run_auto_fix(&repo, &review, &fake_agent, false);
    assert!(output.status.success(), "stderr={}", stderr(&output));

    let json = parse_stdout(&output);
    assert_eq!(json["fixed"], true);
    assert_eq!(json["has_pending"], false);
    assert_eq!(json["pending_count"], 0);
    assert_eq!(json["review_clean"], true);

    let updated = fs::read_to_string(repo.join("src/lib.rs")).unwrap();
    assert_eq!(updated, "pub fn value() -> i32 {\n    2\n}\n");
    assert!(
        stderr(&output).contains("完整文件兜底"),
        "stderr={}",
        stderr(&output)
    );
}

fn run_auto_fix(repo: &Path, review: &Path, fake_agent: &Path, yes: bool) -> std::process::Output {
    let mut command = Command::new(env!("CARGO_BIN_EXE_codex-auto-fix"));
    command
        .args([
            "auto-fix-local",
            "--repo-root",
            repo.to_str().unwrap(),
            "--review-file",
            review.to_str().unwrap(),
            "--disable-changelog",
            "--max-rounds",
            "2",
        ])
        .env("CODEX_AGENT_COMMAND", fake_agent)
        .env("CODEX_AGENT_TIMEOUT_SECONDS", "30");
    if yes {
        command.arg("--yes");
    }
    command.output().unwrap()
}

fn run_auto_fix_with_docs(
    repo: &Path,
    review: &Path,
    fake_agent: &Path,
    yes: bool,
) -> std::process::Output {
    let mut command = Command::new(env!("CARGO_BIN_EXE_codex-auto-fix"));
    command
        .args([
            "auto-fix-local",
            "--repo-root",
            repo.to_str().unwrap(),
            "--review-file",
            review.to_str().unwrap(),
            "--max-rounds",
            "2",
        ])
        .env("CODEX_AGENT_COMMAND", fake_agent)
        .env("CODEX_AGENT_TIMEOUT_SECONDS", "30");
    if yes {
        command.arg("--yes");
    }
    command.output().unwrap()
}

fn run_auto_fix_json(
    repo: &Path,
    review_json: &Path,
    fake_agent: &Path,
    yes: bool,
) -> std::process::Output {
    let mut command = Command::new(env!("CARGO_BIN_EXE_codex-auto-fix"));
    command
        .args([
            "auto-fix-local",
            "--repo-root",
            repo.to_str().unwrap(),
            "--review-json",
            review_json.to_str().unwrap(),
            "--disable-changelog",
            "--max-rounds",
            "2",
        ])
        .env("CODEX_AGENT_COMMAND", fake_agent)
        .env("CODEX_AGENT_TIMEOUT_SECONDS", "30");
    if yes {
        command.arg("--yes");
    }
    command.output().unwrap()
}

fn run_pr_auto_fix_with_fake_gh(
    repo: &Path,
    review: &Path,
    fake_agent: &Path,
    fake_gh: &Path,
    gh_comment: &Path,
    yes: bool,
) -> std::process::Output {
    let mut command = Command::new(env!("CARGO_BIN_EXE_codex-auto-fix"));
    let path = std::env::var("PATH")
        .map(|current| format!("{}:{}", fake_gh.parent().unwrap().display(), current))
        .unwrap_or_else(|_| fake_gh.parent().unwrap().display().to_string());
    command
        .args([
            "pr-auto-fix",
            "--pr-number",
            "24",
            "--repo-root",
            repo.to_str().unwrap(),
            "--gemini-review",
            review.to_str().unwrap(),
            "--disable-changelog",
            "--max-rounds",
            "2",
        ])
        .env("PATH", path)
        .env("CODEX_AGENT_COMMAND", fake_agent)
        .env("CODEX_AGENT_TIMEOUT_SECONDS", "30")
        .env("FAKE_GH_COMMENT_PATH", gh_comment);
    if yes {
        command.arg("--yes");
    }
    command.output().unwrap()
}

fn parse_stdout(output: &std::process::Output) -> Value {
    let stdout = String::from_utf8_lossy(&output.stdout);
    serde_json::from_str(stdout.trim()).unwrap_or_else(|e| {
        panic!(
            "stdout was not JSON: {e}\nstdout={stdout}\nstderr={}",
            stderr(output)
        )
    })
}

fn stderr(output: &std::process::Output) -> String {
    String::from_utf8_lossy(&output.stderr).to_string()
}

fn write_repo_file(repo: &Path, path: &str, content: &str) {
    let abs = repo.join(path);
    fs::create_dir_all(abs.parent().unwrap()).unwrap();
    fs::write(abs, content).unwrap();
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
        let path = std::env::temp_dir().join(format!("codex-cli-e2e-{name}-{now}"));
        fs::create_dir_all(&path).unwrap();
        Self { path }
    }

    fn create_repo(&self) -> PathBuf {
        let repo = self.path.join("repo");
        fs::create_dir_all(&repo).unwrap();
        self.git(&repo, &["init"]);
        self.git(&repo, &["config", "user.name", "Codex Test"]);
        self.git(
            &repo,
            &["config", "user.email", "codex-test@example.invalid"],
        );
        repo
    }

    fn create_bare_remote(&self) -> PathBuf {
        let remote = self.path.join("remote.git");
        let output = Command::new("git")
            .arg("init")
            .arg("--bare")
            .arg(&remote)
            .output()
            .unwrap();
        assert!(
            output.status.success(),
            "git init --bare failed\nstdout={}\nstderr={}",
            String::from_utf8_lossy(&output.stdout),
            String::from_utf8_lossy(&output.stderr)
        );
        remote
    }

    fn fake_agent(&self, mode: &str) -> PathBuf {
        let path = self.path.join(format!("fake-agent-{mode}.sh"));
        let script = fake_agent_script(mode);
        fs::write(&path, script).unwrap();
        let mut permissions = fs::metadata(&path).unwrap().permissions();
        permissions.set_mode(0o755);
        fs::set_permissions(&path, permissions).unwrap();
        path
    }

    fn fake_gh(&self) -> PathBuf {
        let path = self.path.join("gh");
        fs::write(
            &path,
            r#"#!/bin/sh
set -eu
if [ "$1" = "pr" ] && [ "$2" = "comment" ]; then
  shift 3
  while [ "$#" -gt 0 ]; do
    case "$1" in
      --body)
        printf '%s' "$2" > "$FAKE_GH_COMMENT_PATH"
        exit 0
        ;;
    esac
    shift
  done
fi
printf '%s\n' "unexpected gh invocation: $*" >&2
exit 1
"#,
        )
        .unwrap();
        let mut permissions = fs::metadata(&path).unwrap().permissions();
        permissions.set_mode(0o755);
        fs::set_permissions(&path, permissions).unwrap();
        path
    }

    fn git(&self, repo: &Path, args: &[&str]) {
        let output = Command::new("git")
            .arg("-C")
            .arg(repo)
            .args(args)
            .output()
            .unwrap();
        assert!(
            output.status.success(),
            "git {:?} failed\nstdout={}\nstderr={}",
            args,
            String::from_utf8_lossy(&output.stdout),
            String::from_utf8_lossy(&output.stderr)
        );
    }

    fn git_stdout(&self, repo: &Path, args: &[&str]) -> String {
        let output = Command::new("git")
            .arg("-C")
            .arg(repo)
            .args(args)
            .output()
            .unwrap();
        assert!(output.status.success(), "git {:?} failed", args);
        String::from_utf8_lossy(&output.stdout).to_string()
    }
}

impl Drop for TestWorkspace {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.path);
    }
}

fn fake_agent_script(mode: &str) -> String {
    format!(
        r#"#!/bin/sh
set -eu
prompt="$(cat)"
mode="{mode}"

case "$prompt" in
  *"代码审查专家"*)
    if [ "$mode" = "json_primary" ]; then
      printf '%s\n' 'json_primary mode must not invoke Markdown review parsing' >&2
      exit 42
    fi
    if [ "$mode" = "same_file_partial" ]; then
      printf '%s\n' '{{"summary":"two same-file issues","issues":[{{"severity":"Medium","file":"src/lib.rs","line":1,"description":"fix value","suggestion":"","reason":"first"}},{{"severity":"Medium","file":"src/lib.rs","line":5,"description":"fix other","suggestion":"","reason":"second"}}]}}'
    else
      printf '%s\n' '{{"summary":"one medium issue","issues":[{{"severity":"Medium","file":"src/lib.rs","line":1,"description":"fix value","suggestion":"","reason":"review text"}}]}}'
    fi
    ;;
  *"高级工程师"*)
    if [ "$mode" = "sr_success" ]; then
      printf '%s' "$prompt" | grep -q "SEARCH/REPLACE block" || exit 70
      printf '%s' "$prompt" | grep -q '### File: src/lib.rs' || exit 71
      cat <<'PATCH'
### File: src/lib.rs
<<<<<<< SEARCH
pub fn value() -> i32 {{
    1
}}
=======
pub fn value() -> i32 {{
    2
}}
>>>>>>> REPLACE
PATCH
      exit 0
    fi
    if [ "$mode" = "full_file_fallback" ]; then
      if printf '%s' "$prompt" | grep -q "完整目标文件内容"; then
        cat <<'FILE'
pub fn value() -> i32 {{
    2
}}
FILE
      else
        cat <<'PATCH'
diff --git a/src/lib.rs b/src/lib.rs
--- a/src/lib.rs
+++ b/src/lib.rs
@@ -1,3 +1,3
 pub fn value() -> i32 {{
-    1
+    2
 }}
PATCH
      fi
      exit 0
    fi
    if [ "$mode" = "apply_retry" ]; then
      if printf '%s' "$prompt" | grep -q "上一版补丁应用失败"; then
        cat <<'PATCH'
diff --git a/src/lib.rs b/src/lib.rs
--- a/src/lib.rs
+++ b/src/lib.rs
@@ -1,3 +1,3 @@
 pub fn value() -> i32 {{
-    1
+    2
 }}
PATCH
      else
        cat <<'PATCH'
diff --git a/src/lib.rs b/src/lib.rs
--- a/src/lib.rs
+++ b/src/lib.rs
@@ -1,3 +1,3 @@
 pub fn value() -> i32 {{
-    99
+    2
 }}
PATCH
      fi
      exit 0
    fi
    if [ "$mode" = "retry_prompt_context" ]; then
      if printf '%s' "$prompt" | grep -q "上一版补丁应用失败"; then
        printf '%s' "$prompt" | grep -q "git apply stderr:" || exit 43
        printf '%s' "$prompt" | grep -q "patch does not apply" || exit 44
        printf '%s' "$prompt" | grep -q "Allowed file: src/lib.rs" || exit 45
        printf '%s' "$prompt" | grep -q "max hunks: 3" || exit 46
        printf '%s' "$prompt" | grep -q "max changed lines: 80" || exit 47
        printf '%s' "$prompt" | grep -q "pub fn value() -> i32" || exit 48
        cat <<'PATCH'
diff --git a/src/lib.rs b/src/lib.rs
--- a/src/lib.rs
+++ b/src/lib.rs
@@ -1,3 +1,3 @@
 pub fn value() -> i32 {{
-    1
+    2
 }}
PATCH
      else
        cat <<'PATCH'
diff --git a/src/lib.rs b/src/lib.rs
--- a/src/lib.rs
+++ b/src/lib.rs
@@ -1,3 +1,3 @@
 pub fn value() -> i32 {{
-    99
+    2
 }}
PATCH
      fi
      exit 0
    fi
    if [ "$mode" = "full_file_fallback_large" ]; then
      if printf '%s' "$prompt" | grep -q "完整目标文件内容"; then
        cat <<'FILE'
pub fn value() -> i32 {{
    2
}}
FILE
      else
        cat <<'PATCH'
diff --git a/src/lib.rs b/src/lib.rs
--- a/src/lib.rs
+++ b/src/lib.rs
@@ -1,3 +1,3
 pub fn value() -> i32 {{
-    1
+    2
 }}
PATCH
      fi
      exit 0
    fi
    if [ "$mode" = "malformed_direct_fallback" ]; then
      if printf '%s' "$prompt" | grep -q "上一版补丁应用失败"; then
        printf '%s\n' 'retry patch generation should be skipped for malformed diffs' >&2
        exit 77
      fi
      if printf '%s' "$prompt" | grep -q "完整目标文件内容"; then
        cat <<'FILE'
pub fn value() -> i32 {{
    2
}}
FILE
      else
        cat <<'PATCH'
diff --git a/src/lib.rs b/src/lib.rs
--- a/src/lib.rs
+++ b/src/lib.rs
@@ -1,3 +1,3
 pub fn value() -> i32 {{
-    1
+    2
 }}
PATCH
      fi
      exit 0
    fi
    if [ "$mode" = "same_file_partial" ] && printf '%s' "$prompt" | grep -q "fix other"; then
      exit 0
    fi
    if [ "$mode" = "same_file_partial" ]; then
      cat <<'PATCH'
diff --git a/src/lib.rs b/src/lib.rs
--- a/src/lib.rs
+++ b/src/lib.rs
@@ -1,5 +1,5 @@
 pub fn value() -> i32 {{
-    1
+    2
 }}

 pub fn other() -> i32 {{
PATCH
    else
      cat <<'PATCH'
diff --git a/src/lib.rs b/src/lib.rs
--- a/src/lib.rs
+++ b/src/lib.rs
@@ -1,3 +1,3 @@
 pub fn value() -> i32 {{
-    1
+    2
 }}
PATCH
    fi
    ;;
  *"安全审计专家"*)
    if [ "$mode" = "security_fail" ]; then
      printf '%s\n' '{{"passed":false,"reason":"synthetic security finding"}}'
    else
      printf '%s\n' '{{"passed":true,"reason":"ok"}}'
    fi
    ;;
  *"代码质量专家"*)
    printf '%s\n' '{{"score":95,"reason":"ok"}}'
    ;;
  *)
    printf '%s\n' ''
    ;;
esac
"#
    )
}
