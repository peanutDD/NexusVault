## 故障排查

### 1) 启动即报错：请在 .env 中设置 OPENAI_API_KEY

原因：`OPENAI_API_KEY` 是硬依赖，客户端初始化会直接失败，避免“静默空跑”。

处理：

- 本地：创建 `scripts/codex-cli/.env` 并写入 `OPENAI_API_KEY=...`
- CI：配置 secrets，并在 job 环境里导出

### 2) API 请求失败（401/403/429/5xx）

处理顺序：

1. 确认 `OPENAI_API_BASE` 指向的网关可访问
2. 确认 `CODEX_MODEL` 在该网关上可用
3. 429：降频或增加并发限制；检查是否被网关限流
4. 5xx：重试或切换网关

### 3) 解析 Gemini Review JSON 失败

现象：报错包含 `解析 Gemini Review JSON 失败`，并附带模型原始输出。

原因：`ReadReviewSkill` 需要模型严格输出 JSON；若模型输出夹杂解释文字，会导致反序列化失败。

处理：

- 确认输入的 Gemini Review 文本完整且未截断
- 尝试更换/固定模型（例如更稳定的 JSON 输出模型）
- 将 Gemini Review 先保存为文件，减少 shell 转义影响

### 4) 没有修复任何文件（fixed=false）

常见原因：

- issue 严重级别不在允许列表里（默认只处理 Critical/High/Medium）
- 命中受保护文件（默认排除锁文件、配置文件、`.env` 等）
- 默认排除 docs 与 `.md`

处理：

- 调整环境变量：
  - `CODEX_ALLOWED_SEVERITIES=High,Medium`
  - `CODEX_EXCLUDE_DOCS=false`
  - `CODEX_PROTECTED_FILES=...`

### 5) git apply 失败

原因：patch 的上下文与当前工作区不匹配，或者模型输出的 patch 不合法。

处理：

- 确认 `repo_root` 指向的工作区就是你要修复的仓库
- 确认 review 里的文件路径与仓库路径一致
- 如果 issue 已过期（代码已变化），需要重新生成 review

### 6) PR 评论失败

原因：`gh` 未安装/未登录/权限不足。

处理：

- GitHub Actions：确保 runner 有 `gh`，并正确配置 token 权限
- 或直接禁用：`--no-pr-comments`

### 7) changelog 写入失败或不希望写入

处理：

- 仓库没有 changelog：使用 `--disable-changelog`
- 或指定路径：`--changelog-path docs/CHANGELOG.md`

