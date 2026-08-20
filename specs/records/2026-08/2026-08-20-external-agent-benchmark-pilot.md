# OpenCorvus External Agent Benchmark Pilot

## Recall

| Item | Recorded requirement or evidence |
| --- | --- |
| User request | Build an automated benchmark plan from AutomationBench and Tencent WorkBuddy Bench, include an experimental Skill, settings, trajectory visualization, and a result table with token/performance comparison; evaluate OpenCorvus Base and Advanced and compare with public leaderboards. |
| Scope correction | Keep all work on a new benchmark branch so the main delivery branch is not changed. The active branch is `codex/automation-workbuddy-benchmark`. External source trees and datasets stay outside the repository. |
| Pilot correction | Start with `gpt-5.6-luna`, first prove the chain, and copy only OpenCorvus results into this project's own comparison board. Do not submit to or impersonate an official leaderboard. |
| Round-one correction | Round one contains only AutomationBench `1.0.6` with `openai/gpt-5.6-luna`; WorkBuddy is deferred. OpenCorvus is the evaluated multi-Agent harness, so calls, Agents, retries, and concurrency are measured without a model-runner call cap. |
| Matrix correction | Freeze a deterministic 50-case public AutomationBench set and run paired Base and Advanced trials for every case. Schedule five rolling case slots per batch, never overlap Base and Advanced for the same case, and seal a batch before starting the next. A completed or invalid attempt releases its case slot immediately so the opposite profile can start while slower cases continue. This is 50 benchmark cases and 100 profile trials. |
| Bug/evidence correction | Any run that encounters a product, adapter, scorer, lifecycle, timeout, or evidence bug is retained as `invalid_bug`, excluded from experiment results, and rerun from a fresh world only after the root fix lands. Every attempt uses an independent timestamp-plus-UUID directory and SHA-256 evidence manifest so reruns never overwrite paper evidence. These rules are also frozen in `skills/automationbench-experiment/SKILL.md`. |
| Acceptance metrics | (1) exact `openai/gpt-5.6-luna` credential and model projection preflight succeeds from an isolated runtime containing both `auth.json` and `models.json`; (2) every frozen public case reaches deterministic official rubric scoring from fresh state in both Base and Advanced on a clean recorded commit; (3) every attempt records status and a sealed evidence manifest; (4) every accepted run records task/version/config identity, terminal state, raw transcript/trace/world events, readable trajectory, duration, token components, cost coverage, partial credit, and strict pass; (5) only clean-source natural-completion runs enter the self-owned leaderboard, and public held-out percentages remain context only. |
| Hard constraints | Use public Task APIs and normal OpenCorvus Expert Squad selection; all model interaction remains streaming; no fallback or parallel orchestration implementation; no call-count or Agent-count limit; benchmark inactivity timeout is reset only by real work activity; no UI automation tests; no secrets in logs, specs, result artifacts, or Git; product fixes are separately reviewed/committed and only that fix is merged into `v0.0.49beta`; benchmark code/evidence remain on the bench branch. |
| Sources read | `AGENTS.md`; `benchmark-debug-template/SKILL.md`; `visualize/SKILL.md`; root and package `package.json`; `specs/README.md`; `specs/records/2026-08/README.md`; `specs/current/architecture/02-data.md`; `04-extensions.md`; `06-provider.md`; `task-control-plane.md`; `task-runtime-directory.md`; public Benchmark documentation; Base and Advanced package READMEs/manifests; provider usage, AgentTrace, Task route, isolated runtime, and existing real benchmark code; official AutomationBench 1.0.6 repository/docs/leaderboard; official WorkBuddy repository/config/harness-authoring docs/leaderboard and paper. |
| Whole-repository search results | The product already owns the required Task API, isolated `OPENCORVUS_HOME`, trace JSONL, persistent SQLite, transcript token facts, exact `promptProfile` selection, project Skill discovery, and Provider connectivity route. Existing benchmark guidance forbids a parallel Task path. `provider_usage_event` has no Task identity, so each trial uses its own isolated database and preserves every non-connectivity row before cleanup; result totals are recomputed from that ledger and reconciled with transcript assistant facts. Existing WorkBuddy integration does not exist. |
| Local environment evidence | Python 3.14, Bun, Node.js, Git, and Docker CLI are installed. Docker Desktop's Linux daemon is not running. `uv` is not installed. User OpenCorvus data contains configured OpenAI OAuth and a canonical models catalog with exact `openai/gpt-5.6-luna`; credential contents were not printed. |
| Independent Agent feedback | The Provider-helper repair received four independent read-only review passes. The first-wave harness repair was separately reviewed read-only: Base's Developer-to-Tester graph, exact topology checker, Skill projection direction, and terminal quiescence eligibility were accepted with no P0. The remaining P1 is that detached delivery settlement is not represented by the one-shot ingress-hook snapshot; a late failure can still make a run cleanup-invalid, but cannot enter the leaderboard. A real single-case rerun is the integration proof before resuming five-case batches. |

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
- Data: each trial owns a fresh project, isolated runtime, AutomationBench world, timestamp-plus-UUID output directory, and task ID. Results use one versioned JSON schema and retain raw benchmark events, terminal board, Task request/binding receipt, transcript, trace, per-call Provider ledger, trajectory, cleanup state, and exact manifest separately from derived summaries.
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
- terminal board, Task create receipt, actual package/profile/workflow binding, isolation audit, and exact per-call Provider usage ledger;
- immutable configuration/source hashes and exact reproduction command.

