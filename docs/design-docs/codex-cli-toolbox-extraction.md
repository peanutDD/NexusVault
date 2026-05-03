# codex-cli 独立工具箱改造设计

版本：v1.0
日期：2026-05-04
状态：开发准备稿

## 1. 背景

当前 `scripts/codex-cli` 已经具备自动修复工具的核心形态：它是一个 Rust crate，包含 `codex-auto-fix` 二进制入口、`auto-fix-local` 本地命令、`pr-auto-fix` GitHub Actions 命令、pipeline/skill 分层、文档与 e2e 测试。

目标是将它从本仓库内部脚本整理为可复用工具箱，让其他项目也能接入自动化 review + fix 流程。

## 2. 结论

可以独立化，但需要先把当前的项目假设抽成配置。

当前能力更准确地说是“消费已有 review 并自动 fix”。如果目标是完整“自动 review + fix”，需要新增 PR diff review 生成能力；否则它仍依赖 Gemini Code Assist、GitHub review 评论或人工提供的 review 文本作为输入。

## 3. 当前可复用能力

### 3.1 可安装 crate

`scripts/codex-cli/Cargo.toml` 已定义独立 Rust package 与两个 bin：

- `codex`
- `codex-auto-fix`

当前可在 runner 或本地机器安装：

```bash
cd /path/to/upload-download-util/scripts/codex-cli
cargo install --path .
```

### 3.2 任意仓库本地修复

`auto-fix-local` 支持指定目标仓库：

```bash
codex-auto-fix auto-fix-local \
  --repo-root /path/to/target-repo \
  --review-file /path/to/review.md \
  --rules-file /path/to/target-repo/AGENTS.md \
  --disable-changelog
```

该模式不依赖 GitHub PR，适合作为跨项目迁移的最小可行路径。

### 3.3 PR 自动修复

`pr-auto-fix` 支持在 GitHub Actions 中消费 Review 文本，输出 JSON 供 workflow 解析：

```bash
codex-auto-fix pr-auto-fix \
  --pr-number "$PR_NUMBER" \
  --gemini-review "$REVIEW_BODY" \
  --max-rounds 2 \
  --yes
```

### 3.4 模型执行器可替换

真实模型调用由环境变量指定：

```bash
CODEX_AGENT_COMMAND="codex exec --skip-git-repo-check -"
CODEX_AGENT_TIMEOUT_SECONDS=900
```

工具自身只负责组织 prompt、调用外部执行器、接收 stdout。

## 4. 当前耦合点

### 4.1 Gemini 命名耦合

当前 CLI 参数、函数名、prompt 文案和 workflow 均显式使用 Gemini：

- `--gemini-review`
- `read_gemini_review`
- `Gemini Code Assist Review`
- `gemini-code-assist[bot]`
- `gemini-review-round-*`

这会让工具看起来只服务 Gemini，不利于接入 GitHub Copilot Review、CodeRabbit、人工 review 或其他模型输出。

### 4.2 GitHub Actions 耦合

现有 workflow 写死了：

- runner label：`file-server`
- review bot：`gemini-code-assist[bot]`
- review trigger marker：`## Gemini Code Assist Review`
- skill pack root：`${{ github.workspace }}/scripts/codex-cli`
- 轮次标签：`gemini-review-round-*`

这些都应该成为模板参数。

### 4.3 仓库规则耦合

规则读取顺序目前是：

1. `--rules-file`
2. 目标仓库根目录下的 `AGENTS.md`
3. 内置兜底规则

这对本仓库足够，但作为工具箱需要支持专用配置文件，例如 `.codex-review-fix.yml`。

### 4.4 安全策略耦合

当前策略主要通过环境变量配置：

- `CODEX_ALLOWED_SEVERITIES`
- `CODEX_PROTECTED_FILES`
- `CODEX_EXCLUDE_DOCS`

这些设置不易版本化，也不方便每个目标项目声明自己的边界。

### 4.5 提交推送策略耦合

当前自动提交信息固定，push 目标固定为 `origin HEAD`。跨项目使用时，需要支持更细粒度控制：

