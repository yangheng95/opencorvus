# Repository Code Smell Continuous Audit

## Recall

### User request

The user stated that the repository was written by Artificial Intelligence (AI) and requested multiple sub-agents to perform a long-running code-smell and design-structure audit. Findings must be written while the investigation proceeds, accumulated into a long follow-up refactoring list, and iterated until further review cannot find new valid issues.

### Acceptance indicators

- Use multiple independent read-only sub-agents across complementary repository surfaces.
- Maintain one durable, evidence-backed issue register while analysis is in progress.
- Distinguish unresolved findings already recorded by the 2026-08-09 architecture-debt plan from genuinely new findings instead of duplicating entries.
- For every accepted issue, record the observable surface, direct trigger, data or control-flow root cause, why the current structure does not cure it, affected contracts and callers, concrete evidence, risk, and a bounded refactoring direction.
- Continue with cross-review rounds after the initial partitioned scan. Stop only after consecutive saturation passes produce no new valid issue and no unresolved review challenge.
- Change documentation only, except that repository-wide rules require immediate deletion of any prohibited UI automation or negative-contract test encountered in the touched paths. Product implementation remains untouched until a later user-authorized refactoring task.
- Run the repository documentation checker, obtain an independent read-only final review, fix all valid documentation findings, then commit and push only task-owned changes when Git safety rules allow it.

### Hard constraints

- `specs/current/architecture/**` remains the current architecture authority. This record is an investigation ledger and backlog, not a replacement architecture contract.
- Findings require local code, configuration, test, documentation, generated-artifact, package, or Git evidence. Names, file size, comments, and model-authored appearance are leads only.
- Large files are not findings by themselves. A finding must identify mixed ownership, duplicated authority, unsafe coupling, hidden side effects, invalid dependency direction, unverifiable behavior, or another concrete maintainability or correctness failure.
- Existing uncommitted work belongs to the user. At audit start, the dirty worktree included `bun.lock`, several package manifests and Cargo files, `packages/overlay/src-tauri/tauri.conf.json`, two deleted files under `packages/opencorvus/script/`, one deleted Expert Squad report, a GitHub Actions contract test, and both spec indexes. This task will not overwrite or stage those unrelated hunks.
- User Interface (UI) automation tests must not be run. This investigation does not change UI code, so browser visual acceptance is not applicable.
- No sub-agent may modify files or delegate again. The primary agent verifies every accepted finding and owns the ledger.
- `/specs/` is ignored by `.gitignore`; this exact new record requires an explicit force-add if it is committed.

### Sources read before investigation

- Root `AGENTS.md`.
- Root and package manifests, repository package layout, current Git status, branch, upstream, and recent history.
- All current architecture chapters under `specs/current/architecture/**`.
- `specs/records/2026-08/2026-08-09-architecture-debt-remediation-plan.md` and its P0.1 follow-up.
- Root and August 2026 spec indexes.
- Production source-file size inventory excluding tests and generated Software Development Kit (SDK) output.

### Whole-repository search baseline

- The repository has ten workspace package families and more than one thousand files under `packages/opencorvus/src`.
- The largest non-generated production authorities include Overlay native `main.rs`, engine queue, Expert Squad prompt-profile resolution, Model Context Protocol (MCP), Task API, Session loop, Overlay tree writer, server orchestrator routes, orchestrator tools, scheduler services, configuration, worktree, shell supervision, and several Overlay components.
- The 2026-08-09 plan already records repeated source-of-truth, package-boundary, process-execution, generated-source, configuration-side-effect, runtime-bootstrap, lifecycle, benchmark, security, and test-fixture problems. New rounds must search beyond those exact entries and may mark an old entry as still reproducible only when current evidence confirms it.

### Independent agent feedback

Three independent agents completed complementary core-runtime, backend/infrastructure, and surface/tooling scans, then cross-surface and repeated-pattern challenges. Their accepted and rejected leads were independently traced by the primary agent before entry. All three reported zero new admitted findings in two saturation rounds, but two late concurrent findings were then admitted and reset the saturation count. A separate final delivery reviewer remains required after the restarted saturation passes and documentation verification.

## Executive Snapshot

- Accepted register: 68 uniquely identified findings, `CS-001` through `CS-068`.
- Severity distribution: 1 P0, 36 P1, 25 P2, and 6 P3.
- Status distribution: 61 new open findings, 6 reproduced open findings from the prior debt plan, and 1 fixed-during-audit finding. The follow-up refactoring backlog therefore contains 67 open items.
- Saturation: achieved provisionally after Rounds 16 and 17 both completed with zero new findings against the stable `CS-001..068` register; independent final delivery review remains required.
- Immediate cleanup required by repository rules: the prohibited pixel-based Overlay icon test and the negative LSP-disabled runtime test were deleted; no UI automation test was run.

## Audit Method

### Finding admission rule

A candidate enters the issue register only when the primary agent can answer all of these questions from evidence:

1. What behavior or maintenance surface is observable?
2. What exact definition or call path triggers it?
3. What ownership, data-flow, or control-flow decision is the root cause?
4. Why do existing abstractions, tests, or documentation not already resolve it?
5. Which public contract, callers, stored data, tests, generated artifacts, documentation, delivery path, or operational risk is affected?
6. What is the smallest credible refactoring boundary that creates one current authority without a fallback or compatibility layer?

Pure style preferences, speculative performance claims, generated-file size, test-only duplication without a production impact, and issues already fixed on current `HEAD` are rejected.

### Severity

- `P0`: credible high-impact security, authorization, secret exposure, corruption, or irreversible-loss risk with a broad or privileged boundary.
- `P1`: reachable correctness, concurrency, lifecycle, protocol, or delivery failure with broad impact.
- `P2`: structural ownership or dependency problem likely to produce defects or make safe changes unusually difficult.
- `P3`: localized maintainability, observability, testability, or toolchain debt with a bounded impact.

### Status

- `new`: newly admitted in this audit.
- `existing-reproduced`: already described in the 2026-08-09 plan and still supported by current evidence.
- `needs-proof`: plausible lead that lacks one admission element; it is not part of the accepted total.
- `superseded`: merged into a more complete finding.
- `fixed-before-audit`: historical issue no longer reachable on current `HEAD`.
- `fixed-during-audit`: the issue existed on the audited baseline and was removed because a repository hard rule required immediate cleanup.

### Saturation rule

The audit reaches provisional saturation only after:

1. the initial complementary partition scan is complete;
2. agents cross-review surfaces they did not own in the initial scan and challenge accepted findings for false positives;
3. a pattern-directed search follows every repeated smell into unvisited packages and call sites;
4. two consecutive complete saturation passes add zero accepted findings; and
5. the final independent reviewer reports no unresolved gap in coverage, evidence, deduplication, or prioritization.

This is repository-state saturation, not a claim that future changes cannot introduce new problems.

## Coverage Matrix

| Surface | Initial owner | Cross-review owner | Evidence status |
| --- | --- | --- | --- |
| Engine, Session, Orchestrator, Task API, Project, Permission, Agent | core-runtime agent | surface/tooling agent | complete; two saturation challenges complete |
| Server, storage, scheduler, config, provider, MCP, shell, worktree, CLI | backend/infrastructure agent | core-runtime agent | complete; two saturation challenges complete |
| Overlay TypeScript/Rust, Web, channel packages, plugin, SDK, transport, util, scripts, packaging | surface/tooling agent | backend/infrastructure agent | complete; two saturation challenges complete |
| Cross-package contracts, dependency direction, generated sources, tests/docs/tooling drift | primary agent | all three agents by challenge | complete; pattern and saturation follow-up complete |

## Round Ledger

### Round 0 — baseline and protocol

- Result: complete. Architecture sources, the prior debt plan, package topology, Git baseline, production-file inventory, audit admission rules, and saturation rules were established before candidate admission.
- New accepted findings: none; this was a protocol round.
- Existing findings reproduced: none.
- Rejected leads: file size and AI-authored appearance as evidence by themselves.
- Coverage gaps carried forward: all partitioned source inspection and cross-package dependency analysis.

### Round 1 — complementary partition scan

- Result: complete. All three independent partitions returned evidence, rejected leads, and explicit coverage gaps. The primary agent re-read each accepted path and normalized duplicates against the prior debt plan and the live register.
- Findings first admitted in this round: `CS-001` through `CS-031`; reproduced prior-debt entries are identified by status inside the register.
- Existing findings reproduced: `CS-006`, `CS-013` through `CS-016`, and `CS-031`.
- Rejected leads: large files and AI-authored appearance; unproven type assertions; Build attachment staging; conservative external-provider permission classification; the Mission in-process lock key; Plugin initialization subscription leakage; partial channel startup as a product-policy claim without the now-recorded concrete false status/owner loss; Worktree garbage collection probe errors without a demonstrated unsafe delete; operator-configured remote MCP URLs without a stated server-side request forgery contract; and several fail-open-looking core settlement paths whose durable recovery was verified.
- Coverage gaps carried forward: Architect output publication; Session message/event fault injection; Permission ledger multi-process recovery; Mission caller receipt/recovery races; scheduler route and post-turn protocol comparison; detailed channel webhook cryptography/HTTP semantics; MCP tool materialization/input security; provider vendored protocol adapters; updater/signature semantics; deploy behavior on a real host; templates and Skills not reached by the first pattern inventory.

### Round 2 — cross-surface challenge

- Result: complete. Each initial partition was reviewed outside its original owner; all `CS-001` through `CS-006` were upheld in the first challenge wave, while surface findings received scope/severity corrections.
- New accepted findings: `CS-032` through `CS-034`.
- Challenges applied: `CS-009` is confined to the main Tauri renderer rather than arbitrary browser content; `CS-010` is P1 and has a production global-bridge consumer; `CS-014` is a source-topology cycle rather than a package-manager cycle; `CS-015` is proven for the manual npm publish path only; `CS-017` covers shared/public packages and the reproducible inventory is 19 files / 90 test or `it` call sites; `CS-018` is now fixed during the audit.
- Rejected/gaps closed: engine terminal-ingress retry and Agent terminal handoff have positive settlement/recovery coverage; no new Task cancellation or Project lease fault was proven; Skill import/archive replacement has caught-error rollback, while the durable crash window and live Git pull remain under `CS-024`; provider catalog refresh is real and only live-model refresh is empty.
- New gaps carried forward: unbounded lifecycle observers/buffers, ignored public parameters, and structured conflict/error facts discarded before persistence.

### Round 3 — repeated-pattern directed scan

- Result: complete. The scan followed empty-success, swallowed-authority errors, text protocols, ignored inputs, short identities, non-durable mutations, zombie islands, and lost terminal/conflict facts through unvisited call paths.
- New accepted findings: `CS-035` through `CS-041`. Four cross-surface candidates arrived during the same pattern pass and were admitted only after primary-agent evidence review; their final identifiers are `CS-038` through `CS-041`.
- Rejected leads: Provider plugin/auth failures that already produce `LoadIssue`; provider refresh invalidation that uses structured issues; Session summary storage receipts; auxiliary Engine event-log warnings; Git-lock diagnostic owner JSON; channel shared-session/mirror failures without a proven external contract break; storage DDL rendering as a current correctness failure; restart bind error-text classification without a proven cross-platform mismatch.
- Coverage gaps carried forward: other ownership observation readers, other config/auth consumers, other renderer recovery classifiers, and fault-injection proof for the three admitted paths.
- Primary cross-package follow-up is checking the split backend/Overlay definition of displayable Conversation messages and the resulting live-versus-hydrated projection behavior.
- A suspected Plugin event-subscription leak was rejected after lifecycle tracing: the production bootstrap initializer is identity-deduplicated per Instance; refresh and rollback dispose the directory-keyed Bus state before rebuilding it; no production caller invokes `Plugin.init` outside that bootstrap.

### Round 3b — pattern-directed follow-up and calibration

- Result: complete. The primary agent traced error-to-empty fallbacks, destructive absence proofs, human-text control protocols, discarded parameters, process-signal owners, startup receipts, and cross-resource mutations across previously unvisited call sites; all three cross-reviewers returned explicit verdicts.
- Accepted findings calibrated in this follow-up: `CS-035` through `CS-041`.
- Cross-review corrections: `CS-033` was narrowed because raw lifecycle events and the independent Agent view are consumed by Overlay; `CS-034` was rewritten because persistence derives non-empty structured conflicts and the actual defect is `terminal_success` workflow advancement after domain rejection; `CS-040` was reduced to P1 because remote route reachability was not dynamically established.
- Rejected pattern matches: attachment observation preserves failure; Provider loading exposes `LoadIssue`; Task cancellation, runtime-server ownership, sidecar locking, terminal Session publication, and inspected lease paths fail closed or retain durable settlement; recovery of a recorded Worktree with an unreadable directory may attempt `git worktree add`, but the command itself fails rather than overwriting non-empty contents, so no destructive effect was proven.
- Coverage gaps carried forward: focused sweeps of remaining destructive consumers, detached loop owners, public error/status boundaries, duplicate terminal outcome constructors, and Task initial-permission consumers.

### Round 4 — saturation challenge

- Result: complete, zero new accepted findings across all three independent audit surfaces.
- Core/runtime challenged ownership observation, Config/Auth consumers, post-Turn settlement, projection, cancellation, and lease paths.
- Backend/infrastructure challenged fail-open empties, irreversible actions, identity observations, registry completeness, process and signal lifecycle.
- Surface/tooling challenged human-text protocols, hidden bridges, listener cleanup, cross-package topology, generated-source boundaries, and check/test inventories.
- Calibration applied: `CS-036` is scoped to explicit managed-Worktree removal and GC candidates not otherwise protected by a sandbox binding; `CS-040` is P1 unless deployment reachability/authentication evidence later proves a wider exposure; `CS-041` describes an unowned resource-leak window rather than asserting every adapter failure leaks.

### Round 5 — independent final saturation pass

- Result: complete, zero new accepted findings across all three independent audit surfaces.
- Core/runtime repeated cross-process ownership/lease, terminal settlement, Conversation visibility, cancellation, and recovery analysis.
- Backend/infrastructure repeated cross-resource transaction, secret/config persistence, process/signal lifecycle, registry completeness, and fail-open analysis.
- Surface/tooling repeated text protocols, renderer/host privilege bridges, projection recovery, cross-package private imports, and required-check coverage.
- With Round 4 also at zero, this pass temporarily met the stated repository-state saturation threshold. The later admission of `CS-042` and `CS-043` invalidated that closure and reset the consecutive-zero count.

### Round 6 — delivery-review concurrency reconciliation

- Result: complete, two late findings admitted: `CS-042` and `CS-043`.
- The final independent review detected that these entries had arrived concurrently after the prior identity/count checks. The primary agent re-read their production paths and confirmed both complete failure chains: Task creation commits its Session, Task graph, and initial permission in three stages; the native Overlay supervisor retains and reuses a physically live sidecar after health-readiness failure.
- Consequence: the register changed from 41 to 43 findings, the open backlog changed from 40 to 42, prior zero-new saturation was invalidated, and the final review was correctly rejected rather than papering over the drift.
- Required follow-up: repeat two complete saturation passes over the new cross-resource creation and physical-liveness-versus-readiness patterns, then repeat independent final review.

### Round 7 — restarted saturation pass

- Result: complete, one new finding admitted: `CS-044`.
- Surface/tooling and backend/infrastructure returned zero new findings while upholding `CS-042` and `CS-043`. Core/runtime traced the same create-then-populate crash pattern into the public Session fork path, where the target Session is published before messages and Parts are copied through independent transactions.
- Consequence: this round cannot count toward saturation. The register changed from 43 to 44 findings, the open backlog changed from 42 to 43, and the consecutive-zero count reset again.

### Round 8 — clone/import and readiness saturation pass

- Result: complete, five new findings admitted: `CS-045` through `CS-049`.
- Core/runtime followed readiness receipts into the public server lifecycle routes and confirmed that `/restart` and `/shutdown` return success before any exact lifecycle operation is accepted. Backend/infrastructure traced destructive absence proof, domain-partial settlement, and cross-resource durable mutation into Project sandbox discovery, Frontend Design, and Provider removal. Surface/tooling completed its clone/import, generated-delivery, and recovery sweep.
- Surface/tooling traced a supposedly synchronous Board refresh from Overlay through the route into Task API and confirmed that every layer carries the option while the read-only implementation ignores it.
- Consequence: this round cannot count toward saturation. The register changed from 44 to 49 findings, the open backlog changed from 43 to 48, and the consecutive-zero count reset again.

### Round 9 — post-expansion saturation pass A

- Result: complete, two new findings admitted: `CS-050` and `CS-051`.
- Core/runtime traced create-before-complete into right-sidebar Conversation model selection. Backend/infrastructure traced crash residue into deterministic Worktree reuse, where physical Git validity is treated as full population readiness. Surface/tooling returned zero additional findings while independently upholding `CS-045` through `CS-049`.
- Consequence: this round cannot count toward saturation. The register changed from 49 to 51 findings, the open backlog changed from 48 to 50, and the consecutive-zero count reset again.

### Round 10 — post-expansion saturation pass B

- Result: complete, six new findings admitted: `CS-052` through `CS-057`.
- Core/runtime traced Task message acceptance and Intent blocker settlement; backend/infrastructure proved Remote Skill truncation and incomplete Research success promotion; surface/tooling traced native startup retry duplication and Channel shared-Session claim splitting.
- Consequence: this round cannot count toward saturation. The register changed from 51 to 57 findings, the open backlog changed from 50 to 56, and the consecutive-zero count reset again.

### Round 11 — post-message/cache saturation pass

- Result: complete, one new finding admitted: `CS-058`.
- Core/runtime followed side-effects-before-acceptance into Mission wake/dispatch and pending-prompt consumption. Backend/infrastructure and surface/tooling returned zero other findings while upholding the expanded register and challenging snapshot/transaction boundaries.
- Consequence: this round cannot count toward saturation. The register changed from 57 to 58 findings, the open backlog changed from 56 to 57, and the consecutive-zero count reset again.

### Round 12 — Mission/message occurrence saturation pass

- Result: complete, one new finding admitted: `CS-059`.
- Core/runtime proved Channel ingress consumes a pending interaction before committing its independent request receipt, so replay of the same stable request ID can route the same text into a different business mutation. Backend/infrastructure and surface/tooling returned zero other findings while upholding `CS-054` through `CS-058`.
- Consequence: this round cannot count toward saturation. The register changed from 58 to 59 findings, the open backlog changed from 57 to 58, and the consecutive-zero count reset again.

### Round 13 — replay-routing saturation pass

- Result: complete, five new findings admitted: `CS-060` through `CS-064`.
- Core/runtime traced global create replay through randomly allocated Project namespaces. Backend/infrastructure found non-shared Channel Session initialization races and incomplete local-plugin installation readiness. Surface/tooling proved public Release asset overwrite and partial bundled-environment acceptance.
- Consequence: this round cannot count toward saturation. The register changed from 59 to 64 findings, the open backlog changed from 58 to 63, and the consecutive-zero count reset again.

### Round 14 — expanded-pattern saturation pass A

- Result: complete, three new findings admitted: `CS-065` through `CS-067`.
- Surface/tooling proved the SDK generation publisher can leave final artifacts split across generations after process termination and deletes its only backup before checking residue. Core/runtime found the same physical-metadata readiness error in the shared Bun package cache. Backend/infrastructure found Provider OAuth compresses public authorization occurrences into one overwriteable process-local slot.
- Consequence: this round cannot count toward saturation. The consecutive-zero count reset again.

### Round 15 — generation-publication saturation pass

- Result: complete, one new finding admitted: `CS-068`.
- Core/runtime proved that the public ControlMessage contract accepts a stable request ID but never reserves a request-level occurrence, so response loss can rerun the whole model Turn and its tool mutations. Backend/infrastructure and surface/tooling found no additional admitted chain against the same `CS-001..067` baseline.
- Consequence: this round cannot count toward saturation. The register changed from 67 to 68 findings, the open backlog changed from 66 to 67, and the consecutive-zero count reset again.

### Round 16 — request-occurrence saturation pass A

- Result: complete, zero new accepted findings across all three independent audit surfaces. This is the first consecutive zero-new pass after `CS-068`.
- Provider adapters, Scheduler/Session persistence, updater/deploy, Templates/Skills, and every explicit public stable request identity were sampled. Durable fire/run/interaction authorities and deterministic Message identities rejected adjacent candidates; existing failures remain covered by the stable register.
- Coverage gaps retained: no real provider/OAuth, scheduler kill/restart, updater/deploy host, package-manager kill point, or UI automation execution.

### Round 17 — final saturation confirmation

- Result: complete, zero new accepted findings across all three independent audit surfaces. Together with Round 16, this satisfies the two-consecutive-zero saturation rule against the stable `CS-001..068` register.
- Cross-domain challenges sampled public stable identities, Scheduler and Session persistence, Provider adapters/OAuth, updater/deploy/release, Templates/Skills, package readiness, multi-artifact generation, terminal outcomes, and destructive observation. Similar findings retained distinct mutation owners, triggers, and repair boundaries; no severity change or false-positive removal was supported.
- Remaining gaps are explicitly dynamic: process kill/replay, OAuth/browser concurrency, real Provider streams, GitHub Release fixture behavior, updater/deploy hosts, and UI runtime. They are future verification inputs rather than newly evidenced static findings.

