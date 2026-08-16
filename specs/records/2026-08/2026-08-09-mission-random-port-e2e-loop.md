# Mission random-port end-to-end debug loop

## Recall

| Item | Record |
| --- | --- |
| User request | Run end-to-end Mission testing and debugging against a dev backend on a random port. Each run must use a different end-to-end case, keep cases small but cover varied surfaces such as publish, resume, introduction, tools, and Skills. Do not interfere with an in-progress case unless it is stuck. Before every change, use an independent Agent to investigate depth and impact. Fix root causes without moving breakage elsewhere. |
| Acceptance criteria | A valid run starts the real dev backend on an explicitly selected non-default loopback port, submits Mission traffic through real HTTP routes, records request/response/events/projections/logs/artifacts, and reaches a terminal accepted result by structure rather than model self-report. A defect loop requires independent read-only causal analysis before edits, a focused positive regression, rerun of the failed path, and independent delivery review. |
| Hard constraints | Do not wake or mutate the two paused Batch 01 backend-algorithm Tasks until the existing prose-only operator-wake defect is causally verified and repaired. Do not run UI automation tests. Do not touch unrelated dirty worktree files or the untracked `deberta-absa-lab/` directory. Do not add fallback, compatibility paths, prompt-only gates, synthetic messages, hidden messages, or host-side workflow state machines. |
| Sources read | `AGENTS.md`; `benchmark-debug-template`; root and package `package.json`; `specs/README.md`; `specs/records/2026-08/README.md`; `specs/records/2026-08/2026-08-09-backend-algorithm-test-loop.md`; backend algorithm loop harness scripts; `packages/opencorvus/src/cli/network.ts`; `src/cli/cmd/serve.ts`; `src/server/server.ts`; `src/server/routes/app.ts`; `src/server/routes/mission.ts`; `src/server/routes/orchestrator.ts`; `src/server/routes/session.ts`; `src/tool/mission-state.ts`; `src/tool/skill.ts`; `src/tool/publish-interactive-artifact.ts`; `src/mission-skill/catalog.ts`; `src/mission-skill/builtin/general/SKILL.md`; `src/orchestrator/agent.ts`; `src/orchestrator/loop.ts`; `src/orchestrator/interaction-tools.ts`; `src/orchestrator/tools.ts`; `src/engine/queue.ts`; `src/engine/queued-task-ingress.ts`; related focused tests found by `rg`. |
| Whole-repository search evidence | `/mission/wake`, `/mission/:missionID/status`, `/mission/:missionID/activity-cursor`, `/mission/:missionID/project-archive`, `/session/:sessionID/messages`, `/session/:sessionID/turn-artifacts`, and `/task` are the real evidence routes. Mission state writes are confined to `mission_state` files. Mission Skill loading uses `mission_skill`; the only built-in Mission Skill is `general`, loaded from an exact visible `@mission("general")` directive. Orchestrator scheduling/lifecycle evidence is visible through tool parts such as `read_task_message`, `dispatch_agent`, `manage_task`, `wait`, and `publish_interactive_artifact`. |
| Existing evidence gaps | `specs/README.md` and `specs/records/2026-08/README.md` reference `2026-08-09-backend-algorithm-e2e-loop.md`, but that file is absent in the current checkout. Several indexed Mission design records are also absent. These are treated as index drift and not reconstructed. |
| Baseline Git and service state | Initial `git status --short` was clean in the first shell check. A later check showed pre-existing user/parallel changes to `specs/README.md`, `specs/records/2026-08/README.md`, and untracked `deberta-absa-lab/`. This task will preserve those changes and only add task-scoped edits. |
| Independent agent feedback | A read-only independent Agent confirmed that the paused Batch 01 defect is not missing tool projection. The active operator wake records a root message and exposes `read_task_message`, `dispatch_agent`, `manage_task`, and `wait`, but `engine.queue.launchTaskLoop` marks the persisted `queued_operator_wake` as `drained` whenever the Orchestrator returns normally. The root cause is a missing positive settlement contract for current ingress processing: prose-only final messages can consume a wake without reading the current message or making a real scheduling/lifecycle decision. |

## Defect F07: active operator wake settlement

### Observable phenomenon

Both paused Batch 01 Tasks received `POST /task/:taskID/message` after F06. The route returned HTTP 200 with a recorded operator message and a started wake. The Orchestrator Turn then finished normally with prose-only historical recovery text. Evidence shows no `read_task_message`, no `dispatch_agent`, no `manage_task`, no `wait`, and no lifecycle or scheduling tool part for the current ingress, but the corresponding `queued_operator_wake` was updated to `drained`.

### Direct trigger

`dispatchTaskLoop` enqueues a durable `queued_operator_wake` and `launchTaskLoop` runs the active Task root wake. After `runTaskLoop` returns, `launchTaskLoop` unconditionally calls `markQueuedOperatorWakeDrained(wake.id)` unless there is an exception or cancellation.

### Root cause

The active wake settlement boundary equates “Orchestrator process returned without exception” with “current ingress was semantically processed.” The prompt already tells the Orchestrator to read the exact current root message and make a scheduling or lifecycle decision, and the projected tools exist, but no host-side durable settlement check verifies that real tool evidence exists before draining the ingress.

### Why prior work did not fix it

F06 repaired dispatch-lineage authority for created-only Sessions versus committed workflow occurrences. It did not change wake drain semantics. Terminal conversation ingress has a separate delivery-result contract, but active Task ingress still uses the generic root wake path.

### Repair plan

Implement one positive settlement contract at the active wake boundary:

1. `Orchestrator.processTask` returns the final assistant message id for a normal non-terminal wake.
2. Before marking a `queued_operator_wake` as `drained`, `engine.queue` validates the returned assistant message's tool parts against the queued ingress.
3. Operator and Mission root-message ingress must include a completed `read_task_message` call for the exact message id.
4. Current ingress that requires scheduler action must include at least one completed tool part with `orchestratorDecisionEffect` equal to `decision` or `continuation`, or a completed tool whose semantics are an explicit lifecycle/scheduling settlement.
5. If the evidence is missing, record the delivery attempt as `delivery_failed` and a typed infrastructure artifact. Do not leave a silently drained wake and do not synthesize another wake.

This is a drain integrity check, not a workflow state machine: the model still chooses the concrete action, and the host only verifies that the already-required current ingress was actually handled.

### Focused verification

Add positive non-UI tests:

- Active operator wake with a prose-only Orchestrator final message produces a delivery failure and does not mark the wake `drained`.
- Active operator wake with completed `read_task_message` for the exact root message and a decision-effect tool marks the wake `drained`.
- Existing root-message authorization and F06 dispatch occurrence authority tests still pass.

## Defect F08: gray-matter YAML engine blocks Skill catalog verification

### Observable phenomenon

The first focused test run did not reach the new queue assertions. Project initialization failed while loading built-in Skills:

`Function yaml.safeLoad is removed in js-yaml 4. Use yaml.load instead`

The same failure later appeared as `SkillInvalidError` with missing `name` and `description`, because the frontmatter data was not parsed.

### Direct trigger

`PromptProfileResolver.resolveSchedulerCapability` loads default Skills. That calls `Skill.all()`, which parses bundled `SKILL.md` frontmatter through direct `gray-matter` calls. `gray-matter@4.0.3` still defaults to `js-yaml.safeLoad`, but the repository pins `js-yaml@4.3.1`.

### Root cause

Frontmatter parsing was split across `ConfigMarkdown.parse` and several direct `gray-matter` call sites in Skill, Mission Skill, Expert Squad, and Skill Manager. The root package `overrides` intentionally pins `js-yaml` to `4.3.1`, while `gray-matter@4.0.3` still defaults to the removed `safeLoad` API. The parser boundary lacked a single local YAML engine contract compatible with the pinned dependency.

### Why prior work did not fix it

The existing test preload isolates runtime paths and installs test runtime loaders; it does not patch third-party APIs. `ConfigMarkdown.parse` wrapped parsing errors but still used the default `gray-matter` YAML engine. Other call sites bypassed `ConfigMarkdown` entirely.

### Repair plan

Keep the repository's `js-yaml@4.3.1` pin and make `ConfigMarkdown` the single frontmatter parser entry:

1. Configure `gray-matter` with a `js-yaml@4` engine using `yaml.load` and `yaml.dump`.
2. Add `ConfigMarkdown.parseText` for in-memory built-in/package Skill content.
3. Add `ConfigMarkdown.stringify` for built-in Skill materialization.
4. Replace direct `gray-matter` parsing in Skill, Mission Skill, Expert Squad, and Skill Manager.
5. Declare `js-yaml` as a direct `packages/opencorvus` dependency.

### Focused verification

Positive verification:

- Shared frontmatter parsing returns descriptor data and stringify preserves it.
- Built-in Skill catalog loads at least one built-in Skill through `Skill.all()`.
- The only remaining direct `gray-matter` call among the affected files is inside `ConfigMarkdown`.

## Mission E2E case ledger

### Case M01: general Mission introduction, Skill, state, resume, publish

Input:

- Start the dev backend on an explicit random loopback port.
- Create a new isolated Git fixture directory with a tiny Node.js project.
- Submit `POST /mission/wake` with an exact visible `@mission("general")` directive and a request that asks Mission to introduce its plan, load the `general` Mission Skill, write Mission state, dispatch one small implementation Task, and keep evidence concise.
- After initial activity, submit a second `/mission/wake` with the same `missionID` asking it to resume from Mission state and publish a compact completion summary Artifact.

Required structural evidence:

- First wake response has `created: true`; second wake response has `created: false` with the same `missionID` and `sessionID`.
- `/session/:sessionID/messages` contains a completed `mission_skill` tool call with `metadata.name === "general"`.
- Mission state files `frontier.md`, `tasks.md`, `handoff.md`, and `notes.md` are non-empty through `mission_state` tool evidence or the Mission project archive.
- `/mission/:missionID/status` or `/tasks` exposes at least one child Task with `source="mission"` and `metadata.mission.id === missionID`.
- At least one Mission or child Task turn artifact exists after resume, or the case records a concrete product defect with raw evidence.

This case is intentionally different from Batch 01's two backend algorithm repair Tasks: it exercises Mission creation and resume, Mission Skill loading, Mission state, child Task dispatch, and publish/artifact surfaces rather than isolated algorithm repair only.

## Current status

F07 and F08 repairs have focused tests passing after independent review feedback:

- Huygens found that the first F07 settlement check was too narrow for `operator_intent`; the queue settlement now requires decision evidence for every active queued ingress except pure `orchestrator_event`, and requires `operator_intent` to read every superseded operator message id.
- `bun test test/frontmatter-yaml-engine.test.ts test/active-operator-wake-settlement.test.ts test/orchestrator-mission-root-message-read.test.ts test/scheduler-task-wait-project-runtime.test.ts --timeout=30000` passed: 8 tests, 19 assertions.
- `bun run typecheck` from `packages/opencorvus` passed.

The next step is second independent delivery review, then the random-port M01 live backend run.

## Updated objective: isolated database and `deepseek-v4-flash`

The user updated the goal to require isolated database execution and model selection `deepseek-v4-flash`.

Live backend evidence:

- `specs/artifacts/2026-08-09-mission-random-port-e2e/m01-mslgx8c4.json` started a real random-port backend at `http://127.0.0.1:54528/` with `OPENCORVUS_HOME` isolated under `C:\Users\hengu\AppData\Local\Temp\opencorvus-mission-e2e-m01-mslgx8c4\runtime-root`. Health reported the database at `...\runtime-root\data\opencorvus.db`, proving the run did not use the user's normal database. Preflight for `llmgateway/deepseek-v4-flash` failed before `/mission/wake`: provider `llmgateway` is not configured and requires API key or auth.

Current blocker:

- The requested model reference is `llmgateway/deepseek-v4-flash`; `deepseek/deepseek-v4-flash` is not valid in the bundled model catalog. The current shell environment has no `LLMGATEWAY_API_KEY`, and the isolated database intentionally has no saved provider auth. No Mission prompt was sent after preflight failed, so no in-progress case was interrupted.

## Blocked audit: `deepseek-v4-flash` provider configuration

The resumed goal requires isolated database execution and model selection `deepseek-v4-flash`.

Current verified evidence:

- `packages/opencorvus/script/benchmark/mission-random-port-e2e.ts` selects `llmgateway/deepseek-v4-flash` for live runs and starts `Server.listen({ hostname: "127.0.0.1", port: 0, randomPort: true })` under isolated `OPENCORVUS_HOME`.
- `packages/opencorvus/src/provider/models-bootstrap.json` defines provider `llmgateway` with env `LLMGATEWAY_API_KEY`, and defines model `deepseek-v4-flash` under that provider.
- The same catalog defines provider `deepseek` with env `DEEPSEEK_API_KEY`, but its available models are `deepseek-chat` and `deepseek-reasoner`; `deepseek/deepseek-v4-flash` is not a valid model ref.
- The current process environment exposes `DEEPSEEK_API_KEY` but not `LLMGATEWAY_API_KEY`.
- `packages/opencorvus/src/provider/policy.ts` keeps provider URLs authoritative and forbids key-prefix-based endpoint overrides, so using the DeepSeek key for the LLM Gateway provider would be an invalid cross-provider workaround.
- Independent read-only agent `019fe567-57e9-7a82-b075-32c3fae001c9` confirmed the same conclusion and found no legitimate no-edit route except providing a real `LLMGATEWAY_API_KEY`.

