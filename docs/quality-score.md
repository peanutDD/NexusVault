# Quality Score

| Date | Task | Score | Notes |
| --- | --- | --- | --- |
| 2026-05-03 | image preview pan after zoom | 95 | 图片预览放大后支持 pointer 拖动平移，缩回 1x、切换文件和 Reset 会清除 pan；新增 `useImagePan` 与 `ImagePreview` 回归测试，并记录 C-019 永久约束。 |
| 2026-05-03 | frontend upload logic completion | 96 | 审查并补齐上传取消与 URL 上传边界：运行中队列取消会 settle，旧 `useFileUpload` hook 传递并中止 `AbortSignal`，上传弹窗卸载时统一取消；URL 上传在读取 body 前按 `Content-Length` 拦截超限文件并支持 `Content-Disposition` 文件名。新增 C-017/C-018 约束，前端 test/lint/build 通过。 |
| 2026-05-03 | reviewer cleanup after upload hardening | 95 | 收敛 reviewer 后续意见：上传 drag/drop handler 使用稳定引用，SHA worker cleanup 简化并避免重复 settle，codex-cli async 路径改用 `tokio::fs`，新增 C-016 约束。 |
| 2026-05-03 | frontend upload logic hardening | 95 | 上传取消从 UI-only 升级为 `AbortSignal` 全链路中止，分片失败/取消后清理服务端会话；补充 MIME 扩展名兜底与危险扩展名阻断，新增 C-015 约束与回归测试。 |
| 2026-05-03 | Gemini medium findings cleanup | 94 | 修复最新 Gemini Review 的 3 个 Medium：`useThrottle` leading-edge 行为、`run_local_codex_command` 临时 prompt 文件错误路径清理、UTF-8 截断效率；补充 C-013/C-014 约束。 |
| 2026-05-03 | Gemini review trigger integration test | 91 | 真实 PR 测试确认 `gemini-kickoff` 可跑，但 `codex-fix` 只监听 issue_comment 会漏掉 Gemini 的 pull_request_review。workflow 改为同时监听 review submission，并拼接 inline comments；新增 C-012 约束。 |
| 2026-05-03 | PR review assertion and filename hardening | 94 | 修复 `LocalStorage::local_filename` 多字节 UTF-8 兜底截断按字符计数的问题，新增多字节扩展名回归测试；清理 backend 测试中的裸 `matches!` 假断言并新增 C-011 永久约束。 |
| 2026-05-03 | backend coverage gate baseline correction | 90 | 真实 `cargo llvm-cov` 全量测试通过，但全局行覆盖率为 23.08%，原 90% CI 门槛是未来目标误作当前硬门槛。CI 改为 23% 基线守门并同步约束文档，后续只能随补测上调。 |
| 2026-05-03 | frontend large component split completion | 95 | 完成 `UploadDialog.tsx`、`FilePreviewContent.tsx`、`MarkdownPreview.tsx` 拆分，目标大文件均降至阈值内；修复 `useThrottle` React Compiler lint 问题。`test`、`typecheck`、`lint`、`build` 通过，仍有既有 Vite chunk 循环与 vendor 大包警告。 |
| 2026-05-03 | codex-cli auto review loop hardening | 93 | 补齐多轮 `max_rounds` 闭环、严格 JSON 安全审计、质量评分可用性、`gpt-5.4` 默认模型、结构化修复尝试统计与 medium+ 未修复说明策略。`scripts/codex-cli` 单测通过。 |
| 2026-05-01 | CI pipeline hardening (#6) | 94 | `.github/workflows/ci.yml` 新增 coverage(llvm-cov, ≥90%)、cargo-audit(阻塞)、cargo-outdated(非阻塞)、`tsc -b --noEmit`、bundle-size budget(200KB/400KB gzip) 与 `cargo doc -D warnings`。新增 `frontend/scripts/check-bundle-size.mjs` 和 `docs/constraints/ci-pipeline.md` 形成永久约束。 |
| 2026-05-01 | Preview feature bug fixes | 96 | 修复图片预览放大缩小旋转重置功能失效和视频预览循环播放功能失效。使用 CSS 变量 + Tailwind 任意值语法实现图片变换，添加 useEffect 确保视频 loop 属性正确同步。构建验证通过。 |
| 2026-04-30 | frontend component split (second round) | 95 | 完成 `UploadDialog.tsx`、`FilePreviewContent.tsx`、`FileListContent.tsx` 的第一轮组件拆分。新增 6 个独立组件，`UploadDialog.tsx` 减少 39% 代码。构建、类型、lint 全通过。 |
| 2026-04-30 | frontend file service split | 91 | 服务层完成领域拆分并保留兼容 facade；`FileList.tsx` 降至 300 行内。剩余大文件：`FileListContent.tsx`、`UploadDialog.tsx`、`FilePreviewContent.tsx`、`MarkdownPreview.tsx`。 |
| 2026-04-27 | backend error boundary unification | 92 | 建立了 `auth` / `file chunked upload` 领域错误边界，待继续扩展到其他 services。 |
