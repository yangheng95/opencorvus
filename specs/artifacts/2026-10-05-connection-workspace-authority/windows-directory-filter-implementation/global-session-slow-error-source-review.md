# Global Session slow error source review

## Recall and actual phase boundary

Root's third unchanged-budget real checker localized the first case; Root04 is separately collecting requestID-correlated DEBUG diagnostics. Read only the supplied root-real-store-routes-03 stdout and current production routes/Instance/module load/Session global SQL/DTO/direct callers. Do not read Root04 runtime files, open any DB, execute HTTP/runtime/checker, modify source/tests/Git/index, use credentials or delegate. Parent/Sandbox fixture registration remains its actual current authority; no alternative route or bootstrap bypass is proposed.

Actual Root03 first native spelling:

| Existing request | Actual duration / status / shape |
| --- | --- |
| /session | 696.5643ms, 200, array; three saved A Session IDs |
| /session/global | **84252.7196ms, 500, object `{name,data}`**, UnknownError with deliberately generic public message |
| /mission | 20.2715ms, 200, array; real A Mission ID |
| /global/tasks | 4.596ms, 200, board `{summary,tasks}` |

The first test later timed out at 90107.39ms against 90000ms; mapping the already-returned global error object caused the subsequent TypeError. Other invalid-path and stronger Mission scope tests passed. This is now an actual **global Session request slow failure**, not an inferred DTO/alias mismatch. There is still no original stack, DB/lease/stage attribution in this stdout. Root04 owns that missing evidence. Do not infer an 84-second deadline solely from the measured elapsed time.

## Entry and module factory

SessionRoutes defines GET /global at its root-relative path (`routes/session.ts:798–875`), app.ts:169 mounts it at /session, and generated SDK types/sdk use **/session/global** (`sdk/js/src/gen/types.gen.ts:27547`, sdk.gen.ts:12153). No production literal /global/session alias was found. The success DTO is GlobalInfo[], with actual project summary/null. Global caller search finds this REST producer plus SDK method; no current Overlay literal consumer was found in the searched TS/TSX. CLI Session.list callers use the local domain API; Session.listGlobal's new direct test calls are not another production route.

The current transport directory policy does not bypass /session/global. Even though its list spans saved Projects, it enters server middleware's directory validation/context (`server.ts:890–918`). Missing required directory retains DirectoryRequiredError; invalid OS path retains InvalidDirectoryError. Valid directory is resolved, then projectRouteContextKind selects its current runtime path (no special persisted/identity list rule). /session has the same route-context class; /mission and /global/tasks are actual global bypass paths with different initialization requirements. Their fast outputs cannot prove a runtime Session request's stage completed correctly.

Server.loadProjectRoutesApp (`server.ts:604–617`) has one cached app and one shared module-load promise, clears the promise on construction/import failure, and builds AppRoutes(root). The .all dispatcher (`:921–926`) awaits that factory and invokes projectApp.fetch, carrying the request ID into the returned header. resetProjectRoutesAppForTest explicitly clears factory state between test cases. First /session success indicates a project app existed for that request; it does not prove every later request bypasses all contextual work or that a convergence/retirement cannot happen between them.

## Global handler / SQL / DTO path

GET /session/global validates optional directory/roots/start/search/limit/archive and compound cursor fields. It enumerates Session.listGlobal with `limit + 1`, slices the array only for the public page, emits real compound cursor headers if needed and returns c.json(list). Those success/error contracts are current; do not replace them with a new route, fabricated page or local-only Project filter.

Session.listGlobal (`session/index.ts:1088` onward) is a synchronous generator. It builds real root/time/search/archive/cursor conditions; inside **one synchronous Database.transaction** it selects the current saved distinct directory catalogue through the shared adapter, matches existing Project.samePath, binds exact saved values, then performs the real ordered/limited Session select and checks deletedInTransaction. There is no await, model/Provider, filesystem stat/physical alias walk or Instance initialization inside this filter adapter. deletedInTransaction (`:104–110`) performs a synchronous protocol-event tombstone lookup per selected Session. The distinct catalogue/final select/deletion checks are bounded by current data, not by another process runner.

