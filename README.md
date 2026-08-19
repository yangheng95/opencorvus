<p align="center">
  <img src="assets/readme-head.png" alt="OpenCorvus" width="440" />
</p>

<h3 align="center">The open-source multi-agent harness platform</h3>

<p align="center">
  <strong>A complete harness that works out of the box — and every layer is yours to rebuild.</strong>
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
  <img alt="13 chat channels" src="https://img.shields.io/badge/chat%20channels-13-2946d3?style=for-the-badge" />
</p>

<p align="center">
  <strong>English</strong> | <a href="./README.zh-CN.md">简体中文</a>
</p>

<p align="center">
  <a href="https://opencorvus.com">Website</a> ·
  <a href="https://opencorvus.com/start/quickstart/">Quickstart</a> ·
  <a href="https://opencorvus.com/download/">Download</a> ·
  <a href="https://opencorvus.com/market/">Expert Squads</a> ·
  <a href="https://opencorvus.com/mission/">Mission</a> ·
  <a href="https://opencorvus.com/use-with-agents/">Use with Agents</a>
</p>

---

An **agent harness** is the runtime that turns a model into an agent: the loop, tool
routing, context management, memory, permission enforcement, and recovery. Most
projects hand you a framework and leave you to assemble one.

OpenCorvus ships the harness already assembled. Install it and you get a streaming
agent loop across five primary roles, 42 built-in tools, 87 model providers, a durable
permission authority, project and session memory, automatic context compaction,
restart-safe orchestration, and a catalog of 119 inspectable Expert Squads — working
on first launch.

Then every layer underneath is a configuration surface. Swap the model, narrow the
tool set, tighten the permission rules, replace an entire squad, or drive the whole
harness from the SDK.

Both halves are written in this repository — the harness runtime and the desktop
application — with no third-party agent engine underneath. That is a design choice
rather than a boast: it is what makes every layer replaceable. It stands on a great
deal of open source, Bun, the AI SDK, SolidJS and Tauri among them.

<p align="center">
  <a href="https://github.com/yangheng95/opencorvus/raw/main/packages/web/public/media/opencorvus-demo.mp4"><img src="https://github.com/yangheng95/opencorvus/raw/main/packages/web/public/media/opencorvus-demo.gif" alt="One recorded OpenCorvus run" width="880" /></a>
</p>

<p align="center"><sub>Two moments from one real run: the daily-candle chart it drew, then the ecosystem graph and Word report it published. <a href="https://github.com/yangheng95/opencorvus/raw/main/packages/web/public/media/opencorvus-demo.mp4">Watch the whole run</a> &mdash; 1 min 44 s, desktop v0.0.47beta, no audio.</sub></p>

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

> [!IMPORTANT]
> OpenCorvus is under active development. This README describes capabilities in the
> repository today. Output quality depends on the selected models, reachable sources,
> installed capabilities, and available evidence. Unattended work only runs while the
> local or hosted OpenCorvus runtime is online.

## What runs on first launch

| Capability          | What ships                                                                                  |
| ------------------- | ------------------------------------------------------------------------------------------- |
| **Model providers** | 87 providers and 2,579 models resolved from one bundled catalog, including local runtimes.  |
| **Tools**           | 42 built-in tools, with Browser and Computer control available as default capability blocks. |
| **Expert Squads**   | 119 in the public catalog — 4 embedded and ready immediately, 115 importable.                |
| **Agent roles**     | Five primary roles: `coding`, `chat`, `work`, `control`, and `mission`.                     |
| **Chat channels**   | Slack, Discord, Telegram, Feishu, DingTalk, WeCom, WhatsApp, Line, Signal, Matrix, Mattermost, Microsoft Teams, and Google Chat. |
| **Surfaces**        | Desktop application, HTTP API with Server-Sent Events (SSE), and scheduled automation.      |

## The harness, layer by layer

Every layer runs the moment you install, and every layer is a configuration surface.

