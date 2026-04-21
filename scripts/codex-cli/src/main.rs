use clap::{Parser, Subcommand};
use dotenvy::dotenv;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};
use std::{env, fs, process::Command as StdCommand};

#[derive(Parser)]
#[command(name = "codex")]
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

#[derive(Debug, Deserialize, Serialize, Clone)]
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
        let api_base =
            env::var("OPENAI_API_BASE").unwrap_or_else(|_| "https://api.openai.com/v1".to_string());

        Self {
            api_key,
            api_base,
            client: reqwest::Client::new(),
        }
    }

    async fn call(
        &self,
        system_prompt: &str,
        user_prompt: &str,
    ) -> Result<String, Box<dyn std::error::Error>> {
        let url = format!("{}/chat/completions", self.api_base);

        let request = ChatRequest {
            model: env::var("CODEX_MODEL").unwrap_or_else(|_| "gpt-4-turbo-preview".to_string()),
            messages: vec![
                Message {
                    role: "system".to_string(),
                    content: system_prompt.to_string(),
                },
                Message {
                    role: "user".to_string(),
                    content: user_prompt.to_string(),
                },
            ],
            temperature: 0.2,
        };

        let response = self
            .client
            .post(&url)
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

            let system_prompt = format!(
                "你是一个资深架构师，请根据以下 AGENTS.md 规则审查代码：\n\n{}",
                agents_rules
            );
            let user_prompt = format!(
                "请审查以下代码，并指出不符合规则的地方。如果 fix 模式开启，请直接返回修复后的完整代码，并放在代码块中：\n\n```rust\n{}\n```",
                code
            );

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
            let user_prompt = format!(
                "请按照 '{}' 策略重构以下代码，返回重构后的代码块：\n\n```rust\n{}\n```",
                strategy, code
            );

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
            let user_prompt = format!(
                "请为以下代码生成 {} 类型的文档：\n\n```rust\n{}\n```",
                kind, code
            );

            let result = client.call(system_prompt, &user_prompt).await?;
            println!("📄 生成的文档内容：\n\n{}", result);
        }
        Commands::PrAutoFix {
            pr_number,
            gemini_review,
            max_rounds,
            yes,
        } => {
            eprintln!("🤖 启动 PR Auto-Fix #{}", pr_number);
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

// --- 高级 Skill 编排框架 (Advanced Superpowers Template) ---

/// 技能执行上下文：在 Pipeline 中传递状态
#[derive(Debug, Clone, Serialize, Deserialize)]
struct SkillContext {
    pr_number: u32,
    repo: String,
    raw_input: String,
    parsed_data: Option<ReviewData>,
    selected_issues: Vec<ReviewIssue>,
    fixed_files: Vec<String>,
    quality_score: u8,
    security_passed: bool,
    auto_push: bool,
    rounds: u8,
}

impl SkillContext {
    fn new(pr_number: u32, repo: String, raw_input: String, rounds: u8, auto_push: bool) -> Self {
        Self {
            pr_number,
            repo,
            raw_input,
            parsed_data: None,
            selected_issues: Vec::new(),
            fixed_files: Vec::new(),
            quality_score: 0,
            security_passed: false,
            auto_push,
            rounds,
        }
    }
}

/// 技能 Trait：所有原子技能必须实现此接口
#[async_trait::async_trait]
trait Skill {
    fn name(&self) -> &'static str;
    async fn execute(
        &self,
        ctx: &mut SkillContext,
        client: &CodexClient,
    ) -> Result<(), Box<dyn std::error::Error>>;
}

// 技能 1: 情报解析
struct ReadReviewSkill;
#[async_trait::async_trait]
impl Skill for ReadReviewSkill {
    fn name(&self) -> &'static str {
        "ReadReview"
    }
    async fn execute(
        &self,
        ctx: &mut SkillContext,
        client: &CodexClient,
    ) -> Result<(), Box<dyn std::error::Error>> {
        let data = read_gemini_review(&ctx.raw_input, &ctx.repo, client).await?;
        ctx.parsed_data = Some(data);
        Ok(())
    }
}

