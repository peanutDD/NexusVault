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
    assert_eq!(json["quality_score"], 95);
    assert_eq!(json["files"][0], "src/lib.rs");

    let updated = fs::read_to_string(repo.join("src/lib.rs")).unwrap();
    assert_eq!(updated, "pub fn value() -> i32 {\n    2\n}\n");
}

#[test]
fn auto_fix_local_blocks_push_when_security_audit_fails() {
    let workspace = TestWorkspace::new("blocked");
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
    let fake_agent = workspace.fake_agent("security_fail");

    let output = run_auto_fix(&repo, &review, &fake_agent, true);
    assert!(output.status.success(), "stderr={}", stderr(&output));

    let json = parse_stdout(&output);
    assert_eq!(json["fixed"], false);
    assert_eq!(json["security_passed"], false);
    assert_eq!(json["push_blocked"], true);
    assert_eq!(json["pending_explanations"].as_array().unwrap().len(), 0);

    let commit_count = workspace.git_stdout(&repo, &["rev-list", "--count", "HEAD"]);
    assert_eq!(commit_count.trim(), "1");
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
    let pending = json["pending_explanations"].as_array().unwrap();
    assert_eq!(pending.len(), 1);
    assert!(pending[0].as_str().unwrap().contains("`:5"));
    assert!(pending[0].as_str().unwrap().contains("模型未返回可应用"));
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

    fn fake_agent(&self, mode: &str) -> PathBuf {
        let path = self.path.join(format!("fake-agent-{mode}.sh"));
        let script = fake_agent_script(mode);
        fs::write(&path, script).unwrap();
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
    if [ "$mode" = "same_file_partial" ]; then
      printf '%s\n' '{{"summary":"two same-file issues","issues":[{{"severity":"Medium","file":"src/lib.rs","line":1,"description":"fix value","suggestion":"","reason":"first"}},{{"severity":"Medium","file":"src/lib.rs","line":5,"description":"fix other","suggestion":"","reason":"second"}}]}}'
    else
      printf '%s\n' '{{"summary":"one medium issue","issues":[{{"severity":"Medium","file":"src/lib.rs","line":1,"description":"fix value","suggestion":"","reason":"review text"}}]}}'
    fi
    ;;
  *"高级工程师"*)
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
