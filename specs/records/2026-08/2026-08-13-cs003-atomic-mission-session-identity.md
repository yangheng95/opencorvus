# CS-003 — Atomic Mission Session identity

## Recall

### User request

- Continue the repository-wide code-smell remediation until the accepted list is exhausted.
- Work in parallel without colliding with other active batches, fix root causes rather than supervising, and leave a reviewable report/evidence trail.

### Acceptance indicators

- The first durable `kind="mission"` Session row and its `session.created` occurrence already contain the canonical Mission identity, product pillar, working directory, channel key, and immutable held Expert Squad snapshot.
- A process cut after that database commit but before Mission runtime-directory creation can be retried after restart and returns the same complete Session.
- One database-enforced authority prevents two Session rows from claiming the same Project, directory, and Mission ID.
- Runtime-directory creation remains an independently retryable derived filesystem effect.
- The create-then-`Session.mergeMetadata` path is deleted.

### Hard constraints

- Do not touch the active CS-001, CS-002, or CS-021 implementation boundaries, shared spec indexes, generated SDK files, or the unrelated dirty Workspace file.
- Do not add compatibility readers, shadow identity, or a second Mission lookup path.
- This is a non-UI batch: add focused positive runtime and storage-contract checks; do not add or run UI automation.
- After first-pass verification, an uninvolved agent must review the complete diff and evidence before commit.

### Sources read

- `specs/records/2026-08/2026-08-12-repository-code-smell-continuous-audit.md`, CS-003.
- `specs/records/2026-08/2026-08-12-code-smell-remediation-program.md`.
- `specs/current/architecture/04-extensions.md` and `specs/current/architecture/task-runtime-directory.md`.
- `packages/opencorvus/src/mission/session.ts`, `mission/schema.ts`, `session/index.ts`, `session/session.sql.ts`, `storage/ddl.ts`, `storage/schema-contract.ts`, and `project/runtime-paths.ts`.
- Focused Mission, Session-created-effect, durable-Bus, and scheduler-protocol tests.

### Whole-repository search result

- The only production constructor of a Mission Session is `ensureMissionSession`; it calls `Session.createNext` without metadata and then commits `Session.mergeMetadata` separately.
- `Session.createNext` already accepts metadata and publishes both `session.created` and `session.updated` from the insert transaction, so the split is not required by the generic Session contract.
- All Mission discovery, Work Ledger projection, process recovery, wake, and Task lineage select `metadata.mission.id`; an incomplete first row is therefore invisible to retry/recovery while its Created event remains observable.
- `ensureMissionRuntimeDirectory` is the next fallible operation and can be retried safely with `mkdir({recursive:true})`; it is derived state, not Mission identity authority.
- The current schema has no Mission-identity completeness trigger or unique index. The pre-0.1.0 storage contract rejects schema drift and requires reset rather than maintaining migration compatibility.
- A few non-production tests create Mission-shaped Session fixtures directly. Fixtures that exercise generic protocols must provide a valid canonical Mission identity once the physical invariant is enforced.

### Independent agent feedback

- Pre-implementation: none; this batch was explicitly delegated for independent parallel implementation.
- Post-implementation: an uninvolved read-only reviewer identified three blocking gaps: the first schema draft froze only `mission.id` rather than the complete launch identity; the first restart test remained in one process and did not exercise SQLite writer serialization; and the child-process harness initially lacked bounded fail-fast barrier/cleanup semantics. The implementation now enforces and tests the complete launch shape, preserves only synchronous `directory`/`mission.cwd` Project relocation, races independent Bun processes against the same database, performs a hard process exit after observing the post-commit filesystem boundary, and deterministically settles/kills child processes before cleanup. The reviewer then reran the focused cross-process test successfully.

## Root-cause and impact analysis

### Observable phenomenon and direct trigger

`ensureMissionSession` first commits a `kind="mission"` Session with no `metadata.mission`, including its durable Created event. It then performs a second metadata transaction. A process exit, database failure, or interruption between those commits leaves an externally observable but undiscoverable Mission Session. Because retry searches only canonical metadata, it creates another row.

### Data/control-flow root cause

