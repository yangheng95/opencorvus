---
title: "Deployment, customization and agent integrations"
description: "Installation and development notes, with Hermes Agent, OpenClaw and chat integrations."
locale: "root"
key: "deployment-and-integrations"
category: "practice"
order: 7
---

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

Replace `<version>` with the version shown on the release, for example `0.0.61-beta`.
Download only the file you intend to install.

### Install from source

Prepare the [development prerequisites](https://github.com/yangheng95/opencorvus/blob/main/CONTRIBUTING.md#developing-opencorvus)
before running these commands, including the native Rust/C++ toolchain on Windows.

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

Before starting, configure a reachable provider and an exact `provider/model` in the
project's `.opencorvus/opencorvus.jsonc`. See [Quickstart](https://opencorvus.com/start/quickstart/)
for model setup, a bounded first result, and PowerShell commands.

```bash
OPENCORVUS_SOURCE=/path/to/opencorvus/packages/opencorvus/src/index.ts
cd /path/to/your/repo
bun "$OPENCORVUS_SOURCE" serve
```

Open the local Overlay at `http://127.0.0.1:7878/ui/`, or create a Task through the
HTTP API using the configured model and active Expert Squad:

```bash
curl -X POST http://127.0.0.1:7878/task \
  -H "content-type: application/json" \
  -H "x-opencorvus-directory: $PWD" \
  -d '{
    "productPillar": "code",
    "request": "Inspect this repository and create docs/architecture-overview.md. Explain the entry points, main modules, and available build or test commands with exact source paths. Verify those paths and distinguish facts from uncertainty. Do not modify application source."
  }'
```

The server returns `202` with `task_id`, `project_id`, and `directory`. Acceptance is
not completion. Set `TASK_ID` to the returned value and stream progress with Server-Sent Events:

```bash
TASK_ID='paste-the-returned-task-id'
curl -N "http://127.0.0.1:7878/task/$TASK_ID/events"
```

Open `docs/architecture-overview.md` in your project and check the cited paths,
module descriptions, and build or test commands against the repository. A terminal
Task status alone does not establish that this overview is accurate; use the
[Quickstart follow-up](https://opencorvus.com/start/quickstart/) to request corrections
in the same Task.

> [!TIP]
> If you expose `opencorvus serve` beyond localhost, set `OPENCORVUS_SERVER_PASSWORD`
> first.

## Make it yours

The shipped defaults are a starting point, not a boundary. Configuration lives in one
project file; everything below is opt-in.

| You want to…                       | Configure                                               |
| ---------------------------------- | ------------------------------------------------------- |
| Use a different model or provider  | `model`, `small_model`, `provider`                      |
| Add or restrict capabilities       | `tools`, `mcp`, `plugin`                                |
| Change who may do what             | `permission` rules (allow / ask / deny) and shell scope |
| Redefine an agent's behavior       | `agent` with `prompt` or `prompt_append`                |
| Swap or override an Expert Squad   | `expert_squads`                                         |
| Add project context or house rules | `instructions`                                          |
| Add repeatable operations          | `command`, `formatter`, `keybinds`                      |

Beyond configuration, three extension paths keep the harness itself open:

- **JavaScript SDK** — [`packages/sdk/js`](https://github.com/yangheng95/opencorvus/blob/main/packages/sdk/js) with a published
  [OpenAPI description](https://github.com/yangheng95/opencorvus/blob/main/packages/sdk/openapi.json) for driving Tasks from your own code.
- **Plugin API** — [`packages/plugin`](https://github.com/yangheng95/opencorvus/blob/main/packages/plugin) for custom tools, artifact
  producers, and evidence sources.
- **Open protocols** — Model Context Protocol servers for capabilities, and the Agent
  Client Protocol for embedding OpenCorvus in another client.

Package specialist knowledge as an inspectable Expert Squad — roles, workflow, Skills,
tools, selection guidance, version, and digest travel together — and contribute it
through the repository. See the [Expert Squad author path](https://opencorvus.com/publish/).

## Control OpenCorvus from Hermes Agent or OpenClaw

The repository includes a portable [`opencorvus` Agent Skill](https://github.com/yangheng95/opencorvus/blob/main/skills/opencorvus/SKILL.md).
It teaches an Agent Skills-compatible assistant how to inspect, configure, run, and
troubleshoot OpenCorvus; create and monitor Tasks; send follow-up input; and review
delivery evidence. Installing the skill does **not** install the OpenCorvus runtime, so
complete one of the installation paths above first and copy the complete skill
directory, including its [`references/`](https://github.com/yangheng95/opencorvus/blob/main/skills/opencorvus/references/) files.

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
password-protected service, create or monitor a Task, continue work with a follow-up
message, cancel with explicit authority, and inspect the board, events,
Artifacts, and blockers before declaring completion. For host-specific installation
details, PowerShell commands, safe credential handling, and complete operating
examples, see the [`skill-installation`](https://github.com/yangheng95/opencorvus/blob/main/skills/opencorvus/references/skill-installation.md)
and [`operations`](https://github.com/yangheng95/opencorvus/blob/main/skills/opencorvus/references/operations.md) references.

## Platform surfaces

| Surface                | Status        | What it provides                                                                                                                |
| ---------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Desktop Overlay        | Available     | Conversations, Missions, Tasks, Expert Squads, evidence, and delivery review                                                    |
| Headless HTTP API      | Available     | Task lifecycle routes and SSE progress streams                                                                                  |
| Slack gateway          | Available     | Start and operate orchestrated work from a Slack thread                                                                         |
| Multi-channel adapters | In repository | Slack, Telegram, Discord, Feishu, WhatsApp, Google Chat, Microsoft Teams, Line, Matrix, Mattermost, Signal, WeCom, and DingTalk |
| GitHub Action          | Available     | Repository automation described in [`github/README.md`](https://github.com/yangheng95/opencorvus/blob/main/github/README.md)                                                     |

Useful Task endpoints:

- `GET /tasks` with a project directory
- `GET /task/<task_id>` without a project directory
- `GET /task/<task_id>/board` without a project directory
- `POST /task/<task_id>/message` with the Task project directory
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
