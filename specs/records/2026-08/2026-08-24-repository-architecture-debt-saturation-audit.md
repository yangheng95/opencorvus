# Repository Architecture Debt Saturation Audit

## Recall

| Item | Record |
| --- | --- |
| User request | Do not limit the audit to Browser Use and Computer Use. Audit the architecture of the whole repository, persist the findings, and continue until a complete pass finds no new serious architecture problem. |
| Original trigger | Browser Use and Computer Use evolved through different runtime architectures, exposing a broader pattern of code accumulation without coherent software-engineering boundaries. The first narrow audit found split configuration/runtime truth, lifecycle leaks, name/shape inference, process-owner competition, documentation drift, and permanent model-context burden. |
| Required output | One indexed repository record containing the audit benchmark, scope ledger, current P0/P1/P2 findings, exact code/data/document evidence, root-cause and impact analysis, duplicate/superseded disposition, refactoring dependency order, risks, and saturation evidence. |
| Acceptance metrics | Cover every current architecture domain and every production package; every retained P0/P1 names observable impact, direct trigger, control/data-flow root cause, why existing paths do not cure it, affected contracts/data/tests/docs/delivery, exact evidence, and bounded refactoring direction; reconcile prior architecture-debt records so fixed or duplicate findings are not re-reported; after the initial domain sweep, repeat cross-domain sweeps until one complete saturation sweep adds zero new P0/P1; obtain an uninvolved read-only review with zero unresolved actionable finding. |
| Hard constraints | Read-only production audit: do not repair product code in this task. Do not add or run UI automation. Preserve unrelated worktree changes. Do not treat names, titles, old error text, comments, or model claims as root-cause evidence. Scheduling, queue, wake, recovery, concurrency, and terminal-settlement findings require the repository-wide shared-mechanism audit mandated by `AGENTS.md`. No fallback, compatibility layer, duplicate truth source, or host routing gate may be proposed as a target architecture. |
| Sources read before the record | `AGENTS.md`; `benchmark-debug-template/SKILL.md`; `package.json`; `specs/README.md`; `specs/records/2026-08/README.md`; current extension architecture; Browser/Computer configuration, projection, MCP, permission, result-materialization, lifecycle, host-runtime, UI-control, and history evidence. |
| Initial repository search | The repository has 11 workspace packages and roughly 90 production source domains under `packages/opencorvus/src`. Existing verification includes dead-code, SDK-import, AI-runtime, Expert-Squad topology, API-route, documentation, task-control, and control-state-redundancy checks. The existing 2026-08-12 continuous code-smell audit is a large historical baseline rather than proof that current P0/P1 debt is exhausted. |
| Independent-agent feedback | The narrow Browser/Computer slice received an uninvolved read-only review and added ARC-002/004. The full-repository reviewer’s first challenge added ARC-030 through ARC-035 and rejected the Permission checker substitution. Its second challenge expanded ARC-036 to the pre-fire abandoned-claim window and required explicit Git tracking of this ignored record. After both corrections, the third independent read-only review returned `PASS` with no remaining actionable finding. |

## Audit benchmark

### Task definition

Identify current, production-reachable architecture defects whose impact is systemic rather than a single local implementation bug. The benchmark evaluates the repository's ownership, identity, lifecycle, persistence, projection, permission, recovery, concurrency, extension, host, presentation, and delivery contracts against their current code and declared architecture.

### Input to output contract

- Input: current tracked repository source, configuration schemas, database schemas, public routes/SDKs, current architecture documents, focused tests/checkers, Git history, and relevant dated architecture-debt/remediation records.
- Output: a deduplicated finding ledger. A finding is admissible only when code or durable schema demonstrates the trigger and root control/data flow. Historical prose can establish intent or contradiction but cannot establish the current implementation by itself.
- Passing output: every in-scope domain has a recorded disposition; every P0/P1 is evidence-complete; fixed, historical, local-only, speculative, or duplicate candidates are explicitly rejected or merged; the final saturation sweep adds no new P0/P1.

### Environment and tools

- Repository root: `D:/myhexin-local/opencorvus`.
- Runtime and dependencies: repository-pinned Bun, Node, TypeScript, Rust/Tauri metadata, Git, `rg`, existing package checks, and read-only source/history inspection.
- No Provider credential, external account, release, deployment, production database mutation, running user application control, or browser automation is authorized or required.
- Existing untracked `packages/opencorvus/script/benchmark/` and the untracked `` path are outside this task and must remain untouched.

### Timeout and progress policy

- Automated checkers use a 120-second no-output/no-state-progress inactivity threshold unless their existing runner already supplies a stricter activity-aware contract.
- Long scans are split by domain and report progress at least once per minute; an unchanged long-running process is polled rather than killed unless its inactivity threshold expires.
- A tool failure is repaired or replaced with an equivalent read-only evidence path before the affected domain can be marked covered.

### Scope matrix

| Batch | Domains | Required cross-cuts |
| --- | --- | --- |
| A | storage, Engine data, identity, configuration, Project/Instance, filesystem/runtime directories | single fact source, transaction boundary, cache identity, deletion, migration/reset, multi-Project isolation |
| B | Session/Task/Mission, scheduler, queue, wake, cancellation, terminal convergence, recovery | every production ingress, Task/Mission/Session occurrence, retry/restart, serial/parallel execution, head-of-line release |
| C | Tool execution, permission, MCP, Plugin, Skill, Expert Squad, Provider, channel/ACP | projection versus authorization, immutable provider identity, result provenance, lifecycle ownership, extension trust boundary |
| D | process supervisor, shell, worktree, LSP, browser/desktop/visual runtimes, native host/Tauri | process occurrence, child cleanup, signal ownership, runtime portability, host/sidecar authority, outcome uncertainty |
| E | server routes, OpenAPI/SDK, Overlay projection/state, artifacts, public website, packaging/release/checkers | write owner, public contract parity, event ordering, stale cache, hidden fallback, build/source provenance |

Every batch must search definitions, all callers, same-semantic implementations, persistence, recovery and cleanup paths, tests, current architecture, and relevant history. Findings spanning batches are owned once and referenced from the other batch dispositions.

### Severity and admissibility

- `P0`: current path can corrupt or irreversibly lose authoritative data, cross a permission/isolation boundary, or make core multi-project/task execution structurally unsafe without a bounded operational workaround.
- `P1`: current production path has split authority, lifecycle leaks, unrecoverable/incorrect convergence, systemic contract contradiction, or a shared component whose ordinary failure can invalidate multiple domains.
- `P2`: material architecture debt that raises regression/security/performance cost but has a contained current impact or requires an additional condition not proven to occur ordinarily.
- Local code style, file size, naming preference, generic abstraction desire, test absence alone, and hypothetical misuse are not architecture findings.

### Saturation rule

