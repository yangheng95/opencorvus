<p align="center">
  <img src="assets/readme-head.png" alt="OpenCorvus" width="440" />
</p>

<h3 align="center">Work that finishes, and gets better.</h3>

<p align="center">
  <strong>An open-source agent harness for work that runs long — carried by combined expert
  squads, evidenced at every handoff, and revised from your own feedback.</strong>
</p>

<p align="center">
  <a href="https://github.com/yangheng95/opencorvus/releases"><img alt="Latest release" src="https://img.shields.io/github/v/release/yangheng95/opencorvus?include_prereleases&sort=semver&style=for-the-badge&label=release&color=2946d3" /></a>
  <a href="./LICENSE"><img alt="License" src="https://img.shields.io/github/license/yangheng95/opencorvus?style=for-the-badge&color=2946d3" /></a>
  <img alt="Project status: beta" src="https://img.shields.io/badge/status-beta-e04b22?style=for-the-badge" />
  <a href="https://github.com/yangheng95/opencorvus/actions/workflows/typecheck.yml"><img alt="Typecheck" src="https://img.shields.io/github/actions/workflow/status/yangheng95/opencorvus/typecheck.yml?branch=main&style=for-the-badge&label=typecheck" /></a>
  <a href="https://github.com/yangheng95/opencorvus/actions/workflows/codeql.yml"><img alt="CodeQL" src="https://img.shields.io/github/actions/workflow/status/yangheng95/opencorvus/codeql.yml?branch=main&style=for-the-badge&label=codeql" /></a>
</p>

<p align="center">
  <a href="https://opencorvus.com"><img alt="Documentation" src="https://img.shields.io/badge/docs-opencorvus.com-111310?style=for-the-badge&logo=readthedocs&logoColor=white" /></a>
  <a href="https://bun.sh"><img alt="Runtime: Bun" src="https://img.shields.io/badge/runtime-Bun%201.3-111310?style=for-the-badge&logo=bun&logoColor=white" /></a>
  <img alt="87 model providers" src="https://img.shields.io/badge/model%20providers-87-2946d3?style=for-the-badge" />
  <img alt="119 expert squads" src="https://img.shields.io/badge/expert%20squads-119-2946d3?style=for-the-badge" />
  <img alt="43 built-in tools" src="https://img.shields.io/badge/built--in%20tools-43-2946d3?style=for-the-badge" />
</p>

<p align="center">
  <strong>English</strong> | <a href="./README.zh-CN.md">简体中文</a>
</p>

<p align="center">
  <a href="https://opencorvus.com">Website</a> ·
  <a href="https://opencorvus.com/start/quickstart/">Quickstart</a> ·
  <a href="https://github.com/yangheng95/opencorvus/releases/latest">Download</a> ·
  <a href="https://opencorvus.com/market/">Expert Squads</a> ·
  <a href="https://opencorvus.com/concepts/long-horizon/">Long-horizon</a> ·
  <a href="https://opencorvus.com/concepts/squad-composition/">Composition</a> ·
  <a href="https://opencorvus.com/expert-squads/evolution/">Evolution</a>
</p>

---

## The short version

When a long task dies halfway, people blame the model. Usually it is not the model.

An **agent harness** is the runtime that turns a model into an agent: the loop, tool routing,
context management, memory, permission enforcement, recovery, and scheduling. Long-horizon
capability is a property of that whole system, not of the model — a capable model inside a
harness that loses task state still stops short.

OpenCorvus is that harness, already assembled and pointed at work that runs long. Install it and
you get a streaming agent loop across five roles, 43 built-in tools, 87 model providers,
orchestration that survives a restart, a durable permission authority, project and session
memory, automatic context compaction, and 119 inspectable Expert Squads — all working on first
launch. Then every layer underneath is a configuration surface: swap the model, narrow the tool
set, tighten the permission rules, replace an entire squad, or drive the whole thing from the
software development kit (SDK).

Both halves are written in this repository — the harness runtime and the desktop application —
with no third-party agent engine underneath. That is not a boast; it is what makes every layer
replaceable. It still stands on a great deal of open source: Bun, the AI SDK, SolidJS, and Tauri
among them.

