# Scheduled random-isolation end-to-end convergence

Status: implemented, verified, independently reviewed, and ready for Git delivery.

## Recall

| Item                       | Record                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| User request               | Use a random port, isolated database, and isolated project to run end-to-end tests for every Scheduled scenario; repair every discovered problem only after investigating depth and blast radius so one fix does not break another path.                                                                                                                                                                                               |
| Qualified output           | One repeatable checker starts the production server on an operating-system-assigned loopback port, uses one unique `OPENCORVUS_HOME` and database identity, creates unique Git projects, exercises the public Scheduled routes and real streaming Session path, and emits a machine-readable evidence ledger. Every in-scope scenario reaches its documented positive state with no unresolved finding.                                |
| Environment                | The user's running desktop/server/database/windows and the concurrent random Expert Squad evolution run remain untouched. The checker owns only its validated temporary root, random listener, local streaming Provider transport, database, projects, Sessions, Automations, screenshots, and cleanup.                                                                                                                                |
| Timeout                    | Polling uses durable-activity-aware inactivity windows. A naturally due run is not replaced by `Run now`, a database edit, or `AutomationService.runDueNow()`.                                                                                                                                                                                                                                                                         |
| Hard constraints           | Preserve one `AutomationService`, recurrence parser, global poller, lease/fire/run ledger, and `SessionWake` path. No fallback scheduler, compatibility route, hidden scope inference, synthetic product Message, Host workflow gate, non-streaming model call, or second recovery source. No User Interface automation test, fixture, baseline, or scripted visual pass/fail artifact may be added, modified, or run.                 |
| Sources read               | `AGENTS.md`; `specs/current/architecture/18-scheduled-automations.md`; `2026-08-02-scheduled-automation-scope-rearchitecture.md`; `2026-08-11-scheduler-systemic-fault-audit-and-repair.md`; `2026-08-11-scheduler-liveness-and-control-convergence.md`; the July Scheduled parity, usability, settings, and real-project records; current Automation schema/service/recurrence/routes/Tool/Overlay adapter and positive non-UI tests. |
| Whole-repository search    | Searched `scheduled`, `automation`, `recurrence`, `runNow`, target scope, global Project discovery, Session creation/hydration, server random-port startup, `OPENCORVUS_HOME`, real-checker scripts, generated API/SDK surfaces, and current/historical acceptance records.                                                                                                                                                            |
| Independent agent feedback | None before implementation. Repository policy requires a new uninvolved read-only agent after the implementation and first green verification; every valid finding will be repaired and re-reviewed.                                                                                                                                                                                                                                   |
| Existing unrelated work    | `packages/opencorvus/script/expert-squad-evolution-e2e-support.ts`, `packages/opencorvus/test/expert-squad/random-evolution-e2e-support.test.ts`, and untracked `packages/opencorvus/script/expert-squad-evolution-e2e.ts` are pre-existing/concurrent and excluded from this task's edit, staging, commit, and push boundary.                                                                                                         |

## Problem depth and impact model

### Observable state

- Current architecture promises Session, Project, and Global targets; create,
  list, update, pause, resume, run-now, history, and deletion; natural due-time
  execution; explicit model ownership; stable occurrence identity; retry and
  successor recovery.
- Current focused tests prove lease/fencing and several failure interleavings,
  but the repository has no current repeatable Scheduled checker that composes
  a random public listener, a unique on-disk database, unique Git projects,
  real HTTP routes, natural wall-clock firing, streaming Provider traffic, and
  persisted Session/run evidence.
- Historical July/August visual and real-project records are useful design
  evidence but are not proof for the current source tree after the 2026-08-11
  scheduler ownership repairs.
- The first baseline test attempt did not reach product code because the local
  `zod@4.4.3` Bun package directory is empty while its workspace junctions still
  target it. A concurrent Expert Squad evolution process is active from this
  checkout, so dependency repair must not interrupt or mutate that process.

