# CI Pipeline 永久约束 (ci-pipeline)

版本：v1.1 | 最后更新：2026-05-03
对应 AGENTS.md 规则：#3 一致性铁律 / #4 失败永不重复 / #7 可观测 / #15 质量评分

## 1. 流水线（.github/workflows/ci.yml）强制包含以下 Job

| Job                  | 工具                                      | 阻塞合并 | 说明                                            |
| -------------------- | ----------------------------------------- | :------: | ----------------------------------------------- |
| `backend`            | fmt / clippy / llvm-cov / doc / build     |    ✅    | Rust 主流水                                     |
| `security-audit`     | `cargo audit --deny warnings`             |    ✅    | 已知 CVE / 不安全告警即失败                     |
| `deps-freshness`     | `cargo outdated`                          |    ❌    | 仅报告，每周人工跟进                            |
| `frontend`           | lint / tsc / vitest / build / bundle-size |    ✅    | 含独立 `tsc -b --noEmit` 与 bundle 预算校验     |

任何**删除**或**弱化**（例如把 `-D warnings` 去掉、把覆盖率门槛降到当前基线以下）都必须在同一 PR 中：

1. 说明业务原因；
2. 更新本文件与 `docs/quality-score.md`；
3. 获得人类明确批准（AGENTS.md #8 安全边界）。

## 2. 红线指标

| 指标                              | 阈值                     | 验证点                                 |
| --------------------------------- | ------------------------ | -------------------------------------- |
| 后端行覆盖率                      | ≥ 当前全局基线 23%，目标逐步抬升至 90% | `cargo llvm-cov --fail-under-lines 23` |
| 已知 CVE                          | 0                        | `cargo audit --deny warnings`          |
| rustdoc warnings                  | 0                        | `RUSTDOCFLAGS=-D warnings` + `cargo doc` |
| 前端类型错误                      | 0                        | `tsc -b --noEmit`                      |
| 单个前端 JS chunk（gzip）         | ≤ 200KB                  | `scripts/check-bundle-size.mjs`        |
| 重型 vendor chunk（gzip）         | ≤ 400KB                  | 同上，白名单见脚本 `HEAVY_VENDORS`     |

"重型 vendor" 白名单（与 `frontend/vite.config.ts` manualChunks 保持一致）：

- `vendor-pdfjs`
- `vendor-three`
- `vendor-hls`
- `vendor-sentry`
- `vendor-zip`

**扩充白名单必须**：在本文件记录 chunk 名、超预算的业务原因、可否通过 dynamic import 降级，再更新脚本常量。

## 3. 工具版本基线

| 工具              | 版本基线 | 锁定位置                   |
| ----------------- | -------- | -------------------------- |
| `cargo-llvm-cov`  | 0.8.x    | `ci.yml` / taiki-e install |
| `cargo-audit`     | 0.22.x   | 同上                       |
| `cargo-outdated`  | 0.19.x   | 同上                       |
| `codecov-action`  | v4       | 同上                       |
| Rust toolchain    | stable   | `dtolnay/rust-toolchain`   |
| Node              | 22       | `setup-node`               |

升级工具版本视为"变更工具链"，需要单独 PR，附带一次完整绿色流水线证据。

## 4. 本地等价命令（调试用）

```bash
# Backend
cd backend
cargo fmt --all -- --check
cargo clippy --all-targets --all-features -- -D warnings
cargo llvm-cov --all-features --workspace --lcov --output-path lcov.info --fail-under-lines 23
cargo audit --deny warnings
RUSTDOCFLAGS="-D warnings" cargo doc --no-deps --document-private-items --all-features

# Frontend
cd frontend
npm ci
npm run lint
npx tsc -b --noEmit
npm run test
npm run build
node scripts/check-bundle-size.mjs
```

## 5. 需要的仓库 Secrets

- `CODECOV_TOKEN`（可选：公开仓库可以省略；失败时 `fail_ci_if_error: false`，不阻塞合并）

## 6. 未来扩展（记录，不自动执行）

- E2E（Playwright）job：待 headless 环境稳定后加入，阈值定 P95 ≤ 30s。
- SBOM：引入 `cargo cyclonedx` + `cyclonedx-bom` 供应链物料清单。
- Container scan：Docker 镜像合并前跑 `trivy image`。
