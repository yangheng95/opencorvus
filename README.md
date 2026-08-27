<p align="center">
  <img src="assets/readme-head.png" alt="OpenCorvus" width="440" />
</p>

<h3 align="center">Work that finishes, and gets better.</h3>

<p align="center">
  <a href="https://github.com/yangheng95/opencorvus/releases"><img alt="Latest release" src="https://img.shields.io/github/v/release/yangheng95/opencorvus?include_prereleases&sort=semver&label=release&color=2946d3" /></a>
  <a href="./LICENSE"><img alt="License" src="https://img.shields.io/github/license/yangheng95/opencorvus?color=2946d3" /></a>
  <img alt="Project status: beta" src="https://img.shields.io/badge/status-beta-e04b22" />
</p>

<p align="center">
  <strong>English</strong> · <a href="./README.zh-CN.md">简体中文</a> ·
  <a href="https://opencorvus.com">Docs</a> ·
  <a href="https://opencorvus.com/market/">Expert Squads</a> ·
  <a href="https://github.com/yangheng95/opencorvus/releases/latest">Download</a>
</p>

---

OpenCorvus is the runtime layer under an agent — the loop, tool routing, context management,
memory, permissions, recovery, scheduling. It is built for work that runs long.

When a long task dies halfway, people blame the model. Usually it is not the model. A capable
model inside a runtime that loses task state still stops short.

Published project evidence reports a **34.00 % strict pass rate for an OpenCorvus Mission run
over 100 AutomationBench cases**. The displayed **8.07 %** Luna baseline comes from an external
reference, not a matched run whose dataset, evaluator, and case results are versioned in this
repository; treat the two numbers as context, not as a controlled 4.21× comparison.

## Run it