## Accepted Issue Register

### `CS-001` — Build terminal facts fail open when both durable writes fail

- Severity / status / confidence: `P1` / `new` / high.
- Owners and affected surfaces: Build Agent, Task Artifact persistence, Orchestrator Build adapter, durable Task settlement.
- Observable surface: a physical Build run can return an ordinary terminal outcome even though neither its Host observation nor the infrastructure-error artifact was persisted.
- Direct trigger: `recordTaskLevelBuildHostObservation` throws, then `recordTaskInfrastructureError` also throws while the physical run itself has no `runError`.
- Root cause and control/data flow: `recordInfrastructureFailure` catches its own persistence failure and only logs it. No locator is appended, so `BuildAgent.run` returns with an empty infrastructure-locator list; `createBuildTool` interprets that empty list as terminal success.
- Why the current structure does not cure it: `DispatchOutcome.partial` exists, but can only be selected when the error evidence itself was successfully stored. Terminal-fact publication is therefore best effort rather than a required settlement step.
- Evidence: `packages/opencorvus/src/build/agent.ts:938-1018`; `packages/opencorvus/src/orchestrator/build-tool.ts:148-157`.
- Contract, data, test, documentation, delivery, and risk impact: violates exact durable settlement in the Task control-plane contract; leaves Build code/Session state without the required Host fact; recovery, Review, and Acceptance can interpret absent evidence as success. No focused positive test covers simultaneous observation and infrastructure-artifact persistence failure.
- Bounded refactoring direction: introduce one durable terminal-fact publication operation whose receipt is required before returning terminal; on publication failure keep the physical result but return a typed settlement failure owned by the same retry authority. Delete the log-only success path.
- Required positive verification for a future repair: inject both write failures after a successful physical run, prove no terminal-success settlement is emitted, then recover the same observation identity and prove exactly one durable fact produces terminal success.
- Deduplication / relationship: distinct from prior generic queue and terminal-invariant findings because this is the Build adapter's reachable double-write failure path.

### `CS-002` — Project directory lookup performs an implicit generic cross-table migration

- Severity / status / confidence: `P1` / `new` / high.
- Owners and affected surfaces: Project discovery, SQLite schema ownership, Instance entry, all domain tables with `project_id`.
- Observable surface: merely opening a directory can rewrite every table containing a `project_id` column and delete a duplicate Project row.
- Direct trigger: duplicate Project rows resolve to the same worktree and cached/local identity chooses a preferred row during `Project.fromDirectory`.
- Root cause and control/data flow: `ProjectTable.worktree` lacks durable uniqueness; normal directory resolution enumerates SQLite schema, dynamically finds all `project_id` tables, performs generic updates, applies a few local special cases, and deletes the duplicate.
- Why the current structure does not cure it: the special cases do not establish the invariants of every present or future domain table. Read/registration and repair/migration remain one hidden side-effecting operation.
- Evidence: `packages/opencorvus/src/project/project.sql.ts:7-30`; `packages/opencorvus/src/project/project.ts:194-260,343-418,583-637`; `packages/opencorvus/src/project/instance.ts:152`.
- Contract, data, test, documentation, delivery, and risk impact: any Instance entry can trigger an invisible schema-wide write; provenance, compound uniqueness, Artifact ownership, and domain events can be rewritten without their domain contracts. Existing tests do not prove whole-database conservation for this generic migration.
- Bounded refactoring direction: make lookup/register resolve one unique identity and return a typed conflict when historical duplicates exist; move repair into one explicit schema migration that enumerates domain-owned mappings, then delete `mergeExactWorktreeRows` from the resolver.
- Required positive verification for a future repair: normal lookup of duplicated worktrees returns the typed conflict with an unchanged database; the explicit migration then converges every enumerated domain invariant and subsequent lookup returns one identity.
- Deduplication / relationship: extends beyond the prior Project identity debt by identifying the generic schema enumeration and mutation hidden inside the read path.

### `CS-003` — Mission Session identity is committed in two transactions

- Severity / status / confidence: `P1` / `new` / high.
- Owners and affected surfaces: Mission Session creation, Session events, restart recovery, Mission list and wake paths.
- Observable surface: a durable `kind="mission"` Session can exist and publish creation events without `metadata.mission.id`; retry ignores that row and can create another Mission Session.
- Direct trigger: `Session.createNext` commits, then metadata merge fails or the process exits before it commits.
- Root cause and control/data flow: Mission creation first inserts the Session without canonical Mission metadata, then calls `Session.mergeMetadata`; lookup only matches rows whose JSON metadata already contains the target Mission ID. The in-process lock cannot close a crash cut.
- Why the current structure does not cure it: `Session.createNext` already accepts metadata, but the Mission path does not use it, and schema constraints do not enforce complete/unique Mission identity.
- Evidence: `packages/opencorvus/src/mission/session.ts:65,140-155,365-430`; `packages/opencorvus/src/session/index.ts:351-403,520-538`; `packages/opencorvus/src/session/session.sql.ts:89-122`; `packages/opencorvus/test/mission-durable-activity.test.ts:32-58`.
- Contract, data, test, documentation, delivery, and risk impact: violates restart-safe standalone Mission recovery; creates orphan or duplicate Sessions and publishes an invalid initial event. Current tests cover repeated same-process calls, not the transaction boundary.
- Bounded refactoring direction: create the Session once with canonical immutable Mission metadata; treat runtime-directory creation as independently retryable derived state; add one durable uniqueness authority if the identity must be database-enforced, and delete create-then-merge.
- Required positive verification for a future repair: crash immediately after the Session commit, restart, and prove the same complete Session is returned; the first Created event contains canonical metadata and no duplicate row appears.
- Deduplication / relationship: new concrete crash window, not the prior broad Mission-runtime separation debt.

### `CS-004` — Tool execution has four divergent wrapper protocols

- Severity / status / confidence: `P2` / `new` / high.
- Owners and affected surfaces: Plugin API, Session loop, registry tools, MCP tools, projected/stage extra tools, batch child tools, attachment materialization.
- Observable surface: registry, MCP, batch-child, and extra tools do not produce the same Plugin hooks or hook payload stage. Extra tools omit the hooks; MCP `after` observes a raw result; registry `after` observes a materialized result.
- Direct trigger: one Plugin relies on `tool.execute.before/after` while Agents invoke tools from different sources.
- Root cause and control/data flow: permission, hooks, physical execution, lifecycle, materialization, stamping, and persistence are separately reimplemented by four wrappers. `withTaskToolInvocation` unifies only a subset of the envelope.
- Why the current structure does not cure it: shared materialization helpers do not own ordering or hook coverage; the extra wrapper explicitly mirrors registry stamping, confirming duplicated protocol ownership.
- Evidence: `packages/plugin/src/index.ts:247-262`; `packages/opencorvus/src/session/loop.ts:2439-2555,2638-2761,3350-3514`; `packages/opencorvus/src/tool/batch.ts:87-236`.
- Contract, data, test, documentation, delivery, and risk impact: a nominally universal Plugin audit, policy, telemetry, or transformer hook silently misses tools or sees incompatible shapes. No positive contract test spans all four sources.
- Bounded refactoring direction: establish one execution envelope covering identity, permission, before hook, physical executor, provider lifecycle, normalization/materialization, after hook, and ToolPart persistence; source-specific code supplies only the physical adapter. Delete local wrappers.
- Required positive verification for a future repair: invoke all four sources with one Plugin and prove exactly one before/after pair per call, the same stable call identity and standardized materialized output, and identical argument/output transformation semantics.
- Deduplication / relationship: related to the existing oversized Session-loop authority but admitted on specific observable protocol divergence.

### `CS-005` — Tool-result parking persists two current control protocols

- Severity / status / confidence: `P2` / `new` / high.
- Owners and affected surfaces: Tool metadata, Session processor, wait, Task lifecycle, coordination, runtime repair, handoff.
- Observable surface: the reader accepts both a legacy boolean `opencorvusParkAfterToolResult` and a typed `opencorvusToolResultControl`, while current wait/lifecycle/repair producers continue writing the legacy form and typed `immediate_park` has no production writer.
- Direct trigger: wait success, Task completion/failure, coordination failure, or runtime repair emits a Tool result.
- Root cause and control/data flow: the handoff path adopted the typed object, but park producers and the Session reader retained the old key, making a single turn-control decision depend on two persisted authorities.
- Why the current structure does not cure it: a dual reader masks incomplete migration and guarantees new persisted data still uses the old protocol.
- Evidence: `packages/opencorvus/src/session/tool-result-control.ts:1-43`; `packages/opencorvus/src/orchestrator/task-lifecycle-tools.ts:170-193`; `packages/opencorvus/src/orchestrator/tools.ts:2074-2081`; `packages/opencorvus/src/orchestrator/runtime-repair-tools.ts:204-213`; `packages/opencorvus/src/tool/wait.ts:99-110`; `packages/opencorvus/src/tool/request-orchestrator-decision.ts:104-107,131-134`; `packages/opencorvus/src/session/processor.ts:813-827`.
- Contract, data, test, documentation, delivery, and risk impact: persisted ToolParts have two schemas for one behavior; future control variants can update only one branch. No focused protocol test establishes one current writer/reader contract.
- Bounded refactoring direction: migrate every producer to `{kind:"immediate_park"}`, make the reader accept only the typed control, and delete the legacy constant and boolean branch in the same change.
- Required positive verification for a future repair: each producer persists the typed control and Session processing parks from that single schema; stored ToolPart metadata parses through the one control contract.
- Deduplication / relationship: new protocol migration defect.

### `CS-006` — Native Agent registries duplicate Bun-specific snapshot caches

- Severity / status / confidence: `P3` / `existing-reproduced` / high.
- Owners and affected surfaces: Host, Helper, and Primary Agent registries; native Agent materialization; runtime portability.
- Observable surface: three registries independently implement module-level scoped maps, configuration serialization/hash keys, state creation, and resets, all keyed by `Bun.hash.xxHash64(JSON.stringify(config))`.
- Direct trigger: consumers request a materialized Agent registry for an explicit configuration snapshot.
- Root cause and control/data flow: materialization was centralized, but the revision and scoped-cache lifecycle above it were copied three times; explicit snapshots remain in module maps until manual reset.
- Why the current structure does not cure it: instance state covers only default state, not scoped configuration caches. The prior debt plan recorded two copies, while current search proves the Helper registry is a third.
- Evidence: `packages/opencorvus/src/agent/host-agent-registry.ts:41-64,87-93`; `packages/opencorvus/src/agent/helper-agent-registry.ts:57-89,118-124`; `packages/opencorvus/src/agent/primary-assistant-registry.ts:104-169,205-211`; `packages/opencorvus/src/agent/native-agent-materializer.ts:9-47`; 2026-08-09 debt plan lines 272-277.
- Contract, data, test, documentation, delivery, and risk impact: no runtime-neutral revision authority, collision/lifecycle contract, or shared cache behavior; common materialization remains bound to Bun and leaks duplicated maintenance.
- Bounded refactoring direction: one runtime-neutral configuration revision function and one shared scoped-materialization cache primitive; registries provide only definitions/build logic, then delete all three local map/key/reset implementations.
- Required positive verification for a future repair: identical config produces the same revision on supported hosts; all three registries use the shared cache and expose explicit revision-change/reset state results.
- Deduplication / relationship: reproduces and broadens the prior Host/Primary registry item.

### `CS-007` — Overlay retains unreachable feature islands that tests make look live

- Severity / status / confidence: `P3` / `new` / high for reachability, medium for product intent.
- Owners and affected surfaces: Overlay terminal UI/service, browser-preview link service, Expert Squad market catalog service, path utility, unit-test inventory.
- Observable surface: production reachability analysis reports `TerminalPanel.tsx`, its terminal service, browser-preview link, Expert Squad market catalog, and path utility as unused. Repository search confirms their only consumers are either each other or test files; a second `relativePathFrom` implementation in `utils/tool.ts` is the live production authority.
- Direct trigger: maintainers inspect or change these apparently supported capabilities, or rely on their passing tests as evidence that the shipping Overlay uses them.
- Root cause and control/data flow: feature code and feature-specific tests survived removal/unwiring from the real entry graph. The test roots directly import abandoned modules and therefore exercise an island, not the shipped application.
- Why the current structure does not cure it: TypeScript compilation accepts unreachable modules; isolated tests preserve the illusion of a supported capability; the dead-code checker is not a required delivery gate and currently has configuration defects described by `CS-008`.
- Evidence: `bun run check:dead-code` output on 2026-08-12; `packages/overlay/src/components/TerminalPanel.tsx`; `packages/overlay/src/services/terminal.ts`; `packages/overlay/src/services/browser-preview-link.ts`; `packages/overlay/src/services/expert-squad-market-catalog.ts`; `packages/overlay/src/utils/path.ts`; direct-import tests under `packages/overlay/test`; live duplicate at `packages/overlay/src/utils/tool.ts`.
- Contract, data, test, documentation, delivery, and risk impact: dead implementation and UI tests raise maintenance cost and can support false claims of coverage. Product intent for the unused terminal and catalog features is unknown, so future work must decide removal versus reintegration before changing them.
- Bounded refactoring direction: resolve product intent; if unsupported, delete each dead island and tests/fixtures serving only it; if supported, wire it through the one real UI/service composition and perform real-page visual acceptance. Consolidate `relativePathFrom` to one production utility.
- Required positive verification for a future repair: dead-code analysis reports no island; supported UI behavior is verified through the real page and screenshot, while removed capabilities leave no feature-only test/config artifacts.
- Deduplication / relationship: distinct from generic dead-code debt because the isolated tests actively disguise production unreachability.

### `CS-008` — Repository quality commands do not describe or enforce one check surface

- Severity / status / confidence: `P2` / `new` / high.
- Owners and affected surfaces: root scripts, Turbo tasks, GitHub Actions, Web/Astro, AI runtime dependency contract, Knip workspace graph.
- Observable surface: root `typecheck` runs SDK import, AI runtime compatibility, then Turbo; the workflow named `typecheck` bypasses that root command and therefore omits `check:ai-runtime`. Turbo has no `typecheck` task for Web because Web exposes only `check`. The dead-code command omits Web and transport-protocol, is absent from CI/pre-push, currently reports real dead islands plus a false positive for the Vite `native-menu.html` entry, and reports undeclared production binaries/dependencies.
- Direct trigger: a contributor or workflow treats `bun run typecheck`, the `typecheck` workflow, or `check:dead-code` as the repository-wide quality authority.
- Root cause and control/data flow: related checks are composed independently in root scripts, per-package script names, Turbo, workflow YAML, and Knip workspace/entry lists. No generated or shared manifest defines the repository check surface.
- Why the current structure does not cure it: duplicate explicit workflow steps cover only some root subchecks; deployment happens to run Astro check on a path-filtered main workflow, which is not equivalent to repository typecheck. Knip's false positive and omissions make its failure non-actionable and easy to ignore.
- Evidence: `package.json:18-21`; `.github/workflows/typecheck.yml:23-37`; `packages/web/package.json:13-16`; `packages/transport-protocol/package.json:12-13`; `knip.config.js:38-97`; `bunx turbo run typecheck --dry=json`; failing `bun run check:dead-code` output on 2026-08-12; Vite multi-entry declarations in `packages/overlay/vite.config.ts` and `packages/overlay/src/native-menu.html`.
- Contract, data, test, documentation, delivery, and risk impact: Web type errors and AI runtime drift can pass the general typecheck workflow; dead dependencies/islands accumulate behind a permanently red optional command. The command names overstate their actual coverage.
- Bounded refactoring direction: define one repository verification composition invoked identically by local and CI entrypoints; give every typed workspace the same task contract (including Astro); make dead-code analysis cover all intended workspaces and real Vite entries, then enforce its clean result in the appropriate delivery checker.
- Required positive verification for a future repair: a dry task graph names every typed workspace and AI compatibility check; the workflow invokes that exact composition; corrected Knip configuration reaches all intended workspaces/entries and exits clean after real findings are resolved.
- Deduplication / relationship: consolidates related checker drift into one authority problem rather than filing each missing command separately.

### `CS-009` — Desktop renderer can invoke an unrestricted native file writer

- Severity / status / confidence: `P0` / `new` / high.
- Owners and affected surfaces: transport protocol, Overlay host transport, Tauri command boundary, project-config scaffold.
- Observable surface: the renderer-facing native protocol accepts arbitrary `path` and `content`; Rust creates the supplied parent directory and overwrites that path with no project-root, filename, canonical-path, symlink, or authority-token restriction.
- Direct trigger: any code executing in the renderer invokes `config.write-file` / `overlay_write_file` with a path writable by the desktop user.
- Root cause and control/data flow: a business operation—scaffolding `.opencorvus/opencorvus.jsonc` under a selected project—was elevated into a generic native filesystem capability at the renderer/native privilege boundary.
- Why the current structure does not cure it: the discriminated union validates only field types; the sole normal caller's safe-looking path construction is not an authority check on other renderer callers.
- Evidence: `packages/transport-protocol/src/index.ts:1032,1249-1250`; `packages/overlay/src/services/host-transport.ts:178`; `packages/overlay/src/services/tauri-transport.ts:613-614`; `packages/overlay/src-tauri/src/main.rs:1868-1879,5618,5651`; normal caller `packages/overlay/src/services/config.ts:468-506`.
- Contract, data, test, documentation, delivery, and risk impact: a renderer compromise or injected dependency gains arbitrary user-writable-file overwrite through an approved release command. Existing capability tests establish presence, not confinement.
- Bounded refactoring direction: delete the generic command and expose one native `config.scaffold-project` operation accepting a native-issued project-root identity, canonicalizing the root, fixing the relative target, rejecting links/reparse escapes, and performing an explicit create/replace policy atomically.
- Required positive verification for a future repair: valid selected roots return a typed receipt with canonical target and digest; out-of-root and link-escape attempts return a stable authority error while the target remains unchanged.
- Deduplication / relationship: new concrete native authority escalation; not the generic prior security-boundary debt.

### `CS-010` — Release renderer publishes live stores, plaintext password, and mutators as globals

- Severity / status / confidence: `P1` / `new` / high for exposure, medium for exploitability.
- Owners and affected surfaces: Overlay bootstrap, settings authentication state, benchmark/test diagnostics.
- Observable surface: `installGlobalBridges()` runs unconditionally and places complete `settingsStore`, `appStore`, and `boardStore` objects plus settings persistence, workspace switching, Task loading/selection, and board loading functions on `window`. `settingsStore` includes the plaintext server password used for API configuration.
- Direct trigger: any renderer script or DevTools expression reads the globals or invokes the exposed business mutators in a release build.
- Root cause and control/data flow: test and benchmark observation were coupled directly to live production state containers instead of a redacted, read-only, build-scoped diagnostics contract.
- Why the current structure does not cure it: the host transport boundary is bypassed entirely; production workspace code itself calls `window.persistOverlaySettings`, so a test bridge has become an internal production dependency rather than an isolated diagnostic hook.
- Evidence: `packages/overlay/src/main.tsx:1644-1670,1933-1940`; `packages/overlay/src/store/settings.ts:16-20,108-112,156-166`; `packages/overlay/src/services/workspace.ts:775-780`.
- Contract, data, test, documentation, delivery, and risk impact: release renderer code receives credentials, project/Task state, and a hidden write-capable ABI. This materially expands the impact of renderer script execution but does not itself prove a remote execution entry, so P0 was reduced to P1 after cross-review.
- Bounded refactoring direction: remove live stores and mutators from release globals. If diagnostics remain required, gate one development-only adapter that returns a fixed immutable redacted snapshot and performs no business writes.
- Required positive verification for a future repair: release bundle/runtime public-global manifest contains only approved production APIs; development diagnostics omit secrets and return a typed snapshot rather than store references.
- Deduplication / relationship: new privilege/secret surface.

### `CS-011` — JavaScript SDK parses human log text as the server startup protocol

- Severity / status / confidence: `P1` / `new` / high.
- Owners and affected surfaces: JavaScript SDK server lifecycle, CLI `serve`, process readiness handoff.
- Observable surface: SDK startup concatenates stdout, searches for the English phrase `server listening`, and extracts a URL with a regular expression. Equivalent logging changes, coloring, localization, or output routing can break the API.
- Direct trigger: the CLI changes the log phrase or format while still starting the server correctly.
- Root cause and control/data flow: no machine-readable readiness handoff exists, so human console output became an undocumented cross-package API; the fake-process test repeats the same string. `resolveCommand` also runs a synchronous three-second probe whose success and failure both return the same command.
- Why the current structure does not cure it: typed SDK objects start only after the untyped log scrape; tests prove duplicated wording, not a real protocol.
- Evidence: `packages/sdk/js/src/server.ts:22-30,47-60,61-121`; `packages/opencorvus/src/cli/cmd/serve.ts:175-180`; `packages/sdk/js/test/server.test.ts:227`.
- Contract, data, test, documentation, delivery, and risk impact: a cosmetic CLI change can break every `createOpenCorvusServer` consumer; URL, process identity, readiness, and terminal ownership lack a versioned contract.
- Bounded refactoring direction: add one machine startup mode emitting a versioned envelope over a dedicated pipe or atomic handoff file; SDK parses only that envelope. Delete log scraping and the no-op command probe.
- Required positive verification for a future repair: start the real CLI on port zero, validate the envelope and health endpoint, then close the same process occurrence and receive a terminal receipt; malformed envelopes yield `StartupProtocolError`.
- Deduplication / relationship: related to process ownership but separately reachable at the public SDK/CLI protocol.

