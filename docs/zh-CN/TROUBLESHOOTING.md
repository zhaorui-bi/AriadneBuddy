# 故障排查

[English](../TROUBLESHOOTING.md) | 简体中文

先用 `./bin/ariadnebuddy doctor --probe --probe-model`——它一次检查 Node、
存储、模型配置、提供方传输、引擎后端健康、MCP 接线、Web 资产、技能与私有权
限。加 `--json` 可得机器可读报告，含 `passed` / `failed` / `warned` 计数与
逐项修复建议。`config show` 则直接打印生效配置，无需运行完整 doctor。

## 安装与准备

| 现象 | 原因 | 处理 |
| --- | --- | --- |
| `pnpm install` 因 Node 版本失败 | `.npmrc` 的 `engine-strict` 固定了下限 | 使用 Node ≥ 24.15（`.nvmrc` 为 24.15.0） |
| doctor 报 `Web UI assets missing` | `web-ui/` 从未生成 | 运行 `npm run sync:web`，或完整的 `npm run setup` |
| onboard 以 1 退出并提示“No default model is configured” | 安装结束时没有提供方 | 按打印的 `ariadnebuddy onboard --provider <id> --api-key-env <VAR>` 重跑 |
| `--api-key` 与 `--api-key-env` 被同时拒绝 | 两种写法互斥 | 二选一；`--api-key-env` 可避免密钥落入 `config.toml` |
| `--ariadne-command` 与 `--ariadne-repo` 被同时拒绝 | 两种后端形式互斥 | 二选一 |

## 引擎后端

| 现象 | 原因 | 处理 |
| --- | --- | --- |
| `ariadne_backend: not found` | 未检测到检出 | 设置 `ARIADNE_REPO`，或 `ariadnebuddy onboard --ariadne-repo /path/to/Ariadne`。检出需含 `ariadne/__init__.py`、`input/query.hmm`、`input/references/*.afa`，以及 `pyhmmer、pyrodigal、scikit-learn、openpyxl` |
| 用了错误的解释器 | 解析顺序理解有误 | `ARIADNE_PYTHON` 优先，其次是检出内的 `.venv` 或 `venv`，最后是 `PATH` 上的 `python3`/`python`（Windows 上另有 `py -3`）。可用 `ARIADNE_COMMAND` 覆盖整条命令 |
| `ready_for_pipeline: false` | 缺少某个依赖或参考输入 | 读取适配器的 `health --json`，修复环境后对环境就绪 attention 项 `retry`——索引与 HMM 库绝不会被静默重建 |
| `provider_transport` 失败 | 鉴权、base URL 或传输问题 | `doctor --probe-model` 会指出具体检查项与修复建议；自定义提供方请核对 `--base-url` 与 `--provider-type` |
| 首次使用 ESM2 报错 | 检查点从 Hugging Face 下载（约 GB 级） | 用 `HF_HOME` 控制缓存，或以 `proceed_without_esm` 豁免语义打分 |

## 研究任务

| 现象 | 原因 | 处理 |
| --- | --- | --- |
| `Research version conflict` | 其他界面先推进了任务 | 用 `ariadnebuddy research status --id ID` 重新读取，按当前 `version` 回应 |
| `stage_input` 始终不出现 | attention 项在 `advance` 时打开 | `submit_stage` / `approve` 之后再调用一次 `research advance` |
| `execution_failure` | 引擎作业失败 | 用 `ariadne_job_log(jobId=…, view='errors')` 查看有界日志，修因后在预算内 `retry` |
| `configuration_drift` | 任务进行中后端命令或其科学身份发生变化 | 保留该运行，为变更后的配置新建任务 |
| `budget_exhausted` | 作业预算（默认 6）已用尽 | 新建一个单独授权的任务 |
| `The iteration limit (4) is exhausted` | 四轮迭代已用完 | 结束该任务或新建任务 |

## 研究记录台

| 现象 | 原因 | 处理 |
| --- | --- | --- |
| 记录台数据陈旧 | 它只按需重载 | 按 `r`，或切换页签；页面重新可见时也会自行重载 |
| `/` 无法聚焦序列搜索框 | 焦点在输入框内，或有对话框打开 | 先点击页面；这两种情况下快捷键不生效 |
| 门禁只渲染成普通卡片而非高亮面板 | 只有 AFPK 候选审核使用陶土色面板 | 其他门禁按设计渲染为审核卡 |
| 审计表的证据列挤在一起 | 分界线只在对照布局中出现 | 打开 AFPK 证据对照即可看到 |

## Web 与桌面

| 现象 | 原因 | 处理 |
| --- | --- | --- |
| bearer-token 链接失效 | 服务端每次启动都会打印新的 | 重启 `ariadnebuddy web` 并使用新的 `#token=…` 链接；切勿随意绑定非回环地址 |
| 桌面应用启动后留下死窗口 | 引擎启动失败 | 对话框提供重试 / 选择其他工作目录 / 打开日志目录 / 退出 |
| 看不到引擎日志 | 日志不在应用包内 | 文件菜单的**打开日志目录**可定位 `app.getPath('logs')/engine.log` |
| 窗口尺寸不对 | 边界按显示器恢复 | 调整一次即可；边界、最大化状态与缩放会持久保存 |

## 打包

| 现象 | 原因 | 处理 |
| --- | --- | --- |
| `npm run dist` 因缺少资源失败 | 某个 `extraResources` 源不存在 | 先运行 `npm run build:engine` 与 `npm run sync:web` |
| 打包后 About 窗口打不开许可证 | 资源未被打包 | 许可证位于打包后的 `licenses/` 目录；过期时重跑 `npm run licenses` |

## 开发

```bash
npm run typecheck && npm test && npm run test:adapter
node engine/apps/ariadne-buddy/scripts/smoke-mcp.mjs
node engine/apps/ariadne-buddy/scripts/smoke-research.mjs
node engine/apps/ariadne-buddy/scripts/smoke-web.mjs
npm run check:repo      # 仓库、主题、记录台与品牌遗留四项契约
```
