# Permission continuation recovery fault isolation

## Recall

- User request: explain why the shipped binary can neither publish a Mission nor render an existing Mission/Task — every attempt returns an internal server error — and then analyse the systemic defect and repair it at the root rather than patching the reported branch.
- Incident locator: managed sidecar `opencorvus.exe serve --hostname 127.0.0.1 --port 7878 --managed-scope C:/Users/hengu/AppData/Local/opencorvus/data`, version `0.0.44-beta.1`, built from `cb3c84d0`. Production database `C:/Users/hengu/AppData/Local/opencorvus/data/opencorvus.db`. Runtime logs `2026-08-15T074924-4844-1.log` (origin, 07:51:20 UTC) and `2026-08-15T081647-7112-1.log` (outage, 179 identical failures).
- Reproduced surface:
  - `GET /mission` (global, no project admission) → `200`;
  - `GET /mission/{id}/status?directory=…` → `500`;
  - `POST /mission/draft?directory=…` → `500`;
  - `GET /session?directory=<a brand-new empty directory>` → `500`.
- Acceptance:
  - one continuation whose persisted ToolPart is already terminal can never fail project admission, any other continuation, or any project-scoped route;
  - such a continuation retires itself on the ledger so no later bootstrap rescans it;
  - continuation recovery scans only the admitted project's own ledger requests;
  - a Tool outcome that disagrees with its durable Permission receipt no longer destroys an external effect that already succeeded;
  - regression tests fail on the unrepaired source and pass on the repaired source.
- Hard constraints: do not weaken at-most-once execution admission; do not reintroduce a second authority for Tool output; do not create a runtime module cycle between `PermissionAuthority` and `SessionLoop`; preserve unrelated `.gitattributes` and release-record worktree changes.

## Evidence and root cause

The outage is one durable inconsistency amplified into a total project-side service failure by four independent design faults.

**Origin.** At 07:51:20.554 UTC the permission authority recorded `execution_succeeded` for attempt `per_h1HX66yW5UFgnTgp25Bj` (request `per_hZ5YkkkWAIk5MQ4FQnGa`, Tool `dispatch_agent`, Task `tsk_g00VSLjqr100OEbMQdab`) and stored the durable receipt `{"kind":"accepted","session_id":"ses_-zUXeG2AXzzahoCJPiVd","dispatch_lineage_id":"art_g0VSLjxtt00DJ0l7wKbJ"}`. Sixty-eight milliseconds later the ToolPart write raised `Tool outcome Part prt_g0VSLjxb600dG3pWLGXO conflicts with Permission result per_h1HX66yW5UFgnTgp25Bj`. Because the Tool effect had already executed, `SessionProcessor` correctly refused to retry inside the same assistant Message and raised `ProcessorUnsafeRetryError`; the ToolPart was persisted as a terminal failure and the Task failed.

That check is new. `git log -S` attributes `Tool outcome Part … conflicts with Permission result …` to `627146cc refactor(control): converge execution state on immutable facts` (2026-08-15 12:27), later revised by `cb3c84d0` (16:05); the running sidecar was built at 16:08 and therefore contains it.

**Fault A — a strict equality assertion across two independently derived pipelines.** The check compared `normalizeToolResult(receipt).output` against `part.state.output`. The receipt holds the raw Tool return recorded by the permission authority; `part.state.output` arrives through the Session normalization pipeline (`normalizeToolResult` → inline-attachment materialization → attachment and display stamping → the provider Tool boundary → a second `normalizeToolResult`). Equality can only hold if every transformation is exactly idempotent across both paths, which nothing guarantees. The assertion is also redundant: the outcome fact written immediately below stores no `output` at all, and `projectToolPartInTransaction` projects the output back from the receipt on every read. The assertion therefore gated a value that the same write discards — it could only convert a benign disagreement into a destroyed effect.

