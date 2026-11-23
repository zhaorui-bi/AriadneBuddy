# 常见问题

[English](../FAQ.md) | 简体中文

## 安装与准备

**需要单独安装 Ariadne 引擎吗？**
需要。AriadneBuddy 桥接外部 [ariadne-tps](https://github.com/zhaorui-bi/Ariadne)
检出。把 `ARIADNE_REPO` 指向它，或在 `ariadnebuddy onboard` 时传
`--ariadne-repo`。检出需包含 `ariadne/__init__.py`、`input/query.hmm`、
`input/references/*.afa`，以及装有 `pyhmmer、pyrodigal、scikit-learn、
openpyxl` 的 Python 环境。解释器先取 `ARIADNE_PYTHON`，再取检出内的
`.venv` 或 `venv`，最后取 `PATH` 上的 `python3`/`python`。

**前置条件是什么？**
Node.js ≥ 24.15（`engines.node`）、npm（`packageManager` 声明为
npm@12.0.2）、pnpm 12（devDependency）；引擎侧 Python 3.10+，
`pip install ariadne-tps[esm]` 启用 ESM2 打分；任意 OpenAI 兼容模型 API
Key——没有登录流程。

**该用哪个界面？**
`ariadnebuddy web` 是品牌化浏览器工作台；直接运行 `ariadnebuddy`（或
`ariadnebuddy tui`）是完整终端工作台；`ariadnebuddy chat` 是轻量 REPL；
`ariadnebuddy run "<prompt>"` 适合一次性脚本化调用；`npm start` 是
Electron 桌面应用。

## 引导与模型提供方

**onboard 以 1 退出并提示“No default model is configured”。**
这是有意的：带着未配置模型结束安装，只会在创建会话时才失败。命令会打印
确切的修正形式——`ariadnebuddy onboard --provider <id> --api-key-env <VAR>`
——并以非零码退出。用 `--provider kimi-coding|zai|deepseek|custom` 重跑；
自定义提供方再加 `--base-url`、`--model`，必要时加 `--provider-type`。

**能复用既有配置吗？**
`ariadnebuddy onboard --import-from DIR` 会从另一个主目录复制
`config.toml`、凭据、`oauth` 和 `tui.toml`。但提供方步骤仍会执行，所以
若该主目录没有默认模型，你依旧需要配置一个。

**凭据存在哪里？**
在 AriadneBuddy 主目录（默认 `~/.ariadne`），权限 0600/0700。API Key 只
来自环境变量或凭据存储，绝不写入溯源清单或研究产物。

**怎样不跑完整 doctor 就看当前配置？**
`ariadnebuddy config show` 打印生效的提供方、默认模型、后端、技能目录与
MCP 注册情况；加 `--json` 可供程序消费。

## Doctor 与诊断

**`doctor` 检查哪些项？**
依次为 `home_dir`、`home_writable`、`work_dir`、`job_storage`、
`default_model`、`config_diagnostics`、`provider_transport`、
`model_probe`、`ariadne_backend`、`mcp_server_entry`、`web_ui_assets`、
`skills`、`private_permissions`。普通运行以 `All required checks passed.`
结束。

**`--probe` 和 `--probe-model` 各增加什么？**
`--probe` 对已配置的 Ariadne 后端运行 `health --json`；`--probe-model` 对
已配置的模型提供方做一次最小往返，把鉴权、base-URL 与传输失败报告为带
修复建议的命名检查。不加 `--probe-model` 时该项报告为 skipped，默认报告
仍以 `All required checks passed.` 结束。

**报告能程序化消费吗？**
`ariadnebuddy doctor --json` 输出各项检查，外加 `passed`、`failed`、
`warned` 计数与逐项修复建议。

## 三种界面

**CLI 面对脚本友好吗？**
`ariadnebuddy run "<prompt>"` 支持 `--quiet`（stdout 只保留助手文本，进度
走 stderr）与 `--json`（stdout 输出单个结构化信封），以及 `--model`、
`--workdir`、`--permission auto|manual|yolo`。全局 `--no-telemetry` 可为
`run`、`chat`、`web` 关闭遥测。

**退出码是什么含义？**
`0` 命令正常完成；`1` 参数被拒绝、必需检查未通过或安装不完整；`130` 在
`run`/`chat` 期间按 Ctrl+C 中断。

**怎样查看智能体可调用的工具？**
`ariadnebuddy tools` 列出全部 21 个——9 个引擎工具、6 个持久作业工具、6 个
研究控制器工具；`--json` 输出目录。

## 研究记录台

**在对话里操作后记录台不刷新。**
页面重新可见时它会自行重载，因此在别处记录的决策无需手动 Refresh 即可
呈现；按 `r` 可立即重载。

**怎样打印审计留档？**
记录台附带完整打印样式表：控件被隐藏、折叠的说明区强制展开、页边距
18 mm。在任务页直接使用浏览器打印对话框即可。

**从哪里新建筛选？**
任务头部的 **新建 AFPK 任务** 按钮可在不离开记录台的情况下打开创建对话框；
在对话壳的会话列表中，**新建 AFPK 筛选** 动作作用相同。

**键盘快捷键有哪些？**
`方向键`/`Home`/`End` 在计算、产物、轨迹三个页签间移动；`/` 聚焦序列
搜索框（页面没有时聚焦刷新）；`r` 重载任务。按住修饰键、焦点在输入框内
或有对话框打开时，这些快捷键不生效。

## 研究任务与门禁

**任务为什么停在 `nomination_review` / `scientific_review`？**
审计通过会打开 `nomination_review`（批准后进入实验设计）；审计警告/失败
打开 `scientific_review`（修订请求或修复环境）。两者都是有意的决策点。

**respond 时遇到 `Research version conflict`。**
说明其他界面先推进了任务。记录台会改为重载而不是覆盖；用
`research status` 重新读取，并按当前 `version` 回应。

**没有 torch/transformers 会怎样？**
ESM2 语义打分不可用。闭环照常运行：控制器打开 `esm_unavailable` 门，你以
`proceed_without_esm` 显式豁免，提名基于 HMM + 特征空间证据，结果标记为
`conditional_nomination` 并附限制说明。安装 `ariadne-tps[esm]` 即可启用
语义打分。

**模型会不会编造分数？**
不允许。所有科学数字只能读取自引擎产物；技能、回复风格指南与确定性审计
共同约束这一点。证据行的唯一事实来源是引擎输出。

**提名候选等于已证实的酶吗？**
不等于。提名是带确定性证据（阈值、最近参考、概率）的筛选假说。异源表达
与产物确证（GC-MS 等）仍然必要——这正是 experiment/validation 阶段所记录
的内容。

**能批量做研究吗？**
可以——参见 `ariadne-campaign` 技能：冻结问题矩阵、公平的单因子对比、逐
运行指纹。

## 桌面端

**引擎日志在哪里？**
`app.getPath('logs')/engine.log`，有容量上限并已脱敏。文件菜单的
**打开日志目录** 可定位它，**在文件管理器中显示工作目录** 可定位工作区。

**启动失败怎么办？**
失败对话框提供重试、选择其他工作目录、打开日志目录与退出，因此工作目录
配置错误或后端缺失不会留下一个死窗口。

**能切换外观吗？**
视图 → 外观提供跟随系统、浅色、深色，并与窗口边界和缩放一起持久保存。

## 卸载与重置

**怎样全部移除？**
`ariadnebuddy reset --home DIR` 会打印它将删除的全部内容，未加 `--yes`
前不做任何删除。它删除主目录、从引擎主目录的 `mcp.json`
（`KIMI_CODE_HOME`，默认 `~/.kimi/mcp.json`）中移除 `ariadne` server
条目、从引擎的 `extraSkillDirs` 中清除 Ariadne 技能目录，并删除研究作业
存储。`--keep-jobs` 保留作业存储。
