# 前端子项目说明（frontend）

本目录是前端应用（React 19 + TypeScript + Vite），用于文件管理界面与交互。

## 文档导航

- 架构与性能：
  - [`docs/README.md`](./docs/README.md)：前端文档总览
  - [`docs/UI_SYSTEM.md`](./docs/UI_SYSTEM.md)：UI 设计系统与组件规范
  - [`docs/PERFORMANCE.md`](./docs/PERFORMANCE.md)：性能基线与优化策略
  - [`docs/PERFORMANCE_ISSUES.md`](./docs/PERFORMANCE_ISSUES.md)：已知性能问题清单
  - [`docs/REFACTORING.md`](./docs/REFACTORING.md)：前端重构方向与约定
  - [`docs/TOKENS_USAGE.md`](./docs/TOKENS_USAGE.md)：Design Tokens 使用规范与治理规则
- 交互与 UX：
  - [`docs/UI_UX_IMPROVEMENTS.md`](./docs/UI_UX_IMPROVEMENTS.md)：交互与体验改进总结

更多跨项目文档参见仓库根目录的 [`docs/README.md`](../docs/README.md)。

## 技术栈

- React 19
- TypeScript
- Vite
- Tailwind CSS
- React Router
- Zustand（状态管理）
- React Hook Form + Zod（表单与校验）
- Axios（HTTP 客户端）
- react-markdown / remark-gfm / rehype-*（Markdown 渲染）

## 本地开发

前置：确保后端在 `http://localhost:3000` 运行。

```bash
cd frontend
cp .env.example .env
# 将 VITE_API_BASE_URL 指向后端地址

npm install
npm run dev
```

默认开发地址为 `http://localhost:5173`。

## 工程脚本

### Design Tokens 治理（避免 Tailwind 调色板硬编码）

在 `src/pages/**`、`src/components/layout/**`、`src/components/common/**` 等目录中，要求颜色必须走 semantic/component tokens。提供扫描脚本便于本地巡检与 CI 卡口：

- `npm run check:tokens`：输出报告（不阻断）
- `npm run check:tokens:strict`：严格模式（阻断）
- `npm run check:tokens:layout`：仅扫描 `layout`（便于先卡核心布局）
- `npm run check:tokens:strict:layout`：严格模式 + 仅 layout

### Settings 调试（布局检查）

Settings 页可用 query 参数强制展示一个调试用错误提示框，方便检查提示条出现时的布局变化：

- `/settings?debugAlerts=1`（仅开发环境生效）
