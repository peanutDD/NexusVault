# 前端性能优化文档

> 基于十年前端开发经验，对本项目进行全面的性能审计与优化方案

## 近期变更（2026-02-07）

- **列表缩略图**：列表卡片图片改为请求后端 `GET /api/files/:id/thumbnail`（压缩后 JPEG），不再用预览原图接口，减轻加载与带宽；`fileService.fetchThumbnailBlob` 在 404/415 时返回 `null`，前端显示占位图标。详见后端 `ENGINEERING_PLAYBOOK.md` 第 17 节。
- **视频预览与播放**：预览页视频使用直连 `GET /api/files/:id/preview?token=...`，不拉整文件到内存；后端支持 HTTP Range，浏览器可流式播放与拖拽进度。前端对 `<video>` 使用 `preload="metadata"` 减少首包，并增加 `onError` 提示。

---

## 目录

- [一、问题总览](#一问题总览)
- [二、构建优化](#二构建优化)
- [三、代码分割优化](#三代码分割优化)
- [四、渲染性能优化](#四渲染性能优化)
- [五、内存泄漏修复](#五内存泄漏修复)
- [六、Hook 优化](#六hook-优化)
- [七、CSS/样式优化](#七css样式优化)
- [八、网络请求优化](#八网络请求优化)
- [九、大组件拆分](#九大组件拆分)
- [十、优化优先级与预期收益](#十优化优先级与预期收益)

---

## 一、问题总览

### 发现的问题清单

| 编号 | 类别 | 问题描述 | 严重程度 | 文件位置 |
|------|------|----------|----------|----------|
| P001 | 构建 | Vite 配置缺少手动分块、压缩、tree-shaking 优化 | 高 | `vite.config.ts` |
| P002 | 依赖 | 未使用的依赖 `@tanstack/react-virtual` 增加包体积 | 中 | `package.json` |
| P003 | 代码分割 | 重型对话框组件未懒加载 | 高 | `pages/Files.tsx` |
| P004 | 渲染 | 30+ 处内联函数导致不必要的重渲染 | 高 | `FileList.tsx` |
| P005 | 渲染 | Settings 页面无 memoization，状态变化全组件重渲染 | 中 | `Settings.tsx` |
| P006 | 内存 | `useRequestDedup` Map 无限增长导致内存泄漏 | 高 | `useRequestDedup.ts` |
| P007 | 内存 | `useClipboard` 定时器未清理导致泄漏 | 中 | `useClipboard.ts` |
| P008 | 内存 | `downloadBlob` URL 对象未正确释放 | 中 | `downloadBlob.ts` |
| P009 | Hook | `useKeyboardShortcuts` 事件监听器重复注册 | 中 | `useKeyboardShortcuts.ts` |
| P010 | Hook | `useOptimisticUpdate` 闭包捕获陈旧状态 | 中 | `useOptimisticUpdate.ts` |
| P011 | Hook | `useCategories` 依赖数组问题导致无限循环 | 中 | `useCategories.ts` |
| P012 | CSS | 未使用的 `App.css` 文件 | 低 | `App.css` |
| P013 | CSS | Auth 组件 className 字符串过长（400+ 字符） | 低 | `Login.tsx`, `Register.tsx` |
| P014 | CSS | FileList 使用模板字符串而非 cn() 工具 | 低 | `FileList.tsx:559` |
| P015 | 组件 | Settings.tsx 510 行过大，应拆分 | 中 | `Settings.tsx` |
| P016 | 组件 | FileList.tsx 686 行过大，应拆分 | 中 | `FileList.tsx` |

---

## 二、构建优化

### 问题 P001: Vite 配置缺少优化

**当前代码** (`vite.config.ts`):

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
})
```

**问题分析**:
- 未配置手动分块（manualChunks），导致所有 vendor 代码打包在一起
- 未启用压缩插件，生产环境文件体积大
- 未配置 terser 移除 console.log
- 未配置 optimizeDeps 预构建

**优化后代码**:

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import compression from 'vite-plugin-compression'
import { visualizer } from 'rollup-plugin-visualizer'

export default defineConfig({
  plugins: [
    react(),
    // Gzip 压缩
    compression({
      algorithm: 'gzip',
      ext: '.gz',
      threshold: 10240, // 大于 10KB 才压缩
    }),
    // Brotli 压缩（更高压缩率）
    compression({
      algorithm: 'brotliCompress',
      ext: '.br',
      threshold: 10240,
    }),
    // Bundle 分析（仅在 analyze 模式启用）
    process.env.ANALYZE && visualizer({
      open: true,
      gzipSize: true,
      brotliSize: true,
    }),
  ].filter(Boolean),

  build: {
    rollupOptions: {
      output: {
        // 手动分块策略
        manualChunks: {
          // React 核心库
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          // 表单相关库
          'vendor-form': ['react-hook-form', '@hookform/resolvers', 'zod'],
          // 状态管理
          'vendor-state': ['zustand'],
          // 工具库
          'vendor-utils': ['axios', 'clsx', 'tailwind-merge'],
        },
      },
    },
    // 块大小警告阈值
    chunkSizeWarningLimit: 500,
    // CSS 代码分割
    cssCodeSplit: true,
    // 生产环境不生成 sourcemap
    sourcemap: false,
    // 使用 terser 压缩
    minify: 'terser',
    terserOptions: {
      compress: {
        // 移除 console.log
        drop_console: true,
        // 移除 debugger
        drop_debugger: true,
      },
    },
  },

  // 依赖预构建优化
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      'zustand',
      'axios',
      'clsx',
      'tailwind-merge',
    ],
  },
})
```

**需要安装的依赖**:

```bash
npm install -D vite-plugin-compression rollup-plugin-visualizer
```

**添加 package.json scripts**:

```json
{
  "scripts": {
    "build": "tsc -b && vite build",
    "build:analyze": "ANALYZE=true npm run build"
  }
}
```

**预期收益**:
- 初始包体积减少 20-30%
- 缓存命中率提升（vendor 分离后变化少）
- 生产环境无 console.log 输出

---

### 问题 P002: 未使用的依赖

**当前状态**:

`@tanstack/react-virtual` 在 `package.json` 中声明但代码库中未使用。

**验证方法**:

```bash
grep -r "react-virtual" src/
# 无结果
```

**解决方案**:

```bash
npm uninstall @tanstack/react-virtual
```

**预期收益**: 减少约 50KB 的包体积

---

## 三、代码分割优化

### 问题 P003: 重型对话框组件未懒加载

**当前代码** (`pages/Files.tsx`):

```typescript
import UploadDialog from '../components/files/UploadDialog';
import FilePreview from '../components/files/FilePreview';
import BatchShareDialog from '../components/files/BatchShareDialog';
import BatchMoveDialog from '../components/files/BatchMoveDialog';
import CreateFolderDialog from '../components/files/CreateFolderDialog';
```

**问题分析**:
- 这些对话框组件仅在用户交互时显示
- 但它们在页面加载时就被包含在主 bundle 中
- `FilePreview.tsx` ~330 行（已模块化拆分为 hooks + 子组件），`UploadDialog.tsx` 448 行

**优化后代码**:

```typescript
import { lazy, Suspense } from 'react';
import Spinner from '../components/common/Spinner';

// 懒加载对话框组件
const UploadDialog = lazy(() => import('../components/files/UploadDialog'));
const FilePreview = lazy(() => import('../components/files/preview/FilePreview'));
const BatchShareDialog = lazy(() => import('../components/files/BatchShareDialog'));
const BatchMoveDialog = lazy(() => import('../components/files/BatchMoveDialog'));
const CreateFolderDialog = lazy(() => import('../components/files/CreateFolderDialog'));
const RenameFolderDialog = lazy(() => import('../components/files/RenameFolderDialog'));
const ShareDialog = lazy(() => import('../components/files/ShareDialog'));

// 创建对话框包装组件
function DialogFallback() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <Spinner size="lg" />
    </div>
  );
}

// 在 JSX 中使用
{uploadDialogOpen && (
  <Suspense fallback={<DialogFallback />}>
    <UploadDialog
      open={uploadDialogOpen}
      onClose={() => setUploadDialogOpen(false)}
      onUploadComplete={handleUploadComplete}
    />
  </Suspense>
)}
```

**预期收益**:
- 首次加载 Time to Interactive (TTI) 改善 15-25%
- 主 bundle 体积减少约 100KB
- 对话框按需加载，仅在用户需要时下载

---

## 四、渲染性能优化

### 问题 P004: 内联函数导致不必要的重渲染

**当前代码** (`FileList.tsx` lines 401-428):

```typescript
<FileListFilters
  search={search}
  onSearchChange={(v) => { setSearch(v); setPage(1); }}  // 每次渲染创建新函数
  mimeType={mimeType}
  onMimeTypeChange={(v) => { setMimeType(v); setPage(1); }}  // 每次渲染创建新函数
  category={category}
  onCategoryChange={(v) => { setCategory(v); setPage(1); }}
  dateFrom={dateFrom}
  onDateFromChange={(v) => { setDateFrom(v); setPage(1); }}
  dateTo={dateTo}
  onDateToChange={(v) => { setDateTo(v); setPage(1); }}
  sizeMin={sizeMin}
  onSizeMinChange={(v) => { setSizeMin(v); setPage(1); }}
  sizeMax={sizeMax}
  onSizeMaxChange={(v) => { setSizeMax(v); setPage(1); }}
  categories={categories}
  loadingCategories={loadingCategories}
  onClearFilters={handleClearFilters}
/>
```

**问题分析**:
- 每次 `FileList` 重渲染，所有 `onChange` 回调都会创建新的函数引用
- 导致 `FileListFilters` 组件即使 props 值未变也会重渲染
- 类似问题在文件中出现 30+ 次

**优化后代码**:

```typescript
// 创建稳定的回调函数
const handleSearchChange = useCallback((v: string) => {
  setSearch(v);
  setPage(1);
}, []);

const handleMimeTypeChange = useCallback((v: string) => {
  setMimeType(v);
  setPage(1);
}, []);

const handleCategoryChange = useCallback((v: string) => {
  setCategory(v);
  setPage(1);
}, []);

const handleDateFromChange = useCallback((v: string) => {
  setDateFrom(v);
  setPage(1);
}, []);

const handleDateToChange = useCallback((v: string) => {
  setDateTo(v);
  setPage(1);
}, []);

const handleSizeMinChange = useCallback((v: string) => {
  setSizeMin(v);
  setPage(1);
}, []);

const handleSizeMaxChange = useCallback((v: string) => {
  setSizeMax(v);
  setPage(1);
}, []);

// 使用稳定的回调
<FileListFilters
  search={search}
  onSearchChange={handleSearchChange}
  mimeType={mimeType}
  onMimeTypeChange={handleMimeTypeChange}
  category={category}
  onCategoryChange={handleCategoryChange}
  dateFrom={dateFrom}
  onDateFromChange={handleDateFromChange}
  dateTo={dateTo}
  onDateToChange={handleDateToChange}
  sizeMin={sizeMin}
  onSizeMinChange={handleSizeMinChange}
  sizeMax={sizeMax}
  onSizeMaxChange={handleSizeMaxChange}
  categories={categories}
  loadingCategories={loadingCategories}
  onClearFilters={handleClearFilters}
/>
```

**或者使用工厂函数模式**:

```typescript
// 更简洁的工厂函数模式
const createFilterHandler = useCallback(
  <T extends string>(setter: React.Dispatch<React.SetStateAction<T>>) =>
    (value: T) => {
      setter(value);
      setPage(1);
    },
  []
);

// 使用
const handleSearchChange = useMemo(() => createFilterHandler(setSearch), [createFilterHandler]);
const handleMimeTypeChange = useMemo(() => createFilterHandler(setMimeType), [createFilterHandler]);
// ... 其他 handlers
```

---

### 问题 P005: Settings 页面无 memoization

**当前代码** (`Settings.tsx`):

```typescript
// 510 行代码，任何状态变化都会导致整个组件重渲染
export default function Settings() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [storageUsage, setStorageUsage] = useState<...>(null);
  const [passwordForm, setPasswordForm] = useState({ ... });
  const [apiTokens, setApiTokens] = useState<ApiToken[]>([]);
  const [tokenForm, setTokenForm] = useState({ ... });

  // 表单处理函数未 memoize
  const handlePasswordChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setPasswordForm({ ...passwordForm, [field]: e.target.value });
  };

  return (
    // 整个 510 行的 JSX
  );
}
```

**优化方案**:

1. **将表单处理函数 memoize**:

```typescript
const handlePasswordFieldChange = useCallback(
  (field: keyof typeof passwordForm) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setPasswordForm((prev) => ({ ...prev, [field]: e.target.value }));
    },
  []
);

const handleTokenFieldChange = useCallback(
  (field: keyof typeof tokenForm) =>
    (value: string | number | '') => {
      setTokenForm((prev) => ({ ...prev, [field]: value }));
    },
  []
);
```

2. **拆分为子组件**（见第九节）

---

## 五、内存泄漏修复

### 问题 P006: useRequestDedup Map 无限增长

**当前代码** (`hooks/useRequestDedup.ts`):

```typescript
export function useRequestDedup<P extends unknown[], R>(
  fn: (...args: P) => Promise<R>
) {
  const inFlight = useRef(new Map<string, Promise<R>>());  // 永不清理

  const dedupedFn = useCallback(
    async (...args: P) => {
      const key = JSON.stringify(args);
      const existing = inFlight.current.get(key);
      if (existing) return existing;

      const promise = fn(...args).finally(() => {
        inFlight.current.delete(key);
      });
      inFlight.current.set(key, promise);
      return promise;
    },
    [fn]
  );

  return dedupedFn;
}
```

**问题分析**:
- 虽然 `finally` 中删除了完成的请求，但如果组件卸载时有进行中的请求，Map 不会被清理
- 长时间运行的应用可能积累大量未清理的 Promise 引用

**优化后代码**:

```typescript
export function useRequestDedup<P extends unknown[], R>(
  fn: (...args: P) => Promise<R>
) {
  const inFlight = useRef(new Map<string, Promise<R>>());

  // 组件卸载时清理 Map
  useEffect(() => {
    return () => {
      inFlight.current.clear();
    };
  }, []);

  const dedupedFn = useCallback(
    async (...args: P) => {
      const key = JSON.stringify(args);
      const existing = inFlight.current.get(key);
      if (existing) return existing;

      const promise = fn(...args).finally(() => {
        inFlight.current.delete(key);
      });
      inFlight.current.set(key, promise);
      return promise;
    },
    [fn]
  );

  return dedupedFn;
}
```

---

### 问题 P007: useClipboard 定时器未清理

**当前代码** (`hooks/useClipboard.ts`):

```typescript
export function useClipboard(timeout = 2000) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const copy = useCallback(
    async (text: string) => {
      try {
        await navigator.clipboard.writeText(text);
        setCopied(true);

        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => {
          setCopied(false);
        }, timeout);
      } catch {
        setCopied(false);
      }
    },
    [timeout]
  );

  return { copied, copy };
}
```

**问题分析**:
- 组件卸载后，定时器可能仍然触发 `setCopied(false)`
- 这会导致 "Can't perform a React state update on an unmounted component" 警告

**优化后代码**:

```typescript
export function useClipboard(timeout = 2000) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 清理定时器
  useEffect(() => {
    return () => {
      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
      }
    };
  }, []);

  const copy = useCallback(
    async (text: string) => {
      try {
        await navigator.clipboard.writeText(text);
        setCopied(true);

        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => {
          setCopied(false);
        }, timeout);
      } catch {
        setCopied(false);
      }
    },
    [timeout]
  );

  return { copied, copy };
}
```

---

### 问题 P008: downloadBlob URL 未正确释放

**当前代码** (`utils/downloadBlob.ts`):

```typescript
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
```

**问题分析**:
- 如果 `link.click()` 或 `link.remove()` 抛出异常，`URL.revokeObjectURL` 不会执行
- 未释放的 Object URL 会持续占用内存

**优化后代码**:

```typescript
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  try {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
  } finally {
    // 确保 URL 总是被释放
    URL.revokeObjectURL(url);
  }
}
```

---

### 缩略图 Blob URL 累积导致内存偏高（已修复）

**原因简述**：文件列表未做虚拟滚动，一页最多渲染约 100 个卡片。每个图片类文件会通过 `LazyThumbnail` 请求预览 blob 并 `URL.createObjectURL`。进入视口时加载、离开视口后组件仍挂载，**blob URL 一直不释放**，滚动整页后会同时存在几十个 blob，内存持续升高。

**已做修复**（`components/files/LazyThumbnail.tsx`）：

1. **离开视口即释放**：用 `IntersectionObserver` 监听缩略图容器，当 `isIntersecting === false`（离开视口约 50px）时 `setBlobUrl(null)` 并 `URL.revokeObjectURL`，只保留当前视口附近缩略图的 blob。
2. **再次进入视口可重新加载**：`blobUrl` 被清空后，依赖 `[mimeType, blobUrl]` 的“进入视口”观察会重新注册，滚回时再次请求并显示缩略图。

**其他可能占内存的点**：预览/下载用的 blob 与 `downloadBlob` 的 URL 释放逻辑已按上文处理；`backdrop-blur` 会多占 GPU/合成层，列表区已对卡片关闭 blur，仅顶部栏/预览等保留。

---

## 六、Hook 优化

### 问题 P009: useKeyboardShortcuts 事件监听器重复注册

**当前代码** (`hooks/useKeyboardShortcuts.ts`):

```typescript
export function useKeyboardShortcuts(shortcuts: KeyboardShortcut[]) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const matched = shortcuts.find((shortcut) => {
        if (shortcut.preventInInput !== false && isInputElement(e.target)) {
          return false;
        }
        return matchesShortcut(e, parseShortcut(shortcut.key));
      });

      if (matched) {
        e.preventDefault();
        matched.handler(e);
      }
    },
    [shortcuts]  // shortcuts 变化导致 handleKeyDown 重新创建
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);  // handleKeyDown 变化导致重新注册监听器
}
```

**问题分析**:
- `shortcuts` 数组每次渲染都可能是新引用（即使内容相同）
- 导致 `handleKeyDown` 重新创建
- 导致 `useEffect` 重新执行，移除并重新添加事件监听器

**优化后代码**:

```typescript
export function useKeyboardShortcuts(shortcuts: KeyboardShortcut[]) {
  // 使用 ref 存储最新的 shortcuts，避免重新注册监听器
  const shortcutsRef = useRef(shortcuts);

  // 保持 shortcutsRef 与 props 同步
  useEffect(() => {
    shortcutsRef.current = shortcuts;
  }, [shortcuts]);

  // handleKeyDown 不依赖 shortcuts，不会重新创建
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const matched = shortcutsRef.current.find((shortcut) => {
      if (shortcut.preventInInput !== false && isInputElement(e.target)) {
        return false;
      }
      return matchesShortcut(e, parseShortcut(shortcut.key));
    });

    if (matched) {
      e.preventDefault();
      matched.handler(e);
    }
  }, []);

  // 只在组件挂载/卸载时注册/移除监听器
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);
}
```

---

### 问题 P010: useOptimisticUpdate 闭包捕获陈旧状态

**当前代码** (`hooks/useOptimisticUpdate.ts`):

```typescript
export function useOptimisticUpdate<T>(
  initialState: T,
  updateFn: (current: T, optimistic: T) => T
) {
  const [state, setState] = useState(initialState);

  const update = useCallback(
    async (optimistic: T, actual: Promise<T>) => {
      const previous = state;  // 闭包捕获当前 state
      setState(updateFn(state, optimistic));

      try {
        const result = await actual;
        setState(result);
      } catch {
        setState(previous);  // 如果 state 已变化，这里会回滚到错误的状态
      }
    },
    [state, updateFn]  // state 在依赖中，但闭包问题仍存在
  );

  return { state, update };
}
```

**问题分析**:
- 当多个 `update` 调用快速连续发生时，`previous` 可能不是正确的"前一个"状态
- 回滚可能导致数据不一致

**优化后代码**:

```typescript
export function useOptimisticUpdate<T>(
  initialState: T,
  updateFn: (current: T, optimistic: T) => T
) {
  const [state, setState] = useState(initialState);
  // 使用 ref 存储真正的"服务器状态"
  const serverState = useRef(initialState);

  const update = useCallback(
    async (optimistic: T, actual: Promise<T>) => {
      // 乐观更新 UI
      setState((current) => updateFn(current, optimistic));

      try {
        const result = await actual;
        // 更新服务器状态和 UI 状态
        serverState.current = result;
        setState(result);
      } catch {
        // 回滚到服务器状态，而不是"前一个"状态
        setState(serverState.current);
      }
    },
    [updateFn]
  );

  // 同步 serverState 当 state 从外部更新时
  const setServerState = useCallback((newState: T) => {
    serverState.current = newState;
    setState(newState);
  }, []);

  return { state, update, setServerState };
}
```

---

### 问题 P011: useCategories 依赖数组问题

**当前代码** (`hooks/useCategories.ts`):

```typescript
export function useCategories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fileService.getCategories();
      setCategories(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);  // refresh 在依赖中，但它永远不会变化

  return { categories, loading, refresh };
}
```

**问题分析**:
- 虽然这个代码不会导致无限循环（因为 `refresh` 被 `useCallback` 包裹且无依赖）
- 但 `refresh` 在 `useEffect` 依赖数组中是多余的，可能导致误解

**优化后代码**:

```typescript
export function useCategories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fileService.getCategories();
      setCategories(data);
    } finally {
      setLoading(false);
    }
  }, []);

  // 明确只在挂载时执行
  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);  // 空依赖数组，只在挂载时执行

  return { categories, loading, refresh };
}
```

---

## 七、CSS/样式优化

### 问题 P012: 未使用的 App.css 文件

**当前状态**:

`src/App.css` 文件包含 43 行未使用的样式（默认 React 模板遗留）：
- `.logo` 类
- `.card` 类
- `.read-the-docs` 类
- `@keyframes logo-spin` 动画

**验证方法**:

```bash
grep -r "App.css" src/
# 无结果 - 文件未被导入
```

**解决方案**: 删除 `src/App.css` 文件

---

### 问题 P013: Auth 组件 className 字符串过长

**当前代码** (`Login.tsx` line 117):

```typescript
<input
  className="w-full px-4 py-3 bg-white/10 dark:bg-gray-800/50 border border-white/20 dark:border-gray-600 rounded-lg text-white dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 dark:focus:ring-purple-400 focus:border-transparent transition-all duration-200"
  // ... 400+ 字符的 className
/>
```

**问题分析**:
- 难以阅读和维护
- 类似的长字符串在多处重复
- 无法复用

**优化后代码**:

```typescript
// 提取为常量（可放在单独的 styles.ts 文件中）
const AUTH_INPUT_CLASSES = cn(
  // 基础样式
  "w-full px-4 py-3 rounded-lg",
  // 背景
  "bg-white/10 dark:bg-gray-800/50",
  // 边框
  "border border-white/20 dark:border-gray-600",
  // 文字
  "text-white dark:text-gray-100",
  "placeholder-gray-400 dark:placeholder-gray-500",
  // 焦点状态
  "focus:outline-none focus:ring-2",
  "focus:ring-purple-500 dark:focus:ring-purple-400",
  "focus:border-transparent",
  // 过渡
  "transition-all duration-200"
);

// 使用
<input className={AUTH_INPUT_CLASSES} />
```

---

### 问题 P014: FileList 使用模板字符串而非 cn() 工具

**当前代码** (`FileList.tsx` line 559):

```typescript
<button
  className={`h-9 w-9 rounded-lg text-sm font-medium transition-colors ${
    page === pageNum
      ? 'bg-purple-600 text-white'
      : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'
  }`}
>
```

**问题分析**:
- 使用模板字符串而非项目中的 `cn()` 工具
- 不一致的代码风格
- 可能导致 Tailwind 类名冲突

**优化后代码**:

```typescript
<button
  className={cn(
    "h-9 w-9 rounded-lg text-sm font-medium transition-colors",
    page === pageNum
      ? "bg-purple-600 text-white"
      : "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white"
  )}
>
```

---

## 八、网络请求优化

### 8.1 添加请求预取

**当前状态**: 用户翻页时才加载下一页数据

**优化方案**:

```typescript
// 在 FileList.tsx 中添加预取逻辑
const prefetchNextPage = useCallback(() => {
  if (page < totalPages) {
    // 预取下一页（不更新状态，只缓存）
    listFilesStable({
      page: page + 1,
      limit,
      search: debouncedSearch || undefined,
      mime_type: mimeType || undefined,
      category: category || undefined,
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
      size_min: sizeMin ? Number(sizeMin) * 1024 * 1024 : undefined,
      size_max: sizeMax ? Number(sizeMax) * 1024 * 1024 : undefined,
      folder_id: currentFolderId,
    });
  }
}, [page, totalPages, limit, debouncedSearch, mimeType, category, dateFrom, dateTo, sizeMin, sizeMax, currentFolderId]);

// 在数据加载完成后预取
useEffect(() => {
  if (!loading && files.length > 0) {
    prefetchNextPage();
  }
}, [loading, files.length, prefetchNextPage]);
```

### 8.2 优化缓存键生成

**当前代码** (`utils/fileListCache.ts`):

```typescript
export function getCacheKey(query: Record<string, unknown>): string {
  const sorted = Object.keys(query)
    .sort()
    .map((key) => `${key}=${query[key]}`)
    .join('&');
  return `${CACHE_KEY_PREFIX}${sorted}`;
}
```

**优化后代码**:

```typescript
export function getCacheKey(query: Record<string, unknown>): string {
  // 直接 stringify，更快且结果一致
  return `${CACHE_KEY_PREFIX}${JSON.stringify(query)}`;
}
```

### 8.3 视频预览与流式播放（已实现）

- **直连 URL**：预览页视频、音频使用 `getStreamUrl(file.id)`（即 `GET /api/files/:id/preview?token=...`），不先拉完整 Blob，避免大文件占满内存。
- **后端 Range**：`preview` 与 `download` 共用同一 GET 逻辑，响应带 `Accept-Ranges: bytes`，支持 `Range: bytes=start-end`，浏览器可流式加载与拖拽进度。
- **前端**：`<video preload="metadata">` 仅拉元数据，播放或 seek 时再按需请求区间；`onError` 时回退为 fetch Blob 或提示失败。
- **超大视频 HLS（已实现）**：文件大小 ≥ 100MB 时，后端用 FFmpeg 转码为 HLS（`.m3u8` + `.ts`），前端用 hls.js 播放；仅支持本地存储，需安装 ffmpeg。见后端 `ENGINEERING_PLAYBOOK.md` HLS 节。

---

## 九、大组件拆分

### 问题 P015: Settings.tsx (510 行)

**拆分方案**:

```
src/pages/Settings.tsx (主文件，约 100 行)
├── src/components/settings/UserInfoSection.tsx (~30 行)
├── src/components/settings/StorageUsageSection.tsx (~80 行)
├── src/components/settings/PasswordChangeSection.tsx (~100 行)
└── src/components/settings/ApiTokenSection.tsx (~200 行)
```

**拆分示例** - `StorageUsageSection.tsx`:

```typescript
import { useRef, useEffect } from 'react';
import { formatBytes } from '../../utils/format';

interface StorageUsageProps {
  storageUsage: {
    total_size: number;
    file_count: number;
    quota: number | null;
    usage_percent: number | null;
    is_unlimited: boolean;
  } | null;
}

export default function StorageUsageSection({ storageUsage }: StorageUsageProps) {
  const progressBarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = progressBarRef.current;
    if (!el || !storageUsage?.usage_percent) return;
    el.style.setProperty('--storage-progress-pct', `${Math.min(storageUsage.usage_percent, 100)}%`);
  }, [storageUsage?.usage_percent]);

  if (!storageUsage) return null;

  return (
    <div className="bg-gray-800 rounded-lg p-6">
      <h2 className="text-xl font-semibold mb-4 text-white">存储使用情况</h2>
      {/* ... 剩余 JSX */}
    </div>
  );
}
```

---

### 问题 P016: FileList.tsx (686 行)

**拆分方案**:

```
src/components/files/FileList.tsx (主文件，约 300 行)
├── src/components/files/FileListGrid.tsx (~150 行)
├── src/components/files/FileListPagination.tsx (~80 行)
└── src/components/files/FileListBatchActions.tsx (~100 行)
```

**拆分示例** - `FileListPagination.tsx`:

```typescript
import { ChevronLeftIcon, ChevronRightIcon } from './icons';
import { cn } from '../../utils/cn';

interface FileListPaginationProps {
  page: number;
  totalPages: number;
  pageNumbers: number[];
  onPageChange: (page: number) => void;
}

export default function FileListPagination({
  page,
  totalPages,
  pageNumbers,
  onPageChange,
}: FileListPaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-center gap-2 py-4">
      <button
        onClick={() => onPageChange(Math.max(1, page - 1))}
        disabled={page === 1}
        className={cn(
          "flex items-center gap-1 rounded-lg px-4 py-2 text-sm text-white transition-colors",
          "bg-gray-800 hover:bg-gray-700",
          "disabled:cursor-not-allowed disabled:opacity-50"
        )}
      >
        <ChevronLeftIcon />
        上一页
      </button>

      <div className="flex items-center gap-1">
        {pageNumbers.map((pageNum) => (
          <button
            key={pageNum}
            onClick={() => onPageChange(pageNum)}
            className={cn(
              "h-9 w-9 rounded-lg text-sm font-medium transition-colors",
              page === pageNum
                ? "bg-purple-600 text-white"
                : "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white"
            )}
          >
            {pageNum}
          </button>
        ))}
      </div>

      <button
        onClick={() => onPageChange(Math.min(totalPages, page + 1))}
        disabled={page === totalPages}
        className={cn(
          "flex items-center gap-1 rounded-lg px-4 py-2 text-sm text-white transition-colors",
          "bg-gray-800 hover:bg-gray-700",
          "disabled:cursor-not-allowed disabled:opacity-50"
        )}
      >
        下一页
        <ChevronRightIcon />
      </button>
    </div>
  );
}
```

---

## 十、优化优先级与预期收益

| 优先级 | 问题编号 | 优化项 | 预期收益 | 工作量 |
|--------|----------|--------|----------|--------|
| **P0** | P001 | Vite 构建配置 | 初始包体积 -20~30% | 中 |
| **P0** | P006 | useRequestDedup 内存泄漏 | 长时间运行稳定性 | 小 |
| **P0** | P007 | useClipboard 定时器泄漏 | 组件卸载安全性 | 小 |
| **P1** | P003 | 对话框懒加载 | TTI 改善 15~25% | 中 |
| **P1** | P004 | 内联函数修复 | 渲染性能提升 30%+ | 大 |
| **P1** | P009 | useKeyboardShortcuts 优化 | 减少事件监听器重注册 | 小 |
| **P2** | P002 | 移除未使用依赖 | 包体积 -50KB | 小 |
| **P2** | P005 | Settings memoization | 减少不必要重渲染 | 中 |
| **P2** | P008 | downloadBlob URL 释放 | 内存安全 | 小 |
| **P2** | P010 | useOptimisticUpdate 修复 | 数据一致性 | 小 |
| **P2** | P011 | useCategories 依赖修复 | 代码清晰度 | 小 |
| **P3** | P012 | 删除 App.css | 代码清洁 | 小 |
| **P3** | P013 | className 提取 | 可维护性 | 中 |
| **P3** | P014 | 模板字符串改 cn() | 代码一致性 | 小 |
| **P3** | P015, P016 | 大组件拆分 | 可维护性、可测试性 | 大 |

---

## 实施建议

1. **第一阶段**（1-2 天）：完成 P0 级别优化
   - 配置 Vite 构建优化
   - 修复内存泄漏问题

2. **第二阶段**（2-3 天）：完成 P1 级别优化
   - 实现对话框组件懒加载
   - 修复主要的内联函数问题
   - 优化 Hook 性能

3. **第三阶段**（1-2 天）：完成 P2 级别优化
   - 清理依赖
   - 添加 memoization
   - 修复其他 Hook 问题

4. **第四阶段**（3-5 天）：完成 P3 级别优化
   - CSS 清理和重构
   - 大组件拆分

---

## 验证方法

### 包体积验证

```bash
# 构建前记录
npm run build
# 记录 dist 目录大小

# 优化后对比
npm run build:analyze
# 查看可视化报告
```

### 渲染性能验证

使用 React DevTools Profiler:
1. 打开 Chrome DevTools → Profiler
2. 录制一段用户操作
3. 对比优化前后的渲染次数和时间

### 内存泄漏验证

使用 Chrome DevTools Memory:
1. 打开 Memory 面板
2. 执行多次操作（如上传、预览文件）
3. 拍摄 Heap Snapshot
4. 检查是否有持续增长的对象

---

*文档版本: 1.0*
*更新日期: 2026-01-24*
*作者: AI Performance Consultant*
