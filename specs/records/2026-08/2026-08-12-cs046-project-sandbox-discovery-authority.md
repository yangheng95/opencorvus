# CS-046 — Project discovery preserves durable sandbox ownership

## Recall

- User request: continue the long-running code-smell remediation in parallel, work directly, and avoid repairs that move the defect into another subsystem.
- Finding: ordinary `Project.fromDirectory` filtered `ProjectTable.sandboxes` through `existsSync` and wrote the reduced array back. Missing paths and filesystem observation failures therefore became durable non-ownership; Worktree garbage collection could later consume the corrupted row.
- Acceptance: discovery never reduces an existing sandbox authority; missing/unavailable bindings remain durable owners; garbage collection projects preservation rather than a deletion candidate; explicit release remains the single removal authority.
- Hard constraints: no compatibility reader, fallback, UI change, UI automation, database migration, or alternate sandbox registry. Preserve unrelated dirty-worktree changes.
- Read/search scope: `project/project.ts` definition and all `fromDirectory`/sandbox callers; Instance middleware/refresh; Worktree GC inspection/apply; final B02 deletion proof; Project/GC focused tests; `specs/current/architecture/task-runtime-directory.md`; audit finding `CS-046`.
- Independent feedback before implementation: the earlier read-only cross-surface audit confirmed that Project middleware, CLI bootstrap, and Instance refresh all reach this mutation; it also established that B02's final owner proof cannot recover a row already erased by discovery.

## Root cause and design

The Project row is the durable ownership authority, but discovery treated it as a reachability cache. Physical observation has no authority to revoke ownership. The repaired rule is monotonic for ordinary discovery: retain the exact existing ordered sandbox set, and add only the current request's newly resolved sandbox when it is distinct from the primary Project root. `Project.removeSandbox` and the B02 exact-release occurrence remain the only downward mutations.

Garbage collection also stops classifying a database-only missing sandbox as `sandbox-missing`. It emits a `durable-sandbox-owner` preservation instead. This removes the stale implicit-reconcile protocol rather than leaving a second deletion route after discovery is fixed.

## Positive verification

- Create one real managed sandbox registration, remove its directory, and run production `Project.fromDirectory` plus `WorktreeGC.inspect`.
- Assert the Git registry reports the missing entry as prunable while the returned and persisted Project retain the exact binding and GC emits `durable-sandbox-owner`.
- Restore the directory and rediscover; the same exact binding remains.
- Invoke explicit `Project.removeSandbox`; the durable set becomes empty through the sole removal authority.
- Pause discovery immediately before its commit; concurrently add a sandbox and then, in a separate occurrence, explicitly release one. Assert transaction-local union retains the add and never revives the released binding.
- Run the focused Project/GC test, OpenCorvus typecheck, route/OpenAPI generation, docs check, SDK import/type checks, and exact diff check. No UI automation applies.

## Verification and independent review

- Focused real Worktree plus controlled-concurrency verification: 2 tests, 4 assertions passed.
- Route/OpenAPI generation, docs check, SDK import check, Transport typecheck, SDK typecheck, and exact diff check passed.
- OpenCorvus typecheck remains blocked only by the concurrent, non-owned `project-memory-organizer.ts` event `signal` type error; this batch introduced no type error in its owned files.
- Independent review initially found a stale-row race that could lose a concurrent add or revive an explicit release. Discovery now resolves only the proposed request sandbox outside the transaction and re-reads/updates the latest authority inside one transaction. The reviewer reran both focused paths and issued final PASS with no P0-P3 finding.

## Impact

The cleanup-candidates public diagnostic enum changes intentionally: `sandbox-missing` is removed from candidate reasons and `durable-sandbox-owner` is added to preservation reasons. OpenAPI, SDK types, and English/Chinese API references must be regenerated from the canonical route. No Overlay source change is required because it consumes the existing discriminated response.
