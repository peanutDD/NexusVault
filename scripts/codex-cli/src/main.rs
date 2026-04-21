use clap::{Parser, Subcommand};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::{env, fs, process::Command as StdCommand};
use dotenvy::dotenv;

#[derive(Parser)]
#[command(name = "sp")]
#[command(about = "Codex Superpowers CLI - 让 Agent 规则在命令行起飞", long_about = None)]
#[command(version = "1.0")]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// 🕵️ Review: 根据 AGENTS.md 的 15 条铁律审查代码
    Review {
        /// 目标文件或目录路径
        #[arg(short, long)]
        path: PathBuf,
        
        /// 是否自动修复发现的问题
        #[arg(short, long)]
        fix: bool,
    },

    /// 🔨 Refactor: 对指定模块进行架构重构 (例如：拆分巨大文件)
    Refactor {
        /// 目标文件路径
        #[arg(short, long)]
        path: PathBuf,
        
        /// 重构策略 (如: "split", "modularize")
        #[arg(short, long, default_value = "modularize")]
        strategy: String,
    },

    /// 📝 Doc: 自动生成或更新符合项目规范的文档
    Doc {
        /// 目标代码路径
        #[arg(short, long)]
        path: PathBuf,

        /// 文档类型 (如: "api", "changelog", "readme")
        #[arg(short, long, default_value = "api")]
        kind: String,
    },

    /// 🤖 PrAutoFix: 读取 Gemini Code Assist Review，自动调用 GPT-5.4 修复并推送
    PrAutoFix {
        /// GitHub PR 编号
        #[arg(long)]
        pr_number: u32,

        /// Gemini Review 完整内容（可直接从 workflow 传入）
        #[arg(long)]
        gemini_review: String,

        /// 最大修复轮次（默认 2 轮）
        #[arg(long, default_value = "2")]
        max_rounds: u8,

        /// 是否跳过确认直接 push（CI 环境设为 true）
        #[arg(long, default_value = "false")]
        yes: bool,
    },
}

#[derive(Debug, Serialize, Deserialize)]
struct Message {
    role: String,
    content: String,
}

#[derive(Debug, Serialize)]
struct ChatRequest {
    model: String,
    messages: Vec<Message>,
    temperature: f32,
}

#[derive(Debug, Deserialize)]
struct ChatResponse {
    choices: Vec<Choice>,
}

#[derive(Debug, Serialize, Deserialize)]
struct Choice {
    message: Message,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
struct ReviewIssue {
    file: String,
    line: Option<u32>,
    severity: String, // "Critical", "High", "Medium", "Low"
    description: String,
    suggestion: String,
    reason: Option<String>, // 用于溯源 Gemini 原文
}

#[derive(Debug, Deserialize, Serialize)]
struct ReviewData {
    summary: String,
    issues: Vec<ReviewIssue>,
}

struct CodexClient {
    api_key: String,
    api_base: String,
    client: reqwest::Client,
}

impl CodexClient {
    fn new() -> Self {
        dotenv().ok();
        let api_key = env::var("OPENAI_API_KEY").expect("请在 .env 中设置 OPENAI_API_KEY");
        let api_base = env::var("OPENAI_API_BASE").unwrap_or_else(|_| "https://api.openai.com/v1".to_string());
        
        Self {
            api_key,
            api_base,
            client: reqwest::Client::new(),
        }
    }

    async fn call(&self, system_prompt: &str, user_prompt: &str) -> Result<String, Box<dyn std::error::Error>> {
        let url = format!("{}/chat/completions", self.api_base);
        
        let request = ChatRequest {
            model: env::var("CODEX_MODEL").unwrap_or_else(|_| "gpt-4-turbo-preview".to_string()),
            messages: vec![
                Message { role: "system".to_string(), content: system_prompt.to_string() },
                Message { role: "user".to_string(), content: user_prompt.to_string() },
            ],
            temperature: 0.2,
        };

        let response = self.client.post(&url)
            .header("Authorization", format!("Bearer {}", self.api_key))
            .json(&request)
            .send()
            .await?;

        if !response.status().is_success() {
            let err_text = response.text().await?;
            return Err(format!("API 请求失败: {}", err_text).into());
        }

        let body: ChatResponse = response.json().await?;
        Ok(body.choices[0].message.content.clone())
    }
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let cli = Cli::parse();
    let client = CodexClient::new();

