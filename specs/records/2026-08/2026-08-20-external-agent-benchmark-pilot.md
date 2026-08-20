# OpenCorvus External Agent Benchmark Pilot

## Recall

| Item | Recorded requirement or evidence |
| --- | --- |
| User request | Build an automated benchmark plan from AutomationBench and Tencent WorkBuddy Bench, include an experimental Skill, settings, trajectory visualization, and a result table with token/performance comparison; evaluate OpenCorvus Base and Advanced and compare with public leaderboards. |
| Scope correction | Keep all work on a new benchmark branch so the main delivery branch is not changed. The active branch is `codex/automation-workbuddy-benchmark`. External source trees and datasets stay outside the repository. |
| Pilot correction | Start with `gpt-5.6-luna`, first prove the chain, and copy only OpenCorvus results into this project's own comparison board. Do not submit to or impersonate an official leaderboard. |
| Round-one correction | Round one contains only AutomationBench `1.0.6` with `openai/gpt-5.6-luna`; WorkBuddy is deferred. OpenCorvus is the evaluated multi-Agent harness, so calls, Agents, retries, and concurrency are measured without a model-runner call cap. |
| Bug/evidence correction | Any run that encounters a product, adapter, scorer, lifecycle, timeout, or evidence bug is retained as `invalid_bug`, excluded from experiment results, and rerun from a fresh world only after the root fix lands. Every attempt uses an independent timestamp-plus-UUID directory and SHA-256 evidence manifest so reruns never overwrite paper evidence. These rules are also frozen in `skills/automationbench-experiment/SKILL.md`. |
| Acceptance metrics | (1) exact `openai/gpt-5.6-luna` credential and model projection preflight succeeds from an isolated runtime containing both `auth.json` and `models.json`; (2) one public AutomationBench task reaches deterministic official rubric scoring from fresh state in both Base and Advanced on a clean recorded commit; (3) every attempt records status and a sealed evidence manifest; (4) every accepted run records task/version/config identity, terminal state, raw transcript/trace/world events, readable trajectory, duration, token components, cost coverage, partial credit, and strict pass; (5) only clean-source natural-completion runs enter the self-owned leaderboard, and public held-out percentages remain context only. |
| Hard constraints | Use public Task APIs and normal OpenCorvus Expert Squad selection; all model interaction remains streaming; no fallback or parallel orchestration implementation; no call-count or Agent-count limit; benchmark inactivity timeout is reset only by real work activity; no UI automation tests; no secrets in logs, specs, result artifacts, or Git; product fixes are separately reviewed/committed and only that fix is merged into `v0.0.49beta`; benchmark code/evidence remain on the bench branch. |
| Sources read | `AGENTS.md`; `benchmark-debug-template/SKILL.md`; `visualize/SKILL.md`; root and package `package.json`; `specs/README.md`; `specs/records/2026-08/README.md`; `specs/current/architecture/02-data.md`; `04-extensions.md`; `06-provider.md`; `task-control-plane.md`; `task-runtime-directory.md`; public Benchmark documentation; Base and Advanced package READMEs/manifests; provider usage, AgentTrace, Task route, isolated runtime, and existing real benchmark code; official AutomationBench 1.0.6 repository/docs/leaderboard; official WorkBuddy repository/config/harness-authoring docs/leaderboard and paper. |
| Whole-repository search results | The product already owns the required Task API, isolated `OPENCORVUS_HOME`, trace JSONL, persistent SQLite, transcript token facts, exact `promptProfile` selection, project Skill discovery, and Provider connectivity route. Existing benchmark guidance forbids a parallel Task path. `provider_usage_event` is the global request ledger but has no Task identity, so per-trial token attribution must be reduced from exact Task transcript assistant/step facts and reconciled with the isolated ledger, not inferred from wall-clock windows in a shared home. Existing WorkBuddy integration does not exist. |
| Local environment evidence | Python 3.14, Bun, Node.js, Git, and Docker CLI are installed. Docker Desktop's Linux daemon is not running. `uv` is not installed. User OpenCorvus data contains configured OpenAI OAuth and a canonical models catalog with exact `openai/gpt-5.6-luna`; credential contents were not printed. |
| Independent Agent feedback | The Provider-helper repair received four independent read-only review passes. Findings drove a dedicated internal physical-Provider hook owner, preserved third-party message-hook compatibility, corrected Agent ID projection, made Provider rules final, added multi-owner coverage, and ended with no unresolved finding. The full benchmark delivery still requires its own final independent review after clean reruns. |

