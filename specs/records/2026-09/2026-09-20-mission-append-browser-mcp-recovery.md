# Mission append after Browser MCP disconnect

## Recall

### User request

- Fix the Mission follow-up-message failure rendered as `Host Session MCP Catalog could not inspect browser.`
- Check whether Browser Model Context Protocol (MCP) is healthy for the affected Mission.
- After the repair, rebuild and restart OpenCorvus.

### Acceptance criteria

1. A Mission Session whose session-scoped Browser MCP transport closes can accept a later user message and materialize a fresh Browser MCP connection instead of reusing a disconnected client.
2. The repair applies to the shared scoped-MCP owner used by direct Chat, Work and Mission Sessions, rather than special-casing the Mission route or the `browser` name.
3. A focused positive non-UI test proves a real scoped MCP connection publishes inventory, closes unexpectedly, and the same owner reconnects on the next inventory read.
4. The affected Mission's Browser MCP condition is checked from persisted evidence and a real Browser MCP launch/inventory interaction. UI acceptance uses the real page and screenshots only; no UI automation tests are added, changed or run.
5. Relevant typecheck, documentation checks and the focused test pass; changes are committed, upstream is merged, the complete outgoing commit set is reviewed, and the current branch is pushed.
6. OpenCorvus is rebuilt and restarted only after the candidate is ready.

### Hard constraints

- Preserve one canonical scoped-MCP connection owner and one catalog source; do not add a fallback provider, Mission-only retry path, hidden message or keyword error match.
- Preserve exact Session/Project isolation, Browser process ownership, catalog revision semantics, in-flight call settlement and deterministic cleanup.
- Do not retry arbitrary MCP Tool calls because they may have side effects. Recovery occurs when the transport close fact invalidates the exact cached connection; a later occurrence creates the next connection.
- Do not operate the user's existing Browser tabs or windows during diagnosis. The explicitly requested final restart authorizes replacing OpenCorvus only after rebuild.
- Do not log credentials or copy Provider secrets.

### Sources read

- User screenshot and `opencorvus.debug.v2` support bundle for Session `ses_-zUUJvPjwzzOMVSj715z`.
- Production log `2026-09-19T144337-210420-1.log`, especially the original Browser MCP creation and the 2026-09-19 18:19:55Z wake failure.
- `specs/current/architecture/04-extensions.md`, `task-control-plane.md`, `03-control.md`, and `capability-search-runtime.md`.
- Prior scheduling/recovery and Host Session MCP records, especially `2026-08-30-search-native-capability-phase-cd.md` and `2026-08-28-remaining-architecture-debt-closure.md`.
- `packages/opencorvus/src/mcp/index.ts`, `mcp/host-session-runtime.ts`, `tool/capability-runtime-catalog.ts`, `server/routes/mission.ts`, Browser MCP builtin/launcher code, and their focused tests.

### Whole-repository search evidence

- The rendered error is created only by `HostSessionMcpRuntime.CatalogPreparationError`; its only production preparation caller is the shared native capability catalog used for both `conversation` and `mission` callers.
- `MCP.createScopedConnectionOwner` is the common retained connection primitive for Host Session Browser, Computer, ordinary configured MCP, projected runtime owners and focused tests.
- Project-shared MCP connections install `client.onclose` and evict their cached connection. Scoped owners currently do not install an equivalent close observer; after a child exits, `entries` retains `entry.connection` and every later `use` calls the disconnected client.
- No production definition or call site provides another scoped-connection liveness authority. Mission pending-prompt dispatch correctly enters the canonical `SessionWake.wakeWithReceipt` path; the failure occurs later during shared capability-catalog preparation.
- Existing UI tests in touched/retrieved paths will not be run or modified.

### Independent agent feedback

- None: the user did not request multiple agents, and repository rules prohibit delegation by default.

## Investigation

### Observed facts

- The support bundle reports 18 persisted root-Session messages, 14 completed assistant messages, 14 completed Tools, and no persisted assistant or Tool errors before the appended prompt.
- The appended user message `msg_hrE05vUbIYbriYbTDEtr` was persisted at 18:19:54Z. The new Mission surface failed at zero seconds.
- The production log records successful creation of `session:ses_-zUUJvPjwzzOMVSj715z:browser` at 14:45:23Z and no second creation for that owner before the appended prompt.
- At 18:19:55Z, catalog inspection called `listTools` on that retained client and failed with SDK error `Not connected`, wrapped as `HostSessionMcpCatalogPreparationError`.
- The public project MCP status currently reports Browser and Computer `disconnected`; this is project/config status and is not proof of the process-memory Host Session owner state. The exact historical Session Browser process is no longer reachable; current exact owner state after process restart is unknown, not zero.