### `CS-012` — Channel runtime has no public bootstrap and is assembled twice

- Severity / status / confidence: `P2` / `new` / high.
- Owners and affected surfaces: `opencorvus` Channel supervisor, channel-runtime package boundary and standalone entry.
- Observable surface: `opencorvus` does not declare channel-runtime as a dependency, yet dynamically imports many sibling private `src` modules and assembles runtime/providers/adapters. `channel-runtime/src/main.ts` independently repeats the assembly.
- Direct trigger: a private path, adapter set, provider setup, or packaging mode changes in only one assembly path.
- Root cause and control/data flow: the package exposes components and a registry but no complete parameterized application bootstrap, forcing each host to own a second composition root.
- Why the current structure does not cure it: the public index is incomplete and the registry does not unify environment parsing, provider, Speech-to-Text (STT), vision, adapter setup, or readiness output.
- Evidence: `packages/opencorvus/src/channel/supervisor.ts:221-285`; `packages/channel-runtime/src/main.ts:1-124`; `packages/channel-runtime/src/index.ts:1-20`; absence of `@opencorvus-ai/channel-runtime` in `packages/opencorvus/package.json`.
- Contract, data, test, documentation, delivery, and risk impact: standalone and in-process modes can expose different adapters/config semantics; package builds rely on undeclared private layout. No equivalence contract test covers the two modes.
- Bounded refactoring direction: channel-runtime owns one public `createConfiguredChannelRuntime` taking explicit config/env/server/abort inputs; both entries call it, `opencorvus` declares the workspace dependency, and all sibling private imports/duplicate assembly are deleted.
- Required positive verification for a future repair: both modes fed the same explicit configuration report identical adapter IDs, configuration digest, STT/vision capabilities, and readiness receipt; package-boundary checking sees only public declared imports.
- Deduplication / relationship: new cross-package composition problem.

### `CS-013` — Process execution still has multiple runtime-specific authorities

- Severity / status / confidence: `P1` / `existing-reproduced` / high.
- Owners and affected surfaces: Plugin public ABI, channel local STT, SDK server lifecycle, process supervisor.
- Observable surface: Plugin input exposes Bun shell directly; runtime injects `Bun.$`; channel local CLI manually splits command strings and uses Node `spawn`; SDK owns another spawn/timeout/process-tree termination implementation.
- Direct trigger: quoted arguments, executable paths with spaces, timeout, abort, Windows child trees, or a non-Bun host.
- Root cause and control/data flow: a runtime-neutral process authority exists directionally but never became the only capability; the public Plugin ABI itself preserves a bypass.
- Why the current structure does not cure it: callers' private timeout/kill/result logic and `PluginInput.$` cannot be reconciled by a separate host process primitive.
- Evidence: `packages/plugin/src/index.ts:14,31`; `packages/plugin/src/shell.ts:10-136`; `packages/opencorvus/src/plugin/index.ts:125,210`; `packages/channel-runtime/src/stt/providers/local-cli.ts:3,22,46,86,222`; `packages/sdk/js/src/server.ts`.
- Contract, data, test, documentation, delivery, and risk impact: argument parsing, cancellation, output streaming, occurrence identity, and termination semantics drift across public and internal paths; portability remains Bun/Node/PowerShell specific.
- Bounded refactoring direction: replace every path with one runtime-neutral structured process facade owning executable/argv, cwd/env, AbortSignal/timeout, streaming output, occurrence ID, process-tree termination, and terminal receipt; delete Bun shell from the Plugin ABI and all private terminators.
- Required positive verification for a future repair: Plugin, local STT, and SDK server run through the same facade and return the same typed success/timeout/cancel receipts for paths and arguments containing spaces.
- Deduplication / relationship: reproduces the 2026-08-09 process-execution authority item with additional public ABI and package evidence.

### `CS-014` — Transport protocol and generated SDK form a source-topology cycle

- Severity / status / confidence: `P2` / `existing-reproduced` / high.
- Owners and affected surfaces: transport protocol, Product Pillar schema, SDK generator, clean build topology.
- Observable surface: transport-protocol imports a domain schema from the generated SDK, while the SDK build reads and slices transport-protocol source to generate route policy. The reverse edge is source-text generation rather than a package-manager module edge.
- Direct trigger: clean topological build, standalone package publication, source relocation, or marker/text changes in the protocol file.
- Root cause and control/data flow: a foundational protocol depends upward on a generated package that depends back on protocol source; shared domain primitives have no neutral owner and generation consumes TypeScript text rather than structured facts.
- Why the current structure does not cure it: workspace prepare order can hide but not remove the cycle or source-layout dependency.
- Evidence: `packages/transport-protocol/package.json:19-21`; `packages/transport-protocol/src/index.ts:7-10,17,326,354`; `packages/sdk/js/script/build.ts:13,197-210`.
- Contract, data, test, documentation, delivery, and risk impact: package independence, clean build order, cache invalidation, and generated route correctness depend on incidental workspace state and source markers.
- Bounded refactoring direction: move shared schemas to the protocol or a minimal neutral contract package, make SDK depend one-way on it, and generate from structured exports/manifests rather than source slicing.
- Required positive verification for a future repair: clean topology builds protocol before SDK; repeated generation produces the same contract digest and route manifest without reading private TypeScript layout.
- Deduplication / relationship: current reproduction of route/SDK generation drift in the prior plan.

### `CS-015` — Plugin publishing mutates the source manifest in place

- Severity / status / confidence: `P2` / `existing-reproduced` / high.
- Owners and affected surfaces: Plugin package exports, the manual npm pack/publish script, workspace integrity.
- Observable surface: development exports point to `src` while published files contain only `dist`; the publish script rewrites the working `package.json`, packs/publishes, then restores it without a guaranteed `finally`.
- Direct trigger: pack, registry, network, or credential failure after the first write.
- Root cause and control/data flow: no immutable staging boundary exists for a publish-specific manifest/tarball.
- Why the current structure does not cure it: best-effort restoration preserves two manifest states and a crash/failure window.
- Evidence: `packages/plugin/package.json:11-20`; `packages/plugin/script/publish.ts:9-22`.
- Contract, data, test, documentation, delivery, and risk impact: failed manual npm publishing can leave the source workspace in release form; tarball exports are not verified independently or reproducibly. No current automated release-workflow invocation was found.
- Bounded refactoring direction: generate final manifest and contents in a separate staging tree and publish one exact tarball; never write the source manifest.
- Required positive verification for a future repair: unpack the staged tarball, import/require every public export, and record its exact file list and digest while the source worktree stays unchanged.
- Deduplication / relationship: reproduces prior P2.2.

### `CS-016` — Web market generation instantiates private runtime authorities and Git state

- Severity / status / confidence: `P2` / `existing-reproduced` / high.
- Owners and affected surfaces: Web data generation, Expert Squad authoring/distribution/runtime manager, source-archive builds.
- Observable surface: Web scripts import `opencorvus/src` managers/registries/generated payloads, call `git ls-files`/`git show` against the index, rely on `process.cwd()`, and initialize a runtime installation manager to generate public market data.
- Direct trigger: build from an archive/tarball without `.git`, change cwd/private layout, or change manager restoration/installation semantics.
- Root cause and control/data flow: authoring facts, distribution bytes/digests, and mutable runtime installation ownership are not separated behind a package-neutral public contract.
- Why the current structure does not cure it: generated seeds exist, but their generator still reconstructs input through Git and high-level private runtime code.
- Evidence: `packages/web/script/generate-public-market.ts:5-8,16-58`; `packages/web/script/generate-expert-squad-distribution.ts:4-6`; `packages/web/src/lib/expert-squad-facts.ts:1`; `packages/web/src/lib/website-registry-seed-validation.ts:5`.
- Contract, data, test, documentation, delivery, and risk impact: public-site output is not reproducible from a source archive and is coupled to private mutable runtime behavior.
- Bounded refactoring direction: one package-neutral authoring/distribution contract takes explicit package roots or archive bytes and emits canonical facts/archive/digest; Web consumes only that public API, while runtime manager owns installation only. Delete Git-index and cwd implicit inputs.
- Required positive verification for a future repair: identical package bytes in workspace, archive, and clean staging yield identical facts, archive digest, and seed rows.
- Deduplication / relationship: current reproduction of prior Expert Squad source/digest/manager authority debt.

### `CS-017` — Shared and public package tests are not mapped to required CI

- Severity / status / confidence: `P2` / `new` / high.
- Owners and affected surfaces: Plugin, SDK, transport-protocol, util, root test scripts, GitHub Actions.
- Observable surface: shared/public packages contain substantial non-UI tests, but required CI manually runs mainly `opencorvus`, channel-runtime, and Overlay jobs. SDK has a test script that CI never invokes; other packages with tests lack a standard script. Reproducible inventory is 19 files and 90 `test`/`it` call sites across the four omitted directories.
- Direct trigger: protocol validators, SDK lifecycle, Plugin contracts, or util functions regress while builds and typechecks still pass.
- Root cause and control/data flow: workflows hand-list a few applications rather than derive a reviewed package-test manifest from package graph and test inventory.
- Why the current structure does not cure it: dependent builds and typechecking do not execute package tests; test files alone create no required status.
- Evidence: `.github/workflows/test.yml:69-70,97-133,141-157`; `packages/plugin/package.json:7-10`; `packages/sdk/js/package.json:8-10`; test assets under `packages/plugin/test`, `packages/sdk/js/test`, `packages/transport-protocol/test`, and `packages/util/test`.
- Contract, data, test, documentation, delivery, and risk impact: public contracts can regress without a required signal; CI, package scripts, and actual test inventory are separate facts.
- Bounded refactoring direction: each package with allowed non-UI tests declares one focused test task; required CI executes an explicit reviewed package matrix and publishes a test-file-to-job manifest. UI/visual tests remain excluded.
- Required positive verification for a future repair: every discovered allowed test file maps to exactly one required job and each job reports the current positive contract it verified.
- Deduplication / relationship: related to but distinct from `CS-008`, which concerns checker composition and coverage names rather than missing package tests.

### `CS-018` — Required CI executes a prohibited pixel-based UI test

- Severity / status / confidence: `P2` / `fixed-during-audit` / high.
- Owners and affected surfaces: Overlay test runner, app-icon generation test, required CI, UI acceptance policy.
- Observable surface: the Overlay runner executes every `test/*.test.ts`; `app-icon-generation.test.ts` decodes images and asserts alpha/color/pixel distributions; required CI invokes the runner. This is a pixel-based visual automation test prohibited by repository policy.
- Direct trigger: every CI push or pull request reaching the Overlay unit job.
- Root cause and control/data flow: file-extension discovery treats visual comparison as a unit contract, so visual acceptance is disguised inside a generic required runner.
- Why the current structure does not cure it: stable thresholds still cannot replace actual rendering and human visual review; the generic runner guarantees continued execution.
- Evidence: `packages/overlay/script/run-unit-tests.ts:8-22`; `.github/workflows/test.yml:114-133`; `packages/overlay/test/app-icon-generation.test.ts:12-179`.
- Contract, data, test, documentation, delivery, and risk impact: the baseline required CI violated the repository's own hard acceptance rule and presented an invalid visual-quality signal. Because this audit retrieved the path, the test was deleted immediately and was never run.
- Bounded refactoring direction: delete the pixel test and any artifact serving only it. Retain only non-visual generator receipts such as target name/format/declared size; inspect real rendered icons manually for visual acceptance.
- Required positive verification for a future repair: generator emits structural receipts and the visual asset is recorded as actually viewed; no test runner discovers pixel/visual assertions.
- Deduplication / relationship: new policy/tooling defect. It requires immediate audit-time cleanup under `AGENTS.md`, unlike the deferred refactoring register.

### `CS-019` — Overlay native composition root owns multiple privilege domains and duplicate registries

- Severity / status / confidence: `P2` / `new` / high.
- Owners and affected surfaces: Tauri native host, browser preview, filesystem/settings, payload and server process lifecycle, updater, notifications, tray/menu.
- Observable surface: one Rust module owns many independent native states/privilege domains and two near-identical dev/release `generate_handler!` command registries.
- Direct trigger: add or change one native command or domain state and manually keep both registry branches plus unrelated shared lifecycle code consistent.
- Root cause and control/data flow: application composition, command implementation, permission checks, state ownership, platform lifecycle, and inline tests were accumulated in one module; cfg branching copies the registry rather than adding the dev-only capability to one source.
- Why the current structure does not cure it: one file is not admitted for size; the concrete duplicated registration authority and shared cross-domain state are the defect.
- Evidence: `packages/overlay/src-tauri/src/main.rs:551,1094,1339,1869,3176-4915,4978,5606-5660,5905`; file length approximately 7,266 lines.
- Contract, data, test, documentation, delivery, and risk impact: privilege review and platform registration are non-local; one branch can omit/add a command silently; changes to one native domain risk unrelated lifecycle state.
- Bounded refactoring direction: split modules by privilege/state owner and let one small composition root register each module; maintain one command inventory with cfg only on the dev-only command, not two full lists.
- Required positive verification for a future repair: a registry manifest reports every command's owner module, typed input/output, capability, and dev/release availability; focused Rust tests verify each domain's positive receipts.
- Deduplication / relationship: not a file-size finding; admitted for mixed privilege ownership and duplicated command authority.

### `CS-020` — Overlay tree writer conflates single-writer coordination with all state semantics

- Severity / status / confidence: `P2` / `new` / medium-high.
- Owners and affected surfaces: Overlay conversation state, live events, review lifecycle, hydration, hierarchy projection.
- Observable surface: one writer maintains normalized Session/message maps, dispatches all stream events, patches messages, owns Review state, prepares/commits hydration, and rebuilds interaction/card hierarchy.
- Direct trigger: add an event, Review transition, history rule, or hierarchy rule and modify a control flow sharing multiple mutable state models.
- Root cause and control/data flow: the valid single-writer concurrency rule was implemented as one semantic mega-reducer instead of one transaction coordinator over separately typed pure reducers/projectors.
- Why the current structure does not cure it: a single entry prevents concurrent writers but does not give message, lifecycle, Review, hydration, and projection domains independent invariants or inputs/outputs.
- Evidence: `packages/overlay/src/services/tree-writer.ts:358-405,616,827,1827-2077,2850,2987,3241-3566`.
- Contract, data, test, documentation, delivery, and risk impact: live replay and historical hydration rules are difficult to change or verify independently; state regression in one domain can appear through unrelated tree projection.
- Bounded refactoring direction: retain one transaction coordinator but extract typed pure normalized-message, lifecycle, Review, hydration, and hierarchy projection authorities; commit in one defined order and delete duplicate/old state paths.
- Required positive verification for a future repair: given one event sequence, each reducer reports a stable typed state and live replay/hydration produce the same canonical tree digest; final UI state is visually reviewed on the real page.
- Deduplication / relationship: new concrete mixed-state authority issue, not a size complaint.

### `CS-021` — Public provider-model refresh routes return an empty success without refreshing

- Severity / status / confidence: `P1` / `new` / high.
- Owners and affected surfaces: Provider model catalog, project/global server routes, generated SDK, Overlay provider settings.
- Observable surface: both documented model-refresh routes return `ok:true`, a current timestamp, and an empty provider list without contacting a model endpoint or writing canonical model data; each then invalidates projections as though a commit occurred.
- Direct trigger: the settings refresh action or `POST /provider/models/refresh` / `POST /global/providers/models/refresh`.
- Root cause and control/data flow: both routes converge on `Provider.refreshModels`; that public writer is a fixed placeholder return.
- Why the current structure does not cure it: catalog invalidation can publish a prior catalog again but cannot replace the absent fetch/validation/atomic writer.
- Evidence: `packages/opencorvus/src/provider/provider.ts:689-700`; `packages/opencorvus/src/server/routes/provider.ts:169-210`; `packages/opencorvus/src/server/routes/global.ts:813-860`; `packages/overlay/src/services/provider-refresh.ts:19-48`; `packages/overlay/src/components/settings/ProvidersPanel.tsx:936-951`; `specs/current/architecture/06-provider.md:264-267`.
- Contract, data, test, documentation, delivery, and risk impact: OpenAPI, generated SDK, UI, and Web docs promise a mutation that never happens; users receive false success and `models.json` remains unchanged. No focused positive route test was found.
- Bounded refactoring direction: either implement one real live-model writer using the canonical provider transport and atomic `ModelsDev` transaction, or delete the feature's route/UI/SDK/docs together. Do not retain empty success.
- Required positive verification for a future repair: the real route consumes a controlled provider endpoint, atomically commits exact identities/info, returns provider/count/IDs, and reloads project/global projections; malformed/conflicting data returns a typed failure with the old catalog unchanged.
- Deduplication / relationship: new concrete placeholder implementation behind a public success contract.

### `CS-022` — Browser MCP modules compete for process signal ownership

- Severity / status / confidence: `P1` / `new` / high.
- Owners and affected surfaces: Browser MCP Sessions, HTTP/stdio entrypoints, Node launcher, process shutdown.
- Observable surface: importing Sessions installs SIGINT/SIGTERM/exit listeners and directly exits after its own cleanup; HTTP entry and Node launcher install additional listeners that aggregate transport/server/child cleanup.
- Direct trigger: a Browser MCP HTTP, stdio, or sidecar process receives SIGINT/SIGTERM.
- Root cause and control/data flow: a resource module owns global process lifecycle in addition to entrypoint owners. Node invokes signal listeners without awaiting them as one ordered settlement, so Sessions can call `process.exit(0)` before other owners finish or report failure.
- Why the current structure does not cure it: idempotent browser-session shutdown does not settle MCP transports, sockets, streams, or supervised children; aggregation exists only in the competing entrypoint.
- Evidence: `packages/opencorvus/src/mcp/browser/sessions.ts:834-881`; `packages/opencorvus/src/mcp/browser/index.ts:107-180`; `packages/opencorvus/src/mcp/browser/node-launcher.ts:45-99`.
- Contract, data, test, documentation, delivery, and risk impact: partial cleanup can leak browser contexts, sockets, streams, or child ownership and still exit zero. Existing tests do not exercise real signal shutdown.
- Bounded refactoring direction: Sessions exposes only `dispose`; each executable entry has exactly one signal owner that aggregates all resources, waits for settlement, and selects exit status. Delete every process listener/exit from resource modules.
- Required positive verification for a future repair: send SIGTERM to real isolated HTTP and stdio children with active Sessions and prove all resources settle before exit; injected close failure produces visible nonzero termination.
- Deduplication / relationship: new lifecycle ownership defect; related to but not subsumed by generic process execution.

### `CS-023` — Managed parent watchdog identifies its owner by PID only

- Severity / status / confidence: `P1` / `new` / high from control flow, medium for reproduction frequency.
- Owners and affected surfaces: managed desktop server ownership, parent watchdog, sidecar startup protocol.
- Observable surface: every five seconds the backend asks only whether `parentPid` exists. If the desktop parent dies and its number is reused, an unrelated process is treated as the owner and the orphan backend keeps database/port/lock ownership.
- Direct trigger: desktop host exits and PID reuse occurs before or between watchdog polls.
- Root cause and control/data flow: managed startup carries only numeric PID even though exact process-occurrence primitives exist elsewhere; SidecarLock protects the backend's own lock, not its parent's identity.
- Why the current structure does not cure it: `process.kill(pid,0)` proves number liveness, not occurrence identity; stored timestamps are diagnostic and not observed against the parent.
- Evidence: `packages/opencorvus/src/server/parent-watchdog.ts:18-48`; `packages/opencorvus/src/server/managed-server-ownership.ts:17-57`; `packages/opencorvus/src/cli/cmd/serve.ts:91-113`; `packages/overlay/src-tauri/src/main.rs:4627-4637`; `packages/opencorvus/src/runtime/process-occurrence.ts:7-37`.
- Contract, data, test, documentation, delivery, and risk impact: managed “parent death means self-stop” is not exact; orphan backend can keep scheduling/writing and block the next desktop instance. No PID-reuse contract test exists.
- Bounded refactoring direction: pass and observe a parent occurrence/fingerprint through one process-occurrence authority; same PID with a different fingerprint means dead owner, and platforms unable to observe identity fail managed acquisition closed.
- Required positive verification for a future repair: a controlled observer replaces a dead parent with a new occurrence sharing its PID; shutdown fires exactly once and releases ownership, while an unchanged occurrence stays alive.
- Deduplication / relationship: new exact-owner defect.

### `CS-024` — Skill mutations lack a durable transaction across directories and global config

