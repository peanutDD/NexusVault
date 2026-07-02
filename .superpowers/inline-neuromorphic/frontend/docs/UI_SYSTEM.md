# 前端 UI 设计系统说明（初版）

本项目已经在 `src/components/common/` 下形成了一套基本的 UI 组件体系，后续所有新功能应优先复用这些组件，以保持视觉与交互的一致性。

## 1. 按钮（Button）

- 位置：`frontend/src/components/common/Button.tsx`
- 用途：统一按钮的尺寸、圆角、阴影和悬浮态。
- 推荐用法：

```tsx
import Button from '../../common/Button';

<Button variant="primary" size="md" onClick={handleClick}>
  确认
</Button>

<Button variant="ghost" size="sm" onClick={onCancel}>
  取消
</Button>
```

> 新增交互操作时（如对话框确认、列表工具栏按钮），请优先使用 `Button`，避免手写 className。

## 2. 空状态（EmptyState）

- 位置：`frontend/src/components/common/EmptyState.tsx`
- 用途：在「暂无数据 / 空列表 / 无搜索结果」场景下显示统一的空状态提示。
- 推荐用法：

```tsx
import EmptyState from '../../common/EmptyState';

<EmptyState
  title="暂无文件"
  description="上传你的第一个文件吧"
  icon="file"
/>
```

> 文件列表为空、搜索无结果、新建文件夹后无内容等场景，统一走 `EmptyState`，避免每个页面自定义一套文案/样式。

## 3. 错误提示（ErrorMessage）

- 位置：`frontend/src/components/common/feedback/ErrorMessage.tsx`
- 用途：展示错误/警告/成功等消息，带统一的玻璃拟态风格。
- 推荐用法：

```tsx
import ErrorMessage from '../../common/feedback/ErrorMessage';

<ErrorMessage
  type="error"
  message="加载失败，请稍后重试"
  onClose={() => setError(null)}
/>;
```

> 预览加载失败、列表请求失败、上传失败提示，推荐用此组件，并提供「重试」按钮或关闭回调。

## 4. 骨架屏（Skeleton）

- 位置：`frontend/src/components/common/feedback/Skeleton.tsx`
- 用途：在数据加载中显示灰色占位符，减少「空白」感。
- 推荐用法：

```tsx
import Skeleton, { FileCardSkeleton, FileListSkeleton } from '../../common/feedback/Skeleton';

// 单个占位
<Skeleton variant="text" width="80%" height={16} />;

// 文件卡片网格占位
<div className="grid grid-cols-3 gap-4">
  <FileCardSkeleton count={9} />
</div>;
```

> 列表和网格加载时，请优先使用现成的 `FileCardSkeleton` / `FileListSkeleton`，保持加载态一致。

## 5. 标签 / Tag

- 位置：`frontend/src/components/common/Tag.tsx`
- 用途：展示类型、状态、小计等简短标记。
- 推荐用法：

```tsx
import Tag from '../../common/Tag';

<Tag variant="neutral">Archive</Tag>
<Tag variant="success">Ready</Tag>
```

> 例如：文件类型标签、过滤条件徽标、标记「大文件」「HLS」等，可统一用 Tag。

## 6. 表单与输入（FormField / SelectionCheckbox）

- 位置：
  - 表单字段容器：`frontend/src/components/common/form/FormField.tsx`
  - 勾选框：`frontend/src/components/common/form/SelectionCheckbox.tsx`
- 用途：在设置页、对话框、筛选栏中保持统一的表单布局与交互。

```tsx
import { FormField } from '../../common/form';

<FormField label="文件名" description="用于展示在列表和分享链接中">
  <input className="..." value={name} onChange={...} />
</FormField>
```

## 7. 对话框与文件操作弹窗

### 7.1 通用结构

- 位置：
  - 基础对话框：`frontend/src/components/common/dialog/BaseDialog.tsx`
  - 确认弹窗：`frontend/src/components/common/dialog/ConfirmDialog.tsx`
  - 通用模态框：`frontend/src/components/common/dialog/Modal.tsx`
- 文件操作弹窗优先复用现有通用组件，不在业务组件内重新实现遮罩、ESC 关闭、背景点击、自动聚焦、loading 禁用等交互。
- `ConfirmDialog appearance="glass"` 是文件操作确认类弹窗的默认外观，覆盖：
  - 新建文件夹
  - 批量移动
  - 批量删除
  - 批量分享
  - 文件/文件夹重命名
  - 文件/文件夹删除
- `Modal variant="glass"` 用于表单较完整的模态流程，例如单文件分享。

### 7.2 主题化科技玻璃外观

