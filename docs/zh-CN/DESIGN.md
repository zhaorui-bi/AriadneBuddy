# 设计语言

[English](../DESIGN.md) | 简体中文

AriadneBuddy 的界面由一层共用外观构建，来源是
[`engine/apps/ariadne-buddy/theme/appearance.css`](../../engine/apps/ariadne-buddy/theme/appearance.css)。
该文件是对话界面、研究记录台、桌面启动页与桌面「关于」面板共用的颜色、几何与装饰唯
一来源。本文档逐一列出它声明的全部设计令牌与图元，并说明每个图元可以出现在哪里。

文档中使用的闭环图见 [`images/loop.svg`](../images/loop.svg)。

## 出发点

产品本身是一份科学调查的记录，因此界面是一块石面：羊皮纸承载工作，墨承载文字，颜色
只在一个界面必须表态时出现。四种颜料构成全部色板。

## 界面：羊皮纸与墨的色阶

| 令牌 | 浅色 | 深色 | 用途 |
| --- | --- | --- | --- |
| `--tb-paper` | `#fbfbfa` | `#171717` | 工作区画布 |
| `--tb-paper-raised` | `#ffffff` | `#202020` | 抬升卡片、输入区、菜单 |
| `--tb-paper-soft` | `#f2f2f1` | `#242424` | 内容面板、凹槽、侧栏底色 |
| `--tb-paper-deep` | `#ebebea` | `#111111` | 下沉表面、柱础与柱头 |
| `--tb-marble` | `#f4f1ea` | `#232323` | 刻字所在石板 |
| `--tb-marble-vein` | `rgb(0 0 0 / 0.05)` | `rgb(255 255 255 / 0.05)` | 石纹 |
| `--tb-ink` | `#242424` | `#e8e8e8` | 正文 |
| `--tb-ink-strong` | `#151515` | `#f5f5f5` | 标题与强调文字 |
| `--tb-ink-muted` | `#595959` | `#bdbdbd` | 次要文字 |
| `--tb-ink-faint` | `#707070` | `#a3a3a3` | 三级文字 |

以上每个令牌都用 `light-dark()` 同时声明两种配色，深色模式不会回退到只声明浅色的值。
`--tb-line` 与 `--tb-line-strong` 以 13% 与 32% 的不透明度承载同一组边线，
`--tb-shadow-color` 承载层次阴影的色调。

### 色板条

