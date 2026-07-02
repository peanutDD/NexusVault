use crate::patch::PatchApplyResult;
use std::fs;
use std::process::Command as StdCommand;

pub fn apply_patch_safely(
    file_path: &str,
    patch: &str,
) -> Result<bool, Box<dyn std::error::Error>> {
    apply_patch_safely_in(".", file_path, patch)
}

pub fn apply_patch_safely_in(
    repo_root: &str,
    file_path: &str,
    patch: &str,
) -> Result<bool, Box<dyn std::error::Error>> {
    Ok(apply_patch_with_details_in(repo_root, file_path, patch)?.applied)
}

pub fn apply_patch_with_details_in(
    repo_root: &str,
    file_path: &str,
    patch: &str,
) -> Result<PatchApplyResult, Box<dyn std::error::Error>> {
    if let Err(reason) = validate_unified_diff_for_file(file_path, patch) {
        eprintln!("patch preflight failed for {}: {}", file_path, reason);
        return Ok(PatchApplyResult {
            applied: false,
            stderr: reason,
            fail_reason: Some("malformed_diff".to_string()),
        });
    }

    let tmp = std::env::temp_dir().join(format!("codex-cli-{}.patch", file_path.replace('/', "_")));
    fs::write(&tmp, patch)?;

    let output = StdCommand::new("git")
        .args(["-C", repo_root])
        .args(["apply", "--whitespace=fix"])
        .arg(&tmp)
        .output()?;

    let _ = fs::remove_file(&tmp);
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    if !output.status.success() {
        eprintln!("git apply failed for {}: {}", file_path, stderr);
    }
    Ok(PatchApplyResult {
        applied: output.status.success(),
        fail_reason: (!output.status.success()).then(|| classify_apply_failure(&stderr)),
        stderr,
    })
}

pub fn validate_unified_diff_for_file(file_path: &str, patch: &str) -> Result<(), String> {
    let normalized_file = file_path.replace('\\', "/");
    let trimmed = patch.trim_start();
    if trimmed.is_empty() {
        return Err(format!(
            "preflight: malformed unified diff for `{}`: patch is empty",
            normalized_file
        ));
    }
    if !trimmed.starts_with("diff --git ") {
        return Err(format!(
            "preflight: malformed unified diff for `{}`: missing diff --git header",
            normalized_file
        ));
    }

    let lines = trimmed.lines().collect::<Vec<_>>();
    let diff_headers = lines
        .iter()
        .filter(|line| line.starts_with("diff --git "))
        .collect::<Vec<_>>();
    if diff_headers.len() != 1 {
        return Err(format!(
            "preflight: malformed unified diff for `{}`: expected exactly one diff --git header",
            normalized_file
        ));
    }

    validate_diff_git_header(diff_headers[0], &normalized_file)?;

    let mut has_old_header = false;
    let mut has_new_header = false;
    let mut has_hunk = false;
    let mut index = 0;
    while index < lines.len() {
        let line = lines[index];
        if line.starts_with("--- ") {
            has_old_header = true;
            validate_file_header_path(line, "--- ", &normalized_file)?;
        } else if line.starts_with("+++ ") {
            has_new_header = true;
            validate_file_header_path(line, "+++ ", &normalized_file)?;
        } else if line.starts_with("@@") {
            has_hunk = true;
            let Some((expected_old, expected_new)) = parse_hunk_counts(line) else {
                return Err(format!(
                    "preflight: malformed unified diff for `{}`: malformed hunk header `{}`",
                    normalized_file, line
                ));
            };
            let (actual_old, actual_new, next_index) =
                count_hunk_body(&lines, index + 1, &normalized_file)?;
            if actual_old != expected_old || actual_new != expected_new {
                return Err(format!(
                    "preflight: malformed unified diff for `{}`: hunk body count mismatch `{}` expected -{},+{} got -{},+{}",
                    normalized_file, line, expected_old, expected_new, actual_old, actual_new
                ));
            }
            index = next_index;
            continue;
        }
        index += 1;
    }

    if !has_old_header || !has_new_header {
        return Err(format!(
            "preflight: malformed unified diff for `{}`: missing ---/+++ file headers",
            normalized_file
        ));
    }
    if !has_hunk {
        return Err(format!(
            "preflight: malformed unified diff for `{}`: missing @@ hunk header",
            normalized_file
        ));
    }

    Ok(())
}

