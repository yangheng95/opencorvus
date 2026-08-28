# Overlay Expert Squad handoff startup convergence

Date: 2026-08-28

## Recall

### User request

- Treat the failure as an existing design defect in the shared upstream
  startup/install-handoff infrastructure, not as a merge-conflict regression or
  a database failure.
- Repair the renderer startup path that synchronously awaits
  `installExpertSquadInstallHandoffBridge()` before health initialization, and
  replace the destructive native pending-handoff `take()` contract.
- Preserve the Git finding that commit `089ce393` introduced both behaviors and
  that the current merge only exposed them after repackaging.

### Acceptance criteria

- Installing the Expert Squad handoff bridge cannot suspend renderer module
  evaluation or delay `initApp()` and its backend health check.
- Cold-start argv, single-instance argv, runtime deep-link and `get_current()`
  deliveries continue to converge through one native pending-handoff slot and
  one renderer consumer.
- A pending handoff remains available until the renderer has parsed it, made it
  visible and opened the exact install surface successfully; failed or disposed
  consumption does not erase it.
- Concurrent or repeated delivery converges on the newest native pending value,
  processes one consumer at a time and conditionally acknowledges only the
  value actually accepted.
- Browser-host startup stays inert. Listener cleanup remains correct even when
  disposal occurs before Tauri's asynchronous listener registration resolves.
- Focused positive TypeScript and Rust contracts, Overlay typecheck/build,
  renderer-surface check, document checks and an isolated real startup review
  are attempted and recorded honestly. No User Interface (UI) automation test
  is added, modified or run.
- A previously uninvolved agent performs the mandatory read-only review after
  first complete validation; all valid findings are repaired and rechecked.

### Hard constraints

- Preserve every unrelated staged, unstaged, deleted and untracked change in
  the shared `v0.0.55beta` worktree, including the overlapping edits in
  `packages/overlay/src/main.tsx`, `specs/README.md` and the August index.
- Do not stop, restart, refresh or reuse the user's running OpenCorvus process
  or window. Any runtime acceptance must use isolated paths, ports and build
  outputs.
- Keep one current handoff implementation and one pending-state authority. Do
  not add a fallback event path, compatibility command, duplicate queue or
  renderer shadow state.
- All Large Language Model interactions remain streaming. This change does not
  touch Provider credentials, model catalogs, database schema or backend
  recovery ordering.
- No UI automation source, Document Object Model assertion, snapshot,
  Playwright test, browser fixture or screenshot baseline may be created,
  modified or executed.

### Sources read

- The repository-wide `AGENTS.md` instructions supplied by the user.
- `specs/current/architecture/server-runtime-readiness.md`.
- `specs/records/2026-08/2026-08-16-backend-recovery-readiness-convergence.md`.
- `packages/overlay/src/main.tsx`, `services/init.ts`,
  `services/expert-squad-install-handoff.ts`, host transport boundaries, the
  focused bridge test, and `packages/overlay/src-tauri/src/main.rs`.
- Tauri 2 official event documentation: `listen()` returns a
  `Promise<UnlistenFn>` and cleanup after early disposal must chain through that
  Promise.
- Tauri 2 official deep-link documentation: Windows/Linux cold delivery uses
  process arguments and runtime delivery depends on the single-instance path.

### Whole-repository search results