1. Complete batches A through E and record every candidate disposition.
2. Perform a cross-cut sweep organized by authority type rather than directory: identity, write owner, lifecycle owner, recovery owner, permission owner, projection owner, process owner, and public-contract owner.
3. If that sweep adds any P0/P1, merge it into the ledger, update affected batch dispositions, and repeat the complete cross-cut sweep.
4. The audit reaches saturation only when one complete repeated cross-cut sweep adds zero P0/P1 and no unexplained checker/runtime anomaly remains.
5. An independent read-only reviewer then challenges the complete ledger, rejected candidates, coverage, and saturation evidence. Any new valid P0/P1 resets step 3.

## Initial narrow-slice baseline

ARC-001 through ARC-008 came from the Browser/Computer seed audit and were independently challenged before the whole-repository expansion. They are not a separate current register; their current severities, full summaries and evidence are carried only by the Audit ledger below.

## Audit ledger

No current P0 was proved. The audit retains 26 P1 findings and ten P2 findings. The P1 count is intentionally high because several apparently local failures are independently reachable public mutations with different owners and recovery boundaries; merging them only by the phrase “not transactional” would hide the concrete aggregates that a refactor must converge.

| ID | Severity | Finding | Primary broken authority |
| --- | --- | --- | --- |
| ARC-001 | P1 | Computer configuration, assignment, status and runtime projection disagree; named configuration is replaced by a builtin runtime. | configuration / projection |
| ARC-002 | P1 | Task and Expert-Squad Computer logical sessions are not destroyed with their Session runtime owner. | lifecycle |
| ARC-003 | P1 | Conversation Browser sessions are Project-shared and ownerless, so Conversation deletion has no exact cleanup target. | identity / lifecycle |
| ARC-004 | P1 | Browser production profile and fallback behavior contradict the current architecture contract. | runtime contract |
| ARC-005 | P1 | Browser resource, child transport and parent launcher compete for signal and termination ownership. | process lifecycle |
| ARC-009 | P1 | The declared shared-data-root multi-backend model is incompatible with process-local JSON mutation locks and cache invalidation. | persistence / concurrency |
| ARC-010 | P1 | Task creation publishes its root Session before the Task aggregate and creation ingress. | aggregate transaction |
| ARC-011 | P1 | Task message model, Attachment and reopen side effects precede durable Message/ingress acceptance. | aggregate transaction |
| ARC-012 | P1 | Session fork publishes the target Session before cloning its transcript. | aggregate transaction |
| ARC-013 | P1 | Chat/Work creation publishes a Session before persisting the requested model overlay. | aggregate transaction |
| ARC-014 | P1 | Global Task creation allocates a random Project before request acceptance, defeating Task request replay. | occurrence identity |
| ARC-015 | P1 | Anonymous Project promotion moves and copies filesystem authority before the database mapping, with no durable journal. | filesystem/database transaction |
| ARC-016 | P1 | MCP definition and static credential commit to separate durable files with no restart recovery of the cross-file transaction. | persistence transaction |
| ARC-017 | P1 | Provider OAuth has one overwriteable process-local pending slot per provider and no durable flow occurrence. | external workflow |
| ARC-018 | P1 | MCP OAuth persists flow fragments but requires process-local ownership and a fixed-port callback server to finish. | external workflow |
| ARC-019 | P1 | Provider and MCP refresh can rotate a remote refresh token before the replacement local credential is durable. | external mutation receipt |
| ARC-020 | P1 | Skill directory replacement relies on in-process rollback and has no durable mutation journal. | filesystem transaction |
| ARC-021 | P1 | Shared and per-config package caches treat directory/version metadata as installation readiness. | publication readiness |
| ARC-022 | P1 | Worktree recovery treats Git linkage as Ready even when checkout, gitlinks or start scripts never completed. | publication readiness |
| ARC-023 | P1 | The managed-parent watchdog identifies its owner by PID despite an exact process-occurrence primitive. | process identity |
| ARC-024 | P1 | Process execution remains split across the supervisor, public Bun Plugin ABI and private Node/PowerShell terminators. | process capability |
| ARC-025 | P1 | The JavaScript SDK parses human stdout as its server-startup protocol. | public process protocol |
| ARC-026 | P1 | Public restart and shutdown return success before lifecycle admission or a terminal outcome exists. | public mutation receipt |
| ARC-027 | P1 | Public Session prompt/command/shell mutations do not require one caller-visible stable request occurrence. | replay identity |
| ARC-030 | P1 | Release Overlay publishes live stores, plaintext server password and business mutators on `window`. | renderer privilege / secret boundary |
| ARC-036 | P1 | Automation lease acquisition and settlement can abandon live authority, so execution state, retry time and mutation eligibility disagree. | scheduler lease convergence |
| ARC-006 | P2 | MCP provider kind is inferred from runtime-name prefixes instead of immutable provider identity. | identity |
| ARC-007 | P2 | MCP result materialization infers Browser/Computer semantics from payload shape. | result provenance |
| ARC-008 | P2 | Default Chat/Work permanently projects 53 Browser/Computer tools, about 6,725 estimated tokens per turn. | context budget |
| ARC-028 | P2 | Transport Protocol and generated SDK form a source/build topology cycle. | package topology |
| ARC-029 | P2 | Board `sync`/freshness is a public no-op and the production dead-code gate is red. | contract / delivery |
| ARC-031 | P2 | Channel runtime has two composition roots and OpenCorvus assembles it from sibling private source. | package composition |
| ARC-032 | P2 | Disabled LSP retains a public API and full process implementation backed by an always-empty runtime. | dead subsystem |
| ARC-033 | P2 | Bundled Channel environment skips invalid nonempty lines yet consumes the one-shot TTL when any line is valid. | input settlement |
| ARC-034 | P2 | SDK generation overwrites multiple final targets sequentially without a durable generation transaction. | build publication |
| ARC-035 | P2 | Current architecture index omits current authorities and current documents link deleted architecture files. | documentation authority |

### P1 evidence and bounded refactoring directions

#### ARC-001 — Computer has four current truths

- Trigger and impact: any Chat/Work assignment that names `computer` can show a disabled configured MCP server while execution silently uses the builtin host runtime. Configuration inspection, assignment, generic MCP status and actual Tool behavior therefore cannot describe the same capability.
- Root and failed cure: `Config` materializes `{enabled:false}`, capability projection synthesizes a local Computer entry, and the Expert-Squad resolver replaces a named Computer entry again. The later projection is not validation; it is a second and third authority.
- Evidence: `config/config.ts:535-545`; `conversation/capability.ts:341-372`; `expert-squad/prompt-profile-resolver.ts:1060-1068,2200-2207`; generic MCP status remains configuration-backed. Affected contracts are Chat/Work capability settings, Expert-Squad assignment, MCP status, permission provenance and current extension architecture.
- Refactoring boundary: one typed provider declaration owns configured identity, assignment, status and runtime factory. Builtins enter through that declaration; projection must not replace a caller-named provider.

#### ARC-002 — Computer runtime scope is not the host-session owner

