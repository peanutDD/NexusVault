# Design Tokens Usage Guide

本文档定义前端 `Design Tokens` 的命名规范与使用规则，目标是：

- 保持视觉一致性
- 降低样式分散与重复
- 提高主题/风格调整效率
- 避免组件内硬编码颜色、圆角、阴影、玻璃参数

---

## 1. Token 文件与加载

- Token 源文件：`src/styles/tokens.css`
- 全局入口：`src/index.css` 中通过 `@import "./styles/tokens.css";` 引入
- 业务组件应通过 `var(--token-name)` 使用变量，不应重复声明同义变量

---

## 2. 分层模型（必须遵守）

Token 按层次分为 4 层：

1. **Primitive Tokens**（基础原语）
   - 例如：`--rgb-emerald-500`、`--rgb-slate-900`
   - 只表达“是什么值”，不表达用途

2. **Semantic Tokens**（语义层）
   - 例如：`--color-text-primary`、`--color-border-soft`、`--color-focus-ring`
   - 表达“用于什么语义场景”

3. **Component Tokens**（组件语义层）
   - 例如：`--auth-card-bg`、`--filelist-shadow-panel`、`--filters-surface-border`
   - 表达“某个组件系统中的语义”

4. **Local Mapping Tokens**（局部映射层，可选）
   - 例如在文件列表作用域里：
     - `--glass-bg-a: var(--filelist-glass-bg-strong);`
   - 仅用于兼容已有样式结构，不应无限新增

---

## 3. 命名规范

### 3.1 基础命名格式

统一使用 kebab-case：

- `--color-text-primary`
- `--filelist-bar-gap`
- `--auth-button-gradient`

### 3.2 前缀约定

- 全局语义：`--color-*`、`--surface-*`、`--radius-*`、`--shadow-*`、`--space-*`
- 组件域：
  - `--auth-*`
  - `--filelist-*`
  - `--filters-*`
  - `--nav-*`
  - `--cta-*`

### 3.3 禁止事项

- 禁止出现无语义命名：`--blue1`、`--myColor`、`--tmp-shadow`
- 禁止在组件内再造同义 token（例如已经有 `--color-text-primary`，又写 `--page-main-text`）
- 禁止把业务词写进全局 token（例如 `--invoice-danger-red`）

---

## 4. 使用规则（强约束）

### 4.1 一律优先 token，不写裸值

**不推荐：**

- `color: rgba(255,255,255,0.92);`
- `border-color: #ffffff33;`
- `border-radius: 18px;`

**推荐：**

- `color: var(--color-text-primary);`
- `border-color: var(--color-border-soft);`
- `border-radius: var(--radius-lg);`

### 4.2 组件内优先“组件语义 token”

如认证页按钮，请使用：

- `--auth-button-gradient`
- `--auth-button-ring`

不要直接在组件里写 `--rgb-*`，也不要重复写 Tailwind 固定色值。

### 4.3 允许使用 `rgb(var(--rgb-*), alpha)` 组合透明度

当确实需要不同透明度时，允许：

- `rgba(var(--rgb-white), 0.16)`

但优先顺序是：

1) 先找已有 semantic/component token  
2) 没有再组合 primitive  
3) 仍没有再新增 token

### 4.4 状态样式必须成组

交互状态至少包含：

- 默认态（default）
- 悬停态（hover）
- 焦点态（focus-visible）
- 禁用态（disabled，如适用）

且同一状态优先沿用同一组 token，避免每个状态各写一套独立色值。

---

## 5. Tailwind 与 Tokens 的协作规范

### 5.1 推荐写法

在 Tailwind class 中使用 CSS 变量值：

- `text-[var(--auth-title-text)]`
- `border-[var(--auth-card-border)]`
- `bg-[image:var(--auth-button-gradient)]`
- `shadow-[var(--auth-card-shadow)]`

### 5.2 不推荐写法

同一个组件里混用大量固定 Tailwind 颜色（如 `text-slate-300`、`border-white/20`）和 token，容易漂移。

