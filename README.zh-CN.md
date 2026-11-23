<p align="center">
  <img src="./docs/logo.svg" alt="Ariadne — 官方完整版徽标，女神线稿与字标" width="560">
</p>

<p align="center">
  <strong>把一个研究问题，变成一份经过验证的 cembrene 合酶候选名单。</strong><br>
  <em>Ariadne 引擎的多智能体伴侣——六位专家智能体、三台确定性引擎、一条可审计的闭环，没有黑箱终点。</em>
</p>

<p align="center">
  <em>Journal of Natural Products</em> (2026) &nbsp;·&nbsp; DOI: <a href="https://doi.org/10.1021/acs.jnatprod.6c00686">10.1021/acs.jnatprod.6c00686</a>
</p>

<p align="center">
  <a href="./README.md">English</a> &nbsp;·&nbsp;
  <a href="#引用">引用</a> &nbsp;·&nbsp;
  <a href="./docs/zh-CN/QUICKSTART.md">文档</a>
</p>

|         |                                                                        |
| ------- | ---------------------------------------------------------------------- |
| 论文    | [![Journal of Natural Products 2026][jnp]][paper] [![DOI][doi]][paper] |
| 引擎    | [![ariadne-tps 1.1.0][engine]][engine-repo] [![Python ≥ 3.10][python]][engine-repo] |
| 软件    | [![Version][version]][releases] [![Node ≥ 24.15][node]][releases] [![License MIT][license]][license-file] |

[jnp]: https://img.shields.io/badge/J.%20Nat.%20Prod.-2026-4B607C?style=flat-square
[doi]: https://img.shields.io/badge/DOI-10.1021%2Facs.jnatprod.6c00686-4B607C?style=flat-square
[paper]: https://doi.org/10.1021/acs.jnatprod.6c00686
[engine]: https://img.shields.io/badge/ariadne--tps-1.1.0-4B607C?style=flat-square
[python]: https://img.shields.io/badge/Python-%E2%89%A53.10-4B607C?style=flat-square&logo=python&logoColor=white
[engine-repo]: https://github.com/zhaorui-bi/Ariadne
[version]: https://img.shields.io/badge/Version-0.1.0--beta.1-4B607C?style=flat-square
[node]: https://img.shields.io/badge/Node-%E2%89%A524.15-4B607C?style=flat-square&logo=node.js&logoColor=white
[releases]: https://github.com/zhaorui-bi/AriadneBuddy
[license]: https://img.shields.io/badge/License-MIT-4B607C?style=flat-square
[license-file]: ./LICENSE

<p align="center"><sub>Beta 候选版 · v0.1.0-beta.1</sub></p>

---

## <img src="./docs/images/icons/discovery.svg" width="22" height="22" alt="" align="top"> 这是什么