- Trigger and impact: finishing, deleting or disposing a Task/Expert-Squad Session closes scoped MCP connections but leaves the host Computer backend, identity and authorization alive until the whole Project Instance is disposed.
- Root and failed cure: runner/orchestrator code passes a generic scoped-MCP owner ID as Computer `runtimeScope`; `SessionRuntimeContractStore.dispose` calls only MCP close; `HostComputerBackend.close` is a no-op; only `ComputerHostRuntime.destroy` tears down the logical desktop session, and production Session cleanup never calls it.
- Evidence: `agent/runner.ts:1379-1385`; `orchestrator/agent.ts:599-605`; `expert-squad/prompt-profile-resolver.ts:2200-2207`; Session runtime disposal and `mcp/computer/host-runtime.ts`. Affected data is process-local but capability-bearing: driver session, authorization and preserved desktop state.
- Refactoring boundary: bind every Computer logical session to the durable Session/Turn occurrence and make that owner’s settlement invoke the sole destroy primitive; Project disposal is only the outer safety net.

#### ARC-003 — Browser has no Conversation owner identity

- Trigger and impact: right-sidebar Conversations in one Project share the Project MCP connection and can address any known Browser session ID; deleting one Conversation performs Computer cleanup only, while Browser pages survive until an idle timer. Monitoring enumerates Project-wide sessions.
- Root and failed cure: Browser `Session` and `Profile` records contain browser IDs but no OpenCorvus Project/Session/Turn owner; a shared connection cannot derive exact deletion from Conversation identity. A 30-minute timeout is retention policy, not ownership.
- Evidence: Browser session/profile schemas and monitor enumeration in `mcp/browser/sessions.ts` and `mcp/browser/monitor.ts`; Session deletion cleanup; scoped MCP setup. Affected surfaces are Browser tools, live monitor, Conversation deletion, multi-Conversation isolation and Project runtime disposal.
- Refactoring boundary: give Browser resources an explicit OpenCorvus owner occurrence and enforce it on lookup, monitoring and cleanup; connection pooling may remain an implementation detail but cannot be the authorization scope.

#### ARC-004 — Browser architecture and production choose different profiles

- Trigger and impact: attaching to the intended current browser can fail and silently create a different isolated browser with different cookies/login state; operators and agents cannot tell that the execution context changed.
- Root and failed cure: current architecture promises current-default-profile CDP and no implicit fallback, while production selects a managed profile and catches Chrome DevTools Protocol failure before launching isolated mode.
- Evidence: `browser/runtime/index.ts:349-391`; `mcp/browser/sessions.ts:284-305`; `specs/current/architecture/04-extensions.md`. Affected contracts are authentication state, visible Browser identity, monitor state, testability and user expectation.
- Refactoring boundary: one explicit launch policy returns a typed attached/isolated outcome. A caller may choose isolated mode, but runtime cannot silently cross that identity boundary.

#### ARC-005 — Browser signal ownership is split across processes and modules

- Trigger and impact: SIGINT/SIGTERM can run overlapping Browser cleanup and direct `process.exit(0)`, truncating HTTP/MCP/server cleanup or reporting a successful exit after failed cleanup.
- Root and failed cure: the Browser resource, transport entry and parent Node launcher each install termination handlers; the child session module exits directly while the parent owns child-tree disposal. Independent `once`/`on` handlers do not establish ordering.
- Evidence: `mcp/browser/sessions.ts:1153-1166`; `mcp/browser/index.ts:120-166`; `mcp/browser/node-launcher.ts:74-118`. Affected surfaces include stdio/HTTP Browser MCP, packaged Node launch and host process shutdown.
- Refactoring boundary: exactly one composition-root signal owner requests typed shutdown and awaits a single Browser cleanup receipt before setting exit status; resource modules expose cleanup but never own process termination.

#### ARC-009 — Shared data root, process-local writers

- Trigger and impact: two supported backends on different ports read the same JSON snapshot and update different keys. The later atomic rename overwrites the earlier update; peer process caches remain stale because reset/event propagation occurs only in the writer process. Credentials, configuration or Expert-Squad secrets can disappear without malformed bytes.
- Root and failed cure: the current data architecture explicitly permits multiple backends over one SQLite/data root, but `withKeyedLock` is a process-local `Map`. Project/global config, `auth.json`, `mcp-auth.json` and `expert-squad-configuration.json` use only that primitive or one module Promise. Atomic file replacement prevents torn bytes, not lost read-modify-write updates or cross-process cache coherence. Provider model catalog is the counterexample that already uses `withProcessLock`.
- Evidence: `specs/current/architecture/02-data.md:33-38`; `util/lock.ts:7-53`; `config/config.ts:2068-2109`; `auth/index.ts:76,135-145`; `mcp/auth.ts:42-43,117-123,168-171`; `expert-squad/configuration.ts:77-106`; `provider/models.ts:225-250`. Affected contracts include all config/auth routes, Provider/MCP resolution, capability projection and multi-backend recovery.
- Refactoring boundary: move mutable shared facts behind one transactional authority with cross-process compare-and-swap/revision and invalidation. Do not add a second lock beside unchanged stale caches; readers and writers must consume the same revisioned fact.

#### ARC-010 — Task root Session publishes before Task creation

- Trigger and impact: process termination after root Session commit but before `persistTask` leaves a visible ownerless root Session. Retrying the same Task request cannot find it because idempotency is indexed by the absent Task row and creates another Session.
- Root and failed cure: `Session.create` opens its own transaction and publishes events, then `persistTask` commits the Task, imports, process binding and creation ingress. The catch cleans selected filesystem artifacts on returned errors but cannot compensate a dead process or retract already published Session events.
- Evidence: `task-api/index.ts:1793-1826`; Session `prepareRootNext`/`persistPreparedNextInTransaction` already expose the primitive needed for an enclosing transaction. Affected data includes Session, Task, initial ingress, package/process binding, intent files and creation events.
- Refactoring boundary: one durable Task-creation occurrence prepares disk artifacts, then atomically commits the exact root Session, Task and initial facts; event publication follows that commit and replay verifies the entire occurrence.

#### ARC-011 — Task message side effects precede acceptance

- Trigger and impact: a Task message can fail or disappear while changing the root Session model, appending some Attachments or reopening a terminal Task. The next Turn observes state for which no user Message or ingress exists.
- Root and failed cure: attachment bytes are materialized, model overlay commits, Attachment references commit one by one, and reopen commits before `continueTaskMessage` atomically persists the Message/ingress. Catch restores only model state on ordinary exceptions; it cannot undo a hard exit and does not compensate Attachment/reopen facts.
- Evidence: `task-api/index.ts:3542,3579-3596,3621-3631`; canonical Message/ingress transaction around `task-api/index.ts:1038-1105`. Affected contracts include Task message HTTP receipt, Session config, Task attachment set, execution epoch and FIFO wake.
- Refactoring boundary: prepare immutable bytes first, then atomically commit Message/Parts, Task references, overlay, reopen epoch and ingress under one caller request occurrence; physical bytes are retained or reclaimed by that occurrence.

