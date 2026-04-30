# Quality Score

| Date | Task | Score | Notes |
| --- | --- | --- | --- |
| 2026-05-01 | CI pipeline hardening (#6) | 94 | `.github/workflows/ci.yml` 新增 coverage(llvm-cov, ≥90%)、cargo-audit(阻塞)、cargo-outdated(非阻塞)、`tsc -b --noEmit`、bundle-size budget(200KB/400KB gzip) 与 `cargo doc -D warnings`。新增 `frontend/scripts/check-bundle-size.mjs` 和 `docs/constraints/ci-pipeline.md` 形成永久约束。 |
| 2026-04-30 | frontend component split (second round) | 95 | 完成 `UploadDialog.tsx`、`FilePreviewContent.tsx`、`FileListContent.tsx` 的第一轮组件拆分。新增 6 个独立组件，`UploadDialog.tsx` 减少 39% 代码。构建、类型、lint 全通过。 |
| 2026-04-30 | frontend file service split | 91 | 服务层完成领域拆分并保留兼容 facade；`FileList.tsx` 降至 300 行内。剩余大文件：`FileListContent.tsx`、`UploadDialog.tsx`、`FilePreviewContent.tsx`、`MarkdownPreview.tsx`。 |
| 2026-04-27 | backend error boundary unification | 92 | 建立了 `auth` / `file chunked upload` 领域错误边界，待继续扩展到其他 services。 |
