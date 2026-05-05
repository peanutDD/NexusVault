# 自动化 Review 与修复：全流程运行手册

本文档定义了从提交代码到 AI 自动修复、再到人工最终确认的完整标准操作流程（SOP）。

## 1. 环境准备 (Setup)
在首次运行前，请确保以下环境已就绪：

### 1.1 本地端 (Self-hosted Runner)
- **编译工具**: 安装 Rust 2024 edition 环境。
- **CLI 安装**: 
  ```bash
  cd scripts/codex-cli
  cargo install --path .
  ```
- **环境变量**: 在 runner 环境、GitHub Actions variable/secret，或 `scripts/codex-cli/.env` 中配置：
  - `CODEX_AGENT_COMMAND`: 本地 Codex GPT-5.5 执行命令，例如 `codex exec --skip-git-repo-check -`。
  - `CODEX_AGENT_TIMEOUT_SECONDS`: 可选，单次本地 Codex 调用超时，默认 900 秒。
- **Runner 启动**: 启动 GitHub Self-hosted Runner，确保其能够接收 `file-server` 标签的任务。

### 1.2 云端 (GitHub Actions)
- 确保 `.github/workflows/codex-auto-fix.yml` 与 `.github/workflows/gemini-review-kickoff.yml` 已存在于默认分支。
- 确保项目 Secrets 中配置了 `GITHUB_TOKEN`（通常自动提供）。

---

## 2. 标准运行流程 (Execution Flow)

### 第一阶段：触发 Review
1. **提交代码**: 开发者推送代码并开启 PR。
2. **手动/自动触发**: 
   - 在 PR 下方评论 `/gemini review`（或系统检测到 PR 开启自动运行 Gemini）。
3. **Gemini 介入**: Gemini Code Assist 扫描代码并在 PR 下方生成带有 `## Gemini Code Assist Review` 标题的评论。

### 第二阶段：AI 自动修复 (The Loop)
1. **监听评论**: GitHub Action 捕获到 Gemini 的评论。
2. **启动本地编排**: Local Runner 启动，调用 `codex-auto-fix pr-auto-fix` 命令。
3. **执行 Pipeline**:
   - **Parse**: 结构化解析 Gemini 意见。
   - **Decide**: 过滤 Medium 以下及敏感文件。
   - **Fix**: Codex GPT-5.5 在本地生成 Patch。
   - **Apply**: 本地执行 `git apply` 修复。
   - **Security**: 对修复后的改动做安全审计（注入/泄露/严重逻辑漏洞）。
   - **Score**: 对修复结果做质量评分（0-100）。
   - **Doc**: 将本次变更摘要写入 `docs/CHANGELOG.md`（可审计/可追溯）。
   - **DryRun**: 未传 `--yes` 时，仅在 PR 留评论说明“已生成但未推送”，不执行提交与推送。
4. **推送更新**: 自动提交并推送代码（不使用 `[skip ci]`，必须触发 CI），并在 PR 下方发布结果评论。

### 第三阶段：循环与迭代
1. **自动复审**: 修复推送后，`codex-auto-fix` 状态机按轮次调用 `/gemini review` 请求 Gemini 对修复后的代码进行复审；`gemini-review-kickoff` 会跳过 `codex auto-fix` 提交，避免重复请求。
2. **轮次递增**: 
   - 第一轮清洁或已推送修复后进入 `round-2`。
   - `pending_explanations` 非空且没有任何修复时，标签变为 `gemini-review-needs-human`，不得误报“无需修复”。
   - 达到 `MAX_ROUNDS (2)` 后，标签变为 `round-max`；若无 pending，同时添加 `gemini-review-clean`。

---

## 3. 人工干预与合并 (Final Review)
1. **状态检查**: 看到 `gemini-review-round-max` + `gemini-review-clean` 标签，或确认 `gemini-review-needs-human` 中的问题已人工接受/处理。
2. **人工 Review**: 开发者查看 AI 修复后的 Diff。
3. **最终决策**:
   - **通过**: 点击 Merge 合并 PR。
   - **不通过**: 手动修改或关闭 PR。
   - **重跑**: 如需 AI 重新介入，手动将标签重置为 `round-1` 并再次评论 `/gemini review`。

## 4. 异常处理
- **补丁冲突**: 如果 `git apply` 失败，AI 会在 PR 留言告知具体文件，此时需人工介入手动修复冲突。
- **Runner 离线**: 检查本地机器的 Runner 进程是否存活。
- **Codex 超时**: 检查 `CODEX_AGENT_COMMAND` 是否指向真实 Codex CLI、runner 是否已登录授权，以及 `CODEX_AGENT_TIMEOUT_SECONDS` 是否过短。

---

> **核心原则**: AI 负责情报收集（Gemini）与体力活（Codex 搬砖），人类负责最后的质量关卡（Merge）。