Every unknown value stays `null` with a reason. It is not silently converted to zero.

### AutomationBench 1.0.6 pilot

Task definition:

- Use only the committed deterministic 50-case public manifest. Selection is quota-balanced across all six public domains, uses a fixed SHA-256 ranking seed without reading task content or assertions, and freezes example ID, task name, task-contract hash, case index, and batch index. `simple` may be used only for tool-bridge diagnostics and is never written as a score.
- Initialize the task through AutomationBench's release code, preserve its allowed-service computation, and call its original `api_search`, `api_fetch`, and `base64_encode` functions.
- Keep assertions, evaluator source, and mutable world outside the project and inaccessible to the Agent identity. The generated project wrapper can invoke only the three official tool routes through its UID-scoped Unix socket; it has no project credential. Hidden task/scorer admin routes use a separate random token delivered to the bridge through an anonymous stdin pipe, never a file, argument, environment variable, prompt, or transcript.
- Remove only AutomationBench's stock single-model `~50` tool-turn sentence when constructing the OpenCorvus Task request, and add the explicit uncapped-harness measurement contract. Preserve all business instructions unchanged and hash both the official task contract and mapped harness request.
- After OpenCorvus settles, call AutomationBench's original `partial_credit` and `task_completed_correctly` functions against the final world.

Settings:

| Setting | Pilot value |
| --- | --- |
| Release | Distribution `automation-bench==1.0.6` built from official revision `4a8e106…`; fail-closed distribution version, installed package-tree SHA-256, public dataset-index SHA-256, frozen case-set SHA-256, per-case official task-contract SHA-256, and source revision |
| Toolset | API mode |
| Model | `openai/gpt-5.6-luna` |
| Profiles | paired `base` and `advanced`; fresh world/project per profile; deterministic crossover order balances which profile runs first |
| Reasoning variant | Provider default for the chain proof; later experiments must record an exact variant |
| Skill | `automationbench-api` method-only project Skill; no task answer, assertion, or endpoint hint |
| Trial concurrency | At most 5 distinct cases per batch; Base/Advanced of one case never overlap; OpenCorvus internal Agent/tool concurrency is unrestricted |
| Repetitions | 1 paired Base/Advanced trial per each of 50 frozen public cases |
| Scored metric | strict `task_completed_correctly`; `partial_credit` diagnostic |
| Harness usage | record every call and model Turn without imposing the stock single-model runner's step limit on the multi-Agent harness |

Timeout:

- 120 seconds without new Task lifecycle/message/part/tool/trace/benchmark-world activity.
- No wall-clock deadline while work continues.
- Benchmark bridge health and Provider retries must surface activity separately from no-op polling.

Isolation boundary:

- Formal runs execute inside WSL2 Linux as an operational benchmark boundary, not a hostile multi-tenant security proof. Evaluator source/venv, dataset, scorer, Provider data, control, and evidence roots are root-owned and mode-0700.
- Agent Bash is a frozen root-owned wrapper that creates a private mount namespace and tmpfs HOME, unmounts Windows drives, removes inherited environment authority, drops to the case's unique UID/GID in `60001..60050`, and then launches Bash. Do not make stronger sandboxing an experiment prerequisite unless a concrete leak is observed.
- Each tool surface is a mode-0600 Unix socket inside a mode-0700 directory owned by that case UID; the admin surface is physically separate and keeps its stdin-only token. Before Task creation, the runner positively probes that the exact shell/wrapper hash can write its project/use its socket and cannot traverse source auth/models, isolated runtime data, evaluator files, bridge `/proc` authority, sibling authority, or Windows mounts. Transcript scanning and exact secret-leaf matching remain defense-in-depth evidence, not the primary boundary.