#### ARC-012 — Session fork is create-then-copy

- Trigger and impact: interruption during a public fork returns no success but leaves a visible child Session with a transcript prefix. Retry creates another target and never completes the partial fork.
- Root and failed cure: `Session.fork` calls `createNext` first, then loops over source Messages and calls `persistMessage` once per Message. There is no fork request identity, completeness receipt or recovery scan.
- Evidence: `session/index.ts:328-371`; public `POST /session/:sessionID/fork`. Affected data includes parent edge, Message/Part identity mapping, Session events and public history.
- Refactoring boundary: prepare the clone map and commit the target Session plus complete bounded transcript in one transaction, or use a durable fork occurrence whose target remains unpublished until a completion receipt; retry must resolve the same target.

#### ARC-013 — Conversation model is a post-create patch

- Trigger and impact: Chat/Work creation with an explicit model can publish a Session carrying the base model if the process stops before the overlay patch. A local project route retains it; the global route’s catch deletes only on returned failure, not process death.
- Root and failed cure: both creation paths call `createRightSidebarConversationSession`, then separately call `Session.mergeConfigOverlay`. Model validation before creation does not make the later write atomic.
- Evidence: `chat/global-chat-service.ts:19-32`; `server/routes/right-sidebar-conversation.ts:145-155`. Affected contracts are Chat/Work create responses, Session effective configuration, first Turn model and temporary Project cleanup.
- Refactoring boundary: the creation input must include the validated immutable initial overlay and persist it in the Session insert; delete the post-create initialization path.

#### ARC-014 — Global Task replay changes Project identity

- Trigger and impact: a lost response or crash after a Global Task is committed causes retry to allocate a new random Project and potentially a duplicate Task. The supplied Task `requestID` cannot locate the first Task because lookup is scoped to the new Project.
- Root and failed cure: `GlobalTaskService.create` calls `ImplicitProject.create` before `EngineService.createTask`; Task replay uses `findTaskByRequest(Instance.project.id, requestID)`. Catch deletion handles only failures observed by the same live process.
- Evidence: `task-api/global-task-service.ts:13-32`; `task-api/index.ts:1653-1675`; `project/implicit-project.ts:351-371`. Affected data includes Project/Git baseline, Task, root Session, attachments and global create response.
- Refactoring boundary: a durable global-create request owns the stable Project and Task identities before physical initialization; replay resolves or completes that same aggregate instead of allocating a namespace first.

#### ARC-015 — Anonymous Project promotion has no crash-recovery owner

- Trigger and impact: termination after source-to-quarantine rename makes the database point to a missing directory; after destination publication but before database relocation, both physical destination and stale database identity remain. No startup reconciler knows which side is authoritative.
- Root and failed cure: promotion renames the source, recursively copies to staging, publishes the destination, and only then updates Project and all Session paths in SQLite. `rollbackPromotion` is an in-memory catch path; the UUID paths and before-snapshot are not durably recorded. `cleanupPending` covers only post-commit quarantine deletion.
- Evidence: `project/implicit-project.ts:105-218,282-340`; public `POST /project/current/promote-anonymous`. Affected contracts include Project worktree identity, Session directories, Git repository, filesystem cleanup and subsequent Project opening.
- Refactoring boundary: one durable promotion journal records source/destination, exact Project generation and stages before the first rename; startup and retry converge that journal to the old or new identity before either is exposed.

#### ARC-016 — MCP definition and secret are separate commits

- Trigger and impact: termination after project config commit but before `mcp-auth.json` write leaves an enabled static-credential MCP server whose required secret is absent. Runtime connection fails persistently and retry semantics cannot know whether to restore or finish.
- Root and failed cure: `MCP.configure` writes project config, then writes the credential. Catch restores both only for returned errors. `reconcileProjectConfig` removes stale existing credentials, but explicitly treats a missing stored entry as not stale, so it cannot recover an incomplete configure transaction.
- Evidence: `mcp/index.ts:2330-2395,2537-2610`; `mcp/auth.ts`. Affected contracts are MCP configure, project config, credential store, connection state and status projection.
- Refactoring boundary: one durable configure occurrence owns definition and secret revision; publish the definition only with its credential receipt, or store both in one transactional authority. Startup resolves every nonterminal occurrence before connection projection.

#### ARC-017 — Provider OAuth is a process-local overwrite slot

- Trigger and impact: a second authorization for the same provider/scope silently replaces the first callback; restart loses both. Callback accepts a `method` but matches only provider ID, so it cannot prove which method/input occurrence produced the returned code.
- Root and failed cure: ProviderAuth state is a Project-instance/global lazy object whose `pending` record is keyed only by provider ID. `authorize` and `execute` overwrite it; `callback` reads that slot and does not bind `input.method` to it. Provider-specific state checks cannot supply the missing outer flow/replay identity.
- Evidence: `provider/auth.ts:15-26,76-103,229-262`; project/global Provider OAuth routes. Affected contracts include OAuth URL, callback, credential publication, concurrent settings windows and restart.
- Refactoring boundary: mint a durable authorization-flow occurrence containing provider, scope, method, inputs digest, state and terminal result; callback and credential write consume that exact occurrence once.

#### ARC-018 — MCP OAuth durability stops before flow ownership

- Trigger and impact: `oauthState` and PKCE verifier survive restart, but completion rejects because `pendingOAuthFlows` disappeared. In a supported multi-backend deployment, the backend receiving the callback may not own the map, and only one process can bind the fixed callback port.
- Root and failed cure: the durable credential file stores fragments while revision, correlation and current-flow owner stay in process-local maps. `assertOAuthState` and `finishAuth` require that map even when durable state matches; the callback server is a process singleton on one constant port.
- Evidence: `mcp/auth.ts:33,220-278`; `mcp/index.ts:1057-1062,3500-3578,3725-3785`; `mcp/oauth-callback.ts:75-80,150-169`. Affected contracts include start/callback/authenticate routes, PKCE, config change invalidation and multi-backend operation.
- Refactoring boundary: the complete flow occurrence and lease live in the shared transactional authority; callback routing claims by state/flow ID and any backend can finish or return the exact terminal result. A process-local listener is an adapter, not ownership.

#### ARC-019 — Remote token rotation and local publication are unjournaled

- Trigger and impact: providers that rotate refresh tokens can invalidate the old token in the remote response; process termination before `Auth.set`/`McpAuth.updateTokens` permanently strands the account until reauthorization. Blind retry may replay a consumed token.
- Root and failed cure: single-flight Promises serialize live calls but do not persist the external mutation attempt or returned tokens. Provider plugins exchange then call the local auth route; MCP SDK invokes `saveTokens` only after the exchange. Local atomic write cannot cover a remote system.
- Evidence: `plugin/xai.ts:539-556`; `plugin/snowflake-cortex.ts:311-323,344-360`; `mcp/oauth-provider.ts:132-146`. Affected contracts include Provider/MCP fetch, credential stores, restart and authentication UI.
- Refactoring boundary: a durable external-mutation occurrence is written before exchange, uses provider-supported idempotency or reconciliation where available, encrypts/commits the returned credential as its terminal receipt, and exposes unknown outcome instead of blind replay.