The Mission domain failed to pass data it already owns into the generic atomic Session insert. The in-process promise map serializes only callers in one JavaScript process and cannot protect the database across restart or multiple processes. The physical schema accepts incomplete Mission rows and permits duplicate `(project, directory, missionID)` claims, so neither failure is fail-closed.

### Why the old path cannot cure it

Retrying `mergeMetadata`, broadening lookup to infer orphan rows, or extending the promise lock would retain two authorities and cannot reconstruct which Mission identity an incomplete row intended. The only repair is to make the insert the identity commit and have SQLite reject incomplete or duplicate physical facts.

### Contract and risk impact

- Session/Bus: the Created envelope must carry the same complete identity as the inserted row.
- Mission: immutable launch fields are written once; later Mission metadata merges continue to preserve them.
- Filesystem: Mission runtime notes may lag the database, but retry deterministically recreates their directory.
- Storage: current pre-release databases receive a schema reset requirement because the canonical Data Definition Language changes; no fallback migration is added. SQLite validates channel key, exact stored cwd, product pillar, and the nonempty unique kebab-case held-Squad array as well as Mission ID.
- Public API: canonical `/mission` creation behavior is unchanged. Generic direct Mission-shaped Session construction now fails closed unless it supplies the complete domain identity; affected protocol fixtures were updated to represent a valid physical Mission row.

## Implementation plan

1. Add one Session in-transaction persistence primitive so the Mission find-or-create can use the existing insert/event contract under an immediate SQLite writer reservation.
2. Build canonical Mission metadata before insert, re-check identity inside the writer transaction, and insert or return the already committed winner. Delete create-then-merge.
3. Add physical completeness/update triggers and one partial unique expression index for canonical Mission identity.
4. Add a focused crash-cut/restart test that makes runtime-directory creation fail after commit, inspects the durable Created envelope, restarts, and proves one complete Session is reused. Add focused schema acceptance for incomplete/duplicate input mapping to the physical contract.
5. Update current Mission architecture, run focused tests, typecheck, schema/docs checks, then request independent read-only review.

## Verification commands

- `bun test test/mission-session-identity-atomicity.test.ts`
- `bun test test/mission-durable-activity.test.ts`
- `bun test test/session/session-created-effect.test.ts`
- `bun test test/storage/schema-contract.test.ts`
- `bun run typecheck`
- root documentation and diff checks declared by the repository package scripts

## Verification record

- `bun test --timeout 100000 test/mission-session-identity-atomicity.test.ts`: 3 passed, 30 assertions, including two concurrent independent processes and hard-exit successor recovery.
- `bun test --timeout 30000 test/mission-session-identity-atomicity.test.ts test/mission-durable-activity.test.ts`: earlier focused pass, 4 tests / 24 assertions before the expanded cross-process case.
- `bun test --timeout 30000 test/artifact-read-facts-provider-input.test.ts test/bus-durable-outbox.test.ts`: 13 passed / 34 assertions after replacing incomplete Mission fixtures.
- `bun test --timeout 30000 test/capability/catalog.test.ts test/expert-squad/catalog-index.test.ts test/mission-process-recovery.test.ts test/task-package-revision-binding.test.ts`: 24 passed / 150 assertions.
- `bun test --timeout 30000 test/storage/schema-contract.test.ts`: 6 passed / 35 assertions.
- `bun test --timeout 30000 test/project-directory-and-worktree-gc.test.ts`: 39 passed / 59 assertions.
- `bun run typecheck` in `packages/opencorvus`: passed before the final test expansion; rerun is required after final review fixes.
- Root `bun run docs:check`, `bun run check:sdk-imports`, and `bun run api:routes-check`: passed before the final documentation update; documentation check is rerun for delivery.
- `test/session/session-created-effect.test.ts` independently fails three consecutive runs because its Global listener receives no Created envelope. Review of this diff shows the generic Session transaction still invokes the same `Bus.publishOwnedInTransaction` Created/Updated calls; only its transaction body was extracted for caller-owned transactions. The failure is recorded as a stable, separate Bus/effect defect and is neither claimed as passing nor attributed to CS-003.