After that transaction, listGlobal performs its existing separate Database.use ProjectTable summary lookup for actual returned project IDs. It then emits `{...fromRow(row),project}`. fromRow (`:112–143`) maps persisted Session fields/nullable summary/share/permission/times; ProjectInfo (`:313–322`) contains id/optional name/worktree, GlobalInfo (`:324–329`) extends Info with nullable project. No async resolver or physical project discovery runs at that DTO step. The direct global-list assertions before HTTP in Root03 had already succeeded for this fixture's actual saved records, making a deterministic malformed-row explanation weaker, but not eliminating context-dependent SQL/error behavior.

Database uses synchronous SQLite calls, normalizes errors, enforces active context ownership/closed state and wraps nested transaction/savepoints. Its SQLite busy_timeout is **5000ms** (`storage/db.ts:1013,1023`), not evidence of an 84-second SQL deadline. A blocked native call, repeated operations or a retired/closed context are source-reachable error classes; no actual busy error, query plan, long callback or transaction owner was captured in the provided stdout. Do not translate UnknownError into SQLITE_BUSY or declare the new read transaction guilty from elapsed time. The later Project lookup remains the original domain boundary; removing the transaction or dropping the filter is not an evidence-based fix.

## Registered Parent/Sandbox and shared lifecycle boundaries

Fixture now uses actual parent discovery plus explicit addSandbox admission before either A/B child Instance. Both child directories resolve to that saved Project namespace while Sessions retain their exact A/B directory. The filter's scoped mode derives projectID from real Instance; global mode does not derive one from path/title and retains all matching saved directory rows across Projects. No-filter local functions remain all-in-Project, global functions all-in-global scope. Actual Mission stronger scope passing confirms this fixture premise, not universal runtime initialization completion.

Instance.provide normalizes directory/cache key, owns initialization promises, entry turns and serving leases. A completed InstanceBootstrap is tracked by its actual init function in initRuns; prepareContext waits current entry/context/lifecycle, handles inherited/recursive admission and does not repeatedly invent an initializer. It has reentry and teardown guards. Its underlying code can wait entry context, active serving/teardown parks and exclusive turns. Bootstrap stages include Config/Plugin, watchers, durable bridges, scheduled/recovery work, Task/Mission/Session cancellation/waiter/permission and Task-control reconciliation. That is a common mechanism across product routes, not a list-specific workflow gate.

Each bounded server entry's finally schedules current cache convergence. scheduleConvergence serializes on convergenceTail and tracks pending eviction settlements; exact Project/directory entries and multi-Project idle work can be reclaimed independently. Global disposal cancels background/scheduler classes before lease drain and entry turn acquisition. Normal completion, initializer failure/rollback, retry/recovery, concurrent request, cache eviction and final cleanup all use the same entry/lease owners. Their actual effect on the second native request is unknown until Root's correlated stage/lease evidence identifies the failing interval. A .listGlobal-only symptom does not exclude this shared root.

Two earlier checker processes had separate test process/home/data roots and process-local Instance state by the existing runner/preload. Host resource overlap remains possible but is not a durable shared-owner fact. Root03 names a genuine isolated process-root directory; this review does not stat/read that directory. Root04's Log.flush/readOwnedLog must distinguish the actual request ID from background recovery/error logs and retain process/Project/Session/occurrence identity before attributing concurrency.

## Reachable boundaries to classify with Root04

1. Directory resolution / registry/Instance admission: exact normalized input, actual Project/sandbox, current entry and init status. Compare the two native requests, not request titles.
2. Factory/dispatch: whether the shared app promise was reused or reset/failed, then actual route entered with validated query.
3. Runtime preparation/recovery/convergence: actual stage begin/end/failure, serving lease/entry turn/retirement and occurrence ownership; include simultaneous same-Project sandbox and independent C entries.
4. SQL: first read transaction catalogue/select/tombstone and later Project summary lookup; capture original error class/code/context stage rather than generic public UnknownError. Synchronous source is not timing proof.
5. Response/teardown: actual return status/request ID before test timeout; subsequent test continuation and async-disposal must be kept separate. The TypeError is a secondary unchecked-shape failure; it does not cause the preceding 84-second HTTP failure.

No original diagnostic stack or lease/source receipt is present yet, so none of these candidates is promoted to a root cause. Request-origin metadata, prompts, model/catalog/auth and full private headers are unnecessary to this classification and must not enter evidence. Root will provide exact diagnostics and decide the smallest shared mechanism fix. Keep the original budget, correct production/global list contract and no-fallback owner discipline; no new bootstrap-skipping API, host gate or selector can substitute for identifying the actual error.
