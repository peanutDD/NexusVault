# 前端重构计划与实施记录

## 重构目标

1. **高效优雅**：代码简洁、逻辑清晰
2. **减少冗余**：消除重复代码、统一类型定义
3. **模块解耦**：组件、hooks、services 职责单一
4. **高度模块化**：按业务领域和功能分组
5. **结构分层清晰**：目录组织合理、易于导航
6. **代码文件夹细致精准**：每个目录有明确的职责边界

---

## 重构前问题分析

### 1. 代码冗余

- ESC 关闭对话框逻辑在 8 个组件中重复
- 文件夹名称验证逻辑在 2 个组件中重复
- 文件/文件夹选择框 UI 在 2 个组件中重复

### 2. 组件职责过重

- `useFileList.ts`：877 行，混合了过滤、选择、分组、加载等逻辑
- `UploadDialog.tsx`：616 行，混合了拖拽、URL 上传、队列管理
- `fileStore.ts`：职责过重，管理列表、选择、对话框状态

### 3. 类型重复

- `User` 类型：`types/index.ts` 和 `services/auth.ts` 重复
- `Folder` 类型：`types/index.ts` 和 `services/folders.ts` 重复且字段不一致
- `StorageUsage` 类型：3 处重复

### 4. 目录结构混乱

- hooks 未按业务领域组织
- utils 15 个文件未分类，职责边界不清
- services 文件过大未拆分
- components 扁平结构，缺少功能分组

---

## 重构后目录结构

