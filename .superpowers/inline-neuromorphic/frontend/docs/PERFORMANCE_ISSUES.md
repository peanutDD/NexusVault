# 前端性能问题清单

> 本文档记录所有发现的性能问题，便于追踪和管理

## 问题状态说明

- [ ] 待修复
- [x] 已修复

---

## 高优先级 (P0) - 必须立即修复

### P001: Vite 构建配置缺失

- **文件**: `vite.config.ts`
- **问题**: 配置过于简单，缺少必要的生产优化
- **影响**: 初始包体积大，加载慢
- **修复内容**:
  - [x] 手动分块配置 (manualChunks) - vendor-react, vendor-form, vendor-state, vendor-utils
  - [x] 压缩插件 (vite-plugin-compression) - gzip + brotli 双压缩
  - [x] Terser 配置 (drop_console, drop_debugger)
  - [x] optimizeDeps 预构建配置
  - [x] Bundle 分析工具 (rollup-plugin-visualizer, `npm run build:analyze`)
- **状态**: [x] 已修复

---

### P006: useRequestDedup Map 内存泄漏

- **文件**: `src/hooks/useRequestDedup.ts`
- **行号**: Line 10
- **问题**: Map 永不清理，组件卸载时进行中的请求未处理
- **修复方案**:
  ```typescript
  const MAX_CACHE_SIZE = 100;
  
  useEffect(() => {
    return () => {
      inFlight.current.clear();
    };
  }, []);
  
  // 添加大小限制，防止 Map 无限增长
  if (inFlight.current.size > MAX_CACHE_SIZE) {
    const oldestKey = inFlight.current.keys().next().value;
    if (oldestKey) inFlight.current.delete(oldestKey);
  }
  ```
- **状态**: [x] 已修复

---

### P007: useClipboard 定时器泄漏

- **文件**: `src/hooks/useClipboard.ts`
- **问题**: 组件卸载后定时器可能仍然触发 setState
- **修复方案**:
  ```typescript
  useEffect(() => {
    return () => {
      if (timer.current) {
        clearTimeout(timer.current);
      }
    };
  }, []);
  ```
- **状态**: [x] 已修复

---

## 高优先级 (P1) - 显著影响性能

### P003: 重型对话框未懒加载

- **文件**: `src/pages/Files.tsx`, `src/components/files/FileList.tsx`
- **问题**: 以下组件在页面加载时就被打包
- **受影响组件**:
  - [x] `UploadDialog.tsx` (448 行) - 懒加载于 Files.tsx
  - [x] `FilePreview.tsx` (~330 行，已模块化) - 懒加载于 FileList.tsx
  - [x] `BatchShareDialog.tsx` - 懒加载于 FileList.tsx
  - [x] `BatchMoveDialog.tsx` - 懒加载于 FileList.tsx
  - [x] `CreateFolderDialog.tsx` - 懒加载于 FileList.tsx
  - [x] `RenameFolderDialog.tsx` - 懒加载于 FileList.tsx
  - [x] `ShareDialog.tsx` - 懒加载于 FileList.tsx
- **预期收益**: TTI 改善 15-25%
- **状态**: [x] 已修复

---

### P004: FileList 内联函数问题

- **文件**: `src/components/files/FileList.tsx`
- **问题**: 30+ 处内联函数导致子组件不必要重渲染
- **修复内容**:
  - [x] FileListFilters 的所有 onChange 回调 - 改为 useCallback
  - [x] 批量操作按钮的 onClick - 提取为 FileListBatchActions 组件
  - [x] 分页按钮的 onClick - 提取为 FileListPagination 组件
  - [x] onShareCreated, onMoved 等回调 - 使用 useCallback
  - [x] toggleSelectFile, toggleSelectFolder, toggleSelectAll - 使用 useCallback
- **状态**: [x] 已修复

---

### P009: useKeyboardShortcuts 事件监听器重复注册