Blocked runs:

- `specs/artifacts/2026-08-09-mission-random-port-e2e/m01-mslgzuvq.json`: random-port backend `http://127.0.0.1:57021/`, isolated DB `C:\Users\hengu\AppData\Local\Temp\opencorvus-mission-e2e-m01-mslgzuvq\runtime-root\data\opencorvus.db`, preflight failed because provider `llmgateway` is not configured.
- `specs/artifacts/2026-08-09-mission-random-port-e2e/m01-mslh0ob6.json`: random-port backend `http://127.0.0.1:55129/`, isolated DB `C:\Users\hengu\AppData\Local\Temp\opencorvus-mission-e2e-m01-mslh0ob6\runtime-root\data\opencorvus.db`, preflight failed because `deepseek/deepseek-v4-flash` is not in the DeepSeek provider catalog.

No new Mission case was started after these preflight failures. The next distinct live Mission case should wait for a real `LLMGATEWAY_API_KEY` or an equivalent already-supported `llmgateway` auth entry in the isolated run environment.

## User correction: use native DeepSeek provider

The user clarified the required model ref as `deepseek/deepseek-v4-flash` using the system environment key.

Current authority:

- DeepSeek official Codex integration documentation says only `deepseek-v4-flash` currently supports Codex integration through DeepSeek's Responses API.
- DeepSeek's 2026-07-31 change log says the official V4-Flash API is in public beta and the calling method remains unchanged: set the model name to `deepseek-v4-flash`.
- DeepSeek's 2026-04-24 change log says the base URL remains unchanged and the model parameter should be `deepseek-v4-pro` or `deepseek-v4-flash`; legacy `deepseek-chat` and `deepseek-reasoner` were scheduled for retirement on 2026-07-24.

Independent read-only agent `019fe56c-397f-7c40-bb29-94443a8337f0` confirmed the root cause: the bundled catalog's native `deepseek` provider still listed only `deepseek-chat` and `deepseek-reasoner`, so isolated runs could activate `deepseek` from `DEEPSEEK_API_KEY` but could not validate `deepseek-v4-flash`.

Applied scoped fix:

- `packages/opencorvus/src/provider/models-bootstrap.json` now includes `deepseek-v4-flash` under the native `deepseek` provider.
- `packages/opencorvus/script/benchmark/mission-random-port-e2e.ts` now defaults live runs to `deepseek/deepseek-v4-flash`.

Verification:

- JSON catalog check confirmed `deepseek.models["deepseek-v4-flash"]` exists, with env `DEEPSEEK_API_KEY` and API `https://api.deepseek.com`.
- `bun run typecheck` from `packages/opencorvus` passed.
- `specs/artifacts/2026-08-09-mission-random-port-e2e/m01-mslhipd1.json`: random-port backend `http://127.0.0.1:51236/`, isolated DB under `C:\Users\hengu\AppData\Local\Temp\opencorvus-mission-e2e-m01-mslhipd1\runtime-root\data\opencorvus.db`, preflight reached DeepSeek native API with model `deepseek-v4-flash` and failed HTTP 401: the system `DEEPSEEK_API_KEY` was rejected as invalid.
- `specs/artifacts/2026-08-09-mission-random-port-e2e/m01-mslhopz5.json`: after explicit user authorization to use the system DeepSeek environment key, a new random-port backend started at `http://127.0.0.1:55617/` with isolated DB under `C:\Users\hengu\AppData\Local\Temp\opencorvus-mission-e2e-m01-mslhopz5\runtime-root\data\opencorvus.db`; provider preflight again reached native DeepSeek with `deepseek-v4-flash` and failed HTTP 401 because the configured `DEEPSEEK_API_KEY` was rejected as invalid. The stored artifact redacts the masked key suffix.
- `http://127.0.0.1:56973/ui/`: the OpenCorvus Overlay UI was opened for the corrected ABSA Mission workflow after building `packages/overlay/dist-vite` with `bun run --cwd packages/overlay build:vite`. The backend used `OPENCORVUS_HOME=C:\Users\hengu\AppData\Local\Temp\opencorvus-absa-ui-1786260919921\runtime-root`; `/global/health` reported database `...\runtime-root\data\opencorvus.db`, proving isolated database ownership. A project-scoped provider preflight for `deepseek/deepseek-v4-flash` returned `{"ok":false,"status":"error","providerID":"deepseek","modelID":"deepseek-v4-flash","message":"Provider deepseek returned HTTP 401: Authentication Fails, Your api key: ****REDACTED is invalid"}`. No ABSA Mission prompt was submitted after this preflight failure.
- `http://127.0.0.1:56738/ui/`: after the previous temporary UI server stopped, a fresh isolated OpenCorvus server was started with `OPENCORVUS_HOME=C:\Users\hengu\AppData\Local\Temp\opencorvus-absa-ui-1786261511121\runtime-root` and project `...\opencorvus-absa-ui-1786261511121\project`. `/global/health` reported database `...\runtime-root\data\opencorvus.db`; `/ui/` returned HTTP 200 from directory Overlay assets. Project-scoped `POST /provider/deepseek/test` for `deepseek-v4-flash` again returned `{"ok":false,"status":"error","providerID":"deepseek","modelID":"deepseek-v4-flash","message":"Provider deepseek returned HTTP 401: Authentication Fails, Your api key: ****REDACTED is invalid"}`. No ABSA Mission prompt was submitted.
- Fresh audit of the same `http://127.0.0.1:56738/` instance confirmed `/global/health` still reports the isolated database under `...\opencorvus-absa-ui-1786261511121\runtime-root\data\opencorvus.db`. The current shell still exposes a `DEEPSEEK_API_KEY`, but project-scoped `POST /provider/deepseek/test` for `deepseek-v4-flash` again returned HTTP 200 with `ok:false` and the DeepSeek HTTP 401 invalid-key message. No ABSA Mission prompt was submitted.
- A subsequent resumed fresh audit again confirmed the same isolated instance remained healthy and the current shell still exposed a `DEEPSEEK_API_KEY`; project-scoped provider preflight for `deepseek-v4-flash` again returned HTTP 200 with `ok:false` and the DeepSeek HTTP 401 invalid-key message. No ABSA Mission prompt was submitted.

No Mission prompt was sent after this preflight failure, so no in-progress case was interrupted. The next live Mission case requires a valid `DEEPSEEK_API_KEY` in the process environment.

## Accepted run: M01

The process-level `DEEPSEEK_API_KEY` inherited by Codex was stale and invalid, but the Windows User environment had a different `DEEPSEEK_API_KEY`. The accepted live run injected the User-level key into the child process without printing the key.

Artifact:

- `specs/artifacts/2026-08-09-mission-random-port-e2e/m01-mslhm7tj.json`

Evidence:

- Case: M01 general Mission introduction, Skill, state, resume, child Task, and archive/artifact evidence.
- Random-port backend: `http://127.0.0.1:53106/`.
- Isolated DB: `C:\Users\hengu\AppData\Local\Temp\opencorvus-mission-e2e-m01-mslhm7tj\runtime-root\data\opencorvus.db`.
- Model: `deepseek/deepseek-v4-flash`; provider preflight returned `ok: true`, `status: connected`, `providerID: deepseek`, `modelID: deepseek-v4-flash`.
- Mission wake: first wake `created: true`; second wake `created: false`; both used Mission `4b4572d9d6987120` and Session `ses_-fe601a8db36bffffffffffffceQSychi6QqrE4`.
- General Mission Skill: one completed `mission_skill` tool call for `general`.
- Mission state: `frontier.md`, `notes.md`, `tasks.md`, and `handoff.md` were written or read in completed tool evidence.
- Child Task: one Mission-sourced Task `tsk_g019fe5730480000000000000BeMLatALhmR3PD`, title `Run npm test in fixture`, terminal completed.
- Product evidence: child turn artifact `base/test-report`; project archive returned zip evidence with 27,115 bytes.
- Harness verdict: `accepted`, with no failures.

Caveat:

- M01 did not structurally prove a completed `publish_interactive_artifact` call. It proved child artifact plus project archive evidence. M02 was added to cover explicit publish-tool evidence.

## Case M02: read-only inventory, resume, explicit publish

Input:

- Start the dev backend on an explicit random loopback port with isolated `OPENCORVUS_HOME`.
- Create a fresh tiny fixture project.
- Submit `POST /mission/wake` with `@mission("general")`, asking Mission to introduce the plan, load the `general` Mission Skill, write Mission state, and dispatch one read-only child Task that inspects `package.json`, `index.js`, and `test.js` without running `npm test`.
- Submit a resume wake asking Mission to query child evidence and publish a compact inventory summary with `publish_interactive_artifact`.

Required structural evidence:

- Artifact records `caseID: "m02"`.
- First wake creates a Mission; second wake resumes the same Mission and Session.
- Provider preflight uses `deepseek/deepseek-v4-flash` and succeeds against the native `deepseek` provider.
- Completed `mission_skill` call loads `general`.
- Completed `panel.create_task` creates one Mission-sourced child Task.
- Child Task terminal evidence shows read-only inventory of `package.json`, `index.js`, and `test.js`, including script names, exported function names, and expected test assertion.
- Completed `publish_interactive_artifact` evidence exists in the Mission Session.
- Project archive evidence is non-empty.

Accepted run:

- `specs/artifacts/2026-08-09-mission-random-port-e2e/m02-msli1rgu.json`.
- Random-port backend: `http://127.0.0.1:53789/`.
- Isolated DB: `C:\Users\hengu\AppData\Local\Temp\opencorvus-mission-e2e-m02-msli1rgu\runtime-root\data\opencorvus.db`.
- Model: `deepseek/deepseek-v4-flash`; provider preflight returned connected.
- Mission wake: first wake `created: true`; second wake `created: false`; both used Mission `6aecf26c5618a1e7` and Session `ses_-fe601a82a642ffffffffffff4lGxlaZsYc2AJV`.
- Child Task: one Mission-sourced Task `tsk_g019fe57e193a000000000000x0entS33r0rQqr`, title `Read-only code inventory`, terminal completed.
- Publish evidence: one completed `publish_interactive_artifact` tool call.
- Project archive: 43,594 bytes.
- Harness verdict: `accepted`, with no failures.

Verification after harness changes:

- JSON catalog check confirmed native `deepseek` has `deepseek-v4-flash` with env `DEEPSEEK_API_KEY` and API `https://api.deepseek.com`.
- `bun run typecheck` from `packages/opencorvus` passed after adding M02 case selection and publish-specific evaluation.

## User model switch: `openai/gpt-5.6-sol`

The user replaced the requested Mission model with `openai/gpt-5.6-sol`.

Fresh catalog and provider evidence:

- `packages/opencorvus/src/provider/models-bootstrap.json` does not define model `gpt-5.6-sol` under provider `openai`.
- The local catalog defines `gpt-5.6-sol` under provider `llmgateway`, which requires `LLMGATEWAY_API_KEY`.
- The local catalog also defines `openai-gpt-5.6-sol` under provider `snowflake-cortex`, which requires `SNOWFLAKE_ACCOUNT` and `SNOWFLAKE_CORTEX_PAT`; that is a Snowflake model id, not the requested `openai/gpt-5.6-sol` ref.
- The current shell environment has no `OPENAI_API_KEY` and no `LLMGATEWAY_API_KEY`.
- Project-scoped `POST /provider/openai/test` with model `gpt-5.6-sol` returned `Provider is not configured. Set API key or auth first.`
- Project-scoped `POST /provider/llmgateway/test` with model `gpt-5.6-sol` returned `Provider is not configured. Set API key or auth first.`

No ABSA Mission prompt was submitted after this model switch because the requested provider/model ref is not currently runnable in the isolated OpenCorvus environment. A live Mission run requires either a configured valid provider for the exact requested ref, or explicit authorization to use the catalog-supported `llmgateway/gpt-5.6-sol` with a valid `LLMGATEWAY_API_KEY`.

Fresh follow-up:

- The isolated OpenCorvus server at `http://127.0.0.1:56738/` remained healthy and continued to report database `...\opencorvus-absa-ui-1786261511121\runtime-root\data\opencorvus.db`.
- The current shell environment still had no `OPENAI_API_KEY`, `LLMGATEWAY_API_KEY`, `SNOWFLAKE_ACCOUNT`, or `SNOWFLAKE_CORTEX_PAT`.
- Project-scoped provider preflight returned `Provider is not configured. Set API key or auth first.` for `openai/gpt-5.6-sol`, `llmgateway/gpt-5.6-sol`, and `snowflake-cortex/openai-gpt-5.6-sol`.
- Official OpenAI model documentation search found no `gpt-5.6-sol` model name, matching the local catalog evidence that the runnable `gpt-5.6-sol` entry is under `llmgateway`, not `openai`.

