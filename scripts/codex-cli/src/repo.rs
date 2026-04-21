use crate::types::ChangelogEntryInput;
use std::fs;
use std::process::Command as StdCommand;
use std::time::{SystemTime, UNIX_EPOCH};

/// 从大模型输出中提取第一个代码块内容。
///
/// 为什么需要：
/// - `Review/Refactor/Doc` 等子命令要求模型返回代码块
/// - 模型有时会用 ```rust 或 ``` 包裹，这里做一次“尽量提取”
pub fn extract_code_block(text: &str) -> Option<String> {
    let start_tag = "```rust";
    let end_tag = "```";

    if let Some(start) = text.find(start_tag) {
        let content_start = start + start_tag.len();
        if let Some(end) = text[content_start..].find(end_tag) {
            return Some(text[content_start..content_start + end].trim().to_string());
        }
    }

    let start_tag_generic = "```";
    if let Some(start) = text.find(start_tag_generic) {
        let content_start = start + start_tag_generic.len();
        if let Some(end) = text[content_start..].find(end_tag) {
            return Some(text[content_start..content_start + end].trim().to_string());
        }
    }

    None
}

/// 获取当前 git 仓库根目录。
///
/// 作为多数 repo 相关操作的前置条件（例如读取 `AGENTS.md`、写入 `docs/CHANGELOG.md`）。
pub fn git_repo_root() -> Result<String, Box<dyn std::error::Error>> {
    let output = StdCommand::new("git")
        .args(["rev-parse", "--show-toplevel"])
        .output()?;
    if !output.status.success() {
        return Err("无法定位 git 仓库根目录".into());
    }
    Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
}

/// 读取仓库根目录下的 `AGENTS.md` 规则文本（用于注入到模型 system prompt）。
///
/// 读取失败时使用一个最小兜底规则，避免 CLI 直接崩溃影响可用性。
pub fn read_agents_rules() -> String {
    let root = git_repo_root().ok();
    if let Some(root) = root {
        let path = format!("{}/AGENTS.md", root);
        if let Ok(content) = fs::read_to_string(path) {
            return content;
        }
    }
    "严格遵循项目架构铁律和 TDD 铁律。".to_string()
}

/// 构建写入 CHANGELOG 的条目文本（稳定格式，便于后续检索/复盘）。
pub fn build_changelog_entry(input: &ChangelogEntryInput) -> String {
    let mut files = input.files.clone();
    files.sort();
    files.dedup();

    let security_info = if input.security_passed {
        "通过"
    } else {
        "发现潜在风险"
    };

    let header = format!(
        "#### 🤖 Codex Auto-Fix (PR #{}, round {}) — ts={}\n\n",
        input.pr_number, input.round, input.unix_ts
    );

    let mut body = String::new();
    body.push_str(&format!("- 安全扫描：{}\n", security_info));
    body.push_str(&format!("- 质量评分：{} / 100\n", input.quality_score));
    body.push_str("- 变更文件：\n");
    for f in files {
        body.push_str(&format!("  - `{}`\n", f));
    }
    body.push('\n');

    header + &body
}

/// 将条目插入到 `docs/CHANGELOG.md` 中 `### 🤖 AI 自动修复` 区块下。
///
/// 插入策略：
/// - 若已存在该小节：插入到小节标题之后（最靠前，倒序）
/// - 若不存在但存在 `[未发布]`：在其下创建小节并插入
/// - 否则：追加到文末（兜底）
pub fn update_changelog(
    changelog_path: &str,
    entry: &str,
) -> Result<(), Box<dyn std::error::Error>> {
    let original = fs::read_to_string(changelog_path)?;

    let marker = "### 🤖 AI 自动修复";
    let updated = if original.contains(marker) {
        original.replacen(marker, &format!("{}\n\n{}", marker, entry.trim_end()), 1)
    } else if let Some(pos) = original.find("## [未发布]") {
        let insert_at = original[pos..]
            .find('\n')
            .map(|i| pos + i + 1)
            .unwrap_or(original.len());
        let mut out = String::new();
        out.push_str(&original[..insert_at]);
        out.push_str("\n### 🤖 AI 自动修复\n\n");
        out.push_str(entry.trim_end());
        out.push('\n');
        out.push_str(&original[insert_at..]);
        out
    } else {
        format!("{}\n\n{}", original.trim_end(), entry.trim_end())
    };

    fs::write(changelog_path, updated)?;
    Ok(())
}

