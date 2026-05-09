# Exec-Plan: AutoFix 补丁可靠性根治（SEARCH/REPLACE Block 化 + 衍生问题修复）

- **计划编号**: AFPR-001
- **日期**: 2026-05-09
- **作者**: Corust AI（人类批准后执行）
- **关联**: PR #26 自动修复失败日志（`backend/src/services/file/delete.rs` 多次 `corrupt patch`）
- **影响范围**: `scripts/codex-cli/`（不涉及业务后端/前端代码）
- **预计工时**: 1.5 ~ 2 个工作日
- **遵循**: `AGENTS.md` 15 条黄金规则、`CLAUDE.md` Hook 自迭代机制

---

## 1. 目标 / 非目标

### 1.1 目标（Must）

| ID | 目标 | 验证方式 |
|----|------|---------|
| G1 | 引入 **SEARCH/REPLACE Block** 作为 LLM 主修复格式，替代 unified diff | 单测 + 集成测试 BatchFix 成功率 ≥ 95% |
| G2 | 保留 unified diff 作为 **次要兼容路径**（自动检测） | 双格式测试用例同时通过 |
| G3 | 修复「兜底其实仍走 diff」的 bug：`apply_full_file_fallback` 优先走 SEARCH/REPLACE，再走整文件覆写 | 单测覆盖三层兜底序列 |
| G4 | 失败短路：当 `fixed_files` 为空时，**跳过** SecurityCheck / QualityScore / Documentation，避免 42 分误导 | 集成测试断言 skip 行为 |
| G5 | `git push` 重试覆盖范围扩大到 Feedback 阶段所有远程 git 操作（含 `gh pr comment`） | 注入网络故障的集成测试 |

### 1.2 非目标（Won't）

- ❌ 不重构 Skill Pipeline 编排顺序（仍是 `ReadReview → Decision → BatchFix → Security → Score → Doc → Feedback`）
- ❌ 不改 LLM provider / model 选择
- ❌ 不修改 Gemini Review 解析逻辑（`review_json.rs` 不动）
- ❌ 不引入新 crate 重型依赖（仅允许标准库 / 已有依赖）
- ❌ 不调整业务后端代码（`backend/`、`frontend/` 完全不动）

---

## 2. 假设 / 风险

### 2.1 假设

1. **A1**: Gemini Review JSON schema 当前稳定，`ReviewIssue.file` 字段总是相对仓库根的 POSIX 路径
2. **A2**: 大模型在被明确要求"输出 SEARCH/REPLACE block"时，比"输出 unified diff"稳定度高至少 1 个数量级（参考 Aider 公开 benchmark：97.5% vs 60%）
3. **A3**: `ctx.repo_root` 中的目标文件已被 `git` 跟踪（`apply_full_file_fallback` 现状假设亦如此）
4. **A4**: SEARCH 块在文件中**唯一匹配**的概率，对 < 2000 行文件 ≥ 99%（失败时降级到完整文件覆写）

### 2.2 风险与缓解

| 风险 | 等级 | 缓解 |
|------|------|------|
| LLM 输出 SEARCH 块在源文件中**多次匹配**（歧义） | 中 | 检测到多匹配时自动重试，要求 LLM 扩展 SEARCH 块上下文（前后各加 ≥3 行） |
| LLM 输出 SEARCH 块**零匹配**（drift / 行尾差异 / 缩进） | 中 | 三级匹配策略：`exact → trim_trailing_whitespace → normalize_indent` |
| 现有 unified diff 调用方（测试 / CLI 用户脚本）被破坏 | 低 | 保留 `apply_patch_with_details_in` 公共 API；新增 `apply_search_replace_in` 并存 |
| Prompt 改动后回归别的 issue 类型 | 中 | 新增黄金集（5 个历史失败 PR diff）做 snapshot 测试 |
| 短路逻辑误伤（合法 0 修复也被跳过） | 低 | 仅当 `selected_issues.len() > 0 && fixed_files.len() == 0` 时短路；零 issue 时正常跳过 BatchFix 即可 |
| `git push` 重试期间多次提交导致 PR 评论刷屏 | 低 | 重试在**同一次** `gh pr comment` 调用层包裹，幂等性由 GitHub 自身保证（同 body 不去重，需在 retry 内做 `--edit-last` 或 `idempotency_key`） |

---

## 3. 依赖

### 3.1 外部工具

- `git` ≥ 2.30（已在 CI runner / dev 容器中）
- `gh` CLI（已在 CI 中）
- `cargo` 工具链（项目已固定 `rust-toolchain.toml`）

### 3.2 环境变量（新增 / 复用）

