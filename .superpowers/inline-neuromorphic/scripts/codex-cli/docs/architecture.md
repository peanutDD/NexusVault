## 架构与模块

该文档已迁移到 [design-docs/architecture.md](design-docs/architecture.md)。

### 补丁应用策略

`BatchFixSkill` 的主路径是 SEARCH/REPLACE block：

```text
### File: <allowed-file>
<<<<<<< SEARCH
原代码
=======
新代码
>>>>>>> REPLACE
```

`patch::apply` 负责自动识别 SEARCH/REPLACE 与 unified diff。SEARCH/REPLACE 会先解析 `### File:`，再在原始文件上定位所有 block，按文件偏移排序后一次性写回；零匹配、多匹配或重叠匹配都会被拒绝并进入重试或兜底。unified diff 仅作为兼容路径保留。