Download an installer from the [latest release](https://github.com/yangheng95/opencorvus/releases/latest),
or build from source:

```bash
git clone https://github.com/yangheng95/opencorvus.git
cd opencorvus && bun install
bun run --cwd packages/opencorvus build
bun packages/opencorvus/src/index.ts doctor   # tells you what's missing
```

Then start it inside the repository you want it to work in:

```bash
cd ~/your-repo
opencorvus serve
```

Workbench at `http://127.0.0.1:7878/ui/`. Or drive it over HTTP:

```bash
curl -X POST http://127.0.0.1:7878/task \
  -H "content-type: application/json" \
  -H "x-opencorvus-directory: $PWD" \
  -d '{"request": "Add unit tests for src/foo.ts covering the happy path and two error paths."}'

curl -N http://127.0.0.1:7878/task/<task_id>/events   # resume with ?after=<sequence>
```

> Exposing `serve` beyond localhost without `OPENCORVUS_SERVER_PASSWORD` starts anyway and
> prints `server is unsecured`. That line is the only thing between your repository and the
> network.

## What you get on first launch

- **119 Expert Squads** — versioned capability packages: roles, workflow, Skills, tools,
  selection guidance, version and digest frozen together. 4 ready immediately, 115 importable.
  A Task pins one exact revision and cannot silently switch it.
- **87 providers, 2,579 models** from one bundled catalog, local runtimes included.
- **43 built-in tools**, plus Model Context Protocol (MCP) servers and plugins.
- **Durable execution** — leases, an event log, and a reconciler. Owned work resumes after a
  restart, and a `completed` / `failed` / `cancelled` Task reopens on your next message.
- **Surfaces** — desktop app, HTTP API with Server-Sent Events, 13 chat channels, a GitHub
  Action, scheduled automation.

Everything above is also a configuration surface. One project file
(`<repo>/.opencorvus/opencorvus.jsonc`) swaps the model, narrows the tools, tightens permissions,
or replaces an entire squad — no fork required.

## A few things this project won't do

These are the rules the codebase is actually held to, not aspirations.

- **No fallbacks.** Fix the source, not the consumer. One capability, one implementation, one
  source of truth — no shadow state, no compatibility layer, no "just get it running".
- **No guessed total runtime limit for open-ended agent work.** Model and Task execution is not
  killed because an arbitrary wall clock expired; liveness is based on observable inactivity.
  Bounded sub-operations — network requests, startup, benchmark observation, and cleanup — still
  own explicit wall-clock deadlines.
- **Sub-agents are agents.** Each gets its own model, tools, and reasoning loop. They are not
  host function calls dressed up as delegation.
- **No keyword rules standing in for real work.** Nothing routes an agent or fakes a sandbox by
  matching strings. A blacklist you can rephrase your way around only ever fooled its author.
- **No self-modification behind your back.** A squad revision is drafted, validated as a runnable
  package, and staged. It installs after you confirm it, and the receipt is how you undo it.

One that reads like a joke until it happens to you: a worktree isolates the filesystem, **not the
process table**. So `bash` refuses `taskkill /IM`, `killall`, and `pkill` outright — an agent
cleaning up "its" processes should not be able to take your machine down with it.

## What it can't do

- Nothing executes while your runtime is offline. This is not a hosted service and it does not
  promise unbounded autonomy.
- Results depend on the model you pick, the sources it can reach, the capabilities you install,
  and the evidence available to the run.
- It coordinates compatible models, tools, and executors. It does not make arbitrary third-party
  code compatible or safe.
- It is beta and moving fast — 743 commits and twenty releases between `0.0.35beta` and
  `0.0.55beta`. Interfaces and packaged integrations change between them.

## Everything else

| | |
| --- | --- |
| [Quickstart](https://opencorvus.com/start/quickstart/) · [Configuration](https://opencorvus.com/config/) · [Tools](https://opencorvus.com/tools/) · [Permissions](https://opencorvus.com/permissions/) | Getting things done |
| [Long-horizon](https://opencorvus.com/concepts/long-horizon/) · [Architecture](https://opencorvus.com/concepts/architecture/) · [Mission](https://opencorvus.com/concepts/mission/) | How it works underneath |
| [Expert Squads](https://opencorvus.com/market/) · [Composition](https://opencorvus.com/concepts/squad-composition/) · [Evolution](https://opencorvus.com/expert-squads/evolution/) · [Publishing](https://opencorvus.com/publish/) | The capability layer |
| [SDK](./packages/sdk/js) · [OpenAPI](./packages/sdk/openapi.json) · [Plugins](./packages/plugin) · [GitHub Action](./github/README.md) | Building on top |
| [Contributing](./CONTRIBUTING.md) · [Changelog](./CHANGELOG.md) · [Security](./SECURITY.md) · [Support](./SUPPORT.md) | Taking part |

There is a 4-minute product story with narration and subtitles, if you would rather watch than
read: [English](https://github.com/yangheng95/opencorvus/raw/main/packages/web/public/media/opencorvus-mission-v5r-en-US.mp4)
· [简体中文](https://github.com/yangheng95/opencorvus/raw/main/packages/web/public/media/opencorvus-mission-v5r-zh-CN.mp4).
Audited evidence from one 12-hour Mission — model training through to a reviewed paper and a
pushed repository — is public at
[`deberta-v3-absa-public-evidence`](https://github.com/yangheng95/deberta-v3-absa-public-evidence).

Issues and squads are both welcome. If a squad you wrote does the job better than one we ship,
that is the contribution we want most.

## Built on

OpenCorvus evolved from [OpenCode](https://github.com/anomalyco/opencode) and still carries
explicitly synchronized OpenCode work in its model provider, GitHub Copilot, and provider-plugin
surfaces. Thanks to its maintainers for that foundation.

The harness runtime and the desktop app are both written in this repository, with no third-party
agent engine underneath — that is what makes every layer replaceable. It stands on a great deal
of open source: [Bun](https://github.com/oven-sh/bun),
the [Vercel AI SDK](https://github.com/vercel/ai), [Hono](https://github.com/honojs/hono),
[Drizzle](https://github.com/drizzle-team/drizzle-orm), [Tauri](https://github.com/tauri-apps/tauri),
[SolidJS](https://github.com/solidjs/solid), [Playwright](https://github.com/microsoft/playwright),
the [MCP](https://github.com/modelcontextprotocol/typescript-sdk) and
[ACP](https://github.com/agentclientprotocol/typescript-sdk) SDKs, and many more.
[`THIRD_PARTY_NOTICES.md`](./THIRD_PARTY_NOTICES.md) has the complete record; each upstream
project keeps its own license and trademarks.

## License

[MIT](./LICENSE)