| Boundary | Result and disposition |
| --- | --- |
| Renderer startup | `main.tsx` awaits the bridge before the only `initApp()` call. A pending listener-registration or native invoke Promise therefore suspends all settings, API, locale and health initialization. Remove that startup dependency; do not move health into the handoff feature. |
| Native producers | Cold argv, `get_current()`, runtime `on_open_url` and the single-instance callback all call `accept_expert_squad_install_handoff`, which strictly parses the same URL, replaces one pending slot, emits one wake event and shows the main window. Preserve this shared producer. |
| Pending state | The renderer command calls `Option::take()` before parsing/showing/opening completes. Any renderer failure, reload or teardown after the command loses the only durable-in-process receipt. Replace it with read plus compare-and-acknowledge. |
| Concurrency | Tauri event callbacks may overlap and complete out of order. Event payloads are wakeups; the native latest pending value is the authority. Use one renderer reconciliation flight and loop when a newer value supersedes the accepted value. |
| Cleanup | Tauri listener registration is asynchronous. The bridge must return its disposer synchronously and chain disposal through the listener Promise so early teardown cannot leak the eventual listener. |
| Task/Mission/Session | No Task, Mission, Session occurrence, Scheduler, retry, terminal-state or database path calls this bridge. The shared-lifecycle impact is renderer-wide startup plus every native handoff producer, not the backend control-plane recovery mechanism. |
| Browser host | The browser transport has no native deep-link handoff and must receive an immediate inert disposer without touching Tauri APIs. |
| History | Local blame identifies `089ce393` as the source of the awaited bridge and native `take()`. The local object store does not contain merge object `7bb0c978`, so its two-parent ancestry is recorded from the user's supplied Git evidence rather than claimed as locally reverified. |

### Independent agent feedback

- None before implementation.
- The required post-validation read-only review found no production control-flow,
  Tauri mapping, native atomicity or producer-convergence defect. It identified
  three delivery-evidence gaps: the retained-receipt test did not prove the
  visible surface was retried, the renderer had no positive latest-value
  convergence test after a stale acknowledgement, and this record did not yet
  contain final checker/native acceptance evidence.
- The first two findings were repaired with explicit successful surface-call
  evidence and a renderer A-to-B convergence contract. The third is resolved by
  the verification section below. The same independent agent repeated its
  read-only review after these repairs and reported no unresolved findings.

## Problem depth and impact

### Observable behavior

The repackaged desktop can render its static/Solid shell and show its native
window while remaining Offline because renderer module evaluation is suspended
before the sole `initApp()` entry reaches server health initialization. Native
backend health and database schema can both be correct while the renderer never
observes either.

### Direct triggers

1. Top-level startup executes
   `await installExpertSquadInstallHandoffBridge()` before `initApp()`.
2. The bridge awaits Tauri listener registration and then a native pending-value
   command, neither of which belongs to the renderer readiness barrier.
3. That command destructively removes the pending value before the renderer
   parses it, shows the window and opens the install dialog.

### Data and control-flow root cause

A best-effort product feature owns a top-level application-startup barrier, and
the native/renderer handoff uses destructive read as delivery confirmation.
Those two design choices couple unrelated availability domains: a stalled Tauri
event/invoke call suppresses global renderer initialization, while a later UI
failure is treated as if delivery succeeded. The event payload independently
encourages overlapping consumers even though the native slot is the only latest
state authority.

### Why previous paths did not cure it

- Backend listener-readiness repairs correctly made `/global/health` independent
  of long application recovery, but cannot help a renderer that never invokes
  its health client.
- The static startup surface and bounded first-frame wait prevent a blank or
  indefinitely unpainted window; they do not remove later top-level awaits.
- Adding a browser-host guard avoids unsupported calls in Web builds but leaves
  the Tauri startup barrier and destructive native read unchanged.
- Repackaging changes when the defect is observed, not its ownership or
  introduction history.

## Decision

1. Make bridge installation synchronous. It begins Tauri listener registration
   in the background and returns a disposer immediately, allowing renderer
   initialization to continue in the same module evaluation.
2. Treat native events only as reconciliation wakeups. After listener
   registration, and after every event, a single-flight renderer consumer reads
   the current native pending value.
3. Replace `take` with `current` plus conditional `acknowledge(raw)`. A successful
   parse/show/dialog sequence is the acknowledgement boundary. If a newer value
   replaced the old one, acknowledgement fails positively and the consumer
   loops to that latest value.
4. Retain failed consumption in the native slot for a later wake or renderer
   reload. Report the error without converting it into startup failure or false
   delivery success.
