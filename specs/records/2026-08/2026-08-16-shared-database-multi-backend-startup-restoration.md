# Shared-database multi-backend startup restoration

## Recall

### User request and observable incident

- Restore the prior behavior in which two independent OpenCorvus backends can start against the same SQLite database.
- Delete the added database-related startup locks that now make the application fragile.
- The supplied screenshot shows the managed backend exiting before health with `OpenCorvus database ...opencorvus.db is owned by server runtime PID 31876`.
- Acceptance is a real, positive result: two operating-system backend processes bind different ports against one exact database path, both health routes respond, and ordinary SQLite-backed reads succeed while both remain alive.

### Hard constraints

- Preserve SQLite transaction, busy-timeout, schema-integrity, Task lease, Git/worktree, attachment-store, Provider-catalog and other domain locks. Remove both startup gates keyed by the database/data path: server-runtime ownership and managed sidecar scope ownership. Preserve the managed parent watchdog.
- Preserve exact physical process occurrence identity (process identifier, process-start fingerprint and occurrence identifier) for orphan observation and durable execution leases; it must no longer derive from or require database ownership.
- Startup recovery remains before listener publication. Multiple backends may run the same recovery/reconciliation algorithms; durable database leases and idempotent facts, not a host filesystem gate, decide work ownership.
- No user process is restarted, stopped or refreshed. The reported production database is not modified during implementation or validation.
- Existing unrelated worktree changes in `packages/opencorvus/src/engine/task-root-ingress-reducer.ts` and `packages/opencorvus/src/engine/task-control-driver.ts` are preserved and excluded from this delivery.
- No User Interface automation test is added or run.

### Material read and search results

- `packages/opencorvus/src/server/runtime-server-ownership.ts` is the direct failure source. It canonicalizes the SQLite path, creates `.opencorvus-runtime-<digest>.owner`, locks it with `proper-lockfile`, records a process owner and rejects every live contender before listener bind.
- `packages/opencorvus/src/cli/server-runtime.ts`, `server/server.ts`, `cli/cmd/serve.ts` and `cli/bootstrap.ts` thread that database owner through startup recovery, listener bind, shutdown, restart rollback and in-process commands.
- `project/deletion-cleanup.ts`, `project/delete.ts`, `project/identity-convergence.ts`, `cli/cmd/db.ts` and Task-root activation used database ownership as an extra gate. The first implementation pass exposed that Project deletion/identity admission was only a process-local `Map`; replacing the global gate therefore also requires a Project-scoped, cross-process database fence.
- `project/isolated-check-workspace.ts`, ProcessSupervisor recovery and other recovery code need only physical process occurrence observation. They do not require exclusive ownership of a database path.
- `server/managed-server-ownership.ts` adds a second scope lock after listener startup. The desktop supplies the data directory as that scope, so two managed backends sharing the database would merely move from the first conflict to this second conflict. Parent liveness is independent and remains through `ParentWatchdog`.
- Historical records describe the now-rejected decision as a single physical lifecycle owner per database. Current `specs/current/architecture/task-control-plane.md` instead states that `engine_control_activation_lease` is the durable physical owner coordinate and process-local owner maps are only shutdown/performance primitives. Shared-database startup exclusion conflicts with that current architecture.
- Full-repository search covered definitions, imports, startup/ACP/CLI entries, normal and failure shutdown, restart restore, Task activation, Project deletion/convergence, Windows orphan recovery, tests, desktop diagnostics and documentation references.

### Root-cause analysis

