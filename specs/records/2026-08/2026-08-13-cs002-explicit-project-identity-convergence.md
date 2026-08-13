# CS-002 — Explicit Project identity convergence

## Recall

- User requirement: continue repairing the complete code-smell register, work directly while independent batches run in parallel, fix root ownership instead of moving defects, and merge upstream before any push.
- Acceptance target: ordinary `Project.fromDirectory` and `Instance.provide` must never rewrite domain tables. Two durable Project rows naming the same worktree produce one typed conflict with byte-for-byte unchanged database facts. One explicitly invoked repair authority may choose a canonical Project occurrence, migrate an enumerated set of domain-owned `project_id` references transactionally, merge Project metadata/sandbox ownership, delete the duplicate rows, and make subsequent lookup return the canonical identity.
- Hard constraints: no SQLite-schema discovery, generic `project_id` updates, fallback reader, compatibility path, hidden migration during lookup, UI automation, or edits to the unrelated dirty `workspace.ts`. The repair must use a static reviewed mapping, fail atomically on uniqueness/invariant conflicts, and have focused positive non-UI tests plus independent read-only delivery review.
- Read sources: repository `AGENTS.md`; continuous-audit `CS-002`; remediation program; `project/project.ts`, `project.sql.ts`, `project/instance.ts`; all current `*.sql.ts` definitions containing `project_id`; `storage/schema.ts`, `db.ts`, and the pre-0.1 schema-reset contract; server error mapping; database CLI; relevant Project/deletion/GC tests and current architecture records.
- Whole-repository search: hidden convergence exists only in `project.ts` through `projectIDTables`, `mergeExactWorktreeRows`, and `findExactWorktreeRow`. It scans every SQLite table, rewrites any column named `project_id`, merges a few Project fields, and is entered by Git and non-Git identity resolution. Current schema contains explicit Project references in Bus, Channel, Engine Task, Memory, Permission, Workspace, Session, Automation, Event Job, plus nullable non-FK Quick Note. No explicit Project identity repair command or migration owner exists.
- Independent-agent feedback before implementation: none for this batch. Other agents are working on non-overlapping CS-001, CS-021, and CS-075 files.

## Root cause and impact

`findExactWorktreeRow` treats a cached/local preferred ID as permission to repair historical duplicates. It calls a function that enumerates SQLite schema at runtime and updates every table with a coincidental `project_id` column before deleting Project rows. A read/bootstrap path therefore owns an open-ended database migration without domain contracts. New tables silently join the mutation, compound uniqueness may fail mid-design, and future embedded identities are invisible to the generic update.

The lookup result and repair occurrence are different authorities. Lookup must be observational and fail closed. Repair must be explicit, versioned by code, statically enumerate each current domain mapping, and complete inside one database transaction.

## Design

1. Replace duplicate selection/merge in `Project` with a typed `ProjectDuplicateWorktreeIdentityError` containing the normalized worktree and sorted durable Project IDs. Any exact duplicate set throws before marker writes or database mutation, regardless of cached/local preference.
2. Delete schema enumeration, generic SQL updates, preferred-row selection, and all lookup-owned convergence checks/logging from `project.ts`.
3. Add one `ProjectIdentityConvergence` repair module. Its static mapping imports the current domain tables explicitly and owns every supported `project_id` rewrite. It validates the requested canonical row and exact duplicate worktree set, preflights known compound-identity conflicts, executes all mappings, merges Project metadata/sandboxes, and deletes duplicates in one transaction. SQLite constraint failure becomes a typed convergence conflict and rolls the whole transaction back; there is no partial or table-discovery fallback.
4. Expose the repair only through an explicit `opencorvus db converge-project-identities <worktree> <canonical-project-id> --force` command after acquiring exact cross-process Runtime Server ownership and disposing local Instances. Normal startup and HTTP lookup never invoke it.
5. Treat append-only Permission evidence, durable Bus publication rows, immutable Task process bindings/files, embedded attachment references, and a noncanonical AttachmentStore authority as typed preservation conflicts. They are not mutable foreign-key owners and are never rewritten in place.
6. Record the static mapping and explicit repair contract in current architecture. This is a data repair for duplicate rows under the already-current schema, not a DDL compatibility migration; schema fingerprint/reset behavior remains unchanged.

## Positive verification

- Seed two exact-worktree Project rows plus representative references and a database snapshot; real `Project.fromDirectory` returns the typed conflict and every row remains unchanged.
- Run the production convergence authority, assert the receipt identifies the canonical/removed Projects and exact migrated table counts, all seeded references now name the canonical ID, merged Project fields/sandboxes are preserved, and lookup returns one canonical identity.
- Seed a compound-identity collision, assert typed conflict and unchanged Project/domain rows.
- Verify the static mapping's physical table names equal the current registered tables that own a `project_id` column, with the intentionally non-owned Project table excluded. This guards future schema additions without allowing production runtime discovery to mutate them.
- Run the focused test, OpenCorvus typecheck, docs check, and task-owned diff check. Do not run UI tests.

## Delivery state

- Implementation: complete and frozen pending independent review. Ordinary Project lookup now has one typed duplicate-identity observation contract; the explicit database command owns the only reviewed convergence mutation.
- Verification: focused production authority test `11/11` PASS (lookup conservation, successful convergence receipt, compound-key rollback, physical alias identity, registered-sandbox duplicate detection, required runtime ownership, immutable Task binding preservation, attachment-store authority preservation, embedded identity preservation, append-only permission preservation, durable outbox preservation, registry coverage); OpenCorvus typecheck and task-owned diff check PASS.
- Independent delivery review: PASS after two corrective rounds. The first review found that the initial explicit repair still used a generic raw update loop and missed physical aliases, runtime ownership, append-only/outbox/Task-binding authorities, and attachment authority. The second review found a registered-sandbox lookup bypass and missing production tests for three blockers. All findings were accepted and repaired with explicit Drizzle domain mappings, typed preservation blockers, physical identity observation, exact Runtime Server ownership, read-only attachment authority observation, a unified physical duplicate check after registered-sandbox resolution, and the expanded focused suite. Final independent re-review reproduced `11/11` focused tests, OpenCorvus typecheck, and the task-owned diff check with no remaining actionable finding.
- Commit/push: implementation is ready for its exact scoped commit; push remains deferred until the complete remediation goal is finished and upstream has been fetched and merged as requested.