```
src/
├── components/
│   ├── common/                         # 通用 UI 组件
│   │   ├── dialog/                     # 对话框组件
│   │   │   ├── BaseDialog.tsx          # 基础对话框（ESC、聚焦、背景点击）
│   │   │   ├── ConfirmDialog.tsx       # 确认对话框
│   │   │   ├── Modal.tsx               # 通用模态框
│   │   │   └── index.ts
│   │   ├── form/                       # 表单组件
│   │   │   ├── FormField.tsx           # 表单字段
│   │   │   ├── SelectionCheckbox.tsx   # 文件/文件夹选择框
│   │   │   └── index.ts
│   │   ├── feedback/                   # 反馈组件
│   │   │   ├── ErrorMessage.tsx        # 错误消息
│   │   │   ├── Skeleton.tsx            # 骨架屏
│   │   │   ├── Spinner.tsx             # 加载指示器
│   │   │   └── index.ts
│   │   └── (Button, DropdownMenu, ThemeToggle 等)
│   │
│   ├── files/                          # 文件管理组件
│   │   ├── dialogs/                    # 文件相关对话框
│   │   │   ├── CreateFolderDialog.tsx
│   │   │   ├── RenameFolderDialog.tsx
│   │   │   ├── ShareDialog.tsx
│   │   │   ├── BatchShareDialog.tsx
│   │   │   ├── BatchMoveDialog.tsx
│   │   │   └── index.ts
│   │   ├── upload/                     # 上传相关
│   │   │   ├── UploadDialog.tsx        # 上传对话框主容器
│   │   │   ├── UploadFileItem.tsx      # 单个上传项
│   │   │   ├── UploadDropzone.tsx      # 拖拽区域
│   │   │   ├── UrlUploadForm.tsx       # URL 上传表单
│   │   │   └── index.ts
│   │   ├── grid/                       # 网格视图
│   │   │   ├── FileCard.tsx            # 文件卡片
│   │   │   ├── FolderCard.tsx          # 文件夹卡片
│   │   │   ├── FileGrid.tsx            # 文件网格
│   │   │   ├── FolderGrid.tsx          # 文件夹网格
│   │   │   ├── VirtualizedFileGrid.tsx # 虚拟化文件网格
│   │   │   └── index.ts
│   │   ├── preview/                    # 预览相关
│   │   │   ├── FilePreview.tsx         # 文件预览
│   │   │   ├── LazyThumbnail.tsx       # 懒加载缩略图
│   │   │   └── index.ts
│   │   ├── list/                       # 列表容器
│   │   │   ├── FileList.tsx            # 文件列表主组件
│   │   │   ├── FileListContent.tsx     # 列表内容
│   │   │   ├── FileListHeader.tsx      # 列表头部
│   │   │   ├── FileListFilters.tsx     # 过滤器
│   │   │   ├── FileListBatchActions.tsx # 批量操作
│   │   │   ├── FileListPagination.tsx  # 分页
│   │   │   ├── FileListContext.tsx     # 列表上下文
│   │   │   └── index.ts
│   │   └── (FolderBreadcrumb, InfiniteScrollSentinel 等)
│   │
│   ├── auth/                           # 认证组件
│   ├── layout/                         # 布局组件
│   └── settings/                       # 设置组件
│
├── hooks/
│   ├── common/                         # 通用 hooks
│   │   ├── useDialog.ts                # 对话框逻辑（ESC、聚焦、背景点击）
│   │   ├── useAsyncOperation.ts        # 异步操作（loading/error/execute）
│   │   └── index.ts
│   ├── files/                          # 文件业务 hooks
│   │   ├── useFileFilters.ts           # 过滤排序逻辑
│   │   ├── useFileSelection.ts         # 选择逻辑
│   │   ├── useFileGrouping.ts          # 分组逻辑
│   │   ├── useFileUpload.ts            # 上传逻辑
│   │   └── index.ts
│   └── folders/                        # 文件夹业务 hooks
│       ├── useFolderValidation.ts      # 文件夹名称验证
│       └── index.ts
│
├── services/
│   ├── api/                            # API 基础设施
│   │   └── index.ts                    # 重导出 api 实例
│   ├── files/                          # 文件服务
│   │   └── index.ts                    # 重导出 fileService
│   ├── api.ts                          # Axios 实例、拦截器
│   ├── files.ts                        # 文件 API
│   ├── folders.ts                      # 文件夹 API
│   ├── shares.ts                       # 分享 API
│   ├── auth.ts                         # 认证 API
│   └── index.ts
│
├── store/
│   ├── files/                          # 文件状态
│   │   ├── listStore.ts                # 文件列表状态
│   │   ├── selectionStore.ts           # 选择状态
│   │   ├── dialogStore.ts              # 对话框状态
│   │   └── index.ts
│   ├── authStore.ts
│   ├── themeStore.ts
│   ├── hydrationStore.ts
│   └── index.ts
│
├── types/
│   ├── api.ts                          # API 通用类型
│   ├── auth.ts                         # 认证类型
│   ├── files.ts                        # 文件类型
│   ├── folders.ts                      # 文件夹类型
│   ├── browser.ts                      # 浏览器类型
│   └── index.ts                        # 统一导出
│
├── utils/
│   ├── format/                         # 格式化工具
│   │   └── index.ts
│   ├── request/                        # 请求工具
│   │   └── index.ts
│   ├── file/                           # 文件工具
│   │   └── index.ts
│   ├── browser/                        # 浏览器工具
│   │   └── index.ts
│   ├── cache/                          # 缓存工具
│   │   └── index.ts
│   ├── cn.ts                           # 类名工具
│   ├── error.ts                        # 错误处理
│   ├── format.ts                       # 格式化函数
│   └── index.ts
│
└── constants/
    └── index.ts
```

---

## 重构步骤

### 阶段一：统一类型定义 ✅

1. 创建 `types/api.ts`、`types/auth.ts`、`types/files.ts`、`types/folders.ts`、`types/browser.ts`
2. 删除 `services/auth.ts` 中重复的 `User` 类型
3. 删除 `services/folders.ts` 中重复的 `Folder` 类型
4. 删除 `pages/Settings.tsx` 和 `StorageUsageSection.tsx` 中重复的 `StorageUsage` 类型
5. 更新所有文件的导入路径

### 阶段二：抽取公共 Hooks ✅

1. 创建 `hooks/common/useDialog.ts`
   - 统一 ESC 关闭、输入框聚焦、背景点击关闭
   - 替换 8 处重复代码
