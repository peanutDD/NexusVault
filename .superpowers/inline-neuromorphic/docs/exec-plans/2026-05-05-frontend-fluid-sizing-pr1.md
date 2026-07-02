# Frontend Fluid Sizing PR1 Exec Plan

## Intent

交付前端动态尺寸流体化的第一阶段：新增尺寸治理检查，并将 PR1 范围内的共享/通用/上传弹窗固定视觉尺寸改为随视口变化的动态尺寸。

## Assumptions

- 本轮只覆盖 PR1，不一次性处理整个前端所有固定尺寸。
- 桌面端布局以上限保持现有视觉，移动端通过 `clamp()` 下限自然收缩。
- 上传弹窗已有未提交移动端 safe-area 改动，实施时必须保留并协同。

## Risks

- 视觉一致性不能只靠 jsdom 单测判断，仍需要截图验证。
- 虚拟列表高度 fallback 改动必须保持原有量级，避免滚动估算明显变化。
- 后续文件列表/预览/确认弹窗仍存在固定尺寸，需要继续分阶段治理。

## Dependencies

- Frontend: React, Tailwind CSS, Vitest, Vite.
- Docs: `frontend/docs/TOKENS_USAGE.md`, `docs/constraints/C-028-mobile-dialog-safe-viewport-spacing.md`.

## Steps

1. 写失败测试，验证尺寸治理脚本能拦截用户可感知固定 `px`，并允许明确例外。
2. 实现 `frontend/scripts/check-fluid-sizing.mjs` 与 `npm run check:fluid-sizing`。
3. 将 PR1 范围内的 common/layout/upload/shared 固定尺寸替换为 `clamp()`、`rem` 或语义变量。
4. 扩展上传弹窗 CSS 契约测试，锁定 dynamic viewport、safe-area、动态网格与模糊 token。
5. 新增永久约束与质量分记录。
6. 运行治理检查、定向测试、lint、build。
