use crate::types::{
    ChangelogEntryInput, ReviewLedgerEntryInput, SkillPackResolvedSkill, SkillPackSkillMeta,
};
use std::fs;
use std::path::Path;
use std::process::Command as StdCommand;
use std::process::Output;
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PatchApplyResult {
    pub applied: bool,
    pub stderr: String,
    pub fail_reason: Option<String>,
}

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
    git_repo_root_from(None)
}

pub fn git_repo_root_from(cwd: Option<&str>) -> Result<String, Box<dyn std::error::Error>> {
    let output = StdCommand::new("git")
        .args(cwd.into_iter().flat_map(|p| ["-C", p]))
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
    read_rules(root.as_deref(), None)
}

pub fn read_rules(repo_root: Option<&str>, rules_file: Option<&str>) -> String {
    if let Some(p) = rules_file
        && let Ok(content) = fs::read_to_string(p)
    {
        return content;
    }

    if let Some(root) = repo_root {
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

pub fn resolve_changelog_path(repo_root: &str, changelog_path: Option<&str>) -> Option<String> {
    if let Some(p) = changelog_path {
        if Path::new(p).is_absolute() {
            return Some(p.to_string());
        }
        return Some(Path::new(repo_root).join(p).to_string_lossy().to_string());
    }

    let default_path = format!("{}/docs/CHANGELOG.md", repo_root);
    if Path::new(&default_path).exists() {
        Some(default_path)
    } else {
        None
    }
}

pub fn append_ai_changelog_in(
    repo_root: &str,
    fixed_files: &mut Vec<String>,
    input: &ChangelogEntryInput,
    changelog_path: Option<&str>,
) -> Result<(), Box<dyn std::error::Error>> {
    let Some(changelog_path) = resolve_changelog_path(repo_root, changelog_path) else {
        return Ok(());
    };

    let entry = build_changelog_entry(input);
    update_changelog(&changelog_path, &entry)?;

    let rel = if Path::new(&changelog_path).is_absolute() {
        Path::new(&changelog_path)
            .strip_prefix(repo_root)
            .ok()
            .and_then(|p| p.to_str())
            .map(|s| s.trim_start_matches('/').to_string())
    } else {
        Some(changelog_path.clone())
    };

    if let Some(rel) = rel
        && !fixed_files.iter().any(|f| f == &rel)
    {
        fixed_files.push(rel);
    }

    Ok(())
}

/// 构建自动 Review 台账条目，保留每条 Gemini 问题的处理答案。
pub fn build_auto_review_ledger_entry(input: &ReviewLedgerEntryInput) -> String {
    let mut files = input.files.clone();
    files.sort();
    files.dedup();

    let pr_label = if input.pr_number == 0 {
        "local".to_string()
    } else {
        format!("#{}", input.pr_number)
    };
    let mut entry = format!(
        "## Codex Auto Review - PR {} round {} - ts={}\n\n",
        pr_label, input.round, input.unix_ts
    );

    if let Some(summary) = input.summary.as_deref().filter(|s| !s.trim().is_empty()) {
        entry.push_str(&format!("总结：{}\n\n", markdown_table_cell(summary)));
    }

    entry.push_str("修改文件：\n");
    if files.is_empty() {
        entry.push_str("- 无代码或文档文件变更\n");
    } else {
        for file in &files {
            entry.push_str(&format!("- `{}`\n", file));
        }
    }

    entry.push_str("\n| # | Severity | File:line | Gemini 问题 | 状态 | 解决答案 / 未解决原因 |\n");
    entry.push_str("|---|---|---|---|---|---|\n");
    for (index, status) in input.statuses.iter().enumerate() {
        entry.push_str(&format!(
            "| {} | {} | `{}`:{} | {} | {} | {} |\n",
            index + 1,
            markdown_table_cell(&status.severity),
            markdown_table_cell(&status.file),
            status.line,
            markdown_table_cell(&status.description),
            markdown_table_cell(&status.status),
            markdown_table_cell(&status.explanation)
        ));
    }
    entry.push('\n');
    entry
}

/// 在 repo 根目录下写入 `docs/auto-review-ledger.md`，并把该文件加入本轮提交列表。
pub fn append_auto_review_ledger_in(
    repo_root: &str,
    fixed_files: &mut Vec<String>,
    input: &ReviewLedgerEntryInput,
) -> Result<Option<String>, Box<dyn std::error::Error>> {
    if input.statuses.is_empty() {
        return Ok(None);
    }

    let rel_path = "docs/auto-review-ledger.md";
    let abs_path = Path::new(repo_root).join(rel_path);
    if let Some(parent) = abs_path.parent() {
        fs::create_dir_all(parent)?;
    }

    let entry = build_auto_review_ledger_entry(input);
    let next = if abs_path.exists() {
        let original = fs::read_to_string(&abs_path)?;
        format!("{}\n{}", original.trim_end(), entry.trim_end())
    } else {
        format!("# Auto Review Ledger\n\n{}", entry.trim_end())
    };
    fs::write(&abs_path, format!("{}\n", next.trim_end()))?;

    if !fixed_files.iter().any(|f| f == rel_path) {
        fixed_files.push(rel_path.to_string());
    }

    Ok(Some(rel_path.to_string()))
}

fn markdown_table_cell(value: &str) -> String {
    value
        .replace('|', "\\|")
        .replace('\n', " ")
        .trim()
        .to_string()
}

/// 获取当前 Unix 时间戳（秒）。
pub fn now_unix_ts() -> Result<u64, Box<dyn std::error::Error>> {
    Ok(SystemTime::now().duration_since(UNIX_EPOCH)?.as_secs())
}

pub fn read_repo_file(repo_root: &str, path: &str) -> Result<String, Box<dyn std::error::Error>> {
    let abs = Path::new(repo_root).join(path);
    Ok(fs::read_to_string(abs)?)
}

pub fn write_repo_file(
    repo_root: &str,
    path: &str,
    content: &str,
) -> Result<(), Box<dyn std::error::Error>> {
    let abs = Path::new(repo_root).join(path);
    fs::write(abs, content)?;
    Ok(())
}

/// 通过 GitHub CLI 以 raw 形式读取仓库文件内容。
///
/// 选择 `gh api ... Accept: raw` 的原因：
/// - 避免 base64/JSON 包装层，拿到直接文本用于 diff 生成
pub fn gh_get_file_raw(repo: &str, path: &str) -> Result<String, Box<dyn std::error::Error>> {
    let output = checked_output(StdCommand::new("gh").args([
        "api",
        &format!("repos/{}/contents/{}", repo, path),
        "-H",
        "Accept: application/vnd.github.v3.raw",
    ]))
    .map_err(|e| format!("无法读取文件 {}: {}", path, e))?;
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

/// 提交并推送本轮修复。
///
/// 注意：自动修复提交必须触发 CI；Gemini kickoff 通过识别该提交消息避免重复请求 review。
pub fn commit_and_push(fixed_files: &[String]) -> Result<(), Box<dyn std::error::Error>> {
    commit_and_push_in(".", fixed_files, true)
}

pub fn commit_and_push_in(
    repo_root: &str,
    fixed_files: &[String],
    push: bool,
) -> Result<(), Box<dyn std::error::Error>> {
    let msg = format!(
        "🤖 codex auto-fix: 修复 {} 个文件 (基于 Gemini Review)",
        fixed_files.len()
    );

    checked_output(
        StdCommand::new("git")
            .args(["-C", repo_root])
            .args(["add"])
            .args(fixed_files),
    )?;
    checked_output(
        StdCommand::new("git")
            .args(["-C", repo_root])
            .args(["commit", "-m", &msg]),
    )?;
    if push {
        checked_output(
            StdCommand::new("git")
                .args(["-C", repo_root])
                .args(["push", "origin", "HEAD"]),
        )?;
    }

    Ok(())
}

/// 在指定 PR 下发布评论（用于 Dry-Run 提示与修复结果回传）。
pub fn post_comment(pr_number: u32, body: &str) -> Result<(), Box<dyn std::error::Error>> {
    checked_output(StdCommand::new("gh").args([
        "pr",
        "comment",
        &format!("{}", pr_number),
        "--body",
        body,
    ]))?;
    Ok(())
}

fn checked_output(cmd: &mut StdCommand) -> Result<Output, Box<dyn std::error::Error>> {
    let output = cmd.output()?;
    if output.status.success() {
        return Ok(output);
    }

    Err(format!(
        "命令执行失败 status={} stdout={} stderr={}",
        output.status,
        String::from_utf8_lossy(&output.stdout).trim(),
        String::from_utf8_lossy(&output.stderr).trim()
    )
    .into())
}

pub fn discover_skill_pack_skills(
    plugin_root: &str,
) -> Result<Vec<SkillPackSkillMeta>, Box<dyn std::error::Error>> {
    let skills_dir = Path::new(plugin_root).join("skills");
    if !skills_dir.exists() {
        return Ok(vec![]);
    }
    let mut out = Vec::new();
    for entry in fs::read_dir(skills_dir)? {
        let entry = entry?;
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }
        let id = entry.file_name().to_string_lossy().to_string();
        let skill_md = path.join("SKILL.md");
        if !skill_md.exists() {
            continue;
        }
        let text = fs::read_to_string(&skill_md)?;
        let (name, description, version, _body) = parse_skill_md(&text);
        out.push(SkillPackSkillMeta {
            id,
            name,
            description,
            version,
            skill_md_path: skill_md.to_string_lossy().to_string(),
        });
    }
    out.sort_by(|a, b| a.id.cmp(&b.id));
    Ok(out)
}

pub fn resolve_skill_pack_skill(
    plugin_root: &str,
    skill: &str,
) -> Result<SkillPackResolvedSkill, Box<dyn std::error::Error>> {
    let candidates = discover_skill_pack_skills(plugin_root)?;
    let Some(meta) = candidates.into_iter().find(|m| {
        if m.id == skill {
            return true;
        }
        if let Some(name) = &m.name {
            return name == skill;
        }
        false
    }) else {
        return Err(format!("未找到 skill: {}", skill).into());
    };

    let skill_md = Path::new(&meta.skill_md_path);
    let text = fs::read_to_string(skill_md)?;
    let (_name, _description, _version, body) = parse_skill_md(&text);
    Ok(SkillPackResolvedSkill { meta, body })
}

pub fn read_skill_pack_agents_rules(plugin_root: &str) -> String {
    read_rules(Some(plugin_root), None)
}

pub fn find_skill_pack_root_from(start: &str) -> Option<String> {
    let mut cur = Path::new(start);
    loop {
        let marker = cur.join(".claude-plugin").join("plugin.json");
        if marker.exists() {
            return Some(cur.to_string_lossy().to_string());
        }
        cur = cur.parent()?;
    }
}

fn parse_skill_md(text: &str) -> (Option<String>, Option<String>, Option<String>, String) {
    let trimmed = text.trim_start();
    if !trimmed.starts_with("---\n") && trimmed != "---" && !trimmed.starts_with("---\r\n") {
        return (None, None, None, text.to_string());
    }

    let normalized = text.replace("\r\n", "\n");
    let mut lines = normalized.lines();
    let first = lines.next();
    if first != Some("---") {
        return (None, None, None, text.to_string());
    }

    let mut frontmatter = Vec::new();
    for line in &mut lines {
        if line == "---" {
            break;
        }
        frontmatter.push(line.to_string());
    }

    let mut name: Option<String> = None;
    let mut version: Option<String> = None;
    let mut description: Option<String> = None;

    let mut i = 0usize;
    while i < frontmatter.len() {
        let line = frontmatter[i].as_str();
        if let Some(rest) = line.strip_prefix("name:") {
            name = Some(rest.trim().trim_matches('"').to_string());
            i += 1;
            continue;
        }
        if let Some(rest) = line.strip_prefix("version:") {
            version = Some(rest.trim().trim_matches('"').to_string());
            i += 1;
            continue;
        }
        if let Some(rest) = line.strip_prefix("description:") {
            let rest = rest.trim();
            if rest == "|" {
                let mut buf = Vec::new();
                i += 1;
                while i < frontmatter.len() {
                    let l = frontmatter[i].as_str();
                    if l.starts_with(' ') || l.starts_with('\t') {
                        buf.push(l.trim().to_string());
                        i += 1;
                        continue;
                    }
                    break;
                }
                let joined = buf.join("\n").trim().to_string();
                if !joined.is_empty() {
                    description = Some(joined);
                }
                continue;
            }
            let single = rest.trim_matches('"').to_string();
            if !single.is_empty() {
                description = Some(single);
            }
            i += 1;
            continue;
        }
        i += 1;
    }

    let body = lines
        .collect::<Vec<_>>()
        .join("\n")
        .trim_start()
        .to_string();
    (name, description, version, body)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_skill_md_supports_frontmatter_and_body() {
        let text = r#"---
name: demo-skill
description: |
  line1
  line2
version: "1.2.3"
---

BODY
"#;
        let (name, description, version, body) = parse_skill_md(text);
        assert_eq!(name.as_deref(), Some("demo-skill"));
        assert_eq!(description.as_deref(), Some("line1\nline2"));
        assert_eq!(version.as_deref(), Some("1.2.3"));
        assert!(body.starts_with("BODY"));
    }

    #[test]
    fn discover_skill_pack_skills_finds_skills_dir() {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let dir = std::env::temp_dir().join(format!("codex-cli-skill-pack-{}", now));
        let skills = dir.join("skills");
        fs::create_dir_all(skills.join("a-skill")).unwrap();
        fs::create_dir_all(skills.join("b-skill")).unwrap();
        fs::write(
            skills.join("a-skill").join("SKILL.md"),
            "---\nname: a-skill\n---\n\nA\n",
        )
        .unwrap();
        fs::write(
            skills.join("b-skill").join("SKILL.md"),
            "---\nname: b\n---\n\nB\n",
        )
        .unwrap();

        let found = discover_skill_pack_skills(dir.to_str().unwrap()).unwrap();
        let _ = fs::remove_dir_all(&dir);

        assert_eq!(found.len(), 2);
        assert_eq!(found[0].id, "a-skill");
        assert_eq!(found[1].id, "b-skill");
    }

    #[test]
    fn find_skill_pack_root_from_walks_up_to_plugin_json() {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let dir = std::env::temp_dir().join(format!("codex-cli-find-pack-{}", now));
        let plugin_root = dir.join("pack");
        let nested = plugin_root.join("a").join("b");
        fs::create_dir_all(nested.join("c")).unwrap();
        fs::create_dir_all(plugin_root.join(".claude-plugin")).unwrap();
        fs::write(plugin_root.join(".claude-plugin").join("plugin.json"), "{}").unwrap();

        let found = find_skill_pack_root_from(nested.to_str().unwrap()).unwrap();
        let _ = fs::remove_dir_all(&dir);

        assert!(found.ends_with("/pack"));
    }

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

    #[test]
    fn resolve_changelog_path_returns_none_when_default_missing() {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let dir = std::env::temp_dir().join(format!("codex-cli-no-changelog-{}", now));
        fs::create_dir_all(&dir).unwrap();

        let resolved = resolve_changelog_path(dir.to_str().unwrap(), None);
        let _ = fs::remove_dir_all(&dir);

        assert!(resolved.is_none());
    }

    #[test]
    fn resolve_changelog_path_returns_default_when_present() {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let dir = std::env::temp_dir().join(format!("codex-cli-with-changelog-{}", now));
        let docs = dir.join("docs");
        fs::create_dir_all(&docs).unwrap();
        fs::write(docs.join("CHANGELOG.md"), "# CHANGELOG\n").unwrap();

        let resolved = resolve_changelog_path(dir.to_str().unwrap(), None).unwrap();
        let _ = fs::remove_dir_all(&dir);

        assert!(resolved.ends_with("/docs/CHANGELOG.md"));
    }

    #[test]
    fn resolve_changelog_path_joins_relative_override() {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let dir = std::env::temp_dir().join(format!("codex-cli-rel-changelog-{}", now));
        fs::create_dir_all(&dir).unwrap();

        let resolved = resolve_changelog_path(dir.to_str().unwrap(), Some("CHANGELOG.md")).unwrap();
        let _ = fs::remove_dir_all(&dir);

        assert!(resolved.ends_with("/CHANGELOG.md"));
    }
}