<p align="center">
  <a href="https://github.com/yangheng95/opencorvus/raw/main/packages/web/public/media/opencorvus-mission-v5r-en-US.mp4"><img src="https://github.com/yangheng95/opencorvus/raw/main/packages/web/public/media/opencorvus-mission-v5r-en-US-poster.jpg" alt="OpenCorvus Mission product story" width="880" /></a>
</p>

<p align="center"><sub>Why long-horizon agents fail, how Mission schedules durable work, and what a 12 h 45 min DeBERTa run delivered. 4 min 11 s, narrated with subtitles: <a href="https://github.com/yangheng95/opencorvus/raw/main/packages/web/public/media/opencorvus-mission-v5r-en-US.mp4">English</a> · <a href="https://github.com/yangheng95/opencorvus/raw/main/packages/web/public/media/opencorvus-mission-v5r-zh-CN.mp4">简体中文</a>.</sub></p>

> [!IMPORTANT]
> OpenCorvus is under active development. This README describes what is in the repository today.
> Output quality depends on the models you select, the sources they can reach, the capabilities
> you install, and the evidence available to the run. Unattended work only runs while your local
> or hosted OpenCorvus runtime is online.

## Is a harness actually worth anything? Here is the number

The honest way to test that claim is to hold the model constant and change only the harness.

On **AutomationBench**, 100 frozen cases scored by strict pass criteria:

| Run                                                | Strict pass rate |
| -------------------------------------------------- | ---------------: |
| `openai/gpt-5.6-luna`, on its own                   |          8.07 %  |
| **The same model, inside OpenCorvus Mission Base**  |      **34.00 %** |

**+25.93 percentage points. 4.21× the strict pass rate.** Same model, same cases, same scoring —
the entire difference is the harness around it.

For scale only, the official held-out numbers supplied with that comparison: Gemini 3.7 Flash
High 30.44 %, Claude Opus 5 Max 26.94 %, GPT-5.6 Terra Max 21.00 %, GPT-5.6 Sol Max 19.63 %.
**These are a different sample and are not a cross-sample ranking** — they say roughly how hard
the benchmark is, nothing about which model wins.

## What one real Mission looks like

Not a demo prompt. One Mission, one run: take DeBERTa v3 Base ABSA v1.1, find or synthesize
traceable training data, stand up a CUDA-only training runtime, beat an explicit baseline, build
a live training monitor and inference site, draw publication-grade figures, write a four-page
ACL-style short paper, have a different squad tear it apart, and push an organized repository.

**6 Expert Squads · 44 named roles**, all shipping in the catalog today:

