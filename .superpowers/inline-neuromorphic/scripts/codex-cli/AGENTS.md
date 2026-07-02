# codex-cli AGENTS.md
本文件作用域：`scripts/codex-cli/`（作为独立 skill pack 的规则入口）。

## 总原则
- 默认只在本目录内进行读写与修改（除非用户明确要求改动其它目录）
- 不输出/不记录任何密钥（例如 runner token、本地 Codex 凭证、`.env`）
- 任何会导致数据丢失或不可逆的操作（删除、重置、迁移等）必须先停下来征求人类批准

## 交付约束
- 自动化输出需要稳定可解析时：stdout 仅输出最终结果；过程日志写 stderr
- 变更必须可验证：优先补测试，其次跑 lint/typecheck/test
- BatchFix 的主补丁格式必须是 SEARCH/REPLACE block；unified diff 仅保留兼容路径，禁止重新把 LLM 直接产 unified diff 作为主路径

版本：v2.1 | 最后更新：{{today}}
人类掌舵，Agent 执行。任何违背本文件的行为视为无效。

## 人类意图原则
- 你只执行人类明确意图。
- 每任务必须先输出「执行计划」（exec-plan），列出所有假设、风险、依赖。
- 人类只批准计划 + 最终 PR。中间过程全自主。

## 15 条黄金规则（Agent 永久遵守，不可删除）
1. **架构铁律**：严格分层（Types → Config → Repo → Service → Runtime → UI），禁止循环/反向依赖。
2. **TDD 铁律**：永远先写测试（失败→实现→通过），覆盖率 ≥ 90%。
3. **一致性铁律**：所有变更必须通过 CI（build + test + lint + typecheck）。
4. **失败永不重复**：每次 bug 立即在 docs/constraints/ 或 linter 中新增永久约束。
5. **文档即记忆**：所有知识必须写在 docs/（纯文本、LLM 友好），代码注释 ≤ 10%。
6. **小步迭代**：每个 PR ≤ 300 行，单功能单 PR，使用 git worktree 隔离。
7. **可观测铁律**：每项变更必须生成日志 + 指标 + 截图/视频证明。
8. **安全边界**：rm、migrate、env 修改等危险操作必须人类批准。
9. **Agent Legibility**：所有文件结构、命名、日志必须让另一个 Agent 10 秒内看懂。
10. **上下文防火墙**：使用 sub-agent 分解任务，禁止单上下文超过 50k token。
11. **Progressive Disclosure**：只在需要时请求额外信息。
12. **垃圾回收**：每周运行一次 entropy-agent，清理过时文档、死代码。
13. **自审铁律**：PR 前必须生成「前后对比视频」+ LLM Judge 打分 ≥ 95。
14. **回退铁律**：每步操作前自动 git snapshot，失败立即 revert。
15. **质量评分**：每次任务结束后在 docs/quality-score.md 更新分数，低于 90 分自动重跑。

## 项目结构（Agent 必读）
docs/
├── design-docs/          # 核心信念 + 架构图
├── exec-plans/           # 每任务计划（JSON + MD）
├── constraints/          # 永久约束列表
├── references/           # 纯文本参考
├── quality-score.md      # 历史分数
├── changelog.md          # 项目变更日志
├── security.md           # 安全边界与建议
├── troubleshooting.md      # 故障排查与建议
├── configuration.md      # 配置与策略
├── cli.md                # CLI 与输出契约

.github/workflows/        # CI

## 工具使用顺序（强制）
1. repo semantic search / grep
2. Plan Mode（输出计划）
3. TDD 循环
4. 自审
5. 开 PR + 请求 review

严格遵守本文件 + docs/ 所有内容。任何不确定先查询 repo，否则终止任务并报告。