### Direct trigger and known contract gap

- The missing checker allows public-route, scope-composition, configuration,
  background-polling, and cleanup regressions to escape the focused suites.
- `assertPublicInput()` validates an explicitly pinned model inside every
  Session or Project target, but currently skips the corresponding Provider
  catalog and reasoning-variant validation for Global scope. That contradicts
  the current architecture requirement that creation validate the exact
  configuration owner before persistence. The checker must first reproduce
  the public behavior before this is classified as a confirmed defect.

### Data and control-flow root boundary

The repair boundary is the existing chain only:

1. public target-union request validation;
2. global Automation definition and Project-target persistence;
3. persisted `next_run` claim and deterministic fire/run identities;
4. target-specific Project/global Session allocation;
5. streaming `SessionWake` Message/Part commit under the Automation lease;
6. assistant settlement, run ledger finalization, and once-only recurrence
   advancement;
7. public history, update, pause/resume, and deletion receipts.

Any failure will be traced through that chain and its adjacent callers before
editing. Provider output quality, Event jobs, Task named waits, Mission
scheduling policy, and the concurrent Expert Squad evolution controller are
excluded unless evidence proves they share the failing authority.

### Why earlier paths are insufficient

- CRUD and transport unit tests do not prove the global scheduler tick,
  initialized Project re-entry, or a streamed assistant result.
- Lease/failure-injection tests prove exact interleavings but not the public
  HTTP composition or visual product surface.
- A fixed port, shared database, existing Project, manual run, or direct service
  helper can pass while hiding discovery, ownership, recurrence, and
  cross-run contamination defects.
- A screenshot, typecheck, build, or successful provider request alone cannot
  prove durable fire/run/session convergence.

### Confirmed random-isolation findings before product edits

The first production-entry checker run used backend port `60393`, Provider
port `60387`, database identity
`8183e64f-75b4-49e7-b2b8-864059694399`, and two fresh Git Projects. It
confirmed two product failures rather than checker-only failures:

1. `POST /global/automations` accepted and persisted a Global definition whose
   explicit Provider/model did not exist. The direct trigger is the
   `input.target.scope !== "global"` condition in `assertPublicInput()`. The
   root boundary is configuration ownership: Session and Project targets enter
   their exact Project config, while Global must use `Config.getGlobal()` plus
   `Provider.getModelGlobal()`. Borrowing the ambient HTTP Project would make
   the request directory a hidden Global configuration owner. The blast radius
   includes both create and update because both call the same validator;
   definitions without an explicit model are unaffected.
2. Project run rows were committed as `succeeded` before either streaming
   Provider request began. `SessionWake.wake()` truthfully persists a durable
   user Message and starts a detached physical loop, but deliberately returns
   only the Session ID. `AutomationService.wakeSession()` treated that
   persistence receipt as the target outcome, so later Provider failure or
   process shutdown occurred after the run and recurrence had already been
   finalized. The existing `SessionWake.wakeWithReceipt()` already exposes the
   single physical loop's `completion`; a second status store or polling path
   is therefore unnecessary. Recovery has the same defect because
   `resumePersistedWake()` discards the same completion Promise.

The premature-success blast radius is every recurring Session, Project,
Global, and Project-worktree target, plus the retry partition and graceful
shutdown join. It does not change private delayed-wake semantics or callers
whose contract is intentionally durable Message admission. `EventService`
also discards `resumePersistedWake()` completion and settles a fire at Message
admission; that adjacent internal Event-job lifecycle is not exposed by the
Scheduled page and has its own occurrence contract and focused suite. It is
recorded as an adjacent authority for separate contract review, not silently
changed as part of the public Automation repair. The shared primitive will
return its existing completion Promise so Event callers remain source- and
behavior-compatible until that lifecycle is explicitly decided.

