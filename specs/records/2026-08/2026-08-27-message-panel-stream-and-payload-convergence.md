# Message panel stream and payload convergence

Date: 2026-08-27

## Recall

### User request

- Inspect why the message panel feels laggy.
- Repair it systemically; do not exchange one local symptom for another.

### Acceptance criteria

- Selecting a Task performs one conversation hydrate and does not immediately
  schedule a second tail hydrate when no Message or Part changed.
- Ordinary Message/Part streaming uses one exact live projection path. It does
  not query the recursive Task Session tree for every token or persist a second
  coarse `task.messages.changed` authority.
- First connect, reconnect, process restart, replay expiry, Task/Mission/Session
  selection, normal completion, retry, rewind, parallel child Sessions, and
  Project isolation all converge through the existing hydrate/snapshot plus
  bounded live-replay contract.
- Hydrate, history, connection-snapshot, child-session and live-event responses
  do not eagerly transport completed large Tool output or non-rendered Reasoning
  text. Expanding a Tool reads its exact canonical persisted Part on demand.
- The persisted Message/Part and Tool fact tables remain the sole content
  authority. The transport projection is explicitly bounded and never becomes
  a second durable state source.
- Focused positive backend contracts, affected package typechecks, production
  build, API/routes/document checks, and one isolated real page with manually
  inspected screenshots pass.
- A previously uninvolved agent performs the required read-only delivery review
  after the first complete validation; all valid findings are repaired and
  rechecked before commit.

### Hard constraints

- Preserve every unrelated staged, unstaged, deleted, and untracked change in
  the shared `v0.0.55beta` worktree.
- Do not stop, restart, refresh, or otherwise manipulate the user's running
  application. Runtime acceptance uses an isolated server and page.
- Do not add, modify, or run User Interface (UI) automation tests. UI acceptance
  is real-page interaction, screenshots, and manual review only.
- Keep one current implementation and one fact source: no watermark fallback,
  compatibility branch, hidden/synthetic message, or second rendered tree.
- All Language Model interactions remain streaming; Provider credentials are
  outside this repair.

### Sources read

- `AGENTS.md`
- `specs/current/architecture/07-panel-reactivity.md`
- `specs/records/2026-06/2026-06-06-overlay-live-efficiency-safe-fix.md`
- `specs/records/2026-06/2026-06-27-bug-hunt-residual-convergence.md`
- `specs/records/2026-07/2026-07-30-overlay-runtime-efficiency-root-repair.md`
- `specs/records/2026-08/2026-08-19-overlay-performance-investigation.md`
- `specs/records/2026-08/2026-08-19-overlay-projection-incremental-p0.md`
- `specs/records/2026-08/2026-08-26-session-stream-message-cutover-convergence.md`
- Task and Session conversation routes, Protocol Store live replay, Message
  bridge, Message Store, Task-root Message movement, Overlay selected-source
  cursor/event/conversation writer, virtualized Conversation, and Tool renderer.

### Whole-repository search results

| Boundary | Result and disposition |
| --- | --- |
| Message/Part writes | Production writes converge on `Session` Message/Part writers; Task-root movement performs its direct SQL move inside one transaction and publishes `message.moved`. Tool request/outcome facts project through the same Part-updated boundary. Direct database mutation is not a supported competing transport. |
| Task selected stream | Hydration supplies persisted content; the selected Task stream supplies bounded exact `message.*` replay with an epoch and explicit `task.live_replay_expired`. The client already tail-snapshots before reopening after expiry. The two-second recursive watermark poll is therefore a duplicate recovery authority. |
| Session selected stream | The public Session stream subscribes before reading its bounded canonical snapshot and buffers live events until `session.connected`; process/project lineage admission is canonical. Preserve this path and apply only the shared bounded content projection. |
| Mission | Mission Tasks use the Task aggregate; standalone Mission Sessions use the Session aggregate. No Mission-local Message refresh mechanism is required. |
| Rewind/retry/restart | Rewind invalidates the Task projection through persisted facts; retry emits new exact Message events. A live epoch mismatch or replay expiry requires a canonical tail snapshot before reconnect, not a time watermark guess. |
| Renderer | `tree-writer.ts` is the sole Card Tree writer. The virtualizer mounts only a small visible window and preserves content-only row identity; it cannot avoid the network transfer, JSON parse, validation and full reset caused before mount. |
| Large payload | Completed Tool output is normally collapsed, while Reasoning is not message-card display content. Both are nevertheless included in every hydrate/history/snapshot. A project-scoped exact Part read can supply the canonical Tool state only when its disclosure is expanded. |

