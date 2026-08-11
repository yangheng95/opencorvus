# Windows glob, Mission recovery, and debug convergence

## Recall

On 2026-08-11 a Mission started normally, completed `mission_state` and
`capability_search`, then stopped while executing `glob("*")`. The Overlay
later projected the Session as idle, while the persisted Tool Part remained
`running`. The copied chat debug payload reported zero messages and tools even
though the database contained two messages and three Tool Parts. The selected
`squad-sdk` capability search also returned no matches.

The repair must preserve four existing authorities:

- process cancellation waits for physical exit, while output consumers wait
  for output settlement;
- a Mission is a durable root Session, not an `engine_task` surrogate;
- restart continuation is a visible, typed runtime-authored wake backed by
  persisted occurrence identity, never a hidden assistant message;
- Expert Squad visibility remains the immutable held snapshot intersected with
  the Mission `product_pillar`; diagnostics must not broaden that authority.

## Evidence and regression source

- The first bad commit is
  `6525973577a44edfdf4288594f3c1e15bde2a160` (2026-08-10 19:16:47 +08:00,
  `fix task control responsiveness and cancellation`), whose parent is
  `1accb1002055ab23d82969b12239f2bc48e1ba7f`.
- That change deliberately split `ProcessSupervisorHandle.exited` from
  `outputSettled`. The Windows spawn path attached a rejection observer only
  to `exited`; a rejected `outputSettled` therefore became an unhandled
  rejection when a consumer intentionally stopped reading stdout early.
- A live Windows reproduction iterating the first 101 results from
  `Ripgrep.filesForHost()` printed its success sentinel and then terminated the
  process with `Windows process supervisor stdout stream failed: The operation
  was aborted`. The same reproduction at the parent commit caught the expected
  abort and exited successfully.
- `glob` bounds its result set and exits `Ripgrep.files` early. The generator's
  cleanup waited for physical exit only, which is correct for liveness but left
  the separately rejecting output-settlement Promise unobserved.
- Host startup recovery enumerated only started incomplete `engine_task` rows.
  The interrupted work was a standalone Mission root Session before any child
  Task existed, so startup correctly printed `attempted=0` for its incomplete
  Task-only candidate set while omitting the Mission.
- `SessionLoop.terminalizeRecoveredIncompleteAssistant()` already owns the
  canonical persisted interruption failure, but no startup path invokes it for
  standalone Missions and no durable wake occurrence survives restart cuts.
- `buildChatDebugBlob()` counts rendered card-tree nodes and labels them as
  messages/tools. The existing Session message endpoint already exposes all
  persisted visible messages and Tool Parts, so no new public route is needed.
- `capability_search` already restricts results to the immutable held Expert
  Squad identifiers and the Mission product pillar. An empty query result is
  not evidence that this authority is wrong; the response needs enough counts
  and pillar metadata to distinguish held-snapshot, catalog, and query misses.

## Unified repair boundary

### Process settlement

Observe `outputSettled` immediately when the handle is created so a Windows
stream abort can never escape as an unhandled rejection. Direct output
consumers must still await and surface output settlement on normal completion.
The intentional early-termination path may consume that failure after physical
exit because truncation has already satisfied the caller's bounded-result
contract. This keeps cancellation liveness independent from inherited Windows
handles without hiding full-output failures.

### Mission process recovery

Host recovery must discover unarchived Mission Sessions that either contain an
incomplete assistant after their latest user message or carry a pending
Mission process-recovery Session Control occurrence. Before terminalizing any
assistant/tool state, persist that independent occurrence with the exact
interrupted assistant IDs plus the current attempt's wake message, Part, and
control-record IDs. Then:

1. terminalize pending/running Tool Parts through the existing canonical
   interruption helper;
2. persist or re-persist the same visible runtime-authored wake when no reply
   exists; after a settled error or newly interrupted reply, retain the
   occurrence, advance its attempt, and reserve new wake IDs;
3. run the normal Mission Session loop for that exact wake;
4. consume the occurrence only after a successful assistant reply is durable.

If startup finds that successful reply already complete, it consumes the
pending occurrence and does not wake again. A failed or interrupted reply
leaves the occurrence discoverable for the next attempt. Mission recovery joins Task project discovery at host
startup but reports its own attempted/woken/completed/failure counts.

### Persisted debug projection

The copy-debug action fetches the selected Session's full persisted visible
message history through the existing directory-scoped route. The payload shows
persisted message role counts and Tool Part state counts separately from the
rendered card projection. If the read fails, the copied blob says persisted
statistics are unavailable and includes the bounded reason; it never relabels
card counts as database truth.

### Capability-search diagnostics

Retain the existing held-snapshot and canonical Mission product-pillar filters.
Extend the search metadata with held count, visible catalog count, effective
product pillar, contradictory requested pillar when present, and result count
so a zero result identifies which boundary removed candidates without leaking
or silently authorizing an unheld package.

## Verification plan

- Add positive Process Supervisor tests for immediate output rejection
  observation, normal full-output failure propagation, and bounded Ripgrep
  early termination.
- Run a real Windows child-process reproduction that creates more than the glob
  limit, consumes the bounded result, prints a success sentinel, and exits zero
  without `unhandled rejection` or `uncaught exception`.
- Add database-backed Mission recovery tests covering incomplete Tool Part
  terminalization, stable attempt identity before a reply, new attempt identity
  after interrupted/failed replies, successful-reply deduplication, historical
  orphan exclusion, and Task-free startup discovery.
- Add pure debug-stat tests for persisted message roles and each Tool Part
  state, plus the explicit unavailable branch.
- Extend capability catalog tests for the diagnostic boundary without changing
  result authorization.
- Run focused non-User-Interface tests, package type checks, docs checks,
  generated-route checks if public schemas move, and `git diff --check`.
- After the first green verification, request one independent read-only Agent
  review, address findings, then repeat affected checks.
- Commit only files owned by this repair from an alternate clean index, inspect
  the exact upstream range, and push normally without disturbing concurrent
  staged or unstaged work.

## Acceptance state

Implemented and verified on Windows against the regression source above.

- Core recovery, process-settlement, and capability-search coverage passed:
  20 tests / 105 assertions.
- Overlay persisted-debug coverage passed: 4 tests / 9 assertions, followed by
  the Overlay TypeScript check.
- The repository TypeScript check passed across all ten packages.
- A live bounded Windows Ripgrep run returned 101 paths, printed
  `WINDOWS_GLOB_SURVIVED`, and exited zero without an unhandled rejection or
  uncaught exception.
- Repository documentation and whitespace checks passed.
- An independent read-only review exercised the recovery occurrence state
  machine, Session Control queue semantics, Windows stdout/stderr settlement,
  persisted-debug identity, and held-Squad authority. All blocking findings
  were addressed and the final review reported no remaining P1/P2 issue.