5. Preserve the single latest-value slot and all four native producer entries;
   do not create a queue, duplicate store, compatibility command or database
   record.

## Implementation and verification plan

1. Add positive native pending-state contracts for current read, exact
   acknowledgement and superseding-value preservation; replace both Tauri
   command registrations with the new contract.
2. Refactor the renderer bridge to synchronous installation, one reconciliation
   flight, conditional acknowledgement and Promise-aware cleanup; change the
   exact top-level call without disturbing neighboring user edits.
3. Update the focused non-UI bridge test for immediate browser cleanup and the
   Tauri reconciliation ordering/retention contract.
4. Run only the focused bridge test and focused Rust tests, then Overlay
   typecheck, production build/renderer-surface check, `git diff --check` and
   current document checks. Do not run any UI automation suite found under the
   touched Overlay test path.
5. If an isolated native runtime can be launched without the user's process,
   database, ports or window, manually inspect the real startup surface and
   connected renderer. Otherwise mark that visual/native evidence boundary
   explicitly rather than substituting a browser/static assertion.
6. Request mandatory independent read-only review, repair every valid finding,
   repeat affected verification, commit only owned hunks, merge upstream,
   inspect the full outgoing set and push.

## Verification and delivery evidence

### Automated positive contracts and checkers

| Verification | Result |
| --- | --- |
| `bun run --cwd packages/overlay test:unit test/expert-squad-install-handoff-bridge.test.ts` | Passed: 5 tests, 0 failures, 16 assertions. Covers immediate browser disposal, deferred Tauri listener registration, early teardown, stale-acknowledgement convergence to the latest pending value, and retrying the visible surface before acknowledgement after a controlled first failure. |
| `cargo test --manifest-path packages/overlay/src-tauri/Cargo.toml expert_squad_install_handoff_acknowledges_the_exact_current_receipt -- --nocapture` | Passed: 1 focused test, 57 filtered. The native slot retains a superseding receipt after stale acknowledgement and clears only the exact current value. |
| `bun run --cwd packages/overlay typecheck` | Passed. |
| `bun run --cwd packages/overlay build` | Passed: Vite production build and renderer public-surface checker. Existing third-party `use client`, mixed dynamic/static import and chunk-size warnings remain warnings. |
| `cargo fmt --manifest-path packages/overlay/src-tauri/Cargo.toml --check` and `git diff --check` | Passed. |
| `bun run docs:check` | Passed: 338 operations in 25 groups. |
| `bun run check:architecture-index` | Passed: 27 current architecture documents indexed with live links. |
| `bun run check:sdk-imports` | Passed. |

These are non-UI service/native contracts and repository checkers. No UI
automation source, Document Object Model assertion, component-rendering test,
browser fixture, Playwright test, screenshot baseline or pixel assertion was
added, modified or executed.

### Isolated native startup boundary

The real desktop startup was attempted only with isolated `OPENCORVUS_HOME`
directories and task-owned debug processes; the user's running OpenCorvus
process, listener, database and window were not stopped, refreshed or reused.
The task-owned processes exited and no task-owned acceptance process remains.

Successful native visual acceptance was not obtained. The current local
embedded Overlay server payload is incomplete. Rebuilding the current desktop
against an older complete archive payload produced a renderer-capable binary,
but that archived sidecar rejects the current native managed-server arguments
and the real window correctly reports backend startup failure. This is a test
artifact protocol mismatch, not evidence that the renderer reached healthy
initialization, and the failure window is not counted as visual acceptance.

Therefore the source-level startup/receipt contracts, focused native contract,
typecheck, build and repository checkers are verified; successful current-payload
desktop health and screenshot evidence remain unmet. Completing that evidence
requires a current, complete Overlay server payload compatible with the native
managed-server protocol. Regenerating it in this shared dirty worktree would
clean/rewrite a broad package build output and was not used as a workaround.