<table>
  <thead>
    <tr><th>令牌</th><th>浅色</th><th>深色</th></tr>
  </thead>
  <tbody>
    <tr><td>--tb-paper</td><td style="background:#fbfbfa;width:96px;height:22px;border:1px solid rgb(0 0 0 / 0.25)">&#160;</td><td style="background:#171717;width:96px;height:22px;border:1px solid rgb(255 255 255 / 0.25)">&#160;</td></tr>
    <tr><td>--tb-paper-raised</td><td style="background:#ffffff;width:96px;height:22px;border:1px solid rgb(0 0 0 / 0.25)">&#160;</td><td style="background:#202020;width:96px;height:22px;border:1px solid rgb(255 255 255 / 0.25)">&#160;</td></tr>
    <tr><td>--tb-paper-soft</td><td style="background:#f2f2f1;width:96px;height:22px;border:1px solid rgb(0 0 0 / 0.25)">&#160;</td><td style="background:#242424;width:96px;height:22px;border:1px solid rgb(255 255 255 / 0.25)">&#160;</td></tr>
    <tr><td>--tb-paper-deep</td><td style="background:#ebebea;width:96px;height:22px;border:1px solid rgb(0 0 0 / 0.25)">&#160;</td><td style="background:#111111;width:96px;height:22px;border:1px solid rgb(255 255 255 / 0.25)">&#160;</td></tr>
    <tr><td>--tb-marble</td><td style="background:#f4f1ea;width:96px;height:22px;border:1px solid rgb(0 0 0 / 0.25)">&#160;</td><td style="background:#232323;width:96px;height:22px;border:1px solid rgb(255 255 255 / 0.25)">&#160;</td></tr>
    <tr><td>--tb-ink</td><td style="background:#242424;width:96px;height:22px;border:1px solid rgb(0 0 0 / 0.25)">&#160;</td><td style="background:#e8e8e8;width:96px;height:22px;border:1px solid rgb(255 255 255 / 0.25)">&#160;</td></tr>
    <tr><td>--tb-ink-strong</td><td style="background:#151515;width:96px;height:22px;border:1px solid rgb(0 0 0 / 0.25)">&#160;</td><td style="background:#f5f5f5;width:96px;height:22px;border:1px solid rgb(255 255 255 / 0.25)">&#160;</td></tr>
    <tr><td>--tb-ink-muted</td><td style="background:#595959;width:96px;height:22px;border:1px solid rgb(0 0 0 / 0.25)">&#160;</td><td style="background:#bdbdbd;width:96px;height:22px;border:1px solid rgb(255 255 255 / 0.25)">&#160;</td></tr>
    <tr><td>--tb-ink-faint</td><td style="background:#707070;width:96px;height:22px;border:1px solid rgb(0 0 0 / 0.25)">&#160;</td><td style="background:#a3a3a3;width:96px;height:22px;border:1px solid rgb(255 255 255 / 0.25)">&#160;</td></tr>
    <tr><td>--tb-aegean</td><td style="background:#1f5688;width:96px;height:22px;border:1px solid rgb(0 0 0 / 0.25)">&#160;</td><td style="background:#7fb2d9;width:96px;height:22px;border:1px solid rgb(255 255 255 / 0.25)">&#160;</td></tr>
    <tr><td>--tb-aegean-deep</td><td style="background:#173f66;width:96px;height:22px;border:1px solid rgb(0 0 0 / 0.25)">&#160;</td><td style="background:#a8cbe6;width:96px;height:22px;border:1px solid rgb(255 255 255 / 0.25)">&#160;</td></tr>
    <tr><td>--tb-terracotta</td><td style="background:#a8452c;width:96px;height:22px;border:1px solid rgb(0 0 0 / 0.25)">&#160;</td><td style="background:#e08a63;width:96px;height:22px;border:1px solid rgb(255 255 255 / 0.25)">&#160;</td></tr>
    <tr><td>--tb-olive</td><td style="background:#4f6021;width:96px;height:22px;border:1px solid rgb(0 0 0 / 0.25)">&#160;</td><td style="background:#a3b86a;width:96px;height:22px;border:1px solid rgb(255 255 255 / 0.25)">&#160;</td></tr>
    <tr><td>--tb-danger</td><td style="background:#8f2d1f;width:96px;height:22px;border:1px solid rgb(0 0 0 / 0.25)">&#160;</td><td style="background:#e08070;width:96px;height:22px;border:1px solid rgb(255 255 255 / 0.25)">&#160;</td></tr>
    <tr><td>--tb-done</td><td style="background:#64734a;width:96px;height:22px;border:1px solid rgb(0 0 0 / 0.25)">&#160;</td><td style="background:#8d9c74;width:96px;height:22px;border:1px solid rgb(255 255 255 / 0.25)">&#160;</td></tr>
  </tbody>
</table>

## 四种颜料

| 令牌 | 浅色 | 深色 | 含义 |
| --- | --- | --- | --- |
| `--tb-aegean` | `#1f5688` | `#7fb2d9` | 阿里阿德涅之线跨越的海——唯一品牌强调色 |
| `--tb-aegean-deep` | `#173f66` | `#a8cbe6` | 悬停与受压时的强调色 |
| `--tb-terracotta` | `#a8452c` | `#e08a63` | 书写故事的陶器——警告、谨慎，以及一切等待人工决定的事项 |
| `--tb-olive` | `#4f6021` | `#a3b86a` | 胜利之枝——成功、完成、经核验的证据 |
| `--tb-marble` | `#f4f1ea` | `#232323` | 刻字所在石板——抬升卡片表面与装饰带 |

`--tb-aegean` 承载交互状态、链接与当前导航项。`--tb-terracotta` 承载一切等待人工决定
的事项。`--tb-olive` 承载成功与经核验的证据。另外两种颜料在不增加色相的前提下扩展了
色板：`--tb-danger`（`#8f2d1f` / `#e08070`）表示失败，`--tb-done`（`#64734a` / `#8d9c74`）
表示已完成的工作。

`--tb-blue`、`--tb-blue-hover`、`--tb-cyan`、`--tb-success`、`--tb-warning` 是兼容别名，
指向上述颜料，使仍在请求蓝色或青色的上游选择器解析到品牌色板，而不是无颜料默认值。

## 语义别名

组件从不直接指名颜料，只指名角色。