// 技能 2: 决策引擎
struct DecisionSkill;
#[async_trait::async_trait]
impl Skill for DecisionSkill {
    fn name(&self) -> &'static str {
        "Decision"
    }
    async fn execute(
        &self,
        ctx: &mut SkillContext,
        _client: &CodexClient,
    ) -> Result<(), Box<dyn std::error::Error>> {
        if let Some(data) = &ctx.parsed_data {
            ctx.selected_issues = decide_fix_or_skip(&data.issues);
        }
        Ok(())
    }
}

// 技能 3: 批量修复 (组合 Skill)
struct BatchFixSkill;
#[async_trait::async_trait]
impl Skill for BatchFixSkill {
    fn name(&self) -> &'static str {
        "BatchFix"
    }
    async fn execute(
        &self,
        ctx: &mut SkillContext,
        client: &CodexClient,
    ) -> Result<(), Box<dyn std::error::Error>> {
        for issue in &ctx.selected_issues {
            if let Ok(Some(patch)) = generate_fix_patch(issue, &ctx.repo, client).await
                && apply_patch_safely(&issue.file, &patch)?
            {
                ctx.fixed_files.push(issue.file.clone());
            }
        }
        Ok(())
    }
}

// 技能 4: 安全扫描 (新模块 - 可复用)
struct SecurityCheckSkill;
#[async_trait::async_trait]
impl Skill for SecurityCheckSkill {
    fn name(&self) -> &'static str {
        "SecurityCheck"
    }
    async fn execute(
        &self,
        ctx: &mut SkillContext,
        client: &CodexClient,
    ) -> Result<(), Box<dyn std::error::Error>> {
        eprintln!("🛡️ [Skill: SecurityCheck] 正在扫描修复后的代码安全性...");

        let mut all_passed = true;
        for file in &ctx.fixed_files {
            let content = fs::read_to_string(file)?;
            let system_prompt =
                "你是一个安全审计专家。请检查代码是否存在注入、密钥泄露或严重逻辑漏洞。
仅返回 JSON: {\"passed\": true/false, \"reason\": \"原因\"}";
            let user_prompt = format!("文件: {}\n内容: \n```\n{}\n```", file, content);

            let result = client.call(system_prompt, &user_prompt).await?;
            if result.contains("false") {
                all_passed = false;
                println!("⚠️ 文件 {} 未通过安全扫描: {}", file, result);
                break;
            }
        }
        ctx.security_passed = all_passed;
        Ok(())
    }
}

// 技能 5: 质量评分 (新模块 - 对齐 AGENTS.md 规则 15)
struct QualityScoreSkill;
#[async_trait::async_trait]
impl Skill for QualityScoreSkill {
    fn name(&self) -> &'static str {
        "QualityScore"
    }
    async fn execute(
        &self,
        ctx: &mut SkillContext,
        client: &CodexClient,
    ) -> Result<(), Box<dyn std::error::Error>> {
        eprintln!("📊 [Skill: QualityScore] 正在评估修复质量...");

        let system_prompt =
            "你是一个代码质量专家。请根据 AGENTS.md 的 15 条铁律为本次修复打分 (0-100)。
仅返回数字评分。";
        let user_prompt = format!(
            "修复的文件: {:?}\nGemini 原始意见: {}",
            ctx.fixed_files, ctx.raw_input
        );

        let result = client.call(system_prompt, &user_prompt).await?;
        if let Ok(score) = result.trim().parse::<u8>() {
            ctx.quality_score = score;
            eprintln!("📈 本次修复质量评分: {} 分", score);
        }
        Ok(())
    }
}