#### ARC-020 — Skill replacement has no durable journal

- Trigger and impact: termination after target-to-backup rename leaves the configured Skill absent; termination after some of a multi-Skill import is installed leaves a mixed catalog. Restart has no exact operation to restore or finish.
- Root and failed cure: `replaceSkillDirectories` stages bytes, then renames every target to a UUID backup and staging to target. Boolean fields and catch rollback exist only in memory. Backup cleanup warnings are not recovery. Expert-Squad package manager demonstrates the repository already has a durable journal pattern, but Skill does not use it.
- Evidence: `skill/manager.ts:867-984`; Skill install/update/import callers; `expert-squad/manager.ts:435-645` as the contrasting current primitive. Affected contracts include global config paths, installed inventory, Skill mounts and Tool reads.
- Refactoring boundary: one journaled catalog mutation binds all targets, before/after digests and config revision; recovery runs before catalog projection and removes the in-memory-only replacement protocol.

#### ARC-021 — Package caches publish partial directories

- Trigger and impact: a killed Bun install can leave `node_modules` and a readable package manifest. Subsequent Plugin/Provider load treats that tree as installed and fails persistently instead of completing it; concurrent backends can also mutate the shared global cache because its lock is process-local.
- Root and failed cure: `BunProc.install` accepts module existence plus cached/installed version and uses `Lock.write`, another in-process lock. Per-config dependency readiness checks only `node_modules`, package file and declared dependency version. Neither path stages a complete tree or owns an install receipt.
- Evidence: `bun/index.ts:61-96,120-136`; `config/config.ts:406-466,487-516`; Plugin uses `BunProc.install` at `plugin/index.ts:317`. Affected contracts include Plugin ABI loading, dynamic Provider installation, local config dependencies and shared cache cleanup.
- Refactoring boundary: a single package publication service installs under a cross-process lease into an isolated tree, verifies the resolved dependency graph/files, then atomically publishes an immutable revision with a completeness receipt.

#### ARC-022 — Git linkage is mistaken for Worktree readiness

- Trigger and impact: termination after `git worktree add --no-checkout` but during reset, gitlink materialization or start scripts leaves a registered worktree. A resumed dispatch with `reuseIfValid` returns it as Ready without running `populate`, so Builds can execute against an incomplete checkout.
- Root and failed cure: `isValid` checks only `.git` linkage and `git worktree list`; creation publishes sandbox/owner before `populate`. In-process failure cleanup is comprehensive for returned errors but there is no durable created/populated/ready occurrence for process death.
- Evidence: `worktree/index.ts:1742-1768,1811-1874,1896-1922`; create uses `git worktree add --no-checkout` at 1840 and runs `populate` at 1857. Affected contracts include Build Session reuse, Automation, start commands, submodules and Ready events.
- Refactoring boundary: a durable Worktree occurrence binds branch/base and records created, populated and ready stages. Reuse requires the ready receipt; incomplete occurrences resume population or converge rollback.

#### ARC-023 — Parent watchdog is PID-only

- Trigger and impact: after the desktop parent dies and its PID is reused, the managed backend treats an unrelated process as its owner and stays alive, retaining listener/runtime resources indefinitely.
- Root and failed cure: ManagedServerLifecycle passes only `parentPid`; watchdog polls `process.kill(pid,0)`. The repository already implements platform-specific process-instance IDs and exact occurrence observation, so lack of a usable primitive is not the reason.
- Evidence: `server/managed-server-lifecycle.ts:5-20`; `server/parent-watchdog.ts:18-48`; `runtime/process-occurrence.ts:49,104-180`. Affected contracts include native sidecar lifetime, restart, shutdown and process recovery evidence.
- Refactoring boundary: supervisor passes an exact parent process occurrence (PID plus process-instance fingerprint); the child compares that occurrence and treats reuse as terminal.

#### ARC-024 — Process capability has multiple public and private owners

- Trigger and impact: quoted paths, timeout, abort and Windows child-tree cleanup behave differently depending on whether execution comes from a Plugin, local speech-to-text, SDK server, LSP/system terminal or the central supervisor. Some paths have durable Task process ownership; others are invisible to settlement.
- Root and failed cure: the public Plugin ABI exposes `BunShell` and runtime injects `Bun.$`; Channel local CLI splits command text on whitespace and implements Node/PowerShell termination; SDK repeats another process-tree implementation even though `ProcessSupervisor` exists.
- Evidence: `plugin/src/index.ts:31`; `opencorvus/src/plugin/index.ts:142,227`; `channel-runtime/src/stt/providers/local-cli.ts:22,46,86-260`; `sdk/js/src/server.ts:48,158-290`; `shell/process-supervisor.ts`. Affected contracts are Plugin portability, process occurrence, streaming output, cancellation and packaging.
- Refactoring boundary: one runtime-neutral structured process facade owns executable/argv, cwd/env, streaming, deadlines, occurrence identity, tree termination and terminal receipt; remove Bun shell and all parallel terminators from public/runtime paths.

#### ARC-025 — SDK readiness is a log regex

- Trigger and impact: changing server log wording, localization or an unrelated matching stdout line can make `createOpenCorvusServer` time out, fail parsing or return a false URL even though the process state differs.
- Root and failed cure: SDK observes bounded stdout but waits for a line containing `server listening` and parses `on <url>`; the server emits that human console string. Bounding logs solves memory, not protocol identity or authenticity.
- Evidence: `sdk/js/src/server.ts:64-108`; `sdk/js/src/server-startup-observer.ts`; `cli/cmd/serve.ts:147`. Affected contracts include public SDK lifecycle, CLI logs, packaging and startup timeout.
- Refactoring boundary: child emits a framed machine startup receipt on a dedicated IPC/FD channel with occurrence ID, URL and terminal failure; stdout remains diagnostics only.

#### ARC-026 — Restart/shutdown acknowledge intention, not acceptance

- Trigger and impact: HTTP returns `{ok:true}` before the delayed lifecycle callback runs. The handler can disappear, admission/quiesce can fail, replacement startup can fail or shutdown settlement can fail after the caller has already received success.
- Root and failed cure: both routes defer work with a 25 ms timer to release the response. `requestServerShutdown` fire-and-forgets the handler and logs rejection; restart catches and logs later. The response is neither a durable request receipt nor a terminal result.
- Evidence: `server/routes/app.ts:184-265`; `server/shutdown.ts:23-30`; `server/restart.ts:17-22`; serve lifecycle implementation. Affected contracts include OpenAPI/SDK, native supervisor, listener handoff and process exit code.
- Refactoring boundary: first synchronously admit one lifecycle occurrence and return its stable ID/state; terminal status is queryable/streamed. If safe admission cannot be established before response, return an exact error rather than success.

