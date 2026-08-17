# Project delete conflict contract

## Recall

- User request: investigate and then fix HTTP 500 responses caused by deleting a Project.
- Acceptance:
  - a second deletion attempt while the same Project deletion occurrence owns maintenance admission returns the canonical typed Project admission conflict with HTTP 409, never an unknown 500;
  - repeated Overlay deletion calls for the same canonical directory share one in-flight request and receive the same committed result;
  - the successful deletion path and its existing runtime, Task, Session, filesystem quarantine, rollback, restart recovery, multi-Project isolation, and cross-process maintenance-fence contracts remain unchanged;
  - focused backend tests, typecheck, documentation checks, and independent read-only review pass.
- Hard constraints read from `AGENTS.md`: analyze before modification, one implementation/source of truth, no fallback or compatibility path, no UI automation, focused positive tests, independent review after validation, commit and push only task-owned changes.
- Materials read: `specs/current/architecture/server-runtime-readiness.md`, `specs/current/architecture/task-runtime-directory.md`, the Project deletion and shared-database records from 2026-08-14 through 2026-08-16, deletion route/registry/lifecycle/error handler, Overlay Work Ledger deletion path, and the real production log occurrence.
- Repository search:
  - `Project.DurableAdmissionClosedError` is already the canonical public 409 contract, but its definition lives in `project.ts` while `deletion-registry.ts` throws generic `Error` at the two maintenance-admission collision points;
  - `deleteProjectState` has no per-directory in-flight owner, so two confirmed Work Ledger actions send two DELETE requests;
  - deletion is Project-scoped and its process-local plus SQLite maintenance fences cover normal entry, Task/Mission/Session occurrence settlement, retry/restart recovery, parallel backends, sandboxes, and multi-Project isolation. The observed failure occurs before a second deletion occurrence can acquire that shared authority; it is not a Task- or workflow-local failure.
- Runtime evidence: request `0ce62833-3de1-4cf4-957d-099e32a88bdc` started at 08:27:58 and committed with HTTP 200 after 61.387 seconds. A second request for the same Project, `8c08d769-51c8-47d1-8a2d-7b444fb3985d`, arrived while admission was closed and returned HTTP 500 from the generic `registry admission is already closed` error. The first deletion subsequently succeeded.
- Independent agent feedback: first read-only review found that the initial backend test covered only the process-local admission Map and called the status mapper directly, leaving the SQLite fence and real HTTP route unproved. It also found that the first Overlay key normalization collapsed `D:/` into `D:` and did not resolve repeated separators or dot segments, and recommended explicit failed-operation retry coverage. The second review found one remaining Windows collision between drive-relative `D:foo` and drive-absolute `D:/foo`. All findings were accepted and corrected. The third read-only review verified the repaired backend/Overlay contracts and complete task diff with no remaining actionable findings.

## Root cause and impact

The maintenance registry correctly prevents two destructive occurrences from owning one Project, but the collision is outside the canonical typed Project admission error. The server therefore maps it to unknown HTTP 500. The Overlay independently permits duplicate calls while the first confirmation is still settling. A long-running cancellation/disposal window makes this easy to trigger and also leaves background Project reads exposed to the same typed-vs-generic boundary, but no evidence shows the committed deletion transaction failed.

## Plan

1. Move the existing `ProjectDurableAdmissionClosedError` definition to the dependency-owning deletion registry and keep `Project.DurableAdmissionClosedError` as an alias to that single definition. Throw it for process-local and durable maintenance-fence admission collisions.
2. Give `deleteProjectState` one canonical-path-keyed in-flight Promise owner. Concurrent callers join the exact request/result; settlement removes only its own entry.
3. Add focused positive contract coverage for typed HTTP 409 on a concurrent backend delete and for shared Overlay deletion results without duplicate transport calls. Do not add or run UI automation.
4. Run focused tests, typecheck and docs checks, then commission independent read-only review. Resolve valid findings and repeat review if code changes.

## Validation evidence

- Focused backend conflict contract: 2 passed, 0 failed. It covers the exact process-local duplicate occurrence through the real DELETE route and the SQLite maintenance-fence collision directly; both produce `ProjectDurableAdmissionClosedError` with HTTP 409 mapping.
- Focused Overlay workspace service: 8 passed, 0 failed. It covers concurrent equivalent Windows paths sharing one request, dot-segment and repeated-separator normalization, successful settlement cleanup, rejected-operation cleanup and retry, and distinct drive-root versus drive-relative keys.
- Shared SQLite multi-backend startup/fence contract: 1 passed, 0 failed, 11 assertions.
- OpenCorvus and Overlay package typechecks passed. `docs:check` passed with 332 operations across 25 groups.

## Risk boundaries

- Do not change deletion ordering, cancellation, filesystem quarantine, database commit, residue cleanup, maintenance-fence persistence, or restart recovery.
- Do not turn a maintenance collision into success at the backend: different clients cannot safely receive another process's eventual receipt without a durable operation/result join. The public contract is therefore 409; only callers inside one Overlay process share their exact Promise.
- Do not suppress unrelated background Project operations or add a second deletion state. Their admission behavior continues to use the canonical Project conflict contract.