1. Observable phenomenon: a second backend exits before health although it requests its own listener and the shared SQLite database is already usable by the first backend.
2. Direct trigger: `RuntimeServerOwnership.acquire({ database })` sees the first process's owner record/lock and throws `RuntimeServerOwnershipConflictError`.
3. Control-flow root cause: server startup deliberately acquires a host-filesystem lease keyed only by canonical database path before recovery and bind. Different ports, projects and managed host occurrences are therefore collapsed into one artificial global owner.
4. Data-flow root cause: one object mixes two unrelated facts: physical process occurrence identity, which recovery needs, and exclusive database ownership, which SQLite and durable control leases do not need.
5. Why later work did not cure it: shutdown/retry/handoff work made owner transfer more exact and more fail-closed. That hardened the wrong invariant; stale/invalid records and cleanup failures became additional startup blockers.
6. Shared-mechanism audit: all production listener entries and in-process bootstrap paths use the same gate. Normal stop, startup failure and restart paths all manipulate its handoff state. Task/Mission/Session execution converges through persisted occurrence leases and idempotent facts, but destructive Project maintenance was an exception: its local registry and Instance maps were invisible to a second backend, and SQLite serialization alone could still admit then cascade-delete that backend's new Task. The replacement is therefore Project-scoped and transactional, never database-scoped.

### Impact and exclusions

- Remove the database-path owner record, managed data-scope sidecar record, locks, tombstone, handoff and cleanup-retry implementations plus their conflict/error surfaces.
- Replace the misleading runtime-ownership module with a process-occurrence authority used by recovery and durable leases.
- Simplify startup, listener stop and restart transfer so they coordinate listener/process-execution settlement directly.
- Replace database-wide Project assertions with `project_maintenance_fence`: one SQLite row per affected Project occurrence, acquired in an immediate transaction. Task/Session inserts and Task-root lease acquire/renew check it inside their own write transactions. Identity convergence fences every duplicate occurrence under one operation; deletion retains its fence until commit/rollback. Startup removes a fence only when PID plus process-start fingerprint proves its owner occurrence dead or reused.
- Replace ownership-conflict tests and fixtures with positive shared-database multi-backend startup coverage. Retain focused recovery-order, shutdown and process-observation tests under their true contracts.
- Old `.opencorvus-runtime-*.owner`, `.handoff`, `.releasing` and `.lock` files become inert. Startup must neither read nor delete them; therefore an old or corrupt marker cannot block a new backend and no process can accidentally delete another version's file.
- Database reset remains explicitly destructive and user-confirmed. This task does not claim that resetting a database underneath a live backend is safe; it removes the misleading general-purpose runtime owner rather than retaining a second hidden exclusivity source.

### Independent agent feedback

- The first read-only review found three valid shared-mechanism defects: concurrent deletion-cleanup recovery could treat another backend's successful rename as failure; runtime settlement could discard an exact receipt after three cleanup failures or attempt rollback after the commit decision; and removal of the database owner exposed process-local-only Project deletion/identity admissions.
- Corrections now make deletion manifests race-loser idempotent (including durable-directory temporary entries), retain/retry the exact runtime handoff receipt through post-commit cleanup, and add the Project-scoped SQLite maintenance fence plus dead-owner recovery.
- The reviewer also found that one identity-convergence operation must fence multiple Project rows with the same operation identifier. `operation_id` is therefore indexed but non-unique, while `project_id` remains the per-Project primary-key exclusion. Existing positive two-Project convergence coverage is retained.
- The next pass found that startup recovery could otherwise roll back another live backend's in-flight deletion. The active cleanup manifest now reuses the deletion fence operation identifier; recovery observes the exact fence owner and preserves every active file/manifest state unless PID plus process-start fingerprint proves that occurrence dead or reused.
- Hot-restart review found inherited supervisor occurrence/shutdown/predecessor environment belonged to the old PID. Replacement spawn now projects ordinary application environment while removing all four supervisor-owned evidence paths, so the new process uses its own occurrence instead of stale Tauri evidence.
- Final independent read-only re-review found no remaining correctness issue in the corrected snapshot. It explicitly passed live-deletion/fence recovery, post-commit exact receipts, schema migration and multi-Project fencing, real shared-backend behavior, and restart environment projection.