- **文件**: `src/hooks/useKeyboardShortcuts.ts`
- **行号**: Lines 125-151
- **问题**: shortcuts 变化导致事件监听器频繁重新注册
- **修复方案**: 使用 ref 存储 shortcuts
  ```typescript
  const shortcutsRef = useRef(shortcuts);
  useEffect(() => { shortcutsRef.current = shortcuts; }, [shortcuts]);
  const handleKeyDown = useCallback((e) => {
    shortcutsRef.current.find(...);
  }, []); // 空依赖数组，不再重新注册
  ```
- **状态**: [x] 已修复

---

## 中优先级 (P2) - 建议修复

### P002: 未使用的依赖

- **文件**: `package.json`
- **依赖**: `@tanstack/react-virtual`
- **大小**: ~50KB
- **验证**: `grep -r "react-virtual" src/` 无结果
- **状态**: [x] 已移除

---

### P005: Settings 页面缺少 memoization

- **文件**: `src/pages/Settings.tsx`
- **行数**: 263 行 (拆分后)
- **修复内容**: 
  - [x] 表单处理函数使用 useCallback
  - [x] 组件拆分为独立子组件 (自带 React.memo)
  - [x] 减少不必要的状态变化触发重渲染
- **状态**: [x] 已修复

---

### P008: downloadBlob URL 未正确释放

- **文件**: `src/utils/downloadBlob.ts`
- **问题**: 异常时 URL.revokeObjectURL 不会执行
- **修复方案**: 使用 try-finally
  ```typescript
  const url = URL.createObjectURL(blob);
  try {
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
  } finally {
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
  ```
- **状态**: [x] 已修复

---

### P010: useOptimisticUpdate 闭包陈旧状态

- **文件**: `src/hooks/useOptimisticUpdate.ts`
- **问题**: 快速连续更新时可能回滚到错误状态
- **修复方案**: 使用 ref 存储 updateFn，使用函数式更新
  ```typescript
  const updateFnRef = useRef(updateFn);
  useEffect(() => { updateFnRef.current = updateFn; }, [updateFn]);
  
  setState((currentState) => {
    prev = currentState; // 捕获当前状态用于回滚
    return updateFnRef.current(currentState, optimistic);
  });
  ```
- **状态**: [x] 已修复

---

### P011: useCategories 依赖数组多余

- **文件**: `src/hooks/useCategories.ts`
- **行号**: Lines 12-26
- **问题**: refresh 在 useEffect 依赖数组中导致可能的循环调用
- **修复方案**: 使用 ref 控制初始化
  ```typescript
  const initializedRef = useRef(false);
  useEffect(() => {
    if (!initializedRef.current) {
      initializedRef.current = true;
      refresh();
    }
  }, []);
  ```
- **状态**: [x] 已修复

---

## 低优先级 (P3) - 改善代码质量

### P012: 未使用的 CSS 文件

- **文件**: `src/App.css`
- **行数**: 43 行
- **问题**: 文件未被导入，包含默认 React 模板样式
- **操作**: 删除文件
- **状态**: [x] 已删除

---

### P013: Auth 组件 className 过长

- **文件**: 
  - `src/components/auth/Login.tsx`
  - `src/components/auth/Register.tsx`
- **问题**: className 字符串超过 400 字符
- **修复方案**: 提取为 `src/components/auth/styles.ts` 共享常量
  - AUTH_INPUT_CLASSES
  - AUTH_LABEL_CLASSES
  - AUTH_ERROR_CLASSES
  - AUTH_ERROR_BOX_CLASSES
  - AUTH_BUTTON_CLASSES
  - AUTH_PAGE_CLASSES
  - AUTH_CARD_CLASSES
  - AUTH_TITLE_CLASSES
  - AUTH_SUBTITLE_CLASSES
- **状态**: [x] 已修复

---

### P014: FileList 模板字符串

- **文件**: `src/components/files/FileList.tsx`
- **问题**: 使用模板字符串而非 cn() 工具
- **修复方案**: 改用 cn() 函数
- **状态**: [x] 已修复

---

### P015: Settings.tsx 组件过大

- **文件**: `src/pages/Settings.tsx`
- **原行数**: 510 行
- **现行数**: 263 行
- **拆分组件**:
  - [x] `components/settings/UserInfoSection.tsx`
  - [x] `components/settings/StorageUsageSection.tsx`
  - [x] `components/settings/PasswordChangeSection.tsx`
  - [x] `components/settings/ApiTokenSection.tsx`
  - [x] `components/settings/index.ts` (统一导出)