- 只应用 patch，不提交
- 只提交，不推送
- 推送到指定分支
- 工作区必须 clean 才允许执行
- 限制最大修改文件数和 diff 行数

### 4.6 review 生成能力缺口

当前 `Review` 子命令只审查单文件，并且 `--fix` 走整文件写回，不适合作为 PR 级自动 review 的生产入口。

完整工具箱需要新增：

- `review-pr`
- `review-diff`
- `review-files`

这些命令生成结构化 review，再交给 fix pipeline。

## 5. 目标形态

### 5.1 推荐命名

建议将 crate/package 改名为以下之一：

- `codex-review-fix`
- `codex-auto-toolbox`
- `codex-review-toolbox`

推荐保留一个清晰入口：

```bash
codex-review-fix <command>
```

避免继续使用 `codex` 作为兼容 bin，防止与真实 Codex CLI 混淆。

### 5.2 推荐命令

```text
codex-review-fix
├── review-pr
├── review-diff
├── fix-review
├── pr-auto-fix
├── auto-fix-local
├── config validate
└── workflow install-template
```

命令职责：

- `review-pr`：读取目标仓库 PR diff，生成 review 文本或 JSON。
- `review-diff`：消费 diff 文件，生成 review。
- `fix-review`：消费结构化 review，生成并应用 patch。
- `pr-auto-fix`：GitHub Actions 专用封装。
- `auto-fix-local`：本地调试和非 GitHub 场景。
- `config validate`：校验目标项目配置。
- `workflow install-template`：生成 GitHub Actions 模板。

## 6. 配置文件设计

建议支持目标仓库根目录下的 `.codex-review-fix.yml`：

```yaml
version: 1

review:
  provider: gemini
  input_format: markdown
  allowed_severities:
    - Critical
    - High
    - Medium

rules:
  file: AGENTS.md

safety:
  require_clean_worktree: true
  exclude_docs: true
  max_files: 5
  max_diff_lines: 300
  protected_files:
    - Cargo.lock
    - package-lock.json
    - pnpm-lock.yaml
    - bun.lock
    - .env

changelog:
  enabled: false
  path: docs/CHANGELOG.md

git:
  commit: false
  push: false
  branch: null
  commit_message_template: "[skip ci] codex auto-fix: fix {file_count} files"

agent:
  command_env: CODEX_AGENT_COMMAND
  timeout_seconds: 900
```

CLI 参数优先级：

1. 显式 CLI 参数
2. `.codex-review-fix.yml`
3. 环境变量
4. 内置默认值

## 7. 改造清单

### P0：可独立发布

- 将 `scripts/codex-cli` 移到独立 crate 目录或独立仓库。
- 重命名 package 和 bin，去掉或弱化 `codex` 兼容入口。
- 将 `--gemini-review` 改为通用 `--review-text`，兼容保留旧参数一版。
- 将 `read_gemini_review` 改为 `parse_review`。
- 把 Gemini 相关 prompt 文案抽成 provider 配置。
- 新增 `.codex-review-fix.yml` 读取与校验。
- 文档更新为跨项目安装说明。

### P1：跨项目安全可用

- 新增 `--dry-run` / `--commit-only` / `--no-push`。
- 新增 `--require-clean-worktree`。
- 新增 `--max-files` 和 `--max-diff-lines`。
- 支持 `--allow-path` / `--deny-path`。
- 提交信息模板化。
- 修复 `CODEX_AGENT_COMMAND` 的 shell 参数解析，支持引号和复杂路径。
- 将 workflow 中的 bot、marker、runner label、轮次标签参数化。

### P2：完整 review + fix 闭环

- 新增 `review-diff`：消费 unified diff，输出结构化 review。
- 新增 `review-pr`：基于 base/head 生成 diff 并 review。
- 新增 review JSON schema，减少 Markdown 解析不确定性。
- 支持多 provider：`gemini`、`github-review`、`manual`、`custom`。
- 支持把 review/fix 结果输出为 SARIF 或 GitHub Check Run。

