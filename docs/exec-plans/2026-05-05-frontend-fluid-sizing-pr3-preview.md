# Frontend Fluid Sizing PR3 Preview Exec Plan

## Intent

继续前端动态尺寸流体化分阶段计划，交付第三阶段：将文件预览域纳入尺寸治理，并移除预览系统内用户可感知固定 `px` 尺寸。

## Assumptions

- PR3 覆盖 `frontend/src/components/files/preview` 与 `frontend/src/styles/preview.css`。
- 图片 `sizes` 与 IntersectionObserver `rootMargin` 属于浏览器运行参数；前者改为 `rem`，后者保留并显式标注例外。
- PDF canvas 渲染计算仍以浏览器像素为基础，但可见留白改为按容器宽度自适应。

## Risks

- 预览舞台有 3D transform 与 PDF canvas，类型检查和浏览器视觉验证都必须跑。
- 预览截图依赖现有文件数据和当前登录态，视觉证明以当前 `/files` 可打开预览为准。
- 确认弹窗和文件夹弹窗仍需后续阶段继续治理。

## Dependencies

- `frontend/scripts/check-fluid-sizing.mjs`
- Preview Vitest coverage
- In-app browser visual verification

## Steps

1. 写失败测试，验证 `--scope=preview` 只覆盖预览域。
2. 实现 `preview` scope。
3. 将预览舞台、PDF loading、scanline、neon shadow、thumbnail sizes 的固定视觉尺寸替换为 `rem`/`clamp()`。
4. 为预览懒加载 observer rootMargin 添加显式例外说明。
5. 运行 `npm run check:fluid-sizing -- --scope=preview`、预览相关测试、全量测试、lint、build。
6. 使用 in-app browser 打开预览并保存截图证明。

## Evidence

- In-app browser preview screenshot: `docs/exec-plans/2026-05-05-frontend-fluid-sizing-pr3-preview-browser.png`
