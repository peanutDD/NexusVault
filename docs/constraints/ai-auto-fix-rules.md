# AI 自动修复永久约束 (Codex-Fix-Constraints)

版本：v1.0 | 最后更新：2026-04-21

## 1. 决策边界 (Decision Boundaries)
1. **优先级限制**: 严禁修复 `Low` 级别问题。AI 必须将精力集中在影响架构稳定性或安全性的 `Medium` 及以上问题。
2. **文件黑名单**:
    - 禁止修改锁文件: `Cargo.lock`, `package-lock.json`, `bun.lock`, `pnpm-lock.yaml`。
    - 禁止修改敏感配置: `.env`, `*.secret`, `config/*.yaml`。
    - 禁止修改非代码文件: `docs/*`, `*.md`, `LICENSE`, `.gitignore`。
3. **架构铁律同步**: 修复后的代码必须符合 `AGENTS.md` 中的 15 条黄金规则。

## 2. 操作安全 (Operational Safety)
1. **Git 隔离**: 所有自动修复必须在独立的临时补丁中尝试应用，失败则立即回滚，严禁强制推送 (`push -f`)。
2. **Commit 规范**: 所有自动修复的提交必须包含 `[skip ci]` 前缀，以防止触发非必要的 CI 管道循环。
3. **轮次上限**: 单个 PR 的自动修复轮次严禁超过 `MAX_ROUNDS` (默认为 2)，防止 LLM 陷入无效的自纠缠循环。

## 3. 情报处理 (Intelligence Handling)
1. **JSON 强制性**: `read_gemini_review` 必须在 `json_mode` 下运行，且 `temperature` 设为 0。
2. **溯源要求**: 每个生成的补丁必须在解析阶段保留 Gemini 的 `reason` 片段，确保修复动机可追溯。
