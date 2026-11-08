# 面向天然产物发现的 Harness 工作流

[English](../SCIENTIFIC_WORKFLOWS.md) | 简体中文

AriadneBuddy 以「提名请求」为工作单元，围绕 Ariadne 确定性引擎与六位
专家型智能体角色，把领域专家知识沉淀为可执行、可审计的科学闭环。

## 六位专家角色

- **文献调研员**：以可引用来源奠基，明确知识空缺。
- **假说架构师**：把假说写成与目标类别绑定的可检验预测。
- **途径重构师**：底物 → 产物的步骤图与待填酶位。
- **提名官**：驱动确定性引擎，只读引擎产物。
- **实验设计师**：为每位提名候选设计表达/检测方案。
- **验证解读员**：区分结果与解读，驱动迭代决策。

每条回复声明其角色；引擎证据、规则结果与模型综合始终分开标注。

## 闭环阶段契约

| 阶段 | 归属 | 产物契约 |
| --- | --- | --- |
| 文献 | 智能体 | `{sources: [{title, doi?, note}], findings: [..], gaps: [..]}` |
| 假说 | 智能体 | `{hypotheses: [{id?, statement, rationale, prediction}]}` → 人审 |
| 途径 | 智能体 | `{substrate?, product, steps: [{transformation, enzyme_class}], enzyme_slots?}` |
| 发现 | 引擎 | pyhmmer 最佳命中检索；`artifacts.proteins` 候选 FASTA + 命中表 |
| 过滤 | 引擎 | 覆盖度/长度/近冗余质控；`artifacts.filtered_fasta` |
| 提名 | 引擎 | ESM2 语义打分（可用时）+ 特征空间结构检索 → 带完整证据的候选名单 |
| 审计 | 引擎 | 主张-证据台账；`pass` 方可进入实验设计 |
| 实验 | 智能体 | `{designs: [{candidate_id, system, construct, assay, controls, decision_criteria}]}` |
| 验证 | 智能体 | `{records: [{candidate_id?, outcome: supported|refuted|inconclusive, interpretation}]}` |
| 迭代 | 人 | 迭代（≤ 4 轮，回到假说）或结题（验证交接） |

## 提名证据底线

在声明的模式下，候选**未被提名**除非：

- HMM 分数 ≥ `min_score` 且 E-value ≤ `max_evalue`（恒定要求）；
- 长度 ≥ `min_length`（警告级）；
- ESM 可用时 CeeSs 概率 ≥ `ceess_threshold`；
- 豁免模式下（`proceed_without_esm`），以珊瑚样特征空间上下文承载提名，
  结果为 `conditional_nomination`。

确定性审计逐行复核（NOM-001…008）；审计失败阻断实验设计，警告必达
人类。

## 示例请求

| 示例 | 行为 |
| --- | --- |
| [CeeSs 珊瑚转录组](../../examples/cases/ceess-coral-transcriptome.json) | 标准阈值提名，进入完整闭环。 |
| [宽松筛选](../../examples/cases/ceess-lenient-screen.json) | 放宽阈值以发现低相似候选；每个提名仍须过审计。 |
| [TPS 普查](../../examples/cases/tps-broad-discovery.json) | 途径优先：先盘点珊瑚样 TPS 同源物，再收敛到 cembranoid 假说。 |

读取 `examples/cases/ceess-coral-transcriptome.json`，用 `requestFile` 调用
`ariadne_research_create`，随后以 `ariadne_research_advance` 推进、以
`ariadne_research_respond` 在各门禁处回应。
