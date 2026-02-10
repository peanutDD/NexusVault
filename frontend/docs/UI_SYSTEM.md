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

## 7. 文件预览体验（补充说明）

- GIF→MP4 预览：
  - 打开 GIF 时，前端会调用：
    - `POST /api/files/:id/preview/video/prepare`
    - 周期性 `GET /api/files/:id/preview/video/status`
  - UI 表现：
    - 在预览顶部展示一句说明 + 进度条（`gifTranscodeInProgress` + `gifTranscodeProgress`）。
    - 转码完成后自动切换为 `<video>` 播放。
    - 失败时不再立即弹「视频加载或播放失败」，而是优先保证转码流程可见。
- 视频循环播放：
  - 右侧工具栏新增「循环播放」按钮，点击后会切换 `<video loop>` 属性。

## 8. 后续规范建议

- 新增页面或组件时：
  - 优先从 `components/common` 挑选现有组件（Button、EmptyState、ErrorMessage、Skeleton、Tag 等）。
  - 若需新增通用组件，请放在 `components/common`，并在本文件中补充用法说明。
- Tailwind 使用：
  - 遵循项目中已有的玻璃风样式（渐变 + blur + border + shadow）。
  - 避免在业务组件中大量复制粘贴样式，优先抽到公共组件或封装到工具类。