| 变量 | 含义 | 默认 |
|------|------|------|
| `CODEX_PATCH_FORMAT` | 强制格式：`auto` / `search_replace` / `unified_diff` | `auto` |
| `CODEX_SR_MAX_BLOCKS` | 单 issue 最多 SEARCH/REPLACE block 数 | `5` |
| `CODEX_SR_FUZZY_MATCH` | 是否启用模糊匹配（trim/normalize indent） | `true` |
| `CODEX_FULL_FILE_FALLBACK_ALLOWED_PREFIXES` | （已有）整文件兜底白名单 | 不变 |
| `CODEX_PROTECTED_FILES` | （已有）整文件兜底黑名单 | 不变 |

### 3.3 内部依赖（不新增 crate）

- `std::process::Command`（已用）
- `serde` / `serde_json`（已用）
- 不引入 `regex` 之外的新文本处理库（项目已有）

---

## 4. 架构变更

### 4.1 新增模块

```
scripts/codex-cli/src/
├── repo.rs                         # 已有：apply_patch_with_details_in 保留
├── patch/                          # 🆕 新增子模块
│   ├── mod.rs                      # 统一入口 PatchFormat 枚举 + apply()
│   ├── search_replace.rs           # 🆕 SEARCH/REPLACE block 解析与应用
│   └── unified_diff.rs             # 🆕 把 repo.rs 中 diff 相关函数迁入（保 API）
└── skills.rs                       # 修改：BatchFix 改用 patch::apply
```

> 迁移采用 re-export，repo.rs 保留 `pub use patch::unified_diff::*` 以向后兼容。

### 4.2 SEARCH/REPLACE Block 语法（项目内规范）

```
<<<<<<< SEARCH
原代码（必须与文件中某一段精确或模糊匹配）
=======
新代码（替换内容；若为空则等于删除）
>>>>>>> REPLACE
```

**规则**：
1. 文件路径由 LLM 在 block **之前**用 `### File: <path>` 单独声明，避免内嵌歧义
2. 一个响应里允许多个 block，但只能针对 `selected_issues[i].file` 这**一个文件**
3. SEARCH 块为空 → 视为"在文件末尾追加"
4. REPLACE 块为空 → 视为"删除 SEARCH 块"
5. 三级匹配：
   - **L1**: 字节级精确匹配（最多 1 次）
   - **L2**: 行级 `trim_end()` 后匹配
   - **L3**: 行级 `dedent + trim_end()` 后匹配（同一文件内缩进归一化）
   - 若 L3 仍 0 匹配或 ≥2 匹配 → 返回 `MatchAmbiguous` / `MatchNotFound` 错误

### 4.3 BatchFix 失败链路（修复后）

```
LLM 输出（auto-detect format）
  ├─ 检测到 <<<<<<< SEARCH → patch::search_replace::apply
  │     ↓ 失败
  │     ↓ 重试 1 次（要求扩展上下文 ≥3 行）
  │     ↓ 仍失败
  └─ 检测到 diff --git → patch::unified_diff::apply
         ↓ 失败
         ↓ 重试 1 次
         ↓ 仍失败
              ↓
       apply_full_file_fallback
         ├─ 优先用 SR block 完整重写（更可控）
         └─ 兜底：输出整文件内容（现状）
```

### 4.4 失败短路决策表（新）

| `selected_issues` | `fixed_files` | SecurityCheck | QualityScore | Documentation | Feedback |
|-------------------|---------------|---------------|--------------|---------------|----------|
| 0 | 0 | skip | skip | skip | run（汇报 0 修复） |
| >0 | 0 | **skip** | **skip** | **skip** | run（汇报失败原因） |
| >0 | >0 | run | run | run | run |

---

## 5. 任务拆分（TDD 顺序，每步独立可提交）

> **铁律**：每个任务先写测试 → 失败 → 实现 → 通过 → fmt+clippy+test 全绿 → 单独提交。

### Phase 1: 模块脚手架与契约（半天）

- [ ] **T1.1** 新建 `patch::PatchFormat` 枚举与 `Patch` trait
  - 测试：`patch_format_detection_test`（5 个用例：纯 SR / 纯 diff / 混合 / 空 / 噪声）
  - 实现：`mod.rs` 中 `detect_format(text: &str) -> PatchFormat`
  - 验收：`cargo test patch_format_detection_test`

- [ ] **T1.2** 迁移 unified_diff 实现到 `patch/unified_diff.rs`
  - 测试：原 `repo.rs` 中所有 `apply_patch_*` 测试**直接复制并通过**（路径变更不算回归）
  - 实现：`pub use` re-export 保留向后兼容
  - 验收：`cargo test --all` 全绿