### Direct trigger and data/control-flow root cause

The appended prompt starts a new Mission prompt occurrence. Shared capability-catalog composition calls `HostSessionMcpRuntime.prepareCatalog`, which finds the retained Browser scoped owner. Its `use` method sees the cached `entry.connection` and skips `createSafely`. Inventory inspection then calls `listTools` on an SDK client already in the disconnected state and aborts prompt preparation before the model turn begins.

The shared root cause is missing unexpected-close reconciliation in `createScopedConnectionOwner`. Project-shared MCP ownership already listens to `client.onclose`, removes the exact live connection and queues cleanup. Scoped ownership keeps the dead entry indefinitely, so a later Task/Mission/Session occurrence cannot form a fresh physical connection.

### Why existing paths do not cure it

- `HostSessionMcpRuntime.prepareCatalog` clears published bindings after inspection failure, but the owner entry remains cached and its snapshot can still describe the previous connection status.
- `HostSessionMcpRuntime.ensureCatalog` only reconstructs a missing owner after process restart; it cannot replace a present owner containing a dead connection.
- Session disposal closes owners only at terminal deletion/takeover. It is not a liveness mechanism between user-message occurrences.
- Treating `Not connected` as disabled or swallowing the error would let the Mission continue without an assigned Browser capability and would preserve the stale owner.

### Horizontal audit

- Production entry points: direct Chat, Work and Mission use the same Host Session preparation; package/Task scoped MCP and Computer runtime owners use the same generic scoped owner.
- Occurrences: initial occurrence succeeds because no entry exists; later normal occurrences reuse it; restart recovery constructs a new owner and therefore succeeds; the defect appears after an unexpected close within one host process.
- Terminal paths: explicit owner close, Session deletion and Computer takeover already serialize active users and close exact connections. The repair must not change those intentional-close semantics.
- Retry and recovery: no arbitrary Tool execution is retried. The transport's real `onclose` event invalidates the exact cached connection; the next independent `use` occurrence reconnects.
- Concurrency: unexpected close removes only the same candidate still stored under its exact key. Existing active calls settle normally with their observed transport result; a subsequent call gets a new candidate. Cleanup is tied to the old exact connection.
- Isolation: owner keys retain process authority, working directory, config and connection identity. No Project-global or cross-Session lookup is introduced.
- Persisted/runtime/rendered contradiction: persisted root history is complete and terminal, while the newly rendered Mission error belongs to a failed wake occurrence. The runtime catalog considered a retained owner reusable even though the SDK client said it was disconnected.

## Implementation plan

1. Add exact unexpected-close handling to the generic scoped connection owner, mirroring the project-shared lifecycle without sharing state across owners.
2. On close, evict only the matching candidate, publish `disconnected`, queue/settle exact cleanup, and leave intentional owner close deterministic.
3. Add a focused positive real-process test that inventories through one owner, closes the underlying MCP process unexpectedly, then inventories again through the same owner and observes a new healthy connection.
4. Update the living MCP architecture contract to state the close/reconnect invariant.
5. Run focused tests, package typecheck, docs check, real Browser MCP inspection, and real UI screenshot review.
6. Commit, merge upstream, revalidate the outgoing set, push, rebuild and restart OpenCorvus.

## Status

- Implemented shared scoped-owner unexpected-close reconciliation in `packages/opencorvus/src/mcp/index.ts`. The exact
  candidate is evicted only while it is still current, its catalog status becomes `disconnected`, and its cleanup enters
  the existing project-state cleanup owner. Intentional owner close remains on the existing serialized path. No Tool call
  is retried.
- Added a real local-process positive test: initial inventory publishes `status`; the test terminates only its own child
  PID; the owner observes `disconnected`; the next inventory launches a distinct PID and republishes `connected` inventory.
- Focused validation passed: scoped recovery 1/1; Host Session MCP 5/5; Browser Node bundle 5/5; Computer scoped ownership
  4/4; occurrence-bound catalog binding 19/19. Root typecheck passed all eight workspace tasks. Docs check passed at
  342 operations / 25 groups and architecture index passed with 16 documents.
- Complete Windows Overlay build passed after constraining build-only Git safe-directory and runtime-home values to this
  exact workspace, then granting the existing build access to its installed WinGet ripgrep runtime. The freshly compiled
  sidecar passed its built-in first-run/restart check (`firstRun: passed`, four Sessions created, two persisted across
  restart, no real Provider request). Tauri release linking completed and copied the new executable to
  `packages/overlay/dist/opencorvus-overlay-windows-x64/opencorvus-overlay.exe`.
- Pending: final diff/commit/upstream merge/push, restart into the exact new binary, and real affected-Mission UI and
  Browser MCP acceptance.