| 别名 | 解析到 | 用途 |
| --- | --- | --- |
| `--color-accent` | `--tb-blue` → `--tb-aegean` | 交互状态、链接、当前导航项 |
| `--color-success` | `--tb-success` → `--tb-olive` | 成功、完成、经核验的证据 |
| `--color-warning` | `--tb-warning` → `--tb-terracotta` | 警告，以及一切等待人工决定的事项 |
| `--color-danger` | `--tb-danger` | 失败、阻断状态 |
| `--color-done` | `--tb-done` | 已完成的工作 |
| `--color-marble` | `--tb-marble` | 抬升卡片表面与装饰带 |
| `--color-marble-vein` | `--tb-marble-vein` | 石纹 |
| `--color-rule-frieze` | `--workspace-frieze-ink` | 全部线脚的墨色 |

每个彩色别名都配有一个不超过克制上限的淡色与边线伴侣：`--color-accent-soft` /
`--color-accent-bd`、`--color-success-soft` / `--color-success-bd`、`--color-warning-soft`
/ `--color-warning-bd`、`--color-danger-soft` / `--color-danger-bd`、`--color-done-soft` /
`--color-done-bd`、`--color-terracotta-soft` / `--color-terracotta-bd`，以及
`--color-olive-soft` / `--color-olive-bd`。淡色为颜料的 11–13%，边线为 29–32%。

古典层同时暴露 `--color-aegean`、`--color-aegean-deep`、`--color-terracotta` 与
`--color-olive`，供必须指名颜料本身的表面使用；`--color-rule-frieze-accent` 是回纹带
唯一被允许使用更浓淡色的地方。

## 几何与线脚

| 令牌 | 值 | 含义 |
| --- | --- | --- |
| `--radius-stele` | `2px` | 石板被切出的棱角 |
| `--radius-pill` | `999px` | 仅用于真正的圆 |
| `--shadow-stele` | `0 1px 0 …30%, 0 10px 26px -18px …` | 落在表面上的石板 |
| `--shadow-medallion` | 内描边 + 顶部内高光 | 敲出的圆牌 |
| `--rule-hairline` | `1px solid var(--color-line)` | 刻出的细线 |
| `--rule-egg-and-dart` | 三层渐变，9px 周期 | 蛋矢饰带 |
| `--rule-dentil` | 两层渐变，9px 周期 | 齿饰带 |
| `--workspace-rule` | `3px double var(--color-line-strong)` | 双线 |
| `--workspace-frieze-ink` | `color-mix(in srgb, var(--color-accent) 62%, transparent)` | 回纹带与回纹分隔线的墨色 |

源码中直接写明了几何规则：

> Stone geometry: everything is cut, never pill-shaped, except true circles (avatars,
> swatches, the medallion).

## 字体

标题用衬线，正文用无衬线。

| 令牌 | 字体栈 | 用途 |
| --- | --- | --- |
| `--font-display` | `"Cormorant Garamond Variable", "Noto Serif SC Variable", "Songti SC", STSong, "Source Han Serif SC", Georgia, serif` | 标题与产品名 |
| `--font-editorial` | `"Noto Serif SC Variable", "Songti SC", STSong, "Source Han Serif SC", Georgia, serif` | 铭文与长文 |
| `--font-ui` / `--sans` | `system-ui, "PingFang SC", "Microsoft YaHei", "Noto Sans SC", sans-serif` | 正文、表格、控件 |
| `--workspace-heading-font` | `var(--font-display)` | 各层共用的标题字体 |

Cormorant Garamond Variable 与 Noto Serif SC Variable 随产品发布，由
`assets/ariadne-fonts/` 提供。研究记录台的展示字体从共用令牌派生，而不是第二次指名
字族。

## 克制规则

该规则在 `appearance.css` 中以原文写下：

> The Ariadne identity is built from four pigments and one restraint rule: parchment
> carries the work, ink carries the words, and colour appears only where a surface must
> state something. Never let two chromatic accents share one surface, and keep every wash
> at or below ~13% of its pigment.

落实到实现：

- 每个界面最多一个彩色强调。一个界面只能是 aegean、terracotta 或 olive，不能同时出现
  两种。
- 淡色不高于其颜料的 ~13%（令牌集中为 11–13%）；边线伴侣为 29–32%。
- 装饰是刻出的墨，绝不是彩色。每条线脚都解析到 `--color-rule-frieze` 或 `--color-line`。
- 标题用衬线；正文、表格与控件用无衬线。

## 图元原语

每个原语都在 `appearance.css` 中声明，并附有说明其含义的注释。