No ABSA Mission prompt was submitted after this follow-up because no validated provider/model route exists for the user's requested `openai/gpt-5.6-sol` target.

## Accepted run: M01 general Mission introduction, Skill, state, resume, child Task artifact

After the user refreshed the system DeepSeek environment, `specs/artifacts/2026-08-09-mission-random-port-e2e/m01-mslhy92w.json` accepted:

- Random-port backend: `http://127.0.0.1:54174/`.
- Isolated database: `C:\Users\hengu\AppData\Local\Temp\opencorvus-mission-e2e-m01-mslhy92w\runtime-root\data\opencorvus.db`.
- Model: `deepseek/deepseek-v4-flash`.
- Provider preflight: `{ "ok": true, "status": "connected", "providerID": "deepseek", "modelID": "deepseek-v4-flash" }`.
- Mission lifecycle: first wake created Mission `caed1fbf417df51f` with Session `ses_-fe601a852348ffffffffffffa8oeRU2pSLeQaS`; second wake resumed the same Mission and Session with `created: false`.
- Coverage evidence: completed `mission_skill` tool for `general`, Mission state writes for `frontier.md`, `tasks.md`, `notes.md`, and `handoff.md`, child Task `tsk_g019fe57b841a000000000000hRgVcga48xWD0z` from source `mission`, completed `base/test-report` turn artifact, and project archive response `200`.
- Verdict: `{ "status": "accepted", "failures": [] }`.

Independent delivery review `019fe57d-c550-75a3-ac89-4ddbbf5865c3` found that M01 is accepted under the current harness and spec because the verdict is structural, not model self-report. The same review identified a remaining coverage gap: M01 did not prove an actual `publish_interactive_artifact` tool call. The next different case should therefore target publish explicitly rather than reusing the M01 surface.

## Accepted run: M02 read-only inventory Mission with publish

M02 was added as a distinct case selected by `MISSION_RANDOM_PORT_E2E_CASE=m02`. It uses the same random-port, isolated-database, `deepseek/deepseek-v4-flash` backend path, but changes the Mission request:

- First wake: introduce the Mission plan, load `general`, write Mission state, and dispatch one read-only code Task that inventories `package.json`, `index.js`, and `test.js` without running `npm test`.
- Resume wake: read Mission state, reconcile the child Task and its artifacts, and publish a compact inventory summary through `publish_interactive_artifact`.
- M02 harness acceptance requires a completed `publish_interactive_artifact` tool part; ordinary child turn artifacts or project archive alone are not enough.

Initial M02 evidence `specs/artifacts/2026-08-09-mission-random-port-e2e/m02-msli6giq.json` had structural verdict accepted but Bun exited `1` during shutdown. Independent read-only investigation `019fe584-c51c-79d0-a71e-9bc03a21dd58` found a lifecycle teardown race: the older shutdown path timed out `Instance.disposeAll()` after 10 seconds, then continued to close the database and log sink while scheduler disposal could still emit a late error. The scoped runner fix is to settle runtime transfer and current-process execution, call `Scheduler.disposeGlobal()`, wait for `Instance.disposeAll()` without leaving the underlying promise running in the background, and only then close the database and log sink.

Validated M02 evidence:

- `specs/artifacts/2026-08-09-mission-random-port-e2e/m02-mslihqdd.json` accepted and the Bun process exited `0`.
- Random-port backend: `http://127.0.0.1:57683/`.
- Isolated database: `C:\Users\hengu\AppData\Local\Temp\opencorvus-mission-e2e-m02-mslihqdd\runtime-root\data\opencorvus.db`.
- Model and provider: `deepseek/deepseek-v4-flash`, provider preflight `{ "ok": true, "status": "connected", "providerID": "deepseek", "modelID": "deepseek-v4-flash" }`.
- Mission lifecycle: first wake created Mission `ca0c4cbd8ab8b764` with Session `ses_-fe601a773dfaffffffffffffOp0gs5xuFXnjlq`; second wake resumed the same Mission and Session with `created: false`.
- Publish evidence: completed `publish_interactive_artifact` tool part produced table Artifact `art_g019fe58d42680000000000007W583SxAU6NWv9`; `panel.complete_mission` returned `mission_completed`.
- Child Task evidence: Task `tsk_g019fe589a5d9000000000000iDB6hNxDdLchn6` completed with `base/research-report` artifact `root-files-inventory`, snapshot resources for `package.json`, `index.js`, and `test.js`, and read-only compliance evidence.
- Shutdown evidence: `Server.beginRuntimeTransfer`, `terminateCurrentProcessOwnedExecution`, `releaseRuntimeHandoff`, `Scheduler.disposeGlobal`, `Instance.disposeAll`, `Database.close`, and `Log.close` all recorded `completed`; no `SonicBoom destroyed` error occurred.

Final review `019fe58f-336e-7350-b822-01c848584b65` accepted M02 as strong evidence and recommended tightening future acceptance so an accepted run cannot leave the Mission in a running state. The harness now requires `status.status === "inactive"` with no running Mission activity for every accepted case, and M02 additionally requires completed `panel.complete_mission` evidence.

The tightened contract was validated by `specs/artifacts/2026-08-09-mission-random-port-e2e/m02-mslivjsd.json`:

- Random-port backend: `http://127.0.0.1:57741/`.
- Isolated database: `C:\Users\hengu\AppData\Local\Temp\opencorvus-mission-e2e-m02-mslivjsd\runtime-root\data\opencorvus.db`.
- Provider preflight: native `deepseek/deepseek-v4-flash` connected.
- Mission status: `inactive`, activity running count `0`.
- Publish evidence: completed `publish_interactive_artifact` produced document Artifact `art_g019fe5986209000000000000UppaLBRxOuzvje`.
- Completion evidence: completed `panel.complete_mission` returned `mission_completed` for Mission `747fa2b2601a6250`.
- Verdict: `{ "status": "accepted", "failures": [] }`; Bun process exited `0`.

## M09 Candidate Plan: Mission control-plane views and persisted table

### Recall

User objective remains:

- Continue distinct Mission E2E cases on an OS-assigned random-port dev backend.
- Use a run-specific isolated database and native `deepseek/deepseek-v4-flash` with the system environment key.
- Do not interfere with a running case unless it is stuck.
- Before every code change, use an independent read-only agent to investigate problem depth and impact.
- Fix demonstrated root causes without fallback, host-side workflow gates, or regressions to prior cases.

Existing accepted coverage is M01-M07 as recorded in this file. Repository and artifact search found historical M02/M04 runs that incidentally published `table@1`, and historical runs that incidentally called `panel.view_tasks` or `panel.view_board`. No Mission E2E artifact contains `panel.view_plan`, and the current checker accepts any completed `publish_interactive_artifact` without validating renderer, payload, or persisted artifact content.

Independent read-only agent `019fe660-2fb9-7f40-9d5e-97118102670b` confirmed this is a benchmark coverage gap rather than a demonstrated product defect. The existing product path already exposes `view_plan`, `view_board`, and `view_tasks` through the Mission panel capability, executes them through `EngineService.getBoard` or `getProjectBoard`, validates `table@1` payloads, persists interactive artifacts, and exposes a session-owned artifact GET route. No product code change is planned unless the live case reveals a repeatable defect and a new independent causal investigation supports an edit.

### M08 Input

- Start the dev backend on an OS-assigned random loopback port with a run-specific isolated `OPENCORVUS_HOME` and database.
- Use native `deepseek/deepseek-v4-flash`; reject mock provider mode for M08.
- First wake uses `@mission("general")` and `@squad("base")`, writes Mission state, and creates exactly one read-only child Task titled `M09 control-plane inventory`.
- The child Task reads only `package.json`, produces concise durable evidence for the package name and test script, does not modify files, and does not run tests.
- Wait until that one child Task is terminal and completed before sending the second wake.
- Second wake resumes the same Mission and, for the exact child Task ID, calls:
  - `panel.view_tasks`;
  - `panel.view_board` with that Task ID;
  - `panel.view_plan` with that Task ID;
  - `panel.query_task`, `panel.query_task_artifacts`, and a complete `panel.read_task_artifact` for the current completion decision.
- The same final turn publishes a `table@1` with exactly three rows representing `view_tasks`, `view_board`, and `view_plan`, then completes the Mission using the exact read completion-decision locator.

### M09 Acceptance

Common evidence:

- `caseID` is `m09`.
- Backend base URL is a random loopback port and health reports the run-specific isolated database.
- Native provider preflight reports connected for `deepseek/deepseek-v4-flash`.
- First wake creates the Mission; second wake resumes the same Mission and Session.
- Mission status is `inactive` with `activity.running === 0`.
- Project archive returns HTTP `200` and non-zero bytes.

M09-specific evidence:

- Exactly one child Task exists and was created with title `M09 control-plane inventory`.
- Completed `panel.view_tasks` input has no Task ID and its output contains the exact child Task ID, title, and completed/inactive status.
- Completed `panel.view_board` and `panel.view_plan` each use the exact child Task ID. Their outputs identify the same title; board output reports inactive status, while plan output reports the planning-artifact section or its explicit empty result.
- Completed `publish_interactive_artifact` input has schema version `1`, renderer `table@1`, valid unique columns, and exactly three rows whose surface values are exactly `view_tasks`, `view_board`, and `view_plan`; every row carries the exact child Task ID.
- Publish output reports an `art_` artifact ID and renderer `table@1`.
- GET `/session/:sessionID/interactive-artifact/:artifactID` returns the persisted artifact record, and its payload exactly matches the validated publish input artifact.
- The child Task satisfies the existing M04 authority contract: current Task query, artifact enumeration, complete completion-decision read, and exact read locator in the sole `task_acceptances` entry for successful `panel.complete_mission`.

Risk controls:

- Scope implementation to `packages/opencorvus/script/benchmark/mission-random-port-e2e.ts` plus this existing record.
- Preserve the M01/M02 mock provider implementation and all M03-M07 live checks.
- Do not treat historical incidental table/view calls as M09 acceptance.
- Do not require non-empty Task goals because an empty goals list is a valid `view_plan` result; validate the stable Task and planning-artifact prose instead of a complete output string.
- Do not send the second wake before the one child Task is terminal and completed.
- Do not add fallback acceptance, mock scripted M08 responses, product gates, or unrelated provider-redaction changes.
- Shutdown: runtime transfer, current-process execution termination, runtime handoff release, `Scheduler.disposeGlobal`, `Instance.disposeAll`, `Database.close`, and `Log.close` all recorded `completed`.

## Mock-provider M01 debug rerun and harness settlement hardening

The local mock-provider path was repaired and rerun to keep a deterministic random-port Mission regression available without live provider credentials.

Independent read-only investigations:

- `019fe55f-0f5d-7f60-b973-03383fa6ed65` found the original mock run's `ToolSchemaBudgetError` was a stale small mock-model budget, not a Mission tool-surface regression. The mock provider should represent the intended large-context Mission model and skip external provider preflight while retaining `/global/health` and isolated database checks.
- `019fe574-18dd-7ea3-ab47-e674fc629ff2` found the next rejection was not a Mission status projection defect: `panel.create_task` had failed before any child Task existed. The harness now records failed `panel.create_task` tool evidence directly and requires a completed `panel.create_task` output `task_id` to appear exactly in `/mission/:missionID/status.tasks`.
- `019fe57a-9fa0-7a41-8817-5d4560872c97` found the harness could accept before the resumed Mission turn settled. The acceptance condition now requires completed required tool evidence, resume settlement, completed assistant messages, and idle Mission activity.
- `019fe581-c89b-72a0-bd4e-1fac063d37fe` found the post-accepted shutdown crash came from closing the logger while scheduler/instance disposal was still active. Shutdown now disposes the global Scheduler before `Instance.disposeAll`, waits for lifecycle disposal instead of abandoning it with a timeout race, then closes Database and Log. `Log.close()` also advances the logger generation after swapping to stderr so late loggers cannot write to a destroyed SonicBoom destination.

Superseded historical deterministic mock run:

- Artifact: `specs/artifacts/2026-08-09-mission-random-port-e2e/m01-msliffm9.json`.
- Random-port backend: `http://127.0.0.1:52970/`.
- Isolated DB: `C:\Users\hengu\AppData\Local\Temp\opencorvus-mission-e2e-m01-msliffm9\runtime-root\data\opencorvus.db`.
- Model: `mock-openai-compatible/mission-e2e`; provider preflight was intentionally `status: "skipped"` after isolated health/database validation because Mission requests exercised the then-current local mock provider.
- Mission status reached `inactive` with `activity.running: 0`.
- Child Task: `tsk_g019fe5871d80000000000000x1Eul3JG5vdGQr`, `source: "mission"`, `lifecycleStatus: "completed"`.
- Shutdown evidence: runtime transfer, current-process execution termination, runtime handoff release, provider stop, `Scheduler.disposeGlobal`, `Instance.disposeAll`, `Database.close`, and `Log.close` all completed.
- Harness verdict: `accepted`, with no failures.

Historical verification for the superseded mock harness and F07/F08 repairs:

