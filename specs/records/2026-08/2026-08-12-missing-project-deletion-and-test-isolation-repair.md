# Missing Project Deletion and Test Isolation Repair

## Recall

- User requirement: explain why the database failed, remove the repeated `project` entries that remain after the verified database transfer, and repair the deletion contract so missing paths or already-missing artifacts do not prevent cleanup.
- Acceptance:
  - `DELETE /project/current` resolves an already-persisted Project from the requested directory without opening, initializing, or validating that directory on disk.
  - A persisted Project whose worktree and `.opencorvus` tree are already absent returns the normal successful deletion receipt and removes its database row.
  - Existing Project deletion retains the current task/session cancellation and database cleanup contract.
  - The seven confirmed temporary test Projects are removed from the canonical database after a recoverable backup and zero-reference recheck; the real `D:\myhexin-local\demos\long-absa-task` Project is untouched.
  - Any process that declares `OPENCORVUS_TEST_HOME` fails closed unless its resolved runtime root is a strict child of the preload/checker-owned `OPENCORVUS_TEST_PROCESS_ROOT`; standalone checkers use that same contract.
  - Focused backend tests, package typecheck, database integrity/foreign-key checks, documentation check, and independent read-only review have no unresolved findings.
- Hard constraints: do not restart, stop, or mutate the user's running port-7878 process; do not run or modify User Interface automation; preserve unrelated dirty-worktree and merge-conflict changes; use one deletion implementation and no compatibility fallback.
- Read sources:
  - `packages/opencorvus/src/server/server.ts`
  - `packages/opencorvus/src/server/project-route-context.ts`
  - `packages/opencorvus/src/server/routes/project.ts`
  - `packages/opencorvus/src/project/instance.ts`
  - `packages/opencorvus/src/project/project.ts`
  - `packages/opencorvus/src/project/delete.ts`
  - `packages/opencorvus/src/global/index.ts`
  - `packages/opencorvus/test/preload.ts`
  - `packages/opencorvus/test/runtime-server-ownership.test.ts`
  - `packages/opencorvus/test/runtime-startup-recovery.test.ts`
  - `packages/opencorvus/test/project-directory-and-worktree-gc.test.ts`
  - `specs/records/2026-08/2026-08-12-local-database-rebuild-and-startup-recovery.md`
- Repository search:
  - `DELETE /project/current` is the only Project deletion route; Overlay `deleteProjectState` calls it with `?directory=`.
  - `projectRouteUsesIdentityContext` already classifies deletion as identity-only, but `Instance.provideProjectIdentity` still calls `getOrCreateCacheEntry`, whose context promise calls `Project.fromDirectory` and therefore `assertDirectoryIntegrity` before the handler.
  - `deleteCurrentProject` already treats an absent `.opencorvus` directory as an idempotent deletion state. The earlier repair therefore fixed only the late filesystem stage and left the route-entry control flow broken.
  - The seven repeated display names come from null `project.name` values and the basename `project` of paths created by `runtime-server-ownership.test.ts` and `runtime-startup-recovery.test.ts`.
  - The transport's `routeRequiresProjectDirectory` boolean currently serves two unrelated decisions: whether clients attach a directory and whether the server opens a Project runtime. This conflation is the systemic entry-point defect.
  - Persisted Task deletion is already directory-independent, while persisted Session, Goal, Message, and Part deletion still enters full Project bootstrap even though their service implementations resolve globally unique database identities and enforce their owning relations in SQL.
  - Task row deletion commits before Artifact cleanup. The Artifact root already treats `ENOENT` as success, but build-observation Git ref cleanup still invokes Git in a missing worktree and converts successful durable deletion into `TaskArtifactDeletionCommittedError`.
  - Anonymous Project root cleanup uses `force: false` without the existing explicit absence check used for `.opencorvus`, so a repeated/interrupted delete can fail at its final physical step.
  - Worktree garbage collection intentionally preserves entries when the Git registry is unavailable. That is a safety boundary, not the same bug: without a live registry it cannot prove that an existing physical target is owned and safe to remove.
  - Runtime recovery and settlement require exact supervisor/check-workspace evidence. Missing or malformed recovery evidence must remain fail-closed because treating it as already complete could permit duplicate process ownership.
- Independent agent feedback before implementation: none; the mandatory independent review runs after the first complete verification.

## Problem depth and impact analysis

### Observable facts

