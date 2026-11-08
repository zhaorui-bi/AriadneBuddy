<p align="center">
  <img src="./build/logo-256.png" width="148" alt="AriadneBuddy 徽标 — 官方 Ariadne 线稿">
</p>

<h1 align="center">AriadneBuddy</h1>

<p align="center"><strong>Beta 候选版 · v0.1.0-beta.1</strong></p>

<p align="center">
  <em>循线而行：从文献到经过验证的天然产物候选。</em>
</p>

**AriadneBuddy** 是面向天然产物基因组挖掘的智能体科研工作台。它将领域专家知识
沉淀为智能体可执行的工作流：文献调研员、假说架构师、途径重构师、提名官、
实验设计师、验证解读员等多位专家型智能体分工协同，在有门禁的持久研究回路中
推进；前期开发的 [Ariadne](https://github.com/zhaorui-bi/Ariadne) 确定性引擎
（**HMM 检索**、**ESM2 语义打分**、**特征空间结构检索**）封装为智能体可随时
调用的工具，由此贯通「**计算提名 → 实验设计 → 验证解读 → 迭代优化**」的完整
闭环，并以 CLI、TUI、本地 Web 与 Electron 桌面端的交互式界面支持人机协同决策。

## 科学闭环

```
就绪检查 → 文献调研 → 假说生成 ──审批──→ 途径重构
              ↑                              │
              │        发现（HMM 检索）
          迭代优化      过滤（质控 + 去冗余）
              │        提名（ESM2 语义打分 + 结构检索）
        验证解读 ←── 实验设计 ←──审批── 审计（主张-证据台账）
              └────────── 结题 → 交接
```

知识阶段由专家智能体撰写并冻结为带哈希校验的产物；计算阶段启动带溯源清单的
确定性引擎作业。假说审批、提名审批、迭代/结题等人机决策点是显式的关注项；
调用方声明的响应不会被当作已验证的人工批准。

## 快速开始

```bash
npm run setup            # 安装并构建引擎应用与品牌化 Web UI
./bin/ariadnebuddy onboard --ariadne-repo /path/to/Ariadne   # 引擎 + 模型
./bin/ariadnebuddy web   # 本地工作台 http://127.0.0.1:58627
```

引擎要求：一份 [ariadne-tps](https://github.com/zhaorui-bi/Ariadne) 检出并安装
`pyhmmer、pyrodigal、scikit-learn、openpyxl`（自动探测其 `.venv`）。ESM2 语义
打分另需 `torch`/`transformers`（`pip install ariadne-tps[esm]`）；缺失时闭环
以显式的 `proceed_without_esm` 豁免继续运行。

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

完整示例见 `examples/cases/`，操作契约见
`engine/apps/ariadne-buddy/skills/ariadne/SKILL.md`。

## 许可

MIT。内置的 Kimi Code 引擎保留其自身许可（`engine/`）；Ariadne 引擎作为外部
检出桥接，同为 MIT。
