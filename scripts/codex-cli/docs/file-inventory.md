# scripts/codex-cli 文件详解

本文档说明 `scripts/codex-cli/` 下每个文件或重要目录的具体作用、使用场景、输入输出与依赖关系。它面向后续接手的 Agent：先看这里，10 秒内知道该从哪里改、哪里不能乱动。

## 总览

`scripts/codex-cli` 是一个独立 Rust CLI crate，同时也是一个本地 Skill Pack。它的核心能力是把 Gemini Code Assist Review 文本解析成结构化问题，再调用本地 Codex 命令生成 unified diff，通过 `git apply` 应用到目标仓库，并在可选条件下写 changelog、评论 PR、提交和推送。

主要运行入口：

- `src/bin/codex.rs`：真正的 CLI 入口，定义所有子命令。
- `src/bin/codex-auto-fix.rs`：包装入口，复用 `codex.rs`，推荐给 CI 使用，避免和真实 Codex CLI 的 `codex` 命令冲突。
- `src/runtime.rs`：PR 模式、本地模式、Skill Pack 执行模式的运行时入口。

主要分层：

- Types：`src/types.rs`
- Config/LLM：`src/llm.rs`
- Repo/IO：`src/repo.rs`
- Service/Skill：`src/skills.rs`
- Runtime/Pipeline：`src/runtime.rs`、`src/pipeline.rs`
- UI/CLI：`src/bin/codex.rs`

## 根目录文件

### `.claude-plugin/plugin.json`

本地 Skill Pack 清单文件。宿主 Agent Runtime 通过它识别 `scripts/codex-cli` 是一个插件/技能包根目录。

字段含义：

- `name`：技能包名，当前为 `codex-cli-pack`。
- `version`：技能包版本。
- `description`：技能包用途说明。

它不参与 Rust 编译，也不会被 `codex-cli` 运行时读取；它服务于外部宿主的插件发现机制。若新增 `skills/*/SKILL.md`，通常不需要改这个文件，除非要发布新的技能包版本或描述。

### `.env`

本地环境变量文件，由 `dotenvy::dotenv()` 在 `src/llm.rs` 中加载。它可能包含本地 Codex 命令配置，例如 `CODEX_AGENT_COMMAND` 和超时配置。

安全约束：

- 不应把 `.env` 内容写入日志、文档或 PR 评论。
- 不应提交包含凭证或本地路径敏感信息的 `.env`。
- 本文档只说明它的用途，不记录实际内容。

### `AGENTS.md`

`scripts/codex-cli/` 子项目的规则入口，作用域限定在本目录。它定义：

- 默认只在本目录读写。
- 不输出或记录密钥。
- 删除、重置、迁移等危险操作必须先征求人类批准。
- 自动化命令 stdout/stderr 契约。
- 文档、TDD、CI、约束归档等工程要求。

运行时也会读取目标仓库的 `AGENTS.md` 或显式 `--rules-file`，但这个文件主要约束维护 `codex-cli` 自身时的 Agent 行为，并被 `skills/codex-cli-workflow/SKILL.md` 引用。

### `Cargo.toml`

Rust crate 清单。当前包名为 `codex-cli`，edition 为 `2024`，并关闭 `autobins`，显式声明两个二进制：

- `codex`：路径 `src/bin/codex.rs`。
- `codex-auto-fix`：路径 `src/bin/codex-auto-fix.rs`。

主要依赖：

- `clap`：CLI 参数解析和子命令定义。
- `dotenvy`：加载 `.env`。
- `serde` / `serde_json`：Review 数据、输出 JSON、Skill Pack metadata 序列化。
- `tokio`：异步进程、异步文件、超时控制。
- `async-trait`：让 `Skill` trait 支持 async `execute`。

改它会影响构建、二进制入口和依赖解析，应同时更新 `Cargo.lock` 并跑 `cargo test`。

### `Cargo.lock`

