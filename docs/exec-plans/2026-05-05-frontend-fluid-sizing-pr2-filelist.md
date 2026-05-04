# Frontend Fluid Sizing PR2 File List Exec Plan

## Intent

继续前端动态尺寸流体化分阶段计划，交付第二阶段：将文件列表与网格域纳入尺寸治理，并移除该域内用户可感知固定 `px` 尺寸。

## Assumptions

- PR2 只覆盖 `frontend/src/components/files/list` 与 `frontend/src/components/files/grid`。
- IntersectionObserver `rootMargin` 是运行时预取窗口，不属于用户可感知视觉尺寸，但必须显式标注例外。
- 列表桌面密度以上限保持现有视觉，移动端通过 `clamp()` 自然收缩。

## Risks

- 文件列表样式密集，阴影和 blur 改动需要浏览器截图确认。
- 卡片 hover headroom 仍受 C-020 约束，菜单偏移不能影响标题截断和操作菜单。
- 后续预览系统与剩余弹窗仍需要继续分阶段治理。

## Dependencies

- `frontend/scripts/check-fluid-sizing.mjs`
- File list/grid CSS and existing Vitest coverage
- In-app browser visual verification at `/files`

## Steps

1. 写失败测试，验证 `--scope=filelist` 只覆盖文件列表与网格域。
2. 实现 `filelist` scope。
3. 将列表/网格域的固定视觉尺寸替换为 `clamp()` 或 `rem`。
4. 为非视觉运行参数添加明确 `fluid-sizing-allow` 说明。
5. 运行 `npm run check:fluid-sizing -- --scope=filelist`、测试、lint、build。
6. 使用 in-app browser 截图确认 `/files` 页面密度与上传弹窗入口没有明显回归。
