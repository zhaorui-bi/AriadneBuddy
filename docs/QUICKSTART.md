# Quick start

English | [简体中文](./zh-CN/QUICKSTART.md)

## 1. Prerequisites

- Node.js ≥ 24.15 (Node 26 recommended), npm, and pnpm 12.
- Python 3.10+ with an [ariadne-tps](https://github.com/zhaorui-bi/Ariadne)
  checkout and its environment (`pyhmmer`, `pyrodigal`, `scikit-learn`,
  `openpyxl`, `numpy`). A checkout-local `.venv` is detected automatically.
- Optional for ESM2 semantic scoring: `pip install ariadne-tps[esm]`
  (`torch`, `transformers`). Without it, the loop runs with an explicit
  `proceed_without_esm` waiver.
- A conversational model provider: an API key works — no login required
  (Kimi Coding Plan / Z.AI / DeepSeek / any OpenAI-compatible endpoint).

## 2. Build

```bash
cd AriadneBuddy
npm run setup        # pnpm install + build the engine app + branded web UI
```

## 3. Onboard

```bash
./bin/ariadnebuddy onboard \
  --ariadne-repo /path/to/Ariadne \
  --provider zai --api-key-env ZAI_API_KEY --model glm-4.6
```

Onboard configures `~/.ariadne` (config, credentials, `mcp.json`, skills),
records the engine backend, and probes it.

## 4. Verify

```bash
./bin/ariadnebuddy doctor --probe
./bin/ariadnebuddy tools            # the 21 ariadne_* tools
```

## 5. Use

```bash
./bin/ariadnebuddy web              # branded workbench → http://127.0.0.1:58627
./bin/ariadnebuddy                  # full TUI workbench
./bin/ariadnebuddy chat             # lightweight REPL
npm start                           # Electron desktop app
```

Start in Chat with a research question or attach the files to inspect. AriadneBuddy
uses available tools and reports their findings, sources, and output links in the
conversation. For a complete discovery study, ask *“用 Ariadne 引擎对
input/all_tps.fasta 做 cembranoid CeeSs 提名，走完整闭环”*. The agent loads the
`ariadne` skill, freezes a nomination request, and walks the gated loop — you
approve hypotheses, the nominated shortlist, and the iterate/conclude decision.

Select a research task from the sidebar session list to see its current progress,
results, and review actions. Expand **Activity and files** for jobs, verified artifacts,
and the timeline. Find cancelled tasks under **Archived tasks** in the same sidebar.
Open AFPK sessions through their direct session links.

The task list reads from the Web server's launch workspace. Start the server
from the same project as the task, or set `ARIADNE_WORKDIR` and
`ARIADNE_JOBS_DIR` consistently when using custom locations.
For older MCP tasks created with a custom `ARIADNE_WORKDIR`, set
`ARIADNE_JOBS_DIR` to the directory containing the existing task records.

Under **Activity and files → Compute**, select **Stop job** for the current
running assignment and confirm. The task retains its request, prior evidence, and
job history. Use **Retry job** on the latest failed or stopped job to launch another
attempt for the same stage and request revision within the job budget; the new
attempt links to the original job.

To end a research task, choose **Cancel research task** beside the task title, give a
reason, and confirm. Tasks awaiting review or handoff can be cancelled. A cancelled
task stays available under **Archived tasks** for its artifacts, jobs, and review
records.

In an AFPK session, expand **AFPK evidence comparison** to read the three-model
scores per sequence, this run's original AFPK-finder clustering, the published
scores, and imported cluster records. See the
[molluscan case](../examples/cases/AFPK_MOLLUSC.md).

The desk has its own keyboard contract: `/` focuses the sequence search, `r` reloads
the task, `Escape` dismisses a job-cancellation confirmation, and the arrow keys move
between the Compute, Artifacts, and Trajectory tabs. See
[Keyboard](./KEYBOARD.md).

## 6. Model-free task control

```bash
./bin/ariadnebuddy research create  --input request.json
./bin/ariadnebuddy research advance --id research_xxxx
./bin/ariadnebuddy research respond --input respond.json
```

`request.json`:

```json
{ "requestId": "quickstart-1", "objective": "Nominate CeeSs candidates",
  "requestFile": "examples/cases/ceess-coral-transcriptome.json", "maxJobs": 8 }
```

## 7. Real-engine demo

```bash
node engine/apps/ariadne-buddy/scripts/run-real-engine-demo.mjs /path/to/Ariadne
```

Drives the entire closed loop against the real pyhmmer/sklearn engines and
prints the nominated candidates with their evidence.
