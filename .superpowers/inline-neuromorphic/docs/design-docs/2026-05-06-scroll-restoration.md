# ScrollRestoration 设计与实现（2026-05-06）

## 目标

浏览器刷新任意路由（包括 `/files`）后，页面自动恢复到用户上次的滚动位置，且不干扰用户手动滚动。

## 架构

```
ScrollRestoration (路由级)
├── scopeFor(key, pathname, search) → entryKey + urlKey
├── sessionStorage
│   ├── routeScroll:{entry} (history-entry scoped)
│   └── routeScrollUrl:{url} (URL scoped fallback)
├── restore(y)
│   ├── y === 0 → 双 RAF 快速路径
│   └── y > 0  → RAF 重试循环（≤60帧，容差±2px）
│       └── 监听 wheel/touchmove/keydown 退出
└── saveCurrent() → scroll 事件节流 + beforeunload/pagehide
```

## 核心规则

- **禁止路径白/黑名单**：`scopeFor()` 不允许 `if (pathname === "/files") return null`。所有路由统一持久化。
- **双键持久化**：
  - `routeScroll:{entry}`：history-entry 级，用于 Back/Forward 恢复。
  - `routeScrollUrl:{url}`：URL 级，用于刷新后 history key 丢失的兜底。
- **非 PUSH 读取 URL fallback**：新进入路由（`navigationType === "PUSH"`）只读 entry，从顶部开始；Back/Refresh 读 URL fallback。
- **非零目标重试**：`y > 0` 时 RAF 循环重试，直到高度够或帧预算耗尽。
- **用户输入即放弃**：监听 `wheel`/`touchmove`/`keydown`，一次触发即 cleanup 并停止。

## 实现细节

### scopeFor

```ts
function scopeFor(key: string, pathname: string, search: string) {
  const url = `${pathname}${search}`;
  return { entry: `${key}:${url}`, url };
}
```

- 生成 entry (`${history.key}:${url}`) 和 url (`${pathname}${search}`) 两组键。
- entry 用于区分不同 history 条目；url 用于刷新后 key 变化的兜底。
- **无路径排除**：所有路由都走同一逻辑。

### restore(y)

```ts
const RESTORE_MAX_ATTEMPTS = 60; // ~1s at 60fps
const RESTORE_TOLERANCE = 2;

function restore(y: number) {
  if (y <= 0) {
    // y === 0 快速路径
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      });
    });
    return;
  }

  let attempts = 0;
  let userInterrupted = false;

  const cleanup = () => {
    window.removeEventListener("wheel", onUserScroll);
    window.removeEventListener("touchmove", onUserScroll);
    window.removeEventListener("keydown", onUserScroll);
  };

  const onUserScroll = () => { userInterrupted = true; };

  // 监听用户输入（一次后自动 off）
  window.addEventListener("wheel", onUserScroll, { passive: true, once: true });
  window.addEventListener("touchmove", onUserScroll, { passive: true, once: true });
  window.addEventListener("keydown", onUserScroll, { once: true });

  const tick = () => {
    if (userInterrupted) { cleanup(); return; }

    window.scrollTo({ top: y, left: 0, behavior: "auto" });

    const reached = Math.abs((window.scrollY || 0) - y) <= RESTORE_TOLERANCE;
    attempts += 1;

    if (reached || attempts >= RESTORE_MAX_ATTEMPTS) {
      cleanup();
      return;
    }

    requestAnimationFrame(tick);
  };

  requestAnimationFrame(() => requestAnimationFrame(tick));
}
```

- **双 RAF**：`requestAnimationFrame(() => requestAnimationFrame(...))` 确保 DOM 布局稳定后再滚动。
- **容差 ±2px**：浏览器可能无法精确到像素，±2 视为达成。
- **帧预算 60**：约 1 秒，足够懒加载列表挂载。
- **用户输入退出**：一旦用户手动滚动，立即 cleanup 并停止重试，绝不抢夺控制权。

### saveCurrent

```ts
useEffect(() => {
  let frame: number | null = null;

  const saveNow = () => {
    if (frame !== null) { cancelAnimationFrame(frame); frame = null; }
    saveCurrent();
  };

  const scheduleSave = () => {
    if (frame !== null) return;
    frame = requestAnimationFrame(() => { frame = null; saveCurrent(); });
  };

  const saveWhenHidden = () => {
    if (document.visibilityState === "hidden") saveNow();
  };

  window.addEventListener("scroll", scheduleSave, { passive: true });
  window.addEventListener("beforeunload", saveNow);
  window.addEventListener("pagehide", saveNow);
  document.addEventListener("visibilitychange", saveWhenHidden);

  return () => {
    window.removeEventListener("scroll", scheduleSave);
    window.removeEventListener("beforeunload", saveNow);
    window.removeEventListener("pagehide", saveNow);
    document.removeEventListener("visibilitychange", saveWhenHidden);
    saveNow();
  };
}, [saveCurrent]);
```

- **节流保存**：scroll 事件节流（rAF），避免高频写 sessionStorage。
- **beforeunload/pagehide/hidden**：页面即将关闭时强制保存。
- **cleanup 时再 save**：防止 React unmount 前丢失最后一次位置。

## 与 useFileListScrollRestoration 的关系

- **职责分离**：
  - `ScrollRestoration`：负责 `window.scrollY` 的持久化与恢复（路由级）。
  - `useFileListScrollRestoration`：负责虚拟列表的 infinite query 补页（组件级）。
- **互不冲突**：
  - `ScrollRestoration` 先恢复 `window.scrollY`。
  - 若高度不足，`useFileListScrollRestoration` 拉新页，列表变长后再次尝试恢复。
  - 两者均以达成目标位置为终止条件，互不干扰。

## 测试策略

| 测试用例 | 验证点 |
|---|---|
| `starts a new route at the top` | PUSH 新路由无记录时从顶部开始 |
| `restores previous history entry scroll` | Back/Forward 恢复 entry 保存的位置 |
| `restores refreshed page (same key)` | 同 history key 刷新恢复 entry 键 |
| `restores refreshed page (key changed)` | key 变化刷新恢复 URL fallback 键 |
| `restores /files (same key)` | `/files` 同 key 刷新恢复 |
| `restores /files (key changed)` | `/files` key 变化刷新恢复 |

## 永久约束（C-036）

- **禁止路径白/黑名单**：`scopeFor()` 不能对 `/files` 等路径 `return null`。
- **非零目标必须重试**：`restore(y > 0)` 必须 RAF 循环直到达成或超时。
- **必须监听用户输入**：`wheel`/`touchmove`/`keydown` 一次触发即放弃恢复。

## 参考

- `frontend/src/router/ScrollRestoration.tsx`
- `frontend/src/router/ScrollRestoration.test.tsx`
- `docs/constraints/C-036-navigation-scroll-restoration.md`
- `docs/exec-plans/2026-05-06-files-route-refresh-scroll.md`
