# 自动化 Review 与修复全流程 (Auto-Review & Fix Flow)

本文档详细记录了本项目中「Gemini 情报 + Codex 执行」的自动化闭环流程。

## 1. 流程概述
这是一套基于 **双模型博弈** 的自动化修复系统：
- **Review 层 (情报获取)**: 由 GitHub 接入的 **Gemini Code Assist** 负责，它会在 PR 提交后自动给出审查意见。
- **修复层 (执行层)**: 由本地 Self-hosted Runner 上的 **Codex (GPT-5.4)** 负责。它读取 Gemini 的意见，在本地 Harness Engineering 环境中执行修复并推送到 PR。

## 2. 核心架构：Skill 编排
整个流程由 `codex pr-auto-fix` 命令驱动，其内部编排了以下原子 Skill：

1. **情报解析 (read_gemini_review)**: 
   - 将 Gemini 的 Markdown 评论解析为结构化 JSON。
   - 提取文件、行号、严重程度、修复建议及溯源原文。
2. **决策引擎 (decide_fix_or_skip)**: 
   - **过滤逻辑**: 仅处理 `Critical`、`High`、`Medium` 优先级的问题。
   - **安全边界**: 自动跳过锁文件 (`Cargo.lock` 等)、配置文件 (`.env`) 和文档路径。
3. **补丁生成 (generate_fix_patch)**: 
   - 基于情报和本地源码上下文，生成标准的 `unified diff` 补丁。
4. **安全应用 (apply_patch_safely)**: 
   - 在本地隔离环境中尝试 `git apply`。
5. **提交推送 (commit_and_tag_round)**: 
   - 自动 `git commit`（含 `[skip ci]`）并推送。
   - 自动在 PR 留言告知进度。

## 3. 循环控制与 Loop 策略
系统通过 PR 标签 (`gemini-review-round-*`) 管理状态：
- **默认轮次**: 2 轮。
- **终止条件**: 
  - 达到 2 轮上限。
  - 无需修复的高/中优先级问题。
  - 决策引擎过滤后无待修复项。
- **人工干预**: 最后一轮结束后，由人类进行最终 Review 并决定是否合并。

## 4. 方案优势
1. **视角互补**: Review 模型 (Gemini) 与修复模型 (GPT-5.4) 不同，能有效发现视觉盲点。
2. **交付稳定**: 修复动作在本地模拟真实开发环境（Harness Engineering）中运行，确保代码可编译且符合项目规则。
3. **决策在我**: AI 负责搬砖（情报提取与补丁生成），人类负责关键节点（是否合并、是否开启新轮次）。

## 5. 快速开始
在 PR 下方回复 `/gemini review` 即可触发 Gemini 的第一轮审查，随后系统会自动进入闭环流程。