struct DocumentationSkill;
#[async_trait::async_trait]
impl Skill for DocumentationSkill {
    fn name(&self) -> &'static str {
        "Documentation"
    }
    async fn execute(
        &self,
        ctx: &mut SkillContext,
        _client: &CodexClient,
    ) -> Result<(), Box<dyn std::error::Error>> {
        if ctx.fixed_files.is_empty() {
            return Ok(());
        }

        let root = git_repo_root().map_err(|e| {
            format!(
                "DocumentationSkill: 获取 git 仓库根目录失败（需要在 git 仓库内运行）。原始错误: {}",
                e
            )
        })?;
        let now = SystemTime::now().duration_since(UNIX_EPOCH)?.as_secs();
        let entry = build_changelog_entry(ctx, now);
        let changelog_path = format!("{}/docs/CHANGELOG.md", root);
        update_changelog(&changelog_path, &entry).map_err(|e| {
            format!(
                "DocumentationSkill: 写入 docs/CHANGELOG.md 失败（path={}）。原始错误: {}",
                changelog_path, e
            )
        })?;

        if !ctx.fixed_files.iter().any(|f| f == "docs/CHANGELOG.md") {
            ctx.fixed_files.push("docs/CHANGELOG.md".to_string());
        }

        Ok(())
    }
}

// 技能 7: 提交与反馈 (重构后的 Feedback)
struct DryRunFeedbackSkill;
#[async_trait::async_trait]
impl Skill for DryRunFeedbackSkill {
    fn name(&self) -> &'static str {
        "DryRunFeedback"
    }
    async fn execute(
        &self,
        ctx: &mut SkillContext,
        _client: &CodexClient,
    ) -> Result<(), Box<dyn std::error::Error>> {
        if ctx.auto_push || ctx.fixed_files.is_empty() {
            return Ok(());
        }

        let security_info = if ctx.security_passed {
            "✅ 安全扫描通过"
        } else {
            "⚠️ 安全扫描发现潜在风险"
        };
        let score_info = format!("🏆 质量评分: {} 分", ctx.quality_score);

        let mut files = ctx.fixed_files.clone();
        files.sort();
        files.dedup();

        let msg = format!(
            "🤖 **Codex 已在本地生成并应用补丁，但未推送**\n\n原因：未传 `--yes`（auto_push=false），系统已进入 Dry-Run 模式。\n\n{}\n{}\n\n📄 本地变更文件：\n{}\n\n如确认无误，请在同一环境重新运行并加上 `--yes` 以提交并推送。",
            security_info,
            score_info,
            files
                .iter()
                .map(|f| format!("- `{}`", f))
                .collect::<Vec<_>>()
                .join("\n")
        );

        post_comment(ctx.pr_number, &msg).map_err(|e| {
            format!(
                "DryRunFeedbackSkill: PR 评论发布失败（pr_number={}）。原始错误: {}",
                ctx.pr_number, e
            )
        })?;

        Ok(())
    }
}

struct FeedbackSkill;
#[async_trait::async_trait]
impl Skill for FeedbackSkill {
    fn name(&self) -> &'static str {
        "Feedback"
    }
    async fn execute(
        &self,
        ctx: &mut SkillContext,
        _client: &CodexClient,
    ) -> Result<(), Box<dyn std::error::Error>> {
        if !ctx.fixed_files.is_empty() {
            if !ctx.auto_push {
                return Ok(());
            }

            // 如果安全扫描未通过，记录警告但不终止推送（或根据需要终止）
            let security_info = if ctx.security_passed {
                "✅ 安全扫描通过"
            } else {
                "⚠️ 安全扫描发现潜在风险"
            };
            let score_info = format!("🏆 质量评分: {} 分", ctx.quality_score);

            commit_and_tag_round(ctx.pr_number, &ctx.fixed_files, ctx.rounds)?;

            let gh_msg = format!(
                "🤖 **Codex 自动修复完成**\n\n{}\n{}\n\n✅ 已修复文件：\n{}",
                security_info,
                score_info,
                ctx.fixed_files
                    .iter()
                    .map(|f| format!("- `{}`", f))
                    .collect::<Vec<_>>()
                    .join("\n")
            );
            post_comment(ctx.pr_number, &gh_msg)?;
        } else if let Some(data) = &ctx.parsed_data {
            let msg = format!(
                "🤖 **GPT-5.4 分析**: 未发现需要自动修复的高优先级问题。\n\n**总结**: {}",
                data.summary
            );
            post_comment(ctx.pr_number, &msg)?;
        }
        Ok(())
    }
}