The first attempted repair uncovered a second ownership mismatch before it was
accepted: the existing `WakeReceipt.completion` was backed by the whole
physical Session loop, including its normal standby wait for a later user
Message. Waiting for it made the first exact-Session manual run remain
`running` after its assistant reply completed. The correct single-source split
is already present in `SessionPrompt.loop()`: its returned `firstResult`
settles for the exact `reply_to_message_id`, while
`SessionPrompt.waitForFinish()` settles the longer-lived physical loop.
`SessionWake` must expose the first as the wake receipt and continue registering
the second with `RuntimeExecutionSettlement`; Automation must never infer turn
completion from Session idle/standby or collapse physical runtime ownership
into its business run row.

The real busy-Session scenario then exposed the reason a second deterministic
wake could remain asleep after the 30-second delay: Session standby compared
new Message IDs lexicographically with the prior assistant ID. Scheduler-owned
deterministic `msg_automation_<hash>` identities are stable occurrence keys,
not chronological IDs, so a later durable wake can sort below the prior
assistant and be ignored both by the live Bus subscriber and its durable
post-subscription reread. The blast radius is every reusable standby Session
receiving an explicit non-chronological Message identity, including recurring
Automation, Event, and recovery ingress. The canonical ordering fact is the
persisted Message timeline order key (`time_created` plus ID); standby must
compare that key rather than reinterpret identity as time.

## Scenario matrix

### Isolation and boot

1. Start the production recovery/listener entry on `127.0.0.1` with `port: 0`
   and record the assigned non-zero port.
2. Use one freshly created and path-validated temporary root as
   `OPENCORVUS_HOME`; prove the canonical database path/identity stays inside it.
3. Create at least two freshly initialized Git projects with distinct paths,
   commits, Project IDs, and no pre-existing `.opencorvus` state.
4. Start a local OpenAI-compatible streaming Provider on a second assigned
   loopback port; record request/stream cardinality without logging prompts,
   credentials, or response bodies.

### Public lifecycle and target scopes

1. Global list starts empty and remains independent of ambient directory.
2. Session create targets one exact visible Session; a manual run and a natural
   due run both reuse that Session and append completed visible turns.
3. Global create works without a Project target; each occurrence owns a new
   visible global Chat.
4. Project create with two exact Project IDs produces two run rows under one
   fire ID and one visible Chat per target Project.
5. Project `worktree` execution produces a visible run whose Session retains
   canonical Project ownership while executing in its owned worktree.
6. Update replaces name/prompt/recurrence/model/target as one explicit current
   definition; switching scope leaves no stale target relation.
7. Pause and resume return factual states; resume recomputes a future due time.
8. Run now returns only the rows bound to its allocated fire ID and does not
   advance the recurring cursor.
9. History reports running/retry/succeeded facts through the public schema and
   links every completed row to its exact Session.
10. Delete returns `{id,name}`, removes definition/target/run rows, and
    preserves already-created Sessions and their conversations.

### Configuration, liveness, and recovery

1. Explicit model and reasoning variant validation uses the exact Session,
   every selected Project, and Global configuration owner before persistence.
2. A busy Session occurrence remains the same due occurrence and is delayed;
   it is never converted into a new Chat.
3. A target failure persists retry authority on the same fire/run identities;
   successful peer Project rows are not replayed.
4. A successor runtime resumes an interrupted deterministic Message occurrence,
   preserves fire/run/session/message/Part identity, and advances recurrence
   exactly once.
5. Lease loss aborts the displaced physical owner before a successor effect can
   overlap. Runtime shutdown joins Automation fire and Session wake owners.

The public checker owns the isolation, lifecycle, scope, natural-due, streaming,
and deletion scenarios. Existing focused positive suites remain the executable
acceptance for injected busy/retry/lease/restart interleavings; they are run as
part of the same final verification ledger rather than reimplemented through a
second scheduler.

### Product surface

