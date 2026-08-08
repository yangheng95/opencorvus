# Machine Learning Implementation Expert Squad end-to-end generation

## Recall

| Item | Record |
| --- | --- |
| User request | End-to-end test the real Generate Agent Squads path and generate one Expert Squad for machine-learning implementation. |
| Acceptance criteria | A real `squad-sdk` Task selects the `sdk-authoring` workflow; the conversation produces one successful canonical authoring receipt; the package is installed beneath this project's `.opencorvus/expert-squads/<namespace>/<id>/`; the installed package is Registry-valid, contains Host-owned Task and scheduler Session generation provenance, appears in the current project catalog, remains inactive, and is visually reviewed in the real Overlay. |
| Hard constraints | Do not handwrite the generated package; do not create a second writer or catalog; preserve `prompt_profile.active` as the only active Squad source; do not activate or execute the generated Squad; do not add, modify, update, or run User Interface (UI) automation tests; preserve unrelated dirty-worktree changes; use Node.js, not Bun, for Playwright-backed interaction. |
| Sources read | `AGENTS.md`; `specs/current/architecture/04-extensions.md`; `specs/records/2026-08/2026-08-06-squad-sdk-expert-squad.md`; `specs/records/2026-08/2026-08-07-squad-sdk-project-generation-trace.md`; `expert-squads/builtin/squad-sdk/README.md`; `selector.md`; and the package-local authoring Skill. |
| Whole-repository search | `squad-sdk` is the sole built-in generator; `expert_squad_author` is the sole authoring write tool; successful generation installs under the current project's `.opencorvus/expert-squads` root with `.opencorvus-meta.json`; generated packages remain inactive until explicitly selected. A static Overlay preview is currently listening on `127.0.0.1:4176`, while no managed OpenCorvus runtime was observed during initial inspection. |
| Independent agent feedback | None. The user did not request sub-agents or parallel audit, so no delegation was started. |

## End-to-end case

### Input

Create one project-owned Expert Squad with the logical identity `machine-learning-implementation`, display name `机器学习实施`, and namespace `local`. It owns implementation of a machine-learning solution from an explicit business objective and available dataset through a reproducible, deployable delivery. Keep the package framework-neutral and compact.

The package must define only these necessary domain workers:

1. A machine-learning solution architect who turns the objective, dataset facts, target metric, constraints, and leakage risks into an implementation contract.
2. A data and training engineer who implements reproducible data preparation, feature logic, training code, configuration, and experiment evidence.
3. A model evaluation reviewer who independently validates metric choice, split strategy, leakage controls, robustness, error analysis, and comparison evidence.
4. A deployment delivery engineer, derived from the Build role, who integrates the accepted model artifact, inference contract, operational documentation, and verification evidence into the final project delivery.

Declare one binding workflow only where evidence order is mandatory: architecture first; training depends on architecture; evaluation depends on training; deployment delivery depends on both training and evaluation. Do not add private tools, Model Context Protocol (MCP) servers, credentials, runtime binaries, hard-coded machine-learning frameworks, a package workflow engine, or a second completion protocol. Preserve ordinary platform Artifact publication and Task completion contracts.

### Expected observable outcome

- The selected Task remains fixed to `squad-sdk` and visibly chooses `sdk-authoring` before dispatch.
- The canonical tool returns `installationScope: "project"`, `id: "machine-learning-implementation"`, the exact installed target, Agent list, workflow-topology receipt, file count, digest, and generation trace.
- The installed manifest and prompt closure match the requested four-worker ownership and dependency graph.
- `.opencorvus-meta.json` identifies `squad-sdk`, the exact Task, scheduler Session, generation time, and authoring method.
- The current project catalog exposes the generated package and provenance, while the active profile remains unchanged.
- A real Overlay screenshot shows the successful conversation receipt or installed-package detail; console review contains no new error caused by this flow.

## Verification log

### Result: failed before Squad execution

The end-to-end acceptance did not generate or install the requested package.

| Evidence | Observed result |
| --- | --- |
| Queue Task | `tsk_fdf157d03001ICYNyAoTMpBlJr`; source `session.prompt_async`; terminal status `failed`; started `1786154155323`; completed `1786154157232`. |
| Session | `ses_020ea8406ffe1vauj79PXw4NGu`; ordinary `assistant` Session in `D:\myhexin-local\opencorvus`; no parent Session. |
| Submitted execution authority | Queue metadata records `agent: "work"` and contains no `squad-sdk` prompt-profile selection. The real Overlay footer likewise shows `Base`, so the Task never held the immutable Generate Agent Squads package revision. |
| Direct terminal trigger | OpenAI returned HTTP 400: `The 'gpt-5.6' model is not supported when using Codex with a ChatGPT account.` The Session ended after about one second, before an Agent response or tool call. |
| Project identity | Although the development server was launched with this checkout as its default project directory, the visible Overlay retained and submitted the already-selected project `D:\myhexin-local\opencorvus` (`project_id: 4b0ea68d7af9a6031a7ffda7ad66e0cb83315750`). It did not submit against this spec's checkout. |
| Artifacts and authoring | No Engine Artifact exists for the Session, `expert_squad_author` was never called, and no receipt, package digest, file count, workflow topology, or generation trace exists. |
| Installed target | Neither `D:\myhexin-local\opencorvus-v0.0.35beta\.opencorvus\expert-squads\local\machine-learning-implementation` nor `D:\myhexin-local\opencorvus\.opencorvus\expert-squads\local\machine-learning-implementation` exists. |
| Visual evidence | [`2026-08-08-machine-learning-squad-e2e-failed.png`](../../artifacts/2026-08-08-machine-learning-squad-e2e-failed.png) shows the real HTTP 400 card, `Base` footer identity, selected project, and unchanged file count. |
| Console review | The initial static preview recorded expected connection failures before the server started. The connected page repeatedly recorded an unrelated persisted-data error: `/global/tasks` returned HTTP 409 because historical Task `tsk_fda0d90cf001AbHmX03FJNGKVm` has no immutable package revision binding. That pre-existing Task-list failure did not trigger the new Session's provider error, but it prevents a clean-console acceptance claim. |