### Baseline evidence

- Isolated real Task selection returned a 3,138,045-byte conversation payload in
  638 ms, then a false `task.messages.changed` emitted immediately after stream
  connection forced a second 1,145,559-byte payload in 526 ms.
- A second large Task returned 3,567,239 bytes for an 80-message tail and
  2,463,683 bytes for a 32-message tail; response latency remained 0.80/0.77 s.
- One measured response spent 2,701,234 bytes in transcript data. Tool Parts
  contributed 2,046,355 bytes and Reasoning Parts 285,374 bytes.
- The real page mounted only 5–7 virtual rows, about 2,345 DOM nodes, and had no
  console errors. Static scrolling was responsive after the duplicate request
  settled.
- `taskMessageWatermarkCursor()` averaged about 1.30 ms on the copied runtime
  database, but the Task stream invokes it for every live Message event,
  including every `message.part.delta`, and again every two seconds.

### Independent agent feedback

- No independent agent participated in implementation. The mandatory first
  post-validation review found four valid gaps: live Reasoning deltas/removals
  were not classified with enough type information to omit the complete
  sequence; the Tool projection still spread unbounded title/attachments; lazy
  expansion read the whole parent Message repeatedly; and output byte equality
  alone could miss other Tool-state drift.
- The repair now carries `partType` through delta/removal facts and omits the
  complete Reasoning sequence, constructs one explicitly bounded Tool-state
  shape, reads one exact persisted Part, verifies exact state bytes plus
  SHA-256, and caches the verified resource by exact identity/digest.
- The final re-review then found that the first exact-Part route still called
  `MessageStore.get` and therefore loaded every sibling Part internally. The
  query was moved into `MessageStore.part`, which validates the parent
  Session/Message and queries only the requested `PartTable` or
  `ToolPartRequestTable` row before projecting that Tool's outcome/progress.
  After the focused rerun, the reviewer reported `no unresolved findings`.

## Problem depth and impact

### Observable behavior

Opening a populated Task blocks on a multi-megabyte hydrate and then immediately
repeats much of that work. During live output, the backend repeatedly scans the
Task Session tree while the Overlay is already applying the exact same Message
events. The combined network, JSON, validation, allocation, store reset and
virtualizer remount work presents as panel jank.

### Direct triggers

1. The client sends only `after_message_watermark`. The server initializes the
   same-watermark signature to an empty string, compares it with the canonical
   non-empty signature, and emits a false `task.messages.changed` on connect.
2. `markLiveMessageSeen()` calls the recursive cursor query for every Message
   event, including per-token deltas.
3. Every coarse change resets and rebuilds the entire latest Task tail.
4. Every transcript response eagerly serializes collapsed Tool output and
   Reasoning text that the main card surface does not initially render.

### Data and control-flow root cause

The selected Task stream has two authorities for the same change: exact bounded
live Message events and an independently derived timestamp/signature watermark.
The derived path is incomplete (it does not cover the separate Tool fact tables),
expensive (recursive tree scans and full JSON signatures), and cannot initialize
its same-millisecond signature from the numeric client cursor. The Overlay then
maps the coarse fact to a full snapshot rebuild, multiplying the duplicate
authority into visible work.

The content transport independently treats persisted runtime detail as though
every byte were first-paint display data. Collapsed Tool disclosures and hidden
Reasoning therefore pay transport and parse cost before the operator requests
them.

### Why earlier repairs did not cure it

- The July efficiency repair recorded exact Message live replay as the primary
  path but retained the database-only poll. The current implementation still
  queries that poll cursor on every exact event and does not transmit the
  signature required to prevent the initial false comparison.
- Incremental Card Tree publication eliminated whole-tree work per visible Part
  update but does not reduce HTTP payloads or a deliberate tail `resetWriter`.
- Virtualization limits mounted DOM rows only after the payload has already been
  transferred, parsed, validated and projected.
- Reducing `tail_limit` cannot bound one recent large Tool result and currently
  does not reduce the server's internal minimum transcript read below 80.

## Decision

1. Delete the Task message-watermark query/poll/SSE query parameter and
   `task.messages.changed` client branch. The exact Task live-replay sequence and
   epoch become the only live Message cursor. Replay expiry already requires the
   canonical persisted tail snapshot before reopen.
2. Keep Task/Mission/Session ownership unchanged. Task-backed Mission output uses
   Task live replay; standalone Session/Mission output uses the typed
   subscribe-before-snapshot handshake.
