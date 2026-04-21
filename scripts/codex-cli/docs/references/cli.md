## CLI 与输出契约

`codex` 二进制提供两类命令：

- 本地单文件辅助：`review` / `refactor` / `doc`
- 自动修复流水线：`pr-auto-fix` / `auto-fix-local`

命令定义见：[codex.rs](file:///Users/tyone/github/upload-download-util/scripts/codex-cli/src/bin/codex.rs)

### 通用约定

- stdout：仅输出最终结果（自动修复命令输出 JSON）
- stderr：输出运行日志（便于 CI 抓取但不污染 JSON）

### review

审查单个文件；可选 `--fix` 直接把模型返回的代码块写回文件。

```bash
codex review --path src/lib.rs
codex review --path src/lib.rs --fix
```

### refactor

按策略重构单个文件（策略是 prompt 参数）。

```bash
codex refactor --path src/lib.rs --strategy modularize
```

### doc

对单个文件生成 Markdown 文档并输出到 stdout。

```bash
codex doc --path src/lib.rs --kind api
```

### pr-auto-fix

对“PR 的 Gemini Review 文本”执行自动修复。适用于 GitHub Actions。

```bash
codex pr-auto-fix \
  --pr-number 123 \
  --gemini-review "$GEMINI_REVIEW" \
  --max-rounds 2 \
  --yes \
  --repo-root "$GITHUB_WORKSPACE"
```

参数说明：

- `--pr-number`：PR 号（用于评论与 changelog 记录）
- `--gemini-review`：Gemini Review 的完整文本（通常是 Markdown）
- `--max-rounds`：当前实现用于写入 changelog 的 round 字段（并非循环修复次数）
- `--yes`：允许提交/推送（未传则 Dry-Run）
- `--repo-root`：仓库根目录（默认取 `GITHUB_WORKSPACE` 或当前目录）
- `--rules-file`：规则文件路径（覆盖 repo_root 下 `AGENTS.md`）
- `--changelog-path`：changelog 路径（相对路径会基于 repo_root 拼接）
- `--disable-changelog`：禁用 changelog 写入
- `--no-pr-comments`：禁用 PR 评论（仍会执行修复/推送）

输出（stdout）：

```json
{
  "fixed": true,
  "files": ["src/a.rs"],
  "quality_score": 95,
  "security_passed": true,
  "summary": "Gemini 对本次 PR 的整体总结"
}
```

### auto-fix-local

不依赖 GitHub PR，直接对本地仓库执行自动修复流水线。

```bash
codex auto-fix-local \
  --repo-root /abs/path/to/any-repo \
  --review-file /abs/path/to/review.md \
  --max-rounds 2 \
  --yes
```

参数说明：

- `--repo-root`：目标仓库根目录（必须是 git 仓库，且能执行 `git apply`）
- `--review-file`：包含 review 文本的文件
- `--yes`：允许提交/推送（未传则 Dry-Run，不会提交/推送）
- `--rules-file / --changelog-path / --disable-changelog`：同 `pr-auto-fix`

输出（stdout）：同 `pr-auto-fix`。