### Causal chain and acceptance impact

The visible catalog row became highlighted during interaction, but the Composer did not materialize that choice into the submitted reference set. Submission therefore created an ordinary Work Session fixed to Base. Independently, the selected model was catalog-visible but incompatible with the active ChatGPT-backed Codex account, so provider validation terminated the Session before the wrong profile could produce any further message. The retained Overlay project selection also pointed the request at a different checkout from the intended acceptance target.

These are three separate failed preconditions: exact project identity, immutable Squad selection, and executable model authority. The missing package, receipt, provenance, catalog entry, and installed-package visual review are downstream consequences. A replacement Task is intentionally not created to conceal this failed run; correcting the initial selection requires a new Task identity, which would be a separate acceptance attempt rather than continuation of this case.

### Authorized second attempt

The operator subsequently authorized a separate attempt with the instruction `用deepseek测试`. This authorizes one new Task identity using an actually configured DeepSeek model while preserving the failed Task and Session above. Before submission, the second attempt must visibly prove the exact `opencorvus-v0.0.35beta` project, a materialized `Generate Agent Squads` selection, and the DeepSeek model identity. Its outcome and lineage are recorded separately below rather than replacing the first attempt.

### DeepSeek attempt result: provider passed, Task creation failed

The second attempt also did not generate or install the requested package.

| Evidence | Observed result |
| --- | --- |
| Provider preflight | `POST /global/providers/deepseek/test` with `modelID: "deepseek-v4-pro"` returned HTTP 200 with `ok: true`, `status: "connected"`, and `message: "Provider is reachable."` |
| Submitted identity | Mission Session `ses_020d01265ffewr4eOkR0t0N0Xj`, Mission `8cebf475bb23db20`, project `d5092f51a79f407ebbd139acdf68401c3ac50cd2`, directory `D:\myhexin-local\opencorvus-v0.0.35beta`, visible Squad IDs `["squad-sdk"]`, model `deepseek/deepseek-v4-pro`. |
| Workflow selection | DeepSeek inspected the Expert Squad catalog and selected the declared `sdk-authoring` workflow. It mapped Source Analysis, Blueprint, and Contract Review plus Authoring to three Mission stages. |
| First contract error | The Mission first attempted `mission_skill` with `squad-sdk`; the tool correctly rejected it because the compatible Mission skill was `general`. The Mission then used the catalog and recognized that `expert_squad_author` is Task-only. |
| Task creation | Both `panel.create_task` attempts used `promptProfile: "squad-sdk"` and the correct checkout directory, but failed before Task persistence. The typed tool error was `Execution Capsule tree contains a non-regular entry: node_modules/.bun/@actions+artifact@5.0.1/node_modules/@actions/core`. |
| Persisted Task evidence | The current project's `engine_task` query returned an empty set. No Task identity, Task Session, Artifact, authoring receipt, package digest, or generation trace was created. |
| Unsafe recovery and containment | After the capsule error, DeepSeek replaced one dependency symlink and began a broad `.bun` symlink replacement command. This was outside the generation contract. The operator-side harness aborted the exact Mission Session through the directory-scoped Session abort endpoint; the open Bash tool ended with typed `MessageAbortedError` and cancellation source `session.abort`. |
| Dependency restoration | The ignored `node_modules` dependency tree was reinstalled from the existing frozen `bun.lock` using the public npm registry after stopping the two acceptance-owned runtime processes that held package files. The final install check reported no changes, and imports required by the OpenCorvus package, including `hono`, `zod`, and `sharp`, succeeded. |
| Installed target | `D:\myhexin-local\opencorvus-v0.0.35beta\.opencorvus\expert-squads\local\machine-learning-implementation` was not created. |
| Visual evidence | [`2026-08-08-machine-learning-squad-deepseek-failed.png`](../../artifacts/2026-08-08-machine-learning-squad-deepseek-failed.png) shows the real Mission conversation, the two Task creation attempts, the symlink blocker, and the contained bulk command. |

### DeepSeek causal chain and acceptance impact

DeepSeek itself was reachable and ran the Mission, so provider selection was not the terminal cause in the second attempt. The first non-recoverable product boundary was Execution Capsule construction: the Task creator traversed the project's Bun-managed dependency tree and rejected a valid directory symlink as a non-regular entry. Consequently, no immutable `squad-sdk` Task was persisted and the Task-only canonical authoring tool could never run.

The Mission then misclassified a capsule ownership defect as a project dependency defect and attempted to rewrite generated dependencies. That action could not repair the capsule traversal contract and risked damaging the working toolchain, so the exact Session was deliberately aborted. The package remains absent and all downstream acceptance surfaces—canonical receipt, project provenance, Registry validity, catalog visibility, inactive-state confirmation, and installed-package visual review—remain unverified and incomplete.