## Implementation plan

1. Introduce one process-occurrence module containing only process identity creation, liveness observation and cached observation.
2. Remove `RuntimeServerOwnership` acquisition/release from all server, ACP/in-process CLI, restart and shutdown paths. Keep process-execution settlement transactional: commit its handoff after listener quiescence; roll back only when listener restoration is attempted in the same process.
3. Make startup recovery consume the current process occurrence directly and run before listener bind. Replace database-owner assertions with manifest idempotency and a Project-scoped transactional maintenance fence; keep Task-root physical leases and prevent their acquire/renew while that Project is fenced.
4. Delete ownership-only fixtures and tests. Add focused positive tests for two independent backend processes sharing one database, startup recovery ordering, direct listener lifecycle, process occurrence and relevant Project contracts.
5. Run the repository's isolated focused checker, package typecheck, documentation checker and `git diff --check`. Run a real two-process checker against a new isolated database and verify both health endpoints while both processes are alive.
6. Request independent read-only review, repair every valid finding and repeat review after any code correction.
7. Commit only task files, fetch and merge upstream, inspect the complete outgoing commit set, rerun proportionate checks and push the current branch.

## Acceptance evidence

- Real shared-database process proof: the official isolated runner launched two independent Bun backend processes with the same `OPENCORVUS_TEST_HOME` and exact `data/opencorvus.db`. Each process installed a managed parent watchdog, prepared recovery, opened the shared database, read the same non-empty SQLite schema, bound its own operating-system-assigned port and returned `healthy: true` plus the same canonical database path from `/global/health`. Their ports and process occurrence identifiers were distinct. The same test proves backend B sees backend A's Project fence as `ProjectDurableAdmissionClosedError`, sees admission reopen after explicit release, and sees a crashed A's fence removed only after a replacement backend proves the owner process occurrence dead. `test/shared-database-multi-backend.test.ts`: 1 passed, 0 failed, 11 assertions.
- Startup/recovery/lifecycle proof: ACP prepared-process bind, recovery-before-bind ordering with one shared occurrence observer, cleanup after failed pre-listener recovery, graceful stop retry before commit, and continuation of the exact receipt after the commit decision: 5 passed, 0 failed.
- Latest task-scoped checks: shared database 1/1; startup/restart/settlement 6/6; schema and existing-database migration 10/10; explicit Project identity convergence 11/11; runtime execution settlement + ProcessSupervisor + Windows orphan recovery 31/31; Task-root lease/reconciliation 9/9; full Project deletion/admission/cleanup and Worktree garbage collection 46/46; Browser Model Context Protocol + Tool-result control protocol 28/28. Total: 142 passed, 0 failed when each stateful group is isolated.
- The independent reviewer also combined five stateful files in one runner: 72 passed and 2 failed because the shared test database and Windows dangling-process cleanup leaked across files. Isolated reruns of `runtime-startup-recovery.test.ts` passed 6/6 and the affected Worktree case passed 1/1; the real shared-backend test passed 1/1, identity convergence 11/11 and schema 10/10. This runner-isolation evidence is recorded rather than describing the combined invocation as green.
- Package TypeScript typecheck passed. Root `docs:check` passed with 333 operations in 25 groups. Desktop Rust `cargo check` passed. `git diff --check` passed.
- A separately selected Goal Workload file, which is being modified by concurrent user work, produced 24 passes and 3 failures. All three failures are the same current Protocol contract error, `agent.execution.lifecycle payload must not duplicate order_key`, at `ProtocolStore.persistedEventOrderKey`; they do not enter any changed startup, process occurrence, listener, managed lifecycle or database-lock path. They are not counted as this delivery's passing evidence or concealed as success.
- No production database, credential, user application process or window was read, mutated, restarted, stopped or refreshed. No User Interface automation test was run; the touched static Rust-source assertion test was deleted under the repository's User Interface test policy.