#### ARC-027 — Public Session executions have optional replay identity

- Trigger and impact: a client that loses the response to `session.prompt` and retries the documented body without optional `messageID` starts a second model Turn and may repeat Tool effects. `session.command` also makes message identity optional and can execute embedded shell substitutions before its user Message is durable; `session.shell` mints identities internally after entering the execution path.
- Root and failed cure: the server mints a Message ID when omitted and keys only a process-local in-flight map by that new ID. The HTTP request ID is available elsewhere but is not bound to this operation. Idempotency works only if the caller already knows to invent and retain an optional internal Message identity.
- Evidence: `server/routes/session.ts:124-151,177-210,275-299,1643-1693`; `session/prompt/schema.ts:5-10`; `session/command-exec.ts:24-45,100-165`; `session/shell-exec.ts:118-170`. Affected contracts include OpenAPI/SDK, Message history, Provider cost, Tool permission/effects and retry after network/process failure.
- Refactoring boundary: every public execution mutation requires or server-negotiates a stable request occurrence before effects; request fingerprint, input Message and terminal result are durably bound, and retries return/continue that occurrence across processes.

#### ARC-030 — Release renderer exposes secrets and hidden mutators globally

- Trigger and impact: any script executing in the renderer or a DevTools expression can read the complete live settings, application and board stores, including the plaintext server password, and can invoke directory switching, Task loading/selection, Board loading and settings persistence. The surface exists unconditionally in release code.
- Root and failed cure: test/benchmark observation was implemented by exporting mutable production containers and functions directly on `window`. Production workspace persistence itself calls that global bridge, so it is no longer an isolated diagnostic hook. Host transport capability checks do not constrain same-renderer globals.
- Evidence: `overlay/src/main.tsx:1606-1632` installs the bridges unconditionally; `overlay/src/store/settings.ts:16-20,135-165,279-284` holds/persists plaintext password; `overlay/src/main.tsx:1925-1932` uses it for API auth; `overlay/src/services/workspace.ts:786-793` consumes `window.persistOverlaySettings`. The focused CS-010 record is a plan whose implementation status remains unstarted.
- Affected contracts and risk: release renderer global ABI, server authentication secret, active directory/Task identity, settings persistence, benchmark hooks and any renderer-script compromise. This expands an existing renderer execution to secret disclosure and hidden business writes; no remote script-execution entry was proved, so severity remains P1 rather than P0.
- Refactoring boundary: remove production global stores/mutators and make production modules call typed imports. If diagnostics are still required, one explicit non-release adapter returns an immutable redacted snapshot and owns no business mutation.

#### ARC-036 — Automation can abandon execution authority before and after a fire

- Triggers and impact: (1) the real Permission matrix creates a recurring Automation, invokes schedule `run`, receives `Automation run completed`, and immediately invokes schedule `delete`; deletion deterministically fails with `AutomationRunningConflictError`. (2) `claim()` reads a definition, acquires a two-minute lease in a separate transaction, then rereads; if a concurrent update committed a new revision between the first read and lease acquisition, the post-acquire revision check returns `undefined` without releasing the new lease. The caller reports `already running` although no fire owner exists. Both paths block update/delete/manual rerun; failure receipts request retry in as little as two seconds, but the unchanged lease can defer eligibility for two minutes, and short recurring intervals can be suppressed.
- Root and failed cure: lease acquisition is not atomically fenced to the exact Automation revision, and neither abandoned-claim nor fire settlement owns an explicit lease end. `runNowWithExecutor` awaits `executeWithRuntimeSettlement`; `execute` awaits every target wake, persists terminal/failure receipts and logs completion, but its `finally` only disposes the renewal timer. `releaseControlLease` is a shared production primitive with explicit early-end semantics, yet `automation-service.ts` neither imports nor calls it. Runtime-execution settlement tracks the promise but does not own this lease; succeeded/retry receipts do not supersede it, while `remove`, `update`, `claim` and due selection continue to consult it.
- Evidence: `scheduler/automation-service.ts:175,461-498,546-579,1095-1104,1107-1282,1683-1720`; `engine/control-lease.ts:70-91`; `tool/schedule.ts:179-185`. After correcting the Permission checker's unrelated direct-global-cleanup path to use the production Server settlement boundary, `bun run check:permission-modes` reaches Automation completion and then terminates on the still-running deletion conflict. The claim/update interleaving follows directly from the separate definition reads, standalone lease transaction and early return.
- Affected contracts and risk: schedule-tool wording, REST `runNow`, Automation revision updates, run/failure receipts, manual rerun/update/delete, due scheduling, restart/retry behavior, and Session/Project/global targets. This is a shared scheduler lease-convergence defect, not a Permission-specific failure.
- Refactoring boundary: atomically validate the exact active revision while acquiring its fire owner, and make every post-acquire abandon, terminal, failure and cancellation settlement expire that exact fenced lease in the same transaction as its receipt/retry state. Public completion returns only after settlement. Cover concurrent update/claim, post-acquire revalidation failure, normal completion, partial-target failure, retry shorter than lease duration, lost lease, restart, manual run, due run, intervals below lease duration and immediate post-completion mutations; do not add sleep/poll compatibility behavior.

### P2 register