| 类 | 它是什么 |
| --- | --- |
| `.stele` | “an upright marble slab carrying an inscription”——细线边、`--radius-stele`、`--shadow-stele`，以及大理石高光上的 10px 蛋矢饰带 |
| `.rule-double` | `--workspace-rule` 双线，用作分节线 |
| `.divider-meander` | “the Greek key (meander). A continuous band, never a single dash.”——高 11px，周期 28px |
| `.medallion` | “a struck medallion: the seal on a verified record”——2.25rem 圆形大理石高光，配圆牌内阴影 |
| `.progress-amphora` | “an amphora filling: progress that reads as a vessel, not a bar.”——1.5rem × 2.5rem，按 `--amphora-fill` 以 aegean 填充 |
| `.cartouche` | “a framed name plate for the product mark”——大理石高光、`--radius-stele`、`--shadow-stele` |
| `.rail-divider--column` | “a fluted column used as a rail divider”——1.5rem × 5.75rem 的重复凹槽 |
| `.workspace-column` | 由 `::before` 与 `::after` 画出柱头与柱础的凹槽柱，尺寸由 `--column-width` 与 `--column-height` 控制 |
| `.workspace-frieze` | 页头下方的 11px 希腊回纹带 |
| `.workspace-mark` | 34px 品牌标记，由 `ariadne-logo.svg` 遮罩并以 `currentColor` 着色 |

## 每个图元可以出现在哪里

| 图元 | 当前实际出现位置 | 来源 |
| --- | --- | --- |
| `.workspace-frieze` | 研究记录台任务页头、元信息行下方 | `theme/research-desk.html` |
| `.workspace-mark` | 研究记录台无脚本卡片；对话侧栏品牌区 | `theme/research-desk.html`、`theme/ariadne.css` |
| `.workspace-column` + `.medallion` | 插画式空状态装饰 | `theme/research-desk.js`（`emptyState`） |
| `.workspace-column` | 桌面启动页与「关于」面板的品牌徽记 | `main.js` |
| `.divider-meander` | 桌面启动页与「关于」面板 | `main.js` |
| `--rule-egg-and-dart` | 桌面启动页品牌线 | `main.js`（`.brand-rule`） |
| `--shadow-medallion`、`--marble-highlight`、`--radius-pill` | 桌面启动页与「关于」面板的标记 | `main.js`（`.mark`） |
| `.stele` | 预留给承载人工决定或冻结产物的界面 | `theme/appearance.css` |
| `.cartouche`、`.cartouche__mark` | 预留给带框的产品名牌 | `theme/appearance.css` |
| `.progress-amphora` | 预留给必须读作容器的进度显示 | `theme/appearance.css` |
| `.rail-divider--column` | 预留给侧栏分隔 | `theme/appearance.css` |
| `.rule-double`、`--rule-dentil` | 预留给分节线与齿饰带 | `theme/appearance.css` |

预留图元随打包的 `brand/appearance.css` 一同发布，可供全部品牌化表面使用；它们声明在
共用层，而不是每个界面各自重画一遍。

## 无障碍保障

`appearance.css` 以三种方式保护图元层；若前两者被移除，主题契约检查会直接让构建失败。

`prefers-reduced-motion: reduce` 会移除 `.stele`、`.medallion`、`.progress-amphora` 与
`.cartouche` 上的全部过渡与动画。

`forced-colors: active` 会把装饰收回系统颜色：`.stele`、`.cartouche`、`.medallion` 与
`.rail-divider--column` 改用 `1px solid CanvasText` 边线与 `Canvas` 背景并去掉阴影；
`.stele::before`、`.divider-meander` 与 `.workspace-frieze` 去掉背景，仅保留
`CanvasText` 下边框；双耳瓶填充变为 `CanvasText`。

打印在下一层的 `research-desk.css` 中处理：打印块按定义把纸设为白色、墨设为黑色，与屏
幕配色无关——这正是主题契约检查将打印块排除在“不得硬编码颜色”规则之外的原因。记录台的
打印样式表同时收起交互控件、把所有折叠的展开区全部打印出来、让表头在每页重复，并隐藏希
腊回纹带。

## 校验

`npm run check:repo` 会对这一层运行三项契约检查：

- `check-theme-contract.mjs`——冻结字面量、每个 `var()` 引用均可解析、每种颜料都声明两
  种配色、图元原语存在，且 `ariadne.css` 与 `research-desk.css` 不含未主题化的颜色。
- `check-desk-contract.mjs`——记录台每个可见文案在两种语言下都能解析、结构钩子存在，且
  打印、`prefers-reduced-motion`、`forced-colors` 三个块齐全。
- `check-brand-leftovers.mjs`——上游产品名、主题标签或品牌蓝色不会在品牌化后残留。