### 5.3 例外场景

以下情况可暂时用固定值：

- 第三方组件强约束样式，无法稳定接 token
- 快速实验代码（需在 PR 中标注 TODO，后续收敛）

### 5.4 强制范围：页面级容器与通用组件（治理规则）

为避免主题扩展/风格调整时“全站找颜色”，以下目录中的 UI 代码必须以 **Semantic / Component Tokens** 为唯一颜色来源：

- `src/pages/**`
- `src/components/layout/**`
- `src/components/common/**`

#### 5.4.1 禁止项（在以上目录中）

- 禁止使用 Tailwind 调色板颜色：`bg-slate-*`、`text-emerald-*`、`border-gray-*`、`ring-blue-*`、`from-purple-*` 等
- 禁止使用透明度拼接的固定色：`border-white/20`、`bg-black/50` 等

#### 5.4.2 允许项

- 布局类（不涉及颜色语义）：`flex/grid/gap/p-*`、`rounded-*`、`shadow-*`、`z-*` 等
- 语义 token 映射写法：
  - `text-[var(--color-text-primary)]`
  - `bg-[var(--surface-page)]`
  - `border-[var(--color-border-soft)]`
  - `ring-[var(--color-focus-ring)]`
  - `bg-[image:var(--auth-button-gradient)]`
- 非语义颜色关键字（无主题含义）：`bg-transparent`、`text-current`

#### 5.4.3 渐进式落地（避免全量重写）

- 旧代码允许暂存，但只要在上述目录中修改了某个文件（哪怕只是改文案/交互），该文件中的颜色硬编码应一并迁移到 token
- 如果当前语义缺少 token：优先新增 **Semantic / Component Token**，禁止在页面里临时“就写一个颜色”

---

## 6. 新增 Token 流程（PR 必做）

新增 token 前，请按顺序检查：

1. 现有 token 是否可复用？
2. 这是语义层还是组件层？
3. 命名是否符合前缀规则？
4. 是否会与既有 token 语义重复？

PR 中必须包含：

- 新增 token 列表
- 使用位置
- 为什么不能复用旧 token
- 是否影响视觉回归（截图/说明）

---

## 7. 迁移策略（避免“全量重写”风险）

建议按域渐进迁移：

1. `auth` 域
2. `filelist` 域
3. `filters` 域
4. 其他页面和对话框

每次迁移应满足：

- 单域内视觉一致
- 无构建错误
- 不引入可见回归

---

## 8. 代码评审检查清单

评审样式变更时，至少检查以下项：

- [ ] 是否新增了可复用 token 却写了硬编码
- [ ] 是否出现同义 token 重复定义
- [ ] 是否遵循命名前缀规范
- [ ] 是否把 primitive 直接暴露到业务组件（应优先 semantic/component）
- [ ] `pages/layout/common` 目录是否仍存在 Tailwind 调色板颜色（必须迁移到 token）
- [ ] 是否覆盖了 hover/focus/disabled 状态
- [ ] 是否对深色场景保持一致（本项目默认深色）

---

## 9. 常见反模式（请避免）

1. **在 TSX 里直接堆长串颜色 class**
   - 后果：改主题成本极高

2. **同一语义在多个文件重复写值**
   - 后果：视觉漂移、维护困难

3. **把 token 当“变量垃圾桶”**
   - 后果：命名失控，没人知道该用哪个

4. **只定义 token 不落地替换**
   - 后果：看起来有系统，实际上无治理收益

---

## 10. 推荐实践示例（简化版）

```css
/* ✅ component semantic */
.auth-card {
  border: 1px solid var(--auth-card-border);
  background: var(--auth-card-bg);
  box-shadow: var(--auth-card-shadow);
}
```

```tsx
// ✅ tailwind + token
<div className="border border-[var(--auth-card-border)] bg-[var(--auth-card-bg)] shadow-[var(--auth-card-shadow)]" />
```