## Problem analysis and impact

### Observable need

OpenCorvus has internal end-to-end checks but no reproducible adapter that evaluates Base and Advanced against the official AutomationBench end-state rubric, and no paper-evidence contract for score, tokens, cost, and multi-agent trajectory.

### Direct trigger

AutomationBench's stock CLI calls a model client directly with three API-mode tools. That entry point cannot invoke an OpenCorvus Task with a selected Expert Squad, so pointing it at the OpenAI model endpoint would benchmark the raw model rather than OpenCorvus.

### Data/control-flow root cause

The benchmark environments and OpenCorvus own different execution boundaries:

- AutomationBench keeps one mutable simulated business world inside its Python environment and grades only that final state.
- OpenCorvus owns Task creation, model projection, Skill discovery, multi-agent Sessions, traces, and terminal decisions through its public service.

The missing component is an adapter at AutomationBench's supported harness boundary, not a new product workflow. AutomationBench needs a benchmark-side tool bridge that preserves the official `api_search`/`api_fetch` implementation and hidden assertions while OpenCorvus runs through normal Task APIs.

### Why existing paths do not solve it

- Running `auto-bench --model gpt-5.6-luna` measures AutomationBench's stock single-agent client, not Base or Advanced.
- Running `opencorvus run` measures a Primary Assistant Session, not a Base/Advanced Task.
- Rewriting official tasks as local fixtures would lose the benchmark world/verifier and cannot be compared with the public releases.
- Global usage totals cannot safely attribute concurrent trials and would double-source token accounting if combined with Task messages.
- Starting a separate Vite/Playwright flow is irrelevant and prohibited for this non-UI pilot.

### Definitions, calls, public contracts, data, tests, docs, delivery, and risks

- Definitions/calls: add benchmark-only code under `packages/opencorvus/script/benchmark/external-agent/`; do not alter production Task, Provider, trace, Expert Squad, Skill, or scheduler contracts.
- Public contracts: call `POST /task`, `GET /task/:id/board`, `GET /task/:id/transcript`, `GET /task/:id/trace`, and `POST /global/providers/openai/test`. Product mutations remain public API calls; SQLite is read-only evidence only.
- Data: each trial owns a fresh project, isolated runtime, AutomationBench world, output directory, and task ID. Results use one versioned JSON schema and retain raw benchmark/Task evidence separately from derived summaries.
- Tests: add focused non-UI positive contract tests for argument/config validation, transcript usage reduction, inactivity activity signatures, result aggregation, and trajectory generation. Do not run existing UI tests found elsewhere.
- Docs: update both spec indexes and run the declared docs checker.
- Delivery: commit and push only the benchmark branch. External repos, virtual environments, Docker layers, datasets, and secret-bearing runtime homes are ignored and uncommitted.
- Risks: OpenAI OAuth may reject the requested model; Base/Advanced may not load a project Skill into projected workers; the stock AutomationBench package may change; Docker is currently unavailable; official leaderboards use different harnesses, repeated runs, or private tasks. Each condition must fail explicitly and remain labeled, never become a synthetic score.

No current product dead code or obsolete implementation has been established by this investigation. Historical retired benchmark files are not recreated as compatibility paths.

## Benchmark definitions

### Shared result contract

Input:

- benchmark release identity and exact task/subset;
- exact model `openai/gpt-5.6-luna`;
- `promptProfile` of `base` or `advanced`;
- experimental Skill revision and enabled state;
- isolated credential/model source and output root.

Output:

- raw suite score and normalized metric names;
- OpenCorvus terminal decision and selected workflow;
- input, text-output, reasoning, cache-read, cache-write, provider-total, and comparable-output tokens;
- priced/unpriced coverage and request-time cost where available;
- model-call, benchmark-tool-call, Session, Agent, and elapsed-time counts;
- canonical Task trace plus an aligned-lane trajectory data file and SVG;
- immutable configuration/source hashes and exact reproduction command.

Every unknown value stays `null` with a reason. It is not silently converted to zero.

### AutomationBench 1.0.6 pilot

Task definition:

- Use one public task from a scored domain for the first chain proof. `simple` may be used only for tool-bridge diagnostics and is never written as an official score.
- Initialize the task through AutomationBench's release code, preserve its allowed-service computation, and call its original `api_search`, `api_fetch`, and `base64_encode` functions.
- Keep the assertions and mutable world outside the project visible to OpenCorvus. The generated project wrapper can invoke only the three official tools; it cannot read state or request scoring.
- After OpenCorvus settles, call AutomationBench's original `partial_credit` and `task_completed_correctly` functions against the final world.

