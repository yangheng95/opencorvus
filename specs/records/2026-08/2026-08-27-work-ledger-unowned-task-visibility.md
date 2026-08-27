# Work Ledger unowned Task visibility

## Recall

| Item | Detail |
| --- | --- |
| User requirement | “把任务列表的无mission根的task也展示出来，不需要特别藏着”。 |
| Acceptance criteria | The active Work Ledger returns and renders each unarchived Task that has no valid Mission root as an ordinary top-level Task. A Task with a valid Mission root remains rendered exactly once in that Mission's child drawer. Top-level Task selection, pin, rename, archive, cancellation, search, sorting, Command Palette lookup, and Memory Task selection reuse the existing Task contracts. The real Overlay page is opened and the resulting hierarchy is manually reviewed from a screenshot. |
| Hard constraints | Repair the canonical server projection and transport contract; do not hide or reconstruct rows in Cascading Style Sheets (CSS) or a second frontend state source. Do not duplicate a Mission-owned Task at top level. Preserve unrelated dirty-worktree changes. Do not add, modify, or run User Interface (UI) automation. Add focused positive non-UI contract coverage. Regenerate public route artifacts required by the changed response schema. |
| Sources read | Root `AGENTS.md`; `specs/current/architecture/02-data.md` and `07-panel.md`; the superseded `2026-08-03-work-ledger-mission-only-task-hierarchy.md` decision; Work Ledger transport schemas, server projection and route, Overlay service/component, Command Palette, Memory Task selector, Mission binding projection, Task persistence fixtures, and focused Work Ledger/Mission tests. |
| Whole-repository search | `WorkLedgerRow` is the single active-list transport union. `topRowCandidates()` is the single server pagination/search owner and currently admits Task candidates only when `archivedOnly` is true. `missionTaskBinding()` defines Mission ownership from `source === "mission"`, `metadata.actor === "mission"`, and string Mission/Session identities; Mission projection additionally binds those identities to its exact Session. `WorkLedger.tsx` already has one shared Task row renderer and all Task actions, but its top-level render union and priority calculation exclude Task. Command Palette and Memory selection currently flatten only Mission child Tasks. |
| Existing worktree | Branch `v0.0.55beta` tracks `origin/v0.0.55beta`. Concurrent work initially changed Engine control-lease, Session/server, shell-supervisor, related tests/fixtures, `02-data.md`, and `2026-08-25-architecture-debt-remediation.md`; later concurrent Config work also appeared. This task does not overwrite or stage those changes. While this task was active, concurrent Session work committed and pushed `0c4b9f8d4`; that commit accidentally included this task's already-written `02-data.md` Work Ledger paragraph. Remote history is not rewritten, and the remaining Work Ledger commit must contain only this task's remaining files. |
| Independent agent feedback | The first post-implementation read-only review failed with two P1 findings: Task candidate sorting used `time_created` while the public cursor used lifecycle-derived `time_updated`, and Task candidates did not exclude immutable `task.deleted` tombstones. It also found a stale route/OpenAPI description and the ignored-spec/parallel-staging boundary. The valid findings were repaired. The second review independently reran both focused suites, required a fresh post-fix screenshot, then passed with no unresolved P0–P3 findings after that evidence was regenerated. |

## Impact and cause analysis

1. **Observable behavior:** the active Projects / Work Ledger list can contain durable, unarchived Engine Tasks that are reachable through direct Task APIs but have no visible Work Ledger row when they are not owned by a Mission.
2. **Direct trigger:** the active `WorkLedgerRow` discriminated union omits `task`, while the Task branch in `topRowCandidates()` is guarded by `archivedOnly` and `time_archived IS NOT NULL`.
3. **Data/control-flow root cause:** the August 3 hierarchy change replaced “show standalone Task, nest Mission Task” with “all active Task rows are impossible at the top level.” The frontend faithfully renders the canonical response, so the loss happens before UI grouping, selection, sorting, and lookup.
4. **Why the old path no longer fits:** that decision assumed every durable Task belongs under a Mission. The current persisted contract and `missionTaskBinding()` explicitly permit Tasks without Mission identity, and the user now requires those durable records to be visible rather than treated as exceptional hidden state.
5. **Definitions and callers:** Mission ownership is valid only when the Task's exact Mission metadata resolves to the exact existing Mission Session in the same Project. The active list API, pagination/search, Overlay runtime index, group sorting, Command Palette, Memory selector, and generated OpenAPI/Software Development Kit (SDK) types all consume the same row union and must converge together.
6. **Data and lifecycle:** this is a read projection change only. It does not mutate Task, Session, Project, Mission, pin, archive, cancellation, or selection data. Archived Task maintenance remains on `WorkLedgerArchiveList`.
7. **Tests and delivery:** positive transport and server projection contracts include a top-level unowned Task and a Mission with its owned child. Persistence-backed tests additionally cross a cursor boundary after a terminal lifecycle update and delete another Task while retaining a visible durable row. UI acceptance is limited to a real page plus screenshot/manual review. Route/schema checks and generated artifacts close the public-contract change.
8. **Risks:** a broad “all Task rows” query would duplicate Mission children; filtering only in Overlay would corrupt pagination and other consumers; treating malformed or dangling Mission metadata as valid ownership would continue hiding a Task whose root cannot be opened. Candidate ordering must equal the public lifecycle-derived `updated` cursor or a terminal/reopened Task can repeat forever across pages. Tombstoned Task projections must be removed before pagination or a later `findTask()` can fail the entire list. The server query therefore tests exact root existence, derives candidate ordering from the current lifecycle epoch, excludes `task.deleted` from active and archived candidates, and exposes only the resulting top-level Task row.