- `bun test test/frontmatter-yaml-engine.test.ts test/active-operator-wake-settlement.test.ts test/orchestrator-mission-root-message-read.test.ts test/scheduler-task-wait-project-runtime.test.ts --timeout=30000`: 11 tests passed, 27 assertions.
- `bun run typecheck` from `packages/opencorvus`: passed.
- `bun run docs:check` from repository root: passed.
- `git diff --check`: passed.

## Correction: installed credentials and refreshed OpenAI model catalog

The user corrected the `openai/gpt-5.6-sol` path: the model should be made available by copying the installed OpenCorvus credentials and refreshed model catalog into the isolated runtime, not by hand-editing `models-bootstrap.json`. The temporary hand-added OpenAI catalog entry was reverted; an unrelated earlier native DeepSeek catalog addition remains in the dirty worktree and is not part of this correction.

Installed authority used for the isolated run:

- Installed runtime root: `C:\Users\hengu\AppData\Local\opencorvus`.
- Copied credential/catalog files only, without reading or printing secret contents:
  - `C:\Users\hengu\AppData\Local\opencorvus\data\auth.json` to isolated `runtime-root\data\auth.json`.
  - `C:\Users\hengu\AppData\Local\opencorvus\data\models.json` to isolated `runtime-root\data\models.json`.
  - `C:\Users\hengu\AppData\Local\opencorvus\auth.json` to isolated `runtime-root\auth.json`.
- Did not copy the installed `opencorvus.db`; the test kept an isolated database.

Live isolated backend evidence:

- Random-port backend: `http://127.0.0.1:59477/`.
- UI: `http://127.0.0.1:59477/ui/`.
- Runtime root: `C:\Users\hengu\AppData\Local\Temp\opencorvus-absa-installed-creds-1786262282244\runtime-root`.
- Project: `C:\Users\hengu\AppData\Local\Temp\opencorvus-absa-installed-creds-1786262282244\project`.
- `/global/health` reported database `C:\Users\hengu\AppData\Local\Temp\opencorvus-absa-installed-creds-1786262282244\runtime-root\data\opencorvus.db`.
- Project-scoped `POST /provider/openai/test` with `{"modelID":"gpt-5.6-sol"}` returned `{"ok":true,"status":"connected","providerID":"openai","modelID":"gpt-5.6-sol","message":"Provider is reachable."}`.

ABSA Mission evidence:

- Submitted real Mission through `POST /mission/wake` using `@mission("general")` and child model `openai/gpt-5.6-sol`.
- Mission ID: `9dc670ced14073ce`.
- Mission Session: `ses_-fe601a778e3dffffffffffffja0z4qWhxBQFtJ`.
- Mission created Task `tsk_g019fe58af8e40000000000007B9cs8nncEUtot`, title `Deliver Reproducible ABSA Experiment`.
- The Task orchestrator and child agents use provider `openai` and model `gpt-5.6-sol`.
- The optional assurance `question` was answered with the tool-recommended `skip_optional_testing`; no mandatory acceptance requirement was removed.
- First-frontier child evidence completed for `request-interpreter`, `requirement-engineer`, and `source-investigator`. The source investigation fetched Hugging Face model metadata for `yangheng/deberta-v3-base-absa-v1.1` and published `advanced/source-investigation`.
- Current state at this record update: Mission and Task remain running; `solution-architect` is active and implementation files have not yet been created in the isolated project.

## Current DeepSeek live-only revalidation

The active random-port Mission E2E goal remains scoped to `deepseek/deepseek-v4-flash` using the system DeepSeek key. Earlier deterministic mock artifacts are historical only. The current harness rejects `MISSION_RANDOM_PORT_E2E_MOCK_PROVIDER=1` for every case, rejects `MISSION_RANDOM_PORT_E2E_MODEL` values other than `deepseek/deepseek-v4-flash`, writes benchmark evidence through a redaction pass, and requires accepted evidence to show native DeepSeek connected preflight.

Independent delivery review `019fe585-6c58-7822-b104-528774312ad7` found that earlier accepted M01/M02 artifacts were stale relative to the current harness contract because they did not prove Mission idle state. Both cases were rerun with the current live-only harness and the Windows User-level `DEEPSEEK_API_KEY`.

Current M01 accepted artifact:

- `specs/artifacts/2026-08-09-mission-random-port-e2e/m01-msliih6k.json`.
- Case ID: `m01`.
- Random-port backend: `http://127.0.0.1:51179/`.
- Isolated database: `C:\Users\hengu\AppData\Local\Temp\opencorvus-mission-e2e-m01-msliih6k\runtime-root\data\opencorvus.db`.
- Provider preflight: native `deepseek`, model `deepseek-v4-flash`, `status: connected`.
- Mission lifecycle: first wake created, second wake resumed the same Mission and Session.
- Mission settled: `status: inactive`, `activity.running: 0`.
- Evidence: completed `mission_skill` for `general`, completed `publish_interactive_artifact`, one Mission-sourced completed child Task, non-empty project archive of 41,644 bytes.
- Harness verdict: `accepted`, with no failures.

Current M02 accepted artifact:

- `specs/artifacts/2026-08-09-mission-random-port-e2e/m02-mslivjsd.json`.
- Case ID: `m02`.
- Random-port backend: `http://127.0.0.1:57741/`.
- Isolated database: `C:\Users\hengu\AppData\Local\Temp\opencorvus-mission-e2e-m02-mslivjsd\runtime-root\data\opencorvus.db`.
- Provider preflight: native `deepseek`, model `deepseek-v4-flash`, `status: connected`.
- Mission lifecycle: first wake created, second wake resumed the same Mission and Session.
- Mission settled: `status: inactive`, `activity.running: 0`.
- Evidence: completed `mission_skill` for `general`, completed `publish_interactive_artifact`, completed `panel.complete_mission` returning `mission_completed`, one Mission-sourced completed read-only inventory child Task, non-empty project archive of 46,683 bytes.
- Harness verdict: `accepted`, with no failures; Bun process exited `0`.

Verification:

- `bun run typecheck` from `packages/opencorvus` passed before the current M01/M02 live reruns.

## Case M03: failing fixture repair Mission

M03 is the next distinct live-only Mission case. It differs from M01 and M02 by exercising a real implementation/debug repair path rather than only dispatch/test evidence or read-only inventory publishing.

Input:

- Start the dev backend on an OS-assigned random loopback port with an isolated `OPENCORVUS_HOME`.
- Use native `deepseek/deepseek-v4-flash` only; `MISSION_RANDOM_PORT_E2E_MOCK_PROVIDER=1` and model overrides are rejected for this live benchmark.
- Create the fixture project with `index.js` intentionally wrong: `export function answer() { return 41 }`.
- Submit first `/mission/wake` with `@mission("general")`, asking Mission to introduce the plan, load the `general` Mission Skill, write Mission state, and dispatch one small implementation Task that repairs the fixture. The child Task may edit only `index.js`, must run `npm test`, and must leave concise evidence.
- Submit resume `/mission/wake` asking Mission to query the child Task and artifacts, publish a compact repair summary with `publish_interactive_artifact`, and call `panel.complete_mission` once repair evidence is ready.

Required structural evidence:

- Evidence `caseID` is `m03`; run ID is fresh and the backend base URL is a non-default random loopback port.
- `/global/health` reports the database under the run-specific isolated `runtimeRoot`.
- Provider preflight for native `deepseek/deepseek-v4-flash` returns connected.
- First wake creates a Mission; second wake resumes the same Mission and Session.
- Session messages include completed `mission_skill` with `name === "general"`.
- Session messages include completed `panel.create_task` output with a `task_id`, and `/mission/:missionID/status.tasks` exposes that exact Mission-sourced child Task.
- Resume evidence includes completed `publish_interactive_artifact` and completed `panel.complete_mission` returning `mission_completed`.
- Mission status is `inactive` with `activity.running === 0`.
- Harness project verification after Mission settlement runs real `npm test` in the isolated fixture and requires exit status `0`.
- Harness project verification compares final `index.js` against the initial fixture baseline commit, not only the working tree, so committed and uncommitted Task repairs both verify. The baseline-to-final diff must remove the original failing line `-export function answer() { return 41 }` and add a passing implementation returning `42`, and final `index.js` must not contain the original failing implementation.
- Project archive exists and shutdown records all lifecycle steps completed; the Bun process must exit `0`.

Accepted M03 evidence after refreshing the system DeepSeek environment and rerunning under the current live-only harness:

- Artifact: `specs/artifacts/2026-08-09-mission-random-port-e2e/m03-msllbvpc.json`.
- Case ID: `m03`; model ref: `deepseek/deepseek-v4-flash`.
- Random-port backend: `http://127.0.0.1:61474/`.
- Isolated database: `C:\Users\hengu\AppData\Local\Temp\opencorvus-mission-e2e-m03-msllbvpc\runtime-root\data\opencorvus.db`.
- Provider preflight: native `deepseek`, model `deepseek-v4-flash`, `ok: true`, `status: connected`.
- Mission lifecycle: first wake created Mission `1d32d4ca77716c57`; second wake resumed the same Mission and Session.
- Mission settled: `status: inactive`, `activity.running: 0`.
- Child Task: `tsk_g019fe5d259ca000000000000QzyG5WShZL0zIv`, `source: mission`, `lifecycleStatus: completed`.
- Tool evidence: completed `mission_skill` for `general`, completed `panel.create_task`, completed `publish_interactive_artifact`, and completed `panel.complete_mission`.
- Project verification: real `npm test` exit status `0`; baseline commit `ec6ce2d8fe47873cf541bbf2b0ad03135a6acb2b`; final head `4e9bcf31c1afaeb8741aef67adb2d800da66dc72`; final `index.js` is `export function answer() { return 42 }`; baseline-to-final diff removes `return 41` and adds `return 42`; `allChangedFiles` records `.gitignore`, `.opencorvus/opencorvus.jsonc`, and `index.js`; filtered `changedFiles` is exactly `["index.js"]`.
- Project archive: HTTP `200`, `application/zip`, 43,456 bytes, 5 files.
- Verdict: `{ "status": "accepted", "failures": [] }`; Bun process exited `0`.
- Shutdown: `Server.beginRuntimeTransfer`, `terminateCurrentProcessOwnedExecution`, `releaseRuntimeHandoff`, `Scheduler.disposeGlobal`, `Instance.disposeAll`, `Database.close`, and `Log.close` all recorded `completed`.
- The old rejected artifact `m03-msljrbqo.json` proved the product path had succeeded but the harness was using working-tree diff only. Independent read-only investigation confirmed the child Task committed the repair, leaving `git diff -- index.js` empty; the harness now verifies baseline-to-final diff from the initial fixture commit.
- Earlier deterministic mock evidence is historical only. The current live-only harness rejects `MISSION_RANDOM_PORT_E2E_MOCK_PROVIDER=1` for every case before backend startup and rejects non-`deepseek/deepseek-v4-flash` model overrides before Mission execution.
- The old rejected preflight artifact `m03-msljrpt7.json` was retained as failure evidence but the provider-supplied key suffix was redacted to `****<redacted>`.

## Case M04 plan: resume evidence authority

### Recall

User request:

- Continue random-port dev-backend Mission E2E testing and debug.
- Each run must design a different small E2E case that expands coverage across surfaces such as introduction, resume, publish, tool, and skill.
- Do not interfere with an in-progress case unless it is stuck.
- Before each edit, use an independent agent to investigate problem depth and impact.
- Use an isolated database.
- Use `deepseek/deepseek-v4-flash` with the system/user environment DeepSeek key.
- Do not fix one path by weakening or breaking another.

Current accepted live cases:

- M01 covers Mission introduction, `@mission("general")`, Mission state, child Task creation, resume, publish evidence, idle Mission state, random port, isolated DB, and native DeepSeek preflight.
- M02 covers read-only inventory, child artifact reconciliation, `publish_interactive_artifact`, `panel.complete_mission`, valid child completion-decision evidence locators, idle Mission state, random port, isolated DB, and native DeepSeek preflight.
- M03 covers a real implementation repair, child testing, final `npm test`, baseline-to-final `index.js` diff, filtered implementation changed files, publish, complete, idle Mission state, random port, isolated DB, and native DeepSeek preflight.

Gap:

- Existing artifacts show `query_task_artifacts` and `read_task_artifact` can occur, but the benchmark does not have a dedicated live case whose primary acceptance is that resume explicitly reads the child Task's completion-decision authority and completes the Mission using that exact read locator.
- M02 partially checks a read completion-decision payload with evidence locators, but its main case identity is read-only inventory plus publish. M04 will make evidence-authority readback the primary contract.

Independent agent feedback:

- Read-only agent `019fe5da-6a5c-7463-9878-7c0471992aed` recommended M04 as a "resume evidence authority" case.
- It identified the relevant product contract in `packages/opencorvus/src/prompt/core/mission-core.txt`: Mission should query terminal child results, enumerate artifact catalog, read the current Completion Decision and relied-on artifacts before acceptance, then call `complete_mission` with only locators completely read in the same turn.
- It also identified host enforcement in `packages/opencorvus/src/tool/panel.ts`: `complete_mission` checks current terminal child Task occurrence and same-message read locators before accepting.
- Recommended acceptance: require completed `query_task`, `query_task_artifacts`, `read_task_artifact` for the child's `task_completion_decision`, `publish_interactive_artifact`, and `complete_mission` whose `task_acceptances` cite the exact completion-decision locator read earlier.

