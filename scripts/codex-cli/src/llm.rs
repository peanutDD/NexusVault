use dotenvy::dotenv;
use std::env;
use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tokio::io::AsyncWriteExt;
use tokio::process::Command;
use tokio::time::timeout;

const PROMPT_PLACEHOLDER: &str = "{prompt}";
const PROMPT_FILE_PLACEHOLDER: &str = "{prompt_file}";

/// 通过本地 Codex CLI 执行模型任务。
///
/// 约定：
/// - 不使用 GPT/OpenAI API
/// - 命令必须由 `CODEX_AGENT_COMMAND` 显式配置，避免本工具递归调用自己
/// - 若命令参数包含 `{prompt}`，直接替换为完整 prompt
/// - 若命令参数包含 `{prompt_file}`，写入临时 prompt 文件并替换为路径
/// - 若没有占位符，则把完整 prompt 写入 stdin
pub struct CodexClient {
    command: Vec<String>,
    timeout: Duration,
}

impl CodexClient {
    pub fn new() -> Result<Self, Box<dyn std::error::Error>> {
        dotenv().ok();
        let raw = env::var("CODEX_AGENT_COMMAND")
            .map_err(|_| "请设置 CODEX_AGENT_COMMAND，例如：codex exec --skip-git-repo-check -")?;
        let command = parse_command(&raw)?;
        reject_recursive_command(&command)?;
        Ok(Self {
            command,
            timeout: agent_timeout(),
        })
    }

    pub async fn call(
        &self,
        system_prompt: &str,
        user_prompt: &str,
    ) -> Result<String, Box<dyn std::error::Error>> {
        let prompt = build_prompt(system_prompt, user_prompt);
        run_local_codex_command(&self.command, &prompt, self.timeout).await
    }
}

fn parse_command(raw: &str) -> Result<Vec<String>, Box<dyn std::error::Error>> {
    let parts = raw
        .split_whitespace()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(ToString::to_string)
        .collect::<Vec<_>>();
    if parts.is_empty() {
        return Err("CODEX_AGENT_COMMAND 不能为空".into());
    }
    Ok(parts)
}

fn build_prompt(system_prompt: &str, user_prompt: &str) -> String {
    format!(
        "System instructions:\n{}\n\nUser request:\n{}\n",
        system_prompt, user_prompt
    )
}

async fn run_local_codex_command(
    command: &[String],
    prompt: &str,
    command_timeout: Duration,
) -> Result<String, Box<dyn std::error::Error>> {
    let (program, arg_template) = command
        .split_first()
        .ok_or("CODEX_AGENT_COMMAND 不能为空")?;

    let mut prompt_file: Option<PathBuf> = None;
    let mut uses_prompt_arg = false;
    let mut args = Vec::with_capacity(arg_template.len());
    for arg in arg_template {
        if arg == PROMPT_PLACEHOLDER {
            uses_prompt_arg = true;
            args.push(prompt.to_string());
        } else if arg == PROMPT_FILE_PLACEHOLDER {
            let path = write_prompt_file(prompt)?;
            args.push(path.to_string_lossy().to_string());
            prompt_file = Some(path);
        } else {
            args.push(arg.to_string());
        }
    }

    let child_result = Command::new(program)
        .args(&args)
        .stdin(if uses_prompt_arg || prompt_file.is_some() {
            Stdio::null()
        } else {
            Stdio::piped()
        })
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true)
        .spawn();
    let mut child = match child_result {
        Ok(child) => child,
        Err(e) => {
            if let Some(path) = prompt_file {
                let _ = std::fs::remove_file(path);
            }
            return Err(format!("启动本地 Codex 命令失败: {} ({})", program, e).into());
        }
    };

    if !uses_prompt_arg && prompt_file.is_none() {
        let Some(mut stdin) = child.stdin.take() else {
            return Err("无法写入本地 Codex 命令 stdin".into());
        };
        stdin.write_all(prompt.as_bytes()).await?;
        drop(stdin);
    }

    let output_result = timeout(command_timeout, child.wait_with_output()).await;
    if let Some(path) = prompt_file {
        let _ = std::fs::remove_file(path);
    }

    let output = match output_result {
        Ok(output) => output?,
        Err(_) => {
            return Err(format!("本地 Codex 命令超时（{} 秒）", command_timeout.as_secs()).into());
        }
    };

    if !output.status.success() {
        return Err(format!(
            "本地 Codex 命令失败，status={}，stderr={}",
            output.status,
            String::from_utf8_lossy(&output.stderr).trim()
        )
        .into());
    }

    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

fn write_prompt_file(prompt: &str) -> Result<PathBuf, Box<dyn std::error::Error>> {
    let now = SystemTime::now().duration_since(UNIX_EPOCH)?.as_nanos();
    let path = env::temp_dir().join(format!("codex-agent-prompt-{}.md", now));
    std::fs::write(&path, prompt)?;
    Ok(path)
}

fn agent_timeout() -> Duration {
    let raw = env::var("CODEX_AGENT_TIMEOUT_SECONDS").ok();
    agent_timeout_from(raw.as_deref())
}

fn agent_timeout_from(raw: Option<&str>) -> Duration {
    let seconds = raw
        .and_then(|v| v.parse::<u64>().ok())
        .filter(|v| *v > 0)
        .unwrap_or(900);
    Duration::from_secs(seconds)
}

fn reject_recursive_command(command: &[String]) -> Result<(), Box<dyn std::error::Error>> {
    let Some(program) = command.first() else {
        return Err("CODEX_AGENT_COMMAND 不能为空".into());
    };

    let current = env::current_exe()
        .ok()
        .and_then(|p| std::fs::canonicalize(p).ok());
    let target = resolve_program_path(program).and_then(|p| std::fs::canonicalize(p).ok());

    if current.is_some() && current == target {
        return Err(format!(
            "CODEX_AGENT_COMMAND 指向了当前 codex-cli 二进制，会导致递归调用: {}",
            program
        )
        .into());
    }

    Ok(())
}

fn resolve_program_path(program: &str) -> Option<PathBuf> {
    let path = Path::new(program);
    if path.components().count() > 1 || path.is_absolute() {
        return Some(path.to_path_buf());
    }

    let paths = env::var_os("PATH")?;
    env::split_paths(&paths)
        .map(|dir| dir.join(program))
        .find(|candidate| candidate.exists())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_command_rejects_empty_input() {
        assert!(parse_command("   ").is_err());
    }

    #[test]
    fn parse_command_splits_program_and_args() {
        let parsed = parse_command("codex exec --skip-git-repo-check -").unwrap();
        assert_eq!(parsed[0], "codex");
        assert_eq!(parsed[1], "exec");
        assert_eq!(parsed.last().map(String::as_str), Some("-"));
    }

    #[test]
    fn build_prompt_keeps_system_and_user_text() {
        let prompt = build_prompt("rules", "task");
        assert!(prompt.contains("rules"));
        assert!(prompt.contains("task"));
    }

    #[test]
    fn agent_timeout_defaults_to_fifteen_minutes() {
        assert_eq!(agent_timeout_from(None), Duration::from_secs(900));
    }

    #[test]
    fn agent_timeout_reads_positive_seconds() {
        assert_eq!(agent_timeout_from(Some("42")), Duration::from_secs(42));
    }

    #[test]
    fn agent_timeout_ignores_zero_and_invalid_values() {
        assert_eq!(agent_timeout_from(Some("0")), Duration::from_secs(900));
        assert_eq!(agent_timeout_from(Some("nope")), Duration::from_secs(900));
    }
}
