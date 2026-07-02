## 故障排查

该文档已迁移到 [references/troubleshooting.md](references/troubleshooting.md)。

### BatchFix 失败排查

- `missing SEARCH/REPLACE file header`：模型没有输出 `### File: <allowed-file>`，按 malformed output 处理。
- `does not match allowed file`：模型试图修改非当前 issue 文件，拒绝应用。
- `SEARCH block is ambiguous`：SEARCH 片段在文件中出现多次；重试 prompt 应要求扩展前后上下文。
- `SEARCH block was not found`：源码漂移或模型复制片段不精确；重试后仍失败才进入整文件兜底。
- `SEARCH/REPLACE blocks overlap`：多个 block 的原始范围重叠，拒绝应用，避免互相覆盖。
- `corrupt patch` / `malformed_diff`：仅 unified diff 兼容路径可能出现；新主路径不依赖 hunk header。