**Fault B — an inconsistent durable triple with no owner.** The failed write left the permission ledger saying *approved and execution_succeeded* while the ToolPart said *terminal error*. Nothing reconciles that triple.

**Fault C — a legitimate terminal state treated as a broken invariant.** `SessionLoop.resumePermissionContinuation` threw `Permission continuation … ToolPart is already terminal with an error`. A terminal Tool failure is a persisted conclusion, not a contract violation; the correct reading is that no continuation can advance it.

**Fault D — unscoped, un-isolated recovery on the project-admission path.** `Instance` bootstrap calls `PermissionAuthority.resumeApprovedContinuations()` on every initialized admission. That scan selected *every* `requested` ledger row in the managed scope with no project filter (unlike `history()`, which does filter), replayed each one, and let the first throw escape the loop. Bootstrap then reset `permissionRecoveryStarted` to `false` and rethrew, so every later admission repeated the identical failure. A single dead row consequently failed every project-scoped route in every project — including brand-new directories — permanently and deterministically.

An offline replay of the recovery selection over all 124 ledger rows confirmed the blast radius: 30 requests were eligible for replay, 29 held `completed` ToolParts and were harmless, and exactly one — `per_hZ5YkkkWAIk5MQ4FQnGa` — held the terminal failure that bricked the server.

## Design

1. **The receipt is the sole authority for permission-bearing Tool output.** `Session` records the divergence at `warn` level with the part, attempt, Tool and both lengths, and proceeds. Reads continue to project output from the receipt, so behaviour is unchanged where the two agree and no longer destructive where they do not. The diagnostic projection is computed defensively: a receipt this write cannot project must not throw here, because reads surface that failure at their own site.
2. **`resumePermissionContinuation` returns `"resumed" | "unresumable"`.** A terminal-error ToolPart yields `"unresumable"` instead of throwing. Genuine impossibilities — a missing ToolPart, a changed Tool identity, a non-assistant Message — still throw.
3. **Recovery retires only what it knows can never run.** `"unresumable"` appends the terminal `stale` ledger fact with its reason. Retirement is what makes recovery convergent: without it the same dead request is rescanned by every later bootstrap. A *thrown* fault is recorded and the request is left open, because recovery cannot distinguish a permanent fault from a transient one and must never discard a continuation a later attempt could still complete. Several remaining determinate-permanent conditions in `resumePermissionContinuation` — a missing ToolPart, a changed Tool identity, a Tool that is no longer projected — still throw; reclassifying them as `"unresumable"` so they retire too is follow-up work, not required to close this outage.
4. **Recovery is fault-isolated and project-scoped.** Each continuation runs inside its own boundary, so one failure cannot end the loop; and the ledger scan filters on the admitted project, because a ledger request only means anything inside the project that produced it and a foreign project's evidence must never decide whether this project can open.
5. **Bootstrap recovery is best-effort.** Continuation recovery converges durable evidence; it is not a precondition for serving the project. The attempt is marked before it runs, so a deterministic fault cannot re-run on every later admission, and a fault is logged rather than propagated.
6. `PermissionAuthority` imports the `SessionLoop` continuation outcome as a type only; the value import stays dynamic, so no runtime module cycle is created.
7. No production data rewrite is required. Once the repaired runtime loads, the dead request is retired by rule 3 on the first admission and the ledger self-heals.

## Generalization, not repaired here

Fault D is an instance of a class. `ProjectOpenLifecycle.stage` logs and rethrows, so every `InstanceBootstrap` stage can fail project admission. The distinguishing principle is that a stage which *establishes the runtime this process needs* must gate admission, while a stage which *converges stale evidence left by a previous process* must not. By that principle these stages are recovery-class and currently gate admission anyway:

- `build-observation.reconcile-cleanup`
- `engine-task.reconcile-pending-cancellations`
- `engine-interaction.reconcile-recovered-waiters`
- `permission.reconcile-interrupted-attempts`
- `task-control.reconcile`

