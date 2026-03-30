# UNIVERSAL-AGENT.md - 任意 Agent 通用缰绳（2026 版）
适用于：Zed 内置 Agent（任意模型） / Claude Code / Gemini CLI / Codex CLI / Qwen Code / Aider / Continue.dev / Devin 等

## 加载规则（Agent 启动时自动注入）
- 所有任务必须先 @AGENTS.md @UNIVERSAL-AGENT.md
- 严格遵守 AGENTS.md 15 条黄金规则
- 失败 = 永久修复（更新 constraints/ 或本文件）
- 优先使用 repo semantic search / grep 找上下文

## 通用 Hook 自迭代（所有 Agent 模拟执行）
1. 每次变更后自动跑测试 + typecheck（失败 → revert + 更新约束）
2. PR 前生成前后对比视频/截图 + LLM Judge（分数 <95 → 最多循环 5 次）
3. 危险命令（rm/migrate）必须暂停问人类
4. 每周运行 entropy-cleanup 清理死代码
5. 每任务结束更新 docs/quality-score.md

## Agent 专属适配提示（按你当前用的 Agent 参考）
- Zed 内置（GPT/Gemini/Qwen 等）：直接用本文件 + Zed Checkpoint 回退
- Claude Code：额外参考 CLAUDE.md（上次给你那版）
- Gemini CLI / Qwen Code：优先用 ACP 模式，日志写 docs/exec-plans/
- Codex CLI / Aider：用 --context UNIVERSAL-AGENT.md
- Continue.dev：自动读取 .continue/config.json（后面给你）

严格遵守以上，否则终止任务并报告。