- Severity / status / confidence: `P1` / `new` / high.
- Owners and affected surfaces: Skill install/import/update/remove, managed directories, global configuration, discovery and policy projection.
- Observable surface: mutation order crosses cache/Git/staging/canonical directories and config. Some caught exceptions roll back in memory, but process death between rename/config steps leaves staging/backups, orphan installs, ghost config, or lost prior directories; remove commits config before recursive deletion.
- Direct trigger: I/O/config failure or process termination at a clone, rename, config commit, backup cleanup, or delete boundary.
- Root cause and control/data flow: in-process catalog/source locks serialize callers but no durable journal owns the multi-resource mutation and restart recovery.
- Why the current structure does not cure it: atomic config patch covers one file; `replaceSkillDirectories` can reverse caught exceptions only while its in-memory flags survive.
- Evidence: `packages/opencorvus/src/skill/manager.ts:325-407,419-510,525-567,642-658,842-953`; `packages/opencorvus/src/skill/reference-lock.ts:4-38`.
- Contract, data, test, documentation, delivery, and risk impact: installed inventory, mounted files, permissions, and global config can represent different revisions; no crash-injection mutation tests were found.
- Bounded refactoring direction: one durable mutation journal records operation, old/new config revision, exact target/staging/backup/discard paths, and digests; install/update validate staging before exchange, remove first renames to discard, and startup/discovery recovers the journal. Delete direct canonical mutation paths.
- Required positive verification for a future repair: kill a child process at every directory/config boundary against a real local Git source/config; restart deterministically restores a complete old or new state and the same route retries idempotently.
- Deduplication / relationship: new Skill-specific transaction ownership defect.

### `CS-025` — Artifact cursor integrity is a client-recomputable unkeyed digest

- Severity / status / confidence: `P2` / `new` / high from algorithm/control flow.
- Owners and affected surfaces: Artifact Catalog pagination, Task API and ToolHost evidence search.
- Observable surface: cursor payload includes totals, revisions, source membership/errors, and position, protected only by `SHA-256(payload)`. A client can alter those server facts and recompute the public digest.
- Direct trigger: modify a valid cursor's totals/source mask/provider errors/after tuple while retaining authority/filter digest, then recompute the checksum.
- Root cause and control/data flow: server-derived frozen snapshot state is delegated to an untrusted bearer and a corruption checksum is treated like signer authenticity.
- Why the current structure does not cure it: canonical base64/shape validation and equality checks protect encoding and a subset of fields, not issuer authenticity. The test flips a character without recomputing the digest.
- Evidence: `packages/opencorvus/src/artifact-catalog/index.ts:267-310,366-390,1043-1063,1100-1159,1180-1209`; `packages/opencorvus/test/artifact-catalog-cursor.test.ts:185-201`.
- Contract, data, test, documentation, delivery, and risk impact: clients can falsify completeness/totals/provider errors or skip a source, distorting durable evidence selection. No cross-Task authorization bypass is claimed.
- Bounded refactoring direction: cursor carries only minimal position and server recomputes canonical snapshot facts, or a server-owned durable cursor record/unforgeable signed token preserves frozen state. Delete the unkeyed digest as an authority proof.
- Required positive verification for a future repair: edits followed by recomputation of the old SHA are rejected, while unchanged multi-page searches preserve membership, totals, and byte-bound behavior.
- Deduplication / relationship: new integrity-boundary defect.

### `CS-026` — Disabled LSP survives as a zombie runtime and public API

- Severity / status / confidence: `P2` / `new` / high.
- Owners and affected surfaces: Language Server Protocol (LSP) runtime/client/server, file/status routes, generated SDK/docs, direct tests.
- Observable surface: production initialization always creates an empty server map and all client discovery returns empty, while roughly 3,300 lines of runtime/install/spawn/lifecycle code, two no-function routes, SDK methods, docs, and direct tests remain.
- Direct trigger: call `/lsp` or symbol search, or maintain/internal-import LSP runtime code presumed live.
- Root cause and control/data flow: disabling was implemented as an empty-map early return and unavailable Tool state rather than a capability removal boundary.
- Why the current structure does not cure it: direct lifecycle tests make unreachable internals look supported, and negative disabled-runtime tests violate the repository's positive-contract test policy.
- Evidence: `packages/opencorvus/src/lsp/index.ts:153-178,211-220,680-725`; `packages/opencorvus/src/lsp/client.ts`; `packages/opencorvus/src/lsp/server.ts`; `packages/opencorvus/src/tool/global-tools.ts:24`; `packages/opencorvus/src/server/routes/file.ts:89-116`; `packages/opencorvus/src/server/routes/app.ts:731-750`; `packages/opencorvus/test/lsp-disabled-runtime.test.ts:11-44`; `packages/opencorvus/test/lsp-initialize-lifecycle.test.ts:6-22`; generated OpenAPI/Web references.
- Contract, data, test, documentation, delivery, and risk impact: a parallel process/lifecycle system and useless public API continue demanding changes and producing false support signals. Reusable Range/capsule catalog contracts must be preserved elsewhere, not used to retain runtime.
- Bounded refactoring direction: delete runtime/client/server, compatibility routes, direct dead/negative tests, generated SDK and docs; move only actually used schemas/catalog IDs to a neutral contract owner.
- Required positive verification for a future repair: current file search, message range schema, capsule config, and process-supervisor positive contracts remain valid; regenerated OpenAPI contains no LSP compatibility API.
- Deduplication / relationship: new concrete zombie-system entry.

### `CS-027` — Skill registry failures are silently projected as an empty registry

- Severity / status / confidence: `P2` / `new` / high.
- Owners and affected surfaces: Skill market manager, project/global routes, UI/SDK market consumers.
- Observable surface: network, timeout, non-2xx, invalid JSON, and schema failures all become `[]`; callers receive builtin entries with no issue and cannot distinguish unconfigured, empty, and failed registries.
- Direct trigger: any configured Skill registry is unreachable or malformed.
- Root cause and control/data flow: per-registry `try/catch` achieves isolation by mapping authority failure into a valid empty fact; public result contains entries only.
- Why the current structure does not cure it: builtin entries become a silent fallback rather than partial success carrying source errors.
- Evidence: `packages/opencorvus/src/skill/manager.ts:201-243`; `packages/opencorvus/src/server/routes/skill.ts:140-159`; `packages/opencorvus/src/server/routes/global.ts:862-875`.
- Contract, data, test, documentation, delivery, and risk impact: configuration and outages remain invisible; operators and UI believe the market is healthy. No partial-failure test was found.
- Bounded refactoring direction: one `SkillMarketResult {entries, provider_errors}` preserves good entries and emits a redacted typed issue per failed source; all configured registries failing must not equal none configured.
- Required positive verification for a future repair: one good, one 500, and one malformed registry return valid entries plus two source-tagged issues through route and generated SDK.
- Deduplication / relationship: new fail-open observability/authority defect.

### `CS-028` — Storage table registry is inferred by swallowed exceptions

- Severity / status / confidence: `P2` / `new` / high.
- Owners and affected surfaces: Drizzle schema exports, SQLite DDL/fingerprint/migrations, MySQL transfer.
- Observable surface: `collectTables` iterates every runtime schema export, asks Drizzle for table config, and silently ignores exceptions. Missing exports or newly shaped declarations disappear from every downstream schema consumer without a completeness failure.
- Direct trigger: add/change a schema declaration or helper export that does not fit the implicit probe.
- Root cause and control/data flow: table ownership is an exception-driven reflection convention rather than a typed explicit registry.
- Why the current structure does not cure it: DDL, deferred indexes, fingerprint, migration, and transfer share the same possibly incomplete list, so cross-checks can agree on the same omission.
- Evidence: `packages/opencorvus/src/storage/ddl.ts:118-146,610`; `packages/opencorvus/src/storage/mysql-transfer.ts:119-123`; `packages/opencorvus/src/storage/db.ts:341,865`; `packages/opencorvus/src/storage/schema-migration.ts:127,137`.
- Contract, data, test, documentation, delivery, and risk impact: initialization or transfer can omit a table silently; current migration tests consume generated DDL but do not prove declaration completeness.
- Bounded refactoring direction: schema module exports one typed `SCHEMA_TABLES` registry; DDL/index/transfer/fingerprint all derive from it and exception probing is deleted.
- Required positive verification for a future repair: registry table names are unique, a real checker creates/enumerates every declared table, and SQLite/MySQL shapes derive from the exact same registry.
- Deduplication / relationship: new schema-authority defect.

### `CS-029` — Skill trust labels use URL substring matching

- Severity / status / confidence: `P3` / `new` / high.
- Owners and affected surfaces: installed Skill provenance, UI trust/risk display, policy recommendations.
- Observable surface: a source containing strings such as `github.com/openai/skills` or `skills.sh` can be labelled official/curated even when the canonical host/repository identity differs.
- Direct trigger: a manifest uses a deceptive query, userinfo, similar repository name, or path embedding the trusted substring.
- Root cause and control/data flow: trust classification uses `String.includes` instead of a canonical source identity parser.
- Why the current structure does not cure it: Git normalization supports install target selection only; it is not a single trust authority. Current recommended execution policy remains deny for non-builtin, so no direct permission escalation is claimed.
- Evidence: `packages/opencorvus/src/skill/manager.ts:728-807`.
- Contract, data, test, documentation, delivery, and risk impact: installed API/UI can mislead humans about provenance and risk; deceptive-source tests are absent.
- Bounded refactoring direction: one canonical source parser matches exact allowed protocol, host, owner, and repository identities; all unparseable/deceptive variants classify external/unknown.
- Required positive verification for a future repair: exact official sources retain trust, while query/userinfo/similar repo/other-host variants do not.
- Deduplication / relationship: new bounded provenance issue.

### `CS-030` — Dead JSON storage namespace remains as a parallel persistence primitive

- Severity / status / confidence: `P3` / `new` / high for deadness.
- Owners and affected surfaces: legacy file storage, database/Artifact persistence architecture.
- Observable surface: `storage/storage.ts` defines JSON read/write/update/remove/list and lock/error semantics but has no import or method call in the repository.
- Direct trigger: no current production path; future code can mistake it for the supported persistence primitive.
- Root cause and control/data flow: migration to database/Attachment/Artifact authorities left a complete old layer behind; swallowed list/remove errors make accidental reuse especially risky.
- Why the current structure does not cure it: absence from barrels/callers avoids compiler/test pressure to delete it.
- Evidence: `packages/opencorvus/src/storage/storage.ts:11-88`; whole-repository search found no `Storage.read/write/update/remove/list` caller.
- Contract, data, test, documentation, delivery, and risk impact: dormant parallel authority adds false choice and has no consumers/tests/migration obligations.
- Bounded refactoring direction: delete the file with no compatibility export or migration.
- Required positive verification for a future repair: database, Attachment, and Artifact positive tests plus typecheck/build remain green and no current persistence source changes.
- Deduplication / relationship: new dead implementation distinct from LSP and Overlay feature islands.

### `CS-031` — Provider and credential caches use short runtime-specific hashes as identity

- Severity / status / confidence: `P3` / `existing-reproduced` / high.
- Owners and affected surfaces: Provider config state, SDK instance cache, embedded DashScope key lifetime.
- Observable surface: Provider projection uses Bun xxHash64; SDK cache uses a standalone xxHash32 number as its sole Map key without exact-input equality; key lifetime stores xxHash32 of credentials.
- Direct trigger: collision between distinct configurations/options/credentials, including intentionally constructed 32-bit collisions.
- Root cause and control/data flow: non-cryptographic short hashes are treated as identities rather than indexes and are duplicated across runtime-specific owners.
- Why the current structure does not cure it: the prior unified capability-revision debt did not include these Provider/credential call sites.
- Evidence: `packages/opencorvus/src/provider/provider.ts:246-252,624-640,769-771`; `packages/opencorvus/src/provider/dashscope.ts:20-31`; prior plan lines 271-277.
- Contract, data, test, documentation, delivery, and risk impact: a collision can reuse an SDK instance with the wrong base URL, headers, or credential and remains Bun-bound.
- Bounded refactoring direction: one runtime-independent canonical cryptographic digest, with exact canonical equality on cache hit; credential lifetime uses the same string digest primitive.
- Required positive verification for a future repair: known colliding xxHash32 options produce distinct instances, identical canonical config reuses state, and supported hosts generate identical digests.
- Deduplication / relationship: reproduces and broadens prior capability revision hashing debt.

### `CS-032` — SDK server startup observer retains unbounded logs after readiness

- Severity / status / confidence: `P2` / `new` / high.
- Owners and affected surfaces: JavaScript SDK server process, readiness parser, long-running child logging.
- Observable surface: stdout/stderr listeners append every chunk to one `output` string; readiness resolves the startup Promise but never removes listeners, clears the buffer, or bounds retained diagnostics. Subsequent stdout repeatedly splits the ever-growing string.
- Direct trigger: a server created through the SDK remains alive and emits logs over time.
- Root cause and control/data flow: startup observation and whole-process logging share one closure/lifecycle; readiness settlement does not transition ownership to a bounded streaming or discard policy.
- Why the current structure does not cure it: closing eventually ends the child but long-lived instances retain all output first; replacing the human-log protocol in `CS-011` alone would not fix listener/buffer lifetime.
- Evidence: `packages/sdk/js/src/server.ts:61-71,90-114,135-139`.
- Contract, data, test, documentation, delivery, and risk impact: parent memory grows with child logging and stdout processing becomes progressively more expensive; no bounded-retention contract test was found.
- Bounded refactoring direction: startup keeps a fixed diagnostic tail, detaches the readiness parser after the machine receipt, and explicitly streams or discards runtime logs; terminal errors can reference only the bounded tail.
- Required positive verification for a future repair: a real long-lived child emits beyond the fixed threshold while retained diagnostics remain bounded, then closes with the same process-occurrence terminal receipt.
- Deduplication / relationship: independent lifecycle leak adjacent to `CS-011`.

### `CS-033` — Base Conversation projector advertises an input it does not own

- Severity / status / confidence: `P3` / `new` / high.
- Owners and affected surfaces: Conversation view projection, orchestrator hydrate/history routes, Session execution fields.
- Observable surface: `projectConversationView` declares `lifecycleEvents` and ends with `void lifecycleEvents`, while the sibling `projectConversationAgentView` owns execution lifecycle projection. The overlapping projectors and base Session shape make the unused parameter look like a supported merge input.
- Direct trigger: a caller supplies a lifecycle slice to the base projector or maintains an overlapping Session field believing that projector consumes it.
- Root cause and control/data flow: message/ledger and execution-aware projections were separated without removing the obsolete base parameter or clearly separating their overlapping output semantics.
- Why the current structure does not cure it: TypeScript accepts intentionally voided input. Raw events and the independent Agent view are consumed elsewhere, so this is not loss of the entire hydrate lifecycle stream; it is a false local contract that invites the two projectors to drift.
- Evidence: `packages/opencorvus/src/conversation/view.ts:278-294,327-349,457,472-597`; `packages/overlay/src/services/conversation.ts:657-706,928-946`.
- Contract, data, test, documentation, delivery, and risk impact: maintainers cannot tell which projector owns status/error/activity derivation, and the shared-looking input/output boundary can acquire inconsistent behavior even though current Overlay hydration separately consumes events and Agent view.
- Bounded refactoring direction: delete the lifecycle parameter and related base call arguments from a clearly message/ledger-only projector, and make the execution view the sole lifecycle authority; alternatively merge them only if one canonical combined projection is an explicit current contract.
- Required positive verification for a future repair: one transcript/lifecycle slice produces the same typed view across every endpoint through the single declared projector.
- Deduplication / relationship: new discarded-input contract smell.

### `CS-034` — Rejected Architect projections still settle as terminal success

- Severity / status / confidence: `P1` / `new` / high.
- Owners and affected surfaces: Architect stage, Goal graph persistence, unprojectable candidate, DispatchOutcome.
- Observable surface: Architect preflight conflicts and projection races persist an unprojectable candidate, then return `DispatchOutcome.terminal`; that constructor is `terminal_success`, so workflow settlement treats a rejected domain projection as success.
- Direct trigger: the generated candidate references unknown/non-current goals or an invalid partition, or the current Goal projection changes between Architect production and Host persistence.
- Root cause and control/data flow: physical Turn completion is conflated with acceptance of its required Host projection. Dispatch settlement persists the success outcome, and workflow description treats any successful dispatch as a succeeded node and opens its dependent frontier, even though selection/execution excludes candidates whose `projection` is null.
- Why the current structure does not cure it: the persistence helper does recover useful structured facts: it atomically rereads the tip, derives `stale_prior_projection`, refuses an empty conflict set, and stores current/observed locators. The defect is therefore not empty evidence; it is the absence of a typed non-success domain-conflict outcome and workflow semantics for it.
- Evidence: `packages/opencorvus/src/orchestrator/architect-stage.ts:198-320,355-390`; `packages/opencorvus/src/engine/persist.ts:596-624,649-670`; `packages/opencorvus/src/agent/dispatch-outcome.ts:91-121,143-149`; `packages/opencorvus/src/engine/dispatch-settlement.ts:69-97`; `packages/opencorvus/src/engine/describe.ts:735-788`; `packages/opencorvus/src/engine/goal-graph-projection.ts:221-227`; `packages/opencorvus/src/architect/selected-artifact-roles.ts:68-82`.
- Contract, data, test, documentation, delivery, and risk impact: durable conflict evidence exists, but the Task graph can advance dependents without an accepted Architect projection. The current `partial` outcome describes required post-Turn operation failure, so overloading it would create another ambiguous protocol.
- Bounded refactoring direction: add one typed rejected/domain-conflict outcome that references the preserved candidate locator; dispatch/workflow settlement must not count it as success or open the dependency frontier. Keep the existing structured candidate persistence and delete both terminal-success conflict branches.
- Required positive verification for a future repair: exercise a preflight conflict and a projection race through real dispatch settlement; both retain non-empty structured candidate evidence, emit the typed non-success outcome, and leave dependent frontier nodes blocked until a later accepted projection.
- Deduplication / relationship: distinct from `CS-001`; both concern post-Turn settlement, but this path already has durable evidence and misclassifies its domain meaning as success.

### `CS-035` — Auth corruption is projected as absence of remote configuration

- Severity / status / confidence: `P1` / `new` / high.
- Owners and affected surfaces: saved authentication, `.well-known/opencorvus` organization configuration, Config loader, config route/SDK.
- Observable surface: unreadable or malformed `auth.json`, or one invalid saved credential, is logged and converted to `{}` while Config continues returning a normal local merged configuration. Every credential-declared remote organization configuration silently disappears.
- Direct trigger: `Auth.all` throws `Auth.ReadError` for non-ENOENT I/O, invalid JSON, or invalid credential schema during `Config.loadState`.
- Root cause and control/data flow: Auth deliberately distinguishes missing from corrupt state, but Config catches all failures and replaces the credential authority with a legal empty registry before enumerating well-known sources.
- Why the current structure does not cure it: downstream route error mapping cannot recover a failure already erased inside `Config.get`; the public config response has no degraded/source-error receipt.
- Evidence: `packages/opencorvus/src/auth/index.ts:18-38,70-105`; `packages/opencorvus/src/config/config.ts:206-221,238-280`; `packages/opencorvus/src/server/routes/config.ts:40-72`; provider-route mappings at `packages/opencorvus/src/server/routes/provider.ts:50-59` and `packages/opencorvus/src/server/routes/global.ts:486-495`.
- Contract, data, test, documentation, delivery, and risk impact: organization defaults including providers/models/plugins/Agents can vanish while startup and `config.get` appear healthy. No positive contract test distinguishes missing auth from corrupt auth through Config.
- Bounded refactoring direction: preserve `Auth.ReadError` as a typed Config failure, or expose one explicit `ConfigLoadResult {config, source_errors}` if partial success is required; delete the `{}` fallback and do not expose tokens in errors.
- Required positive verification for a future repair: missing auth remains valid empty state, while EACCES, malformed JSON, and invalid credentials produce stable typed Config/route results; a valid well-known credential still merges the real remote config.
- Deduplication / relationship: new cross-authority fallback distinct from Skill registry partial failure.

### `CS-036` — Worktree ownership observation failure can authorize destructive deletion

- Severity / status / confidence: `P1` / `new` / high.
- Owners and affected surfaces: durable Worktree ownership markers, explicit Worktree removal, garbage collection and orphan recovery.
- Observable surface: ownership directory `readdir` errors other than ENOENT are logged and returned as `[]`; `hasLiveOwner` treats the empty result as false, and Worktree removal uses that boolean as part of its ownerless proof before physical deletion.
- Direct trigger: EACCES, EIO, damaged mount, or another transient filesystem failure while explicit managed-Worktree removal, or a GC candidate without another durable sandbox binding, observes marker directories.
- Root cause and control/data flow: marker observation collapses `missing`, `observed empty`, and `observation failed` into one list type; the destructive consumer interprets all three as absence of a live owner.
- Why the current structure does not cure it: markers are the durable restart-safe owner authority specifically when in-memory ownership is unavailable, but their read boundary fails open.
- Evidence: `packages/opencorvus/src/engine/ownership.ts:116-130,274-291,300-368`; `packages/opencorvus/src/worktree/index.ts:1021-1065`; GC callers `packages/opencorvus/src/worktree/gc.ts:361,377`.
- Contract, data, test, documentation, delivery, and risk impact: an explicitly removed in-use Git Worktree can be irreversibly deleted by a temporary observation failure. GC preserves candidates that still have a sandbox registration and retains a whole project when its Git registry cannot be read, so the GC claim is limited to candidates for which the ownership marker is the remaining cross-process proof. Existing tests cover normal/dead/malformed markers, not failed directory observation blocking deletion.
- Bounded refactoring direction: return a typed observation receipt distinguishing observed entries, confirmed missing, and failure; destructive ownerless proof accepts only the first two safe states and propagates failure. Replace `hasLiveOwner` boolean with the receipt.
- Required positive verification for a future repair: injected EACCES/EIO makes removal and GC return a stable ownership-observation failure with directory/markers unchanged; successfully observed absence still returns the deletion receipt.
- Deduplication / relationship: new destructive fail-open; independent of PID occurrence precision in `CS-023`.

