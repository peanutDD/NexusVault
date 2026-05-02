## codex-cli 文档

`codex-cli` 是一个可复用的“自动化 Review → 生成补丁 → 应用补丁 → 可选推送/反馈”的命令行工具。

它既可以在 GitHub Actions 里对 PR 的 Gemini Review 执行自动修复，也可以脱离 GitHub，直接对任意本地仓库执行同样的修复流水线。

### 快速开始

**前置依赖**

- Rust（用于构建）
- `git`（用于 `git apply` / `git add` / `git commit` / `git push`）
- （可选）`gh`（用于 PR 评论：`gh pr comment`）

**环境变量**

- `CODEX_AGENT_COMMAND`：必填，本地 Codex 执行命令，例如 `codex exec --skip-git-repo-check -`
- `CODEX_AGENT_TIMEOUT_SECONDS`：可选，单次 Codex 调用超时，默认 `900`

**构建**

```bash
cargo build --release
```

### 使用方式

**GitHub PR 模式（供 Actions 调用）**

```bash
./target/release/codex-auto-fix pr-auto-fix \
  --pr-number 123 \
  --gemini-review "$GEMINI_REVIEW" \
  --max-rounds 2 \
  --yes \
  --repo-root "$GITHUB_WORKSPACE"
```

**本地仓库模式（跨仓库复用）**

```bash
./target/release/codex-auto-fix auto-fix-local \
  --repo-root /abs/path/to/any-repo \
  --review-file /abs/path/to/review.md \
  --max-rounds 2 \
  --yes
```

### 文档导航

**目录结构**

- `design-docs/`：架构与设计文档（为什么这么设计）
- `references/`：使用与配置参考（怎么用）
- `integrations/`：外部集成（CI/Actions）
- `constraints/`：永久约束（不会变/不该被打破）
- `exec-plans/`：执行计划样例/模板（改动可追溯）

**推荐阅读顺序**

- [架构与模块](design-docs/architecture.md)
- [Pipeline / Skills 设计](design-docs/pipeline.md)
- [CLI 与输出契约](references/cli.md)
- [配置与策略（规则/Changelog/过滤）](references/configuration.md)
- [自动 Review 使用说明](references/auto-review-usage.md)
- [Skill Pack 自动加载（零同步）](references/development.md#skill-pack-自动加载零同步)
- [GitHub Actions 集成](integrations/github-actions.md)
- [开发与发布](references/development.md)
- [安全与边界](design-docs/security.md)
- [故障排查](references/troubleshooting.md)
- [永久约束](constraints/README.md)