### P3：工具箱体验

- 新增 `codex-review-fix init` 生成配置文件。
- 新增 `codex-review-fix doctor` 检查依赖：`git`、`gh`、`jq`、模型执行器。
- 新增安装脚本或 GitHub Release 二进制。
- 新增 composite action 或 reusable workflow。
- 新增 sample repo 和 smoke test。

## 8. 迁移步骤

### 阶段 1：最小迁移

1. 在目标机器安装当前工具。
2. 在目标项目准备 `AGENTS.md` 或独立规则文件。
3. 准备 review 文本文件。
4. 运行：

```bash
codex-auto-fix auto-fix-local \
  --repo-root /path/to/target-repo \
  --review-file /path/to/review.md \
  --rules-file /path/to/target-repo/AGENTS.md \
  --disable-changelog
```

验收：

- stdout 是合法 JSON。
- patch 只应用到目标仓库。
- 未传 `--yes` 时不 commit、不 push。
- 受保护文件不会被修改。

### 阶段 2：目标项目 GitHub Actions 接入

1. 复制 workflow 模板到目标项目。
2. 设置 `CODEX_AGENT_COMMAND` secret 或 variable。
3. 配置 runner label。
4. 配置 review bot 和 trigger marker。
5. 用测试 PR 验证一轮 review + fix。

验收：

- Gemini 或其他 review bot 评论后触发 workflow。
- workflow 能提取完整 review 正文和 inline comments。
- `codex-auto-fix` 输出 JSON 可被 `jq` 解析。
- 成功修复后只推送 PR 分支。
- 安全审计失败时 fail-closed，不提交不推送。

### 阶段 3：正式工具箱发布

1. 重命名 crate 和 bin。
2. 发布 GitHub Release 二进制。
3. 发布配置文件 schema。
4. 发布 reusable workflow 或 composite action。
5. 为至少两个不同技术栈项目跑 smoke test。

验收：

- 新项目只需安装工具、写配置、复制 workflow 即可接入。
- 不需要复制 `scripts/codex-cli` 源码。
- 文档不再引用 `upload-download-util/scripts/codex-cli` 作为安装路径。

## 9. 开发验收标准

- `cargo fmt` 通过。
- `cargo clippy --all-targets -- -D warnings` 通过。
- `cargo test` 通过。
- `auto-fix-local` e2e 覆盖：
  - 成功应用 patch。
  - 安全审计失败时阻止 push。
  - 同文件多个 issue 可分别报告。
  - 配置文件覆盖默认策略。
  - protected files 不会被修改。
- workflow smoke test 覆盖：
  - review comment 触发。
  - pull request review 触发。
  - inline comments 拼接。
  - max round 标签推进。
  - no-op 时正确评论。

## 10. 风险与对策

| 风险 | 影响 | 对策 |
| --- | --- | --- |
| Review Markdown 格式漂移 | 解析失败或漏修 | 增加 JSON schema 输入，provider parser 分层 |
| 模型生成 patch 不稳定 | `git apply` 失败 | 保持 unified diff 校验，增加重试和最小上下文提示 |
| 自动 push 越界 | 修改非目标分支或敏感文件 | 默认 dry-run，启用 clean worktree、path allow/deny、diff 限制 |
| 工具递归调用自己 | 无限递归或超时 | 保留 recursive command 检测，并避免 bin 名称冲突 |
| 不同项目规则差异大 | 修复风格不一致 | 强制规则文件注入，支持项目级配置 |
| GitHub token 权限不足 | 评论、标签、push 失败 | `doctor` 命令提前检查权限 |

## 11. 推荐下一步

优先做 P0 + P1 的最小产品化：

1. 新增 `.codex-review-fix.yml` 配置读取。
2. 将 Gemini 命名抽象为 review provider。
3. 重命名 bin，避免与真实 Codex CLI 混淆。
4. 提供跨项目 workflow 模板。
5. 保持 `auto-fix-local` 作为所有项目的本地调试入口。

完成这五项后，即可把它作为独立工具箱应用到其他项目。