3. Add one shared conversation transport projection. It omits Reasoning Parts
   and replaces completed Tool state above a byte limit with an explicit
   deferred marker containing exact state/output byte counts and SHA-256 plus a
   bounded chip-summary input. Small Tool state and all identity/order fields
   stay intact; the full input, output, metadata and attachments remain
   canonical in persistence and are read together when the disclosure opens.
4. Apply that projection to Task/Session hydrate, history, connection snapshots,
   child-session pages and exact Message/Part SSE payloads. Persisted facts and
   provider-facing Message reads remain full and unchanged.
5. When an expanded deferred Tool body mounts, read its canonical Part through
   the project-scoped exact Session/Message/Part endpoint, verify the identities,
   serialized state bytes and SHA-256, and render that exact Part. Cache at most
   128 verified requests by Project/Session/Message/Part/digest so a collapse and
   reopen does not repeat I/O. The value is a display resource, not durable state
   or a second tree writer.

## Implementation sequence

1. Remove the duplicate Task watermark contract end to end and update the
   current architecture/API closure.
2. Add and positively test the shared bounded conversation transport projector.
3. Apply it to every Task/Session snapshot and live event production entry.
4. Add the on-demand Tool Part reader to the disclosure renderer without new UI
   automation or new styling.
5. Run focused contracts, package checks, build and docs; benchmark the copied
   real database and manually inspect an isolated real page plus expanded Tool.
6. Obtain the required independent read-only review, repair all valid findings,
   rerun affected acceptance, commit only owned files, merge upstream and push.

## Verification plan

- Focused backend tests prove a Task stream emits exact Message/Part events,
  reconnect live replay and replay-expiry snapshot recovery without a coarse
  second event.
- Pure transport tests prove large completed Tool output becomes a deferred
  marker, small output remains inline, Reasoning is removed, and identities,
  order, failures, attachments and all other visible Parts remain exact.
- Existing Session cutover and Project-isolation route contracts remain green.
- Typecheck `transport-protocol`, `opencorvus`, and `overlay`; build Overlay.
- Run root `api:routes-check`, `docs:check`, and the current document health
  checks from the repository root.
- Against the copied runtime database, record payload bytes and timings for the
  same Tasks used in the baseline. Then open an isolated real Overlay page,
  select a populated Task, expand a deferred Tool, inspect the final content,
  network sequence, console and screenshot manually.

## First complete validation

- Focused positive contracts: 21 passed across the new shared transport
  projector, exact Part route, Task projection identity, Session connection
  snapshot, Mission root Message read and Task live replay/expiry suites.
- Typechecks passed for `transport-protocol`, `opencorvus` and `overlay`.
  Overlay production build passed with 7,117 transformed modules and the
  renderer public-surface checker passed.
- `api:routes-check`, `docs:check` (`337 ops`, `25 groups`) and
  `check:sdk-imports` passed after regenerating the SDK contract.
- On the same copied runtime database, the 80-message Task payloads changed
  from 3,138,045 to 1,246,102 bytes and from 3,567,239 to 1,302,527 bytes. The
  responses contained zero Reasoning Parts and 103/71 deferred Tool Parts. The
  server still reads canonical full rows before projection, so measured route
  latency remained database-bound at 0.53/0.62 s in the final run; the avoided browser-side
  transfer/parse/reset work is the material improvement.
- After the typed `task.connected` cutover, a four-second settled Task SSE
  observation produced no further event; the former immediate
  `task.messages.changed` and second tail hydrate did not occur.
- The deferred marker for one sampled Part reported 7,547 output bytes and
  8,586 state bytes. The exact Part read returned the same
  Session/Message/Part identity, byte counts and SHA-256 digest in 16 ms. After
  the query-layer correction, the same isolated route again returned the exact
  7,547/8,586-byte state and digest through `MessageStore.part`.
- The isolated real Overlay loaded the large Task, rendered its Tool disclosure
  summaries, and expanded `artifact_read` into the full persisted payload. The
  server recorded one corresponding exact Part GET; collapse/reopen retained
  the full content and emitted no second Part GET. The page was visually
  inspected by screenshot. Background composer catalog calls
  in this copied runtime reported missing immutable Expert Squad snapshots;
  that clone-specific catalog data was outside the message-panel path and did
  not prevent conversation or deferred Tool acceptance.
- No UI automation test was added, modified or run.
- Final independent read-only review: no P0/P1/P2/P3 findings remained. It
  verified the complete Reasoning sequence, explicit Tool bound, exact
  persistence query, 128-entry failure-evicting identity/digest cache, generated
  API closure, Task/Mission/Session recovery paths and Project isolation.
