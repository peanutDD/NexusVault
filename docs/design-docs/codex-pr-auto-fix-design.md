# Codex PR Auto-Fix 设计文档

## 1. 核心架构：Skill 编排
`codex pr-auto-fix` 命令采用模块化 Skill 编排架构，将复杂的修复任务拆分为多个原子级技能。

### 1.1 技能流图
```mermaid
graph TD
    A[Gemini Review] --> B[Skill: read_gemini_review]
    B --> C{情报 JSON}
    C --> D[Skill: decide_fix_or_skip]
    D --> E{过滤后问题列表}
    E --> F[Skill: generate_fix_patch]
    F --> G[Skill: apply_patch_safely]
    G --> H[Skill: commit_and_tag_round]
    H --> I[PR 状态更新]
```

## 2. 关键 Skill 定义

### 2.1 情报解析 (read_gemini_review)
- **职责**: 使用 GPT-5.4 将 Gemini Code Assist 的 Markdown 评论解析为结构化数据。
- **输出**: `ReviewData` 结构，包含 `summary` 和 `issues`。
- **字段**: 增加 `reason` 字段用于 Traceability，`severity` 支持 `Critical` 到 `Low`。

### 2.2 决策引擎 (decide_fix_or_skip)
- **硬过滤**: 
    - 仅处理 `Critical`, `High`, `Medium` 优先级。
    - 排除受保护文件 (`Cargo.lock`, `package-lock.json`, `.env` 等)。
    - 排除文档类路径 (`docs/`, `*.md`)。

### 2.3 安全应用 (apply_patch_safely)
- **隔离性**: 在本地 Harness 隔离环境中通过临时 `.patch` 文件进行 `git apply`。
- **一致性**: 确保修复代码不破坏现有架构铁律。

## 3. GitHub Workflow 集成
- **触发器**: 监听 `issue_comment` (针对 PR 评论)。
- **轮次控制**: 通过 PR 标签 (`gemini-review-round-1` 等) 实现自迭代修复，默认上限 2 轮。
- **环境安全**: 使用中间环境变量 `RAW_COMMENT_BODY` 安全注入多行情报。

## 4. 优势
- **模块化**: 每个 Skill 均可独立测试、复用。
- **确定性**: Temperature=0 + JSON Mode 确保情报解析稳定。
- **闭环**: 自动执行 Parse -> Fix -> Push -> Comment 闭环流。