**AriadneBuddy** 把已发表的 [Ariadne](https://github.com/zhaorui-bi/Ariadne)
平台——*J. Nat. Prod.* 2026 报道的珊瑚 cembrene 类合酶（CeeSs）背后的四阶段、
全程可审计流水线——包进一个多智能体工作台，让它行走的是完整的科学方法，
而不只是筛选：

- **专家分工与独立复核**——协调智能体按阶段组织证据与提交研究产物，可将文献
  核验、假说审查与计算结果质控交给有独立上下文的子智能体复核。
- **三台确定性引擎即工具**——HMM 检索（pyhmmer）、ESM2 语义打分、特征空间
  结构检索（最近参考分类）。所有分数、E 值、概率与最近参考都来自引擎产物；
  对话模型从不编造科学。
- **研究会话**——从 Web 或桌面端侧栏的会话列表选择任务，即可查看当前进度、结果和待审事项。
  展开「运行与文件记录」可查看计算作业、经校验的产物和任务轨迹。
  系统记录提交方声明的决定，审计失败会阻止交接。

它贯通的闭环——**计算提名 → 实验设计 → 验证解读 → 迭代优化**——运行于 CLI、
完整终端 TUI、本地 Web 与 Electron 桌面应用。所有界面共用同一层外观：羊皮纸与墨的
色阶、四种颜料，以及刻出的希腊回纹装饰。[设计语言](./docs/zh-CN/DESIGN.md) 是令牌
参考。

动物天然产物发现的前两阶段分别解决了棘皮动物酶的可审计挖掘，以及软体动物研究中
通过 AFPK-finder 区分 FAS、PKS 与 AFPK 的批量筛查。AriadneBuddy 的第三阶段把
计算、证据审核和实验反馈组织成可追溯的研究流程。在 TPS/CeeSs 闭环之外，工作台
也支持软体动物 KS 三模型筛查、原版 AFPK-finder 调用、论文证据对照和候选名单审核，详见
[软体动物案例](./examples/cases/AFPK_MOLLUSC.md)。

## <img src="./docs/images/icons/ring.svg" width="22" height="22" alt="" align="top"> 科学闭环

<p align="center">
  <img src="./docs/images/loop.svg" alt="闭环研究回路：希腊回纹边框内的凹槽柱阶段、三处人工门禁的月桂枝，以及承载迭代决策从验证解读回到假说生成的阿里阿德涅之线" width="720">
</p>

| 阶段 | 归属 | 做什么 | 冻结产物 |
| --- | --- | --- | --- |
| 就绪检查 | 系统 | 后端健康、引擎身份、参考数据 | 冻结授权 + 后端指纹 |
| 文献调研 | 智能体 | 可引用来源、发现、空缺 | `sources / findings / gaps` |
| 假说生成 | 智能体 | 与目标类别绑定的可检验假说 | `hypotheses[{statement, prediction}]` |
| **门禁** | **人** | 计算开销发生前的审批 | — |
| 途径重构 | 智能体 | 底物 → 产物步骤 + 待填酶位 | `product / steps / enzyme_slots` |
| 发现 | 引擎 | pyhmmer 最佳命中检索 + 阈值过滤 | 候选 FASTA + 命中表 |
| 过滤 | 引擎 | 覆盖度 / 长度 / 近冗余质控 | 过滤后 FASTA + 报告 |
| 提名 | 引擎 | ESM2 CeeSs 打分 + 最近参考检索 | 带完整证据行的候选名单 |
| 审计 | 引擎 | 主张-证据台账（NOM-001…008） | 逐候选 pass / warn / fail |
| **门禁** | **人** | 实验开始前的名单审批 | — |
| 实验设计 | 智能体 | 表达体系、检测、对照、判据 | `designs[]` |
| 验证解读 | 智能体 | 结果（支持/否定/不确定）+ 解读 | `records[]` |
| **门禁** | **人** | 迭代（≤ 4 轮，回到假说）或结题 | — |
| 交接 | 系统 | 校验来源并完成验证记录审阅（`validated`） | 任务记录 + 溯源清单 |

每个引擎作业都携带 `run-manifest.json`（请求、输入、非密科学配置与配置输出的
sha256 指纹），控制器在消费任何阶段产物前都会重新校验。没有
torch/transformers 时闭环照常运行——显式 `proceed_without_esm` 豁免后，提名由
HMM + 特征空间证据承载，结果为 `conditional_nomination`。

## <img src="./docs/images/icons/visualize.svg" width="22" height="22" alt="" align="top"> 外观

色板是羊皮纸与墨的色阶上的四种颜料。羊皮纸承载工作，墨承载文字，颜色只在一个界面
必须表态时出现：aegean 表示交互状态，terracotta 表示一切等待人工决定的事项，olive
表示经核验的证据。

<table>
  <thead>
    <tr><th>令牌</th><th>浅色</th><th>深色</th></tr>
  </thead>
  <tbody>
    <tr><td>--tb-paper</td><td style="background:#fbfbfa;width:72px;height:20px;border:1px solid rgb(0 0 0 / 0.25)">&#160;</td><td style="background:#171717;width:72px;height:20px;border:1px solid rgb(255 255 255 / 0.25)">&#160;</td></tr>
    <tr><td>--tb-ink</td><td style="background:#242424;width:72px;height:20px;border:1px solid rgb(0 0 0 / 0.25)">&#160;</td><td style="background:#e8e8e8;width:72px;height:20px;border:1px solid rgb(255 255 255 / 0.25)">&#160;</td></tr>
    <tr><td>--tb-aegean</td><td style="background:#1f5688;width:72px;height:20px;border:1px solid rgb(0 0 0 / 0.25)">&#160;</td><td style="background:#7fb2d9;width:72px;height:20px;border:1px solid rgb(255 255 255 / 0.25)">&#160;</td></tr>
    <tr><td>--tb-terracotta</td><td style="background:#a8452c;width:72px;height:20px;border:1px solid rgb(0 0 0 / 0.25)">&#160;</td><td style="background:#e08a63;width:72px;height:20px;border:1px solid rgb(255 255 255 / 0.25)">&#160;</td></tr>
    <tr><td>--tb-olive</td><td style="background:#4f6021;width:72px;height:20px;border:1px solid rgb(0 0 0 / 0.25)">&#160;</td><td style="background:#a3b86a;width:72px;height:20px;border:1px solid rgb(255 255 255 / 0.25)">&#160;</td></tr>
    <tr><td>--tb-marble</td><td style="background:#f4f1ea;width:72px;height:20px;border:1px solid rgb(0 0 0 / 0.25)">&#160;</td><td style="background:#232323;width:72px;height:20px;border:1px solid rgb(255 255 255 / 0.25)">&#160;</td></tr>
  </tbody>
</table>

## <img src="./docs/images/icons/genome.svg" width="22" height="22" alt="" align="top"> 21 个智能体工具

| 分组 | 工具 |
| --- | --- |
| 引擎 | `ariadne_status` · `ariadne_catalog` · `ariadne_build_hmm` · `ariadne_discover` · `ariadne_filter` · `ariadne_score_candidates` · `ariadne_classify` · `ariadne_pipeline_run` · `ariadne_audit_nomination` |
| 持久作业 | `ariadne_job_list` · `ariadne_job_status` · `ariadne_job_manifest` · `ariadne_job_log` · `ariadne_job_artifacts` · `ariadne_job_cancel` |
| 研究控制器 | `ariadne_research_create` · `ariadne_research_status` · `ariadne_research_list` · `ariadne_research_advance` · `ariadne_research_respond` · `ariadne_research_cancel` |

## <img src="./docs/images/icons/target.svg" width="22" height="22" alt="" align="top"> 提名请求示例

```json
{
  "target_class": "cembrene-class TPS (CeeSs)",
  "input_proteins": ["proteins.faa"],
  "query_hmm": "input/query.hmm",
  "reference_dir": "input/references",
  "tps_workbook": "TPS.xlsx",
  "thresholds": { "min_score": 0, "max_evalue": 0.001,
                  "min_length": 300, "ceess_threshold": 0.9, "top_k": 5 }
}
```

完整可运行案例见 [`examples/cases/`](./examples/cases/)：标准 CeeSs 筛选、
宽松探索筛选、途径优先的 TPS 普查。

## <img src="./docs/images/icons/install.svg" width="22" height="22" alt="" align="top"> 安装

**前置条件** —— Node.js ≥ 24.15、npm（`packageManager` 声明 npm@12.0.2）、pnpm 12
（devDependency）；Python 3.10+ 与
[ariadne-tps](https://github.com/zhaorui-bi/Ariadne) 检出（`pyhmmer、
pyrodigal、scikit-learn、openpyxl`；解释器先取 `ARIADNE_PYTHON`，再取检出内
`.venv` 或 `venv`，最后取 `PATH` 上的 `python3`/`python`）；可选
`pip install ariadne-tps[esm]` 启用 ESM2 打分；任意 OpenAI 兼容模型 API Key
（无需登录流程）。

```bash
git clone https://github.com/zhaorui-bi/AriadneBuddy && cd AriadneBuddy
npm run setup                                          # 安装 + 构建 + 品牌化 Web UI
./bin/ariadnebuddy onboard --ariadne-repo /path/to/Ariadne \
                           --provider zai --api-key-env ZAI_API_KEY
./bin/ariadnebuddy doctor --probe --probe-model        # 一键健康检查
```

引导分六个编号步骤，且不会静默收场：若最终没有配置默认模型，它会打印确切的修正命令
`ariadnebuddy onboard --provider <id> --api-key-env <VAR>` 并以非零码退出。
`./bin/ariadnebuddy config show` 可直接打印生效的提供方、模型、后端、技能目录与
MCP 注册情况，无需运行完整 doctor。

## <img src="./docs/images/icons/flask.svg" width="22" height="22" alt="" align="top"> 使用

```bash
./bin/ariadnebuddy web        # 古希腊风格 Web 工作台 → http://127.0.0.1:58627
./bin/ariadnebuddy            # 完整终端 TUI（等同 `ariadnebuddy tui`）
./bin/ariadnebuddy chat       # 轻量 REPL
./bin/ariadnebuddy run "<prompt>"   # 一次性：建会话、发一句、流式输出、退出
npm start                     # Electron 桌面应用
```

`run` 面向脚本：`--quiet` 让 stdout 只保留助手文本、进度走 stderr，`--json` 输出单个
结构化信封；`--model`、`--workdir`、`--permission auto|manual|yolo` 可覆盖配置默认值。
全局 `--no-telemetry` 可为 `run`、`chat`、`web` 关闭遥测。

然后直接下令——*“用 Ariadne 引擎对 input/all_tps.fasta 做 cembranoid CeeSs
提名，走完整闭环”*——并在各门禁处审批。也支持免模型任务控制
（`ariadnebuddy research create|status|list|advance|respond|cancel`）；而

```bash
node engine/apps/ariadne-buddy/scripts/run-real-engine-demo.mjs /path/to/Ariadne
```

会用真实 pyhmmer/sklearn 引擎跑完整闭环，并打印提名候选及其证据。

`ariadnebuddy tools` 列出智能体可调用的 21 个工具。`ariadnebuddy reset
--home DIR` 会打印它将删除的全部内容，未加 `--yes` 前不做任何删除；
`--keep-jobs` 保留研究作业存储。

| 退出码 | 含义 |
| --- | --- |
| 0 | 命令正常完成 |
| 1 | 参数被拒绝、必需检查未通过，或安装不完整 |
| 130 | `run` / `chat` 期间按 Ctrl+C 中断 |

## <img src="./docs/images/icons/book.svg" width="22" height="22" alt="" align="top"> 文档

| 文档 | 内容 |
| --- | --- |
| [快速上手](./docs/zh-CN/QUICKSTART.md) | 安装、引导、验证、首次运行 |
| [架构](./docs/ARCHITECTURE.md) | 四层结构、边界、安全姿态 |
| [设计语言](./docs/zh-CN/DESIGN.md) | 色板、令牌与图元层 |
| [术语表](./docs/zh-CN/GLOSSARY.md) | 词汇、任务状态、审计代码 |
| [科学工作流纪律](./docs/zh-CN/DOMAIN_WORKFLOW.md) | 证据分类、阶段契约、表述规范 |
| [研究任务](./docs/RESEARCH_TASKS.md) | 状态机、响应动作、保证 |
| [更新日志](./CHANGELOG.md) · [贡献指南](./CONTRIBUTING.md) · [安全策略](./SECURITY.md) | 发布历史、改动边界、问题上报 |
| [常见问题](./docs/zh-CN/FAQ.md) · [故障排查](./docs/zh-CN/TROUBLESHOOTING.md) · [发布流程](./docs/RELEASE.md) | 解答、修复、发版 |
| English | [Quick start](./docs/QUICKSTART.md) · [Architecture](./docs/ARCHITECTURE.md) · [Design](./docs/DESIGN.md) · [Keyboard](./docs/KEYBOARD.md) · [Glossary](./docs/GLOSSARY.md) · [Examples](./docs/EXAMPLES.md) · [Workflow](./docs/SCIENTIFIC_WORKFLOWS.md) |

品牌资产：`build/logo.svg` 是规范标记——它被打包进桌面应用，并逐字节镜像到 Web UI 的
`web-ui/ariadne-logo.svg`。`docs/logo.svg` 是这两个 README 使用的展示版完整徽标。

文档语言：英文是源语言。`docs/` 下每篇英文文档在 `docs/zh-CN/` 都有中文镜像，两个
README 保持对称。界面自身同时提供两种语言，并跟随宿主系统语言。

## <img src="./docs/images/icons/filter.svg" width="22" height="22" alt="" align="top"> 验证

一切由本地 `npm run check` 把关——lint、类型检查、覆盖率门禁测试、Python
适配器套件、打包、桌面启动、TUI 回归，以及 MCP / 研究 / Web 冒烟；研究冒烟
驱动整个闭环直至验证交接。另有四项契约检查运行在 `npm run check:repo` 中：
仓库门禁本身、固定品牌字面量并解析全部令牌的主题契约、校验文案键一致性与
记录台结构钩子的 desk 契约，以及对生成物 Web UI 的上游遗留扫描。

## <img src="./docs/images/icons/paper.svg" width="22" height="22" alt="" align="top"> 引用

若 AriadneBuddy 对你的研究有帮助，请引用随附的 *Journal of Natural Products*
论文（即 Ariadne 论文）：

> Wang, Y.; Yu, M.; Jiang, Z.; Zhou, C.; Feng, W.; Yu, K.; Ju, J.; Li, F.
> "Identification of Cembrene Synthases Uncovers Polyphyletic Origins of
> 14-Membered Carbocyclic Cembranoids Biosynthesis in Corals."
> *Journal of Natural Products*, **2026**, American Chemical Society.
> DOI: [10.1021/acs.jnatprod.6c00686](https://doi.org/10.1021/acs.jnatprod.6c00686). ISSN 0163-3864.

```bibtex
@article{Wang2026Ariadne,
  author  = {Wang, Yinhao and Yu, Mengmeng and Jiang, Zhaorui and Zhou, Chengyu and Feng, Wei and Yu, Ke and Ju, Jianhua and Li, Feng},
  title   = {Identification of Cembrene Synthases Uncovers Polyphyletic Origins of 14-Membered Carbocyclic Cembranoids Biosynthesis in Corals},
  journal = {Journal of Natural Products},
  year    = {2026},
  doi     = {10.1021/acs.jnatprod.6c00686},
  url     = {https://doi.org/10.1021/acs.jnatprod.6c00686},
  issn    = {0163-3864},
  publisher = {American Chemical Society},
}
```

同时请报告所用 AriadneBuddy 版本（`ariadnebuddy --version`）、ariadne-tps
版本、参考数据快照、HMM 库与 ESM 模型。本软件自身的记录见
[CITATION.cff](./CITATION.cff)。

## <img src="./docs/images/icons/book.svg" width="22" height="22" alt="" align="top"> 支持

- 缺陷、疑问与功能请求：
  [github.com/zhaorui-bi/AriadneBuddy/issues](https://github.com/zhaorui-bi/AriadneBuddy/issues)
- 安全问题：[SECURITY.md](./SECURITY.md) 中说明的私密 advisory 渠道。未修补的漏洞请勿
  开设公开 issue。

## <img src="./docs/images/icons/output.svg" width="22" height="22" alt="" align="top"> 许可与致谢

MIT。基于 [OpenAqua-Harness](https://github.com/zhaorui-bi/OpenAqua-Harness)
模板构建，由内置的 [Kimi Code](https://github.com/MoonshotAI/kimi-code)
智能体引擎驱动（许可见 `engine/`），以外部检出方式桥接 MIT 许可的
[ariadne-tps](https://github.com/zhaorui-bi/Ariadne) 引擎。提名候选在任何
功能声明之前仍需异源表达与产物确证——筛选分数不是活性。
