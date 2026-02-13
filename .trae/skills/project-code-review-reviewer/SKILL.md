---
name: "project-code-review-reviewer"
description: "Provides reviewer workflow, checklists, and comment style for this repo. Invoke when user asks to review PRs or assess code changes."
---

# 代码审查技能：审查人侧

面向审查人，提供审查路径、优先级与可操作评论格式，确保 Review 质量与一致性。

## 适用时机

- 需要评审具体 PR / MR
- 需要给出审查意见或结论
- 需要快速选择审查路径与重点

## 审查流程

1. 明确改动范围：PR Files changed 或 `git diff main --name-only`
2. 选择审查路径：按变更类型映射到对应章节
3. 先过 P0，再按关联项覆盖 P1/P2
4. 输出可操作反馈：问题 + 条款出处 + 建议改法

## 变更类型与路径

- 后端 handler/接口：后端 + API + 安全
- 前端 UI/样式：前端 5.4/5.5 + 通用
- 前端逻辑/状态：前端 5.1/5.2/5.3 + 通用
- 迁移/SQL：数据库 + 安全 + 性能
- 认证/授权：安全 + 架构
- 上传/下载/存储：性能 + 安全 + PLAYBOOK
- 全栈：按文件逐层过后端/前端/API/数据库/安全

## P0/P1/P2

- P0：安全、认证、user_id 隔离、参数化 SQL、敏感信息不落日志、CI 通过
- P1：分层、错误处理、流式/N+1、破坏性 API、迁移与索引
- P2：可访问性、建议项、测试覆盖、OpenAPI 同步

## 典型检查要点

- 后端：Handler 薄、Service/Repo 分层、AppError、流式 I/O、无 N+1
- 前端：严格 TS、Zustand 选择器、a11y、shadcn 目录规范
- API：错误格式一致、破坏性变更已沟通
- DB：user_id 隔离、索引评估、DDL 风险

## 审查输出模板

- 审查范围：模块与路径
- P0 结论：通过或需修改
- P1/P2 建议：逐条列出建议改法
- 最终结论：Approve 或 Request Changes

## 评论格式

- 问题描述 + 规则引用 + 建议改法或参考文件
- 示例：建议加 `AND user_id = $n`，避免跨用户访问；见 file-sql-user-scope 与 repositories/files.rs

## 参考文档

- docs/CODE_REVIEW_GUIDE.md
- docs/CODE_REVIEW_USAGE.md