Cargo 自动生成的依赖锁定文件，记录精确依赖版本和 checksum，保证本地、CI、runner 构建一致。

使用规则：

- 应由 Cargo 命令维护，不手工编辑。
- `Cargo.toml` 依赖变化后，`cargo build` / `cargo test` 会更新它。
- 对 CLI 工具来说建议提交锁文件，避免 runner 构建时解析到不同依赖版本。

## 源码文件

### `src/lib.rs`

库入口，只导出可复用模块：

- `llm`
- `pipeline`
- `repo`
- `runtime`
- `skills`
- `types`

它的职责是让二进制入口和测试都能复用同一套逻辑。新增公共模块时需要在这里 `pub mod`，否则 `src/bin/*` 和集成测试无法通过 crate 名引用。

### `src/types.rs`

共享数据结构与对外 JSON 契约定义。

核心类型：

- `ReviewIssue`：从 Gemini Review 解析出的单条问题，包含文件、行号、严重级别、描述、建议和原文溯源。
- `ReviewData`：Review 解析结果，包含总结和问题列表。
- `ChangelogEntryInput`：写入 changelog 所需的输入数据。
- `PrAutoFixOutput`：`pr-auto-fix` / `auto-fix-local` stdout 的机器可读 JSON 契约。
- `SkillPackSkillMeta`：`skills/*/SKILL.md` 的 metadata。
- `SkillPackResolvedSkill`：Skill metadata 加正文内容。

这是 CI 和外部 workflow 最敏感的文件之一。修改 `PrAutoFixOutput` 字段会影响 `jq` 解析、GitHub Actions 输出和调用方兼容性。

### `src/llm.rs`

本地 Codex 调用封装。它不调用 OpenAI API，而是执行 `CODEX_AGENT_COMMAND` 指向的本地命令。

关键行为：

- 启动时加载 `.env`。
- 解析 `CODEX_AGENT_COMMAND`。
- 拒绝命令指向当前 `codex-cli` 二进制，避免递归调用自己。
- 支持三种 prompt 传递方式：
  - 命令无占位符：prompt 写入 stdin。
  - `{prompt}`：prompt 作为单个参数。
  - `{prompt_file}`：prompt 写入临时文件，命令接收文件路径。
- 用 `CODEX_AGENT_TIMEOUT_SECONDS` 控制单次调用超时，默认 900 秒。
- 子进程 stdout 作为模型结果返回，stderr 只在失败时进入错误信息。

它是模型边界层。上层只传 system prompt 和 user prompt，不关心具体 Codex 命令如何执行。

### `src/repo.rs`

仓库、文件、git、GitHub CLI、changelog、Skill Pack 发现的工具层。它把所有副作用集中在一个模块，避免 `skills.rs` 里散落 shell 和文件操作。

主要能力：

- `extract_code_block`：从模型输出提取第一个 Markdown 代码块。
- `git_repo_root` / `git_repo_root_from`：定位 git 根目录。
- `read_agents_rules` / `read_rules`：按优先级读取规则文件。
- `build_changelog_entry` / `update_changelog`：生成并插入 AI 自动修复 changelog 条目。
- `append_ai_changelog_in`：按 `repo_root` 和可选路径写 changelog，并把相对路径加入 `fixed_files`。
- `read_repo_file`：读取目标仓库文件。
- `gh_get_file_raw`：通过 `gh api` 读取 GitHub 仓库文件 raw 内容。
- `apply_patch_safely_in`：写临时 patch，再执行 `git apply --whitespace=fix`。
- `commit_and_push_in`：`git add`、`git commit`、可选 `git push`。
- `post_comment`：用 `gh pr comment` 发布 PR 评论。
- `discover_skill_pack_skills` / `resolve_skill_pack_skill`：扫描并解析 `skills/*/SKILL.md`。
- `find_skill_pack_root_from`：向上查找 `.claude-plugin/plugin.json`，定位 Skill Pack 根目录。