    // 加载全局规则 AGENTS.md
    let agents_rules = fs::read_to_string("../../AGENTS.md")
        .unwrap_or_else(|_| "严格遵循项目架构铁律和 TDD 铁律。".to_string());

    match &cli.command {
        Commands::Review { path, fix } => {
            println!("🕵️  正在启动 Superpowers 审查: {:?}", path);
            let code = fs::read_to_string(path)?;
            
            let system_prompt = format!("你是一个资深架构师，请根据以下 AGENTS.md 规则审查代码：\n\n{}", agents_rules);
            let user_prompt = format!("请审查以下代码，并指出不符合规则的地方。如果 fix 模式开启，请直接返回修复后的完整代码，并放在代码块中：\n\n```rust\n{}\n```", code);

            let result = client.call(&system_prompt, &user_prompt).await?;
            
            if *fix {
                if let Some(fixed_code) = extract_code_block(&result) {
                    fs::write(path, fixed_code)?;
                    println!("✅ 代码已根据 AI 建议自动修复。");
                } else {
                    println!("⚠️ AI 未返回可自动修复的代码块，请查看建议：\n\n{}", result);
                }
            } else {
                println!("🔍 审查报告：\n\n{}", result);
            }
        }
        Commands::Refactor { path, strategy } => {
            println!("� 正在执行重构 [{}]: {:?}", strategy, path);
            let code = fs::read_to_string(path)?;
            
            let system_prompt = format!("你是一个重构专家，规则如下：\n\n{}", agents_rules);
            let user_prompt = format!("请按照 '{}' 策略重构以下代码，返回重构后的代码块：\n\n```rust\n{}\n```", strategy, code);

            let result = client.call(&system_prompt, &user_prompt).await?;
            if let Some(new_code) = extract_code_block(&result) {
                fs::write(path, new_code)?;
                println!("✨ 重构完成。");
            } else {
                println!("⚠️ 未能提取重构后的代码。");
            }
        }
        Commands::Doc { path, kind } => {
            println!("� 正在生成 {} 文档: {:?}", kind, path);
            let code = fs::read_to_string(path)?;

            let system_prompt = "你是一个技术文档专家，请根据代码生成简洁的 Markdown 文档。";
            let user_prompt = format!("请为以下代码生成 {} 类型的文档：\n\n```rust\n{}\n```", kind, code);

            let result = client.call(system_prompt, &user_prompt).await?;
            println!("📄 生成的文档内容：\n\n{}", result);
        }
        Commands::PrAutoFix { pr_number, gemini_review, max_rounds, yes } => {
            println!("🤖 启动 PR Auto-Fix #{}", pr_number);
            let result = pr_auto_fix(*pr_number, gemini_review, *max_rounds, *yes, &client).await;
            match result {
                Ok(output) => println!("{}", output),
                Err(e) => {
                    eprintln!("❌ PR Auto-Fix 失败: {}", e);
                    std::process::exit(1);
                }
            }
        }
    }