### M04 Input

- Start the dev backend on an OS-assigned random loopback port with a run-specific isolated `OPENCORVUS_HOME`.
- Use native `deepseek/deepseek-v4-flash`; reject unsupported model overrides and mock mode for M04.
- Create the same tiny fixture project, but do not ask for code repair or test execution as the case identity.
- Submit first `/mission/wake` with `@mission("general")`, asking Mission to introduce the plan, load the general Mission Skill, write state, and dispatch one small evidence Task.
- The child Task must produce a concise deterministic evidence artifact from the fixture, such as reporting the `package.json` name and test script, without modifying project files.
- Submit resume `/mission/wake` asking Mission to query the child Task, enumerate artifacts, read the child's current Completion Decision, publish a compact evidence-authority digest, and call `panel.complete_mission` using the exact read completion-decision locator.

### M04 Acceptance

Required common evidence:

- `caseID` is `m04`.
- Backend base URL is a random loopback port.
- `/global/health` database path is under the run-specific isolated runtime root.
- Provider preflight for native `deepseek/deepseek-v4-flash` returns connected.
- First wake creates a Mission; second wake resumes the same Mission and Session.
- Session messages include completed `mission_skill` with `name === "general"`.
- Session messages include completed `panel.create_task` with a `task_id`, and `/mission/:missionID/status.tasks` exposes that exact child Task.
- Mission status is `inactive` with `activity.running === 0`.

M04-specific evidence:

- Completed `panel.query_task` for the created child Task.
- Completed `panel.query_task_artifacts` for the created child Task.
- Completed `panel.read_task_artifact` for a child `task_completion_decision` locator, with `complete === true`, `next_offset === null`, and parsed `text` containing non-empty `evidence_locators` or `deliverable_artifact_locators`.
- Completed `publish_interactive_artifact`.
- Completed `panel.complete_mission` returns `kind: "mission_completed"` and its `task_acceptances` include the same child Task ID and the same completion-decision locator that was read.
- Project archive and shutdown lifecycle complete; Bun process exits `0`.

Risk controls:

- Scope implementation to `packages/opencorvus/script/benchmark/mission-random-port-e2e.ts`; do not change product behavior unless the benchmark reveals a real product bug.
- Keep M01-M03 prompts and acceptance semantics intact except for shared helper extraction that preserves current behavior.
- Leave unrelated provider redaction worktree changes out of this case.

Accepted M04 evidence:

- Artifact: `specs/artifacts/2026-08-09-mission-random-port-e2e/m04-mslmlglg.json`.
- Case ID: `m04`; model ref: `deepseek/deepseek-v4-flash`.
- Random-port backend: `http://127.0.0.1:63644/`.
- Provider preflight: native `deepseek`, model `deepseek-v4-flash`, `ok: true`, `status: connected`.
- Mission settled: `status: inactive`, `activity.running: 0`.
- Project archive: HTTP `200`, 41,474 bytes.
- Tool evidence counts in the artifact include `mission_skill`, `create_task`, `query_task_artifacts`, `read_task_artifact`, `query_task`, `publish_interactive_artifact`, and `mission_completed`.
- Child Task: `tsk_g019fe5f2f0ad000000000000tU2sYtoyV3jVmS`.
- Completion-decision locator from `query_task_artifacts`: `art_g019fe5f41d20000000000000aSwFXkOxzNo0oq`, catalog revision `6`, SHA-256 `8271a21e562ce4544d6d4a3ff9cda98699190e0a79c5219d3eae3bc2badec075`.
- `read_task_artifact` read that exact locator with `complete: true`, `next_offset: null`; parsed completion-decision payload had one `evidence_locators` entry and one `deliverable_artifact_locators` entry.
- `panel.complete_mission` returned `mission_completed` and cited the same completion-decision artifact ID.
- Shutdown: `Server.beginRuntimeTransfer`, `terminateCurrentProcessOwnedExecution`, `releaseRuntimeHandoff`, `Scheduler.disposeGlobal`, `Instance.disposeAll`, `Database.close`, and `Log.close` all recorded `completed`.
- Verdict: `{ "status": "accepted", "failures": [] }`; Bun process exited `0`.

## ABSA Mission observation: no host execution intervention

The user clarified the operating boundary for the ABSA Mission: do not interfere with the OpenCorvus execution process; auxiliary preparation and observation are allowed. After that clarification, the host observer did not answer Mission questions, send retry/resume, patch the isolated ABSA project, manually run training, or start independent validation inside the isolated ABSA project.

Observed ABSA Mission state:

- Isolated backend remained `http://127.0.0.1:59477/` with UI `http://127.0.0.1:59477/ui/`.
- Runtime root remained `C:\Users\hengu\AppData\Local\Temp\opencorvus-absa-installed-creds-1786262282244\runtime-root`.
- Project remained `C:\Users\hengu\AppData\Local\Temp\opencorvus-absa-installed-creds-1786262282244\project`.
- The Mission continued to use provider `openai` and model `gpt-5.6-sol` after installed credentials/catalog were copied into the isolated runtime.
- `pendingQuestions` was repeatedly `0`.

First implementation-engineer pass reached a committed and artifact-published deliverable with these OpenCorvus-reported results:

- Real pinned `yangheng/deberta-v3-base-absa-v1.1` model preflight succeeded against snapshot `10c9dff335a44073e1352360c3a7bc54dc58eb01`.
- Baseline Macro F1 was `0.535714`.
- `iteration-001` Macro F1 was `0.738095` after 7 optimizer steps.
- `iteration-002` kept Macro F1 `0.738095` and reduced test loss to `0.202464`.
- Live Uvicorn API loaded `iteration-002`, returned a Positive prediction, and returned HTTP `422` for an invalid aspect.
- The implementation report said no remote was configured or pushed.

Independent OpenCorvus review did not accept the deliverable:

- `test-engineer`: **Non-pass**. All three SQLite `config_json` rows omitted current runtime/split fields such as `selection_split`, `evaluation_split`, `python`, `torch`, `device`, `cpu_count`, and `torch_threads`; all three run result artifacts omitted `validation_metrics`, although current `run()` writes them.
- `interface-integrity-reviewer`: **blocked** with six blocking findings: executable HTML injection/XSS through `innerHTML`, whitespace-only prediction inputs returning HTTP `200`, monitor error state not recovering after a successful same-version refresh, horizontal overflow at 430px, `iteration-001` checkpoint references overwritten by `iteration-002`, and absent canonical rendered screenshots/full refresh evidence.
- `visual-reviewer`: **Not accepted**. Populated monitor still displayed the large loading panel at 1440x900 and 430x900; invalid aspect left stale previous inference result visible; auto-refresh of a newly completed SQLite run was not safely verified; Browser Preview failed twice with Windows supervisor `CreateProcessW win32 87`, so no screenshot-bearing Browser Preview artifacts were produced.
- `system-integrity-reviewer`: **Needs correction**. Fresh-checkout model runtime failed importing `sentencepiece._sentencepiece` with a DLL error, normal live API inference returned HTTP `503` in that environment, `verify_acceptance.py --require-rendered-evidence` failed because canonical rendered evidence was absent, and milestone chronology remained unproven.

OpenCorvus then automatically continued the same `implementation-engineer` session instead of creating a second implementation occurrence. The repair plan it reported included:

- Upgrade `sentencepiece` from `0.2.0` to `0.2.1` after validating the candidate Windows wheel in a fresh Python 3.11 probe.
- Re-lock dependencies.
- Persist validation/runtime configuration and immutable checkpoint hashes in SQLite v2.
- Use `delivered.json` only as an explicit checkpoint pointer.
- Pre-clean API strings, add Content Security Policy and favicon handling.
- Add strict generated-artifact reset, milestone records, reversible refresh fixtures, and project-contained browser screenshots.

Current blocker at this record update:

- Mission `9dc670ced14073ce` is still `running`.
- The original `implementation-engineer` session `ses_-fe601a5ce94effffffffffffOaG4DuKCYBaFT4` is stuck at message `msg_g019fe5de5b55000000000000ra4LDMgShJFlXz`.
- The last tool remains `apply_patch:running` for the large repair patch described above.
- This same state persisted through multiple read-only polling windows from `2026-08-09T17:34:48+08:00` through `2026-08-09T17:41:42+08:00`.
- No host-side retry, cancellation, manual patch, or validation command was sent after the user's no-interference clarification.

## ABSA Mission recovery: LSP disabled before scheduler restoration

The user later authorized intervention to disable Language Server Protocol (LSP) in the formal environment and restore scheduling. The root cause under investigation was the OpenCorvus `apply_patch` tool hanging after file writes while pruning an idle Pyright LSP client through the Windows process supervisor disposal path.

Planned recovery scope:

- Preserve all LSP code and dependencies; disable LSP only through configuration.
- Add `"lsp": false` to the formal OpenCorvus configuration at `C:\Users\hengu\AppData\Local\opencorvus\.opencorvus\opencorvus.jsonc`.
- Keep the isolated ABSA project and random-port Mission harness on `"lsp": false`.
- Restore the currently blocked Mission scheduler with the smallest runtime intervention that releases the hung LSP shutdown path, without killing the main OpenCorvus backend or browser MCP process unless that smaller intervention fails.

Recovery result:

- Formal OpenCorvus configuration now includes `"lsp": false` at `C:\Users\hengu\AppData\Local\opencorvus\.opencorvus\opencorvus.jsonc`.
- The isolated ABSA project configuration includes `"lsp": false`.
- The random-port Mission harness sets `OPENCORVUS_CONFIG_CONTENT.lsp` to `false` for future isolated Mission E2E runs.
- The first minimal intervention terminated the hung Pyright LSP process and allowed the previous `apply_patch:running` message to advance, but the old backend still reused initialized LSP state and spawned new Pyright processes.
- The old isolated OpenCorvus backend and its OpenCorvus-owned LSP/browser helper processes were then stopped; the ABSA project directory, runtime database, copied credential files, and Uvicorn experiment server were preserved.
- A replacement isolated OpenCorvus backend was started on `http://127.0.0.1:49476/` with `openai/gpt-5.6-sol` and `lsp: false`.
- `GET /lsp` on the replacement backend returned `[]`, and process inspection showed no `pyright-langserver`.
- `POST /mission/wake` with existing Mission ID `9dc670ced14073ce` returned `created: false`, restoring the original Mission session instead of creating a new Mission.
- After restoration, Mission activity was `running`, pending questions were `0`, and the implementation session advanced past the previous stuck `apply_patch`; subsequent ABSA project changes appeared in `src/absa/db.py`, `src/absa/experiment.py`, `src/absa/modeling.py`, and `src/absa/web.py`.

## M05 Plan: bounded no-child Mission completion

### Recall

User objective:

- Continue random-port dev backend Mission E2E testing and debugging with a different case each time.
- Use isolated databases and `deepseek/deepseek-v4-flash` from the system environment key.
- Do not interfere with a running case unless it is stuck.
- Before every code change, use an independent agent to investigate depth and impact.
- Avoid trading one path for another; preserve existing covered cases.

Already covered cases:

- M01: Mission introduction, `@mission("general")`, state, child Task creation, resume, publish evidence.
- M02: read-only inventory, child artifact reconciliation, publish, and `panel.complete_mission`.
- M03: live repair of failing fixture, child testing, final `npm test`, and baseline-to-final diff.
- M04: resume evidence authority with exactly one child Task, `query_task_artifacts`, complete `task_completion_decision` read, publish, and `complete_mission` using the exact read locator.

Read sources and searches:

- `packages/opencorvus/script/benchmark/mission-random-port-e2e.ts` current M01-M04 harness.
- `packages/opencorvus/src/prompt/core/mission-core.txt` line 314 states a bounded Mission with no child Task supplies an empty `task_acceptances` list.
- `packages/opencorvus/src/tool/panel.ts` validates `complete_mission` against the complete current child Task set, so an empty current set with empty acceptances exercises the real host contract.
- `specs/records/2026-08/2026-08-09-mission-random-port-e2e-loop.md` current M01-M04 evidence and constraints.

Independent agent feedback:

- Read-only agent `019fe61f-6cd5-7a13-807e-2cbb9ecc7266` recommended M05 as a bounded no-child Mission.
- It identified the main harness conflict: current `evaluate()` and `waitForEvidence()` globally require a created child Task, which must become per-case without weakening M01-M04.
- It recommended keeping M05 live-only, not adding mock-provider scripted responses, and verifying real Mission tool evidence: `mission_skill`, `glob`, `read`, `mission_state`, `publish_interactive_artifact`, and `panel.complete_mission` with empty `task_acceptances`.

### M05 Input