fn validate_diff_git_header(header: &str, file_path: &str) -> Result<(), String> {
    let parts = header.split_whitespace().collect::<Vec<_>>();
    if parts.len() != 4 || parts[0] != "diff" || parts[1] != "--git" {
        return Err(format!(
            "preflight: malformed unified diff for `{}`: invalid diff --git header",
            file_path
        ));
    }

    for path in [&parts[2], &parts[3]] {
        let Some(stripped) = strip_git_patch_path(path) else {
            return Err(format!(
                "preflight: malformed unified diff for `{}`: invalid patch path `{}`",
                file_path, path
            ));
        };
        if stripped != file_path {
            return Err(format!(
                "preflight: malformed unified diff for `{}`: patch targets `{}`",
                file_path, stripped
            ));
        }
    }

    Ok(())
}

fn validate_file_header_path(line: &str, prefix: &str, file_path: &str) -> Result<(), String> {
    let path = line
        .strip_prefix(prefix)
        .unwrap_or_default()
        .split_whitespace()
        .next()
        .unwrap_or_default();
    if path == "/dev/null" {
        return Ok(());
    }

    let Some(stripped) = strip_git_patch_path(path) else {
        return Err(format!(
            "preflight: malformed unified diff for `{}`: invalid file header `{}`",
            file_path, line
        ));
    };
    if stripped != file_path {
        return Err(format!(
            "preflight: malformed unified diff for `{}`: file header targets `{}`",
            file_path, stripped
        ));
    }

    Ok(())
}

fn strip_git_patch_path(path: &str) -> Option<&str> {
    path.strip_prefix("a/").or_else(|| path.strip_prefix("b/"))
}

fn parse_hunk_counts(line: &str) -> Option<(usize, usize)> {
    if !line.starts_with("@@ -") {
        return None;
    }
    let close_at = line[3..].find(" @@")?;
    let range = &line[3..3 + close_at];
    let parts = range.split_whitespace().collect::<Vec<_>>();
    if parts.len() != 2
        || !is_valid_hunk_range(parts[0], '-')
        || !is_valid_hunk_range(parts[1], '+')
    {
        return None;
    }
    Some((
        hunk_range_count(parts[0], '-')?,
        hunk_range_count(parts[1], '+')?,
    ))
}

fn is_valid_hunk_range(range: &str, prefix: char) -> bool {
    hunk_range_count(range, prefix).is_some()
}

fn hunk_range_count(range: &str, prefix: char) -> Option<usize> {
    let rest = range.strip_prefix(prefix)?;
    let mut pieces = rest.split(',');
    let start = pieces.next()?;
    if start.is_empty() || !start.chars().all(|c| c.is_ascii_digit()) {
        return None;
    }
    let count = match pieces.next() {
        Some(len) if !len.is_empty() && len.chars().all(|c| c.is_ascii_digit()) => {
            len.parse::<usize>().ok()?
        }
        Some(_) => return None,
        None => 1,
    };
    if pieces.next().is_some() {
        return None;
    }
    Some(count)
}

fn count_hunk_body(
    lines: &[&str],
    start: usize,
    file_path: &str,
) -> Result<(usize, usize, usize), String> {
    let mut old_count = 0;
    let mut new_count = 0;
    let mut index = start;
    while index < lines.len() {
        let line = lines[index];
        if line.starts_with("@@") || line.starts_with("diff --git ") {
            break;
        }
        if line.starts_with("--- ") || line.starts_with("+++ ") {
            return Err(format!(
                "preflight: malformed unified diff for `{}`: file header inside hunk `{}`",
                file_path, line
            ));
        }

        if line.starts_with(' ') {
            old_count += 1;
            new_count += 1;
        } else if line.starts_with('-') {
            old_count += 1;
        } else if line.starts_with('+') {
            new_count += 1;
        } else if line.starts_with('\\') {
        } else {
            return Err(format!(
                "preflight: malformed unified diff for `{}`: invalid hunk line `{}`",
                file_path, line
            ));
        }
        index += 1;
    }

    Ok((old_count, new_count, index))
}

pub fn classify_apply_failure(stderr: &str) -> String {
    let lower = stderr.to_ascii_lowercase();
    if lower.contains("corrupt patch")
        || lower.contains("malformed")
        || lower.contains("unrecognized input")
        || lower.contains("patch fragment without header")
    {
        "malformed_diff".to_string()
    } else if lower.contains("patch does not apply") || lower.contains("patch failed") {
        "context_mismatch".to_string()
    } else if lower.contains("no such file")
        || lower.contains("does not exist")
        || lower.contains("not in index")
    {
        "drift".to_string()
    } else {
        "unknown".to_string()
    }
}
