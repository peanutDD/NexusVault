## 文档总览

这里集中放置项目的所有说明文档，避免仓库根目录被大量 Markdown 文件淹没。

- **高并发与架构**
  - `高并发.md`：高并发落地路线与关键策略
  - `开关矩阵与接口边界.md`：功能开关表与 provider 接口边界（本地可跑、云端可开关）
  - `前端降低后端并发压力方案.md`：前端策略（缓存、并发、滚动）降低后端压力
  - `BILIBILI_TECH_UPGRADE.md`：对标式技术升级建议（偏架构/规划）
  - `../backend/docs/TOP_TECH.md`：顶级视频平台技术对标与本项目落地映射表

- **变更日志**
  - `CHANGELOG.md`：项目变更日志，记录 Bug 修复、新功能、性能优化及技术细节

- **代码审查与 AI 自动化**
  - `CODE_REVIEW_GUIDE.md`：代码审查规范（企业级）
  - `design-docs/auto-review-flow.md`：**[NEW] 自动化 Review 与修复全流程说明**
  - `CODE_REVIEW_START.md`：代码审查开始使用清单
  - `CODE_REVIEW_USAGE.md`：代码审查使用指南（作者/审查人/团队）
  - `CODE_REVIEW_REPORT.md`：代码审查报告模板
  - `constraints/ai-auto-fix-rules.md`：AI 自动修复永久约束规则

- **开发流程**
  - `NEXT_STEPS.md`：后续改进建议和 roadmap
  - `GITHUB_PUSH.md`：推送/权限/分支说明

- **子项目文档**
  - 后端：`backend/docs/README.md`（后端文档总览，含配置、API、自检、优化）
  - 前端：`frontend/docs/README.md`（前端文档总览，含性能、重构、UI 系统）

> 提示：从“性能/高并发落地”视角入门，先看 `高并发.md` 与 `开关矩阵与接口边界.md`。
