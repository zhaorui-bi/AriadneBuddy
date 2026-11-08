[English](../TROUBLESHOOTING.md) | 简体中文

# 故障排查

先运行 `./bin/ariadnebuddy doctor --probe`——一次性检查 Node、存储、模型
配置、引擎后端健康、MCP 接线、Web 资产与技能。

## 引擎后端

**`ariadne_backend: not found`**
把 `ARIADNE_REPO` 指向 ariadne-tps 检出，或运行
`ariadnebuddy onboard --ariadne-repo /path/to/Ariadne`。检出需要
`ariadne/__init__.py`、`input/query.hmm`、`input/references/*.afa`，以及
装有 `pyhmmer、pyrodigal、scikit-learn、openpyxl` 的 Python 环境（推荐
检出内 `.venv`）。可用 `ARIADNE_PYTHON` 覆盖解释器，或用
`ARIADNE_COMMAND` 覆盖整条命令。

**`ready_for_pipeline: false`**
适配器的 `health --json` 会说明缺哪个依赖或参考输入。修复环境后对
environment-readiness 关注项回应 `retry`——索引/HMM 库不会被静默重建。

**首次使用 ESM2 报错**
首次打分会从 Hugging Face 下载 ESM2 权重（GB 级）。用 `HF_HOME` 控制
缓存位置，或豁免语义打分。

## 研究任务

**`Research version conflict`**
另一调用已推进任务。用 `research status` 重新读取，按当前 `version`
响应。

**`stage_input` 一直不出现**
关注项由 `advance` 开启。`submit_stage`/`approve` 之后再调用一次
`research advance`。

**`execution_failure`**
查看有界日志：`ariadne_job_log(jobId=…, view='errors')`。修复原因后在
冻结预算内 `retry`。

**`configuration_drift`**
后端命令或科学身份在任务中途变化。保留该运行，为变更后的配置新建
任务。

**`budget_exhausted`**
作业预算（默认 6）耗尽。新建一个单独授权的任务。

## Web / 桌面

**Web UI 资产缺失**——运行 `npm run sync:web`（或完整构建）。
**Bearer-token URL 丢失**——重启 `ariadnebuddy web`，会打印带 `#token=…`
的新 URL；非必要不要绑定非回环地址。
**桌面引擎报错**——查看应用内错误页，其中内嵌了引擎日志末尾。

## 开发

```bash
npm run typecheck && npm test && npm run test:adapter
node engine/apps/ariadne-buddy/scripts/smoke-mcp.mjs
node engine/apps/ariadne-buddy/scripts/smoke-research.mjs
node engine/apps/ariadne-buddy/scripts/smoke-web.mjs
```