- The current database has the exact current schema fingerprint `84af4e18ec989a211a7ee4dc574b535fce8cfbb7237eb73feb549a82ace1b058`, `PRAGMA integrity_check = ok`, and zero foreign-key violations. The incident is not evidence of a missing schema patch.
- The strict transfer copied all portable rows exactly, so it correctly retained pre-existing junk rows; transfer success is independent of semantic cleanup.
- The canonical database contains one real Project and seven rows under `C:\Users\hengu\AppData\Local\Temp\opencorvus-cli-*\project`. Every temporary directory is absent and every one of the seven rows has zero references in all Project-scoped tables.
- Their creation times are 2026-08-12 01:47:20 through 01:48:13 Asia/Shanghai and their prefixes map exactly to runtime ownership/recovery test fixtures.
- A real deletion attempt at 2026-08-12 02:29:14 Asia/Shanghai failed before the handler with `ProjectDirectoryIntegrityError` and HTTP 400 from `project.from-directory`.

### Direct trigger and control-flow root cause

1. Overlay sends `DELETE /project/current?directory=<persisted worktree>`.
2. Server middleware sees a Project-scoped identity route and enters `Instance.provideProjectIdentity`.
3. `provideProjectIdentity` uses the normal cache-entry factory.
4. The factory calls `Project.fromDirectory`, which requires the path to exist and be a directory.
5. The request fails before `deleteCurrentProject`, so its already-idempotent missing-`.opencorvus` handling is unreachable.

Deletion is a persisted-state mutation. Opening a live Project is not a precondition for identifying the row: the persisted worktree/sandbox registry is the authority. Disk validation belongs to operations that need to read or execute the Project, not to removal of its state.

### Why the old path did not cure the problem

The original implementation added `DELETE /project/current` to an “identity-only” route set and made `removeProjectConfigRoot` tolerate absence. However, “identity-only” continued to construct identity through the same disk-discovering cache entry as full runtime bootstrap. The name changed, but the entry control flow did not.

### Test-data pollution root cause

The fixture tests change `OPENCORVUS_TEST_HOME`, but on Windows the default runtime root still prefers the real `LOCALAPPDATA`; only `OPENCORVUS_HOME` changes the database root. Normal Bun test preloads set `OPENCORVUS_HOME`, but a non-preloaded/direct invocation therefore wrote the fixture Projects to the production database. The tests did not fail closed when their required preload was absent, and child fixture creation did not explicitly preserve the isolated runtime root as a required argument.

### Impact surface

- Definitions: persisted Project lookup, identity-context entry, Project deletion.
- Callers: server Project route and Overlay service contract remain stable; no client protocol shape change.
- Data: seven zero-reference rows are safe cleanup candidates; no other Project row is in scope.
- Runtime: active Project cache entries must still be leased and disposed; a stale persisted Project can use a non-bootstrap identity context whose only authority is the database row.
- Tests: focused non-UI HTTP route test plus test-runtime guard/child environment coverage. Existing UI tests are neither searched beyond known call sites nor run.
- Documentation: this record and both indexes.
- Risks: directory aliases/sandboxes, concurrent active instance deletion, and accidental production database access from tests. Persisted lookup must reject ambiguity and match normalized paths; deletion retains the existing instance lease/disposal path.

### Unified absence and authority model

| Operation class | Identity authority | Missing owned path/artifact | Existing but unverifiable path/artifact |
| --- | --- | --- | --- |
| Persisted entity deletion (`Project`, `Task`, `Session`, `Goal`, `Message`, `Part`) | Database ID or exact registered Project directory | Successful/idempotent deletion state | Reject ownership mismatch or ambiguity |
| Post-commit cleanup of Task-owned Artifact roots and Git refs | Task/Artifact rows captured before commit plus canonical Project root | Successful cleanup state; bytes/ref cannot remain in a missing repository | Report committed deletion with cleanup diagnostics |
| Physical worktree removal/garbage collection | Persisted sandbox registration plus live Git worktree registry and managed-path containment | May clear only exact proven ownership; no heuristic discovery | Preserve and report uncertainty |
| Runtime recovery/settlement | Exact owner PID/occurrence and recovery Artifact contract | Block recovery | Block recovery |

The implementation must not infer test data from names such as `project`, `Temp`, or fixture prefixes. Migration remains an exact row transfer. Test pollution is prevented at its writer boundary, while the seven known rows are repaired only by exact IDs after a fresh zero-reference proof.

### Similar-path audit disposition

- Fix now: Project deletion route entry, directory-independent Session/Goal/Message/Part deletion, missing-repository Task build-observation ref cleanup, anonymous Project root idempotency, and runtime-test isolation.
- Preserve current fail-closed behavior: Project open/read/update operations, provider/config mutations that need the live Project config root, physical worktree removal without a live ownership registry, supervisor recovery, and check-workspace settlement.
- A backup-first schema migration is required for deletion identity. `2026-08-12-project-generation-authority` adds an immutable, unique UUID generation to every Project and backfills every legacy row with a distinct value before creating the unique index. The cleanup ledger binds both the database instance UUID and this Project generation, so a deterministic Project ID recreated later cannot inherit an earlier deletion operation.