## Repair plan

### Recall

| Item | Record |
| --- | --- |
| User correction | The prior response did not provide a proven cause or implement a solution. Diagnose the ownership fault, repair it, and rerun the DeepSeek end-to-end case. |
| Proven call chain | `panel.create_task` → Task creation transaction → `prepareTaskProcessBinding` → `executionCapsuleSourceTreeDigest` → physical recursive traversal in `execution-capsule/tree-digest.ts`. |
| Structural cause | Creation-time source identity scans every physical entry except OpenCorvus runtime paths, while the later Engine Git baseline uses `git ls-files --cached --others --exclude-standard`. Ignored generated dependencies therefore enter only the creation digest, and a valid Bun directory link is rejected before a Task can be persisted. |
| Required correction | Define the source snapshot from the same closed Engine Git enumeration used by checkpointing. Include tracked and non-ignored source files, represent selected symbolic links by their link-target bytes without following them, preserve deterministic sorting, and keep unsupported selected filesystem entries fail-closed. |
| Positive verification | A real Git fixture with tracked source, non-ignored source, an ignored Bun-style dependency link, and a tracked link must produce the complete expected snapshot and stable digest. Then the original Task creation path must cross the prior failure point in the real project. |
| UI boundary | No UI automation test will be added or run. The final Overlay acceptance remains a one-time real-page interaction and manually reviewed screenshot. |

## Second root-cause repair

### Recall

- The repaired source digest allowed the same DeepSeek Mission to create Task `tsk_fdf431e8e001ZUvf77w5c5jsDj` with immutable `squad-sdk` and native-process bindings.
- The first `sdk-authoring/source-analysis` dispatch then created Task-owned child Session `ses_020b46953ffeowlxcQfcEKC2rF` and failed before the Agent stream started with `durable Task ownership but no explicit runtime Task authority`.
- The required outcome remains one real DeepSeek-generated, installed, selectable machine-learning implementation Expert Squad; creating a replacement Mission or Task is not acceptance.
- The repair must preserve fail-closed Task ownership, must not infer Host/conversation permission, and may test only non-UI contracts. UI acceptance remains real interaction plus manually reviewed screenshots.

### Proven causal chain

1. `runAgentSession` persists the child Session and exposes its Task lineage through `onSessionCreated` before constructing the first worker message.
2. The first call to `materializeUserMessage` occurs before the immutable Worker Turn Descriptor and projected-worker runtime contract can be committed, because that descriptor itself contains the materialized message identity.
3. `materializeUserMessage` previously selected execution authority only from the installed runtime contract. During this one bootstrap occurrence the contract is necessarily absent, so it selected `conversation`.
4. `resolveSessionExecutionAuthority` correctly rejected that selection because durable lineage already proves Task ownership. The failure is therefore an occurrence-authority handoff defect, not a DeepSeek provider error and not a reason to weaken the ownership check.

### Repair

- Resolve the exact Task authority from durable lineage at the projected worker's first-message occurrence boundary.
- Pass that already-verified authority into canonical message materialization, where file and Language Server Protocol (LSP) materialization consume it.
- Validate supplied authority against the exact Session, Project, root directory, and any already-installed runtime Task identity; later message occurrences continue to derive authority from their installed runtime contract.

## Read-only completion audit after the Engine Git repair

The original DeepSeek Mission `8cebf475bb23db20` later completed without operator correction messages, Task replacement, process restart, lock intervention, or manual package edits. The audit remained read-only.

### Operationally successful surfaces

| Surface | Current evidence |
| --- | --- |
| Mission lineage | Source Analysis Task `tsk_fdf431e8e001ZUvf77w5c5jsDj` and Canonical Authoring Task `tsk_fdf685f98001eV6nUwWnwIe1h3` both belong to the original Mission and reached completed terminal status using `squad-sdk` with DeepSeek `deepseek-v4-pro`. |
| Canonical installation | `expert_squad_author` eventually returned a completed project installation receipt for `local/machine-learning-implementation`, version `2026.08.08.1`, 4 Agents, 8 files, digest `7af4f3edc14b61820dd4e578a7f67e70792120c1259afb01bffe07f8688a2ad4`. |
| Provenance | `.opencorvus-meta.json` records generator `squad-sdk`, Task `tsk_fdf685f98001eV6nUwWnwIe1h3`, Session `ses_0208fba0dffezGMv0FzGYULNyk`, timestamp `2026-08-08T03:37:26.881Z`, and method `sdk_authoring`. |
| Catalog and activation | The real Installed Agent Squads page shows `机器学习实施` as a Project package. Project selection and Effective selection both remain `base`; browsing did not activate the generated Squad. |
| Visual review | The real connected Overlay at port 7878 was manually inspected and screenshotted on the installed-package detail. No UI automation test was added or run. |

### Exact acceptance result: incomplete

The package is generated, Registry-visible, selectable, inactive, and provenance-bearing, but the original exact end-to-end contract is not fully satisfied:

1. The requested mandatory graph was architecture → training → evaluation → deployment. The installed manifest instead declares `ml-evaluation.depends_on: ["ml-architect"]`, so training and evaluation are parallel. Deployment still depends on both. This is a material workflow-contract mismatch.
2. The Task transcript contains three `expert_squad_author` occurrences: two error results followed by one completed result. The input explicitly required one canonical authoring call, so the single-call criterion failed even though installation eventually succeeded.
3. The Mission used two completed Tasks—Source Analysis and Canonical Authoring—rather than one Task carrying the full acceptance path. They preserve the original Mission lineage but do not meet a strict one-Task interpretation.
4. Console review is not clean: the connected Overlay repeatedly reports an unrelated historical Task-list HTTP 409 for Task `tsk_fda0d90cf001AbHmX03FJNGKVm`, which has no immutable package revision binding. This did not cause the successful installation, but it prevents a clean-console claim.

No generated package file was hand-edited and no replacement Task was created to conceal these differences. Operational generation is successful; exact end-to-end acceptance remains incomplete.

## Fresh DeepSeek rerun with screen recording

### Recall

- The operator requested one fresh real-page rerun with DeepSeek and a screen recording, with no correction messages, no operator intervention, and no replacement Mission or Task used to conceal a failure.
- The target remained `D:\myhexin-local\opencorvus-v0.0.35beta\.opencorvus\expert-squads\local\machine-learning-implementation`, expected digest `7af4f3edc14b61820dd4e578a7f67e70792120c1259afb01bffe07f8688a2ad4`, target version `2026.08.08.2`.
- Acceptance still required one fixed `squad-sdk` Task, the ordered `sdk-authoring` path, one `expert_squad_author` occurrence, exact four-Agent topology, canonical project installation, and no automatic activation.
- UI evidence was captured from the real connected Overlay as an animated recording. No UI test, fixture, screenshot baseline, database mutation, manual package edit, or replacement Task was created.

### Result

| Evidence | Observed result |
| --- | --- |
| Mission / Task | Mission `cf44908fa7e170d3`, Mission Session `ses_0201cb06affe38xE2yuaBtf63f`; Task `tsk_fdfe43d6c001uIJXzw6e2WD33L`, Task Session `ses_0201bc1d8ffewgCWIVV2OIhsRn`. |
| Model and profile | DeepSeek `deepseek/deepseek-v4-pro`; immutable Task package revision `squad-sdk` `2026.08.07.1`. |
| Immutable project authority | The Task directory, Git workspace, Git directory, and index all remained the anonymous Mission project `C:\Users\hengu\AppData\Local\opencorvus\data\projects\2026\08\08\c7f9d03b-0c53-47e0-ab8c-b26931b15936`, despite later text claiming the directory was corrected. |
| Workflow execution | Source analysis completed, then package architecture and contract review completed. The Orchestrator subsequently looped back through package architecture and contract review a second time, violating the requested single forward order. |
| Review semantics | The first reviewer verdict was `needs_orchestrator_action` because the definition contract was absent. The Orchestrator rewrote that uncertainty as three confirmed invalid roles, instructed a blueprint change, and used its own guidance as evidence in the second `clean` review. |
| Authoring calls | `expert_squad_author` ran three times: array-shaped workflow nodes failed schema validation; record-shaped nodes failed because `description` was missing and unsupported `label` was present; the third call reached CAS and failed. This violates the explicit one-call/no-retry contract. |
| Terminal error | `ExpertSquadPackageMutationConflictError: Expert squad machine-learning-implementation project installation digest is absent, expected 7af4f3edc14b61820dd4e578a7f67e70792120c1259afb01bffe07f8688a2ad4`. |
| Task terminal state | Task lifecycle `failed`; no authoring receipt and no target materialization. |
| Mission reconciliation | The Mission correctly recognized that `resume_task` cannot change the immutable directory, then asked the operator to authorize a replacement Task. No option was selected because the run required unattended execution and prohibited replacement identity. |
| Target package | The target checkout remains version `2026.08.08.1` with its original generation provenance (`tsk_fdf685f98001eV6nUwWnwIe1h3` / `ses_0208fba0dffezGMv0FzGYULNyk`). |

### Causal chain

The New Chat submission created the Mission in an anonymous project before the intended checkout identity was fixed. Task project authority is immutable, so the later directory instruction could only change model-visible text; it could not change the Task worktree or the project-owned install root used by `expert_squad_author`. Source analysis therefore could not directly inspect the target package, review evidence became incomplete, and the final CAS correctly found no installed digest in the anonymous project. Schema-shape mistakes caused two earlier authoring failures, and the Orchestrator retried despite the explicit no-retry contract. The Mission then required new authority for a replacement Task instead of finishing autonomously.

This rerun is a truthful failed acceptance. The root repair must bind the intended project directory before Mission/Task creation and must preserve a tool-error as terminal when the Task contract forbids retry; post-creation messages cannot repair either ownership fact.

## Third root-cause repair: authority, Skill projection, and single authoring contract

### Recall

| Item | Record |
| --- | --- |
| Current user request | Start the repair and eliminate the proven failure chain without affecting unrelated functionality. |
| Acceptance target | A Mission launched from an explicit project keeps that exact project identity; every `squad-sdk` projected worker can load its declared package Skill and definition contract; the reviewed blueprint is the exact author-tool input; one accepted workflow produces one authoring occurrence and one typed terminal result. |
| Hard constraints | No fallback, no compatibility path, no global flow gate or state machine, no second package writer, no replacement Mission/Task used as recovery, no UI automation test, no mutation of unrelated desktop-update work. |
| Read records | This complete E2E record; `MEMORY.md` project-allocation lifecycle invariant; current `squad-sdk` manifest, authoring Skill, worker prompts, contract reviewer prompt, `panel.create_task`, `TaskAPI.createTask`, `PromptProfileResolver`, `SkillMount`, Session Loop, and Skill tool. |
| Whole-repository searches | `create_task`, `MissionDraftInput`, `directory`, `projectDirectory`, `package_skill_refs`, `skillProjection`, `skillSurface`, `Compatible skills`, `expert_squad_author`, and `definition-contract`. |
| Independent Agent feedback | None. The operator did not request parallel or delegated agents for this repair, so implementation and review remain in the primary Agent. |

