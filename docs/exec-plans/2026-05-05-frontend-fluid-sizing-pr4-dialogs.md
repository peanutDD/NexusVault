# Frontend Fluid Sizing PR4 Dialogs Exec Plan

## Intent

继续前端动态尺寸流体化分阶段计划，交付第四阶段：将确认弹窗与文件夹弹窗域纳入尺寸治理，并移除该域内用户可感知固定 `px` 尺寸。

## Assumptions

- PR4 覆盖 `frontend/src/components/common/dialog`、`frontend/src/components/files/dialogs`、`frontend/src/components/files/list/FileListDialogs.tsx` 与 `frontend/src/styles/confirm-dialog.css`。
- `1px/2px` 边框与发丝网格线继续使用既有内置例外。
- `CreateFolderDialog.css` 当前未被 import，但仍属于文件夹弹窗域，纳入治理以避免后续复用时带回固定尺寸。

## Risks

- 确认弹窗的科技玻璃视觉依赖多层 shadow、grid 与 backdrop blur，必须保持桌面观感接近当前上限。
- 仅修改尺寸表达，不改变弹窗行为、props、服务调用或提交/删除语义。
- 删除/移动等高风险动作只做打开弹窗视觉验证，不执行确认动作。

## Dependencies

- `frontend/scripts/check-fluid-sizing.mjs`
- Confirm dialog Vitest coverage
- In-app browser visual verification

## Steps

1. 写失败测试，验证 `--scope=dialogs` 只覆盖弹窗域。
2. 实现 `dialogs` scope。
3. 将确认弹窗与文件夹弹窗 CSS 中的固定视觉尺寸替换为 `rem`/`clamp()` 语义变量。
4. 将批量移动弹窗内固定小字号改为 rem 等价值。
5. 运行 `npm run check:fluid-sizing -- --scope=dialogs`、弹窗相关测试、全量 lint/build。
6. 使用 in-app browser 打开新建文件夹弹窗并保存截图证明。

## Evidence

- In-app browser create folder dialog screenshot: `docs/exec-plans/2026-05-05-frontend-fluid-sizing-pr4-dialogs-browser.png`