## Implementation plan

1. Replace the server's boolean identity decision with one context classification: `persisted`, `identity`, or `runtime`. `DELETE /project/current` still requires an exact directory selection from the client, but `persisted` routes do not open or discover that directory.
2. Resolve Project deletion from `Project.findByRegisteredDirectory`, refactor the single deletion implementation to accept that persisted Project, use any already-active runtime only for cancellation, and make both Project-owned filesystem removals idempotent.
3. Classify exact DELETE routes for Task, Session, Goal, Message, Part, and Mission as persisted control-plane routes. Keep their relational Project ownership checks in the database services and keep all read/update/runtime routes Project-scoped.
4. Make build-observation ref cleanup first inspect the exact `.git` entry: a missing repository means its refs are absent and cleanup is complete; malformed/unreadable Git metadata and failed Git commands still produce diagnostics.
5. Add positive production-route and service tests covering missing Project directories, directory-independent persisted deletions, and missing Task repositories, plus transport-policy contract tests.
6. Add a reusable test-runtime isolation assertion at the shared runtime-path boundary; make both standalone checkers declare an exact process-owned root and keep normal test/preload children on the inherited isolated runtime.
7. Back up the live canonical database, recheck all seven candidates have missing directories and zero Project-scoped references, delete only those exact Project IDs in one SQLite transaction, then verify integrity, foreign keys, and the remaining Project list. Do not stop the active server.
8. Run focused tests, typecheck, real route/checker validation, docs check, review the exact diff, request independent read-only review, fix findings, and repeat affected checks.

## Verification evidence

### Implemented authority convergence

- `projectRouteContextKind` now has one three-way decision (`persisted`, `identity`, `runtime`). Exact destructive routes use a new `PersistedProjectContext`, which resolves only an exact registered worktree/sandbox from the database and never calls `Project.fromDirectory`.
- Project deletion now receives the persisted `Project.Info` directly. Exact registered-directory lookup deduplicates aliases belonging to one Project and rejects cross-Project ambiguity with `ProjectRegisteredDirectoryConflictError`; `fromDirectory`, `relocate`, and `addSandbox` enforce the same exclusivity in their write transactions. Project-owned roots are idempotent only for `ENOENT`/`ENOTDIR`; config and anonymous root inspection/removal occurs before row deletion, so access and I/O errors retain database authority. Task deletion carries the exact Project ID. A Project-level admission closure blocks registry/cache entry while deletion waits for leases and evicts both initialized and identity-only primary/sandbox entries.
- Task, Session, Goal, Message, Part, and Mission deletion enforce their owning Project through persisted IDs. Session subtree prompt cancellation no longer re-enters `Instance.provide`; it uses the process-local exact `(session ID, persisted directory)` cancellation authority.
- Task build-observation Git ref cleanup treats a missing `.git` entry as the successful absence of refs while preserving errors for malformed/existing repositories. Worktree garbage collection first contains unavailable Project roots per Project before any Git/native-process call.
- Task physical-delete breadcrumbs always remain in database authority. Disk event/bundle projection now occurs only after the existing Task project root is proven to be a directory, so a missing repository is neither recreated nor converted into an error; the same contract covers direct Task deletion and Session `deleteTasks=true` cascade.
- Windows process-supervisor requests now carry `launch_failed_file`. When `CreateProcessW` fails before a target exists, the Rust helper atomically publishes an exact `target_not_created` / `active_processes: 0` marker; JavaScript startup cleanup anchors the helper PID to the actual child handle, while successor recovery validates a positive helper PID plus the request ID/runtime occurrence (without pretending a marker value is an independent PID anchor) and rejects conflicting ready/settled evidence.
- The same pre-target audit found `search_code` passing a requested file as the native process current working directory. The tool now accepts either a file or directory target, keeps the exact file in ripgrep arguments, and uses the containing directory as process CWD.
- `resolveOpenCorvusRuntimePaths` now rejects test-marked processes without a strict preload/checker-owned runtime root. The scheduled-automation and Task-control checkers declare that same ownership instead of relying on Windows `LOCALAPPDATA`.

### Focused code verification

