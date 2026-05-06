# Exec Plan — 2026-05-06: `/files` 路由刷新滚动位置恢复

## 人类意图

刷新浏览器后，`/files` 文件浏览页停留在用户原来的滚动位置（与 `/settings` 行为一致）。

## 假设

1. `ScrollRestoration` 已为 `/settings` 等路由实现 history-entry + URL fallback 双层 sessionStorage 持久化；`/files` 是被显式排除的最后一个主路由。
2. 排除 `/files` 的初始动机已不再成立：后续修复（C-036、`scroll-anchor` 关闭、虚拟列表 spacer 治理、URL fallback）已经覆盖该路径会遇到的副作用。
3. `/files` 的 `Files.tsx` + `FileList` 走异步 React Query + 虚拟滚动；刷新瞬间文档高度不足以容纳保存位置，单帧 `scrollTo` 会被夹紧到顶。

## 风险

| # | 风险 | 缓解 |
|---|---|---|
| 1 | 移除 `/files` 排除后污染其他场景（如登录态切换、push 进入 `/files`） | 通过 history `key` 隔离 + `navigationType !== "PUSH"` 控制 URL fallback；保留 push 场景从顶部开始的语义。 |
| 2 | 异步列表渲染慢于单次 RAF，恢复瞬间高度不够 → 仍回顶部 | 新增 RAF 重试循环（≤60 帧 ≈ 1s），每帧重新尝试 `scrollTo` 直到位置达成或预算耗尽。 |
| 3 | 重试期间用户已经手动滚动 → 抢夺用户控制权 | 监听 `wheel` / `touchmove` / `keydown`，一次触发即放弃恢复并 cleanup。 |
| 4 | `y === 0` 走重试会浪费帧 | 维持原双 RAF 快速路径，零额外开销。 |

## 依赖

- `frontend/src/router/ScrollRestoration.tsx`（核心）
- `frontend/src/router/ScrollRestoration.test.tsx`（红绿回归）
- `docs/constraints/C-036-navigation-scroll-restoration.md`（永久约束扩展）

## 变更摘要

1. **`ScrollRestoration.tsx`**
   - `scopeFor()`：删除 `if (pathname === "/files") return null;` —— 让 `/files` 与其他路由共享同一套 entry/URL 双键持久化。
   - `restore(y)`：`y > 0` 走帧驱动重试循环（≤60 帧、容差 ±2px），并监听用户输入事件以便随时让位；`y === 0` 保留旧双 RAF 快速路径。

2. **`ScrollRestoration.test.tsx`**
   - 新增 `restores scroll position on /files after browser refresh (same history key)`。
   - 新增 `restores scroll position on /files after browser refresh (history key changes)`。

3. **`C-036-navigation-scroll-restoration.md`**
   - 显式禁止 `/files` 之类的路径排除。
   - 强制非零目标的 RAF 重试 + 用户输入退出策略。

## TDD 步骤

1. 先写两条 `/files` 刷新测试（red）。
2. 删除 `/files` 排除 → 测试通过。
3. 扩展 `restore()` 应对异步列表（保护未来回归）。
4. 跑 `vitest run src/router/ScrollRestoration.test.tsx` → 6/6 green。
5. `tsc -b`、`eslint` → 通过。

## 验收

| 项 | 状态 |
|---|---|
| 单元测试 6/6 | ✅ |
| TypeScript typecheck | ✅ |
| ESLint（变更文件） | ✅ |
| 与 `/settings` 行为一致 | ✅ |
| 不影响 push 进入 `/files` 从顶部开始 | ✅（由 `navigationType !== "PUSH"` 守卫）|
| 用户手动滚动期间不抢控制权 | ✅（wheel/touchmove/keydown 退出）|

## 后续

- 若虚拟列表的「补页加载」恢复路径仍在 `useFileListScrollRestoration` 内，路由层重试与列表层补页**互不冲突**：路由层只负责 window scroll，列表层负责 query infinite page；两者均以达成目标位置为终止条件。
- 若未来引入更多懒加载主路由，统一沿用本次 RAF 重试策略，禁止在 `scopeFor()` 中再次写入路径白/黑名单。
