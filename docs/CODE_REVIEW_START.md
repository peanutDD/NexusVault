# 代码审查方案开始使用检查清单

本文档帮助团队确认代码审查方案已就绪，并给出开始使用的行动步骤。

## ✅ 文件就绪检查

- [x] `docs/CODE_REVIEW_GUIDE.md` - 主审查方案文档（已完成）
- [x] `CONTRIBUTING.md` - 贡献指南（已完成）
- [x] `.github/PULL_REQUEST_TEMPLATE.md` - PR 模板（已完成）
- [x] `docs/README.md` - 已添加 CODE_REVIEW_GUIDE 链接（已完成）
- [x] `README.md` - 已添加「贡献与代码审查」入口（已完成）

## 🚀 开始使用的行动步骤

### 1. 团队通知（首次使用前）

- [ ] 在团队会议或文档中通知：代码审查方案已就绪，所有新 PR 需按 [CODE_REVIEW_GUIDE.md](CODE_REVIEW_GUIDE.md) 执行。
- [ ] 分享审查方案的核心要点：
  - 审查标准：按变更类型选路径（§2.5）、P0/P1/P2 优先级（§2.7）
  - PR 模板：创建 PR 时自动填充，需勾选审查类别
  - 审查耗时：小/中/大 PR 约 10～15 / 20～25 / 30～45 分钟

### 2. GitHub 仓库设置（推荐配置）

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

### 3. 首次 PR 审查（验证流程）

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

### 4. 持续改进（1～2 个季度后）

- [ ] **统计与复盘**（参考 CODE_REVIEW_GUIDE §11.5）：
  - 在 Review 评论中使用标签（如 `[CR:安全]`、`[CR:性能]`）便于统计
  - 每季度或每 20～30 个 PR 复盘：高频触发条款、漏线问题与清单的对应关系
  - 用数据调整 P0/P1 划分、增删速查项

- [ ] **场景扩展**（按需）：
  - 发布前使用 §11.6「发布前检查清单」
  - 大版本/重构时使用「大版本或重构专项」
  - 定期使用「安全审计独立 checklist」

## 📋 快速参考

- **审查方案**：[docs/CODE_REVIEW_GUIDE.md](CODE_REVIEW_GUIDE.md)
- **贡献指南**：[CONTRIBUTING.md](../CONTRIBUTING.md)
- **PR 模板**：[.github/PULL_REQUEST_TEMPLATE.md](../.github/PULL_REQUEST_TEMPLATE.md)

## ❓ 常见问题

**Q: PR 模板没有自动填充？**  
A: 确认 `.github/PULL_REQUEST_TEMPLATE.md` 在仓库根目录的 `.github/` 下；GitHub 会自动识别。

**Q: 审查人不知道看哪些条款？**  
A: 作者在 PR 模板中勾选审查类别，审查人按 CODE_REVIEW_GUIDE §2.5「按变更类型选审查路径」执行。

**Q: Hotfix 如何快速审查？**  
A: PR 打 `hotfix` 标签或分支名含 `hotfix/`，仅需过 P0 + 变更路径 P1；P2 可省略。豁免需在 PR 描述中写明。

**Q: 如何评估审查方案是否有效？**  
A: 参考 CODE_REVIEW_GUIDE §11.5「可度量与闭环」，定期统计 Review 发现的问题类型、漏线问题与清单的对应关系。
