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
- **环境变量**: 在 `scripts/codex-cli/.env` 中配置：
  - `OPENAI_API_KEY`: 你的 GPT-5.4/Codex 密钥。
  - `OPENAI_API_BASE`: API 代理地址。
  - `CODEX_MODEL`: 指定模型（默认 `gpt-4-turbo-preview`）。
- **Runner 启动**: 启动 GitHub Self-hosted Runner，确保其能够接收 `file-server` 标签的任务。

### 1.2 云端 (GitHub Actions)
- 确保 `.github/workflows/ai-auto-fix.yml` 已存在于默认分支。
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
2. **启动本地编排**: Local Runner 启动，调用 `codex pr-auto-fix` 命令。
3. **执行 Pipeline**:
   - **Parse**: 结构化解析 Gemini 意见。
   - **Decide**: 过滤 Medium 以下及敏感文件。
   - **Fix**: GPT-5.4 在本地生成的 Patch。
   - **Apply**: 本地执行 `git apply` 修复。
4. **推送更新**: 自动提交并推送代码（附带 `[skip ci]`），PR 标签自动升级为 `gemini-review-round-1`。

### 第三阶段：循环与迭代
1. **自动复审**: 修复推送后，Action 会自动再次调用 `/gemini review` 请求 Gemini 对修复后的代码进行复审。
2. **轮次递增**: 
   - 如果 Gemini 仍有意见，进入 `round-2`。
   - 达到 `MAX_ROUNDS (2)` 后，标签变为 `round-max`。

---

## 3. 人工干预与合并 (Final Review)
1. **状态检查**: 看到 `gemini-review-round-max` 标签或 AI 留言「未发现高优先级问题」。
2. **人工 Review**: 开发者查看 AI 修复后的 Diff。
3. **最终决策**:
   - **通过**: 点击 Merge 合并 PR。
   - **不通过**: 手动修改或关闭 PR。
   - **重跑**: 如需 AI 重新介入，手动将标签重置为 `round-1` 并再次评论 `/gemini review`。

## 4. 异常处理
- **补丁冲突**: 如果 `git apply` 失败，AI 会在 PR 留言告知具体文件，此时需人工介入手动修复冲突。
- **Runner 离线**: 检查本地机器的 Runner 进程是否存活。
- **API 超时**: 检查网络连接或 API 额度。

---

> **核心原则**: AI 负责情报收集（Gemini）与体力活（Codex 搬砖），人类负责最后的质量关卡（Merge）。