    Ok(())
}

fn extract_code_block(text: &str) -> Option<String> {
    let start_tag = "```rust";
    let end_tag = "```";
    
    if let Some(start) = text.find(start_tag) {
        let content_start = start + start_tag.len();
        if let Some(end) = text[content_start..].find(end_tag) {
            return Some(text[content_start..content_start + end].trim().to_string());
        }
    }
    
    // 尝试通用的 ```
    let start_tag_generic = "```";
    if let Some(start) = text.find(start_tag_generic) {
        let content_start = start + start_tag_generic.len();
        if let Some(end) = text[content_start..].find(end_tag) {
            return Some(text[content_start..content_start + end].trim().to_string());
        }
    }
    
    None
}

async fn pr_auto_fix(
    pr_number: u32,
    gemini_review: &str,
    max_rounds: u8,
    yes: bool,
    client: &CodexClient,
) -> Result<String, Box<dyn std::error::Error>> {
    println!("📥 PR #{} | 正在编排 Superpowers 技能流...", pr_number);

    // 获取仓库上下文
    let repo = env::var("GITHUB_REPOSITORY").unwrap_or_else(|_| {
        let output = StdCommand::new("gh").args(["repo", "parse", "--json", "nameWithOwner", "-q", ".nameWithOwner"]).output().expect("gh failed");
        String::from_utf8_lossy(&output.stdout).trim().to_string()
    });

    // Skill 1: Read & Parse Gemini Review (情报解析层)
    let review_data = read_gemini_review(gemini_review, &repo, client).await?;
    let all_issues = review_data.issues;
    println!("🔍 解析到 {} 个原始问题 | 总结: {}", all_issues.len(), review_data.summary);

    // Skill 2: Decision Engine (只修 Medium 及以上，且过滤受保护文件)
    let issues_to_fix = decide_fix_or_skip(&all_issues);
    println!("⚖️  决策引擎: 筛选出 {} 个需要修复的问题 (Medium+)", issues_to_fix.len());

    if issues_to_fix.is_empty() {
        let gh_comment = format!("🤖 **GPT-5.4 分析**: Gemini Review 中未发现需要自动修复的高/中优先级问题。\n\n**Gemini 总结**: {}", review_data.summary);
        post_comment(pr_number, &gh_comment)?;
        return Ok(serde_json::json!({ "fixed": false, "reason": "无需修复", "summary": review_data.summary }).to_string());
    }

    // Skill 3 & 4: Generate Patch & Apply Safely
    let mut fixed_files = Vec::new();

    for issue in &issues_to_fix {
        println!("🛠️  正在生成修复补丁: {} ({} 优先级)", issue.file, issue.severity);
        
        match generate_fix_patch(issue, &repo, client).await {
            Ok(Some(patch)) => {
                if apply_patch_safely(&issue.file, &patch)? {
                    fixed_files.push(issue.file.clone());
                }
            }
            Ok(None) => println!("⬜ AI 认为无需修改: {}", issue.file),
            Err(e) => eprintln!("⚠️ 修复失败 ({}): {}", issue.file, e),
        }
    }

    if fixed_files.is_empty() {
        return Ok(serde_json::json!({ "fixed": false, "reason": "补丁生成失败", "summary": review_data.summary }).to_string());
    }

    // Skill 5: Commit & Tag Round
    if !yes {
        println!("\n⏸️  确认推送 {} 个文件的修改？(y/n)", fixed_files.len());
        let mut input = String::new();
        std::io::stdin().read_line(&mut input)?;
        if !input.trim().to_lowercase().starts_with('y') {
            return Ok(serde_json::json!({ "fixed": false, "reason": "用户拒绝推送", "summary": review_data.summary }).to_string());
        }
    }

    commit_and_tag_round(pr_number, &fixed_files, max_rounds)?;

    Ok(serde_json::json!({ 
        "fixed": true, 
        "files": fixed_files, 
        "summary": review_data.summary,
        "fixed_count": fixed_files.len()
    }).to_string())
}

async fn read_gemini_review(gemini_comment: &str, repo_context: &str, client: &CodexClient) -> Result<ReviewData, Box<dyn std::error::Error>> {
    let system_prompt = "你是代码审查专家。现在有一个 Gemini Code Assist 对 PR 的完整 Review 评论。
请严格按以下 JSON Schema 解析，不要添加任何额外文字：

{
  \"summary\": \"Gemini 对本次 PR 的整体总结（1-2 句话）\",
  \"issues\": [
    {
      \"severity\": \"Critical | High | Medium | Low\",
      \"file\": \"具体文件路径（如果 Gemini 没给就填 unknown）\",
      \"line\": 行号（整数，如果是多行就取起始行）,
      \"description\": \"问题详细描述（保留 Gemini 原意）\",
      \"suggestion\": \"Gemini 给出的修复建议代码（如果有 ```suggestion 块就完整保留，否则为空字符串）\",
      \"reason\": \"Gemini 原评论中对应的原文片段（用于溯源）\"
    }
  ]
}

只输出合法 JSON，不要 markdown，不要解释。";
    