Acceptance:

- fresh official world per profile;
- exact Provider preflight reports `connected` for `openai/gpt-5.6-luna`;
- bridge identity matches release/package/task-contract locks before Task creation;
- benchmark task reaches an OpenCorvus terminal decision without operator intervention;
- official rubric executes and emits strict plus partial scores; an independent verifier checks the raw initial-to-final world hash chain, replays deterministic stateless tools, reloads the sealed final world, and reruns the official rubric to the same strict/partial/assertions/end-world hash and attempted/succeeded/failed call counts;
- terminal package binding equals requested Base/Advanced; transcript isolation audit shows no evaluator path/admin/scorer access;
- result, exact per-call usage ledger, trace, transcript, board, Task receipt, trajectory, cleanup state, and exact file-set manifest validate against the local checker;
- failures retain exact stage and evidence instead of becoming score `0` unless the official rubric itself returned zero.

### Deferred scope: WorkBuddy Bench

WorkBuddy investigation remains historical input from the original request, but no WorkBuddy adapter, dataset, Docker run, score, or leaderboard row belongs to round one. It requires a later explicit scope decision and its own plan before implementation.

## Experiment matrix and comparison rules

The round-one matrix is:

| Suite | Unit | Base | Advanced | Skill | Repetitions |
| --- | --- | ---: | ---: | --- | ---: |
| AutomationBench public | deterministic 50-case set | yes | yes | on | 1 paired trial per case |

The committed case-set manifest freezes selection order, domain, task name, public example identity, and official task-contract hash. Execution uses ten deterministic five-case batches. Each batch owns five rolling case chains: odd case indexes run Base then Advanced and even indexes run Advanced then Base. The five first-profile trials start together; whenever one attempt settles, that same case chain immediately starts its opposite profile without waiting for the other four cases. Thus at most five distinct cases are active, Base and Advanced for one case never overlap, order is balanced across all 50 cases, a failed slot does not idle unrelated capacity, and the batch is sealed only after all ten profile slots are valid. Invalid attempts remain evidence and are filled by a later fresh recovery batch.

The first recovery exposed why the previous global wave barrier was operationally wrong: HelpCrunch/Base timed out while LinkedIn/Base continued for another thirteen minutes, so the coordinator held four usable slots idle and then stopped before launching any opposite-profile work. The rolling scheduler is benchmark coordination only; it does not change Task prompts, Host lifecycle decisions, model/tool limits, or scoring. Positive acceptance requires the plan to declare `rolling_case_slots_v1`, the receipt to cover exactly ten paired slots, the evidence intervals to prove global concurrency never exceeds five and same-case profiles never overlap, and a failed receipt's valid runs to remain adoptable by the next recovery batch.

Comparison rules:

- AutomationBench private official leaderboard and local public-set results appear in separate columns. The official site currently lists no `gpt-5.6-luna` row; the closest named OpenAI references are `gpt-5.6-terra` and `gpt-5.6-sol`, but they are contextual only.
- Per-case strict results are shown as `1/1` or `0/1`; aggregate public-set success is `passes/50`. It is never represented as the official private held-out score.
- Base and Advanced remain distinct harness profiles. A difference in call count, concurrency, duration, or token use is reported, not normalized away.

## Trajectory view

The renderer consumes only normalized raw events and draws aligned lanes on one elapsed-time axis:

- Orchestrator and each projected Agent occupy separate lanes.
- LLM request/turn spans, Skill loads, benchmark search/fetch calls, waits, terminal decisions, and verifier/scorer events use distinct mark shapes and labels.
- Each profile plot labels full run duration separately from the first-to-last normalized event span, and annotates model calls, benchmark calls, event count, and token totals.
- Base and Advanced use separate readable time axes because their durations differ materially; the numeric comparison table carries exact cross-profile duration/call/token deltas. The committed renderer deterministically emits SVG and optional PNG.

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

| Profile | Strict | Partial | Successful tool calls | Model calls | Total tokens | Duration |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Base | 1/1 | 1.0000 | 134 | 130 | 8,210,786 | 1,060,812 ms |
| Advanced | 0/1 | 0.6667 | 53 | 36 | 1,892,387 | 470,411 ms |