### Proven implementation faults

1. `panel.create_task` and `TaskAPI.createTaskInExecutionDirectory` already preserve the Mission Project as the immutable Task namespace and accept only an execution directory registered under that Project. The failed rerun was submitted from the visibly selected anonymous Project; it was not a backend identity drift. The package scheduler lacked an early project-authority check, so it spent worker Turns and attempted replacement before surfacing the inevitable mismatch.
2. The active `squad-sdk` manifest declares `squad-sdk/shared/authoring` for the source analyst, package architect, contract reviewer, and scheduler. The real projected source worker nevertheless received a Skill surface with zero compatible Skills and returned `Skill "squad-sdk/shared/authoring" not found or not allowed. Compatible skills: none`. The physical worker Turn projection is therefore not honoring the active package declaration.
3. The package authoring Skill already names `references/definition-contract.json` and requires the blueprint to be the exact author-tool input, but the runtime failure prevented workers from loading that contract. The architect invented a parallel node-array schema, the scheduler translated it by hand, and `expert_squad_author` rejected two successive shapes.
4. The first contract review contained `overall_verdict=needs_orchestrator_action`, but the scheduler treated physical terminal success and a label as semantic acceptance, rewrote unresolved facts, and redispatched completed workflow nodes. It then called `expert_squad_author` three times despite the package prompt's explicit once-only contract.

### Single repair design

- Preserve the existing project allocation boundary. The `squad-sdk` scheduler treats the current Task Project as the only installation authority and, before worker dispatch for replacement, terminates with a project-authority blocker when the exact current-project package identity/digest is unavailable. It neither invents another Project nor proposes a replacement Task as continuation.
- Make the package Skills readable role-neutral contracts. Mutation tools remain projected only to the scheduler, while every manifest-declared worker can load the same Skill and supporting definition contract without being disabled merely because it correctly lacks the scheduler's write tools. Inactive packages and undeclared Skills remain absent by construction.
- Keep `definition-contract.json.tool_input` as the only blueprint shape. The architect publishes that exact object, the reviewer records the exact reviewed digest and a typed positive or blocker verdict, and the scheduler submits the accepted object without reconstruction.
- Preserve Host-observed tool results. A blocker review or first authoring error is narrated and returned as the Task result; declared workflow nodes are not redispatched and authoring is not retried.

### Positive verification

- Existing Project submission and Task creation invariants remain unchanged; the package-local scheduler prompt now fails before dispatch when replacement authority is absent from the current Task Project.
- Real projected `squad-sdk-package-architect`, `squad-sdk-import-analyst`, and `squad-sdk-contract-reviewer` Skill surfaces contain enabled manifest-declared package Skills. The test resolves complete worker Turn projections and the physical `SkillMount` surface, rather than checking only manifest references.
- The architect blueprint codec parses the definition contract's complete positive input, the reviewer receipt binds the same digest, and the scheduler-facing accepted payload maps to one valid `expert_squad_author` definition.
- The package prompt contract returns the first author/import success or typed error directly. A fresh DeepSeek runtime rerun is still required to prove model adherence; code-level projection tests are not represented as a completed live-provider acceptance.

### Implemented boundary

- Removed scheduler-only mutation tool requirements from the two shared package Skills. This changes Skill compatibility, not tool authority: worker tool projections are unchanged.
- Added explicit role-boundary instructions to both Skills so projected workers consume evidence and contracts while only the scheduler performs catalog, preview, author, or import mutations.
- Bumped the built-in package revision to `2026.08.08.1` so immutable Task bindings can distinguish the repaired contract.
- Strengthened the package architect to preserve the exact `definition-contract.json.tool_input` object shape, including keyed workflow nodes and required descriptions.
- Strengthened the reviewer and scheduler so one blocker/non-clean review is terminal, completed nodes are not redispatched, the accepted blueprint is not reconstructed, and the single author/import call's success or typed error is returned without retry.
- Added the current-Task Project authority check before replacement workflow dispatch. No global Task, Mission, Registry, or provider implementation was changed.
- Corrected embedded JSON imports to parse once and serialize once. The same proven defect existed in Research Studio's report Schema closure, so that package received the same single-source correction and revision bump.
- Restored the intended split between strict physical runtime-directory snapshots and Git-selected Task source snapshots, and aligned both file lists with the Workspace Tree canonical path order. This closes the three adjacent positive-test regressions exposed during expanded validation.

### Verification evidence

The final targeted command passes 24 tests and 108 positive expectations across the Generate Agent Squads package, Research Studio embedded closure, generic/runtime and Git-selected source-tree snapshots, evolution launcher/mutation, and immutable Task package revision binding. `bun run typecheck` in `packages/opencorvus` also passes on Bun `1.3.14`. The package test includes enabled runtime Skill surfaces for the architect, import analyst, and contract reviewer, source/embedded package-digest identity, a successfully materialized definition contract object, and a successful project-owned authoring receipt.

