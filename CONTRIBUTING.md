# 贡献指南

感谢你考虑为本项目做贡献。请先阅读本指南与 [docs/CODE_REVIEW_GUIDE.md](docs/CODE_REVIEW_GUIDE.md)（代码审查方案），以便 PR 能高效通过审查。

## 流程概要

1. Fork 本仓库，在分支上开发。
2. 确保 CI 通过：后端 `cargo fmt` / `cargo clippy` / `cargo test`，前端 `npm run lint` / `npm run test` / `npm run build`。
3. 提交 PR，填写 [PR 模板](.github/PULL_REQUEST_TEMPLATE.md) 并勾选本次变更涉及的审查类别。
4. 至少 1 人 Approve 且无未解决讨论后可合并。

## 代码审查

- 合并前必须经过代码审查，审查标准以 [docs/CODE_REVIEW_GUIDE.md](docs/CODE_REVIEW_GUIDE.md) 为准。
- 审查人按「按变更类型选审查路径」（该文档 §2.5）与「审查优先级与耗时」（§2.7）执行，对「必须」项不满足会要求修改后再合。

## 分支与标签约定

| 场景 | 分支/标签 | 审查严格度 |
|------|-----------|------------|
| 常规 feature/fix | 普通 PR，无特殊 label | 按审查方案 §2.5 路径 + P0/P1 必过 |
| 紧急 hotfix | 分支名含 `hotfix/` 或 PR 打 label `hotfix` | 仅 P0 + 变更路径 P1；P2 可省略 |
| 实验性/大重构 | PR 打 label `draft` 或 `experimental` | 可先合入实验分支；合入 main 时按常规审查 |

## 豁免

在紧急 hotfix 等特殊情况下需暂时豁免某条「必须」时：

1. 在 PR 描述中**明确写出**：豁免的本指南条款、原因、后续补齐计划（或关联 Issue）。
2. 至少 1 人 Approve，且审查人确认已知晓该豁免。
3. 合入 main 的 PR 不得携带未解决的豁免（要么已补齐，要么变更已撤销）。

豁免的批准权限与仓库合并权限一致；若团队约定 hotfix 需 2 人 Approve，请在仓库设置或本文件中说明。

## 文档与规范

- 后端架构与性能规范见 [backend/ENGINEERING_PLAYBOOK.md](backend/ENGINEERING_PLAYBOOK.md)。
- 文件相关 SQL 的用户隔离规范见 [.cursor/rules/file-sql-user-scope.mdc](.cursor/rules/file-sql-user-scope.mdc)。
- 前端与 Rust 编码规范见 [.cursor/rules/](.cursor/rules/)。