修改这个文件时要特别注意副作用安全：不能泄露 token，不能越过 `repo_root`，不能让 stdout 污染自动化 JSON。

### `src/skills.rs`

自动修复流水线的业务核心。它把流程拆成多个可组合的 Skill，每个 Skill 读写 `SkillContext` 的明确字段。

核心上下文：

- `SkillContext`：PR 号、仓库名、repo root、规则文本、原始 review、解析结果、选中的 issues、已修复文件、安全结果、质量评分、提交开关、PR 评论开关、changelog 策略、修复尝试、未修复说明等。
- `FixAttempt`：记录每条 issue 在 patch 生成或 patch 应用阶段的成功/失败与原因。
- `SkillContextInit`：初始化上下文的参数包。

Skill 顺序职责：

- `ReadReviewSkill`：调用模型把 Gemini Review Markdown 解析成 `ReviewData`。
- `DecisionSkill`：按严重级别、受保护文件、docs 排除策略筛选可自动修复的问题。
- `BatchFixSkill`：逐条 issue 调用模型生成 unified diff，并通过 `repo::apply_patch_safely_in` 应用。
- `SecurityCheckSkill`：对已修改文件做 prompt-based 安全审计，解析失败按不通过处理。
- `QualityScoreSkill`：请求模型给本轮修复打 0-100 分，解析失败会重试，仍失败则标记评分不可用。
- `DocumentationSkill`：可选写入 changelog。
- `DryRunFeedbackSkill`：未传 `--yes` 时，可选在 PR 留 Dry-Run 评论。
- `FeedbackSkill`：在安全通过且允许推送时提交、推送、评论；无修复时输出总结或未修复说明。

重要策略函数：

- `decide_fix_or_skip`：默认处理 `Critical/High/Medium`，保护锁文件、包配置、`.env`，默认排除 docs 和 `.md`。
- `generate_fix_patch`：为单条 issue 生成 patch，要求输出非空且包含 `@@` hunk。
- `review_issue_key`：用文件、行号、严重级别、描述组成 issue key，避免同文件多问题互相覆盖。
- `parse_security_audit` / `parse_quality_score`：清理模型 JSON 输出并解析。

这是最容易影响行为的文件。任何策略变更都应同步更新 `docs/references/configuration.md`、`docs/constraints/README.md` 或测试。

### `src/pipeline.rs`

轻量编排器。`Pipeline` 内部保存 `Vec<Box<dyn Skill>>`，按添加顺序执行所有 Skill。

职责边界：

- 只负责编排顺序和传递 `SkillContext` / `CodexClient`。
- 不理解具体业务规则。
- 每个 Skill 执行前向 stderr 输出进度日志。

新增、删除或调整流水线步骤通常不改这里，而是改 `src/runtime.rs` 中的 Pipeline 组装。

### `src/runtime.rs`

对外运行时入口，负责把 CLI 参数转成上下文并组装 pipeline。

主要入口：

- `pr_auto_fix`：GitHub Actions 场景的便捷入口，自动从 `GITHUB_WORKSPACE` 或 git 根目录推断 repo root。
- `pr_auto_fix_with_options`：PR 模式完整入口，可传 repo root、规则文件、changelog、PR 评论开关。
- `auto_fix_local`：本地仓库模式入口，不依赖 GitHub PR。
- `run_skill_pack_skill`：读取 Skill Pack 的 `AGENTS.md` 和目标 `SKILL.md`，拼成 system prompt 后调用本地 Codex。

核心流程：

1. 构造 `SkillContext`。
2. 运行修复 pipeline：ReadReview、Decision、BatchFix、SecurityCheck、QualityScore、Documentation。
3. 调用 `enforce_review_policy`，确保 `Medium/Medium+` 及以上未修复问题有说明。
4. 运行反馈 pipeline：DryRunFeedback、Feedback。
5. 生成 `PrAutoFixOutput` JSON。

