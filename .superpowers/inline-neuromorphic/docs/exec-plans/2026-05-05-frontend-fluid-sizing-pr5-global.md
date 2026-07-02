# Frontend Fluid Sizing PR5 Global Exec Plan

## Intent

继续前端动态尺寸流体化分阶段计划，交付第五阶段：收敛剩余全局 token、导航/CTA 装饰、devtools 与未覆盖边缘文件，并让 `--scope=all` 覆盖全前端。

## Assumptions

- PR5 覆盖 `frontend/src/styles/tokens.css`、`cta.css`、`nav.css`、`QueryProvider.tsx`、`InfiniteScrollSentinel.tsx` 以及 `--scope=all` 新暴露的 signed/calc 尾巴。
- 全局 token 里的固定视觉尺寸采用 rem 等价值，保持当前桌面视觉上限。
- IntersectionObserver rootMargin 属于预取运行参数，保留固定值但必须写明 `fluid-sizing-allow` 原因。
- offscreen clipboard staging 不是用户可见布局，允许显式例外。

## Risks

- `tokens.css` 跨主题复用面广，必须跑全量 test/lint/build。
- 机械替换可能影响 Tailwind arbitrary value，`calc()` 需要使用 Tailwind underscore spacing。
- 视觉验收以当前 `/files` 页面全局导航、CTA、卡片 hover/弹窗关闭后的页面为准。

## Dependencies

- `frontend/scripts/check-fluid-sizing.mjs`
- Full Vitest/lint/build verification
- In-app browser visual verification

## Steps

1. 写失败测试，验证 `--scope=global` 覆盖剩余全局域。
2. 写失败测试，验证 signed fixed px 会被治理脚本发现。
3. 实现 `global` scope 并增强 fixed px matcher。
4. 将全局 token、导航/CTA shadow、devtools min-height、preview text calc 与 hover translate 固定尺寸替换为 `rem`。
5. 为 observer rootMargin 与 offscreen clipboard staging 添加显式例外。
6. 运行 `npm run check:fluid-sizing -- --scope=all`、全量测试、lint、build。
7. 使用 in-app browser 保存 `/files` 页面截图证明。

## Evidence

- In-app browser global `/files` screenshot: `docs/exec-plans/2026-05-05-frontend-fluid-sizing-pr5-global-browser.png`