### `CS-037` — Overlay recovery parses Tree Writer exception prose

- Severity / status / confidence: `P2` / `new` / high.
- Owners and affected surfaces: Overlay Tree Writer, live event dispatch, selected-Task recovery, Server-Sent Events (SSE) projection.
- Observable surface: six fixed English `Error.message.startsWith` prefixes decide whether missing Session/Part/Message prerequisites schedule recovery. Rewording, wrapping, or a new equivalent error makes the event escape recovery and leaves the live card projection incomplete.
- Direct trigger: out-of-order/removal events reach Tree Writer before their prerequisite projection, then one of the untyped requirement helpers throws.
- Root cause and control/data flow: producer emits plain human-readable `Error`; consumer reparses its prose as a hidden cross-module control protocol.
- Why the current structure does not cure it: one precheck covers only part-delta state; removal/session/message races still rely on the exception classifier. `CS-020` covers mixed ownership but not this independently reachable text protocol.
- Evidence: `packages/overlay/src/services/tree-writer.ts:532-565`; `packages/overlay/src/services/events.ts:153-167,220-254`; real stream entry `packages/overlay/src/services/sse.ts:456`.
- Contract, data, test, documentation, delivery, and risk impact: backend facts remain durable, but desktop live projection can miss cards/parts until another full recovery. No stable error-kind contract or positive recovery test was found.
- Bounded refactoring direction: Tree Writer returns/throws one typed `ProjectionPrerequisiteError` containing event and missing entity kind/identity; Events schedules recovery by discriminant and deletes all prose matching in the same change.
- Required positive verification for a future repair: real SSE-shaped missing Session/Part/Message events produce one exact recovery dispatch and, after snapshot recovery, a present target card/part with continuous sequence; display text changes do not affect control flow.
- Deduplication / relationship: same anti-pattern as `CS-011` in a different runtime path and failure mode.

### `CS-038` — Conversation visibility has two mutually inconsistent authorities

- Severity / status / confidence: `P2` / `new` / high.
- Owners and affected surfaces: backend Conversation projection, Session/Mission/Task routes, Turn Artifact attachment, Overlay live/hydrated card projection, transport protocol.
- Observable surface: a completed assistant Message containing only non-empty reasoning is declared displayable by the backend and included in `view.messages`, while the Overlay defines reasoning as evidence-only and hides the resulting contentless completed card. The same response therefore contains display metadata whose alleged visible Message has no visible User Interface (UI) item; Turn Artifacts can also select that invisible Message as the final visible assistant owner.
- Direct trigger: an assistant transcript row has a non-empty reasoning Part, no other display Part, a positive completion time, and no error.
- Root cause and control/data flow: the backend `conversationPartHasDisplay` treats non-empty reasoning as display content, and routes filter/project with that function. The Overlay's `messagePartHasDisplayContent` explicitly rejects every reasoning Part. Hydration nevertheless iterates all backend `view.messages`, creates the card and imports the reasoning Part, applies completed settlement, then removes the contentless completed card from top-level visibility.
- Why the current structure does not cure it: transport-protocol enumerates Part types but does not own the content-visibility policy. Backend projection, renderer projection, and final-visible Artifact ownership each make their own decision.
- Evidence: `packages/opencorvus/src/conversation/view.ts:296-312,404-421`; `packages/opencorvus/src/conversation/turn-artifacts.ts:283-298`; `packages/opencorvus/src/server/routes/session.ts:602,643`; `packages/opencorvus/src/server/routes/mission.ts:173-174`; `packages/opencorvus/src/server/routes/orchestrator.ts:1328,2327-2328`; `packages/overlay/src/utils/message-part.ts:31-38`; `packages/overlay/src/services/tree-writer.ts:129-156,769-781,2850-2923,2987-3116,3410-3423,3576-3584`; `packages/overlay/src/utils/chat-bubble.ts:8-12`; `packages/overlay/src/components/ChatBubble.tsx:203-234,283-369`.
- Contract, data, test, documentation, delivery, and risk impact: server display metadata, visible-card identity, history completeness, and Turn Artifact ownership can disagree; depending on call path and hierarchy the symptom is an omitted Message, orphan metadata/Artifact ownership, or an empty shell. No cross-runtime positive test asserts identical visible Message identities for the same transcript.
- Bounded refactoring direction: transport-protocol owns one runtime-neutral Conversation visibility projector in which reasoning is explicitly evidence-only; backend filters/view/Turn Artifacts and Overlay live/hydrated visibility consume it. Delete both local policy implementations.
- Required positive verification for a future repair: run one transcript containing reasoning-only completed, text, tool, and error Messages through the real server response and Overlay hydration projection; both produce the same visible Message/Card identity set, reasoning remains available as evidence, and it cannot become `finalVisibleAssistantMessageID` by itself.
- Deduplication / relationship: related to `CS-020`, but admitted on a concrete cross-process contract divergence rather than tree-writer size or responsibility count.

### `CS-039` — MCP configuration and static credentials commit to separate durable authorities

- Severity / status / confidence: `P1` / `new` / high.
- Owners and affected surfaces: Model Context Protocol (MCP) project configuration, static credential store, runtime connection reconciliation, MCP routes and generated SDK.
- Observable surface: a project can persist an enabled static-credential MCP entry while the independent auth store lacks its new secret or retains the prior one. Restart then reads the mismatched durable facts and cannot determine whether to complete the new mutation or restore the old revision.
- Direct trigger: process termination after `Config.updateProjectPatchAtomic` commits but before `McpAuth.setStaticCredential` commits, or an I/O failure followed by failure of either in-process compensation step.
- Root cause and control/data flow: `MCP.configure` sequentially mutates project config and a separate `mcp-auth.json`; `previousProject` and `previousAuth` in the current process are the only cross-resource rollback authority. The two stores each have local atomicity, but no durable mutation occurrence, stage, or restart recovery decision spans them.
- Why the current structure does not cure it: the config atomic patch protects one file, catch rollback exists only while memory survives, and `ensureConfiguredConnections` consumes whichever pair was left behind rather than recovering the intended occurrence.
- Evidence: `packages/opencorvus/src/mcp/index.ts:2308-2393,2692-2707`; `packages/opencorvus/src/mcp/auth.ts:40-43,112-159`.
- Contract, data, test, documentation, delivery, and risk impact: project config, credential identity, and runtime connection/status can represent different revisions. A configure success cannot prove a cross-resource commit, and no crash-cut recovery test was found.
- Bounded refactoring direction: one durable MCP mutation owner records operation identity, old/new config revisions, credential identity or digest without secret material, stage, and recovery decision. Stage the secret, publish it with compare-and-swap semantics, and recover or roll back that exact occurrence before runtime reconciliation; delete the direct two-write compensation protocol.
- Required positive verification for a future repair: terminate an isolated child after config commit, credential staging, credential publish, and runtime reconcile; every restart converges to one complete old or new revision, and retrying the same request is idempotent.
- Deduplication / relationship: the failure pattern resembles `CS-024`, but the authorities, data, public mutation, and recovery owner are MCP-specific; neither entry subsumes the other.

### `CS-040` — Local MCP stderr crosses directly into logs and status responses

- Severity / status / confidence: `P1` / `new` / high for the disclosure path, unknown for remote reachability.
- Owners and affected surfaces: local MCP subprocess transport, environment propagation, server logging, public MCP status routes, SDK and UI consumers.
- Observable surface: every local MCP stderr chunk is logged verbatim. If startup fails, the last four kilobytes are also embedded verbatim in `Status.error`, which the public MCP status routes return.
- Direct trigger: a third-party or project-local MCP process writes a bearer token, cookie, API key, authorization header, environment value, or exception containing one of those values to stderr. Log exposure occurs even on a successful connection; API exposure is added on startup failure.
- Root cause and control/data flow: untrusted process diagnostics are treated as public-safe text before the log/status split. The subprocess receives the full `Env.snapshot()` plus configured MCP environment, increasing the set of values that a dependency can echo.
- Why the current structure does not cure it: truncation bounds volume, not sensitivity. The remote static-credential path has only a narrow exact-secret replacement and that helper is not applied to local process diagnostics or arbitrary headers, cookies, and environment values.
- Evidence: `packages/opencorvus/src/mcp/index.ts:212-269,1091-1100,2840-2855,2870-2883,2968-2973`; `packages/opencorvus/src/server/routes/mcp.ts:12-33,64-82`.
- Contract, data, test, documentation, delivery, and risk impact: credentials can reach the configured log sink and MCP HTTP/SDK/UI status surfaces. Static evidence does not establish that those routes are remotely reachable or unauthenticated in every supported deployment, so that wider exposure remains unclaimed. No positive sensitive-stderr redaction contract was found.
- Bounded refactoring direction: a single process-diagnostic sanitizer runs before any log or public-status branch. Public status exposes a typed code and correlation identifier; controlled server diagnostics retain only bounded, redacted detail. Raw child stderr is not an API contract.
- Required positive verification for a future repair: a real isolated local MCP writes bearer, API-key, cookie, and injected-environment markers; captured logs and both MCP status routes contain none of the originals and return the declared typed failure plus correlation identifier.
- Deduplication / relationship: distinct from historical OAuth URL/state logging and generic server errors; this is the current local-subprocess stderr path with two concrete disclosure exits.

### `CS-041` — Channel adapter start failures are published as a running runtime

- Severity / status / confidence: `P1` / `new` / high.
- Owners and affected surfaces: Channel runtime, individual chat adapters, managed supervisor, standalone bootstrap, channel registry/status.
- Observable surface: adapter `start()` rejection is only logged. `ChannelRuntime.start()` still resolves and remains `running=true`; with zero successful adapters it only warns. The managed supervisor then marks the runtime running and reports every configured channel active, including failed ones.
- Direct trigger: invalid adapter credentials, a webhook port conflict, authentication failure, or another initialization error. Telegram additionally detaches the `bot.start()` promise, while Matrix and Signal resolve startup after launching long-lived loops whose later health is not supervised.
- Root cause and control/data flow: `_doStart` uses `Promise.allSettled`, replaces `this.adapters` with fulfilled owners, and discards rejected owners before cleanup. Startup exposes one top-level boolean instead of per-adapter receipts; the supervisor retains configured names from registration and projects the same aggregate state to all of them.
- Why the current structure does not cure it: zero configured adapters is checked before startup, not zero successfully started adapters. Existing idempotency tests cover server-spawn and directory failure, not adapter rejection after resource acquisition. Detached loop promises further separate claimed readiness from authentication and receive-loop health.
- Evidence: `packages/channel-runtime/src/core.ts:145-241`; `packages/channel-runtime/src/main.ts:103-129`; `packages/channel-runtime/src/adapters/telegram.ts:90-93`; `packages/channel-runtime/src/adapters/slack.ts:95-96`; `packages/channel-runtime/src/adapters/discord.ts:67-69`; `packages/channel-runtime/src/adapters/matrix.ts:51-64,147-163`; `packages/channel-runtime/src/adapters/signal.ts:52-63,113-121`; `packages/opencorvus/src/channel/supervisor.ts:180-211,277-336`; `packages/opencorvus/src/channel/registry.ts:27-66`; `packages/channel-runtime/test/start-idempotency.test.ts:80-128`.
- Contract, data, test, documentation, delivery, and risk impact: control planes claim unavailable channels are active; Server-Sent Events (SSE), watchdog, and backend resources can remain alive with no ingress. An adapter that acquires a socket/client and then rejects disappears from the owner set, creating an unowned cleanup window; whether a particular adapter actually leaks depends on its own rollback behavior.
- Bounded refactoring direction: the runtime owns explicit per-adapter startup receipts and cleanup. A configured adapter yields `running` or a typed failure only after authentication/listener readiness; rejected startup owners are rolled back before removal. The public result is either structured per-channel partial status or a fail-closed deployment result, and zero running adapters tears down every runtime resource.
- Required positive verification for a future repair: one successful adapter plus one rejecting after acquiring a real test resource returns exact partial status and proves rejected-owner cleanup; all adapters rejecting produces a typed aggregate failure, `running=false`, and settled server/subscription/watchdog resources; the registry reports each channel independently.
- Deduplication / relationship: related to `CS-012` bootstrap duplication, but this is a reachable fail-open lifecycle and ownership defect inside the shared runtime itself.

### `CS-042` — Task creation commits its root Session, Task, and request permission separately

- Severity / status / confidence: `P1` / `new` / high.
- Owners and affected surfaces: Task API creation/replay, root Session persistence, Task pipeline, per-request capability projection, host recovery, Overlay composer.
- Observable surface: one Task creation occurrence can leave an ownerless root Session, or can publish and recover a valid Task whose root Session permanently lacks a capability explicitly selected in the request. Replaying the same request/channel identity does not converge either partial state.
- Direct trigger: process termination or I/O failure after root `Session.create` but before `persistQueuedTask`, or after the Task transaction commits but before `Session.setPermission`. The current concrete request-derived permission is Overlay `web_search=true` mapped to a `websearch:* allow` rule.
- Root cause and control/data flow: the root Session persists in its own transaction and publishes Session events; Task, bindings, imports, package/process facts, progress, and Task events persist in a second transaction; request-derived permission persists in a third. Idempotency lookup is keyed only by committed Task/channel rows, and returns an existing Task before revisiting the permission stage.
- Why the current structure does not cure it: the Task pipeline's “commit together” comment applies only inside its own transaction. The catch path removes only prepared Artifact roots when imports exist, not the Session or Intent bundle. Started-Task host recovery initializes projects/executions but does not recover a creation stage or exact initial permission.
- Evidence: `packages/overlay/src/main.tsx:2276-2280`; `packages/opencorvus/src/task-api/index.ts:1636-1693,1740-1870`; `packages/opencorvus/src/session/index.ts:387-403,707-725`; `packages/opencorvus/src/engine/pipeline.ts:96-198`; `packages/opencorvus/src/engine/store.ts:256-263`; `packages/opencorvus/src/engine/host-recovery.ts:39-78,121-168`.
- Contract, data, test, documentation, delivery, and risk impact: a crash before Task commit creates duplicate/orphan root Sessions on retry; a crash after Task commit creates a durable Task whose operator-requested capability differs from the request metadata, while TaskCreated/TaskUpdated may already be visible. Queue=false tasks are marked started, but recovery cannot infer or repair the missing permission stage.
- Bounded refactoring direction: prepare the root Session without persisting it, then commit that exact Session, Task/bindings/initial facts, and initial permission in one database transaction; publish Session/Task events only after it commits. Disk Intent/Artifact staging belongs to one durable creation occurrence that restart can finish or discard, and idempotent replay verifies the complete occurrence rather than only the Task row.
- Required positive verification for a future repair: terminate an isolated child at the Session, Task, and permission boundaries, then replay the same request ID and channel binding; restart leaves exactly one root Session and one Task, every declared initial capability equals request metadata, and post-commit events name only that complete occurrence.
- Deduplication / relationship: the pattern resembles `CS-003`, but that item is Mission Session create-then-metadata repair. This item covers general Task creation, Task/request idempotency, event publication, and user-selected initial permissions.

### `CS-043` — Overlay sidecar health failure leaves a reusable non-ready owner

- Severity / status / confidence: `P1` / `new` / high.
- Owners and affected surfaces: Overlay native managed-backend supervisor, sidecar process/job ownership, process-occurrence evidence, startup progress, renderer connection and public server info.
- Observable surface: a spawned sidecar that remains alive but never passes `/global/health` produces a failed startup notification while retaining child, port, job/process group, payload lease, and a durable occurrence marked `running`. Later `server.info`/ensure calls return the same process as usable without repeating health readiness.
- Direct trigger: the backend process starts and stays alive, but its health endpoint remains unhealthy or unreachable until the readiness timeout.
- Root cause and control/data flow: spawn publication records `running` and installs all resource owners before readiness. The health-timeout branch emits diagnostics/progress only; it neither calls `stop_server_state` nor marks a typed failed occurrence. `current_server_info` classifies only physical child liveness, and both ensure paths short-circuit on that observation.
- Why the current structure does not cure it: early physical process exit does clear owners, but an alive non-ready process takes the separate `Running` observation path. Renderer connection probing may later display offline, yet it cannot revoke the native owner or prevent ensure from reusing it.
- Evidence: `packages/overlay/src-tauri/src/main.rs:4269-4394,4728-4771,4794-4815,4853-4907`; `packages/overlay/src/services/connection.ts:114-152,218-264`.
- Contract, data, test, documentation, delivery, and risk impact: a permanently unhealthy sidecar can retain its port and process-tree ownership, block automatic repair, and make native server info/startup progress/renderer connectivity disagree. Existing checks cover health response interpretation, not timeout rollback followed by ensure.
- Bounded refactoring direction: the supervisor owns one `starting -> ready | failed` occurrence. Readiness failure must settle and release the exact child/job/process group/occurrence/payload lease before returning, or retain a typed failed owner that `server.info` can never expose as ready. Public info returns a ready receipt, not mere PID liveness.
- Required positive verification for a future repair: launch an isolated sidecar that remains alive while health stays unhealthy; timeout settles every resource and marks the occurrence failed, the next ensure starts a new occurrence, and server info never returns the failed PID as ready.
- Deduplication / relationship: distinct from `CS-023` parent occurrence precision, `CS-011` SDK readiness parsing, and `CS-041` adapter readiness; this is the native desktop backend supervisor's own spawn/readiness settlement.

### `CS-044` — Session fork publishes its target before transcript cloning completes

- Severity / status / confidence: `P1` / `new` / high.
- Owners and affected surfaces: public Session fork route, Session list/children/event projection, Command Line Interface (CLI), Agent Client Protocol (ACP), Panel tools, Message and Part persistence.
- Observable surface: a fork request can fail while leaving a new visible child Session whose transcript is empty or contains only a prefix of the requested source transcript. Retrying creates another target identity, so the incomplete fork remains permanently observable.
- Direct trigger: process termination or a database write failure after `Session.createNext` commits, or during any later per-Message or per-Part clone write.
- Root cause and control/data flow: `Session.fork` first creates and publishes the target Session in its own transaction, then iterates source Messages and Parts. Each `updateMessage` and `updatePart` owns another transaction; there is no fork occurrence, completion state, idempotency key, rollback owner, or restart completion path.
- Why the current structure does not cure it: the source cutoff bounds which Messages should be copied but does not make the clone atomic. A caller error reports only the failed request; it cannot hide or recover the already committed child Session, and a replay chooses a new Session ID.
- Evidence: public route `packages/opencorvus/src/server/routes/session.ts:1088-1109`; fork implementation `packages/opencorvus/src/session/index.ts:288-333`; per-entity transaction writers `packages/opencorvus/src/session/index.ts:1184-1202,1608-1654`; additional production callers in CLI, ACP, and Panel tools.
- Contract, data, test, documentation, delivery, and risk impact: Session hierarchy, creation events, history projection, and caller success can disagree about whether a fork exists and is complete. Consumers can operate on a permanently partial transcript, and no focused failure-injection contract proves an all-or-nothing fork.
- Bounded refactoring direction: prepare the target Session identity and the selected Message/Part clones, then persist all of them in one database transaction and publish Session/Message events only after commit. The public request supplies one idempotency identity if replay convergence is required; delete the create-then-copy path without a dual protocol.
- Required positive verification for a future repair: inject failure at every Message and Part write boundary and prove the source remains unchanged and no target Session/event becomes visible; success publishes exactly one complete cutoff transcript, and replay with the same idempotency identity returns that same fork.
- Deduplication / relationship: shares the create-then-populate pattern with `CS-003` and `CS-042`, but has a separate public fork contract, transcript-copy authority, replay identity, and all-or-nothing acceptance output.

### `CS-045` — Server restart and shutdown acknowledge success before lifecycle admission

