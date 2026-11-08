# 常见问题

[English](../FAQ.md) | 简体中文

**需要单独安装 Ariadne 引擎吗？**
需要。AriadneBuddy 桥接外部 [ariadne-tps](https://github.com/zhaorui-bi/Ariadne)
检出（其 `.venv` 自动探测）。把 `ARIADNE_REPO` 指向它，或在
`ariadnebuddy onboard` 时接受探测到的仓库。

**没有 torch/transformers 会怎样？**
ESM2 语义打分不可用。闭环照常运行：控制器打开 `esm_unavailable` 门，
你以 `proceed_without_esm` 显式豁免，提名基于 HMM + 特征空间证据，结果
标记为 `conditional_nomination` 并附限制说明。安装 `ariadne-tps[esm]`
即可启用语义打分。

**模型会不会编造分数？**
不允许。所有科学数字只能读取自引擎产物；技能、回复风格指南与确定性
审计共同约束这一点。证据行的唯一事实来源是引擎输出。

**提名候选等于已证实的酶吗？**
不等于。提名是带确定性证据（阈值、最近参考、概率）的筛选假说。异源
表达与产物确证（GC-MS 等）仍然必要——这正是 experiment/validation 阶段
所记录的内容。

**任务为什么停在 `nomination_review` / `scientific_review`？**
审计通过会打开 `nomination_review`（批准后进入实验设计）；审计警告/失败
打开 `scientific_review`（修订请求或修复环境）。两者都是有意的决策点。

**凭据存在哪里？**
`~/.ariadne`，权限 0600/0700。API Key 只来自环境变量或凭据存储，绝不
写入溯源清单或研究产物。

**能批量做研究吗？**
可以——参见 `ariadne-campaign` 技能：冻结问题矩阵、公平的单因子对比、
逐运行指纹。

**与直接运行 `ariadne` Python CLI 有何不同？**
引擎完全一致。AriadneBuddy 增加了智能体层（专家角色、知识阶段、门禁）、
带溯源清单的持久作业、确定性提名审计，以及古希腊风格的交互式工作台。