/// 技能编排器 (Skill Orchestrator)
struct Pipeline {
    skills: Vec<Box<dyn Skill>>,
}

impl Pipeline {
    fn new() -> Self {
        Self { skills: Vec::new() }
    }

    fn add(mut self, skill: Box<dyn Skill>) -> Self {
        self.skills.push(skill);
        self
    }

    async fn run(
        &self,
        ctx: &mut SkillContext,
        client: &CodexClient,
    ) -> Result<(), Box<dyn std::error::Error>> {
        for skill in &self.skills {
            eprintln!("🚀 [Skill: {}] 正在执行...", skill.name());
            skill.execute(ctx, client).await?;
        }
        Ok(())
    }
}

// --- 修改原有的 pr_auto_fix 使用 Pipeline 模式 ---

async fn pr_auto_fix(
    pr_number: u32,
    gemini_review: &str,
    max_rounds: u8,
    yes: bool,
    client: &CodexClient,
) -> Result<String, Box<dyn std::error::Error>> {
    let repo = env::var("GITHUB_REPOSITORY").unwrap_or_default();
    let mut ctx = SkillContext::new(pr_number, repo, gemini_review.to_string(), max_rounds, yes);

    // 定义 Pipeline 流程 (可插拔式组合)
    let pipeline = Pipeline::new()
        .add(Box::new(ReadReviewSkill)) // 1. 情报解析
        .add(Box::new(DecisionSkill)) // 2. 决策过滤
        .add(Box::new(BatchFixSkill)) // 3. 核心修复
        .add(Box::new(SecurityCheckSkill)) // 4. 安全审计 (New!)
        .add(Box::new(QualityScoreSkill)) // 5. 质量打分 (New!)
        .add(Box::new(DocumentationSkill)) // 6. 变更记录 (New!)
        .add(Box::new(DryRunFeedbackSkill)) // 7. Dry-Run 提示（仅 auto_push=false 生效）
        .add(Box::new(FeedbackSkill)); // 8. 结果反馈（push + 评论）

    // 执行编排
    pipeline.run(&mut ctx, client).await?;

    #[derive(Serialize)]
    struct PrAutoFixOutput {
        fixed: bool,
        files: Vec<String>,
        quality_score: u8,
        security_passed: bool,
        summary: Option<String>,
    }

    let summary = ctx.parsed_data.as_ref().map(|d| d.summary.clone());
    let mut files = ctx.fixed_files.clone();
    files.sort();
    files.dedup();

    let output = PrAutoFixOutput {
        fixed: !files.is_empty(),
        files,
        quality_score: ctx.quality_score,
        security_passed: ctx.security_passed,
        summary,
    };

    Ok(serde_json::to_string(&output)?)
}

fn git_repo_root() -> Result<String, Box<dyn std::error::Error>> {
    let output = StdCommand::new("git")
        .args(["rev-parse", "--show-toplevel"])
        .output()?;
    if !output.status.success() {
        return Err("无法定位 git 仓库根目录".into());
    }
    Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
}

fn build_changelog_entry(ctx: &SkillContext, unix_ts: u64) -> String {
    let mut files = ctx.fixed_files.clone();
    files.sort();
    files.dedup();

    let security_info = if ctx.security_passed {
        "通过"
    } else {
        "发现潜在风险"
    };
    let header = format!(
        "#### 🤖 Codex Auto-Fix (PR #{}, round {}) — ts={}\n\n",
        ctx.pr_number, ctx.rounds, unix_ts
    );

    let mut body = String::new();
    body.push_str(&format!("- 安全扫描：{}\n", security_info));
    body.push_str(&format!("- 质量评分：{} / 100\n", ctx.quality_score));
    body.push_str("- 变更文件：\n");
    for f in files {
        body.push_str(&format!("  - `{}`\n", f));
    }
    body.push('\n');

    header + &body
}