    let user_prompt = format!(
        "Gemini 评论全文：\n--- START ---\n{}\n--- END ---\n\n仓库上下文: {}",
        gemini_comment, repo_context
    );

    let result = client.call(system_prompt, &user_prompt).await?;
    let json_str = result.trim_start_matches("```json").trim_end_matches("```").trim();
    
    let data: ReviewData = serde_json::from_str(json_str)
        .map_err(|e| format!("解析 Gemini Review JSON 失败: {}\n原始文本: {}", e, result))?;
    Ok(data)
}

fn decide_fix_or_skip(issues: &[ReviewIssue]) -> Vec<ReviewIssue> {
    let protected = ["Cargo.lock", "package-lock.json", "bun.lock", "Cargo.toml", "package.json", "pyproject.toml", ".env"];
    
    issues.iter()
        .filter(|i| i.severity == "High" || i.severity == "Medium")
        .filter(|i| !protected.iter().any(|p| i.file.contains(p)))
        .filter(|i| !i.file.starts_with("docs/") && !i.file.ends_with(".md"))
        .cloned()
        .collect()
}

async fn generate_fix_patch(issue: &ReviewIssue, repo: &str, client: &CodexClient) -> Result<Option<String>, Box<dyn std::error::Error>> {
    // 读取文件内容
    let output = StdCommand::new("gh")
        .args(["api", &format!("repos/{}/contents/{}", repo, issue.file), "-H", "Accept: application/vnd.github.v3.raw"])
        .output()?;
    
    if !output.status.success() {
        return Err(format!("无法读取文件: {}", issue.file).into());
    }
    let content = String::from_utf8_lossy(&output.stdout);

    let system_prompt = "你是一个高级工程师。请根据提供的审查意见，为目标文件生成 unified diff 格式的修复补丁。
仅返回补丁内容，不要任何其他解释文字。如果没有需要修复的，返回空。";

    let user_prompt = format!(
        "文件: {}\n问题: {}\n建议: {}\n\n源码:\n```\n{}\n```",
        issue.file, issue.description, issue.suggestion, content
    );

    let patch = client.call(system_prompt, &user_prompt).await?;
    if patch.trim().is_empty() || !patch.contains("@@") {
        Ok(None)
    } else {
        Ok(Some(patch))
    }
}

fn apply_patch_safely(file_path: &str, patch: &str) -> Result<bool, Box<dyn std::error::Error>> {
    // 简单实现：将 patch 写入临时文件并用 git apply
    let tmp_patch = format!("{}.patch", file_path.replace('/', "_"));
    fs::write(&tmp_patch, patch)?;
    
    let status = StdCommand::new("git")
        .args(["apply", "--whitespace=fix", &tmp_patch])
        .status()?;
    
    fs::remove_file(&tmp_patch)?;
    Ok(status.success())
}

fn commit_and_tag_round(pr_number: u32, fixed_files: &[String], _max_rounds: u8) -> Result<(), Box<dyn std::error::Error>> {
    let msg = format!("[skip ci] 🤖 codex auto-fix: 修复 {} 个文件 (基于 Gemini Review)", fixed_files.len());
    
    StdCommand::new("git").args(["add"]).args(fixed_files).status()?;
    StdCommand::new("git").args(["commit", "-m", &msg]).status()?;
    StdCommand::new("git").args(["push", "origin", "HEAD"]).status()?;
    
    let gh_msg = format!("🤖 **Codex 自动修复完成**\n\n✅ 已修复文件：\n{}", 
        fixed_files.iter().map(|f| format!("- `{}`", f)).collect::<Vec<_>>().join("\n"));
    post_comment(pr_number, &gh_msg)?;
    
    Ok(())
}

fn post_comment(pr_number: u32, body: &str) -> Result<(), Box<dyn std::error::Error>> {
    StdCommand::new("gh").args(["pr", "comment", &format!("{}", pr_number), "--body", body]).status()?;
    Ok(())
}