`task-artifact.recover-unreferenced` already follows the principle: it returns a status and logs corruption instead of throwing. Converting the five above is deliberately left out of this repair. There is no evidence any of them currently fails, and making a reconciler best-effort without that evidence would hide a real defect rather than isolate a known one. The audit and the conversion should be commissioned as separate work.

## Positive verification

`packages/opencorvus/test/permission-continuation-recovery.test.ts` builds a real approved, succeeded, permission-bearing invocation and asserts:

- a terminal-failure ToolPart retires its continuation, reports nothing resumed, writes exactly one `stale` fact, and is not rescanned by a second recovery pass;
- a continuation that throws neither ends the scan — the next continuation still resumes — nor retires the faulted request;
- a project whose continuation recovery rejects still serves, with recovery attempted exactly once;
- recovery inside a bystander project resumes and retires nothing owned by another project;
- a completed ToolPart whose output diverges from its receipt survives the write, and the read projects the receipt.

Each test fails on the unrepaired source and passes on the repaired source.

## Verification evidence

- `bun test test/permission-continuation-recovery.test.ts`: 5 passed, 0 failed on the repaired source; the four cases that predate the isolation refinement all failed on the stashed unrepaired source, with the divergence case failing on the exact production error `Tool outcome Part … conflicts with Permission result …`.
- `bunx tsc --noEmit -p packages/opencorvus/tsconfig.json`: passed.
- Affected-surface regression sweep over 25 shared suites (`dispatch-occurrence-recovery-authority`, `engine-*-recovery`, `mission-*`, `orchestrator-mission-*`, `panel-mission-terminal-authority`, `permission-*`, `persistent-instance-publication`, `project-instance-capability-refresh`, `runtime-startup-recovery`, `session-loop-*`, `task-control-reconciliation`, `tool-part-fact-storage`, `tool-result-*`, `windows-orphan-artifact-recovery`): unrepaired 108 passed / 7 failed in 179s; repaired, with this record's suite added, 112 passed / 7 failed in 185s. The failure set is identical, so the repair introduces no regression in the affected surface.
- Real end-to-end A/B on one `VACUUM INTO` snapshot of the production database, isolated under a scratch `OPENCORVUS_HOME`; the user's live database and running desktop application were not mutated or operated. Same snapshot, same request directories, only the source differs:

  | Request | Unrepaired `cb3c84d0` | Repaired |
  | --- | --- | --- |
  | `GET /mission` | 200 | 200 |
  | `GET /mission/68c0ef3e4783ea11/status?directory=…` | 500 | 200 |
  | `GET /session?directory=D:/myhexin-local/opencorvus` | 500 | 200 |
  | `POST /mission/draft?directory=…` | 500 | 200 |

  The repaired run additionally created a real Mission draft (`7b0ab0cb59abdf3d`), retired `per_hZ5YkkkWAIk5MQ4FQnGa` with exactly one `stale` fact carrying the reason `The persisted ToolPart is already terminal; no continuation can advance it`, and logged zero `500` responses.
- An earlier snapshot that deliberately omitted `data/expert-squad-package-revisions/` produced one *isolated* continuation fault (`expert squad immutable package snapshot is missing`) for Tool `list`. It was logged, the request was left open rather than retired, the scan continued, and every route still returned 200 — the isolation rule demonstrated on real data against a fault the unrepaired build would have turned into the same total outage.
- Pre-existing failures on `cb3c84d0`, unchanged by this repair and reproduced with the repair stashed: `test/agent-runner-fresh-session-authority.test.ts` (`No context found for instance`) and two cases in `test/session-loop-tool-authority-integration.test.ts` (`ReferenceError: Cannot access 'Event' before initialization` at `src/engine/terminal-lifecycle-reference.ts:28`, raised only in the spawned test host and absent from every production log). The package test runner is fail-fast, so these mask the remainder of the suite on `HEAD`.