- Latest expanded Project authority run: 33 passed, 0 failed, 48 assertions through the repository-owned isolated runner. It covers bounded target-lease/write-lock/State-disposal settlement, unrelated Project admission, durable Task/Session admission rejection, process-settlement precedence, live runtime ownership, stale deletion snapshots, database-commit rollback, retained-Project rollback, committed cleanup residue, same-ID Project recreation, database identity mismatch, exact target containment, and recovery of a completed Windows namespace ledger after the canonical database identity changes. The earlier combined 39/84 batch remains historical evidence for the broader route, build-ref, runtime-path, and supervisor surface.
- `bun run --cwd packages/util typecheck` and `bun run --cwd packages/opencorvus typecheck`: passed after the parallel permission work converged.
- Each of the nine touched TypeScript entry points bundled independently with `--external '*'`; the earlier multi-entry invocation was invalid because Bun requires `--outdir` for multiple entry points, so it was replaced rather than treated as verification.
- `cargo fmt --check` and `cargo check --manifest-path packages/opencorvus/native/process-supervisor/Cargo.toml`: passed.
- `bun run docs:check`: passed (`335 ops`, `25 groups`).
- A broader runtime ownership/startup batch was also attempted: 18 passed and 10 failed. The first failure was an isolated fixture database schema mismatch for the parallel permission-ledger change; its leaked test-local ownership then cascaded through later cases, while three pre-existing rollback-receipt expectation cases resolved instead of rejecting. These tests used the preload-owned `...\\tmp\\tests\\...` runtime, did not access the canonical database, and are not counted as this task's acceptance evidence. The focused ownership/recovery paths above remain green.

### Independent-review isolation incident

- During the fourth review, the independent reviewer incorrectly invoked the package test file without the repository preload-owned runtime entry. The new runtime isolation check rejected fixture reset, but module initialization had already opened the canonical database and applied the current parallel schema migrations (`84af4e18...` to `08708cfa...`), creating the automatic migration backup at `...\\maintenance-backups\\schema-migration-20260812T024947Z-19a458be-1295-419e-b3e4-385d6cabbacf`. No UI or process was operated.
- Read-only forensics found one additional zero-reference fixture Project `project_claiming_missing_promotion_destination` at a missing path. Every table with a `project_id` column had zero references. Before cleanup, a second SQLite backup was created at `...\\recovery\\2026-08-12-review-isolation-incident\\opencorvus-after-review-migration-before-project-cleanup.db` (SHA-256 `b6dd83a445fcb5e86ab51c91be75a8af2a5e651fc285731e1bda24d2c2daf08e`). One transaction deleted only that exact row after repeating the path and zero-reference checks.
- The migration was retained rather than rolled back because it matches the current shared worktree schema and rollback could overwrite later canonical writes. Final canonical verification: schema fingerprint `08708cfaa0236c1bb3741b0e20126f684e4e350e9dd2555846e6d2fa50c5bc8a`, exactly the real `long-absa-task` Project, `integrity_check = ok`, zero foreign-key violations, and no port 7878 listener. The reviewer was restricted to static read-only review after the incident.

### Main-agent isolation incidents

- The main agent then repeated the same unsafe direct-test mistake twice while debugging. The first direct invocation did not initialize the preload and created exact fixture Project `07f799...` plus anonymous directory `276df391-...`; before exact cleanup, `VACUUM INTO` wrote `...\recovery\2026-08-12-main-agent-test-isolation-incident\opencorvus-before-fixture-cleanup.db` (SHA-256 `3edf9822a6faf3b3db62cf3d056793171ddc391a78a0a0e444233b1b486dcd01`). Every `project_id` table had zero references, after which only that row and directory were removed.
- The second invocation supplied the preload module but still bypassed `setupTestRuntime`, creating exact rows `9ec830...` and `81236...` plus anonymous directory `607e462c-...`. A second backup `...\opencorvus-before-second-fixture-cleanup.db` (SHA-256 `5d64d57ad8c36ee6c591846c695ae9006015ef67787d8fded161565b1256c635`) preceded the same all-table zero-reference proof and exact cleanup. The repository path was not removed. Final read-only verification again found only the real `long-absa-task` Project, integrity `ok`, and zero foreign-key violations.
- All subsequent OpenCorvus tests use only `bun script/run-tests.ts <file>` or the internal `isolated-test-entry.test.ts` host after explicitly calling `setupTestRuntime`; no direct package test file is an allowed command.

### Canonical data repair