/// 在 repo 根目录下的 `docs/CHANGELOG.md` 追加一次 “AI 自动修复” 记录。
///
/// 该函数会把 `docs/CHANGELOG.md` 加入 `fixed_files`，以确保后续提交/推送包含变更记录。
pub fn append_ai_changelog(
    fixed_files: &mut Vec<String>,
    input: &ChangelogEntryInput,
) -> Result<(), Box<dyn std::error::Error>> {
    let root = git_repo_root().map_err(|e| {
        format!(
            "DocumentationSkill: 获取 git 仓库根目录失败（需要在 git 仓库内运行）。原始错误: {}",
            e
        )
    })?;

    let entry = build_changelog_entry(input);
    let changelog_path = format!("{}/docs/CHANGELOG.md", root);
    update_changelog(&changelog_path, &entry).map_err(|e| {
        format!(
            "DocumentationSkill: 写入 docs/CHANGELOG.md 失败（path={}）。原始错误: {}",
            changelog_path, e
        )
    })?;

    if !fixed_files.iter().any(|f| f == "docs/CHANGELOG.md") {
        fixed_files.push("docs/CHANGELOG.md".to_string());
    }

    Ok(())
}

/// 获取当前 Unix 时间戳（秒）。
pub fn now_unix_ts() -> Result<u64, Box<dyn std::error::Error>> {
    Ok(SystemTime::now().duration_since(UNIX_EPOCH)?.as_secs())
}

/// 通过 GitHub CLI 以 raw 形式读取仓库文件内容。
///
/// 选择 `gh api ... Accept: raw` 的原因：
/// - 避免 base64/JSON 包装层，拿到直接文本用于 diff 生成
pub fn gh_get_file_raw(repo: &str, path: &str) -> Result<String, Box<dyn std::error::Error>> {
    let output = StdCommand::new("gh")
        .args([
            "api",
            &format!("repos/{}/contents/{}", repo, path),
            "-H",
            "Accept: application/vnd.github.v3.raw",
        ])
        .output()?;

    if !output.status.success() {
        return Err(format!("无法读取文件: {}", path).into());
    }
    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

/// 将 unified diff 补丁以“临时文件 + git apply”方式安全应用到工作区。
///
/// 这样做的原因：
/// - `git apply` 能做上下文匹配与失败回滚（比直接写文件更安全）
/// - 临时文件放在系统 temp 目录，避免污染仓库
pub fn apply_patch_safely(
    file_path: &str,
    patch: &str,
) -> Result<bool, Box<dyn std::error::Error>> {
    let tmp = std::env::temp_dir().join(format!("codex-cli-{}.patch", file_path.replace('/', "_")));
    fs::write(&tmp, patch)?;

    let status = StdCommand::new("git")
        .args(["apply", "--whitespace=fix"])
        .arg(&tmp)
        .status()?;

    let _ = fs::remove_file(&tmp);
    Ok(status.success())
}

/// 提交并推送本轮修复。
///
/// 注意：message 带 `[skip ci]`，避免自触发 CI/循环修复。
pub fn commit_and_push(fixed_files: &[String]) -> Result<(), Box<dyn std::error::Error>> {
    let msg = format!(
        "[skip ci] 🤖 codex auto-fix: 修复 {} 个文件 (基于 Gemini Review)",
        fixed_files.len()
    );

    StdCommand::new("git")
        .args(["add"])
        .args(fixed_files)
        .status()?;
    StdCommand::new("git")
        .args(["commit", "-m", &msg])
        .status()?;
    StdCommand::new("git")
        .args(["push", "origin", "HEAD"])
        .status()?;

    Ok(())
}

/// 在指定 PR 下发布评论（用于 Dry-Run 提示与修复结果回传）。
pub fn post_comment(pr_number: u32, body: &str) -> Result<(), Box<dyn std::error::Error>> {
    StdCommand::new("gh")
        .args(["pr", "comment", &format!("{}", pr_number), "--body", body])
        .status()?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn build_changelog_entry_includes_files_and_scores() {
        let input = ChangelogEntryInput {
            pr_number: 123,
            round: 1,
            unix_ts: 1_700_000_000,
            files: vec![
                "src/a.rs".to_string(),
                "src/b.rs".to_string(),
                "src/a.rs".to_string(),
            ],
            security_passed: true,
            quality_score: 95,
        };

        let entry = build_changelog_entry(&input);
        assert!(entry.contains("PR #123"));
        assert!(entry.contains("round 1"));
        assert!(entry.contains("安全扫描：通过"));
        assert!(entry.contains("质量评分：95 / 100"));
        assert!(entry.contains("`src/a.rs`"));
        assert!(entry.contains("`src/b.rs`"));
    }

    #[test]
    fn update_changelog_inserts_under_unreleased() {
        let base = "# CHANGELOG\n\n## [未发布] — 2026 年（当前会话）\n\n### 🧱 架构调整\n";
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let path = std::env::temp_dir().join(format!("codex-cli-changelog-{}.md", now));
        fs::write(&path, base).unwrap();
        update_changelog(path.to_str().unwrap(), "#### entry\n").unwrap();
        let out = fs::read_to_string(&path).unwrap();
        let _ = fs::remove_file(&path);
        assert!(out.contains("### 🤖 AI 自动修复"));
        assert!(out.contains("#### entry"));
    }
}
