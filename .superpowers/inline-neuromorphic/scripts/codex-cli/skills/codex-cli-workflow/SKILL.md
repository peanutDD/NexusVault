---
name: codex-cli-workflow
description: |
  Use when working inside scripts/codex-cli: adding features, refactoring, docs, CI wiring, or troubleshooting the codex-cli tool.
version: "0.1.0"
---

执行前先读取并严格遵守：
${CLAUDE_PLUGIN_ROOT}/AGENTS.md

## 工作流

1) 先在本目录内搜索代码（优先语义检索/grep），定位入口与数据流
2) 明确改动范围与验收标准（至少 fmt + clippy + test）
3) 小步改动，保持输出契约稳定（如涉及自动化输出，stdout 只输出最终 JSON）
4) 变更完成后运行：

```bash
cd ${CLAUDE_PLUGIN_ROOT}
cargo fmt
cargo clippy --all-targets -- -D warnings
cargo test
```

## 常用入口

- 代码：${CLAUDE_PLUGIN_ROOT}/src
- 文档：${CLAUDE_PLUGIN_ROOT}/docs
- 二进制入口：${CLAUDE_PLUGIN_ROOT}/src/bin/codex.rs

