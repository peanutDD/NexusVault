# 2026-05-06: `/files` 虚拟列表刷新滚动位置问题

## 问题现象

进入文件夹时刷新页面，滚动位置没有停留在用户浏览位置，而是回到顶部。

## 根因分析

项目有**两层滚动恢复机制**：

### 1. 路由级：`ScrollRestoration.tsx`

```ts
function restore(y: number) {
  // y > 0: RAF 重试循环（≤60帧）
  // y === 0: 双 RAF 快速路径
}
```

### 2. 组件级：`useFileList.ts`

```ts
useEffect(() => {
  // 读取 sessionStorage: fileListScroll:{folderKey}:{sortBy}:{mime}:{search}
  const y = Number.parseInt(raw, 10);
  
  const documentHeight = Math.max(...scrollHeight);
  const reachableY = documentHeight - window.innerHeight;
  const needsMoreHeight = y > reachableY + 80; // SCROLL_RESTORE_HEIGHT_TOLERANCE
  
  if (needsMoreHeight && hasMore) {
    if (!loadingMore) void loadMore(); // ← 补页
    return; // 等待 loadMore + React 重新渲染
  }
  
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      window.scrollTo({ top: y, behavior: 'auto' });
    });
  });
}, [currentFolderId, files.length, folders.length, ...]);
```

### 冲突点

| 机制 | 触发时机 | 问题 |
|---|---|---|
| `ScrollRestoration` | 路由切换后立即执行 | `key` 变化后立即恢复 `window.scrollY` |
| `useFileList` | `files.length` 变化后执行 | 检查高度不足时补页，但虚拟列表 DOM 尚未更新 |

**问题链**：

1. 用户在 `/files?folder=xxx` 刷新
2. `ScrollRestoration` 先恢复 `window.scrollY` → **成功**（`sessionStorage` 有值）
3. React 渲染 `FileListVirtualScroller` → `VirtualizedMixedGrid` / `VirtualizedFileGrid` 挂载
4. 虚拟列表 `prefixSums` 计算行高 → **高度不足**（列表项尚未挂载）
5. `ScrollRestoration` 的 RAF 重试循环在 `~1s` 内完成 → **失败**（高度仍不足）
6. `useFileList` 的 `loadMore()` 补页 → **但此时 `ScrollRestoration` 已经放弃**

## 根本原因

**虚拟列表的 DOM 高度在 `loadMore()` 后才稳定**，但 `ScrollRestoration` 的帧预算（60帧 ≈ 1s）可能在虚拟列表完成挂载前就耗尽了。

## 解决方案

### 方案 A：延长 `ScrollRestoration` 的帧预算（推荐）

将 `RESTORE_MAX_ATTEMPTS` 从 60 增加到 120（约 2 秒），给虚拟列表足够的挂载时间：

```diff
-const RESTORE_MAX_ATTEMPTS = 60; // ~1s at 60fps — enough for async list mount
+const RESTORE_MAX_ATTEMPTS = 120; // ~2s at 60fps — enough for virtual list mount + loadMore
```

### 方案 B：监听虚拟列表高度变化再重试

在 `VirtualizedFileGrid` / `VirtualizedMixedGrid` 中添加 `onHeightStable` 回调，高度稳定后通知 `ScrollRestoration` 重试。

### 方案 C：合并两层恢复逻辑（复杂）

删除 `useFileList` 的滚动恢复，只保留 `ScrollRestoration`，但需要处理 `loadMore` 逻辑。

## 推荐方案：方案 A

**理由**：
1. 改动最小（仅修改常量）
2. 不影响现有架构
3. 2 秒预算足够虚拟列表挂载 + `loadMore` 补页
4. 用户手动滚动会立即退出（已有 `wheel/touchmove/keydown` 监听）

## 实施