- 科技感外观由公共组件自动挂载：
  - `confirm-dialog-tech`
  - `confirm-dialog-tech-panel`
  - `modal-dialog-tech`
  - `modal-dialog-tech-panel`
- 视觉细节集中在 `frontend/src/styles/confirm-dialog.css`：
  - 背景光栅
  - 顶部能量线
  - 面板发光描边
  - 凹槽式标题栏
  - 确认/取消按钮 hover glow
- 颜色、光效、网格透明度必须通过 `frontend/src/styles/tokens.css` 的 `--dialog-tech-*` 变量控制。
- 新增主题时必须同时补齐 dark / light / purple 对应的 `--dialog-tech-*` token，避免组件内写死颜色。

### 7.3 行为约束

- 视觉升级不得改变业务回调、表单校验、loading 状态、错误提示、复制链接、移动目标选择或删除确认流程。
- 对话框正文里的列表、输入框、摘要卡片继续使用 `--dialog-panel-*`、`--dialog-list-*`、`--dialog-field-*`、`--dialog-action-*` token。
- 文件操作弹窗的回归测试至少覆盖：
  - 科技玻璃 shell 已挂载
  - confirm / close 回调仍按原按钮触发
  - 弹窗内容可见，不被装饰层遮挡

## 8. 文件预览体验（补充说明）

### 8.1 GIF / 视频预览（HLS 优先，MP4 兜底）

- GIF 预览默认走 HLS：
  - 前端优先请求 `GET /api/files/:id/hls`（`.m3u8`）
  - 未生成时可触发 `POST /api/files/:id/hls/prepare` 并查询 `GET /api/files/:id/hls/status`
  - 目的：支持“边转边播”，避免大 GIF 等待整段转码完成
- MP4 预览为后备方案（仅在需要时使用）：
  - `GET /api/files/:id/preview/video`（Legacy）
  - `POST /api/files/:id/preview/video/prepare` + `GET /api/files/:id/preview/video/status`
- 视频循环播放：
  - 工具栏「循环播放」按钮会切换播放器循环状态

### 8.2 移动端下载兜底（URL Token）

- 部分浏览器不支持文件系统写入能力时，下载采用浏览器原生下载：
  - `GET /api/files/:id/download?token=...`
  - 仅 GET 场景支持 query token；优先使用 `Authorization: Bearer <token>`
  - 注意避免在不可信页面暴露 token（Referer/日志风险）

## 9. 文件列表交互规范（排序 / 分组 / 滚动位置）

### 9.1 排序与分组策略

- 普通排序（按名称/时间/大小）：
  - 文件与文件夹会合并为同一列表统一排序并混排展示
- `By Type` 分组：
  - 以类型分组文件；文件夹单独展示为一个文件夹区域
- `By Time` 分组：
  - 按天分组，文件夹与文件都会进入对应日期分组
  - 分组“全选”会同时选择该日期分组内的文件与文件夹

### 9.2 进入/返回文件夹时的滚动位置

- 仅在浏览器后退/前进（POP）时，会按当前条件（folder/sort/mime/search）记忆并恢复滚动位置
- 点击进入子文件夹时始终从顶部开始（避免误以为列表“跳动/错位”）

### 9.3 列表卡片排版与数字格式

- 文件大小在卡片中使用紧凑格式：
  - 不显示小数
  - `MB` 显示为 `M`；超出位数上限自动进位到 `G/T/...`
- FileCard/FolderCard 文字使用 `clamp()` 响应式字号，并保证长文本不会撑破布局（`min-w-0 + truncate`）
- 卡片所有视觉尺寸（圆角、阴影、模糊）均通过 Design Tokens 的 `clamp()` 流体值随视口自适应缩放，详见 [TOKENS_USAGE.md §11](./TOKENS_USAGE.md#11-流体自适应规范fluid-tokens)

### 9.4 预览页 3D 玻璃拟态背景（说明）

- 预览弹窗使用 3D 分层玻璃拟态背景，优先保证内容可读与可点击：
  - 工具栏/导航按钮始终在最上层（避免被 3D 场景遮挡）
  - 背板/网格等装饰保持透明或半透明，避免遮住文件内容
  - 移动端优先兼容（性能与可用性优先于装饰效果）

## 10. 后续规范建议

- 新增页面或组件时：
  - 优先从 `components/common` 挑选现有组件（Button、EmptyState、ErrorMessage、Skeleton、Tag 等）。
  - 若需新增通用组件，请放在 `components/common`，并在本文件中补充用法说明。
- Tailwind 使用：
  - 遵循项目中已有的玻璃风样式（渐变 + blur + border + shadow）。
  - 避免在业务组件中大量复制粘贴样式，优先抽到公共组件或封装到工具类。