这里定义了“单次命令只处理当前 Review”的边界。`max_rounds` 是外层 workflow 轮次提示，不代表当前命令内部会循环请求多轮 Gemini。

### `src/bin/codex.rs`

主 CLI 入口，使用 `clap` 定义命令、参数和分发逻辑。

子命令：

- `review --path <file> [--fix]`：审查单个文件；`--fix` 时把模型返回的代码块写回文件。
- `refactor --path <file> [--strategy <name>]`：按 prompt 策略重构单个文件，并写回模型返回的代码块。
- `doc --path <file> [--kind <kind>]`：基于单文件生成 Markdown 文档，输出到 stdout。
- `pr-auto-fix`：CI/PR 模式，接收 PR 号、Gemini Review 文本、repo root、规则文件、changelog、评论开关、pre-skill 等参数。
- `auto-fix-local`：本地模式，从 review 文件读取文本，对指定 repo root 应用自动修复。
- `skill-pack list`：扫描并列出插件根目录下的 skills，可输出 JSON。
- `skill-pack run`：执行某个 `SKILL.md`，支持 `--input` 或 `--input-file`。

输出约束：

- 自动修复命令 stdout 只输出最终 JSON。
- 过程日志写 stderr。
- 单文件辅助命令会向 stdout 打印人类可读报告，不适合作为 workflow JSON 输入。

### `src/bin/codex-auto-fix.rs`

只有一行：

```rust
include!("codex.rs");
```

它复用 `codex.rs` 的完整 CLI 定义，生成另一个二进制 `codex-auto-fix`。这样 CI 可以调用 `codex-auto-fix pr-auto-fix`，而 `CODEX_AGENT_COMMAND` 仍可指向真实 Codex CLI 的 `codex exec ...`，降低命名冲突和递归风险。

## 测试文件

### `tests/e2e_auto_fix.rs`

端到端测试，使用临时 git 仓库和 fake agent shell 脚本验证自动修复行为。

覆盖场景：

- `auto_fix_local_applies_patch_with_local_codex_command`：fake agent 返回 review JSON、patch、安全通过、质量分，验证文件确实从 `1` 改成 `2`，stdout JSON 字段正确。
- `auto_fix_local_blocks_push_when_security_audit_fails`：安全审计失败时，验证 `push_blocked=true`、不会新增 commit，但本地 patch 已应用。
- `auto_fix_local_reports_unfixed_same_file_issue_independently`：同一文件多条 issue 时，验证已修复和未修复说明独立记录。

测试辅助：

- `TestWorkspace` 创建临时目录、初始化 git、写 fake agent。
- `fake_agent_script` 根据 prompt 中的关键词模拟四类模型响应：Review 解析、patch 生成、安全审计、质量评分。
- 测试调用的是构建出来的 `CARGO_BIN_EXE_codex-auto-fix`，因此能覆盖真实 CLI 参数解析。

这份测试是修改自动修复核心行为后的最低验收线。

## Skill Pack 文件

### `skills/codex-cli-workflow/SKILL.md`

维护 `scripts/codex-cli` 时使用的本地 skill。它要求先读取并遵守 `${CLAUDE_PLUGIN_ROOT}/AGENTS.md`，然后按以下流程工作：

- 搜索本目录代码，定位入口与数据流。
- 明确改动范围与验收标准。
- 小步改动，保持 stdout JSON 契约稳定。
- 完成后运行 `cargo fmt`、`cargo clippy --all-targets -- -D warnings`、`cargo test`。

它还列出常用入口：`src`、`docs`、`src/bin/codex.rs`。该文件不参与 Rust 编译，服务于 Agent Runtime 的技能发现和执行约束。

## 文档文件

### `docs/README.md`

`codex-cli` 文档首页。说明项目定位、完全本地执行架构、快速开始、环境变量、构建方式、PR 模式和本地模式使用示例，并提供文档导航。