Base completed all three positive assertions. Advanced updated the Opportunity and sent the executive email but never submitted a support-escalation email request; this is measured harness behavior, not an adapter/scorer bug. The user nevertheless requires a clean post-fix rerun for the experiment result, so neither row is promoted or relabeled.

## Clean-source reruns invalidated by evidence-secret bug

These two reruns used clean OpenCorvus commit `9a81613f633bec17d0f5964721c82db49a130b43`, identical benchmark bundle SHA-256 `9482c6961cd58e28b9fde59a6205675325d1dfa4cf986a84f1cb809a200c4be0`, AutomationBench source `4a8e1061254004d9dac807054eed33fad7d1ff14`, exact `openai/gpt-5.6-luna`, and fresh public task example `501`. Provider preflight, natural Task completion, official scoring, cleanup, and initial manifest checks succeeded, but the later secret audit found that Agents had read the project `.automationbench-tool.json`; the raw transcripts therefore contained the expired localhost-only tool bearer. Both runs are `invalid_bug` and cannot enter the experiment leaderboard.

| Profile | Strict | Partial | Successful / failed tool calls | Model calls | Total tokens | Output | Duration | Sessions / Agents |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Base | 0/1 | 0.3333 | 169 / 6 | 122 | 6,762,463 | 30,809 | 1,357,789 ms | 5 / 5 |
| Advanced | 0/1 | 0.6667 | 56 / 1 | 44 | 2,907,836 | 13,442 | 686,134 ms | 2 / 2 |

Within this invalid pair, Advanced improved partial credit by `33.33` percentage points while using `57.00%` fewer total tokens, `56.37%` fewer text-output tokens, `63.93%` fewer model calls, `66.86%` fewer benchmark API calls, and `49.47%` less elapsed time. These values remain debugging evidence only and are not the round-one comparison.

Official assertions show Base only changed the correct Opportunity to `Closed Won`; neither target email met the scorer. Advanced changed the Opportunity and sent the correct executive email but omitted the required support-escalation email. Other recorded error marks were agent-level contract mistakes (out-of-range `top_k`, malformed shell quoting, rejected tool inputs) that the harness observed and continued from; they were not the invalidating bug.

Root repair removes the project-side bearer entirely: each trial's intended tool capability is a UID-scoped Unix socket, while task/scorer admin routes live on a separate loopback HTTP surface with a host-only random token injected through anonymous stdin. It never enters child argv or environment. Formal execution moves evaluator, Provider data, Host, and evidence into the WSL2 root boundary; each case receives a unique numeric UID, private tmpfs HOME, mode-0700 project/socket roots, and a private mount namespace without Windows mounts. A positive pre-Task probe proves own-project/socket access and evaluator/auth/bridge-process denial; a separate five-trial diagnostic attacks sibling project, socket, process, home, symlink, and Windows-mount boundaries. The bridge diagnostic verifies physical tool/admin surface separation, exact distribution/package/task-contract identity, real stateless concurrency, atomic attempted/succeeded/failed counting, score-versus-tool terminal sealing, initial-to-final state hash chaining, deterministic stateless replay, and official rescoring of the sealed final world. The model-visible request removes exactly one frozen stock budget sentence and preserves all other business bytes. Each candidate run saves its terminal board, create/binding receipt, actual Expert Squad profile/workflow, shell and transcript isolation audits, initial/final worlds, replay receipt, per-call Provider ledger, and exact-set manifest; catalog and the final verifier independently recompute those claims. The two affected transcripts were mechanically redacted twice as needed for nested escaped metadata; redaction/seal/cleanup markers now cause permanent `invalid_bug` classification regardless of manual disposition. The original result and world evidence remain present but excluded; neither run is relabeled after repair.

## First formal five-case wave: invalid preflight

The first clean-commit batch-1 wave created five evidence directories but stopped before Provider/model execution. Every trial failed the positive Agent-shell probe because the isolated runtime's outer `ownerRoot` remained mode `0700`; the runner had opened only the inner `processRoot` to traversal, so the case UID could use its socket but could not reach its own project. These attempts are adapter-bug evidence, not scores. The fix makes both traversal-only ancestors mode `0711` while the credential/runtime data directories remain root-owned mode `0700`; the wave must be rerun with new worlds and run IDs.