### Phase 2: SEARCH/REPLACE 核心（1 天）

- [ ] **T2.1** SR Block 解析器（含语法校验）
  - 测试 `sr_parser_test.rs`：
    - 单 block / 多 block / 空 SEARCH / 空 REPLACE
    - 缺少分隔符（`=======` / `>>>>>>> REPLACE`）→ 明确错误
    - `### File:` 与 `Allowed file` 不一致 → 拒绝
    - block 数 > `CODEX_SR_MAX_BLOCKS` → 拒绝
  - 实现：`SearchReplaceParser::parse(text, allowed_file) -> Result<Vec<Block>, ParseError>`

- [ ] **T2.2** 三级匹配引擎
  - 测试 `sr_match_test.rs`：
    - L1 精确单匹配 → 成功
    - L1 多匹配 → `MatchAmbiguous`
    - L1 零匹配 / L2 单匹配 → 成功（标记降级）
    - L3 单匹配 → 成功（标记降级 +warning）
    - L3 仍 0 匹配 → `MatchNotFound`
  - 实现：`MatchEngine::find(haystack, needle) -> MatchOutcome`

- [ ] **T2.3** 应用器
  - 测试 `sr_apply_test.rs`（用 tempdir + 真实文件 IO）：
    - 单 block 替换持久化
    - 多 block 顺序无关（按文件偏移自动排序）
    - block 之间相互重叠 → 拒绝（避免互相覆盖）
    - 空 SEARCH → 末尾追加
    - 空 REPLACE → 等价删除
  - 实现：`apply_search_replace_in(repo_root, file, blocks) -> Result<ApplyOutcome>`

### Phase 3: Prompt 与 LLM 集成（半天）

- [ ] **T3.1** 新增 `prompts::search_replace_system_prompt()`
  - 测试：snapshot 测试，确保关键约束句存在（`Allowed file`、`### File:`、`<<<<<<< SEARCH`、`max blocks`）
  - 内容要点：
    - 强制使用 SR block，禁止 unified diff
    - 强制 `### File: <exact path>` 头
    - 单文件唯一性、上下文 ≥3 行（含义稳定）
    - 失败重试 prompt 携带 `match_reason`（ambiguous / not_found）

- [ ] **T3.2** 改写 `generate_fix_patch` / `generate_retry_fix_patch`
  - 测试：mock LLM client（已有 `MockCodexClient` 模式？若无则在 `tests/` 下加 trait 桩）
  - 实现：根据 `CODEX_PATCH_FORMAT` 决定走 SR / diff，默认 `auto = SR 优先`
  - 兼容：保留旧函数签名作为 thin wrapper，标记 `#[deprecated]`

### Phase 4: BatchFix 编排修复（半天）

- [ ] **T4.1** 改造 `BatchFixSkill::execute` 走新 `patch::apply` 入口
  - 测试 `batch_fix_pipeline_test.rs`（覆盖三层兜底序列）：
    - SR 一次成功 → `fixed_files.len() == 1`，无 fallback
    - SR 失败 + diff 成功 → `fix_attempts` 含降级标记
    - SR 失败 + diff 失败 + 整文件兜底成功
    - 全部失败 → `fixed_files.is_empty()` 且 `fix_attempts` 完整记录
  - 实现：将现有重试 / 兜底分支统一进 `patch::apply` 内部

- [ ] **T4.2** 修复 `apply_full_file_fallback` 走"整文件 SR" 优先
  - 测试：兜底单测中验证调用顺序（SR-fullfile → raw-fullfile）
  - 实现：新增 `generate_replacement_via_sr_block` helper，失败再用 `generate_replacement_file`

### Phase 5: 衍生问题修复（半天）

- [ ] **T5.1** 失败短路逻辑
  - 测试 `pipeline_short_circuit_test.rs`：
    - `selected=3, fixed=0` → SecurityCheck / QualityScore / Documentation 全 skip
    - `selected=3, fixed=2` → 三者都跑
    - `selected=0` → 现有行为保持
  - 实现：`pipeline.rs` 在执行 Skill 前用 `should_skip_post_fix(&ctx)` 判断

- [ ] **T5.2** Push retry 覆盖扩大
  - 测试：用 `Command::env("PATH", fake_git_dir)` 注入失败 git → 验证 retry 次数
  - 实现：抽 `git_with_retry(args)` helper，替换 `commit_and_push_in` / Feedback 阶段所有 `git`/`gh` 远程操作
  - 重点：`gh pr comment` 失败时，根据 stderr 判断是网络（重试）还是权限（直接失败）

- [ ] **T5.3** Empty reply from server 专用诊断
  - 测试：注入 `Empty reply from server` stderr → retry 提示中包含「网络抖动，已重试 N/3」
  - 实现：`classify_git_network_error` 新分类

