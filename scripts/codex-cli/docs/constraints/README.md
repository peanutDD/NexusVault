## 永久约束（constraints）

这里记录“不会变/不该被打破”的工程约束，避免跨仓库复用时出现隐性假设。

### 输出契约

- 自动修复命令（`pr-auto-fix` / `auto-fix-local`）stdout 必须只输出一段 JSON（供 CI 稳定解析）
- 运行日志必须写 stderr，避免污染 JSON

### Patch 约束

- 生成的 patch 必须是 unified diff，且包含 `@@` hunk
- 为空或缺少 `@@` 时，视为无效 patch（跳过，不写入文件）
- patch 应用使用 `git apply`，避免直接覆盖文件

### 安全约束

- 不打印/不落盘本地 Codex 凭证、runner token 或其它密钥
- 默认对高风险文件做硬过滤（锁文件/配置文件/.env 等），并允许通过环境变量追加保护名单
- 未传 `--yes` 时不得提交/推送（Dry-Run 默认安全）
- 安全审计未通过或不可解析时必须 fail-closed，不得提交/推送
- `Medium/Medium+/High/Critical` Gemini findings 未全部 `resolved` 前，不得标记 `gemini-review-clean` 或 `ready_to_merge=true`
- 外力失败、策略过滤、验证/提交/推送失败必须记录具体原因、解决办法、是否可重试，并写入 PR 评论和本地 ledger

### 兼容性约束

- `repo_root` 必须可配置：不得硬依赖 `GITHUB_WORKSPACE`
- 规则文本来源必须可配置：支持 `--rules-file`，并能 fallback 到 `<repo_root>/AGENTS.md`
- changelog 必须可选：允许 `--disable-changelog` 或指定 `--changelog-path`
