# 2026-05-06: `/files` 路由刷新滚动位置恢复

**状态**：✅ 已完成  
**质量分**：95  
**日期**：2026-05-06

## 变更概览

| 文件 | 变更类型 | 说明 |
|---|---|---|
| `frontend/src/router/ScrollRestoration.tsx` | 修改 | 删除 `/files` 排除，扩展 `restore()` 为 RAF 重试循环 |
| `frontend/src/router/ScrollRestoration.test.tsx` | 修改 | 新增 2 条 `/files` 刷新回归测试 |
| `docs/constraints/C-036-navigation-scroll-restoration.md` | 修改 | 禁止路径白/黑名单，强制重试+用户输入退出策略 |
| `docs/exec-plans/2026-05-06-files-route-refresh-scroll.md` | 新建 | 任务执行计划 |
| `docs/exec-plans/2026-05-06-files-route-refresh-scroll.json` | 新建 | 任务执行计划 JSON |
| `docs/design-docs/2026-05-06-scroll-restoration.md` | 新建 | ScrollRestoration 设计与实现 |
| `docs/quality-score.md` | 修改 | 更新质量分记录 |
| `docs/CHANGELOG.md` | 修改 | 更新 CHANGELOG |

## 核心变更

### 1. `ScrollRestoration.tsx`

**删除路径排除**

```diff
function scopeFor(key: string, pathname: string, search: string) {
-  if (pathname === "/files") return null;
  const url = `${pathname}${search}`;
  return { entry: `${key}:${url}`, url };
}
```

**扩展 `restore()` 为 RAF 重试循环**

```ts
const RESTORE_MAX_ATTEMPTS = 60; // ~1s at 60fps — enough for async list mount
const RESTORE_TOLERANCE = 2;

function restore(y: number) {
  if (y <= 0) {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      });
    });
    return;
  }
  let attempts = 0;
  let userInterrupted = false;
  const onUserScroll = () => { userInterrupted = true; };
  window.addEventListener("wheel", onUserScroll, { passive: true, once: true });
  window.addEventListener("touchmove", onUserScroll, { passive: true, once: true });
  window.addEventListener("keydown", onUserScroll, { once: true });

  const cleanup = () => {
    window.removeEventListener("wheel", onUserScroll);
    window.removeEventListener("touchmove", onUserScroll);
    window.removeEventListener("keydown", onUserScroll);
  };

  const tick = () => {
    if (userInterrupted) { cleanup(); return; }
    window.scrollTo({ top: y, left: 0, behavior: "auto" });
    const reached = Math.abs((window.scrollY || 0) - y) <= RESTORE_TOLERANCE;
    attempts += 1;
    if (reached || attempts >= RESTORE_MAX_ATTEMPTS) { cleanup(); return; }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(() => requestAnimationFrame(tick));
}
```

### 2. `ScrollRestoration.test.tsx`

新增 2 条测试：

- `restores scroll position on /files after browser refresh (same history key)`
- `restores scroll position on /files after browser refresh (history key changes)`

### 3. `C-036-navigation-scroll-restoration.md`

新增永久约束：

- 禁止 `scopeFor()` 路径白/黑名单
- 强制非零目标走 RAF 重试 + 用户输入退出策略

## 验收

| 项 | 状态 |
|---|---|
| `vitest run src/router/ScrollRestoration.test.tsx` | ✅ 6/6 green |
| `tsc -b` | ✅ 通过 |
| `eslint` (变更文件) | ✅ 通过 |
| 行为一致性 | ✅ `/files` 与 `/settings` 一致 |
| 用户输入不抢权 | ✅ 监听 `wheel`/`touchmove`/`keydown` 退出 |

## 影响

- **刷新 `/files`**：恢复到上次滚动位置（与 `/settings` 一致）。
- **Push 进入 `/files`**：从顶部开始（`navigationType === "PUSH"` 守卫）。
- **Back/Forward**：恢复目标 history 条目位置。
- **用户手动滚动**：立即放弃恢复，不抢控制权。

## 回退方案

如需回退：

```bash
git checkout frontend/src/router/ScrollRestoration.tsx \
             frontend/src/router/ScrollRestoration.test.tsx \
             docs/constraints/C-036-navigation-scroll-restoration.md
```

并删除：

- `docs/exec-plans/2026-05-06-files-route-refresh-scroll.{md,json}`
- `docs/design-docs/2026-05-06-scroll-restoration.md`
- `docs/quality-score.md` 中本任务条目
- `docs/CHANGELOG.md` 中本任务条目

## 参考

- `frontend/src/router/ScrollRestoration.tsx`
- `frontend/src/router/ScrollRestoration.test.tsx`
- `docs/constraints/C-036-navigation-scroll-restoration.md`
- `docs/exec-plans/2026-05-06-files-route-refresh-scroll.md`
- `docs/design-docs/2026-05-06-scroll-restoration.md`