Settings:

| Setting | Pilot value |
| --- | --- |
| Release | PyPI `automation-bench==1.0.6`, reconciled to the official source release |
| Toolset | API mode |
| Model | `openai/gpt-5.6-luna` |
| Profiles | `base`, then `advanced`; fresh world and project for each |
| Reasoning variant | Provider default for the chain proof; later experiments must record an exact variant |
| Skill | `automationbench-api` method-only project Skill; no task answer, assertion, or endpoint hint |
| Concurrency | 1 |
| Repetitions | 1 for smoke; 3 for any result promoted beyond smoke |
| Scored metric | strict `task_completed_correctly`; `partial_credit` diagnostic |
| Harness usage | record every call and model Turn without imposing the stock single-model runner's step limit on the multi-Agent harness |

Timeout:

- 120 seconds without new Task lifecycle/message/part/tool/trace/benchmark-world activity.
- No wall-clock deadline while work continues.
- Benchmark bridge health and Provider retries must surface activity separately from no-op polling.

Acceptance:

- fresh official world per profile;
- exact Provider preflight reports `connected` for `openai/gpt-5.6-luna`;
- benchmark task reaches an OpenCorvus terminal decision without operator intervention;
- official rubric executes and emits strict plus partial scores;
- result, trace, usage, and trajectory artifacts validate against the local checker;
- failures retain exact stage and evidence instead of becoming score `0` unless the official rubric itself returned zero.

### Deferred scope: WorkBuddy Bench

WorkBuddy investigation remains historical input from the original request, but no WorkBuddy adapter, dataset, Docker run, score, or leaderboard row belongs to round one. It requires a later explicit scope decision and its own plan before implementation.

## Experiment matrix and comparison rules

The smoke matrix is:

| Suite | Unit | Base | Advanced | Skill | Repetitions |
| --- | --- | ---: | ---: | --- | ---: |
| AutomationBench public | one scored-domain task | yes | yes | on | 1 |

After the clean Base and Advanced runs pass the evidence checker, expand in this order only with additional authorization:

1. three repetitions of the same tasks to expose variance;
2. one task per AutomationBench scored domain;
3. stratified public subsets;
4. the full public suite only after cost and runtime approval.

Comparison rules:

- AutomationBench private official leaderboard and local public-set results appear in separate columns. The official site currently lists no `gpt-5.6-luna` row; the closest named OpenAI references are `gpt-5.6-terra` and `gpt-5.6-sol`, but they are contextual only.
- A one-task smoke result is shown as `1/1` or `0/1`, never as a model-wide percentage comparable to 600+ held-out tasks.
- Base and Advanced remain distinct harness profiles. A difference in call count, concurrency, duration, or token use is reported, not normalized away.

## Trajectory view

The renderer consumes only normalized raw events and draws aligned lanes on one elapsed-time axis:

- Orchestrator and each projected Agent occupy separate lanes.
- LLM request/turn spans, Skill loads, benchmark search/fetch calls, waits, terminal decisions, and verifier/scorer events use distinct mark shapes and labels.
- The plot annotates total duration, model/tool calls, idle gaps, token totals, and the critical path.
- A compact side-by-side profile view shares one time scale when both runs exist. Missing lanes remain absent rather than fabricated.

## Implementation sequence

1. Create the versioned result schema, argument parser, inactivity reducer, transcript usage reducer, and trajectory renderer with focused tests.
2. Add the isolated credential/model projector and exact Provider/model connectivity preflight.
3. Add the AutomationBench bridge/server, restricted project wrapper, and method-only experimental Skill.
4. Run one direct bridge diagnostic, then Base and Advanced through public Task APIs; iterate only on evidenced adapter/product failures.
5. Seal every attempt in an independent directory, classify bug-affected and dirty-source runs as evidence-only, and generate the self-owned leaderboard from validated clean-source result JSON only.
6. Render and visually inspect paper figures from sealed trajectory data.
7. Run focused tests, typecheck/docs checks, and relevant real benchmark paths.
8. Commission the required independent read-only review; fix every valid finding and repeat review if code changes.
9. Commit and push `codex/automation-workbuddy-benchmark` without merging benchmark work into a release branch.

## First Base live run: invalid pilot and root causes

The first live `sales.multi_hop_lookup` Base run proved the complete physical chain but is not a score for the project leaderboard.

Evidence:

- exact isolated Provider/model preflight returned `connected` for `openai/gpt-5.6-luna`;
- Task `tsk_g00VSoIBun00CIAC5dgf` selected Base, loaded the experimental Skill, and reached the official AutomationBench API bridge;
- the official world recorded 144 calls and deterministic diagnostic scoring returned partial credit `0.3333333333`, strict `0`;
- the operator cancelled the Task through its own public API after it exceeded the pilot comparability budget; lifecycle is `cancelled`, so the result is invalid and must not be copied into the score board;
- isolated Provider ledger: 114 model calls, 1,222,470 input, 26,571 text output, 8,177 reasoning, 5,858,816 cache-read, 7,116,034 total tokens; transcript reconciliation is separately retained;
- AutomationBench evidence shows the correct Opportunity was changed to `Closed Won`, but concurrent workers produced repeated and incorrectly addressed Gmail writes, so the two positive email assertions failed;
- shutdown additionally surfaced detached-dispatch and durable-Bus cleanup failures caused after cancellation; these are cancellation consequences in this run, not accepted benchmark outcomes.

Observed harness behavior and checker correction:

- Base's native mandatory researcher, developer, and tester frontier produced repeated searches, verification reads, and writes against the shared world. That is measured harness behavior whose correctness and efficiency belong in the trace and score; the checker must not rewrite the workflow to remove it.
- The operator initially interpreted the stock AutomationBench client's approximate 50 tool-turn budget as a harness-wide limit and cancelled the run. The user corrected this: OpenCorvus Base/Advanced are the evaluated multi-Agent harness, not the raw model runner. Their aggregate calls, parallel behavior, repeated work, and total token cost are measurements, not grounds for truncation.
- Therefore the cancellation was a checker-policy error, not an observed Base terminal failure. The bridge must not cap calls or force one artificial execution owner. A valid rerun lets the selected Expert Squad use its native workflow to natural terminal convergence, while recording all calls, duplicate mutations, tokens, and duration.

Shared Provider-helper root cause:

- The live log repeatedly recorded Project Memory Organizer requests failing with OpenAI Codex OAuth HTTP 400: `Unsupported parameter: max_output_tokens`.
- `CodexAuthPlugin` already owned the correct physical provider rule, but it was exposed only through the message-level `chat.params` hook.
- `session/llm.ts` invokes `chat.params` and `chat.headers` only when `StreamInput.user` exists. Project Memory Organizer truthfully uses a durable `requestID` when no source user is available, so the provider hooks are skipped and the default model output limit is sent.
- The same conditional affects every internal/helper Session call without a user and every provider compatibility hook, including GitHub Copilot and Cloudflare OpenAI reasoning models. This is a shared mechanism issue, not a Memory-only special case.
- The reviewed root fix keeps public project `chat.params`/`chat.headers` message-required and moves Codex, Copilot, and Cloudflare physical requirements to Host-internal `provider.chat.params`/`provider.chat.headers`. Each hook entry has immutable `internal | project` ownership; the dedicated physical trigger executes internal owners only and runs after message rewrites, so project plugins cannot restore rejected parameters or override required headers. Helper calls use the same physical layer with their real `requestID` and no synthetic User Message.
- Four focused positive tests cover the Codex physical rule, helper request assembly, user message compatibility/final convergence, and rejection of a project-owned physical override. Four independent read-only review passes ended with no finding. The isolated fix is release commit `8ad43f76` on `v0.0.49beta`; no benchmark file was merged with it.

## Development reruns retained as evidence only

Two natural-completion reruns established that the adapter and official scorer work, but they were executed before the benchmark source-state recorder and immutable timestamp-plus-UUID directory contract were committed. They remain `development_scored` evidence and are excluded from the paper round-one leaderboard:

| Profile | Strict | Partial | Tool calls | Model calls | Total tokens | Duration |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Base | 1/1 | 1.0000 | 134 | 130 | 8,210,786 | 1,060,812 ms |
| Advanced | 0/1 | 0.6667 | 53 | 36 | 1,892,387 | 470,411 ms |

Base completed all three positive assertions. Advanced updated the Opportunity and sent the executive email but never submitted a support-escalation email request; this is measured harness behavior, not an adapter/scorer bug. The user nevertheless requires a clean post-fix rerun for the experiment result, so neither row is promoted or relabeled.

## Public references frozen for this pilot

- AutomationBench release and public/private distinction: <https://github.com/zapier/AutomationBench>
- AutomationBench official private leaderboard and metric: <https://zapier.com/benchmarks>
- AutomationBench paper: <https://arxiv.org/abs/2604.18934>
