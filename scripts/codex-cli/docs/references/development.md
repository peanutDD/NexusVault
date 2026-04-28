## 开发与发布

### 本地开发（最小步骤）

```bash
cd scripts/codex-cli
cp .env.example .env  # 如果你有模板；否则自行创建 .env
```

`.env` 至少需要：

```env
OPENAI_API_KEY=...
```

### 常用命令

```bash
cargo fmt
cargo clippy --all-targets -- -D warnings
cargo test
```

### Skill Pack 自动加载（零同步）

本目录已经按“Skill Pack（插件）”结构组织。

前提：需要你的宿主（你说的 Superpowers/IDE/Agent Runtime）支持“加载一个本地插件根目录 → 自动发现 `skills/*/SKILL.md`”。该“自动发现”机制不在 `codex-cli` Rust 代码里实现，而是由宿主负责扫描与加载。

在满足前提时，即可做到：**只在本目录下新增 `skills/<name>/SKILL.md`，即可被自动发现**（无需把 skill 同步到仓库根目录）。

**自动发现规则（目录约定）**

- 插件根目录：`scripts/codex-cli/`
- 插件清单：`.claude-plugin/plugin.json`
- 规则入口：`AGENTS.md`
- Skills：`skills/<skill-name>/SKILL.md`

对应文件：

- [plugin.json](file:///Users/tyone/github/upload-download-util/scripts/codex-cli/.claude-plugin/plugin.json)
- [AGENTS.md](file:///Users/tyone/github/upload-download-util/scripts/codex-cli/AGENTS.md)
- 示例 skill：[SKILL.md](file:///Users/tyone/github/upload-download-util/scripts/codex-cli/skills/codex-cli-workflow/SKILL.md)

**如何完成“自动加载”**

1. 在 Superpowers 的“插件/技能包管理”里，把本地插件路径指向：
   - `/Users/tyone/github/upload-download-util/scripts/codex-cli`
2. 让宿主重新扫描插件（常见方式：重启会话/刷新插件列表）

**如何验证已加载**

- 宿主能发现 `codex-cli-workflow` 这个 skill（与示例文件夹同名）
- 该 skill 内容里引用的 `${CLAUDE_PLUGIN_ROOT}/AGENTS.md` 能被解析（说明宿主正确设置了插件根目录）

**以后新增 skill 的唯一动作**

新增目录与文件：

- `scripts/codex-cli/skills/<new-skill-name>/SKILL.md`

并在 `SKILL.md` 顶部固定加入规则引用：

```
执行前先读取并严格遵守：
${CLAUDE_PLUGIN_ROOT}/AGENTS.md
```

### 运行示例

对任意本地仓库跑一轮（Dry-Run，不提交不推送）：

```bash
codex auto-fix-local \
  --repo-root /abs/path/to/repo \
  --review-file /abs/path/to/review.md
```

允许提交推送：

```bash
codex auto-fix-local \
  --repo-root /abs/path/to/repo \
  --review-file /abs/path/to/review.md \
  --yes
```

### 发布建议

建议的发布产物是单一二进制 `codex`：

```bash
cargo build --release
ls -lah target/release/codex
```

如需在 CI 中复用，可把该二进制作为 artifacts 发布，或通过容器镜像提供。

### 故障排查入口

- 模型调用失败（401/429/5xx）：检查 `OPENAI_API_KEY` / `OPENAI_API_BASE` / 网络代理
- `git apply` 失败：通常是 patch 与当前工作区不匹配；检查 issue 的文件路径与上下文是否过期
- PR 评论失败：检查 `gh` 登录与 token 权限（或使用 `--no-pr-comments`）
