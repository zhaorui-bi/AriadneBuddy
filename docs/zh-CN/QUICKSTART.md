[English](../QUICKSTART.md) | 简体中文

# 快速上手

## 1. 前置条件

- Node.js ≥ 24.15（推荐 26）、npm、pnpm 12。
- Python 3.10+ 与一份 [ariadne-tps](https://github.com/zhaorui-bi/Ariadne)
  检出及其环境（`pyhmmer、pyrodigal、scikit-learn、openpyxl、numpy`）；
  检出内的 `.venv` 会被自动探测。
- ESM2 语义打分可选：`pip install ariadne-tps[esm]`（`torch`、
  `transformers`）。缺失时闭环以显式 `proceed_without_esm` 豁免继续。
- 一个对话模型提供方：API Key 即可，无需登录（Kimi Coding / Z.AI /
  DeepSeek / 任意 OpenAI 兼容端点）。

## 2. 构建

```bash
cd AriadneBuddy
npm run setup        # pnpm install + 构建引擎应用与品牌化 Web UI
```

## 3. 引导配置

```bash
./bin/ariadnebuddy onboard \
  --ariadne-repo /path/to/Ariadne \
  --provider zai --api-key-env ZAI_API_KEY --model glm-4.6
```

引导会配置 `~/.ariadne`（配置、凭据、`mcp.json`、技能），登记并探测
引擎后端。

## 4. 验证

```bash
./bin/ariadnebuddy doctor --probe
./bin/ariadnebuddy tools            # 21 个 ariadne_* 工具
```

## 5. 使用

```bash
./bin/ariadnebuddy web              # 品牌化工作台 → http://127.0.0.1:58627
./bin/ariadnebuddy                  # 完整 TUI 工作台
./bin/ariadnebuddy chat             # 轻量 REPL
npm start                           # Electron 桌面应用
```

在 Web 工作台里直接下达完整研究指令，例如：*“用 Ariadne 引擎对
input/all_tps.fasta 做 cembranoid CeeSs 提名，走完整闭环”*。智能体会加载
`ariadne` 技能、冻结提名请求并推进门禁回路——由你审批假说、提名名单与
迭代/结题决策。

## 6. 免模型任务控制

```bash
./bin/ariadnebuddy research create  --input request.json
./bin/ariadnebuddy research advance --id research_xxxx
./bin/ariadnebuddy research respond --input respond.json --id research_xxxx
```

`request.json`：

```json
{ "requestId": "quickstart-1", "objective": "提名 CeeSs 候选",
  "requestFile": "examples/cases/ceess-coral-transcriptome.json", "maxJobs": 8 }
```

## 7. 真实引擎演示

```bash
node engine/apps/ariadne-buddy/scripts/run-real-engine-demo.mjs /path/to/Ariadne
```

用真实 pyhmmer/sklearn 引擎驱动完整闭环，并打印提名候选及其证据。