- Severity / status / confidence: `P2` / `new` / high.
- Owners and affected surfaces: public server lifecycle routes, restart handoff, shutdown registry, managed deployment and upgrade callers, generated JavaScript Software Development Kit (SDK).
- Observable surface: `POST /restart` and `POST /shutdown` can return HTTP 200 with `{ ok: true }` even though no exact lifecycle operation has yet been accepted. Any later quiesce, execution settlement, ownership release, successor spawn/readiness, listener restore, or shutdown failure is visible only in server logs; the caller has neither an operation identity nor a terminal status to query.
- Direct trigger: after the route observes a non-null handler, the 25 millisecond timer fires and the handler rejects, disappears, or otherwise fails to settle the requested lifecycle transition. Restart has many concrete asynchronous failure points after the response; shutdown additionally converts its handler rejection to `console.error` inside the registry.
- Root cause and control/data flow: the routes use handler presence as a capability probe, schedule the real operation after the response with `setTimeout`, and immediately publish success. The restart Promise and shutdown request are not registered as durable or process-local lifecycle occurrences, so the HTTP receipt is disconnected from admission and terminal settlement.
- Why the current structure does not cure it: closing the HTTP connection before quiescing the listener is a legitimate barrier, but it does not require claiming success before occurrence creation. Restart cleanup may restore the old listener and shutdown may fail closed internally, yet neither outcome can revise or correlate the already returned boolean response.
- Evidence: `packages/opencorvus/src/server/routes/app.ts:158-240`; restart handler contract `packages/opencorvus/src/server/restart.ts:1-21`; shutdown handler contract and swallowed rejection `packages/opencorvus/src/server/shutdown.ts:1-31`; concrete asynchronous restart stages `packages/opencorvus/src/cli/cmd/serve.ts:283-382` and `packages/opencorvus/src/server/restart-handoff.ts:141-220`; generated boolean-only SDK contract `packages/sdk/js/src/gen/types.gen.ts:22545-22572` and `packages/sdk/js/src/gen/sdk.gen.ts:11245-11267`.
- Contract, data, test, documentation, delivery, and risk impact: SDK, Overlay, deployment, upgrade, and recovery callers can confuse “a handler existed” with “this restart or shutdown was admitted.” A failed restart can leave the original listener restored while automation believes a successor is running; a failed shutdown can leave the process active after the caller has received success. No typed receipt carries the requested process occurrence or eventual outcome.
- Bounded refactoring direction: create and accept one exact lifecycle occurrence before returning, with an operation ID and current process-occurrence ID. Treat response flush as a barrier owned by that occurrence, then expose `ready`, `failed`, or terminal settlement through the same supervisor/status authority. Delete the boolean fire-and-forget timer protocol rather than layering a second status path over it.
- Required positive verification for a future repair: inject failure at handler disappearance, listener quiesce, execution settlement, ownership release, child spawn, successor waiting/readiness, listener restore, and shutdown settlement; prove each accepted request returns one correlated receipt whose queried terminal state matches the physical process/listener outcome.
- Deduplication / relationship: unlike `CS-011` (SDK startup log parsing), `CS-023` (watchdog process identity), `CS-041` (Channel aggregate readiness), and `CS-043` (native sidecar readiness), this is the backend's own public restart/shutdown mutation receipt.

### `CS-046` — Project discovery converts sandbox observation failure into durable non-ownership

- Severity / status / confidence: `P1` / `new` / high.
- Owners and affected surfaces: Project discovery and persistence, durable sandbox registrations, Worktree garbage collection (GC), managed Worktree removal.
- Observable surface: a transient inability to observe a registered sandbox can permanently remove that sandbox from its Project row. A later GC pass can then treat the still-existing Worktree as ownerless and physically remove its directory and branch.
- Direct trigger: `Project.fromDirectory` encounters a registered sandbox for which synchronous existence observation returns false because of access denial, input/output failure, or a temporarily unavailable mount. `existsSync` does not distinguish those conditions from confirmed absence.
- Root cause and control/data flow: ordinary Project discovery filters the durable `existing.sandboxes` registry through current filesystem reachability, then writes the reduced array back as authoritative Project state. Worktree GC deliberately treats that array as durable Task/workflow ownership; once discovery erases the binding, old-clean, old-zombie, or registry-prunable planning can reach managed removal without it.
- Why the current structure does not cure it: final managed removal checks current Project sandboxes and ownership markers, but the first authority was already corrupted by a non-authoritative probe. If no marker survives or marker observation also fails, the deletion gate cannot reconstruct the erased durable binding.
- Evidence: destructive filtering and Project-row update `packages/opencorvus/src/project/project.ts:664-734`; production Instance discovery/refresh entry points `packages/opencorvus/src/project/instance.ts:150-153,735-748,1380-1392`; GC's durable-sandbox preservation and candidate planning `packages/opencorvus/src/worktree/gc.ts:281-344`; apply path `packages/opencorvus/src/worktree/gc.ts:351-397`; final ownerless checks and physical removal `packages/opencorvus/src/worktree/index.ts:1021-1068,1898-1989`.
- Contract, data, test, documentation, delivery, and risk impact: a read-like lookup mutates durable ownership based on an ambiguous observation and can eventually authorize irreversible filesystem and Git deletion. Restart does not restore the lost association because the reduced Project row is itself persisted. No focused positive test injects EACCES/EIO during Project discovery and proves preservation through GC.
- Bounded refactoring direction: Project discovery must not reconcile durable sandbox membership from physical reachability. Return a typed `present | confirmed_missing | unknown` observation and preserve registrations for both missing and unknown; remove a sandbox only through one explicit reconcile/release occurrence with exact ownership evidence.
- Required positive verification for a future repair: inject access and I/O failures for a registered sandbox; prove the Project row remains unchanged, GC emits a preservation rather than a candidate, and restored filesystem access retains the same binding. A successful explicit release should still produce one deletion-eligible receipt.
- Deduplication / relationship: `CS-036` covers ownership-marker read failure at the final destructive gate; this finding is an earlier normal discovery path that erases the separate durable sandbox authority. `CS-002` concerns cross-row implicit migration, not single-row ownership loss.

### `CS-047` — Frontend Design partial output settles as workflow success

- Severity / status / confidence: `P1` / `new` / high.
- Owners and affected surfaces: Frontend Design Agent, Orchestrator adapter, Task Artifact persistence, dispatch settlement, workflow frontier projection.
- Observable surface: when Frontend Design lacks its required structured completion output, the producer explicitly reports `outcome: "partial"` with missing actions and completeness findings, and persistence stores a partial artifact; the adapter nevertheless settles the dispatch as `terminal_success`, marks the workflow node successful, and opens dependent frontier nodes.
- Direct trigger: the Frontend Design Turn finishes without a current structured snapshot, including semantic-output failure recorded by its collector.
- Root cause and control/data flow: the domain producer and durable artifact retain an explicit partial result, but `frontend-design-tool` maps that branch to `DispatchOutcome.terminal`. That constructor serializes `terminal_success`, and workflow description considers any such dispatch sufficient for predecessor success without consulting the artifact's partial status.
- Why the current structure does not cure it: completeness evidence exists and is durable, so this is not an observability gap. The generic outcome vocabulary or adapter mapping lacks a domain-incomplete settlement, causing the control plane to promote evidence it already knows is incomplete.
- Evidence: explicit partial producer result `packages/opencorvus/src/frontend-design/agent.ts:206-226`; partial artifact followed by terminal outcome `packages/opencorvus/src/orchestrator/frontend-design-tool.ts:276-294`; partial payload contracts `packages/opencorvus/src/frontend-design/partial-artifact.ts:18-44` and `packages/opencorvus/src/frontend-design/artifact.ts:25-56,80-85`; terminal constructor `packages/opencorvus/src/agent/dispatch-outcome.ts:143-149`; success/frontier projection `packages/opencorvus/src/engine/describe.ts:735-788`; lifecycle/domain separation contract `specs/current/architecture/task-control-plane.md:21`.
- Contract, data, test, documentation, delivery, and risk impact: downstream Agents can run against a knowingly incomplete design contract while Task status claims successful prerequisite delivery. Operators see conflicting durable facts, and retries may be suppressed because the node is already terminal-successful. No focused settlement test covers the partial branch.
- Bounded refactoring direction: introduce or use one typed non-success domain-incomplete outcome carrying the exact partial artifact locator. Workflow projection must retain the evidence but not open successors. Do not overload the existing post-Turn-operation `partial` meaning if it cannot represent domain incompleteness; define the semantic once and update all producers together.
- Required positive verification for a future repair: omit a required Frontend Design output action and prove one partial artifact is durable, dispatch settlement is typed non-success and references it, and the dependent frontier remains closed; complete structured output still settles terminal success and opens the expected successor.
- Deduplication / relationship: shares the terminal-success promotion pattern with `CS-034`, but that item covers rejected Architect projections. This is an independent adapter whose producer and artifact already state domain partiality; it does not involve the dual-write failure in `CS-001`.

### `CS-048` — Provider removal uses a static lock file as a false durable mutation owner

- Severity / status / confidence: `P1` / `new` / high.
- Owners and affected surfaces: project/global Provider configuration, global Auth credential store, public Provider removal routes and receipts, restart recovery.
- Observable surface: Provider removal can durably delete configuration while leaving its credential behind. A crash between the two commits loses even the in-memory residue response, and an Auth failure returns HTTP 200 `committed_with_residue` without persisting any recovery work; restart has no way to enumerate or settle the incomplete deletion.
- Direct trigger: process termination after the project or global config patch commits but before `Auth.remove`, or an Auth read/removal failure after that config commit.
- Root cause and control/data flow: a process lock serializes mutation against a file containing only the constant text `provider removal owner`. The file records no provider, scope, operation identity, stage, or old/new revision. Configuration and the separate global `auth.json` store then commit sequentially; the only residue fact is constructed in the transient HTTP response.
- Why the current structure does not cure it: `proper-lockfile` prevents concurrent writers while the process is alive, but it is not a transaction journal or restart owner. Retrying may remove a readable leftover credential, but there is no same-request occurrence, no proof of the prior intended outcome, and no startup recovery reader. The route descriptions' “one durable mutation owner” claim is therefore false.
- Evidence: static owner and sequential commits `packages/opencorvus/src/provider/removal.ts:16,58-106`; independent Auth storage `packages/opencorvus/src/auth/index.ts:69-75,102-120`; project route contract `packages/opencorvus/src/server/routes/provider.ts:111-133`; global route contract `packages/opencorvus/src/server/routes/global.ts:789-811`; provider-ID credential authority `specs/current/architecture/06-provider.md:269`.
- Contract, data, test, documentation, delivery, and risk impact: configuration, saved credentials, route receipts, and runtime provider state can refer to different deletion revisions. Credentials intended for deletion can persist indefinitely after a crash or lost response, while callers are told the config mutation committed under a durable owner. No crash-cut test covers the config/Auth boundary or response loss.
- Bounded refactoring direction: create one durable Provider-removal occurrence containing provider ID, scope, config old/new revisions, credential identity/digest without the secret, current stage, and recovery decision. Startup must complete or roll back that exact occurrence before serving mutations; the HTTP receipt references it. Delete the constant lock-file fiction and sequential response-only residue protocol.
- Required positive verification for a future repair: terminate an isolated process before/after config commit, Auth read/removal, and response delivery; after restart and same-request replay, prove convergence to one complete old or new revision and a correlated terminal receipt, with no secret stored in the journal.
- Deduplication / relationship: `CS-039` is the analogous MCP configure failure across project config and `mcp-auth.json`; Provider removal uses different authorities, public receipt semantics, and recovery behavior, so it needs a separately executable repair even if both later share one transaction primitive.

### `CS-049` — Board sync and freshness are a public no-op protocol

- Severity / status / confidence: `P1` / `new` / high.
- Owners and affected surfaces: Overlay Board store and mutation/recovery callers, Task Board route, Task API, Workbench Board projection and Server-Sent Events (SSE) refresh loop.
- Observable surface: production callers request `sync: true`, often together with `requireFresh: true`, and wait for a successful Board reload after mutations or recovery. Overlay sends `?sync=1` and clears its sync-pending state on a normal response, but the server returns the same current database projection without performing or awaiting any synchronous advancement.
- Direct trigger: Goal save, selected-Task recovery, Worktree deletion reload, debug copy, or event-debounced refresh requests a synchronous/fresh Board while the asynchronous poll loop has not yet advanced the relevant Task state.
- Root cause and control/data flow: the old synchronous-evaluation behavior was removed in favor of a poll loop, but its boolean control protocol remains across the entire stack. The route parses and forwards `sync`; both Task API methods name it `_input` and ignore it, and `getBoard` is deliberately called with `{ sync: false }`. Overlay nevertheless treats the HTTP round trip as completion of the requested strong refresh.
- Why the current structure does not cure it: `requireFresh` only ensures a separate post-mutation request, not that the returned snapshot includes the mutation's settlement. ETag proves equality to the current read, not a target revision. `boardSyncPending` therefore records and clears a promise no backend authority can fulfill.
- Evidence: Overlay option and request state `packages/overlay/src/store/board.ts:100-104,312-375,717-737`; representative production callers `packages/overlay/src/main.tsx:1228-1230`, `packages/overlay/src/services/selected-task-recovery.ts:131-140`, `packages/overlay/src/components/TaskDirBar.tsx:914-928,973-987`, and `packages/overlay/src/services/dialog.ts:87-105`; route parsing and forced read `packages/opencorvus/src/server/routes/orchestrator.ts:1492-1524`; ignored Task API inputs `packages/opencorvus/src/task-api/index.ts:2083-2087,2124-2128`; read-only projection `packages/opencorvus/src/workbench/board.ts:49-60`.
- Contract, data, test, documentation, delivery, and risk impact: mutation and recovery code can proceed against a stale Board while believing strong refresh succeeded. SSE bursts repeatedly transmit an ineffective control bit, making state and retries harder to reason about. No positive test proves a requested target revision is present before the call resolves.
- Bounded refactoring direction: choose one current contract. If Board GET is pure read, remove `sync` from Overlay, URL, route, and Task API, and have mutation/recovery callers await an explicit Task/Board revision or poll-loop settlement receipt. If bounded synchronous advancement is required, expose one typed operation whose terminal receipt and Board ETag share the same revision. Do not keep the boolean as compatibility state.
- Required positive verification for a future repair: after a mutation or recovery operation returns a target revision, request/wait for Board and prove its snapshot version reaches that revision before success; timeout returns a typed stale/settlement failure. Ordinary Board GET remains a pure read with no hidden advancement.
- Deduplication / relationship: `CS-033` is an ignored lifecycle argument on the base Conversation projector; this finding spans a live public Board route and production callers that ascribe stronger freshness semantics to the ignored option.

### `CS-050` — Right-sidebar Conversation publishes before its requested model is persisted

- Severity / status / confidence: `P2` / `new` / high.
- Owners and affected surfaces: right-sidebar Conversation creation route, Chat Session factory, Session config overlay, requested model selection, Session events and lists.
- Observable surface: a create request specifying a model can fail while leaving a new visible Conversation Session that silently uses the default model. Retrying creates another Session, so the incorrectly configured first Session remains durable and observable.
- Direct trigger: process termination or database failure after `createRightSidebarConversationSession` commits but before `Session.mergeConfigOverlay` commits the already validated model overlay.
- Root cause and control/data flow: the route validates and parses the optional model, calls the Chat factory which delegates to `Session.createNext` and publishes the complete-looking Session, then performs a second transaction to merge the model into `metadata.configOverlay`. There is no creation occurrence, idempotency identity, compensation, or restart completion owner.
- Why the current structure does not cure it: validating before creation proves only that the model is valid, not that it is part of the created fact. Session events and query surfaces can observe the first commit, and retry allocates a new identity rather than completing the old one.
- Evidence: public request and create-then-overlay route `packages/opencorvus/src/server/routes/right-sidebar-conversation.ts:132-163`; Chat factory `packages/opencorvus/src/chat/session.ts:51-61`; Session create transaction/publication `packages/opencorvus/src/session/index.ts:387-403`; independent overlay transaction `packages/opencorvus/src/session/index.ts:607-659`.
- Contract, data, test, documentation, delivery, and risk impact: the public create request, first Session event, durable metadata, selected model, and caller result can disagree. Unlike a privilege escalation or workflow terminal error, the blast radius is one Conversation creation, so P2 is appropriate despite the high-confidence atomicity defect.
- Bounded refactoring direction: finish model validation before creation and include the complete config overlay in the prepared Session's single insert/transaction. Publish the creation event only for that complete Session and delete the post-create merge from this route.
- Required positive verification for a future repair: inject failure around Session persistence and prove no model-less target/event is visible; success exposes one Session whose first representation contains the exact requested model. If the public API promises safe replay, the same creation identity returns that Session rather than allocating another.
- Deduplication / relationship: shares create-before-complete with `CS-003`, `CS-042`, and `CS-044`, but owns a separate public Conversation creation contract and model-selection fact. `CS-038` concerns Message visibility, not Session creation atomicity.

### `CS-051` — Crash residue can be reused as a ready Worktree before population completes

- Severity / status / confidence: `P1` / `new` / high.
- Owners and affected surfaces: deterministic Build and Automation Worktrees, Git Worktree registry, sandbox/owner registration, Worktree population and Ready events.
- Observable surface: after a process crash during Worktree creation, a retry can immediately publish the residual Worktree as Ready even though it is still empty, at the wrong revision, missing gitlinks, or missing required startup materialization.
- Direct trigger: `git worktree add --no-checkout` and ownership registration succeed, the process terminates during reset/gitlink/start-script population, then Build or Automation retries the deterministic name with `reuseIfValid: true`.
- Root cause and control/data flow: the physical Git container and owners are established before `populate`. Caught failures run `convergeFailedCreate`, but a process crash skips that cleanup. Retry calls `isValid`, which checks only `.git` linkage and Git registry membership, then registers the owner and publishes Ready without resuming or validating population.
- Why the current structure does not cure it: sandbox and marker identities prove ownership, not content readiness. `isValid` names physical Git validity while callers interpret the result as complete execution readiness; no creation occurrence or ready receipt records base revision, gitlinks, or startup completion.
- Evidence: deterministic reuse callers `packages/opencorvus/src/build/agent.ts:595-610` and `packages/opencorvus/src/scheduler/automation-service.ts:1494-1503`; create/populate/rollback and reuse paths `packages/opencorvus/src/worktree/index.ts:1663-1692,1715-1798`; physical-only validation `packages/opencorvus/src/worktree/index.ts:1820-1841`; reuse contract `packages/opencorvus/src/worktree/index.ts:438-450`.
- Contract, data, test, documentation, delivery, and risk impact: Build can execute and emit diffs/commits from an incomplete checkout; Automation can skip declared startup materialization; the Ready event contradicts Worktree contents. Because retry short-circuits before `populate`, the residue does not naturally self-repair.
- Bounded refactoring direction: one durable Worktree creation occurrence owns exact directory, branch, requested base revision, and `created -> populated -> ready` stages. Reuse requires a ready receipt proving that the requested initial reset, gitlinks, and startup materialization completed for that occurrence; it must not require the current HEAD to remain frozen after legitimate Build commits. Incomplete occurrences resume population or settle exact-owner rollback before recreation. Delete the physical-validity-to-Ready shortcut.
- Required positive verification for a future repair: terminate isolated creation after worktree add, ownership registration, reset, every gitlink, and startup scripts; retry never publishes Ready for incomplete state and either completes the same occurrence or fully rolls it back before recreation. The returned directory has the declared HEAD, gitlinks, and startup receipt.
- Deduplication / relationship: `CS-043` covers native sidecar physical liveness versus health readiness; this finding is the analogous but independently executable Git Worktree population/readiness failure. `CS-046` covers sandbox ownership erasure, not creation completeness.

### `CS-052` — Task message side effects commit before durable message acceptance

- Severity / status / confidence: `P1` / `new` / high.
- Owners and affected surfaces: public Task message route, Task Session model overlay, Attachment Store and Task Attachment references, user Message/event/wake acceptance.
- Observable surface: a Task message request can fail or disappear while still changing the Task's subsequent model and adding some or all requested Attachments. No user Message, wake ingress, or acceptance receipt explains those durable side effects.
- Direct trigger: process termination after the requested model overlay or any Attachment reference commits, but before `persistMessageWithCommit` commits the Message, `TaskMessageRecorded` event, and queued wake artifact.
- Root cause and control/data flow: raw Attachment bytes are published first; the requested model commits in an independent Session transaction; each Attachment reference commits through its own Task update; only afterward does one transaction accept the canonical Message and wake. In-process catch compensation can restore the model on ordinary errors but cannot survive termination, and Attachment references have no compensation.
- Why the current structure does not cure it: the route's `202` contract describes durable message acceptance, yet there is no message occurrence that owns the preceding side effects. A retry allocates another Message identity; SHA deduplication does not associate residual references or model changes with the lost request.
- Evidence: route and request contract `packages/opencorvus/src/server/routes/orchestrator.ts:1595-1620`; Task message input `packages/opencorvus/src/engine/model.ts:527-548`; Attachment preparation `packages/opencorvus/src/task-api/index.ts:1482-1509,3578-3582`; pre-message model/Attachment commits `packages/opencorvus/src/task-api/index.ts:3604-3626,1987-2005`; canonical Message/event/wake transaction `packages/opencorvus/src/task-api/index.ts:1076-1145,3628-3631`; model-only compensation `packages/opencorvus/src/task-api/index.ts:3667-3679`.
- Contract, data, test, documentation, delivery, and risk impact: Session model choice, Task Attachments, Message history, wake delivery, caller receipt, and concurrent/next Turns can describe different request revisions. Another Turn can observe a model change whose triggering Message never existed.
- Bounded refactoring direction: validate the model and prepare immutable Attachment bytes first, then commit the exact user Message/Parts, Task Attachment references, Session overlay, event, and wake ingress in one database transaction. Bind published byte objects to that durable Message occurrence for retry/reclamation and delete catch-only rollback.
- Required positive verification for a future repair: terminate an isolated process at model, each Attachment reference, Message, event, and wake boundaries; restart exposes either no side effect or one complete replayable Message occurrence with exactly one wake. Concurrent Turns never observe a model from an unaccepted Message.
- Deduplication / relationship: `CS-042` covers initial Task creation; `CS-050` covers new Conversation model configuration. This finding owns an existing Task's public Message mutation and its early model/Attachment effects.