|    | Stage                  | Expert Squad                                                                              | Roles | Hands the next stage                                                                        |
| -- | ---------------------- | ----------------------------------------------------------------------------------------- | ----: | -------------------------------------------------------------------------------------------- |
| 01 | Model & data           | [Deep Research](https://opencorvus.com/market/builtin/deep-research/)                       |     6 | A verified model source, current ABSA evidence, and a sourced plan to find or synthesize data. |
| 02 | CUDA training system   | [Advanced](https://opencorvus.com/market/builtin/advanced/)                                 |    14 | A CUDA-only runtime, baseline and candidate training, an experiment ledger, and a live site.   |
| 03 | Architecture evidence  | [Data Analysis & Business Insights](https://opencorvus.com/market/builtin/data-analysis/)   |     7 | Best-run comparisons and reproducible figures bound to the exact winning checkpoint.           |
| 04 | ACL short paper        | [Research Studio](https://opencorvus.com/market/builtin/research-studio/)                   |     5 | A concise, informative four-plus-page paper grounded in related work and the best experiment.  |
| 05 | Independent review     | [Academic Paper Review](https://opencorvus.com/market/builtin/academic-paper-review/)       |     8 | Resolved findings on facts, citations, novelty, method, figures, and hallucination risk.       |
| 06 | Mission repository     | [Base](https://opencorvus.com/market/builtin/base/)                                         |     4 | A reproducible Git repository with the stage map, reviewed docs, and a verified GitHub push.   |

Unfold the same outcome one level further and it is **18 squads · 99 roles** across five lanes:
model and data evidence, CUDA training and experiments, the live product, research and
publication, then reproduction and release.

📦 **Audited evidence from that run is public:**
[`yangheng95/deberta-v3-absa-public-evidence`](https://github.com/yangheng95/deberta-v3-absa-public-evidence)

Read the *shape* rather than the stages. Four squads in that chain carry a role whose entire job
is to disbelieve work it did not do — Deep Research's citation reviewer, Data Analysis's
fact-checker, Research Studio's own fact-checker, and Academic Paper Review's
citation-and-hallucination auditor. That is the property one long-running team cannot have,
however carefully it is prompted.

## Five minutes to your first Task

### Install

Grab one installer from the [latest release](https://github.com/yangheng95/opencorvus/releases/latest):

| Operating system    | Recommended asset                       | Alternatives                                       |
| ------------------- | --------------------------------------- | -------------------------------------------------- |
| Windows x64         | `OpenCorvus_<version>_x64-setup.exe`     | `.msi` for managed installation                    |
| macOS Apple silicon | `OpenCorvus_<version>_aarch64.dmg`       | `.app.tar.gz` archive                              |
| macOS Intel         | `OpenCorvus_<version>_x64.dmg`           | `.app.tar.gz` archive                              |
| Linux x64           | `OpenCorvus_<version>_amd64.AppImage`    | `.deb` for Debian/Ubuntu or `.rpm` for Fedora/RHEL |
| Linux ARM64         | `OpenCorvus_<version>_aarch64.AppImage`  | `_arm64.deb` or `.aarch64.rpm`                     |

Replace `<version>` with the version on the release, for example `0.0.55-beta`. For terminal or
headless use, the same release publishes a complete `opencorvus-<platform>.tar.gz` command-line
interface (CLI) runtime for every row; x64 platforms also publish a `-baseline.tar.gz` variant
for processors without Advanced Vector Extensions 2 (AVX2).

Or build from source:

```bash
git clone https://github.com/yangheng95/opencorvus.git
cd opencorvus
bun install
bun run --cwd packages/opencorvus build
bun packages/opencorvus/src/index.ts doctor
```

`doctor` tells you what is missing before you find out the hard way.

### Run something

Start the headless server in the repository you want OpenCorvus to work in:

```bash
cd /path/to/your/repo
opencorvus serve            # or: bun "$OPENCORVUS_SOURCE" serve
```

Open the local workbench at `http://127.0.0.1:7878/ui/`, or create a Task over HTTP:

```bash
curl -X POST http://127.0.0.1:7878/task \
  -H "content-type: application/json" \
  -H "x-opencorvus-directory: $PWD" \
  -d '{
    "request": "Add unit tests for src/foo.ts covering the happy path and two error paths."
  }'
```

You get `202` back with a `task_id`. Then watch it work:

```bash
curl -N http://127.0.0.1:7878/task/<task_id>/events
```

Every event on that stream carries the same envelope, so you can follow the run without the user
interface (UI):

```jsonc
data: {
  "event_id": "prt_…",
  "task_id":  "tsk_…",
  "type":     "engine.artifact",     // what happened
  "summary":  "…",                   // one line, human-readable
  "sequence": 214,                   // durable cursor — resume with ?after=214
  "payload":  { /* typed, per event type */ }
}
```

Types you will see across a normal run include `task.created`, `task.execution.opened`,
`agent.execution.lifecycle`, `permission.asked`, `interaction.requested`, `engine.artifact`,
`task.heartbeat`, and one of `task.completed` / `task.failed` / `task.cancelled`. Disconnecting
is not losing the run: reconnect with `?after=<sequence>` and the stream resumes.

> [!TIP]
> If you expose `opencorvus serve` beyond localhost, set `OPENCORVUS_SERVER_PASSWORD` first. It
> will start without one, but it prints `server is unsecured` and leaves HTTP Basic
> Authentication disabled — that warning is the only thing standing between your repository and
> the network.

<table>
  <tr>
    <td width="50%"><img src="packages/web/src/assets/lander/harness-gallery/work-harness.png" alt="OpenCorvus Work Harness" /></td>
    <td width="50%"><img src="packages/web/src/assets/lander/harness-gallery/mission-composer.png" alt="OpenCorvus Mission composer" /></td>
  </tr>
  <tr>
    <td><strong>Work</strong> keeps a long-form deliverable and its review surface together.</td>
    <td><strong>Mission</strong> turns the same visible context into owned, coordinated work.</td>
  </tr>
</table>

## Where long work actually breaks

Three failures. Each one has a mechanism behind it, not a promise.

### 1. It stops short

A step is skipped, a process dies, or a Task ends terminal with the goal half met.

Requirements emit `REQ-N` entries carrying their own acceptance conditions and explicit
non-goals, and a squad's workflow declares what depends on what. Ownership is an append-only
lease: when a process disappears, the reconciler terminalizes the abandoned Turn at the lease's
expiry — a deterministic timestamp — and only then acquires a successor. Every accepted input
passes one total-order reduction in which each state has a name.

**Terminal is not final.** A Task that reached `completed`, `failed`, or `cancelled` reopens when
you send it a message, at a fresh execution occurrence, with the prior occurrence intact as an
immutable fact. There is no separate retry or replan control to hunt for — a state whose only
exit is special vocabulary is a state you cannot leave with an ordinary action.

### 2. The result is not dependably usable

Success is reported, but what arrives is a summary you cannot check.

Handoffs are typed Artifacts with provenance and exact locators, read across a causal boundary
that only exposes completed prior-step output. The host records file changes and command results
independently of any agent's account of them. Fact-checking, integrity review, and visual quality
assurance run as named stages with their own agents. A qualified Work Artifact — today the
editable presentation profile — is delivered only once it has been rendered, inspected, and given
a validation receipt.

### 3. The workflow never improves

The tenth run repeats the mistake of the first, because the correction died with the
conversation.

Tell a squad what you actually wanted and it drafts a revision from what you said; you accept it,
and the receipt is how you undo it. Or run a measured Evolution Lab campaign. Nothing installs
without your confirmation — see below.

The boundary is real: unattended work continues only while your runtime is online, and output
still depends on the model, the reachable sources, and the available evidence. Full detail:
[Where long-horizon work breaks](https://opencorvus.com/concepts/long-horizon/).

## Squads, combined

The longest work is not one team working longer. It is several, each owning a stage, each handing
the next one something it can read.

A Mission records which Expert Squad IDs are available when it starts; capabilities installed
later do not silently widen that set. Each child Task then resolves one admitted ID to one exact
package revision plus its selected workflow, fixed for that Task's lifetime. Composition happens
at the Mission level; ownership stays at the Task level.

Chains that already ship:

| Combination                       | Chain                                                                                                                                                | Squads · Roles |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------- |
| DeBERTa research program          | Deep Research → Advanced → Data Analysis → Research Studio → Academic Paper Review → Base                                                              | 6 · 44         |
| A systems paper about OpenCorvus  | Scientific Research Design → Deep Research → Advanced → Data Analysis → Review & Debug → Patent Landscape → Office Delivery → Research Studio → Academic Paper Review | 9 · 55 |
| Deal due diligence                | M&A Due Diligence → Forensic Accounting → Commercial Legal → Tax Compliance → Internal Audit Control Assurance                                         | 5 · 29         |
| Incident to written knowledge     | Service Reliability Incident Operations → Digital Forensics → Review & Debug → Knowledge Base Operations                                               | 4 · 18         |
| Launching something               | Product Management → Marketing & Growth → SEO & Generative Engine Optimization → Product Video → Localization & Adaptation                             | 5 · 26         |

Split where a delivery can be independently owned, accepted, or depended on. Splitting for its
own sake produces coordination overhead with no owner. See
[Squad composition](https://opencorvus.com/concepts/squad-composition/).

## Squads that revise

An Expert Squad is a versioned package, not a prompt you edited once. Two paths lead to a
revision, and both end at a confirmation you have to give.

**From what you said.** State a durable preference — one that would apply again to the next task
of this kind — and the host copies the exact installed revision, applies the edits, validates the
result as a runnable package, and stages a candidate carrying your preference, which the drafting
agent is instructed to reproduce word for word rather than paraphrase. Capability cannot widen: a
candidate granting a Tool, Skill, base role, or reference the squad did not already hold is
refused. A claim to have rewritten a conflicting instruction is checked against the bytes —
declare the rewrite and then only append, and the candidate is refused. (Appending leaves the
older, more specific instruction in force, which is the usual reason a revision appears to change
nothing.)

**From measurement.** The Evolution Lab squad freezes the target revision, cases, scorers,
environment, arm order, budget, and mutation surface *before* any candidate is authored, then runs
the arms and produces an integrity review and a comparison recommendation as typed, persisted
Artifacts.

Three operations change an installed package — `feedback_revision`, `promotion`, and
`restoration` — and each requires a real operator message bound to that exact Project, Task, and
root Session, carrying the exact confirmation text for that change. **OpenCorvus does not modify
its own squads in the background:** there is no autonomous rewrite loop and no revision that
installs because a metric moved. Every revision a target has held stays listed, and restoration
is the undo against that list — it cites one earlier mutation receipt and returns the target to a
revision that receipt itself witnessed. See
[How squads evolve](https://opencorvus.com/expert-squads/evolution/).

## What runs on first launch, and what you can replace

Everything below works the moment you install. Everything below is also a configuration surface.

| Layer                 | Ships working                                                                                                                     | Replace via                            |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| **Agent loop**        | Five roles — `coding`, `chat`, `work`, `control`, `mission` — on a streaming loop with typed tool results.                          | `agent`, prompt overrides              |
| **Tools**             | 43 built-in tools (`bash`, `read`, `edit`, `search_code`, `websearch`, `browser_preview`, `memory`, `planner`, `delegate_agent`, …) plus Model Context Protocol (MCP) servers and plugins. Browser and Computer control ship as default capability blocks. | `tools`, `mcp`, `plugin` |
| **Models**            | 87 providers and 2,579 models resolved from one bundled catalog, local runtimes included.                                          | `model`, `small_model`, `provider`     |
| **Context**           | Automatic compaction and per-turn context budgeting keep long runs inside the window.                                              | model and budget configuration         |
| **Memory**            | Project and session memory with search, organization, and explicit injection.                                                      | `instructions`, memory configuration   |
| **Permission**        | Every side effect passes one durable allow / ask / deny authority before it runs.                                                  | `permission` rules, shell scope        |
| **Expert Squads**     | 119 inspectable squads — 4 embedded and ready immediately, 115 importable. A Task pins one exact revision and cannot silently switch it. | `expert_squads`, author your own  |
| **Durable execution** | Process leases, an event log, and a reconciler resume owned work after a restart.                                                  | Platform guarantee                     |
| **Verification**      | Integrity review, fact-checking, and visual quality assurance run as named stages.                                                 | acceptance configuration               |
| **Evidence**          | Host observations record file changes and command results apart from any agent summary.                                            | Platform guarantee                     |
| **Surfaces**          | Desktop app, HTTP application programming interface (API) with Server-Sent Events (SSE), 13 chat channels, scheduled automation.   | SDK, plugin API, Agent Client Protocol |

## Make it yours

Configuration lives in one project file — `<repo>/.opencorvus/opencorvus.jsonc`. Nothing in it is
required; the shipped defaults are a starting point, not a boundary.

```jsonc
{
  "$schema": "https://opencorvus.ai/config.json",
  "model": "github-copilot/claude-haiku-4.5",

  // Every side effect passes this authority before it runs. Later rules override earlier ones.
  "permission": {
    "bash": { "git push*": "deny", "*": "allow" },
    "webfetch": "allow",
  },

  "instructions": ["./docs/house-rules.md"],
}
```

Per-rule actions are `allow` and `deny`. Whether an unmatched invocation pauses for you or
proceeds is the project's `permission_mode` — `full_access` (the default) or `ask`, frozen for a
Session at its first permission-bearing invocation.

| You want to…                      | Configure                                               |
| --------------------------------- | ------------------------------------------------------- |
| Use a different model or provider | `model`, `small_model`, `provider`                      |
| Add or restrict capabilities      | `tools`, `mcp`, `plugin`                                |
| Change who may do what            | `permission` rules (allow / ask / deny) and shell scope |
| Redefine an agent's behavior      | `agent` with `prompt` or `prompt_append`                |
| Swap or override an Expert Squad  | `expert_squads`                                         |
| Add project context or house rules| `instructions`                                          |
| Add repeatable operations         | `command`, `formatter`, `keybinds`                      |

See the [configuration reference](https://opencorvus.com/config/) for the complete surface.
Beyond configuration, three extension paths keep the harness itself open:

- **JavaScript SDK** — [`packages/sdk/js`](./packages/sdk/js), with a published
  [OpenAPI description](./packages/sdk/openapi.json), for driving Tasks from your own code.
- **Plugin API** — [`packages/plugin`](./packages/plugin) for custom tools, artifact producers,
  and evidence sources.
- **Open protocols** — MCP servers for capabilities, and the Agent Client Protocol for embedding
  OpenCorvus in another client.

Packaging specialist knowledge as an Expert Squad is the same kind of act: roles, workflow,
Skills, tools, selection guidance, version, and digest travel together, and it stays inspectable.
See the [Expert Squad author path](https://opencorvus.com/publish/).

## Where this sits

### Compared with the nearest two

Every cell is a checkable fact about a published capability, not a judgement.

| | [WorkBuddy](https://www.workbuddy.ai/) | [DeepSeek Harness](https://www.deepseek.com/harness/) | **OpenCorvus** |
| --------------- | ----------------------------- | ------------------------------ | ------------------------------------------ |
| Licence         | Commercial, token packages    | MIT                            | **MIT**                                    |
| Runs            | Cloud service                 | Locally                        | **Your machine or your server**            |
| Starting point  | One sentence to a finished output | Plugin kernel, compose it yourself | **A whole harness working, then replace any layer** |
| Capability unit | Experts and Expert Groups     | Plugins                        | **Versioned squads with a digest (119)**   |
| Getting in      | Desktop client                | One `npx` line to a web UI     | **Installer or source build**              |

DeepSeek Harness is MIT licensed too, and records a run just as completely; its plugin kernel goes
further than ours. The choice is whether you want to assemble a harness or start from one.

### Questions people actually ask

<details>
<summary><strong>How does this relate to Claude Code or Codex?</strong></summary>

Different layer, and they work together. Those are coding sessions bound to one vendor's models;
OpenCorvus is the harness — model-agnostic, multi-agent, self-hosted. The desktop app can even
discover Claude Code, Codex, Gemini Code, GitHub Copilot, and GLM Code already installed on your
machine and open one in the current project directory.
</details>

<details>
<summary><strong>I already use one of those. Do I need this?</strong></summary>

Depends what is missing. If you want a better single coding conversation, stay where you are. If
you want coordination across many owned tasks, version-pinned expert squads, one permission and
evidence trail, and work that survives a restart — that is what this does.
</details>

<details>
<summary><strong>Does my code leave my machine?</strong></summary>

The runtime runs on your machine or your own server, MIT licensed, every line auditable. Model
requests go only to the provider you configure; pick a local runtime and nothing leaves the
network at all.
</details>

<details>
<summary><strong>What exactly is an Expert Squad?</strong></summary>

An inspectable capability package: roles, workflow, Skills, tools, selection guidance, version,
and digest frozen together. A Task pins one exact revision and cannot silently switch it mid-life.
Packages verify their signature and SHA-256 digest before they land on disk.
</details>

<details>
<summary><strong>Is it built on another agent framework?</strong></summary>

No. The harness and the desktop app are both written in this repository, with no third-party
agent engine underneath — that is what makes every layer replaceable. It stands on plenty of open
source: Bun, the AI SDK, SolidJS, Tauri.
</details>

<details>
<summary><strong>How long is long-horizon, really?</strong></summary>

As long as your runtime stays online. Work survives a restart because leases, an event log, and a
reconciler own it — not because a process stayed alive. A completed, failed, or cancelled Task
reopens on your next message, at a fresh execution occurrence, with the old history intact.
</details>

<details>
<summary><strong>Does it change itself behind my back?</strong></summary>

No. A revision is drafted, validated as a runnable package, and staged. It installs only after
you confirm it in your own message, and the receipt you get back is how you restore the previous
revision.
</details>

## What this does not do

Stated plainly, because a tool that only ever wins is one you stop believing.

- It coordinates compatible models, tools, and executors. It does not make arbitrary third-party
  code compatible or safe.
- Persisted Tasks resume, but **no work executes while the owning runtime is offline**. This is
  not a hosted service and it does not promise unbounded autonomy.
- Results depend on model behavior, source access, installed capabilities, and the evidence
  available to the run.
- It is in active development. Interfaces and packaged integrations may change between beta
  releases.

## Surfaces and integrations

| Surface                | Status        | What it provides                                                                                                              |
| ---------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Desktop Overlay        | Available     | Conversations, Missions, Tasks, Expert Squads, evidence, and delivery review                                                    |
| Headless HTTP API      | Available     | Task lifecycle routes and SSE progress streams                                                                                  |
| Slack gateway          | Available     | Start and operate orchestrated work from a Slack thread                                                                         |
| Multi-channel adapters | In repository | Slack, Telegram, Discord, Feishu, WhatsApp, Google Chat, Microsoft Teams, Line, Matrix, Mattermost, Signal, WeCom, and DingTalk |
| GitHub Action          | Available     | Repository automation described in [`github/README.md`](./github/README.md)                                                     |

Useful Task endpoints — the ones marked *directory* need the Task's project directory in the
`x-opencorvus-directory` header:

| Endpoint                       | Purpose                    | Directory |
| ------------------------------ | -------------------------- | --------- |
| `GET /tasks`                   | List project Tasks         | required  |
| `GET /task/<id>`               | Task state                 | —         |
| `GET /task/<id>/board`         | Kanban view                | —         |
| `GET /task/<id>/events`        | SSE stream, resumable      | —         |
| `POST /task/<id>/message`      | Append a follow-up         | required  |
| `POST /task/<id>/retry`        | Retry with the same plan   | required  |
| `POST /task/<id>/replan`       | Discard the plan, re-plan  | required  |
| `POST /task/<id>/cancel`       | Cancel                     | required  |

### Slack

```bash
export SLACK_BOT_TOKEN=xoxb-...
export SLACK_APP_TOKEN=xapp-...
bun run --cwd packages/channel-runtime dev
```

The gateway starts work from the first message in a thread, mirrors planning and delivery
updates, accepts permission responses such as `allow`, `always`, and `reject`, and carries
operator follow-ups back into the Task.

### Drive OpenCorvus from another assistant

The repository includes a portable [`opencorvus` Agent Skill](./skills/opencorvus/SKILL.md). It
teaches any Agent Skills-compatible assistant how to inspect, configure, run, and troubleshoot
OpenCorvus; create and monitor Tasks; send follow-up input; and review delivery evidence.
Installing the skill does **not** install the runtime — complete an installation path above
first, then copy the complete skill directory including its
[`references/`](./skills/opencorvus/references/) files.

```bash
# Hermes Agent
mkdir -p ~/.hermes/skills/developer-tools
cp -R ./skills/opencorvus ~/.hermes/skills/developer-tools/opencorvus
hermes skills list

# OpenClaw
openclaw skills install ./skills/opencorvus --as opencorvus
openclaw skills check
```

Start a new session, then address it as `/opencorvus` (Hermes, messaging channels) or
`$opencorvus` (OpenClaw Control UI):

```text
/opencorvus Check whether OpenCorvus is installed and healthy. Do not change anything.
```

Host-specific installation, PowerShell commands, safe credential handling, and complete operating
examples are in the [`skill-installation`](./skills/opencorvus/references/skill-installation.md)
and [`operations`](./skills/opencorvus/references/operations.md) references.

## Core model

| Object           | Role                                                                                                                       |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Mission          | Coordinates an outcome that spans multiple Tasks and records their dependencies.                                           |
| Task             | Owns one project-scoped unit of work, one fixed Expert Squad, any selected workflow, its Sessions, and lifecycle decisions. |
| Expert Squad     | Packages an agent roster, instructions, Skills, tools, MCP access, and any declared workflows.                             |
| Workflow         | Declares the agents that run for a Task and their dependency order.                                                        |
| Artifact         | Stores a typed output or file snapshot with provenance so another agent or Task can read the exact result.                 |
| Host observation | Records facts such as file changes and command results independently of an agent's summary.                                |

For a Task, the selected Expert Squad stays fixed; a selected workflow is also fixed. Workers
stream messages and tool calls, publish Artifacts when their contract requires them, and pass
exact Artifact references to downstream workers. The Orchestrator uses those records and host
observations for lifecycle decisions. Unresolved limitations and blockers stay visible in agent
messages rather than being smoothed into a summary.

![Mission and Expert Squad execution flow](assets/agent-teams-workflow.png)

## Development

```bash
# repository root
bun install

# core CLI and orchestrator
bun run --cwd packages/opencorvus typecheck
bun run --cwd packages/opencorvus test

# channel runtime adapters
bun run --cwd packages/channel-runtime test

# regenerate the JavaScript SDK
bun ./packages/sdk/js/script/build.ts
```

Repository layout, build details, and the release process live in
[`CODEBASE_STRUCTURE.md`](./CODEBASE_STRUCTURE.md),
[`BUILD_AND_DEV_QUICKSTART.md`](./BUILD_AND_DEV_QUICKSTART.md), and
[`RELEASE.md`](./RELEASE.md).

## Documentation and contributing

- Documentation: <https://opencorvus.com/start/quickstart/>
- Changelog: [`CHANGELOG.md`](./CHANGELOG.md)
- GitHub Action: [`github/README.md`](./github/README.md)
- Contributing: [`CONTRIBUTING.md`](./CONTRIBUTING.md)
- Support: [`SUPPORT.md`](./SUPPORT.md)
- Security: [`SECURITY.md`](./SECURITY.md)
- Code of Conduct: [`CODE_OF_CONDUCT.md`](./CODE_OF_CONDUCT.md)
- Third-party notices: [`THIRD_PARTY_NOTICES.md`](./THIRD_PARTY_NOTICES.md)

Issues and squads are both welcome. If a squad you wrote does the job better than one we ship,
that is the contribution we want most.

## Open-source acknowledgements

OpenCorvus evolved from the [OpenCode](https://github.com/anomalyco/opencode) codebase and still
carries explicitly synchronized OpenCode work in its model provider, GitHub Copilot, and
provider-plugin surfaces. We are grateful to the OpenCode maintainers and contributors for that
foundation.

Major runtime and distribution dependencies include:

- **Runtime and agent core:** [Bun](https://github.com/oven-sh/bun),
  [Vercel AI SDK](https://github.com/vercel/ai),
  [Hono](https://github.com/honojs/hono), and
  [Drizzle ORM](https://github.com/drizzle-team/drizzle-orm).
- **Open interoperability:** the official
  [Model Context Protocol TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk),
  [MCP Apps](https://github.com/modelcontextprotocol/ext-apps), and
  [Agent Client Protocol TypeScript SDK](https://github.com/agentclientprotocol/typescript-sdk).
- **Desktop application:** [Tauri](https://github.com/tauri-apps/tauri),
  [SolidJS](https://github.com/solidjs/solid), and
  [Kobalte](https://github.com/kobaltedev/kobalte).
- **Execution and evidence:** [Playwright](https://github.com/microsoft/playwright),
  [CUA](https://github.com/trycua/cua), and
  [OfficeCLI](https://github.com/iOfficeAI/OfficeCLI).
- **Packaged command-line runtime:** [Node.js](https://github.com/nodejs/node) and
  [ripgrep](https://github.com/BurntSushi/ripgrep).
- **Interactive workbench:** [CodeMirror](https://github.com/codemirror/dev),
  [xterm.js](https://github.com/xtermjs/xterm.js),
  [Mermaid](https://github.com/mermaid-js/mermaid),
  [MapLibre GL JS](https://github.com/maplibre/maplibre-gl-js),
  [PDF.js](https://github.com/mozilla/pdf.js),
  [Reveal.js](https://github.com/hakimel/reveal.js),
  [Vega-Lite](https://github.com/vega/vega-lite),
  [Cytoscape.js](https://github.com/cytoscape/cytoscape.js), and
  [Univer](https://github.com/dream-num/univer).
- **Built-in capability sources:** the bundled design and interview Skills adapt ideas and
  protocols from [Taste Skill](https://github.com/Leonxlnx/taste-skill) and
  [Matt Pocock's Skills](https://github.com/mattpocock/skills). Their provenance and license files
  remain with the adapted Skills.
- **Documentation:** [Astro](https://github.com/withastro/astro) and
  [Starlight](https://github.com/withastro/starlight).

The repository manifests and [`THIRD_PARTY_NOTICES.md`](./THIRD_PARTY_NOTICES.md) contain the
complete dependency and notice records. Each upstream project keeps its own license and
trademarks.

## License

[MIT](./LICENSE)
