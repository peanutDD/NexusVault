# Upload Dialog Mobile Spacing Exec Plan

## Intent

修复上传弹窗在移动端贴近浏览器可视区域边缘的问题，确保上下左右都有稳定留白。

## Assumptions

- 问题来自上传弹窗外层 viewport sizing 和 safe-area 处理，不涉及上传队列或接口逻辑。
- 移动浏览器动态地址栏会让 `vh` 与真实可见区域不一致，应优先用 `dvh`。
- 自动化单测用 CSS 契约覆盖，真实布局再通过本地浏览器截图确认。

## Risks

- jsdom 不计算真实 CSS layout，测试只能锁定样式契约，不能替代视觉确认。
- 过大的移动端留白会压缩弹窗可滚动内容，需要保持 body 继续滚动。
- 当前工作区已有未归属变更 `docs/testing-strategy.md`，本任务不得覆盖。

## Dependencies

- Frontend: React, Tailwind, Vitest, jsdom.
- Files: `frontend/src/components/files/upload/UploadDialog.css`, upload dialog tests.

## Steps

1. 新增失败测试，要求上传弹窗移动端 shell 使用 dynamic viewport 和 safe-area 留白。
2. 修改 `UploadDialog.css`，让 backdrop 的 padding 与 safe-area 相加，并让 surface 的最大高宽按留白计算。
3. 运行定向测试，确认失败转通过。
4. 运行前端 lint/build 可行校验。
5. 新增永久约束与质量分记录。
