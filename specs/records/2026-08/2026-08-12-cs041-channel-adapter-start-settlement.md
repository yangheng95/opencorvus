# CS-041 Channel adapter startup settlement

## Recall

### Requirement and acceptance

- Fix `CS-041`: a configured Channel adapter that rejects startup must not be published as running.
- The physical successfully started adapter set is the only authority for runtime receipts and managed supervisor status.
- Every rejected startup owner is explicitly stopped. A cleanup rejection remains owned for retry and fails the aggregate startup; zero successful adapters rolls back runtime resources.
- Use focused non-User Interface (UI) positive tests plus Channel runtime typecheck and exact diff checks. Do not publish, commit, delegate, or modify shared indexes.

### Hard boundary

- Task-owned implementation is limited to `packages/channel-runtime/**`, `packages/opencorvus/src/channel/supervisor.ts`, focused tests, and this record.
- Do not modify B02, Plugin, Model Context Protocol (MCP), Installation, Software Development Kit (SDK)/generated, Overlay/UI, transport protocol, or shared README/index files.
- Preserve unrelated dirty-worktree changes, including the pre-existing Channel runtime `pretest` package-script change.
- No compatibility result, configured-name status fallback, parallel running flag projection, or UI automation.

### Materials and repository search

- Read `AGENTS.md`, `specs/current/architecture/04-extensions.md`, the `CS-041` continuous-audit entry, Channel adapter interface/registry/runtime/standalone bootstrap, managed supervisor/registry/routes, direct adapter implementations, and existing runtime/adapter tests.
- `registerAdapters` returns configured names and pushes adapter instances into `ChannelRuntime`. Before this repair the same `adapters` array is overwritten with only fulfilled starts, so rejected instances disappear before `stop()` can own them.
- `_doStart()` uses `Promise.allSettled`, logs rejected starts, and resolves even when none started. The top-level `running` flag remains true and the server, event subscription, and pending watchdog remain live.
- `ChannelSupervisor` writes desired configured names into state before startup and, because `runtime.start()` resolves, publishes all of them as active through `/channel/runtime`, the Channel registry and gateway statistics.
- Standalone `main.ts` likewise prints every configured name and then an aggregate running message without consuming a physical-start receipt.
- Telegram detaches the long-poll start promise before authentication readiness; Matrix suppresses `whoami` authentication failure; Signal launches its receive loop before observing one successful service response. These `start()` implementations cannot currently serve as physical readiness receipts.
- Public schemas already accept an arbitrary channel-name array and aggregate detail string. Returning only physically started names needs no route, SDK, generated, or migration change.

### Root cause and impact

The runtime has no startup settlement object. Configured candidates, physical owners, and public active names are projected from different mutable facts. A rejected adapter is removed from the only cleanup collection, while the supervisor retains its configured name. Consequently control surfaces can report unavailable integrations as active, and a partial startup that acquired resources before rejection can become unowned. A zero-success runtime also keeps unrelated server/watch resources alive.

## Design

1. Keep configured adapters as immutable startup candidates and keep a separate collection containing only adapters whose `start()` fulfilled. `adapterCount`, message routing, the returned startup receipt and later stop operations all read the physical collection.
2. For each rejected start, immediately call `stop()`. Successful cleanup produces a typed failed receipt. Failed cleanup is retained in a pending-owner set and makes aggregate startup fail. `stop()` retries both active and pending owners and removes each only after successful settlement.
3. `start()` returns `{ channels, failedChannels }`. A clean partial startup may remain active with only successful channel names. Zero physical successes (when candidates existed), or any unsettled cleanup owner, fails and invokes full runtime rollback before propagating.
4. Managed supervisor assigns `current.channels` only from the startup receipt, derives its running detail from that same receipt, and never substitutes desired configured names. Standalone bootstrap logs the receipt and rejects zero-success through the runtime contract.
5. Make adapter `start()` mean initial physical readiness: Telegram resolves after grammY `onStart`, Matrix requires `whoami`, and Signal requires one successful receive response before launching its retry loop.

## Positive verification

- A runtime with one successful and one rejected adapter returns only the successful platform, routes through only that owner, and records the failed owner's successful stop.
- A runtime with zero successful candidates rejects after stopping the failed adapter and closing its server/watch resources; its active set is empty.
- A rejected adapter whose first stop fails is retained and retried during aggregate rollback; no failed owner is discarded.
- Supervisor uses the exact receipt channel list for state and detail; configured names appear only in failure diagnostics, not active status.
- Telegram authentication rejection, Matrix identity rejection, and Signal initial receive rejection propagate from `start()`; their focused existing tests are updated only where readiness mocking requires it.
- Run the focused Channel runtime tests, Channel runtime typecheck, and exact task-owned diff check. Independent delivery review is pending assignment by the primary agent.

## Implementation verification

- `bun test --timeout=0 test/start-idempotency.test.ts test/telegram-adapter.test.ts test/mainstream-adapters.test.ts` from `packages/channel-runtime`: passed, 36 tests / 142 assertions.
- The startup-settlement cases use the production `ChannelRuntime.start()` path and assert a mixed physical receipt, rejected-owner settlement, zero-success server rollback, and cleanup-owner retry. Adapter tests assert Telegram authentication, Matrix identity, and Signal receive readiness failures through their real `start()` methods.
- `bun run typecheck` from `packages/channel-runtime`: passed.
- `bun test --timeout=0 --preload ./test/preload.ts test/channel-supervisor-start-receipt.test.ts` from `packages/opencorvus`: passed, 1 test / 2 assertions through the real supervisor/runtime/adapters.
- `bun run typecheck` from `packages/opencorvus`: attempted; blocked only by concurrent non-task file `src/memory/project-memory-organizer.ts:290` (`signal` absent from the occurrence type). The task-owned supervisor and focused test report no type error.
- Exact task-owned `git diff --check`: passed. The pre-existing `packages/channel-runtime/package.json` change is excluded from this batch; no forbidden-path diff is owned by this work.
- First independent delivery review found that Signal's non-empty readiness response could arrive while the adapter was still only a candidate, so `handleMessage()` discarded it before the physical active set was published. It also required a production-path supervisor receipt projection test.
- The repair gives every candidate an ordered startup buffer. Rejected owners discard their buffer; fulfilled owners queue buffered messages before admission, then chain live messages behind that queue. `this.adapters` is established before delivery, so the physical active set remains the only dispatch authority.
- A real managed-supervisor test starts Matrix and Signal together, admits Matrix, rejects Signal readiness, and positively verifies the receipt-backed `sync`, `channelStatus`, and `handles` projections before a clean disable settlement.
- Second independent review found that waiting for every sibling start before admission let one hung candidate extend another ready candidate's buffer without bound. Fulfilled candidates now publish themselves immediately in configured order and drain their short readiness buffer while aggregate receipt settlement still waits for every candidate. A 1,000-message hard bound turns startup overload into an explicit rejected owner and cleanup receipt instead of silent loss or unbounded memory. Positive tests prove a ready adapter continues delivering while its sibling remains deferred and prove overload rejects/cleans the candidate with no published active channel.
- Third independent delivery review: PASS. It confirmed immediate per-owner admission, ordered buffer-to-live delivery, configured-order aggregate receipt, explicit bounded-overload rejection/cleanup, Signal initial delivery, and supervisor receipt projection with no remaining blocker.
- UI automation, external publication, and commit were not run.
