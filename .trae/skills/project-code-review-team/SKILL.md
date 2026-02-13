---
name: "project-code-review-team"
description: "Helps teams roll out and operationalize code review standards in this repo. Invoke when user asks about process rollout or team policy."
---

# 代码审查技能：团队落地

面向团队层面的流程落地与持续改进，确保审查制度可执行、可复盘、可持续。

## 适用时机

- 初次引入或改造审查制度
- 需要配置分支保护与 CI 约束
- 需要建立审查度量与复盘机制

## 落地步骤

- 宣传统一入口：CODE_REVIEW_GUIDE 与 USAGE
- 使用 PR 模板强制勾选审查类别
- 开启分支保护：至少 1 人 Approve + 必需 CI
- 对 hotfix/豁免设置明确规则与补齐计划

## CI 与 Gates

- 后端：fmt/clippy/test 必须通过
- 前端：lint/test/build 必须通过
- 未通过不得合并

## 复盘与迭代

- 统计审查问题类型与频率
- 调整 P0/P1/P2 的范围与优先级
- 对高频问题补充示例或规则文档

## 参考文档

- docs/CODE_REVIEW_GUIDE.md
- docs/CODE_REVIEW_USAGE.md
- .github/workflows/ci.yml
- .github/PULL_REQUEST_TEMPLATE.md