## DeepSeek compaction recovery repair

### Recall

| Item | Record |
| --- | --- |
| Current user request | Continue the repair from the beginning, run a real DeepSeek end-to-end generation without correction messages or operator intervention, and record the real screen. |
| Fresh isolated lineage | Mission `6b2ed68b39603159`; Task `tsk_g019fe07ddd3c000000000000Ok15coLDEBLRCW`; fixed `squad-sdk` revision `2026.08.08.1` with digest `562f903b022c5cefb90af205e293ec4c532b`; model `deepseek/deepseek-reasoner`; exact project `D:\myhexin-local\opencorvus-v0.0.35beta`. |
| Reproduced failure | The first `source-analysis` physical worker Session `ses_-fe601f805b78ffffffffffffOAOs8eNgveb1mD` reached automatic compaction. Three same-lineage attempts all terminated with `Successful compaction produced no visible continuation text for Session MEMORY.MD`; no operator message was sent and no downstream workflow node or author call ran. |
| Direct evidence | Each failed compaction assistant message contains reasoning plus completed `ReadCompactionToolResult` calls but no text part. `SessionCompaction.process` exposes that reader and invokes `SessionProcessor.process` once without a `stopWhen`; AI SDK `streamText` therefore uses its one-step default and stops after the tool-call step. The later empty-text assertion reports the downstream symptom. |
| Single repair boundary | Keep one compaction message and the existing canonical reader. Give only the compaction helper an AI SDK tool loop whose semantic completion is a visible summary with no outstanding tool call. Do not retry a Session, synthesize a summary, read raw storage, remove the empty-summary integrity assertion, or change normal worker/model loops. |
| Positive verification | Map a completed reader-call step to the explicit continuation disposition and a final visible-text step to the summary-ready disposition; exercise the real compaction integration with the stop condition projected to `SessionProcessor`; rerun the targeted memory/compaction suite, the earlier six repair suites, typecheck, two independent read-only reviews, and then a fresh isolated DeepSeek real-page run. |
| UI and recording boundary | No UI automation test or screenshot baseline. The browser interaction remains a one-time real Overlay run with manually viewed screenshots and an external desktop recording. |

### Independent review feedback and implemented closure

- Architecture review confirmed the three persisted DeepSeek compaction messages all ended `finish=tool-calls`, with completed reader results, no text parts, and no provider error. It also queried the isolated runtime database and proved the sole compaction control remained `pending`, directly linking the repeated recovery to the throw-before-consume boundary.
- Integrity review independently confirmed DeepSeek's reasoning/text/tool channel mapping is correct and must remain separate; promoting reasoning to `MEMORY.MD` would be data corruption rather than a repair.
- Both reviewers rejected the initial weak test because it mocked `SessionProcessor` and wrote the summary directly. The replacement integration uses `MockLanguageModelV3` with the real AI SDK, `LLM.stream`, `SessionProcessor`, reader execution, message persistence, marker/event publication, `SessionMemory`, and control settlement.
- The final implementation gives the configurable compaction helper a 20-step provider limit, combines summary-ready completion with the AI SDK's standard `stepCountIs`, creates assistant messages as non-summary, and publishes `summary=true` only after final visible text. Empty or step-limited continuations persist `CompactionContinuationMissingError`, `finish=error`, and a failed control; successful controls are consumed once.
- Current non-UI verification: 34 passed, one Windows symbolic-link capability skip, zero failed, 136 expectations across seven suites; `bun run typecheck` and `git diff --check` pass.

## Cross-computer continuation context after the compaction repair

### Recall

| Item | Record |
| --- | --- |
| Operator request | Commit the complete repository state and write a durable continuation context before changing computers. |
| Current objective | On the new computer, submit one fresh real DeepSeek `squad-sdk` end-to-end creation of the project-owned `machine-learning-implementation` package without correction messages, operator intervention, a retrying author path, or automatic activation. |
| Acceptance boundary | The compaction implementation repair and its non-UI contracts are complete. The previous machine's Mission, Task, Sessions, controls, Artifacts, project-local installation, and recording are runtime-local and are not execution authority on a clean clone. The latest interrupted run is historical evidence only and is not resumable or accepted. |
| Hard constraints | Start from the new computer's exact project authority; use `deepseek/deepseek-reasoner`; keep the Task profile fixed to `squad-sdk`; treat an absent project package as normal creation and omit replacement identity/digest; reviewer terminal success precedes exactly one canonical author occurrence; install version `2026.08.08.2` inactive; do not send correction messages; do not represent mocked, copied, or interrupted evidence as live acceptance. |
| Read evidence | This full record; isolated SQLite Session, Message, Part, Task, and Protocol Event rows; the generated package manifest and provenance; final Git status and commits; architecture and integrity reviewer reports. |
| Repository searches | Compaction continuation projection, Session checkpoint publication, pending control settlement, Mission/Task creation, project authority, package Skill projection, authoring contracts, and source-tree stability. |
| Independent review | Both the architecture reviewer and integrity reviewer approved the final compaction implementation after the shared final-step continuation projection, atomic summary/marker publication, real-error normalization, pending compare-and-swap settlement, public checkpoint invariants, and positive ownership-race tests were added. |

### Portable Git boundary

