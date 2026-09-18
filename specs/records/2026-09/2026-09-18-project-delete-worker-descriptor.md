# Project deletion with worker descriptors

## Recall

- User requires deleting disposable Project directory `4b0c93fb-41b4-4183-b232-2727c03eb337`; prior authorization explicitly permits discarding its Task data and stopping/restarting OpenCorvus when required.
- Acceptance: canonical `DELETE /project/current` removes the Project row, Task/Session/runtime state and exact disposable directory even when the Project contains persisted worker Turn descriptors; no manual database surgery or filesystem-only deletion; the Project cannot reappear after restart.
- Hard constraints: preserve Provider configuration and unrelated Projects; fix the canonical deletion transaction rather than bypassing it; retain worker-descriptor immutability during ordinary Task/Session operation.
- Sources read: live deletion 409 and stack, Project delete route/service, `project/delete.ts`, Project deletion cleanup, worker descriptor schema/triggers, Task/Session/Project foreign keys, and current Project deletion architecture.
- Whole-repository search: `worker_turn_descriptor` is Project- and Session-owned, has cascade foreign keys for both, and rejects deletion while its Session exists. The canonical transaction currently deletes `engine_task` and then `project`; SQLite can reach the descriptor's direct Project cascade before removing its Session, so the immutability trigger rejects the otherwise-authorized Project deletion.
- Independent agent feedback: the first review found that deleting Sessions before Tasks would violate the Task creation contract's `ON DELETE RESTRICT` reference to its creator Tool request. The transaction now deletes Task facts first, then Sessions and the Project; a second review found no remaining issue.

## Observed failure

- The official deletion endpoint returns HTTP 409 `ProjectDeletePendingError` at stage `database-commit`.
- The underlying SQLite reason is `worker_turn_descriptor: immutable dispatch authority`.
- The target Project currently has 1 Task, 10 Sessions and 13 worker descriptors. Filesystem quarantine rolls back, so the source directory remains intact after the failed request.

## Plan

1. Add a positive Project deletion case containing a real persisted worker descriptor.
2. Delete Task-owned facts first so their creation contracts release Session-owned Tool requests, then delete the Session tree before the Project cascade so immutable Session-owned facts observe the Project-deletion authority boundary.
3. Verify the complete Project deletion checker, schema contracts, typecheck, docs and the real target deletion; then perform independent read-only review.

## Verification

- The regression containing a real `panel_create_task` Tool request, current Task creation contract and worker Turn descriptor failed on the previous implementation with `worker_turn_descriptor: immutable dispatch authority`, then passed after the ordered deletion fix.
- All 9 focused Project deletion cases pass; package typecheck, docs check, diff check and the full Overlay release build pass.
- The rebuilt `0.1.1-beta` Overlay returned HTTP 200 `committed` for the exact target Project. Its directory no longer exists, and read-only database checks report zero Project, Task, Session, descriptor and maintenance-fence rows for `prj_hvJHfcrzOWe9ExDv4JY6`.
- No `.authority.json` marker exists under the Projects root. Provider/global configuration paths were outside the quarantined Project targets and were not changed.
- Independent read-only review passed after the deletion-order correction, with no unresolved findings.

## Status

Complete.
