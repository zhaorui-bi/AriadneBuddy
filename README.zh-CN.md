<p align="center">
  <img src="./build/logo-256.png" width="132" alt="AriadneBuddy — 官方 Ariadne 线稿徽标">
</p>

<h1 align="center">AriadneBuddy</h1>

<p align="center"><strong>Beta 候选版 · v0.1.0-beta.1</strong></p>

<p align="center"><em>循线而行：从文献到经过验证的天然产物候选。</em></p>

<p align="center">
  <a href="./README.md">English</a> · 中文介绍 ·
  <a href="./docs/zh-CN/QUICKSTART.md">快速上手</a> ·
  <a href="./docs/ARCHITECTURE.md">架构</a>
</p>

---

## 为什么做这个软件

发现新的生物合成酶很慢：领域专家要读文献、围绕生物合成途径提出假说、
在基因组里挖掘候选酶、提名候选名单、设计表达实验、解读结果——然后迭代。
每一步都产出下一步所依赖的证据，而这些过程通常不可复现。

**AriadneBuddy** 把这套专家工作流变成智能体可执行的形式。它围绕已发表的
[Ariadne](https://github.com/zhaorui-bi/Ariadne) 珊瑚萜类合酶（TPS）发现引擎
构建——cembranoid 生物合成与 cembrene 类（CeeSs）候选提名
（Wang et al., *J. Nat. Prod.* 2026,
[10.1021/acs.jnatprod.6c00686](https://doi.org/10.1021/acs.jnatprod.6c00686)）——
并将其泛化为任何智能体都能行走、任何人类都能审计的持久门禁研究回路。

三个核心设计：

1. **专家角色即智能体。** 六位专家角色——文献调研员、假说架构师、途径重构师、
   提名官、实验设计师、验证解读员——撰写*知识*阶段；每条回复都声明产出它的角色。
2. **确定性引擎即工具。** 科学结论从不来自对话模型。HMM 检索（pyhmmer）、
   ESM2 语义打分、特征空间结构检索（最近参考分类）以受控子进程运行，其产物
   ——分数、E 值、概率、最近参考——是唯一的证据来源。
3. **人是真实的门禁，不是名义上的。** 假说审批、提名审批、迭代/结题决策都是
   显式关注项；调用方声明的响应不会被当作已验证的人工批准，审计失败也永远
   无法被豁免成成功。

由此贯通闭环——**计算提名 → 实验设计 → 验证解读 → 迭代优化**——并提供 CLI、
完整终端 TUI、本地 Web 工作台与 Electron 桌面应用四种界面，视觉采用 Ariadne
设计语言：羊皮纸、爱琴海蓝、铜绿、鎏金、陶瓦红，与一条希腊回纹饰带。

## 科学闭环

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

没有 torch/transformers 时闭环照常运行：控制器打开 `esm_unavailable` 门，
你显式豁免（`proceed_without_esm`），提名携带 HMM + 特征空间证据，结果标记
`conditional_nomination` 并附限制说明。

## 21 个智能体工具

| 分组 | 工具 |
| --- | --- |
| 引擎 | `ariadne_status` · `ariadne_catalog` · `ariadne_build_hmm` · `ariadne_discover` · `ariadne_filter` · `ariadne_score_candidates` · `ariadne_classify` · `ariadne_pipeline_run` · `ariadne_audit_nomination` |
| 持久作业 | `ariadne_job_list` · `ariadne_job_status` · `ariadne_job_manifest` · `ariadne_job_log` · `ariadne_job_artifacts` · `ariadne_job_cancel` |
| 研究控制器 | `ariadne_research_create` · `ariadne_research_status` · `ariadne_research_list` · `ariadne_research_advance` · `ariadne_research_respond` · `ariadne_research_cancel` |

每个引擎作业都携带 `run-manifest.json`（请求、输入、非密科学配置与配置输出的
sha256 指纹）；控制器在消费任何阶段产物前都会重新校验。

## 提名请求示例

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

完整可运行的案例见 [`examples/cases/`](./examples/cases/)：标准 CeeSs 筛选、
宽松探索筛选、途径优先的 TPS 普查。

## 安装

**前置条件**

- Node.js ≥ 24.15、npm、pnpm 12
- Python 3.10+ 与 [ariadne-tps](https://github.com/zhaorui-bi/Ariadne) 检出，
  安装 `pyhmmer、pyrodigal、scikit-learn、openpyxl`（检出内 `.venv` 自动探测）
- 可选：`pip install ariadne-tps[esm]` 启用 ESM2 语义打分
- 任意 OpenAI 兼容模型 API Key（Z.AI / Kimi Coding / DeepSeek / 自定义），
  无需登录流程

```bash
git clone https://github.com/zhaorui-bi/AriadneBuddy && cd AriadneBuddy
npm run setup                                          # 安装 + 构建 + 品牌化 Web UI
./bin/ariadnebuddy onboard --ariadne-repo /path/to/Ariadne \
                           --provider zai --api-key-env ZAI_API_KEY
./bin/ariadnebuddy doctor --probe                      # 一键健康检查
```

## 使用

```bash
./bin/ariadnebuddy web        # 古希腊风格 Web 工作台 → http://127.0.0.1:58627
./bin/ariadnebuddy            # 完整终端 TUI（AriadneBuddy 欢迎艺术）
./bin/ariadnebuddy chat       # 轻量 REPL
npm start                     # Electron 桌面应用
```

然后直接下令，例如：*“用 Ariadne 引擎对 input/all_tps.fasta 做 cembranoid CeeSs
提名，走完整闭环”*——智能体会加载 `ariadne` 技能、冻结请求并推进回路；你在各
门禁处审批。

也支持免模型任务控制：

```bash
ariadnebuddy research create  --input create.json     # 冻结研究授权
ariadnebuddy research advance --id research_<hash>    # 对账并推进一步
ariadnebuddy research respond --input respond.json --id research_<hash>
ariadnebuddy research cancel  --id research_<hash> --input cancel.json
```

想看真实 pyhmmer/sklearn 引擎跑完整闭环并打印提名候选及其证据：

```bash
node engine/apps/ariadne-buddy/scripts/run-real-engine-demo.mjs /path/to/Ariadne
```

## 文档

| 文档 | 内容 |
| --- | --- |
| [快速上手](./docs/zh-CN/QUICKSTART.md) | 安装、引导、验证、首次运行 |
| [架构](./docs/ARCHITECTURE.md) | 四层结构、边界、安全姿态 |
| [科学工作流纪律](./docs/SCIENTIFIC_WORKFLOWS.md) | 证据分类、阶段契约、表述规范 |
| [研究任务](./docs/RESEARCH_TASKS.md) | 状态机、响应动作、保证 |
| [常见问题](./docs/zh-CN/FAQ.md) · [故障排查](./docs/zh-CN/TROUBLESHOOTING.md) · [发布流程](./docs/RELEASE.md) | 解答、修复、发版 |
| English | [Quick start](./docs/QUICKSTART.md) · [FAQ](./docs/FAQ.md) · [Troubleshooting](./docs/TROUBLESHOOTING.md) · [Workflow](./docs/SCIENTIFIC_WORKFLOWS.md) |

## 验证

以上一切由本地 `npm run check` 把关——lint、类型检查、覆盖率门禁测试（32）、
Python 适配器套件（10）、打包、桌面启动、TUI 回归（188），以及 MCP / 研究 /
Web 冒烟；研究冒烟会驱动整个闭环直至验证交接。

## 引用

若 AriadneBuddy 对你的研究有帮助，请引用本软件与 Ariadne 论文
（Wang et al., *J. Nat. Prod.* 2026,
[10.1021/acs.jnatprod.6c00686](https://doi.org/10.1021/acs.jnatprod.6c00686)），
并报告所用引擎版本、参考数据快照、HMM 库与 ESM 模型。见
[CITATION.cff](./CITATION.cff)。

## 许可与致谢

MIT。基于 [OpenAqua-Harness](https://github.com/zhaorui-bi/OpenAqua-Harness)
模板构建，由内置的 [Kimi Code](https://github.com/MoonshotAI/kimi-code)
智能体引擎驱动（许可见 `engine/`），以外部检出方式桥接 MIT 许可的
[ariadne-tps](https://github.com/zhaorui-bi/Ariadne) 引擎。提名候选在任何
功能声明之前仍需异源表达与产物确证——筛选分数不是活性。