Subsequent pre-score waves are also retained and excluded. The first showed that a clean clone must build `packages/sdk/js/dist` before runtime imports; the reproducible setup now installs `ripgrep`, builds the SDK, and restores only the generated tracked route-policy source so Git source evidence remains clean. The next clean waves reached `POST /task` and exposed Git's dubious-ownership protection: Host-side VCS inspection ran as root after the project was assigned to the case UID. Task creation uses both ambient `hostGit` and exact-environment `EngineGitProcess`, so the runner projects the same exact random project as `safe.directory` through process-local Git config for the former and that isolated runtime's root-only Engine Git HOME for the latter. The Agent's `env -i` shell cannot read or inherit either Host authority.

The first real five-case wave also corrected a score-selection bug. Base may naturally call `manage_task(fail_task)` when it cannot complete a business workflow. That is a harness outcome and must receive the official final-world score, normally strict zero; excluding every `failed` lifecycle would bias the benchmark toward successful Task lifecycles. The checker now accepts an explicit natural `fail_task` only when the sealed transcript contains no structured `infrastructure_failure`. Browser MCP startup failures, Host request timeouts, cancellations, and evidence faults remain invalid and are rerun; natural failed outcomes are scored and never rerun merely to improve the result.

## First five-case wave: shared harness bugs, all five runs invalidated

The first wave that reached official scoring produced five trajectories — LinkedIn (Base), Wave invoice (Advanced), Trial nurture (Base), HelpScout (Advanced), Campaign handoff (Base) — totalling roughly 440 model calls, 25M tokens, and 347 benchmark API calls for one strict pass. Every run is retained as `invalid_bug` evidence and none is a paper result. The defects below are shared harness bugs, not per-case behavior, so all five reruns wait for the repaired commit and fresh worlds.

### The Skill was never projected

`skill(query="automationbench-api")` returned zero matches in every run, and agents recovered by globbing `.opencorvus/skill/automationbench-api/SKILL.md` directly. The runner seeded the Skill into the project and wrote `skill.enabled = true` from its own arguments, but a projected Expert Squad agent resolves Skills from its manifest's `default_skill_refs`/`package_skill_refs` plus explicit `skill_mounts` operator overrides; Base declares no default Skill refs, so the pool contained the Skill and no agent could reach it. Some agents additionally errored outright because the `explore` runtime template projects no `skill` Tool at all and is not `skillMountable`.

The runner now mounts the Skill on every projected agent the Host reports as `skill_mountable` and `skill_tool_available` through the public `PATCH /skill/mount` operator route, re-reads `GET /skill/mounts`, and refuses to create the Task unless the Skill is `effective` and `enabled` for each of them. The matrix is sealed as `skill-projection.json`, the catalog and the independent verifier recompute `auditSkillProjection` from it, and a run whose projection audit fails is neither leaderboard- nor development-eligible. Because the previous wave's `skill.enabled` was a self-report rather than a measurement, its runs cannot be described as Skill-enabled at all.

### Base decided from stale evidence

The LinkedIn Base run failed the Task with "No post was created" while the official final-world scorer awarded partial credit `0.80` for a post that existed. The Researcher reported that it could not run the benchmark client, the Developer published a `blocked_before_mutation` Artifact, the Tester verified against that pre-mutation state, the Developer then completed the LinkedIn `POST`, and the Orchestrator settled from the older Artifacts. Cleanup then recorded `TaskRootIngressError` for workflow ingress arriving after the Task was already failed.

The cause is Base's `planner-parallel-delivery` graph plus a prompt that treated a worker report as a standing claim: all three workers depended only on the Planner, so the Tester never depended on the Developer. That partition is correct for disjoint code paths and wrong for "change a business system, then verify its final state" — verification is the one obligation that is meaningless against a moving target.

The graph now declares `base-tester` depending on `base-developer`. Research stays in the Planner's frontier with implementation, because reading does not race the mutation; only verification does. The workflow analyzes as `dependency_dag` rather than `flat_planner_parallel_workers`, and the built-in topology check pins that structure instead of asserting a flat frontier for every Planner-first package. The edge is ordering, not an Artifact handoff: the Tester still takes its acceptance scope from the request and the plan and does not consume `base/development-report`, so this does not reintroduce the scope drift described below.

Ordering alone is not sufficient, because settling is not the same as final — a same-Task repair moves the world after the Tester's first occurrence. The Orchestrator overlay therefore also states that a report is an observation of its publication moment, that a report predating the mutation owner's latest settled occurrence is stale for the mutated surface, and that continuing the same Tester lineage is the required path before any terminal decision, for external state as well as files. Stopping the Task likewise requires fresh verification of the current state rather than an older report.

