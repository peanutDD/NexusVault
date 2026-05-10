## 配置与策略

该文档已迁移到 [references/configuration.md](references/configuration.md)。

### BatchFix Patch Format

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `CODEX_PATCH_FORMAT` | `auto` | `auto` / `search_replace` / `unified_diff`；默认提示模型输出 SEARCH/REPLACE，仍兼容 unified diff 输入。 |
| `CODEX_SR_MAX_BLOCKS` | `5` | 单个 issue 允许的 SEARCH/REPLACE block 上限。 |
| `CODEX_SR_FUZZY_MATCH` | `true` | 预留开关；当前实现固定启用 exact、trim trailing whitespace、normalize indent 三层匹配。 |
| `CODEX_FULL_FILE_FALLBACK_ALLOWED_PREFIXES` | `backend/src/,frontend/src/,scripts/` | 整文件兜底允许路径。 |
| `CODEX_PROTECTED_FILES` | 内置锁文件/配置文件列表 | 整文件兜底保护路径，可逗号追加。 |