## Single-source design

| Owner | Change |
| --- | --- |
| Transport protocol | Add `WorkLedgerTaskRow` to the active `WorkLedgerRow` union. Keep `WorkLedgerMissionTaskRow` as the stricter Mission-child shape. |
| Server projection | Admit an unarchived Task candidate only when it has no deletion tombstone and no exact same-Project Mission Session matches its Mission binding. Derive candidate `updated` from the same current-epoch open/terminal Protocol Events used by the public Task projection, so sorting and cursor values share one fact source. Apply tombstone exclusion to archived Task candidates too. |
| Overlay Work Ledger | Add Task to the top-level item/render union and calculate its priority from its own durable Task priority. Reuse the existing shared row and action implementation. |
| Lookup consumers | Index top-level Task rows in the runtime map, Command Palette, and Memory Task selector as well as Mission children. |
| Documentation | State the active hierarchy as Project plus top-level Mission, Chat/Work, and unowned Task; Mission-owned Task remains nested. Supersede the older mission-only assumption without reintroducing duplicate sources. |

## Implementation and validation plan

1. Update the transport union and server candidate/projection path, then add focused positive transport and persistence-backed projection coverage.
2. Update Overlay top-level types, priority calculation, runtime aliases, Command Palette, and Memory selector.
3. Update current architecture and both spec indexes; regenerate public API/SDK artifacts if the route schema changes them.
4. Run focused non-UI tests, package typechecks/build, repository route/docs/SDK checks, formatter/diff checks, and inspect the scoped diff.
5. Start an isolated real development page, capture and manually inspect a Work Ledger showing an unowned top-level Task and a Mission-owned child Task. Do not operate or stop a user-owned process.
6. Delegate a read-only independent review, repair every valid finding, rerun affected acceptance, commit only task-owned files, merge the latest upstream, inspect the complete outgoing commit set, and push.

## Progress

- [x] Establish repository identity, divergence, dirty-path ownership, and prior hierarchy decision.
- [x] Trace the canonical transport, SQL projection, Mission binding, Overlay grouping, and lookup consumers.
- [x] Implement and test the canonical unowned-Task projection.
- [x] Complete real-page visual acceptance.
- [x] Complete the first independent review and repair both P1 findings plus the stale public route description.
- [x] Complete second independent review with no unresolved P0–P3 findings.
- [ ] Complete final verification, commit, upstream merge, and push.

## Validation evidence

- Transport contract: `packages/transport-protocol bun test test/contract.test.ts` passed 25 tests / 1137 assertions, including one Mission child and one top-level unowned Task in the active union.
- Persistence projection: `bun test packages/opencorvus/test/mission-status-snapshot.test.ts --timeout 30000` passed 7 tests / 15 assertions. Coverage includes exact Mission-child placement, a visible active Task without Mission metadata, two-page lifecycle-derived cursor ordering with no duplicate or omission, and successful list convergence after another durable Task is tombstoned. The first 5-second run exposed transient Windows process-supervisor settlement failures in two pre-existing Git-checkpoint fixtures; an immediate clean 30-second rerun passed every test, including the two new regression cases.
- Type/build closure: Transport Protocol, OpenCorvus, Overlay, and generated SDK typechecks passed; the SDK build regenerated `openapi.json` and the generated Task response branch; Overlay Vite production build completed 7118 modules and its renderer public-surface check passed.
- Repository checks: `api:routes-check` passed 6 rules / 34 files; `docs:check` passed 336 operations / 25 groups; SDK import and the 26-document architecture index passed.
- Real API: an isolated current-source server on `127.0.0.1:17891` returned one top-level `task` named `Standalone task without Mission root`, one `mission` whose `tasks` contained only `Mission-owned planning task`, and one Project row.
- Real UI: after the two P1 repairs, the isolated `/ui/` page visibly rendered the standalone Task beside Mission. Pointer disclosure rendered the Mission-owned Task below its parent. Read-only DOM inspection found exactly one canonical top-level Task row and one canonical Mission-child Task row, both visible; browser console errors were empty. The post-fix screenshot is `work-ledger-unowned-task-visibility.png` in the task visualization directory (26,088 bytes, written 2026-08-27 11:22:59) and was manually reviewed at original detail.
- Independent review: the second read-only review independently reran the persistence suite (7/0/15) and transport suite (25/0/1137), checked the lifecycle cursor and tombstone SQL against canonical reducers and indexes, checked the route/OpenAPI/SDK closure, inspected the refreshed screenshot/API/DOM/console evidence, and reported no unresolved P0–P3 findings.
- Runtime cleanup: the isolated Browser tab and server were closed and port `17891` was released. Recursive removal of the isolated runtime/project evidence directories was rejected by the execution safety policy, so they remain contained under the task visualization directory and do not affect the repository or normal OpenCorvus runtime.
