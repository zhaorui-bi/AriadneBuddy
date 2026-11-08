<p align="center">
  <img src="./docs/logo.svg" alt="Ariadne — 官方完整版徽标，女神线稿与字标" width="440">
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

- **六位专家智能体**——文献调研员、假说架构师、途径重构师、提名官、实验
  设计师、验证解读员——撰写知识阶段，并在每条回复中声明角色。
- **三台确定性引擎即工具**——HMM 检索（pyhmmer）、ESM2 语义打分、特征空间
  结构检索（最近参考分类）。所有分数、E 值、概率与最近参考都来自引擎产物；
  对话模型从不编造科学。
- **诚实的人机门禁**——假说审批、提名审批、迭代/结题决策都是显式关注项。
  调用方声明的响应不是已验证的人工批准，审计失败永远无法被豁免成成功。

它贯通的闭环——**计算提名 → 实验设计 → 验证解读 → 迭代优化**——运行于 CLI、
完整终端 TUI、本地 Web 工作台与 Electron 桌面应用，视觉采用 Ariadne 设计
语言：羊皮纸、爱琴海蓝、铜绿、鎏金、陶瓦红，以及女神线稿下的一条希腊回纹。

## <img src="./docs/images/icons/ring.svg" width="22" height="22" alt="" align="top"> 科学闭环

```
就绪检查 → 文献调研 → 假说生成 ──审批──→ 途径重构
              ↑                                │
              │        发现（HMM 检索）
          迭代优化      过滤（质控 + 去冗余）
              │        提名（ESM2 语义打分 + 结构检索）
        验证解读 ←── 实验设计 ←──审批── 审计（主张-证据台账）
              └────────── 结题 → 交接（经校验）
```

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
| 交接 | 系统 | 血缘校验后的发布：`validated` | 任务记录 + 溯源清单 |

每个引擎作业都携带 `run-manifest.json`（请求、输入、非密科学配置与配置输出的
sha256 指纹），控制器在消费任何阶段产物前都会重新校验。没有
torch/transformers 时闭环照常运行——显式 `proceed_without_esm` 豁免后，提名由
HMM + 特征空间证据承载，结果为 `conditional_nomination`。

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

**前置条件** —— Node.js ≥ 24.15、npm、pnpm 12；Python 3.10+ 与
[ariadne-tps](https://github.com/zhaorui-bi/Ariadne) 检出（`pyhmmer、
pyrodigal、scikit-learn、openpyxl`，检出内 `.venv` 自动探测）；可选
`pip install ariadne-tps[esm]` 启用 ESM2 打分；任意 OpenAI 兼容模型 API Key
（无需登录流程）。

```bash
git clone https://github.com/zhaorui-bi/AriadneBuddy && cd AriadneBuddy
npm run setup                                          # 安装 + 构建 + 品牌化 Web UI
./bin/ariadnebuddy onboard --ariadne-repo /path/to/Ariadne \
                           --provider zai --api-key-env ZAI_API_KEY
./bin/ariadnebuddy doctor --probe                      # 一键健康检查
```

## <img src="./docs/images/icons/flask.svg" width="22" height="22" alt="" align="top"> 使用

```bash
./bin/ariadnebuddy web        # 古希腊风格 Web 工作台 → http://127.0.0.1:58627
./bin/ariadnebuddy            # 完整终端 TUI
./bin/ariadnebuddy chat       # 轻量 REPL
npm start                     # Electron 桌面应用
```

然后直接下令——*“用 Ariadne 引擎对 input/all_tps.fasta 做 cembranoid CeeSs
提名，走完整闭环”*——并在各门禁处审批。也支持免模型任务控制
（`ariadnebuddy research create|advance|respond|cancel`）；而

```bash
node engine/apps/ariadne-buddy/scripts/run-real-engine-demo.mjs /path/to/Ariadne
```

会用真实 pyhmmer/sklearn 引擎跑完整闭环，并打印提名候选及其证据。

## <img src="./docs/images/icons/book.svg" width="22" height="22" alt="" align="top"> 文档

| 文档 | 内容 |
| --- | --- |
| [快速上手](./docs/zh-CN/QUICKSTART.md) | 安装、引导、验证、首次运行 |
| [架构](./docs/ARCHITECTURE.md) | 四层结构、边界、安全姿态 |
| [科学工作流纪律](./docs/SCIENTIFIC_WORKFLOWS.md) | 证据分类、阶段契约、表述规范 |
| [研究任务](./docs/RESEARCH_TASKS.md) | 状态机、响应动作、保证 |
| [常见问题](./docs/zh-CN/FAQ.md) · [故障排查](./docs/zh-CN/TROUBLESHOOTING.md) · [发布流程](./docs/RELEASE.md) | 解答、修复、发版 |
| English | [Quick start](./docs/QUICKSTART.md) · [FAQ](./docs/FAQ.md) · [Workflow](./docs/SCIENTIFIC_WORKFLOWS.md) |

## <img src="./docs/images/icons/filter.svg" width="22" height="22" alt="" align="top"> 验证

一切由本地 `npm run check` 把关——lint、类型检查、覆盖率门禁测试、Python
适配器套件、打包、桌面启动、TUI 回归，以及 MCP / 研究 / Web 冒烟；研究冒烟
驱动整个闭环直至验证交接。

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

## <img src="./docs/images/icons/output.svg" width="22" height="22" alt="" align="top"> 许可与致谢

MIT。基于 [OpenAqua-Harness](https://github.com/zhaorui-bi/OpenAqua-Harness)
模板构建，由内置的 [Kimi Code](https://github.com/MoonshotAI/kimi-code)
智能体引擎驱动（许可见 `engine/`），以外部检出方式桥接 MIT 许可的
[ariadne-tps](https://github.com/zhaorui-bi/Ariadne) 引擎。提名候选在任何
功能声明之前仍需异源表达与产物确证——筛选分数不是活性。
