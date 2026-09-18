<p align="center">
  <img src="assets/readme-head.png" alt="OpenCorvus" width="280" />
</p>

<h1 align="center">Big tasks. Fewer handoffs on your plate.</h1>

<p align="center">
  Open-source orchestration for <strong>long-running, complex, demanding AI work.</strong><br/>
  Set the goal. Connect the specialists. Inspect the delivery.
</p>

<p align="center">
  <a href="https://github.com/yangheng95/opencorvus/releases/latest">Download</a> ·
  <a href="https://opencorvus.com">Website</a> ·
  <a href="https://opencorvus.com/start/quickstart/">Quickstart</a> ·
  <a href="https://opencorvus.com/market/">Expert Squads</a> ·
  <a href="./README.zh-CN.md">简体中文</a>
</p>

---

A big task leaves you doing the work around the work: asking an agent to continue,
briefing the next specialist, connecting unfinished pieces and checking what “done” means.

**OpenCorvus coordinates that process.** It organizes specialist work around your goal,
connects outputs across stages, and supports independent review and correction before
you inspect the delivery. You can follow the work, provide a missing decision, or ask
for another change in the same task.

[![OpenCorvus collaboration map: understand, design, implement, independently review and deliver, with a return path for corrections](packages/web/public/media/task-coordination-en.svg)](https://opencorvus.com/#case)

_Collaboration diagram, not a live product screen or measured concurrency chart.
The workflow depends on the task and selected squad._

## When the work gets complicated

| What lands on your plate                                                    | What OpenCorvus helps coordinate                                                                                  |
| --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| A long run needs another nudge, and context is spread across conversations. | Goals, stages and artifacts stay with the task, with visible progress and follow-up in context.                   |
| Several specialists produce pieces that do not fit.                         | Responsibilities, dependencies and artifact handoffs connect the work. Different squads can own different stages. |
| The agent reports success, but you cannot tell what was checked.            | Squads with independent review produce findings and verification evidence; problems return for correction.        |
| A new decision changes the work halfway through.                            | Add the decision to the same task and continue from its recorded context.                                         |

An **Expert Squad** is a reusable package of specialist roles, tools and workflows.
A **Mission** coordinates work across tasks and squads. Choose a squad whose workflow
includes the review your deliverable needs; not every squad includes every review role.

## A real task: build a tank-battle browser game

One request became **19 acceptance requirements**, source records for **35 stages**,
and **two correction rounds** within a single delivery squad.

1. **Research and define:** establish the reference version, rules, scope and acceptance criteria.
2. **Design:** agree on architecture, data contracts and pixel-interface states.
3. **Implement:** integrate terrain, enemies, power-ups, scoring, two-player play and construction mode.
4. **Review and revise:** independent testing, interface review and integrity review feed findings back to implementation.
5. **Deliver:** collect the artifacts, evidence and remaining limits.

The two loops matter: one repaired scoring across stages and results presentation;
the other replaced maps and enemy rosters after an operator decision about source data.

[Read the case](https://opencorvus.com/cases/tank-battle/) ·
[Inspect selected source excerpts](./specs/artifacts/2026-09-19-task-coordination/source-excerpts.json)

This case includes human intervention. It does not establish exact original-game fidelity,
cost savings or a general success rate. A retained test report differs from the closing narrative,
and some live-play evidence remains incomplete. The case records those limits.

## Bring a task with a result you can check

- **Software delivery:** research requirements, implement, inspect real interactions and repair findings.
- **Evidence-based research:** collect sources, analyze disagreements and independently check citations.
- **Cross-specialty projects:** connect research, analysis and delivery through [squad composition](https://opencorvus.com/concepts/squad-composition/).

These are workflow examples, not guarantees of completion.

## Start with your own project

1. [Download the desktop app](https://github.com/yangheng95/opencorvus/releases/latest) for Windows, macOS or Linux.
2. Open a project, configure a reachable model provider and select a model.
3. Choose a suitable squad and describe the goal, scope and acceptance criteria.
4. Inspect the resulting files and evidence; give feedback in the same task.

A request you could use:

> Inspect this project's import flow, reproduce the issue I provide, fix the root cause
> and verify the real interaction path. Deliver the changes, verification evidence
> and remaining limits. Do not deploy.

[Step-by-step setup](https://opencorvus.com/start/quickstart/) ·
[Installation options](https://opencorvus.com/start/install/) ·
[Browse squads](https://opencorvus.com/market/)

## Keep control of the work

OpenCorvus is open source and can run on your machine or a hosted runtime.
You choose models, tools, permissions and squad workflows.
[Feedback can become a squad revision](https://opencorvus.com/expert-squads/evolution/) when you approve it.

Work executes only while the runtime is online and the provider is available.
Time, cost and quality depend on the task, model, tools and accessible evidence.
Review important outputs; required permissions and operator decisions remain part of the process.

## Develop and integrate

Prepare the [development prerequisites](./CONTRIBUTING.md#developing-opencorvus),
including the native Rust/C++ toolchain on Windows, before building from source.

```bash
git clone https://github.com/yangheng95/opencorvus.git
cd opencorvus
bun install
bun run --cwd packages/opencorvus build
bun packages/opencorvus/src/index.ts doctor
```

See the [quickstart](https://opencorvus.com/start/quickstart/) for source startup and model setup.
For integration, use the [HTTP API](https://opencorvus.com/reference/api/),
[agent-host guide](https://opencorvus.com/integrations/agent-hosts/) or
[GitHub Action](./github/README.md).

- [Contributing](./CONTRIBUTING.md) · [Changelog](./CHANGELOG.md) · [Support](./SUPPORT.md)
- [Security](./SECURITY.md) · [Code of Conduct](./CODE_OF_CONDUCT.md)
- [Runtime architecture](./specs/current/architecture/README.md) · [Long-horizon execution](https://opencorvus.com/concepts/long-horizon/)
- [Research paper — proof of concept, work in progress](https://opencorvus.com/papers/opencorvus-poc.pdf)

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
