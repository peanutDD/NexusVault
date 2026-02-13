---
name: "project-code-review-author"
description: "Guides authors to prepare and respond to code reviews in this repo. Invoke when user asks how to submit PRs or address review feedback."
---

# 代码审查技能：作者侧

面向提交 PR 的作者，明确提交前准备、PR 描述规范与自查清单，确保审查高效可执行。

## 适用时机

- 准备提交 PR
- 需要补全 PR 描述或审查类别
- 收到审查意见后需要按规范回应与修复

## 提交前准备

- 阅读 CONTRIBUTING 与 CODE_REVIEW_GUIDE
- 确认改动范围清晰且无无关文件
- 本地检查通过：
  - 后端：cargo fmt / clippy / test
  - 前端：npm run lint / test / build

## PR 描述模板要点

- 变更说明：目的 + 关键改动
- 审查类别：后端 / 前端 / API / 数据库 / 安全
- CI 状态：已通过或说明原因
- 若为 hotfix：标注豁免项与补齐计划

## 自查清单（摘要）

- P0：安全、认证、user_id 隔离、参数化 SQL、敏感信息不落日志、CI 通过
- P1：分层、错误处理、流式/N+1、破坏性 API、迁移与索引
- P2：可访问性、建议项、测试覆盖、OpenAPI 同步

## 回复审查意见

- 逐条回应，明确“已修复/已解释/需讨论”
- 对关键问题给出改法或引用本仓示例
- 修复后推送新提交并说明影响面变化

## 参考文档

- docs/CODE_REVIEW_GUIDE.md
- docs/CODE_REVIEW_USAGE.md
- .github/PULL_REQUEST_TEMPLATE.md