- Use a real isolated Overlay page connected to the checker backend.
- Manually inspect the global list, Global-default create form, exact Session
  scope, multi-Project selection, row pause/resume/run/delete controls, grouped
  history, and navigation to the completed Session.
- Capture current task-scoped screenshots and open them at original resolution.
  Browser control is interactive acceptance only and is not persisted as an
  automation test or visual pass/fail script.

## Implementation and verification order

1. Repair only the verified broken workspace dependency target after the
   concurrent process no longer depends on it; rerun the unchanged baseline.
2. Add one repository checker and package script that owns random-port/home/
   database/project/provider setup, evidence, bounded cleanup, and public API
   scenario assertions.
3. Run the checker unchanged to expose current product failures. For each
   failure, append its observable symptom, direct trigger, root control/data
   flow, blast radius, and previous-path insufficiency here before modifying
   product code.
4. Repair the shared root boundary and add focused positive non-UI contracts.
5. Rerun the exact failed scenario, complete checker, scheduler/Automation
   focused suites, typecheck, generated route/API checks, docs checks, build,
   diff/secret checks, and real-page manual visual acceptance.
6. Ask one uninvolved agent to inspect the stable full diff and evidence without
   modifying files or delegating. Fix all valid findings and repeat until none
   remain.
7. Audit `git status --short` and `upstream..HEAD`; stage and commit only this
   task's owned paths, then push the current branch through normal hooks if the
   complete pending commit set remains authorized and reviewed.

## Evidence ledger

- Baseline dependency load: blocked before product execution by empty
  `node_modules/.bun/zod@4.4.3/node_modules/zod`; product result not accepted.
- Locked dependency recovery: the first default-registry install attempt failed
  with `ConnectionClosed`; a frozen install against the reachable mirror with
  network concurrency four restored the declared dependency graph without
  changing `bun.lock` or package manifests.
- Scheduler/Automation identity baseline: `17 pass / 0 fail`, including manual
  fire binding, public run outcomes, durable failure ownership, deterministic
  due-occurrence recovery, lease-loss abort, renewal cleanup, rollback restore,
  and fail-closed non-cooperative scheduler disposal.
- Runtime-startup baseline: the first four contracts passed, then the fixture's
  50 ms whole-pipeline inactivity injection observed a healthy but still
  cancelling `worktree.gc` as `SchedulerDisposalInactivityError` before it could
  reach the intentionally held Message-bridge effect. That failure retained the
  global scheduler settlement gate and caused two deterministic cascade
  failures. The product default is 60 seconds; the fixture now gives real
  scheduler cancellation 15 seconds while retaining a bounded injected effect
  failure and its exact recovery assertions.
- Product repair: Global explicit models now resolve against the Global
  configuration owner before create/update persistence; reasoning variants use
  the resolved Global model rather than an ambient Project.
- Product repair: `SessionWake` now separates exact assistant-reply completion
  from the longer physical standby loop. Automation rows await the former,
  while `RuntimeExecutionSettlement` continues to own and join the latter.
  Persisted Automation recovery opts into retrying the exact committed Message
  instead of treating its prior failed assistant as a completed reply.
- Product repair: Session standby compares the canonical persisted timeline
  order key instead of lexicographically interpreting deterministic Message
  IDs as time. A focused positive contract proves that a later
  `msg_automation_*` occurrence wakes even when its hash sorts below the prior
  assistant ID.
- Repeatable checker: `bun run check:scheduled-automations-e2e` passed after
  formatting with no findings. The final non-visual ledger is
  `C:\Users\hengu\AppData\Local\Temp\opencorvus-scheduled-e2e-20260811202236-7e05c40f\result.json`.
  The final connected visual ledger is
  `C:\Users\hengu\AppData\Local\Temp\opencorvus-scheduled-e2e-20260811201008-d3efa70c\result.json`.