- **ARC-006 / ARC-007:** `mcp/provider-kind.ts` derives Browser/Computer kind from runtime-name prefixes, while `mcp/materialize.ts` guesses result semantics from `structuredContent`. Generic/package MCP responses can therefore receive the wrong permission/result/UI treatment. Carry immutable provider identity through Tool projection, invocation and result envelopes.
- **ARC-008:** default Chat and Work assignments eagerly expose 53 Browser/Computer Tools on every Turn (about 6,725 estimated tokens). The existing 2026-08-14 Tool-block plan describes the correct single on-demand projection direction but is not the current runtime.
- **ARC-028:** `transport-protocol` depends on `@opencorvus-ai/sdk/expert-squad-manifest-v1`, while the SDK build reads and slices private Transport Protocol TypeScript source to generate route policy (`packages/transport-protocol/package.json`; `transport-protocol/src/index.ts:7-10`; `sdk/js/script/build.ts:13,197-210`). Clean build order and contract generation depend on incidental workspace state. Move shared schema/route facts to a lower structured contract owner.
- **ARC-029:** Task Board routes accept `sync` but `getBoard`/`getBoardTag` ignore it (`task-api/index.ts:2023-2027` and route callers). Separately, `check:dead-code` reports six Overlay files, one unused dependency and two unlisted `ps` binary uses. The Permission checker also had a checker-only composition defect: it directly disposed Scheduler/Instance instead of entering the production Server settlement boundary. That path is corrected and now terminates cleanly; its subsequent product failure is ARC-036, not part of this P2.
- **ARC-031:** OpenCorvus dynamically imports Channel runtime sibling `src` modules and builds providers/adapters in `opencorvus/src/channel/supervisor.ts:221-285`; `channel-runtime/src/main.ts:1-124` independently repeats the composition. One public parameterized Channel bootstrap must own environment, providers, adapters and readiness, and OpenCorvus must consume the declared package boundary.
- **ARC-032:** `lsp/index.ts:153` creates an empty server map while `/lsp` and workspace-symbol/file APIs remain public (`server/routes/app.ts:768`; `server/routes/file.ts:89`) and the full install/spawn implementation remains. Delete the disabled subsystem and public contract or restore one configured runtime owner; do not keep a zombie compatibility API.
- **ARC-033:** `channel-runtime/src/bundled-env.ts:55-70` silently skips invalid nonempty lines. If one line remains valid, `applyBundledEnv` signs `first_used_at` at 167 before reporting enabled, permanently consuming the bounded secret window for a partially invalid bundle. Parse the complete input into a typed valid/invalid result before any TTL claim or environment mutation.
- **ARC-034:** `sdk/js/script/generation-transaction.ts:165-214` removes prior staging/backup, copies backups, then mirrors/copies multiple final targets one by one. A process death can publish a mixed SDK/OpenAPI/generated-policy generation, and startup deletes its only uncommitted evidence. One content-addressed generation plus atomic current pointer/journal must publish all outputs together.
- **ARC-035:** `specs/current/architecture/README.md` does not index current `02-data.md` or `06-provider.md`, while those files and `04-extensions.md` link missing `01-agents.md`/`03-control.md`. `docs:check` validates generated API Markdown, not this authority graph. The architecture index must enumerate every current fact source and current documents may link only live authorities.

## Batch dispositions

| Batch | Disposition |
| --- | --- |
| A — data, identity, configuration, Project | Retained ARC-009, ARC-014 and ARC-015. SQLite single-writer/domain-table ownership and compact identity rules were challenged; `check:control-state-redundancy` passed. Models catalog, Project identity convergence, Project deletion and remote Skill snapshots have current cross-process/transactional authorities and were not re-reported. |
| B — Session, Task, Mission, scheduler, recovery | Retained ARC-002, ARC-003, ARC-010 through ARC-014 and ARC-036. The shared mechanism was audited horizontally across normal, terminal, retry, restart, cross-process and lost-wake paths; 39 focused tests passed, but the canonical Permission matrix then exposed the uncovered Automation terminal-lease contradiction. Mission atomic identity and closure issues from the historical audit are repaired in current code. |
| C — Tool, permission, MCP, Plugin, Skill, Provider, Channel | Retained ARC-001 through ARC-004, ARC-006 through ARC-008, ARC-016 through ARC-021, ARC-031 and ARC-033. Permission ledger/control-state focused contracts passed; Channel shared-state locking and durable Bus were verified as current counterexamples, but Channel composition and bundled-env settlement remain separate P2 debt. Remote Skill publication CS-053 and credential-removal CS-048 are repaired; OAuth/configure/update paths above remain distinct unresolved occurrences. |
| D — process, shell, worktree, Browser/Computer, native host | Retained ARC-002 through ARC-005 and ARC-022 through ARC-024. Native sidecar health/readiness and startup-worker serialization now have explicit current owners, so historical CS-043/CS-056 were closed rather than duplicated. |
| E — server, SDK, Overlay, website, packaging/checkers | Retained ARC-007, ARC-008, ARC-025 through ARC-030 and ARC-032 through ARC-035. API route, SDK import, AI-runtime, Expert-Squad topology and API-doc checks passed, but those checks do not close the renderer global, LSP zombie, multi-target SDK generation or architecture-link findings. Public website metadata/signing/activation has a separate documented authority and no new P0/P1 was proved there. |

### Historical register reconciliation

- Retained and mapped: CS-010→ARC-030; CS-011→ARC-025; CS-012→ARC-031; CS-013→ARC-024; CS-022→ARC-005; CS-023→ARC-023; CS-024→ARC-020; CS-026→ARC-032; CS-039→ARC-016; CS-042→ARC-010; CS-044→ARC-012; CS-045→ARC-026; CS-049→ARC-029; CS-050→ARC-013; CS-051→ARC-022; CS-052→ARC-011; CS-061/066→ARC-021; CS-062→ARC-014; CS-064→ARC-033; CS-065→ARC-034; CS-067→ARC-017; CS-070→ARC-018; CS-071/073→ARC-019.
- Repaired and current-source verified rather than re-reported: explicit Project identity, Mission Session atomic identity, unified Tool envelope/control protocol, native registry cache, privileged renderer writer removal, Plugin publication, Artifact cursor authenticity, dead JSON storage, Provider cache identity, MCP diagnostic redaction, Channel startup settlement, sandbox discovery, remote Skill snapshots, incomplete domain settlement families, immutable release publication, model refresh, SDK observer log bounds and current Task-control wake/terminal convergence.
- Rejected as current P1: generic file API process-local locks (external editors are legitimate concurrent writers and the API’s no-clobber/atomic primitives prevent the specific corruption claim); Bus subscriber loss (durable outbox and occurrence-idempotent subscribers cover current durable effects); sidecar physical-live/health mismatch (current health observer terminalizes and clears the child); Board `sync` (real but P2); dead-code findings (real but P2).

## Saturation evidence

| Round | Organization | Result |
| --- | --- | --- |
| 0 | Browser/Computer seed | ARC-001 through ARC-008 retained; independent challenge added ARC-002 and ARC-004 before the whole-repository expansion. |
| 1 | Domain batches A-E plus historical reconciliation | ARC-009 through ARC-026 admitted; fixed historical candidates and local/P2 candidates were removed or merged. |
| 2 | First authority sweep: identity, write, lifecycle, recovery, permission, projection, process, public contract | Two P1 additions: ARC-015 (Project promotion journal) and ARC-027 (public Session execution occurrence). Saturation reset. |
| 3 | Complete repeated authority sweep after integrating Round 2 | Initially zero new P0/P1, but later invalidated by independent review. Searches re-covered process-local owners, JSON read-modify-write, cross-filesystem/database mutations, existence-as-readiness, random/optional request identities, delayed/fire-and-forget public success, process spawns/terminators, provider/result inference and no-op public parameters. |
| 4 | Independent final challenge | One omitted P1, ARC-030, plus ARC-031 through ARC-035 P2 and the uncorrected Permission checker lifecycle were admitted. Saturation reset; the review did not pass. |
| 5 | Canonical checker rerun after checker lifecycle correction | One new shared-mechanism P1, ARC-036: successful Automation completion retains its live control lease. Saturation reset; no delay or checker bypass was added. |
| 6 | Complete repeated authority sweep after ARC-030 through ARC-036 | Initially recorded zero new P0/P1, then invalidated by second independent review: ARC-036 omitted the post-acquire revision-revalidation lease leak. |
| 7 | Second independent challenge | No new ID, but ARC-036's root expanded: concurrent update/claim can abandon a lease before any fire, and failure retry time also disagrees with retained lease time. Saturation reset. |
| 8 | Complete repeated authority sweep after the expanded ARC-036 | Zero new P0/P1. Every `acquireControlLease` caller, pre/post-acquire exit, renewal, receipt projection, retry schedule and mutation gate was reread; the sweep also repeated the module-local authority, detached operation, public-global, filesystem/external publication, package-readiness, public-receipt, inference, process and architecture-link searches. |
| 9 | Final independent read-only review | `PASS`; no unresolved actionable finding and no new P0/P1. |