- Start the dev backend on an OS-assigned random loopback port with a run-specific isolated `OPENCORVUS_HOME`.
- Use native `deepseek/deepseek-v4-flash`; reject mock provider mode for M05.
- Create the existing tiny fixture project.
- First wake uses `@mission("general")` and explicitly asks for a bounded no-child Mission:
  - do not create a child Task;
  - use Mission's own `glob` to locate `package.json`;
  - use Mission's own `read` to read `package.json`;
  - write Mission state;
  - publish a compact artifact;
  - call `panel.complete_mission` with `task_acceptances: []`.
- Second wake resumes the same Mission and asks it to finish the same no-child flow if it has not already done so.

### M05 Acceptance

Common evidence:

- `caseID` is `m05`.
- Backend base URL is a random loopback port.
- `/global/health` database path is under the run-specific isolated runtime root.
- Provider preflight for native `deepseek/deepseek-v4-flash` returns connected.
- First wake creates a Mission; second wake resumes the same Mission and Session.
- Session messages include completed `mission_skill` with `name === "general"`.
- Mission status is `inactive` with `activity.running === 0`.
- Project archive returns HTTP `200` and non-zero bytes.

M05-specific evidence:

- `/mission/:missionID/status.tasks` is an empty current child Task set.
- No completed `panel.create_task` created a child Task.
- Completed `glob` searched for `package.json` and returned a path containing `package.json`.
- Completed `read` read `package.json` and output includes `mission-random-port-e2e-fixture` and `node test.js`.
- Completed `mission_state` write persisted a state file.
- Completed `publish_interactive_artifact`.
- Completed `panel.complete_mission` returns `kind: "mission_completed"` and its input `task_acceptances` is exactly an empty array.

Risk controls:

- Scope implementation to `packages/opencorvus/script/benchmark/mission-random-port-e2e.ts`.
- Preserve M01/M02 mock provider path and M03/M04 live behavior.
- Do not add host gates, fallbacks, or product behavior changes.
- Keep unrelated provider redaction worktree changes out of this case.

### M05 Accepted Evidence

- Artifact: `specs/artifacts/2026-08-09-mission-random-port-e2e/m05-mslolb9o.json`.
- Case ID: `m05`; model ref: `deepseek/deepseek-v4-flash`.
- Random-port backend: `http://127.0.0.1:64617/`.
- Provider preflight: native `deepseek`, model `deepseek-v4-flash`, `status: connected`.
- Mission settled: `status: inactive`, `activity.running: 0`.
- Current child Task set: empty (`tasks: []`); no `panel.create_task` tool call occurred.
- Project archive: HTTP `200`, 17,218 bytes, 5 files.
- Mission tool evidence:
  - completed `mission_skill` for `general`;
  - completed `glob` with `pattern: "package.json"`, returning the isolated project `package.json`;
  - completed `read` of that `package.json`, with output containing `mission-random-port-e2e-fixture` and `node test.js`;
  - completed Mission state writes for `frontier.md`, `tasks.md`, `notes.md`, and `handoff.md`;
  - completed `publish_interactive_artifact`;
  - completed `panel.complete_mission` with input `task_acceptances: []` and output `kind: "mission_completed"`.
- Verdict: `{ "status": "accepted", "failures": [] }`; Bun process exited `0`.

## Case M05 plan: read-only test contract map

### Recall

User request remains the same: keep running distinct random-port, isolated-database Mission E2E cases with `deepseek/deepseek-v4-flash`, cover small but different surfaces, do not interfere with in-progress cases unless stuck, and use independent read-only impact analysis before edits.

Current accepted live evidence before M05:

- M01 covered Mission introduction, general Mission Skill loading, Mission state, child Task dispatch, resume, and artifact/publish surfaces.
- M02 covered read-only inventory plus child completion-decision evidence reconciliation.
- M03 covered real implementation repair with final `npm test` and baseline-to-final source diff.
- M04 covered resume evidence authority: querying the child Task, enumerating artifacts, reading the child `task_completion_decision`, publishing, and completing the Mission with the exact read locator.

Independent read-only agent `019fe61d-e911-77c1-b849-81266e35ead3` confirmed the current script still retained the historical mock provider path and recommended a fifth case covering "skill/tool selection + no child replacement + state continuity" without fallback or mock behavior.

### M05 Input

- Start the dev backend on an OS-assigned random loopback port with a run-specific isolated `OPENCORVUS_HOME`.
- Use native `deepseek/deepseek-v4-flash`; reject any `MISSION_RANDOM_PORT_E2E_MOCK_PROVIDER` and any non-DeepSeek model override before backend startup.
- Submit first `/mission/wake` with `@mission("general")` and `@squad("base")`, asking Mission to introduce the plan, load the general Mission Skill, write Mission state, and create exactly one child Task using `promptProfile base`.
- The child Task must read only `package.json` and `test.js`, produce a concise `test-contract-map` Task artifact reporting package name, npm test script, imported module path, exported function under test, and expected assertion value, and must not modify files or run `npm test`.
- Submit resume `/mission/wake` asking Mission to query the single child Task, enumerate artifacts, completely read the current child `task_completion_decision`, publish a compact test-contract-map digest, and call `panel.complete_mission` using the exact completion-decision locator read in the same turn.

### M05 Acceptance

- `caseID` is `m05`.
- Backend base URL is a random loopback port and `/global/health` reports the database under the run-specific isolated runtime root.
- Provider preflight for native `deepseek/deepseek-v4-flash` returns connected.
- First wake creates a Mission; second wake resumes the same Mission and Session.
- Session messages include completed `mission_skill` with `name === "general"`.
- Exactly one child Task is created and is exposed in Mission status.
- Resume evidence includes completed `panel.query_task`, `panel.query_task_artifacts`, completed `panel.read_task_artifact` for the child `task_completion_decision`, completed `publish_interactive_artifact`, and completed `panel.complete_mission` returning `mission_completed` while citing the exact locator read.
- Mission status is inactive, project archive exists, shutdown lifecycle completes, and the Bun process exits `0`.

## M06 Plan: Mission Skill supporting file and state resume

### Recall

User objective remains:

- Continue distinct random-port dev backend Mission E2E cases.
- Use isolated databases and `deepseek/deepseek-v4-flash`.
- Do not interfere with running cases unless stuck.
- Use independent agent investigation before each code change.
- Preserve prior paths instead of trading one case off against another.

Already accepted live cases:

- M01: intro, `@mission("general")`, Mission state, child Task, resume, publish.
- M02: inventory, child artifact reconciliation, publish, complete.
- M03: live repair and `npm test`.
- M04: child `task_completion_decision` exact read locator authority.
- M05: bounded no-child Mission with Mission-owned `glob/read` and empty `task_acceptances`.

Read sources and searches:

- `packages/opencorvus/script/benchmark/mission-random-port-e2e.ts` current M01-M05 harness.
- `packages/opencorvus/src/tool/skill.ts` documents `mission_skill` `file` as a forward-slash relative supporting-file path requiring `name`.
- `packages/opencorvus/src/mission-skill/builtin-payload.ts` shows built-in `general` includes `agents/openai.yaml`.
- `packages/opencorvus/src/prompt/core/mission-core.txt` preserves the no-child `complete_mission` contract with empty `task_acceptances`.

Independent agent feedback:

- Read-only agent `019fe62a-887d-7d22-8d83-4807a05e00cf` confirmed M06 is distinct and minimal.
- It recommended M06 focus on progressive Mission Skill disclosure: first load `general`, then load supporting file `agents/openai.yaml`, and verify cross-wake `mission_state` write/list/read.
- It warned to keep M05's project `glob/read` checks case-specific and only generalize no-child handling for M05/M06.

### M06 Input

- Start the dev backend on an OS-assigned random loopback port with a run-specific isolated `OPENCORVUS_HOME`.
- Use native `deepseek/deepseek-v4-flash`; reject mock provider mode for M06.
- First wake uses `@mission("general")` and asks Mission to:
  - load the base `general` Mission Skill;
  - call `mission_skill` again with `name: "general"` and `file: "agents/openai.yaml"`;
  - write `frontier.md`, `tasks.md`, and `notes.md` with an `M06-SKILL-FILE` marker;
  - create no child Task and use no `@squad`;
  - avoid project modifications and test execution.
- Second wake resumes the same Mission and asks Mission to:
  - `mission_state list`;
  - read prior state containing `M06-SKILL-FILE`;
  - publish a compact skill/state digest;
  - call `panel.complete_mission` with `task_acceptances: []`.

### M06 Acceptance

Common evidence:

- `caseID` is `m06`.
- Backend base URL is a random loopback port and health uses the isolated database.
- Provider preflight for native `deepseek/deepseek-v4-flash` returns connected.
- First wake creates a Mission; second wake resumes the same Mission and Session.
- Mission status is `inactive` with `activity.running === 0`.
- Project archive returns HTTP `200` and non-zero bytes.

M06-specific evidence:

- Completed base `mission_skill` call with input `name: "general"` and no `file`.
- Completed supporting-file `mission_skill` call with input `name: "general", file: "agents/openai.yaml"`.
- Supporting-file output contains `default_prompt` or `General Mission`.
- Completed `mission_state` writes for `frontier.md`, `tasks.md`, and `notes.md`, with the `M06-SKILL-FILE` marker in at least one write.
- Completed `mission_state` list call is present.
- Completed `mission_state` read output includes `M06-SKILL-FILE`, proving the Mission read persisted state after the required writes.
- No completed `panel.create_task` created a child Task, and current Mission status tasks are empty.
- Completed `publish_interactive_artifact`.
- Completed `panel.complete_mission` returns `kind: "mission_completed"` with input `task_acceptances: []`.

Risk controls:

- Scope implementation to `packages/opencorvus/script/benchmark/mission-random-port-e2e.ts`.
- Keep M06 live-only while preserving the existing M01/M02 mock provider path.
- Do not weaken M01-M04 child Task checks.
- Do not change product behavior or add host fallback/gates.
- Keep unrelated provider redaction worktree changes out of this case.

### M06 Failure Investigation and Fix

- Artifact `specs/artifacts/2026-08-09-mission-random-port-e2e/m06-mslph9vl.json` rejected with `mission evidence quiet timeout; missing: M06 no-child case evidence`.
- Independent read-only agent `019fe638-6ecc-7091-9dbe-a1681fbbb5ae` found the remaining missing subcondition was `stateReadMarker`: the second wake listed empty state, wrote the state itself, published, and completed without reading the marker back.
- Direct failure trigger: the harness sent the M06 resume wake after a fixed sleep, before the first wake had written durable state.
- Root cause: harness sequencing, not product behavior. The second wake sometimes became the writer instead of the read-back verifier.
- Scoped fix: keep M06-specific read-back strict by requiring reads of `frontier.md`, `tasks.md`, and `notes.md` containing `M06-SKILL-FILE`; add an M06-specific first-wake wait for base skill load, supporting-file load, and three state writes before issuing the second wake; preserve M01/M02 mock provider behavior.

### M06 Accepted Evidence

- Artifact: `specs/artifacts/2026-08-09-mission-random-port-e2e/m06-mslpurj4.json`.
- Case ID: `m06`; model ref: `deepseek/deepseek-v4-flash`.
- Random-port backend: `http://127.0.0.1:54669/`.
- Provider preflight: native `deepseek`, model `deepseek-v4-flash`, `status: connected`.
- Mission settled: `status: inactive`, `activity.running: 0`.
- Current child Task set: empty (`tasks: []`); no `panel.create_task` tool call occurred.
- Project archive: HTTP `200`, 19,229 bytes.
- Mission Skill evidence:
  - completed base `mission_skill` with input `{ "name": "general" }`, output containing `General Mission`;
  - completed supporting-file `mission_skill` with input `{ "name": "general", "file": "agents/openai.yaml" }`, output containing `default_prompt` and `General Mission`.
- Mission state evidence:
  - completed writes for `frontier.md`, `tasks.md`, and `notes.md`, each carrying `M06-SKILL-FILE`;
  - completed `mission_state list`;
  - completed reads for `frontier.md`, `tasks.md`, and `notes.md`; each read contains `M06-SKILL-FILE`.
- Completed `publish_interactive_artifact` evidence occurred during the live run.
- Completed `panel.complete_mission` with input `task_acceptances: []` and output `kind: "mission_completed"`.
- Verdict: `{ "status": "accepted", "failures": [] }`; Bun process exited `0`.

## M07 Plan: cross-Task artifact import

### Recall

User objective remains:

- Continue distinct random-port dev backend Mission E2E cases.
- Use isolated databases and native `deepseek/deepseek-v4-flash`.
- Do not interfere with running cases unless stuck.
- Use independent agent investigation before each code change.
- Preserve prior paths instead of trading one case off against another.

Already accepted live cases:

- M01: Mission creation, `@mission("general")`, state write, child Task creation, resume, artifact/archive evidence.
- M02: read-only child inventory, child artifact reconciliation, explicit `publish_interactive_artifact`, `panel.complete_mission`.
- M03: live fixture repair, child execution, final `npm test`, source diff verification.
- M04: evidence authority for one child Task: `query_task`, `query_task_artifacts`, complete `read_task_artifact`, exact read locator in `complete_mission`.
- M05: bounded no-child Mission with Mission-owned `glob/read`, state write, publish, empty `task_acceptances`.
- M06: Mission Skill progressive disclosure via supporting file `agents/openai.yaml`, cross-wake `mission_state` list/read, publish, empty `task_acceptances`.