新增重要文档时应在这里加链接，避免后续 Agent 找不到。

### `docs/file-inventory.md`

本文档。它是文件级地图，解释 `scripts/codex-cli` 下所有非构建产物文件的作用，并说明 `.env`、`target/` 等特殊路径的处理方式。

### `docs/architecture.md`

迁移占位文档，提示“架构与模块”已迁移到 `docs/design-docs/architecture.md`。保留它是为了兼容旧链接。

### `docs/cli.md`

迁移占位文档，提示“CLI 与输出契约”已迁移到 `docs/references/cli.md`。保留它是为了兼容旧链接。

### `docs/configuration.md`

迁移占位文档，提示“配置与策略”已迁移到 `docs/references/configuration.md`。保留它是为了兼容旧链接。

### `docs/development.md`

迁移占位文档，提示“开发与发布”已迁移到 `docs/references/development.md`。保留它是为了兼容旧链接。

### `docs/pipeline.md`

迁移占位文档，提示“Pipeline / Skills 设计”已迁移到 `docs/design-docs/pipeline.md`。保留它是为了兼容旧链接。

### `docs/security.md`

迁移占位文档，提示“安全与边界”已迁移到 `docs/design-docs/security.md`。保留它是为了兼容旧链接。

### `docs/troubleshooting.md`

迁移占位文档，提示“故障排查”已迁移到 `docs/references/troubleshooting.md`。保留它是为了兼容旧链接。

### `docs/design-docs/README.md`

设计文档目录索引，说明这里放“为什么这么设计”的内容，并链接架构、Pipeline、安全文档。

### `docs/design-docs/architecture.md`

架构设计说明。它解释项目目标、非目标、分层依赖方向、核心数据流、跨仓库 `repo_root`、规则注入、patch 应用安全、stdout JSON 输出契约，以及未来可演进方向。

适合在改模块边界、运行入口或跨仓库复用能力前阅读。

### `docs/design-docs/pipeline.md`

Pipeline 与 Skills 的详细设计。它说明 `SkillContext` 字段、默认 Skill 顺序、轮次边界、可观测输出、如何新增 Skill。

适合在调整自动修复流程、增加审计步骤、修改反馈策略前阅读。

### `docs/design-docs/security.md`

安全边界说明。它描述当前安全模型、受保护文件过滤、Dry-Run 默认安全、`git apply` patch 应用、prompt-based 安全审计，以及实际使用建议。

适合在开启 `--yes`、改安全策略、改受保护文件过滤时阅读。

### `docs/references/README.md`

参考文档目录索引，说明这里放“怎么用”的内容，并链接 CLI、配置、自动 Review、开发发布、故障排查。

### `docs/references/auto-review-usage.md`

自动 Review 使用说明。它描述 Gemini Code Assist Review + 本地 Codex 自动修复闭环，包括前置条件、安装、`CODEX_AGENT_COMMAND` 配置、GitHub Actions 流程、环境变量、输出 JSON、安全门禁、人工合并标准、重跑方式和本地调试。

适合 runner/CI 接入和 PR 自动修复操作时阅读。

### `docs/references/cli.md`

CLI 与输出契约参考。它列出两个二进制入口、命令分类、stdout/stderr 约定、`review`、`refactor`、`doc`、`pr-auto-fix`、`auto-fix-local` 的参数和输出 JSON 示例。

适合写 workflow、调试命令参数或接入调用方时阅读。

### `docs/references/configuration.md`

配置与策略参考。它说明：

- `CODEX_AGENT_COMMAND`
- `CODEX_AGENT_TIMEOUT_SECONDS`
- prompt 三种传递方式
- 递归调用保护
- `CODEX_ALLOWED_SEVERITIES`
- `CODEX_PROTECTED_FILES`
- `CODEX_EXCLUDE_DOCS`
- `--rules-file`
- changelog 策略
- PR 评论依赖