### Phase 6: 黄金集回归 + 文档（半天）

- [ ] **T6.1** 黄金集（golden tests）
  - 数据：`scripts/codex-cli/tests/fixtures/golden/`
    - 5 个真实历史失败的 (review_issue, source_file) 对（脱敏）
  - 测试：mock LLM 返回 SR 块，断言修复后文件 hash 与预期一致
  - 验收：5/5 全绿

- [ ] **T6.2** 文档
  - `scripts/codex-cli/docs/architecture.md`：补 §「补丁应用策略」
  - `scripts/codex-cli/docs/troubleshooting.md`：新增 §「BatchFix 失败排查」
  - `scripts/codex-cli/docs/configuration.md`：补 `CODEX_PATCH_FORMAT` 等新变量
  - `scripts/codex-cli/AGENTS.md`：在 §「Skills 概览」下加 SR 链路说明
  - `docs/quality-score.md`：本任务结束追加分数 ≥ 95 的记录

- [ ] **T6.3** 更新 `docs/constraints/`
  - 新增 `constraints/codex-cli-patch-format.md`：永久约束「禁止再让 LLM 直接产 unified diff 作为主路径」
  - 防止下次倒退

---

## 6. 验收标准（CI 卡口）

PR 合并前以下**全部**为绿：

1. ✅ `cd scripts/codex-cli && cargo fmt --all -- --check`
2. ✅ `cd scripts/codex-cli && cargo clippy --all-targets --all-features -- -D warnings`
3. ✅ `cd scripts/codex-cli && cargo test --all`
4. ✅ 新增的 `tests/batch_fix_pipeline_test.rs` 覆盖率 ≥ 90%（用 `cargo llvm-cov` 验证）
5. ✅ 黄金集 5/5 通过（mock LLM 模式）
6. ✅ 在 PR #26 同样的 review JSON 上**端到端 dry-run**：成功修复 ≥ 1 个 issue（之前 0 个）
7. ✅ LLM Judge 对前后对比打分 ≥ 95（CLAUDE.md 自审铁律）
8. ✅ `docs/quality-score.md` 已更新

---

## 7. 回滚预案（AGENTS.md §14）

每个 Phase 单独 commit，遇到以下任一信号立即 `git revert`：

- 黄金集回归 ≥1 用例失败
- `cargo test --all` 出现新失败
- 端到端 dry-run 修复成功率 < 50%
- LLM Judge 打分 < 90

回滚后必须在 `docs/constraints/` 写入"为何此方向不可行"的 ADR，避免重复踩坑。

---

## 8. 不引入的反模式（自我约束）

- ❌ 不写"全能 patch 解析器"（只支持本项目自定义的 SR 语法 + 标准 unified diff，不啃 darcs / mercurial 格式）
- ❌ 不引入 `regex` 之外的解析库（手写状态机即可，<200 行）
- ❌ 不在 SR block 内做语义级 AST 改写（容易破坏 Rust 宏 / 注释）
- ❌ 不改 Gemini Review 数据契约（向后兼容）

---

## 9. 时间估算

| Phase | 预计 | 关键路径 |
|-------|------|---------|
| P1 脚手架 | 0.5 天 | T1.2 迁移测试需小心 |
| P2 SR 核心 | 1 天 | T2.2 匹配引擎是难点 |
| P3 Prompt | 0.5 天 | 需要好的 mock client |
| P4 BatchFix | 0.5 天 | 编排测试 |
| P5 衍生 | 0.5 天 | 网络故障注入测试 |
| P6 黄金集+文档 | 0.5 天 | |
| **总计** | **3.5 天**（实际可压缩到 2 天） | |

---

## 10. 人类批准点（强制）

按 AGENTS.md 「人类掌舵」原则，以下时刻**必须**等待人类签字：

1. **本计划本身**（你正在读的这份文件）
2. Phase 2 完成后（SR 核心已成形）：人类抽查 SR block 语法是否符合直觉
3. Phase 4 完成后（BatchFix 集成）：人类审视前后对比视频
4. 最终 PR：人类批准后才合并

中间过程（Phase 1/3/5/6）Agent 自主执行，但每步必须 commit + CI 全绿。

---

## 11. 后续展望（不在本 PR 范围）

- 把 SR 引擎抽成独立 crate，供其他项目复用
- 引入 `tree-sitter` 做语法感知匹配（只在 L3 失败时启用）
- LLM Judge 自动学习失败案例，回填到 prompt few-shot

---

**计划状态**: 🟡 待人类批准
**批准人**: ____________________
**批准时间**: ____________________