| Layer                 | Ships working                                                                                   | Replace via                              |
| --------------------- | ----------------------------------------------------------------------------------------------- | ---------------------------------------- |
| **Agent loop**        | Five primary roles on a streaming loop with typed tool results.                                 | `agent`, prompt overrides                |
| **Tools**             | 42 built-in tools plus Model Context Protocol (MCP) servers and Language Server Protocol (LSP). | `tools`, `mcp`, `lsp`, `plugin`          |
| **Models**            | 87 providers, 2,579 models, one bundled catalog.                                                | `model`, `small_model`, `provider`       |
| **Context**           | Automatic compaction and per-turn context budgeting keep long runs inside the window.           | model and budget configuration           |
| **Memory**            | Project and session memory with search, organization, and explicit injection.                   | `instructions`, memory configuration     |
| **Permission**        | Every side effect passes one durable allow / ask / deny authority before it runs.                | `permission` rules, shell scope          |
| **Expert Squads**     | 119 inspectable squads; a Task pins one exact revision and cannot silently switch it.            | `expert_squads`, author your own         |
| **Durable execution** | Process leases, an event log, and a reconciler resume owned work after a restart.               | Platform guarantee                       |
| **Verification**      | Integrity review, fact-checking, and visual QA run as named stages.                             | acceptance configuration                 |
| **Evidence**          | Host observations record file changes and command results apart from any agent summary.         | Platform guarantee                       |
| **Surfaces**          | Desktop, HTTP API with SSE, 13 chat channels, scheduled automation.                             | SDK, plugin API, Agent Client Protocol   |

## Quick Start

### Download the desktop app

