# 前端子项目说明（frontend）

本目录是前端应用（React 19 + TypeScript + Vite），用于文件管理界面与交互。

## 文档导航

- 架构与性能：
  - [`docs/README.md`](./docs/README.md)：前端文档总览
  - [`docs/UI_SYSTEM.md`](./docs/UI_SYSTEM.md)：UI 设计系统与组件规范
  - [`docs/PERFORMANCE.md`](./docs/PERFORMANCE.md)：性能基线与优化策略
  - [`docs/PERFORMANCE_ISSUES.md`](./docs/PERFORMANCE_ISSUES.md)：已知性能问题清单
  - [`docs/REFACTORING.md`](./docs/REFACTORING.md)：前端重构方向与约定
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