fn update_changelog(changelog_path: &str, entry: &str) -> Result<(), Box<dyn std::error::Error>> {
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn build_changelog_entry_includes_files_and_scores() {
        let mut ctx = SkillContext::new(123, "owner/repo".to_string(), "raw".to_string(), 1, false);
        ctx.fixed_files = vec![
            "src/a.rs".to_string(),
            "src/b.rs".to_string(),
            "src/a.rs".to_string(),
        ];
        ctx.security_passed = true;
        ctx.quality_score = 95;

        let entry = build_changelog_entry(&ctx, 1_700_000_000);
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

async fn read_gemini_review(
    gemini_comment: &str,
    repo_context: &str,
    client: &CodexClient,
) -> Result<ReviewData, Box<dyn std::error::Error>> {
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
    let mut json_str = result.trim();
    if json_str.starts_with("```json") {
        json_str = json_str
            .trim_start_matches("```json")
            .trim_end_matches("```")
            .trim();
    } else if json_str.starts_with("```") {
        json_str = json_str
            .trim_start_matches("```")
            .trim_end_matches("```")
            .trim();
    }

    let data: ReviewData = serde_json::from_str(json_str)
        .map_err(|e| format!("解析 Gemini Review JSON 失败: {}\n原始文本: {}", e, result))?;
    Ok(data)
}

fn decide_fix_or_skip(issues: &[ReviewIssue]) -> Vec<ReviewIssue> {
    let protected = [
        "Cargo.lock",
        "package-lock.json",
        "bun.lock",
        "Cargo.toml",
        "package.json",
        "pyproject.toml",
        ".env",
    ];

    issues
        .iter()
        .filter(|i| i.severity == "High" || i.severity == "Medium")
        .filter(|i| !protected.iter().any(|p| i.file.contains(p)))
        .filter(|i| !i.file.starts_with("docs/") && !i.file.ends_with(".md"))
        .cloned()
        .collect()
}

async fn generate_fix_patch(
    issue: &ReviewIssue,
    repo: &str,
    client: &CodexClient,
) -> Result<Option<String>, Box<dyn std::error::Error>> {
    // 读取文件内容
    let output = StdCommand::new("gh")
        .args([
            "api",
            &format!("repos/{}/contents/{}", repo, issue.file),
            "-H",
            "Accept: application/vnd.github.v3.raw",
        ])
        .output()?;

    if !output.status.success() {
        return Err(format!("无法读取文件: {}", issue.file).into());
    }
    let content = String::from_utf8_lossy(&output.stdout);

    let system_prompt =
        "你是一个高级工程师。请根据提供的审查意见，为目标文件生成 unified diff 格式的修复补丁。
仅返回补丁内容，不要任何其他解释文字。如果没有需要修复的，返回空。";

    let user_prompt = format!(
        "文件: {}\n问题: {}\n建议: {}\n\n源码:\n```\n{}\n```",
        issue.file, issue.description, issue.suggestion, content
    );

    let mut patch = client.call(system_prompt, &user_prompt).await?;

    // 自动清理可能的 markdown 代码块标记
    if patch.contains("```")
        && let Some(extracted) = extract_code_block(&patch)
    {
        patch = extracted;
    }

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

fn commit_and_tag_round(
    _pr_number: u32,
    fixed_files: &[String],
    _max_rounds: u8,
) -> Result<(), Box<dyn std::error::Error>> {
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

fn post_comment(pr_number: u32, body: &str) -> Result<(), Box<dyn std::error::Error>> {
    StdCommand::new("gh")
        .args(["pr", "comment", &format!("{}", pr_number), "--body", body])
        .status()?;
    Ok(())
}