Download one installer for your operating system from the
[latest GitHub Release](https://github.com/yangheng95/opencorvus/releases/latest),
or browse [all releases](https://github.com/yangheng95/opencorvus/releases). The large
per-platform artifacts shown on a GitHub Actions run are build containers that hold
several formats; public Releases expose every installer as a separate download.

| Operating system    | Recommended asset                       | Alternatives                                       |
| ------------------- | --------------------------------------- | -------------------------------------------------- |
| Windows x64         | `OpenCorvus_<version>_x64-setup.exe`    | `.msi` for managed installation                    |
| macOS Apple silicon | `OpenCorvus_<version>_aarch64.dmg`      | `.app.tar.gz` archive                              |
| macOS Intel         | `OpenCorvus_<version>_x64.dmg`          | `.app.tar.gz` archive                              |
| Linux x64           | `OpenCorvus_<version>_amd64.AppImage`   | `.deb` for Debian/Ubuntu or `.rpm` for Fedora/RHEL |
| Linux ARM64         | `OpenCorvus_<version>_aarch64.AppImage` | `_arm64.deb` or `.aarch64.rpm`                     |

For terminal or headless use, the same Release publishes a complete
`opencorvus-<platform>.tar.gz` command-line interface (CLI) runtime for every row. x64
platforms also publish a `-baseline.tar.gz` variant for processors without Advanced
Vector Extensions 2 (AVX2).

Replace `<version>` with the version shown on the release, for example `0.0.44-beta.1`.
Download only the file you intend to install.

### Install from source

```bash
git clone https://github.com/yangheng95/opencorvus.git
cd opencorvus
bun install
bun run --cwd packages/opencorvus build
bun packages/opencorvus/src/index.ts doctor
```

The source build above is the repository-local installation path. Desktop downloads are
verified by the native GitHub Actions package matrix attached to their release; a
development Actions artifact is not a public installer feed.

### Start the server

Start the headless server in the repository where you want OpenCorvus to work:

```bash
OPENCORVUS_SOURCE=/path/to/opencorvus/packages/opencorvus/src/index.ts
cd /path/to/your/repo
bun "$OPENCORVUS_SOURCE" serve
```

Open the local Overlay at `http://127.0.0.1:7878/ui/`, or create a Task through the
HTTP API:

```bash
curl -X POST http://127.0.0.1:7878/task \
  -H "content-type: application/json" \
  -H "x-opencorvus-directory: $PWD" \
  -d '{
    "request": "Implement the requested change, validate it, and stop only when the result is ready for review or a real blocker is visible."
  }'
```

The server returns `202` with a `task_id`. Stream progress with Server-Sent Events:

```bash
curl -N http://127.0.0.1:7878/task/<task_id>/events
```

> [!TIP]
> If you expose `opencorvus serve` beyond localhost, set `OPENCORVUS_SERVER_PASSWORD`
> first.

## Make it yours

The shipped defaults are a starting point, not a boundary. Configuration lives in one
project file; everything below is opt-in.

| You want to…                          | Configure                                                            |
| ------------------------------------- | -------------------------------------------------------------------- |
| Use a different model or provider     | `model`, `small_model`, `provider`                                   |
| Add or restrict capabilities          | `tools`, `mcp`, `lsp`, `plugin`                                      |
| Change who may do what                | `permission` rules (allow / ask / deny) and shell scope              |
| Redefine an agent's behavior          | `agent` with `prompt` or `prompt_append`                             |
| Swap or override an Expert Squad      | `expert_squads`                                                      |
| Add project context or house rules    | `instructions`                                                       |
| Add repeatable operations             | `command`, `formatter`, `keybinds`                                   |

Beyond configuration, three extension paths keep the harness itself open:

- **JavaScript SDK** — [`packages/sdk/js`](./packages/sdk/js) with a published
  [OpenAPI description](./packages/sdk/openapi.json) for driving Tasks from your own code.
- **Plugin API** — [`packages/plugin`](./packages/plugin) for custom tools, artifact
  producers, and evidence sources.
- **Open protocols** — Model Context Protocol servers for capabilities, and the Agent
  Client Protocol for embedding OpenCorvus in another client.

Package specialist knowledge as an inspectable Expert Squad — roles, workflow, Skills,
tools, selection guidance, version, and digest travel together — and contribute it
through the repository. See the [Expert Squad author path](https://opencorvus.com/publish/).

## Control OpenCorvus from Hermes Agent or OpenClaw

The repository includes a portable [`opencorvus` Agent Skill](./skills/opencorvus/SKILL.md).
It teaches an Agent Skills-compatible assistant how to inspect, configure, run, and
troubleshoot OpenCorvus; create and monitor Tasks; send follow-up input; and review
delivery evidence. Installing the skill does **not** install the OpenCorvus runtime, so
complete one of the installation paths above first and copy the complete skill
directory, including its [`references/`](./skills/opencorvus/references/) files.

### Hermes Agent

From an OpenCorvus checkout:

```bash
mkdir -p ~/.hermes/skills/developer-tools
cp -R ./skills/opencorvus ~/.hermes/skills/developer-tools/opencorvus
hermes skills list
```

Start a new session or use `/reset`, then address the skill as a slash command:

```text
/opencorvus Check whether OpenCorvus is installed and healthy. Do not change anything.
```

### OpenClaw

Install the same local package into the active workspace:

```bash
openclaw skills install ./skills/opencorvus --as opencorvus
openclaw skills check
```

Start a new session, then invoke `$opencorvus` in the Control UI or `/opencorvus` in
messaging channels:

```text
Use $opencorvus to start OpenCorvus for /absolute/path/to/project, create a Task for the requested outcome, and report the task ID and observable progress.
```

Once invoked, the assistant selects the relevant packaged reference and controls
OpenCorvus through its current CLI or HTTP API. You can ask it to inspect an
installation without changing it, configure a provider, start a local or
password-protected service, create or monitor a Task, send a follow-up message, retry
or replan work, cancel with explicit authority, and inspect the board, events,
Artifacts, and blockers before declaring completion. For host-specific installation
details, PowerShell commands, safe credential handling, and complete operating
examples, see the [`skill-installation`](./skills/opencorvus/references/skill-installation.md)
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

For a Task, the selected Expert Squad remains fixed; a selected workflow is also fixed.
Workers stream messages and tool calls, publish Artifacts when their contract requires
them, and pass exact Artifact references to downstream workers. The Orchestrator uses
those records and host observations for lifecycle decisions. Unresolved limitations and
blockers remain visible in agent messages.

![Mission and Expert Squad execution flow](assets/agent-teams-workflow.png)

## Platform surfaces

| Surface                | Status        | What it provides                                                                                                                |
| ---------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Desktop Overlay        | Available     | Conversations, Missions, Tasks, Expert Squads, evidence, and delivery review                                                    |
| Headless HTTP API      | Available     | Task lifecycle routes and SSE progress streams                                                                                  |
| Slack gateway          | Available     | Start and operate orchestrated work from a Slack thread                                                                         |
| Multi-channel adapters | In repository | Slack, Telegram, Discord, Feishu, WhatsApp, Google Chat, Microsoft Teams, Line, Matrix, Mattermost, Signal, WeCom, and DingTalk |
| GitHub Action          | Available     | Repository automation described in [`github/README.md`](./github/README.md)                                                     |

Useful Task endpoints:

- `GET /tasks` with a project directory
- `GET /task/<task_id>` without a project directory
- `GET /task/<task_id>/board` without a project directory
- `POST /task/<task_id>/message` with the Task project directory
- `POST /task/<task_id>/retry` with the Task project directory
- `POST /task/<task_id>/replan` with the Task project directory
- `POST /task/<task_id>/cancel` with the Task project directory

### Coding CLI shortcuts

The desktop can discover installed Claude Code, Codex, Gemini Code, GitHub Copilot, and
GLM Code command-line interfaces and open one in a terminal at the current project
directory. This starts an interactive terminal command; it does not assign the Task to
an external executor.

### Slack

```bash
export SLACK_BOT_TOKEN=xoxb-...
export SLACK_APP_TOKEN=xapp-...
bun run --cwd packages/channel-runtime dev
```

The gateway starts work from the first message in a thread, mirrors planning and
delivery updates, accepts permission responses such as `allow`, `always`, and `reject`,
and carries operator follow-ups back into the Task.

## Development

```bash
# repository root
bun install

# core command-line interface and orchestrator
bun run --cwd packages/opencorvus typecheck
bun run --cwd packages/opencorvus test

# channel runtime adapters
bun run --cwd packages/channel-runtime test

# regenerate the JavaScript Software Development Kit (SDK)
bun ./packages/sdk/js/script/build.ts
```

## Limits

- OpenCorvus coordinates compatible models, tools, and executors; it does not make
  arbitrary third-party code compatible or safe.
- Persisted Tasks can be resumed, but no work executes while the owning runtime is
  offline.
- Results depend on model behavior, source access, installed capabilities, and the
  evidence available to the run.
- The project is in active development. Interfaces and packaged integrations may change
  between beta releases.

## Documentation and contributing

- Documentation: <https://opencorvus.com/start/quickstart/>
- Changelog: [`CHANGELOG.md`](./CHANGELOG.md)
- GitHub Action: [`github/README.md`](./github/README.md)
- Contributing: [`CONTRIBUTING.md`](./CONTRIBUTING.md)
- Support: [`SUPPORT.md`](./SUPPORT.md)
- Security: [`SECURITY.md`](./SECURITY.md)
- Code of Conduct: [`CODE_OF_CONDUCT.md`](./CODE_OF_CONDUCT.md)
- Third-party notices: [`THIRD_PARTY_NOTICES.md`](./THIRD_PARTY_NOTICES.md)

## Open-source acknowledgements

OpenCorvus evolved from the [OpenCode](https://github.com/anomalyco/opencode) codebase
and still carries explicitly synchronized OpenCode work in its model provider, GitHub
Copilot, and provider-plugin surfaces. We are grateful to the OpenCode maintainers and
contributors for that foundation.

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
- **Built-in capability sources:** the bundled design and interview Skills adapt ideas
  and protocols from [Taste Skill](https://github.com/Leonxlnx/taste-skill) and
  [Matt Pocock's Skills](https://github.com/mattpocock/skills). Their provenance and
  license files remain with the adapted Skills.
- **Documentation:** [Astro](https://github.com/withastro/astro) and
  [Starlight](https://github.com/withastro/starlight).

The repository manifests and [`THIRD_PARTY_NOTICES.md`](./THIRD_PARTY_NOTICES.md)
contain the complete dependency and notice records. Each upstream project keeps its own
license and trademarks.

## License

[MIT](./LICENSE)