Round 8 supplies the required zero-new-P0/P1 saturation pass. The shared-lease horizontal audit found that Channel ingress, Permission effects, Session controls, Mission closure and build cleanup attach leases to immutable accepted occurrences whose durable terminal record immediately dominates projection; Bus and Event do the same for deliveries/fires; Protocol Delivery explicitly expires its retry lease. Automation alone acquires against a separately read mutable revision, can exit after acquisition without a fire/receipt, and continues to use an unexpired abandoned/terminal/failure lease as the definition-level running gate; these are one ARC-036 owner defect rather than separate findings. Module-level renderer caches and process-local cleanup registries were rejected when they owned only reconstructible presentation/physical state; secret-bearing globals, OAuth flow owners, shared JSON facts and lifecycle owners remain covered by ARC-009, ARC-017, ARC-018, ARC-023, ARC-030 and ARC-036. Round 9 independently confirmed the corrected ledger and saturation evidence with no unresolved finding.

## Refactoring dependency order

This is dependency order, not permission to implement in this audit:

1. **Renderer privilege containment:** remove ARC-030’s secret-bearing global ABI before broader UI/runtime refactors; production imports replace its internal global dependency in the same change.
2. **Shared mutation/occurrence kernel:** establish cross-process revisioned mutation, exact request occurrence, fenced lease release and terminal receipt primitives. ARC-009, ARC-014, ARC-016 through ARC-019, ARC-026, ARC-027 and ARC-036 depend on this vocabulary.
3. **Aggregate database boundaries:** migrate Task creation/message and Session creation/fork to one prepared-then-commit boundary (ARC-010 through ARC-014). Delete post-create patch and catch-only compensation paths in the same changes.
4. **Durable filesystem/publication:** reuse one journal/completeness protocol for Project promotion, Skill replacement, package installation, Worktree readiness and SDK generation (ARC-015, ARC-020 through ARC-022, ARC-034). Physical existence never means Ready.
5. **Process capability and lifecycle:** converge exact process occurrence, structured spawn/stream/termination and machine startup/lifecycle receipts (ARC-005, ARC-023 through ARC-026). Remove Bun/Node/PowerShell parallel public owners.
6. **Extension identity and composition:** make immutable provider/owner identity flow through configuration, discovery, permission, invocation, result and cleanup; converge Browser/Computer policies and give Channel one public composition root (ARC-001 through ARC-008, ARC-016 through ARC-019, ARC-031/033).
7. **Package/public-contract cleanup:** break the SDK/Transport cycle, remove or restore LSP, implement real Board freshness or delete the parameter, make verification gates green, and repair the architecture authority index (ARC-028, ARC-029, ARC-032, ARC-035). Update current architecture at each removed authority boundary rather than adding compatibility paths.

## Verification-tool correction plan

The independent review rejected focused tests as a substitute for the failed canonical Permission checker. The correction is deliberately checker-only:

1. Preserve every permission matrix operation and assertion.
2. Replace only the final hand-written `Scheduler.disposeGlobal` plus direct `Instance.disposeAll` cleanup with the production `Server.settleCurrentProcessExecution` path, passing the same `Instance.disposeAll` callback and inactivity budget.
3. Release the exact returned runtime handoff before closing the database and deleting the isolated root.
4. Run the original `bun run check:permission-modes` to a terminal product verdict. Do not add or run UI automation, sleeps or post-completion polling.

This repairs the checker’s lifecycle composition; it does not change Permission, Task-control, Scheduler, Session or production server behavior. The rerun cleaned up successfully and terminated on the production ARC-036 conflict. Independent final review must include this script diff and original checker receipt.

## Verification log

- Initial worktree status: pre-existing untracked `packages/opencorvus/script/benchmark/` and ``; no task-owned production edits.
- Narrow Browser/Computer audit: code/history inspection complete; independent read-only review complete with the two added P1 findings incorporated above.
- `bun run check:ai-runtime`: passed.
- `bun run check:sdk-imports`: passed.
- `bun run check:control-state-redundancy`: passed, 44 tables and seven allowed fact classes.
- `bun run api:routes-check`: passed, six rules across 34 route files.
- `bun run check:expert-squad-topology`: passed.
- Final full-ledger `bun run docs:check`: passed, 331 operations across 25 groups.
- `packages/opencorvus` `bun run typecheck`: passed after the checker lifecycle correction.
- Ledger consistency check: 36 unique IDs, comprising 26 P1 and ten P2; `git diff --check` and staged-diff check passed.
- Because `.gitignore` excludes `/specs/`, the audit record was explicitly staged with `git add -f`; `git ls-files --error-unmatch specs/records/2026-08/2026-08-24-repository-architecture-debt-saturation-audit.md` succeeded. The two pre-existing task-external untracked paths remain unstaged.
- Final uninvolved read-only review after ARC-036 expansion and explicit Git tracking: `PASS` with no remaining actionable finding.
- Focused shared-mechanism audit: 39 tests passed across durable Bus, Protocol scheduler delivery, Scheduler definition/fire identity, abandoned/cross-process dispatch, cancellation convergence, Task-control liveness and wake totality.
- Focused Permission replacement evidence: 22 tests passed across two-mode authority, continuation recovery and transport hydration.
- `bun run check:task-control-real` stopped at its explicit credential authorization boundary (`TASK_CONTROL_CHECK_ALLOW_REAL_PROVIDER=1`); no Provider credential or external model call was authorized or attempted, so this is unavailable evidence rather than a failed product check.
- `bun run check:dead-code`: failed with six unused Overlay files, unused `@opencorvus-ai/util`, and unlisted `ps` use in process-occurrence/supervisor code; retained as ARC-029 P2.
- First `bun run check:permission-modes`: business execution advanced through Browser, Computer, MCP, MCP App, batch, schedule and recovery evidence, then the checker's final direct Instance cleanup timed out after 120 seconds while Task-control liveness owners repeatedly failed re-entry under global disposal.
- Corrected `bun run check:permission-modes`: the Server settlement cleanup completed without the prior hang. The checker reached schedule `run`, reported `Automation run completed`, then schedule `delete` failed with `AutomationRunningConflictError` while the completed fire's control lease remained unexpired. This is the real shared-mechanism failure retained as ARC-036; focused Permission tests cannot override it.