适合修改默认策略、跨仓库复用或 runner 配置时阅读。

### `docs/references/development.md`

开发与发布参考。它说明本地开发步骤、常用 `cargo fmt` / `cargo clippy` / `cargo test` 命令、Skill Pack 自动加载机制、运行示例、发布建议和故障排查入口。

适合维护 `codex-cli` 自身、发布二进制或新增 skill 时阅读。

### `docs/references/troubleshooting.md`

故障排查参考。它按现象列出处理方式，包括缺少 `CODEX_AGENT_COMMAND`、本地 Codex 命令失败、Review JSON 解析失败、没有修复文件、`git apply` 失败、PR 评论失败、changelog 写入失败。

适合 CI 红了或本地命令异常时第一时间阅读。

### `docs/constraints/README.md`

永久约束列表。记录不应被打破的工程契约：

- 自动修复命令 stdout 必须只输出 JSON。
- 日志必须写 stderr。
- patch 必须是 unified diff 且包含 `@@`。
- patch 必须通过 `git apply`。
- 不泄露凭证。
- 未传 `--yes` 不得提交/推送。
- 安全审计失败必须 fail-closed。
- `repo_root`、规则文件、changelog 必须可配置。

修改核心行为时应先检查这里；如果修复 bug 后形成新规则，也应补充这里。

### `docs/exec-plans/README.md`

执行计划目录说明。它给出计划模板：目标与非目标、假设与风险、依赖、验收标准。该目录不会被运行时读取，只用于改动可追溯。

### `docs/integrations/github-actions.md`

GitHub Actions 集成说明。它解释 `codex-auto-fix pr-auto-fix` 在 workflow 中的典型调用、stdout JSON 如何写入 `GITHUB_OUTPUT`、跨仓库参数化、`gh` 评论权限和 push 权限要求。

适合维护 `.github/workflows/codex-auto-fix.yml`、`.github/workflows/gemini-review-kickoff.yml` 或接入其他仓库的 CI 时阅读。

## 构建产物目录

### `target/`

Cargo 构建产物目录，包含 debug/release 二进制、增量编译缓存、依赖编译结果、flycheck 输出等。

重要子目录：

- `target/debug/`：debug 构建结果，包含 `codex`、`codex-auto-fix`、`libcodex_cli.rlib` 等。
- `target/release/`：release 构建结果，包含优化后的 `codex`、`codex-auto-fix`。
- `target/debug/deps/`、`target/release/deps/`：依赖和测试编译产物。
- `target/debug/incremental/`、`target/release/incremental/`：增量编译缓存。
- `target/flycheck1/`：编辑器或 rust-analyzer flycheck 产生的 stdout/stderr。
- `target/tmp/`：Cargo 或测试运行可能使用的临时目录。

处理规则：

- 不手工编辑。
- 不作为源码审查对象。
- 不应进入文档逐文件维护，因为内容由 Cargo 生成且会频繁变化。
- 若需要清理构建缓存，应先获得人类批准，因为删除属于破坏性操作边界。

## 改动导航

常见任务对应入口：

- 改 CLI 参数：先看 `src/bin/codex.rs`，再看 `docs/references/cli.md`。
- 改输出 JSON：先看 `src/types.rs` 的 `PrAutoFixOutput`，再查 workflow 和 docs。
- 改模型调用方式：看 `src/llm.rs` 和 `docs/references/configuration.md`。
- 改自动修复策略：看 `src/skills.rs` 的 `decide_fix_or_skip` / `generate_fix_patch`。
- 改 git/gh/changelog 行为：看 `src/repo.rs`。
- 改流程顺序：看 `src/runtime.rs` 的 Pipeline 组装。
- 新增 Skill Pack 能力：看 `skills/codex-cli-workflow/SKILL.md` 和 `.claude-plugin/plugin.json`。
- 排查 CI：先看 `docs/references/troubleshooting.md` 和 `docs/integrations/github-actions.md`。