### `CS-053` — Remote Skill cache treats truncated final-path files as a complete snapshot

- Severity / status / confidence: `P1` / `new` / high.
- Owners and affected surfaces: Remote Skill discovery, deterministic global cache, Skill installation validation/manifest/config, configured runtime Skill loading.
- Observable surface: after termination during a supporting-file download, retry skips the truncated file because its final path exists. If `SKILL.md` parses, installation and later runtime loading can accept the directory as a valid Skill while instructions, scripts, or references remain corrupted.
- Direct trigger: the remote index declares `SKILL.md` plus supporting files; `writeStream` creates a deterministic final file and the process exits before the stream completes; retry of the same URL observes that path and reports the file downloaded.
- Root cause and control/data flow: the index carries file names but no content digests; each download writes directly to the final cache path; `exists(dest)` is the completion predicate; a directory is published when all file calls return true. Installation validation parses only `SKILL.md`, then writes its manifest and global URL configuration over the already accepted cache.
- Why the current structure does not cure it: `Promise.all` handles returned failures, not termination. No unique staging directory, snapshot identity, completeness manifest, digest validation, or retry repair distinguishes a partial file from a complete one.
- Evidence: index and cache contract `packages/opencorvus/src/skill/discovery.ts:10-20`; existence shortcut and final-path stream `packages/opencorvus/src/skill/discovery.ts:52-66`; deterministic mapping/publication `packages/opencorvus/src/skill/discovery.ts:111-158`; URL install/validation/config `packages/opencorvus/src/skill/manager.ts:355-382,660-679`; non-atomic stream writer `packages/opencorvus/src/util/filesystem.ts:264-280`; configured runtime load `packages/opencorvus/src/skill/skill.ts:747-756`.
- Contract, data, test, documentation, delivery, and risk impact: `pull()` no longer guarantees an index-complete snapshot, while installation receipts, the manifest, global config, and runtime inventory all recognize the corrupt directory. Agent behavior depending on supporting instructions/scripts becomes persistent and non-reproducible until cache deletion.
- Bounded refactoring direction: download the declared file set into one unique same-filesystem staging directory, verify that every stream completed, compute a local snapshot digest, write one source-bound completeness manifest, and atomically rename it to the published cache identity. Readers accept only a matching manifest; a remote digest can strengthen authenticity but is not required to remove this crash-residue chain. Delete final-path-exists success and the old cache reader together.
- Required positive verification for a future repair: terminate during every file stream and prove retry completes rather than reuses the fragment; every published file matches the local completeness manifest; same-named Skills from different URLs remain source-separated; install manifest/config/runtime inventory all reference the same verified snapshot.
- Deduplication / relationship: shares physical-existence-versus-readiness with `CS-051`, but owns a different remote content snapshot, installation contract, recovery action, and runtime consumer.

### `CS-054` — Incomplete Research artifacts settle as workflow success

- Severity / status / confidence: `P1` / `new` / high.
- Owners and affected surfaces: shared Research Agent, Deep Research and Frontend Research dispatchers, Research Artifact persistence, dispatch settlement and workflow frontier.
- Observable surface: the Research producer explicitly reports `outcome: "incomplete"` with missing fields and a partial draft, yet both production dispatchers persist a partial artifact and settle the dispatch as `terminal_success`, allowing dependent workflow nodes to start.
- Direct trigger: either Research mode completes its Turn without a valid complete structured snapshot while persistence of the partial artifact succeeds.
- Root cause and control/data flow: both incomplete branches call `persistResearchArtifactBestEffort`; the helper equates successful persistence with successful domain delivery and unconditionally returns `DispatchOutcome.terminal`. Workflow projection reads only that settlement kind, not the artifact's partial label or missing evidence.
- Why the current structure does not cure it: the helper's catch path handles infrastructure/contract persistence failure, but domain incompleteness is a successful write of a known-incomplete fact and therefore follows the false-success branch.
- Evidence: producer `packages/opencorvus/src/research/agent.ts:181-191`; Deep and Frontend branches `packages/opencorvus/src/orchestrator/deep-research-stage.ts:65-89` and `packages/opencorvus/src/orchestrator/frontend-research-stage.ts:73-94`; partial payload `packages/opencorvus/src/engine/persist.ts:1558-1597`; helper `packages/opencorvus/src/orchestrator/research-persistence.ts:35-50`; production registration `packages/opencorvus/src/orchestrator/tools.ts:1330-1384,2112-2140`; settlement/frontier `packages/opencorvus/src/orchestrator/dispatch-agent-tool.ts:601-619`, `packages/opencorvus/src/agent/dispatch-outcome.ts:143-149`, and `packages/opencorvus/src/engine/describe.ts:730-787`.
- Contract, data, test, documentation, delivery, and risk impact: downstream Agents can consume known-incomplete briefs while prerequisites appear successful and retries may be suppressed. No focused settlement/frontier test covers incomplete Research.
- Bounded refactoring direction: use one typed domain-incomplete settlement carrying the exact partial artifact locator and missing evidence, while keeping successors closed. Only a complete Research snapshot maps to terminal success; delete the helper's persistence-equals-delivery rule.
- Required positive verification for a future repair: for both modes, omit required snapshot fields and prove a durable partial artifact, typed non-success settlement, and closed frontier; complete snapshots still open the expected successor.
- Deduplication / relationship: `CS-047` covers Frontend Design's independent producer/schema/adapter; this item covers two Research adapters sharing their own persistence helper.

### `CS-055` — Rejected blocker clarification settles Intent Analysis as workflow success

- Severity / status / confidence: `P1` / `new` / high.
- Owners and affected surfaces: Intent Analysis, Question lifecycle, Intent Analysis Artifact, dispatch settlement, generated Expert Squad workflows.
- Observable surface: a clarification explicitly marked `blocker` can be rejected or expire, yet Intent Analysis persists that unanswered outcome and settles `terminal_success`; Requirements and other dependent nodes can then start.
- Direct trigger: Intent Analysis emits at least one blocker and `Question.askAndFormat` returns `rejected` or `expired` with no answers.
- Root cause and control/data flow: the adapter correctly records the Question terminal state and null clarified request, but unconditionally maps the Turn to `DispatchOutcome.terminal`. Workflow projection does not inspect the blocker outcome and treats the predecessor as successful.
- Why the current structure does not cure it: the domain definition itself says downstream cannot start without the answer, and the durable Artifact retains the failure, but the generic dispatch vocabulary has no domain-blocked settlement consumed by the frontier.
- Evidence: blocker contract `packages/opencorvus/src/intent-analysis/types.ts:40-54`; Question terminal union `packages/opencorvus/src/question/index.ts:530-599`; adapter and Artifact persistence `packages/opencorvus/src/orchestrator/analyze-intent-tool.ts:83-168` and `packages/opencorvus/src/intent-analysis/artifact.ts:26-46`; terminal/frontier `packages/opencorvus/src/agent/dispatch-outcome.ts:91-121,143-149` and `packages/opencorvus/src/engine/describe.ts:730-787`; generated Intent-to-Requirements dependencies `packages/opencorvus/generated/expert-squad-payload.ts:1022,1046`.
- Contract, data, test, documentation, delivery, and risk impact: workflow execution violates the producer's explicit prerequisite, downstream outputs lack required user intent, and a terminal-success settlement can suppress clarification recovery. No positive test covers reject/expiry through frontier projection.
- Bounded refactoring direction: rejected or expired blocker Questions produce one typed domain-blocked settlement referencing the exact Intent Artifact and Question occurrence. The frontier stays closed until that occurrence gains an answer and a usable revision, or the Task is explicitly terminated.
- Required positive verification for a future repair: exercise answered, rejected, and expired blockers; only answered produces a clarified revision and opens the dependent node, while the other terminal states remain correlated and blocked.
- Deduplication / relationship: same control-plane family as `CS-034`, `CS-047`, and `CS-054`, but this item owns an independent Question occurrence and blocker contract.

### `CS-056` — Overlay startup retry queues duplicate destructive restarts

- Severity / status / confidence: `P1` / `new` / high.
- Owners and affected surfaces: Overlay startup error page, native startup command, startup worker serialization, backend stop/start lifecycle and progress events.
- Observable surface: repeated retry clicks queue multiple real restarts. The first can become ready, after which the next queued worker stops that healthy backend and restarts it again; every command invocation has already returned `true` without an occurrence identity.
- Direct trigger: double-click or repeated click on the startup retry action while the first native worker is pending or running.
- Root cause and control/data flow: the HTML click handler neither awaits nor disables the action. The native command detaches a worker and immediately returns; `StartupWorker` uses a Mutex only for serialization, and tests explicitly prove concurrent requests both execute rather than coalescing. Each execution calls `stop_server_state` before starting.
- Why the current structure does not cure it: mutual exclusion prevents simultaneous mutation but not duplicate mutation. Progress events are global phase notifications and cannot correlate multiple boolean receipts or suppress the queued destructive occurrence.
- Evidence: startup page `packages/overlay/src/index.html:199-216`; detached command `packages/overlay/src-tauri/src/main.rs:4900-4918`; stop/start operation `packages/overlay/src-tauri/src/main.rs:4774-4787,4832-4897`; serialization and concurrency test `packages/overlay/src-tauri/src/main.rs:1444-1451,6006-6041`.
- Contract, data, test, documentation, delivery, and risk impact: successful recovery can be followed by an unexpected second outage, preparation work and events can repeat/out-of-order, and callers cannot identify which restart a result describes.
- Bounded refactoring direction: one native single-flight lifecycle owner returns an operation ID; retries while active return that occurrence or typed busy. The UI awaits admission and disables the action until terminal state. Delete detached boolean acceptance.
- Required positive verification for a future repair: issue concurrent retries and prove exactly one stop/start occurrence, one correlated terminal state, and a disabled/busy UI contract; a later retry after terminal completion creates a new occurrence.
- Deduplication / relationship: `CS-043` is health-failure cleanup and `CS-045` is backend HTTP lifecycle admission; this is the native retry surface's duplicate destructive occurrence.

### `CS-057` — Channel shared-Session creation splits remote identity from local claim

- Severity / status / confidence: `P2` / `new` / high.
- Owners and affected surfaces: Channel shared-session mode, remote Session create API, local shared-session claim file, inbound conversation routing.
- Observable surface: a local claim write failure or crash after remote Session creation leaves a user-visible orphan Session. The next inbound message retries with no claim and creates a different Session, permanently splitting the attempted shared conversation identity.
- Direct trigger: `session.create` succeeds, then atomic write, rename, fsync, or process lifetime fails before the local shared-session file is committed.
- Root cause and control/data flow: a file lock serializes local callers, but the code creates the durable server Session first and only afterward writes the unique local claim. The server API accepts no canonical shared-owner idempotency identity, and failures are converted to an initialization failure without compensation or recovery lookup.
- Why the current structure does not cure it: atomic local file replacement protects file bytes, not the remote-create/local-claim boundary. A retry cannot discover which orphan was intended and therefore allocates a new Session ID.
- Evidence: production shared-mode entry `packages/channel-runtime/src/core.ts:288-303`; claim flow and error conversion `packages/channel-runtime/src/core.ts:669-746`; server create route `packages/opencorvus/src/server/routes/session.ts:938-956`; create schema `packages/opencorvus/src/session/index.ts:268-284`; happy-path-only isolation coverage `packages/channel-runtime/test/core-session-isolation.test.ts:261-329`.
- Contract, data, test, documentation, delivery, and risk impact: Session lists/events expose orphan conversations, channel history continues in a different Session, and repeated storage failures accumulate durable resources. Existing locking and tests do not establish crash convergence.
- Bounded refactoring direction: make the server own an idempotent get-or-create claim keyed by the canonical Channel shared owner under a unique constraint; the local file becomes rebuildable cache. Alternatively, one durable cross-resource occurrence must be queryable and resumable. Delete create-then-local-claim authority splitting.
- Required positive verification for a future repair: fail each local publication stage and terminate the process after remote creation; replay of the same owner returns exactly one Session and all inbound messages route to it.
- Deduplication / relationship: shares create-before-complete with `CS-003`, `CS-042`, `CS-044`, and `CS-050`, but owns a distinct remote API/local claim boundary and Channel user entry.

### `CS-058` — Mission wake facts do not share one durable acceptance occurrence

- Severity / status / confidence: `P1` / `new` / high.
- Owners and affected surfaces: public Mission wake/dispatch routes, Mission Session model overlay, Attachment materialization, SessionWake Message/control bundle, pending-prompt consumption.
- Observable surface: a Mission request can change the model without accepting its Message, or can execute a pending prompt while leaving that prompt durable and apparently unconsumed. Retrying can then commit and execute the same instruction again under a new Message identity.
- Direct trigger: termination after the Session overlay commits but before Message/wake commit, or on dispatch after Message processing starts but before a separate metadata transaction clears the pending prompt.
- Root cause and control/data flow: both Mission routes write model/config overlay first. Wake materializes Attachments afterward and then calls `SessionWake.wake`; dispatch calls wake and only later clears pending metadata through `Session.mergeMetadata`. The routes do not supply a stable Message/occurrence identity or use `SessionWake.commitBundle` to include the owner facts in the Message transaction.
- Why the current structure does not cure it: content-addressed bytes reduce duplicate storage but do not identify the lost request. Restart cannot determine which overlay belongs to an unaccepted wake or whether a still-present pending prompt already executed.
- Evidence: public contracts and sequential routes `packages/opencorvus/src/server/routes/mission.ts:547-638,644-720`; Attachment materialization `packages/opencorvus/src/server/routes/mission.ts:137-165,704-715`; pending-prompt metadata clear `packages/opencorvus/src/mission/session.ts:102-129`; stable Message and transaction-owned bundle primitives `packages/opencorvus/src/session/wake.ts:106-145,160-183,262-281`.
- Contract, data, test, documentation, delivery, and risk impact: model revision, Attachment inputs, Session Message history, wake execution, pending-prompt ownership, HTTP receipt, and replay can describe different request occurrences. Duplicate dispatch can repeat external or destructive agent actions.
- Bounded refactoring direction: establish one exact Mission wake/dispatch occurrence. Validate model and prepare immutable Attachment bytes first, then use the Message transaction/`SessionWake.commitBundle` to persist overlay, Message/Parts, wake control, and pending-prompt consumption together. Use a stable occurrence/Message identity for replay and delete route-level sequential writes.
- Required positive verification for a future repair: terminate after overlay, every Attachment, Message, wake control, and pending-prompt boundary; restart/replay converges to exactly one Message, wake, model revision, and prompt consumption. A dispatch prompt executes at most once.
- Deduplication / relationship: `CS-003` covers Mission Session identity creation and `CS-052` covers Task message acceptance. This finding owns the Mission-specific public wake/dispatch contract and its pending-prompt consumption fact.

### `CS-059` — Channel request replay can change meaning after interaction consumption

- Severity / status / confidence: `P1` / `new` / high.
- Owners and affected surfaces: public Channel ingress, stable request-id receipt, pending Permission/Question interaction, Project Memory occurrence, ControlMessage fallback.
- Observable surface: the same replayed Channel request can first answer/reject an interaction and later be interpreted as a new ordinary control message. A literal answer such as `allow` or `deny` can therefore create or mutate unrelated Task/control state after a crash.
- Direct trigger: an ingress with stable `request_id` resolves the current pending interaction, then the process terminates before the separate Channel receipt row commits; the sender replays the same request.
- Root cause and control/data flow: Channel ingress checks its receipt, executes the business mutation, and only then inserts the receipt. Interaction resolution and Memory occurrence commit in their own transaction. Replay finds no receipt and selects its branch from current state; because the interaction is no longer pending, the same text falls through to `ControlMessage.handle`.
- Why the current structure does not cure it: the in-process promise map coalesces only live concurrency. The interaction API can recognize direct replay of its own occurrence, but Channel ingress no longer routes the replay to that interaction after consulting the mutated pending state.
- Evidence: public route `packages/opencorvus/src/server/routes/channel.ts:102-122`; ingress receipt/business ordering and branch selection `packages/opencorvus/src/channel/ingress.ts:55-109,245-296`; interaction transactions `packages/opencorvus/src/engine/interaction.ts:264-284,322-355,375-405`; independent receipt schema `packages/opencorvus/src/channel/channel.sql.ts:5-17`.
- Contract, data, test, documentation, delivery, and risk impact: sender request identity, interaction terminal result, Memory fact, Channel receipt, and eventual control mutation can diverge. The sender cannot retrieve the original result and the same natural-language payload gains different semantics on replay.
- Bounded refactoring direction: make one Channel request occurrence/fingerprint own branch choice and the canonical mutation. Commit interaction resolution, its Memory occurrence, and Channel terminal receipt in the same transaction; non-interaction control messages also attach their mutation receipt to that occurrence. Delete execute-then-cache-result ordering.
- Required positive verification for a future repair: terminate after interaction resolution, Memory fact, and receipt boundaries; replay of the same request ID always returns the same interaction result, consumes it once, and never reaches ControlMessage. A mismatched fingerprint returns the stable conflict.
- Deduplication / relationship: `CS-057` covers remote Session/local claim creation and `CS-058` covers Mission pending-prompt wake. This finding owns Channel ingress idempotency and mutable replay routing.

### `CS-060` — Non-shared Channel Session initialization races per thread

- Severity / status / confidence: `P1` / `new` / high.
- Owners and affected surfaces: Channel Runtime default Session mode, Session Coordinator, remote Session create/prompt APIs, concurrent adapter callbacks.
- Observable surface: two concurrent first messages for the same platform/channel/thread can create two visible remote Sessions. Each handler submits its own first prompt, but the later Map write wins for subsequent messages, permanently splitting one channel conversation.
- Direct trigger: webhook redelivery or near-simultaneous long-poll callbacks enter `handleMessage` before any binding exists.
- Root cause and control/data flow: both handlers perform read-then-remote-create-then-Map-set without a per-thread claim, compare-and-swap, or in-flight owner. Processing serialization starts only after binding and keys by the now-different Session IDs.
- Why the current structure does not cure it: `SessionCoordinator.bind` is a plain Map assignment and the server create request has no canonical thread idempotency key. Process restart also loses the non-shared binding.
- Evidence: ingress, create, bind, and prompt path `packages/channel-runtime/src/core.ts:245-338,359-416`; coordinator `packages/channel-runtime/src/session-coordinator.ts:1-16`; adapter callback registration `packages/channel-runtime/src/core.ts:193-198`.
- Contract, data, test, documentation, delivery, and risk impact: the user sees duplicate Sessions and replies/history cross conversation boundaries. No focused concurrency/restart test proves one canonical thread owner.
- Bounded refactoring direction: the server owns a unique get-or-create claim keyed by canonical platform/channel/thread; a process-local single-flight only coalesces calls and cannot be the durable authority. Delete read-create-set.
- Required positive verification for a future repair: submit concurrent first messages and crash after create/claim boundaries; one Session is created, prompts preserve order, and replay resolves the same claim.
- Deduplication / relationship: `CS-057` covers shared mode's remote-create/local-file crash boundary; this is default mode's concurrent initialization race.

### `CS-061` — Local plugin installation treats partial node_modules as ready

- Severity / status / confidence: `P2` / `new` / high.
- Owners and affected surfaces: Config loading, local plugin dependency installation, Bun package tree, Plugin bootstrap.
- Observable surface: termination during `bun install` can leave `node_modules` present but incomplete; restart skips installation and repeatedly fails importing the local plugin until manual cleanup.
- Direct trigger: the process exits after canonical `package.json` and part of `node_modules` exist, before package installation completes.
- Root cause and control/data flow: requested package metadata is published before installation; `needsInstall` accepts directory existence plus the dependency selector as a completion receipt and verifies neither installed package, lockfile, nor tree. Catch rollback handles ordinary failure but not termination.
- Why the current structure does not cure it: Plugin bootstrap waits only for operations scheduled by `needsInstall`; once the residue passes that predicate, no repair operation exists.
- Evidence: discovery/scheduling `packages/opencorvus/src/config/config.ts:304-346,599-610`; install order `packages/opencorvus/src/config/config.ts:411-452`; readiness predicate `packages/opencorvus/src/config/config.ts:492-523`; plugin load `packages/opencorvus/src/plugin/index.ts:194-300`; bootstrap `packages/opencorvus/src/project/bootstrap.ts:62-75`.
- Contract, data, test, documentation, delivery, and risk impact: Config metadata, dependency tree, and project readiness disagree; the failure persists across restart. No crash-cut test covers the package-tree stages.
- Bounded refactoring direction: install and validate an exact tree/lockfile in a staging root, atomically publish a matching completion manifest, and make readers accept only that manifest. Delete node_modules-exists readiness.
- Required positive verification for a future repair: terminate at metadata, directory, package expansion, and lockfile boundaries; restart completes/rebuilds installation and successfully imports the plugin.
- Deduplication / relationship: `CS-053` is Remote Skill HTTP snapshot truncation; this is Bun dependency-tree publication for local plugins.

### `CS-062` — Global create allocates a random Project before durable request acceptance