Read sources and searches:

- `packages/opencorvus/script/benchmark/mission-random-port-e2e.ts` current M01-M06 harness.
- `packages/opencorvus/src/tool/panel.ts` shows `panel.create_task.artifact_imports` is Mission-only and returns committed `artifact_imports` mappings.
- `packages/opencorvus/src/panel/capability.ts` describes `artifact_imports` as exact predecessor `ArtifactReadLocator` values selected from `panel.query_task_artifacts` and imported through target-owned publication.
- `packages/opencorvus/src/engine/cross-task-artifact-import.ts` normalizes and validates `source_task_id` plus exact source locator sets.

Independent agent feedback:

- Read-only agent `019fe64d-9e77-70d0-9f3b-ea90083080f0` recommended M07 as a two-child staged artifact-import Mission.
- It identified cross-Task artifact import as the main uncovered small surface after M01-M06.
- It warned that M07 needs staged waits so the downstream Task is not requested before upstream artifact evidence exists, and final Mission completion must still use current child-set evidence rather than stale state.

### M07 Input

- Start the dev backend on an OS-assigned random loopback port with a run-specific isolated `OPENCORVUS_HOME`.
- Use native `deepseek/deepseek-v4-flash`; reject mock provider mode for M07.
- First wake uses `@mission("general")` and `@squad("base")` and asks Mission to create exactly one upstream read-only child Task:
  - upstream Task reads `package.json` and `test.js`;
  - upstream Task publishes or completes with a concise durable artifact describing package name, test script, and assertion;
  - no project files are modified and `npm test` is not run.
- Second wake resumes the same Mission and asks Mission to:
  - query the upstream Task;
  - enumerate upstream artifacts with `panel.query_task_artifacts`;
  - completely read one concrete upstream artifact locator;
  - create exactly one downstream child Task with `panel.create_task.artifact_imports` using the upstream `task_id` and exact read locator;
  - keep upstream artifact body out of the downstream request prose.
- Third wake resumes the same Mission and asks Mission to:
  - query both child Tasks;
  - enumerate and read current completion-decision evidence for both Tasks;
  - publish a compact import topology digest;
  - complete the Mission with exactly both current child Tasks accepted.

### M07 Acceptance

Common evidence:

- `caseID` is `m07`.
- Backend base URL is a random loopback port and health uses the isolated database.
- Provider preflight for native `deepseek/deepseek-v4-flash` returns connected.
- First wake creates a Mission; second and third wakes resume the same Mission and Session.
- Mission status is `inactive` with `activity.running === 0`.
- Project archive returns HTTP `200` and non-zero bytes.

M07-specific evidence:

- Exactly two child Tasks exist in current Mission status and no more than two `panel.create_task` outputs created Tasks.
- The first created Task is the upstream artifact producer.
- Completed `panel.query_task_artifacts` exists for the upstream Task and exposes at least one structurally valid locator.
- Completed `panel.read_task_artifact` exists for the upstream Task with a locator from the upstream artifact catalog and returns `complete: true`.
- The second created Task is created with input `artifact_imports` containing an item whose `source_task_id` is the upstream Task and whose locator matches the read upstream locator.
- The downstream `panel.create_task` output reports a non-empty `artifact_imports` mapping.
- Final evidence includes completed `panel.query_task` for both current child Tasks, completed `panel.query_task_artifacts`, completed `panel.read_task_artifact` for current completion-decision evidence, completed `publish_interactive_artifact`, and completed `panel.complete_mission`.
- `panel.complete_mission` returns `kind: "mission_completed"` with exactly two `task_acceptances` matching the complete current child Task set.

Risk controls:

- Scope implementation to `packages/opencorvus/script/benchmark/mission-random-port-e2e.ts`.
- Preserve M01/M02 mock provider path and M03-M06 live behavior.
- Do not weaken M04's exact read-locator authority checks; M07 adds import-specific checks.
- Do not add product behavior changes, host gates, fallback acceptance, or mock-provider scripted M07 responses.
- Keep unrelated provider redaction worktree changes out of this case.

### M07 Preflight Blocked Evidence

Run:

- Artifact: `specs/artifacts/2026-08-09-mission-random-port-e2e/m07-mslqk3j6.json`.
- Case ID: `m07`; model ref: `deepseek/deepseek-v4-flash`.
- Random-port backend: `http://127.0.0.1:63096/`.
- Isolated runtime root: `C:\Users\hengu\AppData\Local\Temp\opencorvus-mission-e2e-m07-mslqk3j6\runtime-root`.
- Isolated database: `C:\Users\hengu\AppData\Local\Temp\opencorvus-mission-e2e-m07-mslqk3j6\runtime-root\data\opencorvus.db`.
- Provider preflight: native `deepseek`, model `deepseek-v4-flash`, `ok: false`, `status: error`, HTTP 401 invalid API key.
- Shutdown completed all recorded steps: `Server.beginRuntimeTransfer`, `terminateCurrentProcessOwnedExecution`, `releaseRuntimeHandoff`, `Scheduler.disposeGlobal`, `Instance.disposeAll`, `Database.close`, and `Log.close`.
- `processExecutionSettlement` reported `sessions: 0` and `toolParts: 0`, confirming no Mission wake or Task execution was started after preflight failed.

Current conclusion:

- M07 remains unexecuted rather than product-rejected. The blocker is the current process environment's `DEEPSEEK_API_KEY` being rejected by the native DeepSeek API.
- Independent read-only agent `019fe656-802e-7290-9f47-95f8a06d48a8` confirmed the same impact boundary: random port, isolated database, and script selection are functioning; the direct blocker is provider authentication before `/mission/wake`.
- Do not change M07 to a mock provider, alternate model, alternate provider, global database, or existing backend instance. The next valid M07 run requires a DeepSeek key accepted by `POST /provider/deepseek/test` for `deepseek-v4-flash` in the current shell environment.

### M07 Accepted Evidence

- Artifact: `specs/artifacts/2026-08-09-mission-random-port-e2e/m07-mslqfgvz.json`.
- Case ID: `m07`; model ref: `deepseek/deepseek-v4-flash`.
- Random-port backend: `http://127.0.0.1:53993/`.
- Provider preflight: native `deepseek`, model `deepseek-v4-flash`, `status: connected`.
- Mission settled: `status: inactive`, `activity.running: 0`.
- Current child Task set: exactly two Tasks.
- Project archive: HTTP `200`, 52,664 bytes.
- Created child Tasks:
  - upstream producer: `tsk_g019fe654ee1d000000000000LfCf5X5QlSPkNi`, title `Read package facts artifact`;
  - downstream consumer: `tsk_g019fe656e006000000000000IuWihZjiIFKet5`, title `Consume package facts artifact`.
- Cross-Task import evidence:
  - upstream artifacts were enumerated with completed `panel.query_task_artifacts`;
  - upstream artifact was completely read with completed `panel.read_task_artifact`;
  - downstream `panel.create_task` input used non-empty `artifact_imports`;
  - downstream `panel.create_task` output reported one committed import mapping from upstream artifact locator to imported locator.
- Final reconciliation evidence:
  - completed `panel.query_task_artifacts` occurred four times;
  - completed `panel.read_task_artifact` occurred three times, including completion-decision reads used for final acceptance;
  - completed `publish_interactive_artifact`;
  - completed `panel.complete_mission` with exactly two `task_acceptances` and output `kind: "mission_completed"`.
- Verdict: `{ "status": "accepted", "failures": [] }`; Bun process exited `0`.

Additional live replay:

- Artifact: `specs/artifacts/2026-08-09-mission-random-port-e2e/m07-mslqtbh6.json`.
- Random-port backend: `http://127.0.0.1:56097/`.
- Isolated database: `C:\Users\hengu\AppData\Local\Temp\opencorvus-mission-e2e-m07-mslqtbh6\runtime-root\data\opencorvus.db`.
- Provider preflight returned `ok: true`, `status: connected` for native `deepseek/deepseek-v4-flash`.
- Mission settled inactive with exactly two completed Mission child Tasks, project archive HTTP `200` with 52,215 bytes, no mock provider requests, and verdict `{ "status": "accepted", "failures": [] }`.

## M08 Plan: same-child Task resume

### Recall

User objective remains:

- Continue distinct random-port dev backend Mission E2E cases.
- Use isolated databases and native `deepseek/deepseek-v4-flash`.
- Do not interfere with running cases unless stuck.
- Use independent agent investigation before each code change.
- Preserve prior paths instead of trading one case off against another.

Already accepted live cases:

- M01: Mission creation, `@mission("general")`, state write, child Task creation, resume, artifact/archive evidence.
- M02: read-only child inventory, child artifact reconciliation, explicit `publish_interactive_artifact`, `panel.complete_mission`.
- M03: live fixture repair, child execution, final `npm test`, source diff verification.
- M04: evidence authority for one child Task: `query_task`, `query_task_artifacts`, complete `read_task_artifact`, exact read locator in `complete_mission`.
- M05: bounded no-child Mission with Mission-owned `glob/read`, state write, publish, empty `task_acceptances`.
- M06: Mission Skill progressive disclosure via supporting file `agents/openai.yaml`, cross-wake `mission_state` list/read, publish, empty `task_acceptances`.
- M07: two child Tasks with cross-Task artifact import, downstream import mapping, final dual child acceptance.

Read sources and searches:

- `packages/opencorvus/script/benchmark/mission-random-port-e2e.ts` current M01-M07 harness.
- `packages/opencorvus/src/panel/capability.ts` shows `panel.resume_task` is in the Mission panel capability registry.
- `packages/opencorvus/src/tool/panel.ts` implements `resume_task` as a Mission-owned mutation using exact evidence locators.

Independent agent feedback:

- Read-only agent `019fe665-edc5-75a2-8de3-ae68d223374f` recommended M08 as a same-child Task resume case.
- It identified `panel.resume_task` as the main uncovered small Mission surface after M01-M07.
- It warned to avoid replacement child Tasks, stale pre-resume locators, and fallback actions such as `send_task_message`, `retry_task`, or `replan_task`.

### M08 Input

- Start the dev backend on an OS-assigned random loopback port with a run-specific isolated `OPENCORVUS_HOME`.
- Use native `deepseek/deepseek-v4-flash`; reject mock provider mode for M08.
- First wake uses `@mission("general")` and `@squad("base")`, then asks Mission to create exactly one child Task:
  - child Task reads only `package.json`;
  - child Task produces a concise draft artifact containing `M08-INITIAL-DRAFT`;
  - child Task must not include `M08-RESUME-ADDED`;
  - child Task must not modify files, run tests, or install dependencies.
- Second wake resumes Mission, queries the child Task, enumerates artifacts, completely reads one current locator, then calls `panel.resume_task` for the same child Task using the exact read locator:
  - the resume request asks the same Task to add a concise artifact containing `M08-RESUME-ADDED`;
  - Mission must not create any replacement or additional child Task.
- Third wake resumes Mission after the same Task completes again, queries the same child Task, enumerates and completely reads current artifact evidence containing `M08-RESUME-ADDED`, publishes a compact digest, then completes Mission accepting only that one current child Task with the exact locator read in the same turn.

### M08 Acceptance

Common evidence:

- `caseID` is `m08`.
- Backend base URL is a random loopback port and health uses the isolated database.
- Provider preflight for native `deepseek/deepseek-v4-flash` returns connected.
- First wake creates a Mission; second and third wakes resume the same Mission and Session.
- Mission status is `inactive` with `activity.running === 0`.
- Project archive returns HTTP `200` and non-zero bytes.

M08-specific evidence:

- Exactly one child Task exists in current Mission status and no more than one `panel.create_task` output created a Task.
- Completed `panel.resume_task` exists, returns `kind: "resumed"`, and targets the same child Task.
- The `panel.resume_task` input includes the exact evidence locator completely read earlier in the same Mission turn.
- No completed `panel.create_task` creates a replacement Task after the resume request.
- Completed `panel.read_task_artifact` after the resume returns `complete: true` and output containing `M08-RESUME-ADDED`.
- Final evidence includes completed `panel.query_task`, `panel.query_task_artifacts`, completed `publish_interactive_artifact`, and completed `panel.complete_mission`.
- `panel.complete_mission` returns `kind: "mission_completed"` with exactly one `task_acceptance` matching the complete current child Task set and citing a locator completely read in the final Mission turn.

Risk controls:

- Scope implementation to `packages/opencorvus/script/benchmark/mission-random-port-e2e.ts`.
- Preserve M01/M02 mock provider path and M03-M07 live behavior.
- Do not add product behavior changes, host gates, fallback acceptance, or mock-provider scripted M08 responses.
- Keep unrelated provider redaction worktree changes out of this case.

### M08 Failed Run and Checker Root Cause