- Immediately before mutation, the canonical database still had exactly eight Projects: one real `D:\myhexin-local\demos\long-absa-task` row and the same seven exact absent temporary test paths. All seven again had zero references across every table whose schema contains `project_id`; integrity was `ok` and foreign-key violations were zero.
- SQLite `VACUUM INTO` produced the recoverable pre-repair database at `C:\Users\hengu\AppData\Local\opencorvus\data\recovery\2026-08-12-project-poison-repair\opencorvus-before-project-poison-repair.db` (38,305,792 bytes, SHA-256 `7c967c98fa3b64ea8a91ecf008db113de3b6bf2d1baf7a3ce18de231655eed6a`). The backup contains all eight pre-repair Projects.
- One transaction deleted only the seven predeclared Project IDs after repeating exact ID/path/existence/reference preconditions. The command's final reporting step hit an `ArrayBuffer` hashing type error after commit; an immediate independent read-only connection proved the backup, the committed one-Project result, `integrity_check = ok`, and zero foreign-key violations.
- The seven corresponding legacy pre-target supervisor directories (each containing only `cancel` and `request.json`) were moved, not deleted, to `...\legacy-pre-target-supervisors`. Exact CWD, owner PID 30464, runtime occurrence, missing target directory, and containment were revalidated before every move.
- A WorktreeGC pass that had captured the pre-delete Project list produced a second set of seven exact Git failures after the database commit, proving the per-Project-to-native-process amplification chain. Those seven and one same-family `search_code` request whose CWD was an existing HTML file were moved to `...\legacy-pre-target-supervisors-after-db-commit` under exact request/file/owner checks. A later scan found only the unrelated real browser MCP request with `ready.json`; it was untouched.
- During repair, PID 30464 / port 7878 was never stopped or restarted by this task; `GET /project` returned only the real Project and `GET /global/health` was healthy with the exact canonical database path. At the final read-only handoff probe, port 7878 no longer had a listener and both requests were refused. This is an external runtime-state change; the task did not restart it.

### Independent post-implementation review

- The first read-only review found five valid gaps: ambiguous registered-directory selection, Task deletion recreating a missing root through breadcrumb projection, incomplete disposal of multiple active Project entries, broad `Filesystem.exists` error swallowing, and insufficient successor-recovery identity/conflict evidence.
- The second review found four further valid gaps: identity-only cache entries and concurrent admission, anonymous-root failure after database commit, implicit Project discard bypassing shared deletion, and relocate/fromDirectory registry writers bypassing exclusivity. These were fixed through Project-level registry/cache admission closure, complete cache eviction, quarantined root removal, shared deletion for failed implicit creation, and transaction-local registry validation.
- The third and fourth reviews found additional admission/disposal races, unscoped deletion bypass, incomplete registry writers, unrelated Project blocking, durable Task/Session writer races, and filesystem/SQLite ordering gaps. The implementation now tracks pre-gate and gate-time identity discovery, bounds discovery/lease/context settlement, processes each target cache entry once, validates opaque Project-specific deletion authorities without bypassing global/process settlement, covers registry merge/relocate writers, blocks Task/Session durable admission, verifies the final Task ownership set, and suppresses disk breadcrumb projection during whole-Project deletion.
- The fifth review caught the cross-medium commit inversion: recursively deleting quarantine before the SQLite commit could retain database authority while irreversibly losing the root. The corrected single protocol is `durable active manifest -> durable rename to quarantine -> private generation/path-checked deletion transaction -> recursive cleanup -> durable rename to a database-scoped completed ledger`. Pre-commit failure restores the quarantined root and returns typed `ProjectDeletePendingError`; post-commit cleanup failure returns `committed_with_residue`, while active and completed ledgers remain the sole cleanup authority. Completed ledgers from every database identity are enumerated and validated, so Windows namespace residue that reappears after a database rebuild still converges. Public row-deletion bypasses were removed; only the complete deletion workflow can invoke the private transaction while holding the exact registry admission and live canonical runtime ownership.
- The sixth through eighth reviews then found non-unique time-based Project generations, stale caller snapshots, incomplete runtime ownership, unbounded Instance lifecycle waits, first-directory durability gaps, cross-platform path-folding errors, and completed ledgers being scanned only for the current database identity. These were corrected with immutable UUID generations and backup-first migration, gate-local current-row freezing plus commit revalidation, exact live runtime ownership, bounded/abandonable cache disposal, durable directory publication, Windows-only lexical case folding, and all-identity completed-ledger recovery. The ninth frozen-diff read-only review verified the final protocol, identity-switch recovery test, migration ordering, evidence records, and task-scoped diff and reported no unresolved P0/P1/P2 issue.
- The expanded receipt is propagated through generated OpenAPI/SDK types and Overlay validation. Overlay distinguishes `committed_with_residue` from a fully cleaned commit and shows a warning containing the exact durable cleanup diagnostics while still leaving the logically deleted Project.
