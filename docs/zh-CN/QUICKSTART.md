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

在 Chat 中提出研究问题或添加需要查看的文件。AriadneBuddy 调用可用的工具，
在对话中给出结果、来源和产物链接。需要完整研究流程时，可以输入 *“用 Ariadne 引擎对
input/all_tps.fasta 做 cembranoid CeeSs 提名，走完整闭环”*。智能体会加载
`ariadne` 技能、冻结提名请求并推进门禁回路——由你审批假说、提名名单与
迭代/结题决策。

从侧栏的会话列表选择任务，即可查看当前进度、筛选结果和审核入口。
展开 **运行与文件记录** 可查看计算作业、经校验的产物和轨迹。任务列表读取启动 Web 服务的项目目录。
使用自定义路径时，请为服务和研究任务统一设置 `ARIADNE_WORKDIR` 与 `ARIADNE_JOBS_DIR`。
如果旧版 MCP 任务使用了自定义 `ARIADNE_WORKDIR`，请将 `ARIADNE_JOBS_DIR` 指向已有任务目录。

通过原会话链接打开 AFPK 任务，可查看计算进度、证据和候选审核。

在 **运行与文件记录 → 计算**，可以为当前运行中的作业选择 **停止作业** 并确认。当前作业失败或
停止后，可在同一页选择 **重试作业**。在任务预算内，重试会沿用原请求版本，新增一条
与原作业关联的记录，并保留已有证据。

需要结束整个研究任务时，在任务标题旁选择 **取消研究任务**，填写原因并确认。
待审核和待交接的任务均可取消。侧栏中的任务取消后可从 **已归档任务** 打开，继续查看产物、作业和审核记录。

在 AFPK 会话中展开 **AFPK 证据对照**，可按序列查看三模型得分、原版 AFPK-finder 本次聚类、
论文得分和导入聚类记录。 [软体动物案例](../../examples/cases/AFPK_MOLLUSC.md)

记录台有自己的键盘约定：`/` 聚焦序列检索框，`r` 重新加载任务，`Escape` 关闭作业取消
确认，方向键在「计算」「产物」「轨迹」三个页签之间移动。见
[键盘操作（英文）](../KEYBOARD.md)。

## 6. 免模型任务控制

```bash
./bin/ariadnebuddy research create  --input request.json
./bin/ariadnebuddy research advance --id research_xxxx
./bin/ariadnebuddy research respond --input respond.json
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
