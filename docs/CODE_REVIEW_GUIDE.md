# 代码审查方案（企业级）

本文档为本项目的**代码审查规范**，供 MR/PR 与日常审查使用。若技术栈或 `.cursor/rules` / `ENGINEERING_PLAYBOOK` 发生变更，需同步更新本方案。

---

## 目录

1. [总则](#1-总则)
2. [审查流程与角色](#2-审查流程与角色)
3. [通用检查项](#3-通用检查项)
4. [后端（Rust）审查清单](#4-后端rust审查清单)
5. [前端（React/TypeScript）审查清单](#5-前端reacttypescript审查清单)
6. [API 与契约](#6-api与契约)
7. [数据库与迁移](#7-数据库与迁移)
8. [安全专项](#8-安全专项)
9. [性能与可观测性](#9-性能与可观测性)
10. [工具与自动化](#10-工具与自动化)
11. [附录](#11-附录)
12. [开始使用](#12-开始使用)
13. [操作指南](#13-操作指南)
14. [审查报告模板](#14-审查报告模板)

---

## 1. 总则

### 1.1 目的

- 保证合入代码在**可维护性、安全性、性能与一致性**上符合项目标准。
- 为审查人与作者提供可执行的检查清单，减少遗漏与主观分歧。
- 便于新人 onboarding 与长期规范统一。

### 1.2 适用范围

- 本仓库所有合入 `main` / `master` 的变更（含后端 Rust、前端 React/TypeScript、配置、迁移、脚本）。
- 技术栈与规范以当前仓库为准：后端 Axum/SQLx/PostgreSQL，前端 React 19/TypeScript/Zustand/shadcn/Tailwind。

### 1.3 原则

- **可维护性**：分层清晰、职责单一、命名与注释一致。
- **安全**：用户隔离（如 SQL 带 `user_id`）、输入校验、无敏感信息泄露。
- **性能**：流式 I/O、背压与限流、无 N+1、避免大对象进内存。
- **一致性**：与现有架构、错误格式、API 契约及 Cursor 规则一致。

---

## 2. 审查流程与角色

### 2.1 触发时机

- 所有发往 `main` / `master` 的 **Pull Request** 在合并前必须经过代码审查。
- Hotfix 或紧急修复可仅完成「必须」检查项并注明原因，事后补审或复盘。

### 2.2 审查人职责

- 按本方案中的**后端 / 前端 / API / 数据库 / 安全**等清单逐项检查（至少覆盖与变更相关的部分）。
- 对「必须」项不满足的，要求修改后再合；对「建议」项可提出意见但不强制阻塞。
- 在 PR 中明确标注：已检查的清单类别、以及是否 Approve。

### 2.3 合并前 Gates（必须同时满足）

- [ ] **CI 全部通过**：`.github/workflows/ci.yml` 中 Backend（fmt / clippy / test）与 Frontend（lint / test / build）均成功。
- [ ] **至少 1 人 Approve**（若团队有约定可改为 2 人）。
- [ ] **无未解决的讨论**：所有 Review 评论已回复或已修改。
- [ ] **无与目标分支的冲突**。

### 2.4 审查思维模型（避免机械勾选）

高质量审查不只「打勾」，建议顺序：

1. **影响面**：改动了谁被调用、谁受影响（接口、存储、前端路由）？
2. **数据流**：输入从哪来（query/body/header）、输出到哪去（DB/存储/响应）？边界与错误路径是否都处理了？
3. **再对照清单**：根据变更类型只重点看相关章节（见下文「按变更类型选审查路径」），对高风险点（安全、性能、破坏性 API）多看一眼。
4. **可操作反馈**：指出问题时尽量带「建议改法」或文档引用，便于作者直接改（见 2.6）。

### 2.5 按变更类型选审查路径

| 变更类型 | 建议重点章节 | 可略过或扫一眼 |
|----------|--------------|----------------|
| 仅后端某个 handler/接口 | §4 后端、§6 API、§8 安全 | §5 前端、§7 数据库 |
| 仅前端 UI/样式 | §5 前端（5.4/5.5）、§3 通用 | §4、§7 |
| 仅前端逻辑/状态 | §5 前端（5.1/5.2/5.3/5.7）、§3 | §4、§7 |
| 新增/修改迁移或 SQL | §7 数据库、§4.3 安全（user_id）、§4.4 性能（N+1/索引） | §5 |
| 认证/授权相关 | §4.3 安全、§8 安全、§4.1 架构（extractor） | §5 样式 |
| 上传/下载/存储 | §4.4 性能（流式、孤儿清理）、§4.3 安全、§5.8 (Web Worker)、PLAYBOOK §2/§3/§7/§11 | §5 |
| 全栈 feature | 按改动文件逐层过 §4 / §5 / §6 / §7 / §8 | — |

先用 `git diff main --name-only` 或 PR Files changed 看变更文件，再从上表选路径，可节省时间且不遗漏关键项。

### 2.6 Review 评论怎么写（可操作反馈）

- **差**：「这里要加 user_id。」  
- **好**：「这里建议加上 `AND user_id = $n` 条件，否则可能跨用户越权。见 [file-sql-user-scope](.cursor/rules/file-sql-user-scope.mdc) 正确示例。」

- **差**：「这样会有 N+1。」  
- **好**：「建议在 repo 里用一条带 `COUNT(*) OVER()` 的查询一次取列表+总数，避免两次 DB 往返。参考 `repositories/files.rs` 里 `list_files`。」

- **差**：「不要用 any。」  
- **好**：「这里用 `unknown` 更安全，再在分支里做类型收窄；或为接口补上类型定义。」

审查时尽量附上：**条款出处（本指南章节或 rule 链接）+ 建议改法或参考文件**，便于作者一次改对。

#### 自动修复友好的 Review 模板

需要交给 `codex-auto-fix` 自动处理的评论，优先使用下面的固定结构。每条评论只描述一个文件里的一个小范围问题，避免把命名、逻辑、重构混在同一条反馈里。

```markdown
- Severity: Medium
- File: src/example.rs
- Line: 42
- Rule: file-sql-user-scope
- Problem: 当前查询缺少 user_id 条件，可能跨用户读取数据。
- Expected: 在同一查询里增加 user_id 过滤，保持现有函数签名不变。
- Constraints:
  - only modify src/example.rs
  - no signature change
```

字段要求：

- `Severity` 必须使用 `Critical`、`High`、`Medium+`、`Medium`、`Low` 之一。
- `File` 必须是仓库相对路径，且单条评论只允许一个文件。
- `Line` 指向最接近问题的当前行号。
- `Problem` 写清楚实际风险，不写泛泛评价。
- `Expected` 写可执行的目标行为，不要求大重构。
- `Constraints` 写自动修复边界，例如禁止改签名、只改测试、只改当前文件。

### 2.7 审查优先级与耗时参考

| 优先级 | 含义 | 典型条款 |
|--------|------|----------|
| **P0** | 首次审查必看；不满足不得合并 | 安全（§4.3、§8）、认证（AuthenticatedUser）、user_id 隔离、参数化 SQL、敏感信息不落日志、CI 通过 |
| **P1** | 与本次变更强相关时必看 | 架构分层、错误处理、流式/N+1、破坏性 API、迁移 user_id/扩展依赖 |
| **P2** | 可按需或大改动时扫一眼 | 建议项、a11y、任意值、测试覆盖、OpenAPI 同步 |

**单次 PR 审查耗时参考**（在 CI 已通过前提下）：

- **小 PR**（≤5 个文件、单层改动）：约 10～15 分钟，重点 P0 + 变更路径对应 P1。
- **中 PR**（跨前后端或改 repo+service）：约 20～25 分钟，P0 全过 + 相关 §4/§5/§6/§7。
- **大 PR**（新 feature、迁移、重构）：约 30～45 分钟，按 §2.5 路径逐层过，P2 酌情扫。

---

## 3. 通用检查项

### 3.1 必须

- [ ] 提交信息清晰：能概括改动内容，必要时注明关联 Issue/PR。
- [ ] 变更范围与 PR 描述一致：不夹带无关文件或调试代码。
- [ ] 新增依赖合理：无重复或可替代的已有依赖；版本范围明确。

### 3.2 建议

- [ ] 分支命名与提交信息符合团队约定（如 `feat/`、`fix/`、`docs/`）。
- [ ] 公共接口或复杂逻辑有注释或文档补充。
- [ ] 若引入新依赖，确认许可证与项目兼容（若团队有要求）。

---

## 4. 后端（Rust）审查清单

以下与 [.cursor/skills/backend-tech-stack/SKILL.md](.cursor/skills/backend-tech-stack/SKILL.md)、[backend/docs/ENGINEERING_PLAYBOOK.md](backend/docs/ENGINEERING_PLAYBOOK.md)、[backend/docs/BACKEND_TECH_STACK_AUDIT.md](backend/docs/BACKEND_TECH_STACK_AUDIT.md) 对齐。

### 4.1 架构与分层

| 检查项 | 必须/建议 | 说明 |
|--------|-----------|------|
| Handlers 仅做 HTTP：参数解析、鉴权 extractor、调用 Service、构建响应/流式 body | **必须** | 禁止在 handler 内写业务 SQL 或复杂业务逻辑。参考 `src/handlers/files/` 下各模块。 |
| 业务逻辑在 Service 层 | **必须** | 编排、校验、跨步骤流程在 `src/services/`，不直接写 SQL。 |
| 数据访问在 Repository 层 | **必须** | 新增 SQL 优先放在 `src/repositories/`，Service 通过 repo 调用；仅极少数跨 repo 事务可在 service 内写 SQL 并注释说明。 |
| 使用 `Extension` 注入 PgPool、Config、Storage 等 | **必须** | 禁止全局可变状态。 |
| 需认证的接口使用 `AuthenticatedUser` 等 extractor | **必须** | 见 `src/extractors/auth.rs`。 |

### 4.2 错误处理

| 检查项 | 必须/建议 | 说明 |
|--------|-----------|------|
| 使用 `AppError` 统一错误类型 | **必须** | 定义见 `src/utils/error.rs`；禁止在业务路径随意 `panic!` / `unwrap()`。 |
| 实现 `IntoResponse`，统一 HTTP 状态与 JSON 体 | **必须** | 用户可见消息友好，技术细节仅打日志。 |
| 错误传播使用 `?`，`Option` 配合 `.ok_or(AppError::NotFound)?` 等 | **必须** | 见 BACKEND_TECH_STACK_AUDIT 5.3。 |
| 业务逻辑中避免 `expect`/`unwrap` | **建议** | 启动阶段可保留 `expect`，但需清晰文案；见 BACKEND_TECH_STACK_AUDIT 18.1。 |

### 4.3 安全

| 检查项 | 必须/建议 | 说明 |
|--------|-----------|------|
| 文件相关 SQL 必须带 `user_id` 条件 | **必须** | 见 [.cursor/rules/file-sql-user-scope.mdc](.cursor/rules/file-sql-user-scope.mdc)。仅用 `file_id` 时，Service 层必须先做 `belongs_to_user` 或等效校验。 |
| folder 相关 helper（如 `delete_files_in_folders`）带 `user_id` 且仅在已按 user 过滤的上下文中调用 | **必须** | 同上 file-sql-user-scope。 |
| 输入校验：文件名清理、MIME、大小、存储配额 | **必须** | 见 `src/utils/validation.rs`、BACKEND_TECH_STACK_AUDIT 14。 |
| 参数化查询，禁止字符串拼接 SQL | **必须** | 动态条件使用 `sqlx::QueryBuilder` + `push_bind`。 |
| 敏感信息（密码、token、file_path）不写入日志 | **必须** | 见 `src/utils/error.rs` 设计原则。 |

**如何检查（实操提示）**：

- **user_id 隔离**：在 PR 的 `backend/src/repositories/*.rs` 和 `backend/migrations/*.sql` 里搜 `files`、`file_shares`、`folder`，看每条 SELECT/UPDATE/DELETE 是否带 `user_id` 或已有上层 `belongs_to_user`；仅 `file_id` 的调用链要追溯到 service 是否先校验归属。
- **认证覆盖**：新增或修改路由时，在 `backend/src/api/*.rs` 中确认该路由是否在「需登录」的 router 上；若为新增 handler，在对应 `handlers/` 文件中搜 `AuthenticatedUser`，确认参数列表中有 `AuthenticatedUser(user_id): AuthenticatedUser`。未使用则对应 §8 认证全覆盖未满足。
- **敏感信息不落日志**：在改动范围内搜 `tracing::`、`log::`、`println!`，确认没有对 `token`、`password`、`file_path`、`secret` 等做 `{:?}` 或 `{}` 输出。

### 4.4 性能与稳定性

| 检查项 | 必须/建议 | 说明 |
|--------|-----------|------|
| 上传/下载使用流式 I/O，避免整文件 `Vec<u8>` | **必须** | 普通上传流式落盘、分块合并流式；下载使用 `Body::from_stream`。见 ENGINEERING_PLAYBOOK §2、§3、§7。 |
| 热点路由有并发限制（ConcurrencyLimit + LoadShed） | **必须** | 见 `src/api/files.rs`（LIST/UPLOAD/CHUNK/COMPLETE 并发闸门）、PLAYBOOK §1。 |
| 落库失败时清理已写入的存储（孤儿文件） | **必须** | `create_file` / `create_file_from_path` 落库失败时 best-effort `storage.delete_file`。见 PLAYBOOK §11。 |
| 列表等查询使用单次往返（如 COUNT OVER()），避免 N+1 | **必须** | 见 `src/repositories/files.rs`、PLAYBOOK §5。 |
| 连接池与 statement_timeout 配置合理 | **必须** | `src/database/pool.rs`；列表等可设 `SET LOCAL statement_timeout`。见 PLAYBOOK §6。 |
| 限流有容量上限与 TTL，避免内存膨胀 | **必须** | 见 `src/middleware/rate_limit.rs`、PLAYBOOK §8。 |
| 大响应分页或流式返回 | **建议** | 列表分页、批量 ZIP 流式等见 PLAYBOOK §7、§7.0。 |

**如何检查（实操提示）**：看新增或改动的列表/批量接口：repo 里是否一次查询带 `COUNT(*) OVER()` 或等效，有无在循环内执行查询（N+1）；上传/下载路径是否用流式（`Body::from_stream`、`save_file_from_path`、chunk 合并写临时文件而非整文件 `Vec<u8>`）。

### 4.5 测试与工具

| 检查项 | 必须/建议 | 说明 |
|--------|-----------|------|
| `cargo fmt --all -- --check` 通过 | **必须** | 与 CI 一致。 |
| `cargo clippy --all-targets --all-features -- -D warnings` 通过 | **必须** | 与 CI 一致。 |
| `cargo test --all-features` 通过 | **必须** | 与 CI 一致。 |
| 关键路径有单元或集成测试 | **建议** | 可配合 `sqlx::test` 做 DB 集成测试。 |

**常见陷阱与易漏项**：在热路径里对大结构体无谓 `clone`；新 handler 未用 `AuthenticatedUser` 导致接口裸奔；新增 SQL 用字符串拼接或 `format!` 而非 `push_bind`；日志里误打 `{:?}` 把 token 或 path 打出去；新增路由未考虑并发与限流（是否需加 ConcurrencyLimit）。

---

## 5. 前端（React/TypeScript）审查清单

以下与 [.cursor/rules/](.cursor/rules/) 中 React、TypeScript、Zustand、shadcn、Tailwind 规则对齐；细则见对应 rule 文件。

### 5.1 组件与 Hooks (React 19)

| 检查项 | 必须/建议 | 说明 |
|--------|-----------|------|
| 使用函数式组件与 Hooks | **必须** | 详见 `.cursor/rules/React.mdc`。 |
| 需要 ref 时直接作为 prop 传递 | **必须** | React 19 推荐，不滥用 `forwardRef`。 |
| 并发异步调用避免 Waterfall | **必须** | 使用 `Promise.all` 或 TanStack Query 并行查询，避免串行 `await` 阻塞渲染。 |
| 表单优先使用 Action / `useActionState` | **建议** | React 19 模式。 |
| 避免在 Effect 中直接 setState | **必须** | 若必须在 Effect 中同步状态，使用 `queueMicrotask` 包装以避免级联渲染。 |

### 5.2 数据请求（TanStack Query）

| 检查项 | 必须/建议 | 说明 |
|--------|-----------|------|
| 使用 TanStack Query 统一数据请求 | **必须** | 替换自定义 SWR 逻辑，利用其自动缓存、去重与重试。 |
| 列表接口使用 `useInfiniteQuery` | **必须** | 实现无限滚动分页，避免一次性加载大数据集。 |
| 变更操作使用 `useMutation` 并处理 `onSuccess` | **必须** | 确保数据一致性，避免手动维护冗余状态。 |
| 错误处理集成 | **必须** | 结合 `isError` 与全局 ErrorBoundary。 |

### 5.3 状态管理（Zustand & 派生状态）

| 检查项 | 必须/建议 | 说明 |
|--------|-----------|------|
| 使用 selectors 细粒度订阅 | **必须** | 详见 `.cursor/rules/Zustand.mdc`，避免整 store 导致无关重渲染。 |
| 优先使用派生状态（Derived State） | **必须** | 避免冗余的 `useState`；根据现有 props/state 计算出的值不应存入 state。 |
| 复杂客户端状态用 Zustand | **建议** | 避免 Context 嵌套过深。 |

### 5.4 UI（shadcn / 可访问性）

| 检查项 | 必须/建议 | 说明 |
|--------|-----------|------|
| 新增 shadcn 组件通过 CLI 安装 | **必须** | 统一放在 `components/ui`，详见 `.cursor/rules/shadcn.mdc`。 |
| 类名合并使用 `cn()` | **必须** | clsx + tailwind-merge。 |
| 不移除 Radix 的 `aria-*` 与键盘导航 | **必须** | 保证可访问性。 |
| 图标优先使用 `lucide-react` | **建议** | 保持风格统一。 |

### 5.5 样式（Tailwind CSS）

| 检查项 | 必须/建议 | 说明 |
|--------|-----------|------|
| 移动优先响应式设计 | **必须** | 默认移动端，再用 `sm:`/`md:`/`lg:` 覆盖。 |
| 动态类名用 `clsx`/`tailwind-merge` | **必须** | 详见 `.cursor/rules/Tailwind.mdc`。 |
| 避免任意值（如 `w-[123px]`） | **建议** | 优先使用 Tailwind 设计 token。 |

### 5.6 性能与 Bundle 优化（Vercel Best Practices）

| 检查项 | 必须/建议 | 说明 |
|--------|-----------|------|
| 禁止使用 Barrel Files (index.ts) | **必须** | 直接导入具体文件，提高 HMR 速度并优化 Tree-shaking。 |
| 重型组件使用 `React.lazy` 动态导入 | **必须** | 如 PDF、Markdown 预览，减小初始 Bundle 体积。 |
| 耗时计算移至 Web Worker | **必须** | 如 SHA-256 计算，避免阻塞 UI 主线程。 |
| 长列表使用虚拟滚动 | **必须** | 见 `@tanstack/react-virtual`，防止 DOM 节点过多。 |

### 5.7 类型安全（TypeScript）

| 检查项 | 必须/建议 | 说明 |
|--------|-----------|------|
| 对象用 interface，联合/映射用 type | **必须** | 详见 `.cursor/rules/TypeScript.mdc`。 |
| 禁止 `any`，未知类型用 `unknown` | **必须** | 见 TypeScript rule。 |
| 严格 TS 配置 | **必须** | 与 `tsconfig` 一致，无隐式 any。 |

### 5.8 测试与工具

| 检查项 | 必须/建议 | 说明 |
|--------|-----------|------|
| `npm run lint` 通过 | **必须** | 与 CI 一致。 |
| `npm run build` 通过（含 `tsc -b`） | **必须** | 与 CI 一致。 |
| `npm run test` 通过 | **必须** | 与 CI 一致。 |
| 关键交互有测试 | **建议** | 如列表、上传、表单提交等。 |

**常见陷阱与易漏项**：长列表未做虚拟滚动（如 `@tanstack/react-virtual`）导致 DOM 过多；新增接口/表单未处理 loading / error 状态与空数据；可聚焦/可操作控件缺少键盘可访问或 `aria-*`；在 effect 里直接 setState 导致多余请求或循环依赖。

---

## 6. API 与契约

| 检查项 | 必须/建议 | 说明 |
|--------|-----------|------|
| REST 风格、动词与资源命名一致 | **必须** | 与现有 `api/` 路由风格一致。 |
| 错误响应格式统一：如 `{ error, message, code, timestamp }` | **必须** | 见 `src/utils/error.rs` 的 `IntoResponse`。 |
| 破坏性变更（路径/字段/语义变更）在 PR 中明确标注并与前端/调用方沟通 | **必须** | 必要时同步 OpenAPI。 |
| OpenAPI 与实现同步 | **建议** | 见 `src/api/openapi.rs`；新增接口时更新 `utoipa` 注解与 `ApiDoc`。 |

---

## 7. 数据库与迁移

| 检查项 | 必须/建议 | 说明 |
|--------|-----------|------|
| 新增/修改的 SQL 符合 user_id 隔离规范 | **必须** | 见 [.cursor/rules/file-sql-user-scope.mdc](.cursor/rules/file-sql-user-scope.mdc)；审查时逐条检查 files / file_shares / folder 相关语句。 |
| 迁移可逆或团队约定可接受（若要求可逆，需提供 down） | **建议** | 视团队策略。 |
| 无未沟通的破坏性 DDL（如删列、改类型） | **必须** | 大表变更需评估锁与停机。 |
| 新增索引与查询模式匹配，避免冗余索引 | **建议** | 见 PLAYBOOK、`migrations/` 中 013、016。 |
| 依赖 PostgreSQL 扩展（如 pgvector）时，在 README 或部署文档中声明 | **必须** | 避免迁移报错「extension "xxx" is not available」。 |

**如何检查（实操提示）**：审查迁移时在 PR 的 `backend/migrations/*.sql` 中搜 `CREATE EXTENSION`、`vector`、`pg_` 等，若有则确认 README 或 `backend/.env.example` / 部署文档中已说明该扩展及安装方式。搜 `DELETE FROM files`、`UPDATE files`、`SELECT.*FROM files` 确保带 `user_id` 条件（或仅在 migration 中建表/加列，不直接操作多租户数据）。

---

## 8. 安全专项

| 检查项 | 必须/建议 | 说明 |
|--------|-----------|------|
| 认证/授权路径全覆盖 | **必须** | 需登录的接口均使用 `AuthenticatedUser` 或等效；分享等按业务校验。 |
| 敏感数据不落日志、不写入响应体 | **必须** | 密码、token、完整 file_path 等。 |
| 依赖无已知高危漏洞 | **建议** | 可定期运行 `cargo audit`（后端）、`npm audit`（前端），在 CI 或本地执行。 |
| 前端不信任用户输入渲染 HTML（XSS） | **必须** | 用户可控内容若需富文本，用白名单/安全库（如 react-markdown 配置妥当）；避免 `dangerouslySetInnerHTML` 直接插未过滤内容。 |
| 写操作与敏感操作考虑 CSRF/重放 | **建议** | 当前若依赖 SameSite cookie 与 JWT/API Token，可接受；若后续加表单或 cookie 态，需评估 CSRF 防护。 |

---

## 9. 性能与可观测性

| 检查项 | 必须/建议 | 说明 |
|--------|-----------|------|
| 关键接口有 tracing/日志（请求入参/结果/错误） | **建议** | 见 `src/middleware/request_log.rs`、`tracing::*`。 |
| 无 N+1 查询（列表、批量操作等） | **必须** | 见后端 §4.4、PLAYBOOK §5。 |
| 大列表/大响应使用分页或流式 | **必须** | 见后端 §4.4、PLAYBOOK。 |

---

## 10. 工具与自动化

| 项目 | 说明 |
|------|------|
| CI 与审查关系 | 合并前必须通过 [.github/workflows/ci.yml](.github/workflows/ci.yml)：Backend 的 `cargo fmt`、`cargo clippy`、`cargo test`；Frontend 的 `npm run lint`、`npm run test`、`npm run build`。审查人可要求「在 CI 通过基础上再查本指南」。 |
| Pre-commit（可选） | 可配置 `cargo fmt`、`cargo clippy`、`npm run lint` 等在本地 pre-commit 运行，减少 CI 失败轮次。 |
| PR 模板 | 使用 [.github/PULL_REQUEST_TEMPLATE.md](.github/PULL_REQUEST_TEMPLATE.md)，勾选本次变更涉及的审查类别并附本指南链接。 |

### 10.1 清单与 Lint/CI 的对应关系

CI 或 Lint 未通过时，可对应到本指南条款，便于作者定向修改：

| 工具 / 步骤 | 失败现象 | 对应本指南条款 |
|-------------|----------|----------------|
| `cargo fmt --check` | 格式不一致 | §4.5 工具 |
| `cargo clippy` | `clippy::unwrap_used` / `expect_used` | §4.2 业务逻辑避免 unwrap、§4.5 |
| `cargo clippy` | 其他 `clippy::*`（如 large_enum_variant、clone_on_ref_ptr） | §4.1/§4.4 性能与结构 |
| `cargo test` | 测试失败 | §4.5 关键路径测试 |
| `npm run lint` | `@typescript-eslint/no-explicit-any` | §5.2 禁止 any |
| `npm run lint` | `react-hooks/*` | §5.1 组件与 Hooks |
| `npm run build` | TS 或构建错误 | §5.2 严格 TS、§5.6 |
| `npm run test` | 前端测试失败 | §5.6 测试 |

本地快速自检（仅改后端时）：`cd backend && cargo fmt --all && cargo clippy --all-targets --all-features -- -D warnings`。仅改前端时：`cd frontend && npm run lint && npm run build`。

---

## 11. 附录

### 11.1 检查清单速查表（按角色勾选）

**后端变更时：**

- [ ] 架构：Handler 薄、Service/Repo 分层、Extension 注入、AuthenticatedUser。
- [ ] 错误：AppError、IntoResponse、`?` 传播、无业务 unwrap。
- [ ] 安全：文件 SQL 带 user_id、folder helper 带 user_id、输入校验、参数化、无敏感日志。
- [ ] 性能：流式 I/O、并发限制、孤儿文件清理、无 N+1、连接池/超时、限流有界。
- [ ] 工具：fmt、clippy、test 通过。

**前端变更时：**

- [ ] 组件：函数式、ref 直接传、无 Waterfall、Effect 无直接 setState。
- [ ] 请求：TanStack Query、useInfiniteQuery、useMutation 成功刷新。
- [ ] 状态：Zustand 选择器、优先使用派生状态。
- [ ] 性能：无 Barrel Files、重型组件 lazy 导入、耗时任务 Web Worker、虚拟滚动。
- [ ] 类型：interface/type、无 any、严格 TS。
- [ ] UI/样式：shadcn 规范、`cn()`、a11y、移动优先、设计 token。
- [ ] 工具：lint、build、test 通过。

**API/契约变更时：**

- [ ] REST 与错误格式一致；破坏性变更已标注并沟通；OpenAPI 已更新（若适用）。

**数据库/迁移变更时：**

- [ ] user_id 隔离；无未沟通破坏性 DDL；扩展依赖已文档化。

**安全相关：**

- [ ] 认证覆盖、敏感数据不泄露、依赖审计（建议）。

### 11.2 相关文档索引

| 文档 | 用途 |
|------|------|
| [backend/docs/ENGINEERING_PLAYBOOK.md](backend/docs/ENGINEERING_PLAYBOOK.md) | 后端性能、背压、流式、限流、DB 超时、孤儿清理等——审查「性能与稳定性」时直接引用其章节与代码位置。 |
| [backend/docs/BACKEND_TECH_STACK_AUDIT.md](backend/docs/BACKEND_TECH_STACK_AUDIT.md) | 后端合规基准，审查项与其中「状态」列一致。 |
| [.cursor/rules/file-sql-user-scope.mdc](.cursor/rules/file-sql-user-scope.mdc) | 文件相关 SQL 的 user_id 与 belongs_to_user 审查必选项。 |
| [.cursor/skills/backend-tech-stack/SKILL.md](.cursor/skills/backend-tech-stack/SKILL.md) | 后端推荐模式（路由、错误、存储、服务层）。 |
| [.cursor/rules/](.cursor/rules/)（React/TypeScript/Zustand/shadcn/Tailwind/Rust） | 前端与 Rust 编码规范，审查清单仅列要点，细则见各 rule。 |
| [.github/workflows/ci.yml](.github/workflows/ci.yml) | 合并前必须通过的 CI 定义。 |

### 11.3 良好/不良示例（本仓内）

**良好示例**

- **Handler 薄 + AuthenticatedUser**（[backend/src/handlers/files/list.rs](backend/src/handlers/files/list.rs)）：handler 仅解析 query、注入 `AuthenticatedUser(user_id)`、调用 `state.file_service.list_files(user_id, query)` 并构建 JSON，无 SQL、无业务判断。
- **Repo 中 file 查询带 user_id**（[backend/src/repositories/files.rs](backend/src/repositories/files.rs) 约 154～157 行）：`find_by_id(file_id, user_id)` 使用 `SELECT * FROM files WHERE id = $1 AND user_id = $2`，双参数防止越权；`belongs_to_user` 仅做存在性检查，供 service 层先校验再操作。
- **列表单次查询**：同一文件中 `list_files` 使用 `COUNT(*) OVER()` 一次取列表与总数，避免 N+1。

**不良示例（需避免或已修复）**

- **前端使用 `as any` 绕过类型**：如 `setAuth(data.user as any, token)` 会绕过 §5.2「禁止 any」；应为接口定义 `User` 类型或使用 `unknown` 后收窄。
- **仅用 file_id 未校验归属**：若 repo 提供 `get_by_id(file_id)` 且无 `user_id`，调用前必须在 service 中先 `belongs_to_user(file_id, user_id)?`，否则对应 file-sql-user-scope 需审查场景。
- **在 handler 内写 SQL**：违反 §4.1；应把查询放入 `repositories/`，handler 只调 service。

### 11.4 清单未覆盖与豁免

- **未覆盖**：若引入新技术栈（新语言、新框架），应先更新 `.cursor/skills/` 或 `ENGINEERING_PLAYBOOK`，再在本方案中补充对应审查章节，避免审查无据可依。
- **豁免**：在特殊情况下（如紧急 hotfix、实验性分支合并）需暂时豁免某条「必须」时，应在 PR 描述或关联 Issue 中**明确记录**：豁免条款、原因、后续补齐计划；审查人 Approve 时确认已知晓该豁免。

**豁免与分支、标签、审批的落地约定**（详见 [CONTRIBUTING.md](../CONTRIBUTING.md)）：

| 场景 | 分支/标签 | 审查严格度 | 豁免审批 |
|------|-----------|------------|----------|
| 常规 feature/fix | 普通 PR，无特殊 label | 按 §2.5 路径 + P0/P1 必过 | 不适用 |
| 紧急 hotfix | 分支名含 `hotfix/` 或 PR 打 label `hotfix` | 仅 P0 + 变更路径 P1；P2 可省略 | 在 PR 描述中写明「豁免条款 + 原因 + 补齐计划」，至少 1 人 Approve 并确认知晓 |
| 实验性/大重构 | PR 打 label `draft` 或 `experimental` | 可先合入实验分支，合 main 时按常规审查 | 合 main 时不得带未解决的豁免（要么补齐要么撤掉变更） |

豁免需谁批准：与合并权限一致，至少 1 人 Approve；若团队约定 hotfix 需 2 人，则在 CONTRIBUTING 或仓库设置中说明。

### 11.5 可度量与闭环

为评估清单是否有效、并持续改进，建议：

- **统计内容**：在 Review 评论中打标签或使用固定前缀（如 `[CR:安全]`、`[CR:性能]`），便于统计「本次 PR 发现的问题类型」；定期汇总：各条款被触发的次数、漏到线上或测试环境的问题是否被某条覆盖。
- **复盘节奏**：每季度或每 20～30 个 PR 做一次简短复盘：高频触发的条款是否要前置到 CI/文档；漏线问题对应条款是否缺失或表述不清，是否补充「如何检查」或示例。
- **闭环动作**：用统计结果调整 §2.7 的 P0/P1 划分、增删附录中的速查项、更新「良好/不良示例」或 ENGINEERING_PLAYBOOK 引用。

### 11.6 场景扩展：发布前 / 大版本 / 安全审计

除单次 PR 审查外，以下场景使用独立 checklist，可与本方案配合使用。

**发布前检查清单**（上线前执行一次）：

- [ ] 环境变量与配置：`.env.example` 与生产所需项一致；敏感项无默认值或占位符未替换。
- [ ] 迁移顺序与依赖：`backend/migrations/` 顺序正确；依赖的 PostgreSQL 扩展（如 pgvector）在目标环境已安装并在 README/部署文档中写明。
- [ ] 存储与备份：存储路径/桶权限、配额与监控；若有清理任务（如孤儿文件、过期 session），确认已启用且周期合理。
- [ ] 健康与就绪：`/health` 等接口可用；启动失败时有清晰日志。

**大版本或重构专项**（涉及多模块、破坏性 API、数据迁移时）：

- [ ] 影响面清单：列出受影响的前端页面、后端接口、存储表；是否有兼容层或灰度方案。
- [ ] 数据迁移：若有表结构或数据格式变更，迁移脚本是否可逆或可回滚、是否在 staging 验证过。
- [ ] 文档与沟通：CHANGELOG 或 Release notes 已更新；破坏性变更已通知调用方或前端。

**安全审计独立 checklist**（按需或定期）：

- [ ] 认证与授权：所有需登录接口均带 AuthenticatedUser 或等效；分享/公开链接的权限与过期逻辑正确。
- [ ] 用户隔离：文件/文件夹相关 SQL 与 API 全部带 user_id 或 belongs_to_user 校验；无越权读写的可能。
- [ ] 输入与输出：文件名、MIME、大小、分页参数等均有校验与上限；错误响应不泄露堆栈或内部路径。
- [ ] 依赖：`cargo audit`、`npm audit` 无高危未修复；已知中危有缓解或计划。

### 11.7 本方案后续可迭代方向

以下方向在需要时可继续深化：

- **更多「如何检查」**：为剩余条款（如 a11y、Zustand 选择器）补充 grep/命令或应看文件。
- **CI 注释联动**：在 CI 中根据失败步骤自动在 PR 评论中贴出本指南对应条款链接（需脚本或 Action）。
- **多语言/多框架**：若引入新栈，在 §11.4 未覆盖基础上新增章节并同步 Cursor rules。

### 11.8 本方案对项目的提升综合评估

**执行摘要**

本项目在落地本方案前已有 CI 和分散的工程规范，**缺的是「审查时查什么、怎么查、谁在什么情况下能合」的单一入口与成文流程**。本方案把上述缺口补上，并对安全（越权、敏感信息）、性能（流式/N+1/孤儿文件）和审查效率（按变更选路径、P0/P1、耗时参考、可操作反馈）做了显式化与可执行化。**综合看，对项目的提升属于「中高」**：在安全与合规、审查一致性与可执行性上提升最大；在流程与可演进性上有明显补强；实际效果取决于是否按文档执行审查并做定期复盘。

**基线（方案落地前项目已有）**

- CI 已覆盖：`cargo fmt` / `clippy` / `test`，`npm run lint` / `test` / `build`，合并不通过会拦在 CI。
- 规范已存在但分散：ENGINEERING_PLAYBOOK（性能/背压/流式）、BACKEND_TECH_STACK_AUDIT（合规）、file-sql-user-scope（用户隔离）、.cursor/rules（编码风格），缺少「审查时按什么顺序、查什么、怎么查、怎么评」的单一入口。
- 无统一审查流程：何时必审、谁负责、合并 gates、hotfix/豁免如何做，未成文。

**本方案带来的增量**

| 维度 | 提升内容 | 对项目的提升幅度（主观） |
|------|----------|---------------------------|
| **可发现性与一致性** | 单份文档汇聚审查标准 + 按变更类型选路径 + P0/P1/P2 + 耗时参考 | **高**：审查人/作者有统一依据，减少「每个人标准不一样」和漏看关键项。 |
| **安全与合规** | user_id 隔离、认证覆盖、敏感信息、参数化 SQL 的「必须」+「如何检查」+ 本仓示例 | **高**：越权与信息泄露是该项目的高风险点；清单与实操提示直接对准这些点。 |
| **性能与稳定性** | 流式/N+1/孤儿文件/限流/连接池等与 PLAYBOOK 对齐，并给出检查方法 | **中高**：PLAYBOOK 已有设计，本方案把「审查时如何验证」补全，降低新改动破坏已有设计的概率。 |
| **效率与可执行性** | 按变更类型选路径、Review 评论示例、Lint/CI 与条款对应、良好/不良本仓示例 | **中高**：审查时间更可预期，反馈更可操作，新人或兼职审查人更容易执行。 |
| **流程与例外** | CONTRIBUTING + PR 模板 + 分支/标签/豁免约定 | **中**：首次把「谁在什么情况下可以怎么合」写清楚，便于协作与交接。 |
| **可演进** | 可度量与闭环、发布前/大版本/安全审计场景、后续迭代方向 | **中**：为「用数据调清单、扩展场景」留了入口，实际提升取决于是否真做复盘与扩展。 |

**综合判断**

- **提升幅度**：在「已有 CI + 分散规范」的基线上，本方案主要带来**审查过程的结构化、安全/性能要点的显式化与可执行化、以及流程与例外的成文化**。对**防止越权与敏感信息泄露、防止新代码破坏已有性能设计、统一审查标准与耗时预期**的贡献最大；对「代码风格、测试覆盖、a11y」等已有 CI/rule 部分覆盖的维度是**补强而非从零建立**。
- **适用条件**：提升能否兑现取决于（1）PR 是否真的走审查、（2）审查人是否按 §2.5/§2.7 执行、（3）是否使用 PR 模板与 CONTRIBUTING、（4）是否定期做 §11.5 的统计与复盘。若只有文档而无执行，提升有限；若严格执行并复盘，预期可在 1～2 个季度内看到「Review 发现的问题类型更集中、漏到线上/测试的与清单未覆盖项更可追溯」。
- **局限**：清单不能替代自动化（CI/Lint 仍是一道防线）；部分条款仍依赖人工判断（如「业务逻辑是否该进 service」）；可度量与场景扩展需额外投入才能转化为持续改进。

---

## 12. 开始使用

### 12.1 文件就绪检查

- [x] `docs/CODE_REVIEW_GUIDE.md` - 主审查方案文档（已完成）
- [x] `CONTRIBUTING.md` - 贡献指南（已完成）
- [x] `.github/PULL_REQUEST_TEMPLATE.md` - PR 模板（已完成）
- [x] `docs/README.md` - 已添加 CODE_REVIEW_GUIDE 链接（已完成）
- [x] `README.md` - 已添加「贡献与代码审查」入口（已完成）

### 12.2 开始使用的行动步骤

#### 1. 团队通知（首次使用前）

- [ ] 在团队会议或文档中通知：代码审查方案已就绪，所有新 PR 需按 [CODE_REVIEW_GUIDE.md](CODE_REVIEW_GUIDE.md) 执行。
- [ ] 分享审查方案的核心要点：
  - 审查标准：按变更类型选路径（§2.5）、P0/P1/P2 优先级（§2.7）
  - PR 模板：创建 PR 时自动填充，需勾选审查类别
  - 审查耗时：小/中/大 PR 约 10～15 / 20～25 / 30～45 分钟

#### 2. GitHub 仓库设置（推荐配置）

- [ ] **分支保护规则**（Settings → Branches）：
  - 对 `main` / `master` 启用 "Require pull request reviews before merging"
  - 设置 "Required number of approvals" 为 1（或团队约定的数量）
  - 启用 "Require status checks to pass before merging"（对应 CI 的 fmt/clippy/test、lint/test/build）

- [ ] **PR 模板路径**（已创建，GitHub 会自动识别）：
  - 确认 `.github/PULL_REQUEST_TEMPLATE.md` 存在
  - 创建 PR 时会自动填充模板

- [ ] **标签（Labels）**（可选但推荐）：
  - 创建标签：`hotfix`（紧急修复）、`draft`（实验性）、`experimental`（大重构）
  - 用于触发不同的审查严格度（见 CONTRIBUTING.md）

#### 3. 首次 PR 审查（验证流程）

- [ ] **作者侧**：
  - 创建 PR 时填写 PR 模板，勾选本次变更涉及的审查类别
  - 确保 CI 通过后再请求审查

- [ ] **审查人侧**：
  - 按 PR 模板中勾选的类别，参考 CODE_REVIEW_GUIDE 的 §2.5「按变更类型选审查路径」
  - 使用 §2.7 的 P0/P1/P2 和耗时参考
  - Review 评论参考 §2.6「Review 评论怎么写」，附上条款出处和建议改法

- [ ] **合并前确认**：
  - CI 通过
  - 至少 1 人 Approve
  - 无未解决的讨论
  - 无冲突

#### 4. 持续改进（1～2 个季度后）

- [ ] **统计与复盘**（参考 §11.5）：
  - 在 Review 评论中使用标签（如 `[CR:安全]`、`[CR:性能]`）便于统计
  - 每季度或每 20～30 个 PR 复盘：高频触发条款、漏线问题与清单的对应关系
  - 用数据调整 P0/P1 划分、增删速查项

- [ ] **场景扩展**（按需）：
  - 发布前使用 §11.6「发布前检查清单」
  - 大版本/重构时使用「大版本或重构专项」
  - 定期使用「安全审计独立 checklist」

### 12.3 快速参考

- **审查方案**：[docs/CODE_REVIEW_GUIDE.md](docs/CODE_REVIEW_GUIDE.md)
- **贡献指南**：[CONTRIBUTING.md](../CONTRIBUTING.md)
- **PR 模板**：[.github/PULL_REQUEST_TEMPLATE.md](../.github/PULL_REQUEST_TEMPLATE.md)

### 12.4 常见问题

**Q: PR 模板没有自动填充？**  
A: 确认 `.github/PULL_REQUEST_TEMPLATE.md` 在仓库根目录的 `.github/` 下；GitHub 会自动识别。

**Q: 审查人不知道看哪些条款？**  
A: 作者在 PR 模板中勾选审查类别，审查人按 CODE_REVIEW_GUIDE §2.5「按变更类型选审查路径」执行。

**Q: Hotfix 如何快速审查？**  
A: PR 打 `hotfix` 标签或分支名含 `hotfix/`，仅需过 P0 + 变更路径 P1；P2 可省略。豁免需在 PR 描述中写明。

**Q: 如何评估审查方案是否有效？**  
A: 参考 CODE_REVIEW_GUIDE §11.5「可度量与闭环」，定期统计 Review 发现的问题类型、漏线问题与清单的对应关系。

---

## 13. 操作指南

### 13.1 作为作者（提交 PR）

#### 1.1 开发前准备

- 阅读 [CONTRIBUTING.md](../CONTRIBUTING.md) 了解流程
- 确保本地 CI 通过：
  ```bash
  # 后端
  cd backend
  cargo fmt --all
  cargo clippy --all-targets --all-features -- -D warnings
  cargo test --all-features
  
  # 前端
  cd frontend
  npm run lint
  npm run test
  npm run build
  ```

#### 1.2 创建 PR

1. **推送分支到 GitHub**
   ```bash
   git push origin your-branch-name
   ```

2. **在 GitHub 创建 PR**
   - GitHub 会自动填充 [PR 模板](.github/PULL_REQUEST_TEMPLATE.md)
   - **必须填写**：
     - 变更说明：简要描述改动目的与主要内容
     - 审查类别：勾选本次变更涉及的类别（后端/前端/API/DB/安全）
     - CI 状态：确认 CI 已通过

3. **示例 PR 描述**：
   ```markdown
   ## 变更说明
   
   修复配置验证：添加 `rate_limit_max_keys` 的零值检查，避免 moka cache 初始化失败。
   同时将数据库 dump 文件从版本控制中移除。
   
   ## 审查类别（请勾选本次变更涉及的部分）
   
   - [x] **后端**（Rust：handler/service/repo、错误、安全、性能、工具）
   - [ ] **前端**（React/TypeScript：组件、类型、状态、UI、样式、工具）
   - [ ] **API 与契约**（REST、错误格式、破坏性变更、OpenAPI）
   - [x] **数据库与迁移**（user_id 隔离、DDL、扩展依赖）
   - [ ] **安全**（认证、敏感数据、XSS/依赖）
   
   ## 其他
   
   - [x] CI 已通过
   - [ ] 若为 hotfix 或需豁免某条「必须」，已在下方或关联 Issue 中写明豁免条款、原因与补齐计划
   ```

#### 1.3 等待审查

- 审查人会在 PR 中提出意见
- 按意见修改后 push 新 commit，审查人会收到通知
- 所有讨论解决后，审查人 Approve，即可合并

---

### 13.2 作为审查人（Review PR）

#### 2.1 收到审查请求后

1. **查看 PR 描述**，确认作者勾选的审查类别
2. **查看变更文件**：
   ```bash
   git diff main --name-only  # 或直接在 GitHub PR 页面看 Files changed
   ```

3. **选择审查路径**（参考 §2.5）：

   | 变更类型 | 重点章节 | 耗时参考 |
   |----------|----------|----------|
   | 仅后端 handler/接口 | §4 后端、§6 API、§8 安全 | 10～15 分钟 |
   | 仅前端 UI/样式 | §5 前端（5.4/5.5） | 10～15 分钟 |
   | 新增/修改迁移或 SQL | §7 数据库、§4.3 安全、§4.4 性能 | 15～20 分钟 |
   | 全栈 feature | 按改动文件逐层过 §4/§5/§6/§7/§8 | 30～45 分钟 |

#### 2.2 执行审查（按优先级）

**P0（必须检查，不满足不得合并）**：
- [ ] 安全：文件相关 SQL 带 `user_id`（在 PR 中搜 `files`、`file_shares`、`folder`，看每条 SQL）
- [ ] 安全：需登录接口使用 `AuthenticatedUser`（搜新增路由，看 handler 参数）
- [ ] 安全：参数化查询，无字符串拼接（搜 `format!`、字符串拼接 SQL）
- [ ] 安全：敏感信息不落日志（搜 `tracing::`、`log::`，看是否有 token/password/file_path）
- [ ] CI 通过：fmt/clippy/test、lint/test/build

**P1（与本次变更强相关时必看）**：
- [ ] 架构：Handler 薄、Service/Repo 分层（看新增 handler 是否只做 HTTP）
- [ ] 性能：流式 I/O、无 N+1（看列表/批量接口是否单次查询）
- [ ] 错误：使用 `AppError`、`?` 传播（看返回类型与错误处理）

**P2（可按需扫一眼）**：
- [ ] 测试覆盖、a11y、OpenAPI 同步等建议项

#### 2.3 写 Review 评论（参考 §2.6）

**好的评论示例**：
```
❌ 这里要加 user_id。

✅ 这里建议加上 `AND user_id = $n` 条件，否则可能跨用户越权。
   见 [file-sql-user-scope](.cursor/rules/file-sql-user-scope.mdc) 正确示例。
   参考 `repositories/files.rs` 第 155 行的 `find_by_id` 实现。
```

**评论格式**：
- 指出问题 + 条款出处（CODE_REVIEW_GUIDE 章节或 rule 链接）
- 建议改法或参考文件
- 便于作者一次改对

#### 2.4 Approve 或 Request Changes

- **Approve**：所有 P0 通过、相关 P1 通过、无未解决讨论
- **Request Changes**：P0 不满足或关键 P1 不满足，要求修改后再审

---

### 13.3 团队落地（首次使用）

#### 3.1 团队通知

在团队会议或文档中说明：
- 代码审查方案已就绪，所有新 PR 需按 [CODE_REVIEW_GUIDE.md](CODE_REVIEW_GUIDE.md) 执行
- PR 模板会自动填充，需勾选审查类别
- 审查耗时参考：小/中/大 PR 约 10～15 / 20～25 / 30～45 分钟

#### 3.2 GitHub 仓库设置（推荐）

**分支保护规则**（Settings → Branches）：
- 对 `main`/`master` 启用 "Require pull request reviews before merging"
- 设置 "Required number of approvals" 为 1（或团队约定数量）
- 启用 "Require status checks"（对应 CI 的 fmt/clippy/test、lint/test/build）

**标签**（可选）：
- 创建 `hotfix`、`draft`、`experimental` 标签
- 用于触发不同审查严格度（见 CONTRIBUTING.md）

#### 3.3 首次 PR 验证

- 选择一个简单 PR（如文档更新或小 bugfix）
- 作者填写 PR 模板，勾选审查类别
- 审查人按 §2.5 路径执行，验证流程是否顺畅
- 根据反馈调整文档或流程

#### 3.4 持续改进（1～2 个季度后）

- **统计**：在 Review 评论中使用标签（如 `[CR:安全]`、`[CR:性能]`）便于统计问题类型
- **复盘**：每季度或每 20～30 个 PR 复盘：高频触发条款、漏线问题与清单的对应关系
- **调整**：用数据调整 P0/P1 划分、增删速查项

---

### 13.4 实际示例

#### 示例 1：修复配置验证（后端）

**作者侧**：
```markdown
## 变更说明
修复 `validate()` 函数：添加 `rate_limit_max_keys` 的零值检查。

## 审查类别
- [x] **后端**（Rust：handler/service/repo、错误、安全、性能、工具）
```

**审查人侧**：
- 查看变更：`backend/src/config.rs` 的 `validate()` 函数
- 审查路径：§4 后端（§4.2 错误处理、§4.5 工具）
- P0 检查：
  - [x] CI 通过（fmt/clippy/test）
  - [x] 错误处理：使用 `AppError`、错误消息清晰
- P1 检查：
  - [x] 验证逻辑完整：所有限流相关配置都有零值检查
- **结论**：Approve ✅

#### 示例 2：新增文件列表接口（全栈）

**作者侧**：
```markdown
## 变更说明
新增文件列表接口，支持分页与搜索。

## 审查类别
- [x] **后端**
- [x] **前端**
- [x] **API 与契约**
```

**审查人侧**：
- 查看变更：`handlers/files/list.rs`、`repositories/files.rs`、前端列表组件
- 审查路径：§4 后端、§5 前端、§6 API、§8 安全、§9 性能
- P0 检查：
  - [x] 安全：SQL 带 `user_id`（`repositories/files.rs` 中 `list_files` 有 `WHERE user_id = $1`）
  - [x] 安全：使用 `AuthenticatedUser`（handler 参数中有）
  - [x] CI 通过
- P1 检查：
  - [x] 性能：列表单次查询，无 N+1（使用 `COUNT(*) OVER()`）
  - [x] API：响应格式与前端 `FileListResponse` 一致（`files` 字段）
- **结论**：Approve ✅

---

### 13.5 快速参考

| 角色 | 文档 | 关键章节 |
|------|------|----------|
| **作者** | [CONTRIBUTING.md](../CONTRIBUTING.md) | 流程概要、分支与标签约定 |
| **审查人** | [CODE_REVIEW_GUIDE.md](CODE_REVIEW_GUIDE.md) | §2.5 按变更类型选路径、§2.7 优先级与耗时、§2.6 Review 评论怎么写 |
| **团队** | [CODE_REVIEW_GUIDE.md](CODE_REVIEW_GUIDE.md) | §12 开始使用的行动步骤 |

---

## 14. 审查报告模板

### 14.1 报告结构

本报告按 [CODE_REVIEW_GUIDE.md](CODE_REVIEW_GUIDE.md) 执行，包含：（1）对「代码审查方案」相关文档与配置的审查；（2）对后端文件列表路径的抽样审查，作为清单落地的示例。

---

### 14.2 审查对象与路径

| 审查对象 | 变更类型 | 采用的审查路径（§2.5） |
|----------|----------|------------------------|
| 审查方案相关文件（README、CONTRIBUTING、PR 模板、CODE_REVIEW_GUIDE.md） | 文档/流程 | §3 通用、§10 工具与自动化、文档间一致性 |
| 后端 `handlers/files/list.rs` + `repositories/files.rs`（列表与删除） | 后端 handler/接口 + 数据访问 | §4 后端、§6 API、§8 安全、§9 性能 |

---

### 14.3 审查结果示例

#### 3.1 通用（§3）

| 检查项 | 结果 | 说明 |
|--------|------|------|
| 提交/变更范围 | ✅ | 变更集中在文档与模板，无无关代码。 |
| 文档一致性 | ✅ | README、CONTRIBUTING、PR 模板、CODE_REVIEW_GUIDE 相互引用一致。 |

#### 3.2 链接与路径

| 文件 | 链接 | 结果 |
|------|------|------|
| README.md | `CONTRIBUTING.md`、`docs/CODE_REVIEW_GUIDE.md` | ✅ 相对路径正确（从仓库根）。 |
| CONTRIBUTING.md | `docs/CODE_REVIEW_GUIDE.md`、`.github/PULL_REQUEST_TEMPLATE.md` | ✅ 正确。 |

#### 3.3 工具与自动化（§10）

| 检查项 | 结果 | 说明 |
|--------|------|------|
| PR 模板存在且可被 GitHub 识别 | ✅ | `.github/PULL_REQUEST_TEMPLATE.md` 存在，GitHub 会自动填充。 |
| 模板中审查类别与指南一致 | ✅ | 后端/前端/API 与契约/数据库与迁移/安全 与 §11.1 速查表一致。 |

#### 3.4 后端路径抽样审查

| 检查项 | 结果 | 说明 |
|--------|------|------|
| Handler 仅做 HTTP | ✅ | `list_files_handler` 仅解析 `AuthenticatedUser`、`Query`，调用 service，构建 JSON，无 SQL。 |
| 文件相关 SQL 带 user_id | ✅ | `list_by_folder`、`delete`、`delete_batch` 均带 `user_id` 条件。 |
| 参数化查询 | ✅ | 全部使用 `sqlx::query_as` + `.bind()`，无字符串拼接。 |
| 列表无 N+1 | ✅ | `list_by_folder` 单条 SQL，使用 `COUNT(*) OVER()`。 |

---

### 14.4 审查人签字与合并建议

| 项目 | 结论 |
|------|------|
| 审查方案相关文件 | **Approve**，可合并。 |
| 后端文件列表路径（抽样） | **Approve**，符合清单。 |
| 合并前 Gates | 建议：CI 通过、至少 1 人 Approve、无未解决讨论。 |

---

**文档版本**: v2.2  
**最后更新**: 2026-05-06