- Artifact: `specs/artifacts/2026-08-09-mission-random-port-e2e/m08-mslrevwy.json`.
- Random-port backend: `http://127.0.0.1:58666/`; native `deepseek/deepseek-v4-flash` preflight connected against the run-specific isolated database.
- The same single child Task completed its initial occurrence, was resumed with a completely read rev 5 locator, completed its resumed occurrence, and produced a separate rev 11 artifact containing `M08-RESUME-ADDED`.
- The third wake enumerated the current catalog, completely read the current rev 12 `task_completion_decision`, published, and completed the Mission with exactly that one Task. Mission status became inactive with no running activity.
- The harness nevertheless rejected after a quiet timeout with `M08 case evidence` missing.

Independent read-only agent `019fe676-50a5-7ed3-a4b7-abf9523bcf9b` confirmed this was a checker defect, not a product or prompt failure. Both `m04EvidenceAuthority` and the M08-specific evidence helper collected completion-decision locators through a side-effecting `Array.some()`. The first pre-resume catalog contained an old rev 6 decision, so `some()` stopped and never collected the current rev 12 decision from the final catalog. The exact rev 12 read and successful completion receipt were therefore falsely rejected.

Root fix:

- Completely traverse every matching `panel.query_task_artifacts` result and aggregate every structurally valid completion-decision locator.
- Preserve exact locator matching for complete reads and Mission acceptance; do not add fallback or weaken authority checks.
- Use the generic `M08 case evidence` diagnostic instead of the incorrect `no-child` label.

### M08 Active-Task Timeout Failure

- Artifact: `specs/artifacts/2026-08-09-mission-random-port-e2e/m08-msls3zgj.json`.
- Random-port backend: `http://127.0.0.1:57624/`; native DeepSeek preflight connected against its separate isolated database.
- The run failed before the second wake with `M08 child Task initial stage deadline reached before next wake`.
- At failure, the Task was still active: base-researcher and base-planner had completed, while base-developer had emitted streaming activity 43.8 seconds before the final status sample.
- The harness then entered shutdown and cancelled the still-active execution; the resulting aborted evidence was caused by harness shutdown, not by an earlier product failure.

Independent read-only agent `019fe686-75d1-7e33-af4e-48c488876d58` confirmed the M08 stage helper combined a real 120-second quiet timer with an absolute wall-clock deadline. The deadline could terminate continuously active work before the quiet timer was satisfied, contrary to the benchmark inactivity-timeout contract.

Timeout fix:

- M08 intermediate stages poll indefinitely while canonical activity changes.
- The activity signature includes `/mission/:missionID/activity-cursor`, stable Mission status, Session messages, created Task IDs, and resume evidence.
- `MISSION_RANDOM_PORT_E2E_M08_STAGE_TIMEOUT_MS` is an inactivity duration only, defaults to 120 seconds, and must be positive and finite.
- M08 stage waiting no longer falls back to the whole-run `MISSION_RANDOM_PORT_E2E_TIMEOUT_MS` and has no absolute wall-clock deadline.

### M08 Accepted Evidence

- Artifact: `specs/artifacts/2026-08-09-mission-random-port-e2e/m08-mslsn75d.json`.
- Case ID: `m08`; model ref: native `deepseek/deepseek-v4-flash`.
- Random-port backend: `http://127.0.0.1:50605/`.
- Isolated database: `C:\Users\hengu\AppData\Local\Temp\opencorvus-mission-e2e-m08-mslsn75d\runtime-root\data\opencorvus.db`.
- Provider preflight returned `ok: true`, `status: connected` for provider `deepseek`, model `deepseek-v4-flash`.
- First wake created Mission `0d44fd3a74df2f67`; second and third wakes resumed the same Mission and Session.
- Exactly one child Task existed: `tsk_g019fe68dadbc000000000000PoqgmSnx32Z7th`.
- Completed `panel.resume_task` targeted that same Task, cited the exact rev 5 locator completely read earlier in the same Mission turn, and returned `kind: "resumed"`.
- Final reconciliation completely read the separate resumed rev 11 artifact containing `M08-RESUME-ADDED` and the current rev 12 `task_completion_decision`.
- Completed `panel.complete_mission` accepted exactly the one current Task and cited only the rev 11 and rev 12 locators completely read in the final turn; output returned `kind: "mission_completed"` for the same Mission and Session.
- Completed `publish_interactive_artifact` occurred in the final turn.
- Mission settled `inactive` with `activity.running: 0`.
- Project archive returned HTTP `200` with 59,993 bytes.
- All seven shutdown steps completed; verdict was `{ "status": "accepted", "failures": [] }`; Bun exited `0`.

Independent delivery review `019fe689-adfa-7101-9965-be8562a20c15` found two checker-strength gaps after the accepted run:

- M08 accepted evidence proved final-turn reads, but the helper could have accepted locators read in any post-resume turn.
- M08 accepted evidence proved `resume_task` used the locator just read, but the helper only required a structurally valid locator.

Follow-up fix:

- Add message and part ordering to tool evidence.
- Require successful `panel.resume_task` to cite an exact locator completely read after the previous user wake and before the resume call.
- Require final `panel.complete_mission` to cite only exact locators completely read after the final user wake and before completion, including the current `task_completion_decision`.
- Second independent review confirmed those two gaps were closed, then found the completion-decision check still accepted any historical enumerated decision. The final checker now requires the accepted completion-decision locator to come from a `panel.query_task_artifacts` result in the final user wake before `panel.complete_mission`.

Read-only replay of accepted artifact `m08-msls69mg.json` against those stricter facts:

- successful resume message index: 14; previous user wake index: 9; same-turn complete read revision: 5; `resumeUsesSameTurnRead: true`;
- final completion message index: 25; previous user wake index: 19; accepted revisions: 11 and 12; final-turn reads include resumed marker on revision 11 and completion decision revision 12;
- `finalCompleteUsesOnlyFinalTurnReads: true`; `finalCompleteIncludesDecision: true`.

### M08 Accepted Evidence

- Artifact: `specs/artifacts/2026-08-09-mission-random-port-e2e/m08-msls69mg.json`.
- Case ID: `m08`; model ref: `deepseek/deepseek-v4-flash`.
- Random-port backend: `http://127.0.0.1:61996/`.
- Isolated database: `C:\Users\hengu\AppData\Local\Temp\opencorvus-mission-e2e-m08-msls69mg\runtime-root\data\opencorvus.db`.
- Provider preflight: native `deepseek`, model `deepseek-v4-flash`, `ok: true`, `status: connected`.
- Mission settled: `status: inactive`, `activity.running: 0`.
- Current child Task set: exactly one completed Mission child Task:
  - `tsk_g019fe6819158000000000000uNvhx2PMG43g1h`, title `Package metadata draft`.
- Same-child resume evidence:
  - first wake created exactly one child Task and the initial child artifact contained `M08-INITIAL-DRAFT`;
  - second wake completed `panel.query_task`, `panel.query_task_artifacts`, and complete `panel.read_task_artifact` before calling `panel.resume_task`;
  - one early `panel.resume_task` attempt failed without changing the accepted path, then a completed `panel.resume_task` targeted the same child Task and returned `kind: "resumed"`;
  - the resumed same child Task completed again and produced current artifact evidence containing `M08-RESUME-ADDED`;
  - third wake completed `panel.query_task`, `panel.query_task_artifacts`, and complete `panel.read_task_artifact` on the current resumed evidence and completion decision;
  - completed `publish_interactive_artifact`;
  - completed `panel.complete_mission` returned `kind: "mission_completed"` with exactly one `task_acceptance` for the same child Task and only locators read in the final Mission turn.
- Project archive: HTTP `200`, 50,976 bytes, 5 files.
- Mock provider requests: none.
- Verdict: `{ "status": "accepted", "failures": [] }`; Bun benchmark process exited `0`.

### M08 Hardened Replay Failure Recall

- User requirement remains a native `deepseek/deepseek-v4-flash` end-to-end Mission case on a random-port dev backend with an isolated database, no intervention while the case runs, and root-cause repair only.
- Artifact: `specs/artifacts/2026-08-09-mission-random-port-e2e/m08-msltcf7f.json`; random-port backend `http://127.0.0.1:49215/`.
- The product did not hang: the same single Task resumed successfully, emitted separate `M08-RESUME-ADDED` evidence, completed, and the Mission returned `mission_completed` before settling inactive with no running activity.
- The harness rejected after a real 120-second quiet interval because its resume-stage predicate remained false.
- Independent read-only agent `019fe6a6-6421-7922-b74e-0288b16e37cf` traced the control flow: the initial stage wait observed the child Task terminal state but did not wait for the parent Mission's automatic terminal-update turn to become idle. The harness injected the second operator wake while that turn was still running, splitting artifact enumeration and read/resume evidence across an unintended user-message boundary.
- The same review found that `m08InitialDeliveryValid` treated one model-produced JSON field layout as a public schema even though the case contract only requires observable content and behavior. The failed run used different legitimate field names while preserving all required facts.
- Full-search evidence confirms the product `resume_task` contract requires a current-turn terminal `query_task` and evidence locators completely read in that turn; it does not define the child Artifact's free-form payload keys. The checker must preserve exact locator/read authority without inventing a payload schema.

Root fix and acceptance:

- Do not send an explicit next wake until the required stage evidence is present and the parent Mission reports `inactive` with `activity.running: 0`.
- Preserve same-turn catalog, complete-read, and exact-locator checks for the explicit resume and final completion turns.
- Validate the initial Artifact through complete-read metadata and required observable text facts: `M08-INITIAL-DRAFT`, no `M08-RESUME-ADDED`, `package.json` as the only read input, no repository modification, and no `npm test` execution. Do not require model-authored JSON key names.
- Add focused positive tests for the idle boundary and retain inactivity tests proving activity may continue beyond five minutes.
- Rerun the real M08 case after these changes, then run an independent final delivery review before commit and push.

### M08 Idle-Boundary Replay Finding

- Artifact: `specs/artifacts/2026-08-09-mission-random-port-e2e/m08-msltw794.json`; random-port backend `http://127.0.0.1:52055/`.
- The idle boundary fix worked: the explicit second wake no longer overlapped the first automatic terminal-update turn.
- Independent read-only agent `019fe6c1-4baf-7740-acd8-33d9db33fbbb` found the final stage values were `exactlyOneCompleted: true`, parent Mission idle, successful same-Task resume, and exact same-turn catalog/read locator authority. Only `initialDeliveryValid` remained false.
- The Task's legitimate `base/draft` contained `M08-INITIAL-DRAFT` and the `package.json` summary. Execution-constraint evidence existed in other Task/host evidence, not in that one draft body, so requiring specific natural-language execution disclaimers in the draft was another invented contract.
- Automatic `mission.child_task_result` wakes also advanced the model through resume and completion before the explicit operator wakes. The case text used the ambiguous phrase `next wake`, so the model could not distinguish an automatic status notification from the intended operator phase transition.

Second root fix:

- The initial draft validator covers only the draft's declared observable contract: complete read, `M08-INITIAL-DRAFT`, no `M08-RESUME-ADDED`, and `package.json` content. It does not require a free-form deliverable to duplicate execution telemetry.
- Mission prompts explicitly classify automatic child-result wakes as status notifications that must stop after state reconciliation. Resume and final acceptance are authorized only by later operator messages with distinct first-line labels.
- This remains an LLM prompt/context correction, not a host gate or alternate workflow. Exact catalog/read/resume/completion locators, single-Task identity, archive, and shutdown checks remain unchanged.

### M08 Child Live-Activity Finding

- Artifact: `specs/artifacts/2026-08-09-mission-random-port-e2e/m08-msluxrsq.json`; random-port backend `http://127.0.0.1:60776/`.
- The initial stage correctly retained one active Task and did not send a second wake. It rejected after the Mission durable activity projection remained unchanged for 120 seconds.
- Initial independent artifact review found only the two persisted `streaming` lifecycle events and classified the Task as stalled. A subsequent read-only query of this run's isolated database disproved that classification: the child orchestrator assistant message and its reasoning part were continuously updated until harness shutdown, with 72,152 characters of reasoning still planning the first dispatch.
- Independent agent `019fe6cb-60d0-7743-8a52-7f564e86892e` re-reviewed the database evidence and confirmed the provider stream remained active. The shutdown-created aborted lifecycle and infrastructure artifacts were consequences of the false timeout.
- Root cause: Mission durable activity intentionally tracks persisted boundaries. Reasoning deltas are live Bus events and are not persisted into the part table until a natural boundary. The M08 stage signature observed Mission status, durable activity, and parent messages, but not the child Task's existing live event projection.
- Full-search evidence identifies `/task/:taskID/events` as the current authoritative Server-Sent Events stream for the Task session tree. It carries `message.part.delta` with `live_epoch` and monotonic `live_sequence`; `task.connected` and ten-second `task.heartbeat` are transport events and must not count as work.

Live-activity root fix:

- Subscribe to each created M08 child Task event stream while waiting at an intermediate stage.
- Reset inactivity only for new monotonic child message work events. Ignore heartbeat, connection, replay duplicates, and reconnect itself.
- Retain Mission durable activity, Mission messages, exact stage predicates, and the 120-second inactivity duration.
- Abort and settle subscriptions when the stage returns or fails so the harness owns no leaked stream.
- Add focused reducer tests proving deltas can sustain work past five minutes while heartbeat and duplicate cursors cannot.