- Checkout: `D:\myhexin-local\opencorvus-v0.0.35beta`.
- Branch: `main`.
- Compaction repair commit: `f1f4722f9 fix: complete compaction tool continuations`.
- Preceding Generate Agent Squads contract repair: `98e7563aa fix: harden expert squad generation contracts`.
- Preceding desktop update commit: `5a656ad98 feat: add signed desktop hot updates`.
- At handoff, `main` was ten commits ahead of `origin/main`; no push was requested or performed.
- The worktree was clean before this continuation record was added. The final handoff commit is recorded in the operator-facing response after commit creation.

### Final compaction implementation contract

1. The compaction helper uses the Artificial Intelligence Software Development Kit (AI SDK) native multi-step stream with a 20-step provider limit and `stepCountIs`, and stops semantically only when the final step has visible continuation text and no outstanding tool call.
2. A summary assistant begins with `summary=false`. The last step's visible text is the only continuation projection used by `SessionMemory`, later provider messages, and later compaction transcripts. Earlier reasoning, reader calls, reader outputs, and text preambles remain persisted only as audit transcript.
3. Empty, tool-call-only, or step-limited output becomes `CompactionContinuationMissingError`, `finish=error`, and a failed control. Provider/processor failures are normalized to real `Error` objects so outer Task and trace surfaces retain the canonical cause instead of `[object Object]`.
4. Success consumes and failure fails only a still-pending Session control through compare-and-swap ownership. Concurrent settlement winners are preserved and reported with a typed ownership error.
5. The completed valid summary and source-message compaction marker publish atomically in one SQLite transaction. The public publisher validates the completed assistant summary, parent user message, final continuation text, and handoff validity before publication.
6. The real positive integration crosses `MockLanguageModelV3` -> AI SDK -> `LLM.stream` -> `SessionProcessor` -> compaction reader -> second provider step -> persisted Message/Parts -> `SessionMemory` -> marker/event/control settlement. It does not bypass the production processor.

### Verification at the final implementation boundary

- Expanded targeted command: 35 passed, one Windows raw-symbolic-link capability skip, zero failed, 139 expectations across seven non-UI suites.
- Focused memory/compaction suite reached 9 passed and 28 expectations on a clean run.
- The new ownership-race cases passed as three filtered tests with six expectations.
- `bun run typecheck` in `packages/opencorvus` passed with Bun `1.3.14`.
- `git diff --check` passed.
- One later broad Windows rerun encountered the existing intermittent process-supervisor Git fixture failure after many fixtures; its original single case passed immediately when rerun. This was not hidden or counted as a compaction failure.
- Architecture and integrity reviewers both reported no remaining P0, P1, or P2 issue in the final implementation.

### Latest real DeepSeek run: interrupted after valid Task creation

The final isolated runtime used commit `f1f4722f9`, exact checkout `D:\myhexin-local\opencorvus-v0.0.35beta`, port `7880`, and `deepseek/deepseek-reasoner`. The real desktop form selected Mission, `@squad("squad-sdk")`, and the exact current package identity:

- scope `project`
- namespace `local`
- manifest id `machine-learning-implementation`
- current version `2026.08.08.1`
- current digest `7af4f3edc14b61820dd4e578a7f67e70792120c1259afb01bffe07f8688a2ad4`
- requested version `2026.08.08.2`
- requested roles: ML Solution Architect, Data Readiness Analyst, Experiment Designer, Model Implementation Engineer, ML Deployment Engineer, ML Integrity Reviewer
- requested workflows: `ml-implementation` and `ml-feasibility-review`

The prompt was submitted exactly once. No correction, confirmation, replacement-Mission, replacement-Task, package edit, activation, or operator recovery message was sent.

Read-only database evidence before shutdown:

- Mission id: `6a88312102b69782`.
- Mission Session: `ses_-fe601f36342affffffffffffeYkuom9VbFr8H2`.
- Task: `tsk_g019fe0cc13f4000000000000Q9wO7T43cQVUbu` (`生成替换机器学习实施专家团`).
- Task Session: `ses_-fe601f33c381ffffffffffffaTjTsXqcyRrgbK`.
- The Task is fixed to `source=mission`, `promptProfile=squad-sdk`, the exact Mission lineage, and the exact checkout.
- Protocol Events persisted the immutable package-revision binding, execution-capsule binding, `task.created`, `task.updated`, and queued operator wake. The latest event status was `active` / `Task started`.
- The Task row had `time_started` set, `time_completed=null`, and `error=null`.
- The Task Session contained no Message rows yet. Therefore the run had not entered a physical worker Turn, review, compaction, author call, installation, or terminal acceptance.
- The Mission assistant stopped normally after recording its frontier/tasks/handoff state and explicitly stated it would reconcile the Task on a later wake. The desktop's "Not running" indicator described the Mission Turn, not a failed or absent Task.

This occurrence is an interrupted acceptance run, neither success nor product failure. It proves that the repaired Mission reached the intended project, selected `squad-sdk`, and created the exact Task without the previous project-authority blocker. It does not yet prove worker compaction, reviewer ordering, one author occurrence, installation, or inactive catalog state.

### Local-only evidence and shutdown state