- Severity / status / confidence: `P1` / `new` / high.
- Owners and affected surfaces: Global Task/Chat/Work routes, Implicit Project creation, Task request-ID idempotency, Session creation.
- Observable surface: the same Global Task request ID can normally replay into a second random Project and create/execute a duplicate Task; termination can also leave a registered Project without its intended Task or Session.
- Direct trigger: retry of a successful Global Task request, or process termination after Implicit Project publication and before Task/Session acceptance.
- Root cause and control/data flow: each call creates and registers a random Project before entering its Instance. Task deduplication is scoped to that new Project ID, so it cannot find the previous request. Global Conversation follows the same Project-before-Session ordering with only catch compensation.
- Why the current structure does not cure it: the process-local Task creation lock serializes requests but stores no global occurrence-to-Project identity. Random namespace allocation defeats the inner idempotency contract even without a crash.
- Evidence: Global Task route `packages/opencorvus/src/server/routes/orchestrator.ts:325-357`; service `packages/opencorvus/src/task-api/global-task-service.ts:11-35`; Implicit Project publication `packages/opencorvus/src/project/implicit-project.ts:350-370` and `packages/opencorvus/src/project/project.ts:639-723,972-1003`; project-scoped lookup `packages/opencorvus/src/task-api/index.ts:1668-1675` and `packages/opencorvus/src/engine/store.ts:256-262`; Global Conversation `packages/opencorvus/src/server/routes/global.ts:276-324` and `packages/opencorvus/src/chat/global-chat-service.ts:12-45`.
- Contract, data, test, documentation, delivery, and risk impact: duplicate Tasks may execute external actions twice; orphan Projects accumulate; the public 202 acceptance and request-ID semantics are false at the global boundary.
- Bounded refactoring direction: reserve/get-or-create one global creation occurrence keyed by request ID and bind its Project plus Task/Session recoverably. Replay resolves the occurrence before allocating a Project.
- Required positive verification for a future repair: repeat and crash-cut the same global request; exactly one Project and one Task/Session exist and only one execution is admitted.
- Deduplication / relationship: `CS-042` is the inner selected-Project Task transaction; this item is the outer random Project namespace that defeats it.

### `CS-063` — Release reruns can overwrite already-public immutable assets

- Severity / status / confidence: `P1` / `new` / high.
- Owners and affected surfaces: GitHub Release workflow, versioned installers/archives/signatures/checksums/update manifest, public supply-chain identity.
- Observable surface: rerunning a published version uploads each asset with `--clobber`, allowing one public version URL to change contents and temporarily contain a cross-run mixture of binaries, signatures, checksums, and manifest.
- Direct trigger: tag or manual workflow invocation for a version whose GitHub Release is already non-draft.
- Root cause and control/data flow: the workflow checks only whether the release tag exists, never its draft state, source commit, or complete asset digests, then unconditionally clobbers individual assets and again marks the release non-draft.
- Why the current structure does not cure it: the tag may be stable while toolchain/actions/signing output changes; sequential upload exposes partial replacement. Existing workflow-contract tests check step composition, not replay immutability.
- Evidence: triggers and release upload/edit `/.github/workflows/build.yml:3-12,251-309`; contract test `packages/opencorvus/src/script/github-actions-workflow-contract.test.ts:142-176`.
- Contract, data, test, documentation, delivery, and risk impact: the claimed immutable version identity, audit trail, rollback, updater signatures, and checksums can drift under one URL; a failed rerun can leave a mixed public set.
- Bounded refactoring direction: bind one release occurrence to tag commit and a complete staged digest manifest. Upload only to its draft; a public release is immutable—same manifest is no-op, different manifest is typed conflict. Delete public `--clobber`.
- Required positive verification for a future repair: replay identical and changed staged sets against draft and public fixtures; only exact identical public replay succeeds as no-op, and publication exposes one complete digest set atomically.
- Deduplication / relationship: distinct from generated-source/check coverage (`CS-008`, `CS-014`, `CS-017`); this is public release replay and supply-chain identity.

### `CS-064` — Partially invalid bundled environment is enabled and consumes its TTL

- Severity / status / confidence: `P2` / `new` / high.
- Owners and affected surfaces: Channel bundled-env parser, first-use state/TTL, adapter configuration and startup diagnostics.
- Observable surface: a bundle with both valid and malformed non-comment lines silently drops the malformed values, reports `enabled: true`, and permanently starts its time-to-live (TTL) before complete configuration has been accepted.
- Direct trigger: one line lacks `=` or has an invalid key while at least one other entry parses.
- Root cause and control/data flow: parser failures use `continue` without diagnostics. Any surviving entry bypasses `invalid_bundle`; `claimFirstUsedAt` then durably fixes the first-use time before applying only surviving values.
- Why the current structure does not cure it: adapter registry may later report missing required environment but cannot explain which bundle line was rejected. Correcting the bundle reuses the prematurely consumed TTL.
- Evidence: parse and enable path `packages/channel-runtime/src/bundled-env.ts:59-71,167-220`; durable timestamp `packages/channel-runtime/src/bundled-env.ts:125-148`; startup projection `packages/channel-runtime/src/main.ts:22-44,103-129`; adapter projection `packages/channel-runtime/src/registry.ts:147-159`; coverage gap `packages/channel-runtime/test/bundled-env.test.ts:49-132`.
- Contract, data, test, documentation, delivery, and risk impact: configuration typos become partial activation while logs claim active status; trial lifetime is irreversibly consumed and the root cause disappears.
- Bounded refactoring direction: parse to exact diagnostics and reject the entire snapshot for any invalid non-empty line without claiming first-use. Only a fully validated snapshot atomically claims TTL and applies, with a snapshot identity in the receipt.
- Required positive verification for a future repair: mixed valid/invalid input returns typed diagnostics, changes no environment and no first-use state; corrected input begins TTL exactly once and reports its accepted identity.
- Deduplication / relationship: `CS-041` is adapter start failure projected running; this defect occurs earlier at configuration acceptance and durable TTL mutation.

### `CS-065` — SDK generation transaction publishes multiple final paths non-atomically

- Severity / status / confidence: `P2` / `new` / high.
- Owners and affected surfaces: JavaScript SDK generation/build, generated source, OpenAPI schema, distribution tree, publication recovery.
- Observable surface: termination during final publication can leave `dist`, `src/gen`, hand-generated policy/default files, and `openapi.json` from different generations. The next run deletes the only backup before inspecting whether publication was incomplete.
- Direct trigger: the process exits while any of six final targets is being mirrored/copied after a complete staged build.
- Root cause and control/data flow: the helper backs up existing targets, but then mutates each real final path in sequence without a journal, generation identity, manifest, or atomic directory/pointer switch. Catch rollback covers ordinary exceptions only; startup unconditionally removes staging and backup roots.
- Why the current structure does not cure it: formatting and typecheck validate the complete pre-publication snapshot, not the final tree after a crash. Consumers read final paths directly and cannot reject a mixed generation.
- Evidence: complete staged build and target list `packages/sdk/js/script/build.ts:273-342`; backup deletion, per-target publication, and exception-only rollback `packages/sdk/js/script/generation-transaction.ts:144-197`.
- Contract, data, test, documentation, delivery, and risk impact: SDK types/client, runtime defaults/policies, OpenAPI and packaged distribution can disagree under one source revision; later packaging or manual publishing can consume the mismatch. No crash-cut recovery test covers the final publication stages.
- Bounded refactoring direction: publish one generation directory containing every verified artifact and switch one pointer/rename, or persist a durable journal that startup completes/rolls back before deleting snapshots. Readers accept only a matching generation manifest. Delete per-target in-place publication.
- Required positive verification for a future repair: terminate after every target and within directory mirroring; restart recovers one complete old or new generation, and all readers observe the same generation ID.
- Deduplication / relationship: `CS-014` is the SDK/transport source-topology cycle and `CS-008`/`CS-017` are check coverage; this item is crash consistency after generation succeeds.

### `CS-066` — Shared Bun package cache treats a partial tree as installed

- Severity / status / confidence: `P2` / `new` / high.
- Owners and affected surfaces: global Bun package cache, registry Plugins, dynamic Providers, package dependency tree and runtime import.
- Observable surface: termination during `bun add` can leave the target package's `package.json` and cache dependency version present while files or transitive dependencies remain incomplete. Restart returns that directory as installed and import fails persistently.
- Direct trigger: the process exits after final-tree package metadata is written but before Bun completes the shared cache tree.
- Root cause and control/data flow: readiness checks only directory presence, recorded dependency version, and installed package version. An exact matching version returns immediately; `latest` also returns when the registry says it is not outdated. Installation runs directly in the shared final root with no staging, completion manifest, tree digest, or restart recovery owner.
- Why the current structure does not cure it: the install lock only serializes live processes. Version equality proves identity, not tree completeness, and every restart follows the same shortcut.
- Evidence: readiness and direct final-root installation `packages/opencorvus/src/bun/index.ts:59-136`; Plugin caller/import `packages/opencorvus/src/plugin/index.ts:286-300`; dynamic Provider caller `packages/opencorvus/src/provider/provider.ts:930-953` and `packages/opencorvus/src/provider/install.ts:6-14`.
- Contract, data, test, documentation, delivery, and risk impact: Plugin bootstrap and Provider loading can remain broken across restarts; an interrupted update can also leave a mixed shared dependency tree. No kill-point test proves repair.
- Bounded refactoring direction: install and validate an exact package/dependency tree and lock digest in staging, then publish a matching generation manifest/root atomically. Readers accept only the manifest; delete directory/package-version readiness.
- Required positive verification for a future repair: terminate after package metadata and throughout dependency extraction/lock updates; restart repairs or republishes a complete tree and both Plugin and Provider imports succeed.
- Deduplication / relationship: `CS-061` covers project/global Config directories for local Plugins; this item is the separate shared registry cache used by Plugins and dynamic Providers.

### `CS-067` — Provider OAuth authorization uses one overwriteable pending slot

- Severity / status / confidence: `P1` / `new` / high.
- Owners and affected surfaces: project/global Provider auth routes, OAuth method selection, Proof Key for Code Exchange (PKCE)/state callback, OAuth server lease and Auth persistence.
- Observable surface: concurrent or repeated authorization for one Provider overwrites the previously returned flow. The old browser/code response can then invoke the wrong callback, fail PKCE/state correlation, become unrecoverable after restart, leak its OAuth server lease, or be replayed because a successful slot is not consumed.
- Direct trigger: authorize the same provider twice before completing the first, select another method, restart between authorize/callback, or repeat callback after success.
- Root cause and control/data flow: the public authorization response has no operation ID. State stores only `pending[providerID]`; callback looks up only provider ID and ignores its supplied method for matching. The concrete OpenAI browser callback owns PKCE, state, callback Promise and lease, and releases the lease only if that exact overwritten callback runs.
- Why the current structure does not cure it: serialization around a Map cannot correlate multiple already-published URLs or recover them. Final Auth storage records only successful credentials, not the in-flight occurrence or terminal cleanup.
- Evidence: Authorization schema and single-slot authorize/callback `packages/opencorvus/src/provider/auth.ts:56-136`; project/global routes `packages/opencorvus/src/server/routes/provider.ts:406-493` and `packages/opencorvus/src/server/routes/global.ts:617-677`; concrete leased callback `packages/opencorvus/src/plugin/openai/codex.ts:481-507`.
- Contract, data, test, documentation, delivery, and risk impact: clients cannot identify which authorization they are completing; credentials, selected method and resource ownership can diverge, and restart makes a published URL permanently unfinishable without a stable terminal receipt.
- Bounded refactoring direction: create one scope/provider/method OAuth occurrence ID; callback must present and compare-and-consume it, validate method, and release owned resources on success/failure/cancel. Persist recoverable state or a stable expired/cancelled terminal receipt as appropriate.
- Required positive verification for a future repair: run two same-provider flows, method changes, restart, success replay, failure and cancel; each callback affects only its occurrence, resources are released once, and replays return its terminal state.
- Deduplication / relationship: separate from MCP config (`CS-039`), Provider removal (`CS-048`), and generic server lifecycle receipts (`CS-045`); this is Provider OAuth identity and owned-resource settlement.

### `CS-068` — ControlMessage accepts request identity without owning replay

- Severity / status / confidence: `P1` / `new` / high.
- Owners and affected surfaces: public Panel and Gateway ControlMessage routes, Control Session Turns, request identity, streamed result delivery, and Panel tool mutations.
- Observable surface: if a completed ControlMessage response is lost, replaying the same `request_id` appends another user Message, runs another large language model Turn, and can execute another or different set of mutations. The same caller request therefore has no canonical conversation or result.
- Direct trigger: the first request persists Messages and completes one or more tool calls, then the process or connection fails before the Hypertext Transfer Protocol (HTTP) or Server-Sent Events (SSE) result reaches the caller; the caller retries the same request ID.
- Root cause and control/data flow: `request_id` is copied only into transient prompt/log/cancellation context. Each invocation independently resolves or creates the Control Session, persists a new user Message, starts a fresh streamed Turn, and projects the assistant/tool parts produced by that invocation. There is no request fingerprint, accepted/running/terminal occurrence, stable Message ownership, single-flight authority, or terminal-result lookup.
- Why the current structure does not cure it: individual Panel tools have heterogeneous local idempotency behavior, and some use the request ID only as a child mutation identity. That cannot prevent the whole Control Turn from running again, choosing different tools from already-mutated state, or sending another Task message without the identity.
- Evidence: public Panel routes `packages/opencorvus/src/server/routes/panel.ts:57-120`; Gateway route `packages/opencorvus/src/server/routes/gateway.ts:170-193`; public input schema `packages/opencorvus/src/control/message-schema.ts:71-91`; transient request context and per-call Message/Turn/result path `packages/opencorvus/src/control/message.ts:48-160,176-188,246-315,330-343`; representative Task-create and Task-message mutations `packages/opencorvus/src/tool/panel.ts:837-864,1091-1113`.
- Contract, data, test, documentation, delivery, and risk impact: caller request identity, user/assistant Messages, tool-call identities, mutations, and terminal response can diverge. Response loss can duplicate external effects or reinterpret the same request after the first Turn changed current Task/Session state. No focused restart/replay test proves one canonical Turn.
- Bounded refactoring direction: reserve one `(project, surface, request_id)` Control occurrence with a payload fingerprint before persisting the user Message. It owns stable user/assistant Message IDs, tool-call child identities, running/terminal state, and the final `ControlMessageResult`; replay resumes or returns that occurrence, while a different fingerprint returns a typed conflict. Delete request-ID-as-transient-context semantics.
- Required positive verification for a future repair: terminate after user Message, tool mutation, assistant Message, terminal persistence, and response-delivery boundaries; replay creates one Control Turn, one tool-call set, and one terminal result, including exactly one Task message. A changed payload with the same ID returns the stable typed conflict.
- Deduplication / relationship: `CS-059` is Channel interaction-to-Control branch drift after a late Channel receipt; `CS-042` and `CS-052` are local Task create/message atomicity. This finding owns direct Panel/Gateway whole-Control-Turn request replay.

## Needs-Proof Queue

- Restart handoff classifies bind failures with `Error.message.includes("port" | "address")` at `packages/opencorvus/src/server/restart-handoff.ts:107-120`. The human-text protocol is structurally fragile, but no supported Bun/platform error variant or stable structured alternative was proven, so it is not admitted.
- The release MCP status route's authentication and network-reachability boundary remains to be demonstrated dynamically. `CS-040` therefore claims only the proven log/status propagation and remains P1.
- Module-level Overlay clock and static-page browser listeners were inspected, but no production remount/bootstrap path that duplicates them was established. They are retained only as future trigger-based leads, not findings.

## Rejected or Closed Leads

- `Plugin.init` discards the disposer returned by `Bus.subscribeAll`, but this is not a reachable duplicate-subscription leak on the current path. `InstanceBootstrap` is identity-deduplicated by `CacheEntry.initRuns`; project refresh and rollback dispose the same directory-keyed Bus state before reinitialization; whole-repository search found no other production caller. Evidence: `packages/opencorvus/src/plugin/index.ts:419-440`; `packages/opencorvus/src/project/instance.ts:735-761,770-773,885-897`; `packages/opencorvus/src/bus/index.ts:143-162`; `packages/opencorvus/src/project/bootstrap.ts:62-72`.
- Attachment publication validation and residue probes preserve failure as `false`, `null`, or `PublicationError`; their callers do not authorize success or deletion from an observation failure. Evidence: `packages/opencorvus/src/storage/attachment-store.ts:283-307,364-386,497-505`.
- Config writability, runtime-server process identity, sidecar lock metadata, and Expert Squad missing-file handling all fail closed or preserve an explicit unknown state on the inspected production paths; they do not reproduce `CS-023`, `CS-027`, or `CS-036`.
- Provider catalog loading preserves auth/plugin failures in `LoadIssue[]`; only the two live-model refresh routes in `CS-021` return an empty healthy result.
- Session terminal publication binds the exact input Message occurrence and propagates terminal-latch or lifecycle persistence failures. Orchestrator Turn trace is explicitly best-effort debug observability, not a canonical Task/Session/Artifact settlement fact.
- The inspected cancellation and lease paths retain cancellation receipts, settlement fences, heartbeat/claim state, and restart resume. Complexity alone was not admitted without a concrete error-to-success or stale-owner commit chain.

## Refactoring Order

The backlog should be implemented by authority dependency, with each item retaining its own positive acceptance contract:

1. **Privilege and irreversible-data boundaries:** `CS-009`, `CS-036`, `CS-040`, `CS-046`, then trust/integrity hardening in `CS-025` and `CS-029`.
2. **Durable mutation and terminal settlement:** `CS-001`, `CS-002`, `CS-003`, `CS-024`, `CS-034`, `CS-035`, `CS-039`, `CS-042`, `CS-044`, `CS-047`, `CS-048`, `CS-050`, `CS-052`, `CS-054`, `CS-055`, `CS-057`, `CS-058`, `CS-059`, `CS-060`, `CS-062`, and `CS-068`. Establish shared occurrence/receipt and domain-settlement primitives before changing consumers; do not introduce dual readers or fallback migrations.
3. **Process and runtime ownership:** `CS-011`, `CS-013`, `CS-021`, `CS-022`, `CS-023`, `CS-032`, `CS-041`, `CS-043`, `CS-045`, `CS-051`, `CS-056`, and `CS-067`. Machine readiness and exact lifecycle/process occurrences should precede SDK, Browser MCP, provider refresh/auth, Channel, native sidecar, public restart/shutdown, and Worktree reuse rewrites.
4. **Single protocol and projection authorities:** `CS-004`, `CS-005`, `CS-010`, `CS-020`, `CS-033`, `CS-037`, `CS-038`, and `CS-049`. Move each policy to one typed runtime-neutral owner and delete the old reader/writer in the same change.
5. **Registry, composition, and package topology:** `CS-006`, `CS-012`, `CS-014`, `CS-016`, `CS-019`, `CS-027`, `CS-028`, `CS-031`, `CS-053`, `CS-061`, `CS-064`, `CS-065`, and `CS-066`.
6. **Dead systems and delivery truthfulness:** `CS-007`, `CS-008`, `CS-015`, `CS-017`, `CS-026`, `CS-030`, and `CS-063`. The prohibited pixel-checker finding is already fixed during this audit; keep it closed while rebuilding the non-UI required-check inventory.

Items within a wave are not one oversized refactor. Each future change should select one bounded issue, re-read its definitions/callers/contracts, add the listed positive verification, delete superseded paths, and undergo independent review before closure.

## Verification Log

- `git status --short`: captured before investigation; unrelated dirty changes listed in Recall.
- `bun run docs:check`: passed (`docs:check ok`, 338 operations, 25 groups).
- Register identity check after saturation: passed for 68 headings, 68 unique identities, continuous `CS-001..068`; severity counts are 1 P0, 36 P1, 25 P2, and 6 P3, and status counts are 61 new, 6 existing-reproduced, and 1 fixed-during-audit.
- `git diff --check` on task-owned tracked paths: passed.
- UI automation: not run. `packages/overlay/test/app-icon-generation.test.ts` was deleted after static inspection because repository rules prohibit retaining the pixel/alpha/color UI test.
- Negative-contract test: `packages/opencorvus/test/lsp-disabled-runtime.test.ts` was deleted because its core assertions require LSP absence/unavailability; the LSP implementation backlog remains `CS-026`.
- Independent final review: passed after one P2 documentation-consistency correction to Round 8. The reviewer independently confirmed Recall coverage, all 68 identities/counts, Rounds 16/17 saturation, all 67 open items appearing exactly once in Refactoring Order, and code evidence samples for `CS-001`, `CS-009`, `CS-018`, `CS-034`, `CS-040`, `CS-042`, `CS-043`, `CS-052`, `CS-058`, `CS-063`, `CS-067`, and `CS-068`; the post-correction re-review returned PASS with no unresolved finding.
- Final `git status --short`: captured; the worktree contains extensive unrelated concurrent Overlay changes, two test deletions, and untracked UI scripts/tests. This audit owns only its record and the exact repository-audit index lines.
- Commit and push safety audit: current `main` tracks `origin/main` but already contains two unrelated outgoing commits (`64098480`, `cbe173fa`). This audit may create a precise documentation commit, but automatic push is blocked until those existing commits are explicitly authorized as part of the push set.
