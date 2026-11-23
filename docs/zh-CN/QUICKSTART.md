[English](../QUICKSTART.md) | 简体中文

# 快速上手

这一页是一条首次运行路径：从一台干净的机器走到一个已完成审阅的研究任务。
下面每条命令都是二进制实际接受的形式；`./bin/ariadnebuddy <命令> --help`
会打印同样的文字，其中也包含退出码表。

## 1. 前置条件

- Node.js ≥ 24.15（`engines.node`）、npm（`packageManager` 声明为 npm@12.0.2），以及 pnpm 12（devDependency）。
- Python 3.10+，一份 [ariadne-tps](https://github.com/zhaorui-bi/Ariadne)
  检出及其环境（`pyhmmer`、`pyrodigal`、`scikit-learn`、`openpyxl`、`numpy`）；
  检出内的 `.venv` 会被自动探测。
- 可选，用于 ESM2 语义打分：`pip install ariadne-tps[esm]`（`torch`、
  `transformers`）。缺少它时闭环仍会在显式的 `proceed_without_esm`
  豁免下继续运行。
- 一个对话模型提供方。有 API Key 即可，没有登录流程。预置提供方为
  `kimi-coding`、`zai`、`deepseek`；任何 OpenAI 兼容端点按 `custom` 配置。

引擎始终是外部的：AriadneBuddy 桥接一份检出，并不内置引擎。

## 2. 安装与构建

```bash
git clone https://github.com/zhaorui-bi/AriadneBuddy && cd AriadneBuddy
npm run setup        # 安装 pnpm 工作区，然后构建
```

`npm run setup` 先运行 `pnpm -C engine install --frozen-lockfile`，再运行
`npm run build`：构建引擎应用（CLI、MCP server、搜索 worker）、同步品牌化
Web UI 资源，并构建 TUI bundle。

## 3. 引导配置

```bash
export ZAI_API_KEY="..."
./bin/ariadnebuddy onboard --yes --home ~/.ariadne \
  --ariadne-repo /path/to/Ariadne \
  --provider zai --api-key-env ZAI_API_KEY
```

引导分六个编号步骤：主目录、既有配置、模型提供方、ariadne 后端、MCP 注册、
技能。它以 `0700` 权限创建主目录，在 `mcp.json` 中注册 `ariadne` server，
并注册 Ariadne 技能。`--import-from DIR` 会从另一个主目录复制 `config.toml`、
凭据、`oauth` 和 `tui.toml`。若该主目录已设置默认模型，提供方步骤只会确认；否则仍需配置。

**模型提供方。** `--api-key KEY` 会把密钥明文写入 `config.toml`；建议改用
`--api-key-env VAR` 并导出该环境变量。两个标志互斥。

```bash
./bin/ariadnebuddy onboard --provider kimi-coding --api-key-env KIMI_CODING_API_KEY
./bin/ariadnebuddy onboard --provider deepseek    --api-key-env DEEPSEEK_API_KEY
./bin/ariadnebuddy onboard --provider zai         --api-key-env ZAI_API_KEY
./bin/ariadnebuddy onboard --provider custom --base-url https://host/v1 \
  --model my-model --api-key-env LAB_API_KEY --provider-type openai
```

`--provider-type` 接受 `anthropic`、`openai`、`kimi`、`google-genai`、
`openai_responses`、`vertexai`。每个预置提供方对应的环境变量名是预置 id
大写后加上 `_API_KEY`。

**后端。** 指向一份检出，或指定一个适配器兼容的命令。两个标志互斥。

```bash
./bin/ariadnebuddy onboard --ariadne-repo /path/to/Ariadne
./bin/ariadnebuddy onboard --ariadne-command '["uv","run","ariadne"]'
```

检出必须包含 `ariadne/__init__.py` 与 `pyproject.toml`；解释器先取
`ARIADNE_PYTHON`，再取检出内的 `.venv` 或 `venv`，最后取 `PATH` 上的
`python3`/`python`。
`--ariadne-command` 或 `--ariadne-repo` 给出的命令必须能在 `PATH`
上解析到可执行文件。

**引导会大声失败。** 它会打印 `probing backend...`，然后打印
`probe: … (Ns)`。探测失败时不会写入 `ariadne.json`，并以非零退出码结束，
同时给出三条可重试的命令。如果引导结束时没有配置默认模型，它会打印确切的
纠正命令并以非零退出码结束：

```text
No default model is configured, so run, chat, and web have no model to call.
  ariadnebuddy onboard --provider kimi-coding --api-key-env KIMI_CODING_API_KEY
```

如果探测结果是“不完整”而非失败，后端仍会被记录下来；此时请先补齐参考数据，
再重跑 `ariadnebuddy doctor --probe`。

## 4. 验证

```bash
./bin/ariadnebuddy doctor --probe --probe-model
./bin/ariadnebuddy tools            # 21 个 ariadne_* 工具
```

`doctor` 为每一项检查输出一行：`node`、`home_dir`、`home_writable`、
`work_dir`、`job_storage`、`default_model`、`config_diagnostics`、
`provider_transport`、`model_probe`、`ariadne_backend`、`mcp_server_entry`、
`web_ui_assets`、`skills`、`private_permissions`。

- `--probe` 对已配置的后端运行 `health --json`。
- `--probe-model` 对已配置的提供方做一次最小往返。不带该标志时这项检查报告为
  skipped，因此一次普通的 `doctor` 仍会以 `All required checks passed.` 结束。
- `--json` 以 JSON 输出报告，包含 passed/failed/warned 计数，并在每个失败的
  检查上给出 `fix` 字符串。
- 必需检查失败时退出码为 1。

## 5. 查看生效配置

```bash
./bin/ariadnebuddy config show
./bin/ariadnebuddy config show --json --home ~/.ariadne
```

`config show` 打印主目录、默认模型、提供方、base URL、API Key 来源
（环境变量，并标注是否已设置；或 `stored in config.toml`）、后端、技能目录、
MCP server 命令，以及 `mcp.json` 是否已注册——无需运行完整的 doctor。

## 6. 三种使用方式

```bash
./bin/ariadnebuddy web              # 品牌化工作台 → http://127.0.0.1:58627
./bin/ariadnebuddy                  # 完整 TUI 工作台（等同 `ariadnebuddy tui`）
./bin/ariadnebuddy chat             # 交互式 REPL，单一持久会话
```

**Web。** `--port N`（0 表示选空闲端口；默认 58627）、`--host H`（默认
127.0.0.1）、`--no-open`、`--home DIR`。服务会打印一个带 bearer token 的
URL——请妥善保管，且不要随意绑定非回环主机。

**终端 TUI。** 没有其他标志。如果 TUI bundle 尚未构建，启动器会说明并退回到
普通 REPL；此时运行一次 `npm run build:tui`。

**Chat。** 输入 `quit` 或 `exit`，或按 `Ctrl`+`C`，或结束标准输入即可退出。
`Ctrl`+`C` 会先关闭 harness，然后以 130 退出。

在研究问题得到回答后批准门禁即可。完整的发现研究可以这样提问：

> 用 Ariadne 引擎对 input/all_tps.fasta 做 cembranoid CeeSs 提名，走完整闭环

智能体会加载 `ariadne` 技能、冻结一份提名请求，并推进门禁回路——由你审批
假说门禁、提名名单，以及迭代/结题决策。

**一次性运行。** `run` 创建会话、发送一条提示、流式输出后退出。

```bash
./bin/ariadnebuddy run "summarize the coral cembrene literature"
./bin/ariadnebuddy run --quiet --json "nominate cembrene-class TPS candidates"
```

`--quiet` 让标准输出只保留助手文本，进度信息走标准错误；`--json` 让标准输出
只有一个结构化 JSON 信封。`run` 与 `chat` 还接受 `--home DIR`、`--model NAME`、
`--workdir DIR` 和 `--permission auto|manual|yolo`。

## 7. 记录台（Research Desk）走读

1. 在拥有该任务的项目中启动 `./bin/ariadnebuddy web`，然后在侧栏会话列表里
   选择任务。列表分为普通任务、已归档任务，以及单独的 AFPK 筛选组（该组有
   自己的归档）；未决门禁带 **待决策**  pill，AFPK 会话通过其直接链接打开。
2. 阅读线程。任务头部带状态 pill、轮次（TPS 与 CeeSs 任务；AFPK 筛选不显示）、
   绝对的“更新于”时间戳、一个裸的相对时间戳（如“4 分钟前”），以及任务 id。
   **此记录台如何工作** 说明区解释轮次、版本、请求修订与门禁。
3. 批准门禁。未决的人类决策渲染为一张审核卡；在 AFPK 候选审核中，它是一块
   陶土色描边的面板，标签为 `Awaiting decision`（由 CSS 转为大写），并位于
   polite live region 中。记录决策时需给出理由和当前任务版本。
4. 查看产物与轨迹。三个页签——计算、产物、轨迹——分别承载作业列表、带
   SHA-256 指纹的冻结产物，以及事件日志。审计表保持表头吸顶、视觉隐藏的
   表题、等宽数字，并用双线分隔本次运行的分类与导入/已发表证据列。
5. 打印。记录台附带完整的打印样式表：控件被隐藏，说明区强制展开，页边距
   为 18 mm。

加载状态使用墨色微光骨架屏并带 `aria-busy`。键盘：`方向键`/`Home`/`End`
在三个页签间移动，`/` 聚焦序列检索框（页面没有时聚焦“刷新”），`r`
重新加载任务。页面重新可见时记录台还会自行重载，因此在 Chat 中记录的决策
无需手动刷新即可呈现。见[键盘操作](../KEYBOARD.md)（英文）。

停止或重试作业、取消任务，以及 AFPK 证据对照，见
[研究任务](../RESEARCH_TASKS.md)（英文）。

## 8. 免模型任务控制

`research` 命令驱动与智能体相同的状态机，回路中没有对话模型。

```bash
./bin/ariadnebuddy research create  --input request.json
./bin/ariadnebuddy research status  --id research_0123456789abcdef01234567
./bin/ariadnebuddy research list
./bin/ariadnebuddy research advance --id research_0123456789abcdef01234567
./bin/ariadnebuddy research respond --input respond.json
./bin/ariadnebuddy research cancel  --input cancel.json
```

`create` 冻结任务书，`advance` 对账状态并前进一步，`respond` 回应一个打开的
关注项，`cancel` 以给定原因结束任务。每个动作都会按对应的
`ariadne_research_*` MCP schema 校验其 JSON。`request.json`：

```json
{ "requestId": "quickstart-1", "objective": "提名 CeeSs 候选",
  "requestFile": "examples/cases/ceess-coral-transcriptome.json", "maxJobs": 8 }
```

`respond.json` 携带任务 id、关注项 id、从 `status` 读到的 `expectedVersion`，
以及动作——`submit_stage`、`approve`、`revise`、`amend_request`、
`proceed_without_esm`、`iterate`、`conclude` 或 `retry`。输入文件必须是普通
文件（不能是符号链接）且不超过 64 KiB，相对路径从 `ARIADNE_WORKDIR`
解析。每个动作也都接受 `--home DIR`；`advance` 还接受 `--expected-version N`
以显式声明并发校验。完整的回应表见[研究任务](../RESEARCH_TASKS.md)（英文）。

## 9. 重置

```bash
./bin/ariadnebuddy reset --home ~/.ariadne            # 打印计划，退出码 1
./bin/ariadnebuddy reset --home ~/.ariadne --yes      # 执行
```

重置会删除主目录、从引擎主目录的 `mcp.json`（`KIMI_CODE_HOME`，默认
`~/.kimi/mcp.json`）中移除 `ariadne` server 条目、从引擎的 `extraSkillDirs`
中清除 Ariadne 技能目录，并删除研究作业存储。
`--keep-jobs` 保留作业存储目录。不带 `--yes` 时不会删除任何东西：命令打印
删除计划并以退出码 1 结束。

## 退出码

| 代码 | 含义 |
| --- | --- |
| 0 | 命令完成 |
| 1 | 参数被拒绝、必需检查失败，或配置不完整 |
| 130 | `run` 或 `chat` 期间被 `Ctrl`+`C` 中断 |

## 相关文档

- [常见问题](./FAQ.md) · [故障排查](./TROUBLESHOOTING.md) · [术语表](./GLOSSARY.md)
- [设计语言](./DESIGN.md) · [科学工作流纪律](../SCIENTIFIC_WORKFLOWS.md)（英文）
- [研究任务](../RESEARCH_TASKS.md)（英文） · [键盘操作](../KEYBOARD.md)（英文） · [示例](../EXAMPLES.md)（英文） · [架构](../ARCHITECTURE.md)（英文）
- 英文入口：[Quick start](../QUICKSTART.md)
