## 前端文档总览

本目录下是前端（React 19 + TypeScript）相关的设计与维护文档。

### 性能与问题排查

- `PERFORMANCE.md`：前端性能基线与优化方案（列表渲染、请求合并、懒加载等）
- `PERFORMANCE_ISSUES.md`：已发现的性能问题记录与跟进项

### 架构与重构

- `REFACTORING.md`：组件拆分、状态管理、路由等前端重构方向和约定
- `UI_SYSTEM.md`：UI 设计系统与组件规范（配色、布局、组件组合等）
- `TOKENS_USAGE.md`：Design Tokens 使用规范（命名规则、分层模型、评审清单与迁移策略）

> 提示：日常开发可以优先看 `UI_SYSTEM.md` 和根目录 `docs/CODE_REVIEW_GUIDE.md`；做性能排查时结合 `PERFORMANCE.md`、`PERFORMANCE_ISSUES.md` 与前端 `README.md` 中的工程约定一起使用。

### 治理与检查

- Token 扫描脚本：用于检测 `pages/layout/common` 范围内是否引入 Tailwind 调色板硬编码色（支持 report/strict 与 scope）。规则与用法见 `TOKENS_USAGE.md`。
