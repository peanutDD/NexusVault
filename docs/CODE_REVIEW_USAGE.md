# 代码审查方案使用指南

本文档说明如何在项目中实际使用 [CODE_REVIEW_GUIDE.md](CODE_REVIEW_GUIDE.md)，包含作者、审查人和团队三个角色的操作步骤。

---

## 一、作为作者（提交 PR）

### 1.1 开发前准备

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

### 1.2 创建 PR

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

### 1.3 等待审查

- 审查人会在 PR 中提出意见
- 按意见修改后 push 新 commit，审查人会收到通知
- 所有讨论解决后，审查人 Approve，即可合并

---

## 二、作为审查人（Review PR）

### 2.1 收到审查请求后

1. **查看 PR 描述**，确认作者勾选的审查类别
2. **查看变更文件**：
   ```bash
   git diff main --name-only  # 或直接在 GitHub PR 页面看 Files changed
   ```

3. **选择审查路径**（参考 [CODE_REVIEW_GUIDE.md §2.5](CODE_REVIEW_GUIDE.md#25-按变更类型选审查路径)）：

   | 变更类型 | 重点章节 | 耗时参考 |
   |----------|----------|----------|
   | 仅后端 handler/接口 | §4 后端、§6 API、§8 安全 | 10～15 分钟 |
   | 仅前端 UI/样式 | §5 前端（5.4/5.5） | 10～15 分钟 |
   | 新增/修改迁移或 SQL | §7 数据库、§4.3 安全、§4.4 性能 | 15～20 分钟 |
   | 全栈 feature | 按改动文件逐层过 §4/§5/§6/§7/§8 | 30～45 分钟 |

### 2.2 执行审查（按优先级）

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

### 2.3 写 Review 评论（参考 §2.6）

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

### 2.4 Approve 或 Request Changes

- **Approve**：所有 P0 通过、相关 P1 通过、无未解决讨论
- **Request Changes**：P0 不满足或关键 P1 不满足，要求修改后再审

---

## 三、团队落地（首次使用）

### 3.1 团队通知

在团队会议或文档中说明：
- 代码审查方案已就绪，所有新 PR 需按 [CODE_REVIEW_GUIDE.md](CODE_REVIEW_GUIDE.md) 执行
- PR 模板会自动填充，需勾选审查类别
- 审查耗时参考：小/中/大 PR 约 10～15 / 20～25 / 30～45 分钟

### 3.2 GitHub 仓库设置（推荐）

**分支保护规则**（Settings → Branches）：
- 对 `main`/`master` 启用 "Require pull request reviews before merging"
- 设置 "Required number of approvals" 为 1（或团队约定数量）
- 启用 "Require status checks"（对应 CI 的 fmt/clippy/test、lint/test/build）

**标签**（可选）：
- 创建 `hotfix`、`draft`、`experimental` 标签
- 用于触发不同审查严格度（见 CONTRIBUTING.md）

### 3.3 首次 PR 验证

- 选择一个简单 PR（如文档更新或小 bugfix）
- 作者填写 PR 模板，勾选审查类别
- 审查人按 §2.5 路径执行，验证流程是否顺畅
- 根据反馈调整文档或流程

### 3.4 持续改进（1～2 个季度后）

- **统计**：在 Review 评论中使用标签（如 `[CR:安全]`、`[CR:性能]`）便于统计问题类型
- **复盘**：每季度或每 20～30 个 PR 复盘：高频触发条款、漏线问题与清单的对应关系
- **调整**：用数据调整 P0/P1 划分、增删速查项

---

## 四、实际示例

### 示例 1：修复配置验证（后端）

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

### 示例 2：新增文件列表接口（全栈）

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

## 五、快速参考

| 角色 | 文档 | 关键章节 |
|------|------|----------|
| **作者** | [CONTRIBUTING.md](../CONTRIBUTING.md) | 流程概要、分支与标签约定 |
| **审查人** | [CODE_REVIEW_GUIDE.md](CODE_REVIEW_GUIDE.md) | §2.5 按变更类型选路径、§2.7 优先级与耗时、§2.6 Review 评论怎么写 |
| **团队** | [CODE_REVIEW_START.md](CODE_REVIEW_START.md) | 开始使用的行动步骤 |

---

## 六、常见问题

**Q: PR 模板没有自动填充？**  
A: 确认 `.github/PULL_REQUEST_TEMPLATE.md` 在仓库根目录的 `.github/` 下；GitHub 会自动识别。

**Q: 审查人不知道看哪些条款？**  
A: 作者在 PR 模板中勾选审查类别，审查人按 CODE_REVIEW_GUIDE §2.5「按变更类型选审查路径」执行。

**Q: Hotfix 如何快速审查？**  
A: PR 打 `hotfix` 标签或分支名含 `hotfix/`，仅需过 P0 + 变更路径 P1；P2 可省略。豁免需在 PR 描述中写明。

**Q: 审查耗时超出预期？**  
A: 参考 §2.7 的耗时参考；若经常超时，可能是 PR 过大，建议拆分或调整清单优先级。

**Q: 如何评估审查方案是否有效？**  
A: 参考 CODE_REVIEW_GUIDE §11.5「可度量与闭环」，定期统计 Review 发现的问题类型、漏线问题与清单的对应关系。
