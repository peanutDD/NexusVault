# 自动化 Review 与修复全流程 (Auto-Review & Fix Flow)

本文档详细记录了本项目中「Gemini 情报 + Codex 执行」的自动化闭环流程。

## 1. 流程概述
这是一套基于 **双模型博弈** 的自动化修复系统：
- **Review 层 (情报获取)**: 由 GitHub 接入的 **Gemini Code Assist** 负责，它会在 PR 提交后自动给出审查意见。
- **修复层 (执行层)**: 由本地 Self-hosted Runner 上的 **Codex (GPT-5.4)** 负责。它读取 Gemini 的意见，在本地 Harness Engineering 环境中执行修复并推送到 PR。

## 2. 核心架构：Pipeline 编排模式
系统采用更加工程化的 **Pipeline + Context** 编排模式：

### 2.1 Skill Context (技能上下文)
所有原子技能共享一个 `SkillContext` 对象，用于在流水线中传递状态（如 PR 编号、解析后的情报、已修复的文件列表等）。

### 2.2 Pipeline (流水线)
流程被拆分为一系列实现了 `Skill` Trait 的原子对象：
- **ReadReviewSkill**: 情报解析，将原始文本转为结构化数据。
- **DecisionSkill**: 决策过滤，基于严重程度和受保护文件列表进行筛选。
- **BatchFixSkill**: 批量修复，循环生成补丁并应用。
- **SecurityCheckSkill**: **[NEW] 安全审计**，对修复后的代码进行注入、泄露及逻辑漏洞扫描。
- **QualityScoreSkill**: **[NEW] 质量评分**，依据 AGENTS.md 规则 15 对修复成果进行 0-100 分评估。
- **DocumentationSkill**: **[NEW] 变更入档**，将每次自动修复的变更文件、安全结果与评分写入 `docs/CHANGELOG.md`。
- **FeedbackSkill**: 结果反馈，整合安全报告与评分，执行推送及评论。

这种模式的优势在于：
- **高解耦**: 增加安全审计或评分步骤只需在 `Pipeline` 定义中 `add` 即可，无需改动核心修复逻辑。
- **可复用**: `SecurityCheckSkill` 可以被复用到任何需要扫描代码安全性的其他命令（如 `codex review --scan`）中。
- **强一致性**: 确保所有修复任务都经过相同的质量门禁（Quality Gate）。
- **可追溯**: 每次自动修复都会在 `docs/CHANGELOG.md` 留下可审计记录，避免“AI 改了什么”无法复盘。

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
