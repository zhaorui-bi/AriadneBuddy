# 术语表

[English](../GLOSSARY.md) | 简体中文

术语按来源分组。凡是代码中的字面标识符，都按代码原样给出。

## 神话到产品

| 术语 | 在 AriadneBuddy 中的含义 |
| --- | --- |
| 阿里阿德涅之线 | 可审计的闭环。每个阶段产物都会被冻结、加指纹，并在控制器消费前重新校验，因此从问题到提名的路径可以逐步回溯 |
| 迷宫 | 带门禁的阶段图。十一个阶段，其中三个是人工门禁，同一时刻只允许一条路径 |
| 闭环 | 就绪检查 → 文献调研 → 假说生成 → 途径重构 → 发现 → 过滤 → 提名 → 审计 → 实验设计 → 验证解读 → 迭代决策 → 交接 |
| 石碑（stele） | 承载铭文的直立石板；在界面中指承载人工决定或冻结产物的表面 |
| 回纹（meander） | 用作连续分隔线的希腊回纹带，绝不是一截短线 |

## 目标类别与酶

| 术语 | 含义 |
| --- | --- |
| CeeSs | cembrene 类萜合酶，产品所包裹的珊瑚研究的目标类别 |
| TPS | 萜合酶，目标类别为 `terpene synthase (TPS, broad)` 时检索的更广泛酶类 |
| HMM | profile 隐马尔可夫模型；检索通过 pyhmmer 运行 |
| ESM2 | 用于 CeeSs 语义打分的蛋白质语言模型 |
| KS | 酮酰合酶结构域；软体动物工作流筛查预先提取的 KS 结构域 |
| AFPK | `afpk-ks` 工作流筛查的 KS 表型，由三个 HMM profile 共同判定，而非单一模型 |
| FAS I | I 型脂肪酸合酶 profile；KS 筛查中比较的三个模型之一 |
| FAS II | 线粒体 II 型脂肪酸合酶 profile；比较的三个模型之一 |
| PKS | 聚酮合酶 profile；比较的三个模型之一 |
| AFPK-finder | 适配器可调用的原版外部 v1.0 工具，用于 t-SNE/HDBSCAN 聚类证据 |

## 研究任务词汇

| 术语 | 含义 |
| --- | --- |
| 轮次（round） | 从假说到验证的一次完整循环。只有选择迭代时，控制器才会开启新一轮 |
| 版本（version） | 任务版本。每次决策都会推进它；若其他界面先记录决策，服务端返回 409，记录台改为重新加载，不会覆盖 |
| 请求修订号（request revision） | 一次引擎请求。产物和作业都归在产生它的修订号下 |
| 门禁（gate） | 循环在记录人工决定前停下的位置 |
| 提交者声明（caller-declared） | 通过界面记录的决定所遵循的契约：它归属于提交者，不等于已验证的人工审批 |
| 条件提名（conditional nomination） | ESM 打分被豁免、由珊瑚样特征空间证据承载提名时记录的科学结论 |
| proceed_without_esm | 显式的 ESM 可用性豁免。审计不会对被豁免的模式再次告警 |
| waitingReason | 任务被阻塞的机器可读原因，在记录台中显示为任务状态 |
| run-manifest.json | 每个作业的溯源记录：请求、输入、非密科学配置与配置输出的 sha256 |
| 科学结论（scientific outcome） | 任务记录的状态、审计状态与局限 |

### waitingReason 取值

记录台优先从任务的未决关注项解析等待原因，回退到任务自身的 `waitingReason`。每个取值都有
确定的英文与中文标签。

| 取值 | 英文标签 | 中文标签 |
| --- | --- | --- |
| `nomination_review` | Shortlist review pending | 待候选审核 |
| `afpk_nomination_review` | Shortlist review pending | 待候选审核 |
| `stage_review` | Hypothesis review pending | 待假说审核 |
| `stage_input` | Stage input pending | 待阶段材料 |
| `iteration_decision` | Iteration decision pending | 待迭代决策 |
| `scientific_review` | Scientific review pending | 待科学复核 |
| `afpk_empty_shortlist` | No AFPK nominations | 暂无 AFPK 提名 |
| `afpk_revision` | Request revision pending | 待修订筛选请求 |
| `environment_readiness` | Runtime setup pending | 待配置运行环境 |
| `configuration_drift` | Configuration changed | 待处理配置变更 |

### 任务与作业状态取值

| 取值 | 含义 |
| --- | --- |
| `open` | 任务进行中，且没有引擎作业在运行 |
| `running` | 已分配引擎作业 |
| `waiting` | 任务被阻塞；请阅读等待原因 |
| `ready` | 可以交接 |
| `cancelled` | 任务已关闭，可在已归档任务中打开 |
| `not_started` | 作业尚未启动 |
| `queued` | 作业排队中 |
| `launching` | 作业正在启动 |
| `succeeded` | 作业成功 |
| `failed` | 作业失败 |

## 审计代码

确定性提名审计会逐行重新检查候选，并给出 `NOM-001` 至 `NOM-008`。致命问题会阻断实验设计；
告警一定会送达人工。

| 代码 | 严重度 | 触发条件 |
| --- | --- | --- |
| `NOM-000` | 致命 | 候选行不是对象 |
| `NOM-001` | 致命 | HMM 分数缺失或低于 `min_score` |
| `NOM-002` | 致命 | HMM E 值缺失或高于 `max_evalue` |
| `NOM-003` | 告警 | 蛋白长度低于 `min_length` |
| `NOM-004` | 致命 | ESM 运行但 CeeSs 概率缺失 |
| `NOM-005` | 致命 | ESM CeeSs 概率低于 `ceess_threshold` |
| `NOM-006` | 告警 | 无语义证据——未使用 ESM 打分，且未显式豁免 |
| `NOM-007` | 告警 | 缺少最近参考 |
| `NOM-008` | 致命 | 提名报告没有候选 |

## 相关

- [科学工作流纪律](../SCIENTIFIC_WORKFLOWS.md) · [示例（英文）](../EXAMPLES.md)
- [研究任务](../RESEARCH_TASKS.md) · [键盘操作（英文）](../KEYBOARD.md)