- Isolation review: the first independent review reproduced a load from
  `C:\ProgramData\opencorvus\opencorvus.jsonc`. Because managed configuration
  has higher priority than the checker-owned Provider/model configuration,
  isolating only `OPENCORVUS_HOME` and the database did not make the run
  reproducible. Before importing product modules, the checker now clears all
  inherited OpenCorvus configuration entry points, creates an empty managed
  configuration directory under the random run root, and assigns
  `OPENCORVUS_TEST_MANAGED_CONFIG_DIR` to it. The repaired run used backend
  port `58231`, Provider port `58228`, database identity
  `6e356f14-ff0a-4e29-9d4c-80c33218a827`, Project IDs
  `d106fd4618c71ded1535fe10dbf811c1813be6bf` and
  `bbbecdeed66d080d0d18027d404d3de1c750fa60`, 189 public HTTP requests,
  eight streaming Provider requests, and zero findings. Its log contains 16
  loads from the isolated managed root and zero loads from `ProgramData`.
- Visual-hold lifecycle: the first long manual inspection crossed the next
  recurrence and correctly made deletion return `409` for an active row. That
  was a checker ownership defect, not a product failure. Visual mode now pauses
  every owned Automation before announcing readiness; two subsequent
  visual-hold runs released, deleted all definitions, wrote `outcome: passed`
  with `findings: []`, and exited normally.
- Final connected visual environment: backend port `64080`, an independent
  random Provider port, a unique database under
  `opencorvus-scheduled-e2e-20260811201008-d3efa70c`, and two fresh Git
  Projects. The Network panel confirmed the exact listener as `Online`; the
  Scheduled list showed Session, busy Session, Global, two-Project retry, and
  scope-replacement definitions. The detail surface showed paused/resume,
  run-now/edit/delete controls, zero consecutive failures, a succeeded history
  row, exact model, prompt, and Session navigation. The create surface showed
  Global as default and Conversation/Projects/Global choices. Screenshots were
  viewed manually at the desktop viewport; no UI automation test or baseline
  was created or run.
- Final visual-hold ledger before UI inspection used backend port `60153`,
  Provider port `61251`, database identity
  `b2a636a5-91af-4b11-a981-7c44ca2c14b8`, Project IDs
  `6d2296d6097e2a87405842a9cddaade03b80840c` and
  `5878bcee67a8efb8eb870ecfc7138ce94a43bf1f`, 198 public HTTP requests,
  eight streaming Provider requests, and zero findings.
- Focused backend verification: scheduler Automation `18 pass / 49 expects`,
  runtime settlement `17 / 37`, startup recovery `7 / 17`, scheduled Task wait
  `2 / 4`, durable Event fire `29 / 76`, and Session occurrence `2 / 17`.
  Overlay recurrence/transport contracts passed `4 / 17`. No UI automation
  test was run.
- Static verification: full workspace typecheck passed across eight selected
  package tasks; Overlay typecheck and i18n passed; `docs:check` reported 331
  operations in 25 groups; `api:routes-check` reported six clean rules across
  34 files; `version:check` confirmed `0.0.40-beta` alignment.
- Build verification: Overlay Vite production build completed 7,104 modules.
  The shared checkout backend build was correctly rejected because the
  concurrent, ignored `expert-squads/builtin/equity-research/report.md` is not
  a legal package-root entry. No concurrent file or process was changed. A
  clean temporary source snapshot at
  `C:\Users\hengu\AppData\Local\Temp\opencorvus-scheduled-build-clean-20260812-040341-ef59526c`
  combined `HEAD` with only this task's production changes, installed the
  frozen dependency graph, regenerated the SDK, and completed the Windows x64
  backend executable plus runtime payload build.
- The first independent review found the managed-configuration isolation gap
  above. After repair and reverification, the same uninvolved agent completed a
  second read-only review of the full task diff, import ordering, configuration
  isolation, latest ledger, tests, and documentation with no unresolved
  findings. Git delivery is represented by the commit containing this record.