One derived consequence: terminal workflow nodes are now `base-researcher` and `base-tester`, so the Host-sealed terminal Artifact set described below no longer includes `base/development-report`. That report remains available to the Orchestrator as cited evidence; it is simply no longer a terminal node of the graph.

### Verification scope drifted to what the Developer claimed

In the Trial nurture case the spreadsheet configuration required Salesforce follow-up tasks and more on-track nurture mail. The Developer sent three stuck-trial emails and skipped Salesforce; the Tester verified exactly the Developer's `acted_on` list and published `PASS`; the official scorer returned `0.333` with every Salesforce assertion failing. Verifying the subset a worker reports as done converts a partial delivery into a passing verdict. Both Tester overlays — `base-tester` and Advanced's `test-engineer` — now take acceptance scope from the original request and the authoritative sources that request names, treat a stated-but-omitted obligation as a recorded defect rather than inherited scope, and verify external state through the same tools the delivery used rather than through a report about it.

### Terminal submission burned calls on a fact the Host already owned

Trial nurture failed `manage_task` seven consecutive times and Campaign handoff twice, mostly for omitting terminal workflow Artifacts. `assertTerminalWorkflowArtifactCompleteness` computed the exact missing locator set and then raised an error naming only a count, so the model retried blind against a value it could not derive — and the retry it was being asked for could only restate what the Host had just computed. The check is now `deriveTerminalWorkflowArtifactLocators`: the Host derives the complete terminal-node worker Artifact set from the bound workflow and the artifact catalog and seals it into the completion decision as a Host-owned `terminal_workflow_artifact_locators` field. The model's `evidence_locators` and `deliverable_artifact_locators` keep their meanings, and omitting a terminal Artifact is no longer a rejection.

Splitting the terminal lifecycle input schemas into `orchestrator/task-lifecycle-input.ts` was required to cover this: `orchestrator/task-lifecycle-tools.ts` reaches `orchestrator/tools.ts` again through `engine/state -> protocol/delivery -> session/wake -> session/prompt -> session/loop`, so importing the lifecycle module first left `tools.ts` reading uninitialized schema bindings at module scope. The schemas now live in a leaf module both sides import.

### Capability and observability gaps

Base's Planner allocated `python3 automationbench_tool.py ...` to the Researcher, which has no shell; the Researcher published a blocked report and the Developer rediscovered the same API surface, producing the stale Artifact above plus wasted tokens. The Planner overlay now states the Researcher's read-only capability explicitly and requires every command, client, or generator execution to go to the Developer or Tester.

`provider_usage_event` carried no Task, Session, or Agent identity, so per-Agent token cost could only be guessed from transcript timestamps — which cannot separate concurrent workers, exactly the case Base creates. The table now records `session_id` and `agent_id`, supplied by the Session stream that already holds both, and the result adds a per-Agent token breakdown. Non-Session purposes such as Provider connectivity probes leave both null.

Finally, the runner deletes the whole isolated runtime, database included, at the end of each trial, so nothing relational survived for later analysis. Each trial now seals a redacted `runtime-database-snapshot.json` — `engine_task`, `engine_workflow_node_occurrence`, `engine_artifact`, `engine_artifact_catalog_revision`, `session`, `provider_usage_event` — before cleanup, inside the manifest. Message and part payloads stay out of it; the transcript is already sealed evidence.

Known agent-level contract mistakes in this wave — out-of-range `top_k`, shell quoting, malformed JSON in a terminal submission — remain measured harness behavior. The benchmark client stays a project-local command rather than a typed tool; making it a schema-checked tool would change what the harness is being measured on and is not part of this repair.

### Terminal evidence sealing without a Host business gate

The repair does not ask the Host to judge whether a Tester report is fresh enough or whether the Orchestrator is allowed to stop. Base owns those decisions through its declared Developer-to-Tester edge, prompts, and visible evidence. The benchmark runner owns only experimental completeness: after any completed or failed Task transition it waits until every recorded execution occurrence is terminal and detached ingress delivery is settled, then takes a fresh board/transcript/trace/Provider-ledger snapshot before scoring. A natural failed outcome is counted only when the transcript records a successfully completed `fail_task`; a rejected historical tool attempt cannot authorize a score. This prevents late worker activity from truncating tokens or trajectories without teaching the model a benchmark-specific workflow.

## Public references frozen for this pilot

- AutomationBench release and public/private distinction: <https://github.com/zapier/AutomationBench>
- AutomationBench official private leaderboard and metric: <https://zapier.com/benchmarks>
- AutomationBench paper: <https://arxiv.org/abs/2604.18934>