```css
/* ⚠️ 仅在无语义 token 时，临时使用 primitive 组合透明度 */
.custom-glow {
  box-shadow: 0 0 20px rgba(var(--rgb-cyan-400), 0.2);
}
```

---

## 11. 流体自适应规范（Fluid Tokens）

### 11.1 原则

所有"用户可感知尺寸"的 token **必须使用 `clamp()` 流体值**，使其随视口宽度平滑缩放。
仅以下类型允许保持固定值：

| 允许固定值的场景 | 原因 |
|---|---|
| 颜色 / 透明度（rgba 值） | 与视口大小无关 |
| `--radius-pill: 999px` | 胶囊形始终全圆，无需缩放 |
| `--focus-outline-width/offset`（1–2px） | 无障碍焦点环，缩放无意义 |
| `--filters-dropdown-z`（z-index） | 层级值，非视觉尺寸 |
| RGB 通道原语（`--rgb-*`） | 纯数值通道，非尺寸 |

### 11.2 `clamp()` 书写格式

```
clamp(<小屏下限>, <视口比例>, <大屏上限>)
```

- **下限**：移动端（≈375px 视口）时的最小可用值
- **比例**：以 `vw` 为单位的线性插值斜率
- **上限**：桌面端（≈1440px 视口）时的设计稿原始值

示例：

```css
/* 圆角：小屏 12px → 大屏 18px */
--filelist-radius-main: clamp(12px, 1.4vw, 18px);

/* 模糊：小屏 16px → 大屏 24px */
--glass-blur-strong: clamp(16px, 2vw, 24px);

/* 阴影偏移：小屏 14px → 大屏 22px */
--shadow-glass-lg: 0 clamp(14px, 1.8vw, 22px) clamp(48px, 6vw, 78px) rgba(...);
```

### 11.3 已流体化的 token 清单

以下类别的所有 token 已完成 `clamp()` 流体化：

| 类别 | 涉及 token | 说明 |
|---|---|---|
| **Glass Blur** | `--glass-blur-strong/medium/soft` | 模糊半径随视口缩放，小屏减轻性能压力 |
| **Radius** | `--radius-sm/md/lg/xl` | 全局圆角流体化 |
| **File List Radius** | `--filelist-radius-main/sub` | 卡片 & 缩略图圆角流体化 |
| **Shadows** | `--shadow-glass-lg/md/card`、`--shadow-neon-*` | 阴影偏移与扩散随视口缩放 |
| **CTA Shadow** | `--cta-primary-shadow` | CTA 按钮阴影流体化 |
| **Auth Shadow** | `--auth-card-shadow` | 认证卡片阴影流体化 |
| **Filters Shadow** | `--filters-surface-shadow` | 筛选栏阴影流体化 |
| **Spacing / Heights** | `--space-bar-*`、`--control-height-*` | 已有 clamp()，无需改动 |
| **Typography** | `--font-size-ui-*`、`--nav-*-font-size` | 已有 clamp()，无需改动 |
| **Navigation** | `--nav-panel-*`、`--nav-control-*`、`--nav-chip-*` 等 | 已有 clamp()，无需改动 |

### 11.4 新增 token 时的流体化检查

新增任何尺寸类 token 时，PR 必须回答：

1. 该值是否为用户可感知的视觉尺寸（圆角、阴影、模糊、间距等）？
2. 如果是 → 必须使用 `clamp()`，并给出下限、比例、上限三个值的依据。
3. 如果不是（颜色、z-index、比例百分比等）→ 在 PR 中说明原因。

---

## 12. 维护建议

- 每月做一次 token 去重巡检
- 组件新增样式优先提炼到 component token
- 文档与 `tokens.css` 同步更新，避免"有实现无规范"
- 定期检查是否有新增的固定尺寸 token 遗漏了 `clamp()` 流体化

---

## 13. 结论

Design Tokens 不是"换个地方写颜色"，而是样式治理体系。  
请严格遵循：**先复用、再新增；先语义、后取值；先组件一致、后局部特例。**