2. 创建 `hooks/common/useAsyncOperation.ts`
   - 统一 loading + error + execute 模式
3. 创建 `hooks/folders/useFolderValidation.ts`
   - 统一文件夹名称验证逻辑

### 阶段三：重构对话框组件 ✅

1. 创建 `components/common/dialog/BaseDialog.tsx`
   - 集成 useDialog hook
   - 统一对话框骨架
2. 创建 `components/common/form/SelectionCheckbox.tsx`
   - 统一 FileCard/FolderCard 的选择框
3. 重构 `CreateFolderDialog`、`RenameFolderDialog` 使用新 hooks

### 阶段四：拆分 useFileList ✅

将 877 行的 `useFileList.ts` 拆分为：

- `hooks/files/useFileFilters.ts` - 过滤排序逻辑
- `hooks/files/useFileSelection.ts` - 选择逻辑
- `hooks/files/useFileGrouping.ts` - 分组逻辑（含 Web Worker 集成）

### 阶段五：拆分 fileStore ✅

创建 `store/files/` 目录：

- `listStore.ts` - 文件列表状态
- `selectionStore.ts` - 选择状态
- `dialogStore.ts` - 对话框状态

### 阶段六：组织 services ✅

创建 `services/api/` 和 `services/files/` 目录结构，添加 index.ts 统一导出。

### 阶段七：重组 components 目录 ✅

1. `files` 组件按功能分组：`dialogs/`、`upload/`、`grid/`、`preview/`、`list/`
2. `common` 组件按类型分组：`dialog/`、`form/`、`feedback/`

### 阶段八：拆分 UploadDialog ✅

从 616 行拆分为：

- `UploadDialog.tsx` - 主容器
- `UploadDropzone.tsx` - 拖拽区域
- `UrlUploadForm.tsx` - URL 上传表单
- `useFileUpload.ts` - 上传逻辑 hook

### 阶段九：优化 FileListContent ✅

创建 `FileListContext.tsx`，为未来减少 props 传递提供基础。

### 阶段十：清理和收尾 ✅

1. 创建顶层 `hooks/index.ts`、`utils/index.ts`、`store/index.ts` 统一导出
2. 创建 utils 子目录：`format/`、`request/`、`file/`、`browser/`、`cache/`
3. 物理移动所有组件文件到对应子目录
4. 更新所有导入路径
5. 构建验证通过

---

## 重构成果

### 代码质量提升

- **类型定义零重复**：所有类型集中在 `types/` 目录
- **逻辑复用**：通过 `useDialog`、`useFolderValidation` 等 hooks 消除重复代码
- **职责单一**：每个组件和 hook 专注于单一职责

### 目录结构清晰

- **按业务领域分组**：`files/`、`auth/`、`settings/` 等
- **按功能类型分组**：`dialogs/`、`upload/`、`grid/`、`preview/`、`list/`
- **统一导出**：每个目录都有 `index.ts` 便于导入

### 可维护性提升

- **新功能定位快**：清晰的目录结构便于找到相关代码
- **修改影响小**：模块解耦后，修改不会波及无关代码
- **测试友好**：小而专注的模块更易于单元测试

---

## 导入路径示例

```typescript
// 从 types 导入
import type { FileMetadata, Folder } from '@/types';

// 从 hooks 导入
import { useDialog } from '@/hooks/common';
import { useFileFilters, useFileSelection } from '@/hooks/files';

// 从 components 导入
import { ErrorMessage, Spinner } from '@/components/common/feedback';
import { FileList } from '@/components/files/list';
import { UploadDialog } from '@/components/files/upload';

// 从 store 导入
import { useFileListStore } from '@/store/files';
```

---

## 后续优化建议

1. **配置路径别名**：在 `tsconfig.json` 中配置 `@/` 别名简化导入
2. **添加 barrel exports**：完善 `index.ts` 导出，支持 tree-shaking
3. **代码注释**：为公共 hooks 和组件添加 JSDoc 注释
4. **单元测试**：为拆分后的 hooks 添加单元测试
5. **性能监控**：持续关注 bundle size 变化