- Final runtime database: `C:\Users\hengu\AppData\Local\Temp\opencorvus-e2e-f1f4722f9-final\runtime\data\opencorvus.db`.
- Final runtime root: `C:\Users\hengu\AppData\Local\Temp\opencorvus-e2e-f1f4722f9-final`.
- Recording frames: `C:\Users\hengu\AppData\Local\Temp\opencorvus-e2e-f1f4722f9\frames`.
- Pre-submit screenshot: `C:\Users\hengu\AppData\Local\Temp\opencorvus-e2e-f1f4722f9\before-submit.png`.
- Recording evidence: 1,231 JPEG frames, 89,404,096 bytes. These temporary binary frames are intentionally not part of Git; copy that directory separately only if the raw recording must move computers.
- The recorder sentinel was removed after capture, recorder process `2056` exited, isolated server process `13012` exited, and the agent-created Chrome tab was finalized. No unrelated process was stopped.

### Authoritative handoff: mandatory fresh submission on the new computer

The previous machine's runtime identities are not portable. Mission `6a88312102b69782`, Task `tsk_g019fe0cc13f4000000000000Q9wO7T43cQVUbu`, their Sessions, controls, package-revision/capsule bindings, queued wake, and Task Artifacts exist only in the old isolated SQLite runtime. The project installation under `.opencorvus/expert-squads/` is also ignored by Git. A normal clone therefore has neither the old execution authority nor the installed v1 package. Do not attempt to resume those IDs, recreate their rows, copy their database as acceptance evidence, or claim that their prior `active` state continued.

On the new computer, perform exactly one fresh submission from the clean repository project:

1. Pull `main` and verify it contains `98e7563aa` (Generate Agent Squads contracts), `f1f4722f9` (compaction continuation repair), `502b85b43` (generated OpenAPI and Software Development Kit error projection), and this corrected Handoff commit. Confirm a clean worktree and Bun `1.3.14`.
2. Configure DeepSeek authentication on the new machine without copying or committing `auth.json`. Start a clean isolated OpenCorvus runtime whose selected project is the exact new checkout before Mission creation.
3. Inspect `.opencorvus/expert-squads/local/machine-learning-implementation`. On a normal clone it must be absent because project runtime installations are Git-ignored. Absence means **creation**, not project-authority mismatch and not replacement. Do not pass `expected_current_package_digest`, the old version, or the old digest to the authoring request.
4. Submit one new Mission with `@squad("squad-sdk")` and model `deepseek/deepseek-reasoner`. Ask for the `sdk-authoring` workflow to create and install a project-scoped, namespace `local`, id `machine-learning-implementation`, version `2026.08.08.2` package. Keep it inactive and do not change `prompt_profile.active`.
5. Require exactly these six role labels: `ML Solution Architect`, `Data Readiness Analyst`, `Experiment Designer`, `Model Implementation Engineer`, `ML Deployment Engineer`, and `ML Integrity Reviewer`.
6. Require exactly two keyed virtual workflows: `ml-implementation` (business goal and data readiness -> experiment design -> model implementation -> deployment handoff -> independent integrity review) and `ml-feasibility-review` (solution architecture and data feasibility -> experiment feasibility -> independent integrity review).
7. Require the package to be self-contained and framework-neutral. One independent reviewer must reach terminal success before the scheduler makes exactly one canonical `expert_squad_author` call. A typed author error is terminal; there is no retry, correction message, replacement Task, fallback, or model-specific branch.
8. Do not poll, intervene, send clarification/correction messages, or edit the generated package. Let the single fixed-profile Task finish naturally, then enumerate and read every new Task Artifact and terminal receipt from the new runtime.
9. Accept only when the new runtime proves: exact project installation of version `2026.08.08.2`; all six roles; both workflow graphs and dependency order; reviewer-before-author ordering; one author occurrence; self-contained/framework-neutral closure; inactive catalog state; unchanged `prompt_profile.active`; and a completed Mission receipt.
10. If the fresh run fails, preserve its new Mission, Task, Session, tool result, compaction control, provider finish reason, and Artifact locators before diagnosing. The old machine's IDs remain comparison evidence only. Diagnose the causal chain before changing code; do not add a gate, fallback, synthetic summary, retry, correction message, or substitute execution identity.

#### Ready-to-submit Mission request

```text
@squad("squad-sdk")

在当前项目中使用 squad-sdk 的 sdk-authoring 工作流，从零创建并安装一个项目级、namespace=local、manifest id=machine-learning-implementation、version=2026.08.08.2 的“机器学习实施”专家团。当前项目没有已安装的同 ID package；这是正常 creation，不是 replacement，不要读取、声明或传递 expected_current_package_digest。

角色必须恰好包含：ML Solution Architect、Data Readiness Analyst、Experiment Designer、Model Implementation Engineer、ML Deployment Engineer、ML Integrity Reviewer。

必须声明两个 keyed virtual workflows：
- ml-implementation：业务目标与数据就绪分析 -> 实验设计 -> 模型实现 -> 部署交接 -> 独立完整性审核。
- ml-feasibility-review：方案架构与数据可行性分析 -> 实验可行性评估 -> 独立完整性审核。

package 必须完整自包含、框架中立，不依赖其他专家团私有资源，不绑定特定云厂商或 MLOps 平台。先由独立 reviewer 完成完整 contract review；review terminal success 后，scheduler 只能调用一次 canonical expert_squad_author。首次 author success 或 typed error 都是终态，禁止 retry、纠偏消息、替换 Task、fallback 或自动激活。安装后保持 inactive，不修改 prompt_profile.active。在现有声明范围内无人干预地端到端完成，并返回完整 Task Artifact、review、author receipt、安装与 inactive 验收证据。
```