- **状态**: [x] 已拆分

---

### P016: FileList.tsx 组件过大

- **文件**: `src/components/files/FileList.tsx`
- **原行数**: 750 行
- **现行数**: 666 行
- **拆分组件**:
  - [x] `FileListPagination.tsx` - 分页控件
  - [x] `FileListBatchActions.tsx` - 批量操作栏
- **状态**: [x] 已拆分

---

## 额外优化

### P017: Share.tsx 内联函数优化

- **文件**: `src/pages/Share.tsx`
- **问题**: 内联函数导致不必要重渲染
- **修复内容**:
  - [x] handlePasswordChange - useCallback
  - [x] handleCloseError - useCallback
  - [x] handleNavigateToLogin - useCallback
- **状态**: [x] 已修复

---

### P018: 请求预取优化

- **文件**: `src/components/files/FileList.tsx`
- **功能**: 自动预取下一页数据
- **实现**:
  ```typescript
  useEffect(() => {
    const computedTotalPages = Math.ceil(total / limit);
    if (page >= computedTotalPages || loading || total === 0) return;
    
    const prefetchTimeout = setTimeout(() => {
      // 预取下一页数据并缓存
    }, 500);
    
    return () => clearTimeout(prefetchTimeout);
  }, [page, total, ...]);
  ```
- **状态**: [x] 已实现

---

## 统计摘要

| 优先级 | 数量 | 已完成 |
|--------|------|--------|
| P0 高 | 3 | 3 |
| P1 高 | 3 | 3 |
| P2 中 | 5 | 5 |
| P3 低 | 5 | 5 |
| 额外 | 2 | 2 |
| **总计** | **18** | **18** |

---

## 修复日志

| 日期 | 问题编号 | 描述 | 提交 |
|------|----------|------|------|
| 2026-01-27 | P001 | Vite 构建配置优化 (manualChunks, compression, terser) | - |
| 2026-01-27 | P002 | 移除未使用依赖 @tanstack/react-virtual | - |
| 2026-01-27 | P003 | 对话框组件懒加载 | - |
| 2026-01-27 | P004 | FileList 内联函数改为 useCallback | - |
| 2026-01-27 | P005 | Settings 页面 useCallback 优化 | - |
| 2026-01-27 | P006 | useRequestDedup Map 内存泄漏修复 | - |
| 2026-01-27 | P007 | useClipboard 定时器泄漏修复 | - |
| 2026-01-27 | P008 | downloadBlob URL 释放修复 | - |
| 2026-01-27 | P009 | useKeyboardShortcuts 事件监听器优化 | - |
| 2026-01-27 | P010 | useOptimisticUpdate 闭包陈旧状态修复 | - |
| 2026-01-27 | P011 | useCategories 依赖数组修复 | - |
| 2026-01-27 | P012 | 删除未使用的 App.css | - |
| 2026-01-27 | P013 | Auth 组件 className 提取为 styles.ts | - |
| 2026-01-27 | P014 | FileList 模板字符串改用 cn() | - |
| 2026-01-27 | P015 | Settings.tsx 拆分为 4 个子组件 | - |
| 2026-01-27 | P016 | FileList.tsx 拆分 (Pagination, BatchActions) | - |
| 2026-01-27 | P017 | Share.tsx 内联函数优化 | - |
| 2026-01-27 | P018 | 请求预取优化 (下一页自动预取) | - |

---

## 构建产物优化效果

### 代码分割
- `vendor-react`: React 核心库
- `vendor-form`: react-hook-form + zod
- `vendor-state`: zustand
- `vendor-utils`: axios + clsx + tailwind-merge

### 压缩效果
- Gzip 压缩: 主包约 58KB
- Brotli 压缩: 主包约 50KB

### 懒加载组件
所有对话框组件独立打包，按需加载

---

*文档版本: 2.0*  
*创建日期: 2026-01-24*  
*更新日期: 2026-01-27*  
*状态: 全部优化完成*
