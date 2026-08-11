# Debug bundle truth and runtime-settlement family audit

## Recall

The operator asked OpenCorvus to identify same-family bugs and robustness
design gaps after the Windows bounded-`glob` regression, then calibrate copied
debug information because the current payload is inaccurate and does not tell
the operator to paste it into an AI assistant for analysis.

The operator subsequently clarified the product boundary: directory-free and
anonymous temporary-project failures must not expose their varied underlying
directory symptoms. The debug-copy feature requires an open named Project and
must describe every unsupported temporary-project entry through that single
product-level requirement.

Acceptance requires:

- copied Chat diagnostics distinguish root-Session persistence, full
  Session-tree conversation persistence, and the local rendered-card snapshot;
- zero means a validated empty collection, never a transport, schema, identity,
  or partial-read failure;
- the copied bundle contains bounded, useful message/Tool lifecycle facts and
  explicit analysis instructions without copying raw Tool inputs or outputs;
- asynchronous collection cannot silently copy a previously selected Task or
  Session after the operator switches context;
- successful copy feedback explicitly tells the operator to paste the bundle
  into an AI assistant, and the copy gesture is discoverable even when usage
  data is absent;
- directory-free and canonical anonymous Project selections fail before any
  debug read with the same localized named-Project requirement;
- focused non-UI tests, type checks, documentation checks, real-page visual
  inspection, and an independent read-only Agent review pass before delivery.

Hard constraints read from `AGENTS.md`: preserve the dirty shared worktree,
write the plan before implementation, keep one fact source per claim, add
positive non-UI contract tests, do not add or run UI automation, visually
inspect UI changes on a real page, and stage only owned paths.

Read sources and call paths:

- `packages/overlay/src/main.tsx`
- `packages/overlay/src/components/App.tsx`
- `packages/overlay/src/services/session-debug.ts`
- `packages/overlay/src/utils/debug-info.ts`
- `packages/overlay/src/utils/debug-text.ts`
- `packages/overlay/src/services/conversation.ts`
- `packages/opencorvus/src/server/routes/session.ts`
- `packages/opencorvus/src/util/process.ts`
- `packages/opencorvus/src/file/ripgrep.ts`
- `packages/opencorvus/src/tool/grep.ts`
- `packages/opencorvus/src/engine/codebase-tools.ts`
- `packages/opencorvus/src/lsp/server.ts`
- `specs/current/architecture/07-panel.md`
- `specs/current/architecture/task-control-plane.md`
- `specs/records/2026-08/2026-08-11-windows-glob-mission-recovery-debug-convergence.md`

The independent Agent review ran after the first green verification. Its first
pass found malformed Part/time facts that could still look like zero, incomplete
free-text secret redaction, and missing button semantics on the keyboard-enabled
title. Those findings were repaired with stricter lifecycle validation, one
shared bounded clipboard redactor, negative contract tests, and an explicit
accessible button role/label. A final re-review of those repairs is recorded in
the acceptance state below.

## Evidence and root causes

### Copied Chat diagnostics use the wrong scope label

`loadPersistedChatDebugProjection()` currently reads only
`/session/{rootSessionID}/message`. The canonical Session conversation hydrate
route loads `Session.treeInProject()`, combines every Session's messages, sorts
them, enriches them, and returns the full visible `transcript`. A Mission with
child Agent Sessions can therefore have correct root counts but a much larger
persisted conversation tree. Labelling the root-only result `Persisted Session`
claims a scope it did not read.

### Plausible numbers survive malformed records

The current summarizer rejects a non-array response, but an array element with
missing `info`, missing `parts`, duplicate message identity, or an unexpected
Session identity is counted as an `other` message with zero Tool Parts. A
schema or projection defect can therefore become believable but false counts.

### Collection is not one owned snapshot

The Session path snapshots board/cards before awaiting the network but does not
revalidate the active selection after the await. It avoids mixing two Sessions
inside one blob, yet can copy the old Session after the title has switched to a
new one. The Task path captures `selectedSource`, awaits `loadBoard()`, then
formats whichever board is now installed without asserting the same Task.

The persisted endpoint and local renderer are inherently different revisions.
The bundle must record collection timestamps and label the renderer as a local
snapshot instead of presenting an atomic database/UI view.

### Counts alone are not diagnostic evidence

The current Chat blob omits incomplete-assistant counts, assistant finish/error
counts, Session-tree membership, and bounded recent Tool lifecycle rows. It can
say `tools.running: 1` without identifying the Tool Part, owning Session,
message, timestamps, or failure. Raw Tool inputs and outputs must remain
omitted because the bundle explicitly invites transfer to another AI system.

### Copy interaction does not complete the workflow

The only success feedback is the generic `Copied` string for 1.4 seconds. The
title tooltip is disabled when usage information is empty, so the double-click
gesture can be undiscoverable. Neither the UI feedback nor the bundle tells the
operator what to do next.

### Task activity time is narrower than its documented claim

`taskAgentActivity()` currently derives `task.activity.updated` only from
execution occurrences. The architecture says the timestamp includes the
invocation topology and task-scoped artifacts. This is another projection
label exceeding its actual source scope.

## Same-family robustness audit

The Windows supervisor repair now observes both wrapper and underlying
`outputSettled` Promises at creation, and bounded Ripgrep observes stderr at
creation. The remaining adjacent risks are different call sites of the same
general rule: every independently rejecting or backpressured process channel
must acquire its consumer before awaiting another lifecycle channel.

- `bun/registry.ts` and `bun/index.ts` await `Process.spawnHost().exited` before
  draining stdout and stderr.
- eleven LSP installer paths spawn with stdout/stderr pipes but await only
  `exited`; sufficiently large installer output can fill a pipe and prevent
  exit.
- `tool/grep.ts` drains stdout and then stderr sequentially; either pipe can
  block the other.
- `engine/codebase-tools.ts` drains stdout but does not consume stderr or
  `outputSettled` before disposal.
- raw `Process.spawnHost()` exposes independent close/error and output-stream
  channels without encoding the consumer-start invariant in its type.

These are confirmed design risks, but changing every installer and raw process
API would exceed the requested debug-calibration delivery and requires its own
bounded migration with process fixtures. This delivery records the family and
does not hide it behind the already-fixed Windows supervisor path.

Mission process recovery was independently reviewed after the first repair:
the durable occurrence, latest-user frontier, retry identities, Session Control
queue semantics, and old-success/new-interruption combination have no remaining
P1/P2 finding. Host-level aggregate recovery counting still lacks a dedicated
test, which is a coverage gap rather than evidence of another defect.

## Unified debug-bundle design

### Persisted Chat projection

Collect two explicit read planes in parallel through existing routes:

1. root raw messages from `/session/{id}/message`;
2. full visible Session-tree transcript plus persisted board identity from
   `/session/{id}/conversation`.

Each plane owns its own `available` or `unavailable` result, endpoint label,
collection time, validated statistics, and bounded recent lifecycle facts. A
failure in one plane remains visible without erasing a successful sibling.
Every message must carry unique non-empty identity, Session identity, role, and
a Parts array. The tree board and requested Session identities must match.

Statistics include message roles, incomplete/completed/error assistant facts,
Tool states, and Session membership. Recent Tool rows include only identity,
Tool name, state, timestamps, and bounded failure text. Raw inputs, outputs,
message bodies, credentials, and reasoning are intentionally excluded.

### Selection and renderer ownership

Capture the selected source identity and directory, perform persisted reads,
then assert that the active source is still the same before snapshotting and
formatting the local board/card tree. Task refresh follows the same rule. A
selection change returns an explicit retryable error rather than a stale blob.

Before those reads, resolve the selected source directory through the existing
canonical anonymous-Project classifier. A missing directory or dated anonymous
Project is outside this feature's supported scope and returns one localized
message: the feature requires an open named Project. Do not expose temporary
directory layout, trace-directory, or persistence-route details for that
unsupported scope. Named Projects retain the detailed identity checks below,
because those errors indicate real state disagreement rather than the product
scope boundary.

The selected source is canonical. Persisted board identity is validated by the
service. Local board identity is reported as a renderer observation and must
match before a Chat bundle is built.

### AI handoff

Every bundle starts with a schema/version, generation timestamp, scope, and an
`AI analysis request` that asks the receiving assistant to separate observed
facts from inference, reconstruct a timeline, identify the likely trigger and
root cause with confidence, and propose read-only next checks. It explicitly
states that unavailable data is unknown rather than zero.

After a successful copy, the title displays `Copied — paste into AI to
analyze` (localized) long enough to read. The title tooltip always exposes the
double-click debug-copy instruction and optionally shows usage as a separate
row.

### Task bundle calibration

Task collection validates the selected Task before and after refresh.
`task.activity.updated` takes the maximum real timestamp across execution
occurrences, invocation-topology nodes, task-scoped artifacts, and process
incidents. The bundle labels those sources and carries the same AI analysis
request and schema metadata as Chat diagnostics.

## Verification plan

- Extend pure debug tests with strict message validation, partial root/tree
  reads, Session identity checks, recent lifecycle facts, explicit unknown
  semantics, and the AI analysis request.
- Add a positive Task debug test proving topology/artifact timestamps contribute
  to the activity timestamp.
- Add a focused non-UI contract test proving a named directory is accepted and
  directory-free/canonical anonymous input maps to the one named-Project error.
- Run Overlay typecheck and focused non-UI tests only; do not add or run DOM,
  component, browser-fixture, or screenshot tests.
- Start the real Overlay page, invoke or expose the title feedback state, and
  visually inspect a screenshot for readable tooltip/copy guidance.
- Run repository typecheck, docs checks, route checks if contracts change, and
  `git diff --check`.
- After first green verification, request the mandatory independent read-only
  Agent review, address findings, and repeat affected checks.

## Acceptance state

Implemented and verified on 2026-08-11:

- `opencorvus.debug.v2` carries independently available root raw-message and
  visible Session-tree planes plus a labelled non-atomic renderer snapshot;
- malformed message/Part identity, unsupported Part/Tool state, missing real
  timestamps, duplicate Part identity, and cross-Session ownership now make the
  affected plane unavailable instead of manufacturing zero;
- every copied failure/error/title/reason prose field uses the same bounded
  secret redactor; raw message bodies and Tool inputs/outputs remain absent;
- missing-directory and canonical anonymous Project selections now raise one
  typed scope error before Task refresh or Session reads, and the Conversation
  title renders its localized named-Project requirement instead of the generic
  clipboard failure; the complete result is also available in the wrapping
  tooltip, dynamic accessible label, and polite live status; other integrity
  failures keep their detailed diagnostic path and generic UI state;
- the title is a keyboard-accessible button, its always-available tooltip says
  to paste the bundle into AI, and successful copy feedback repeats that next
  step for four seconds;
- a real built Overlay page connected to an isolated backend showed the Chinese
  tooltip and copy-success state; its clipboard payload contained one validated
  persisted user message in both root and tree planes, while the renderer plane
  correctly reported its independent local card counts;
- focused result after the named-Project follow-up: 9 tests, 44 assertions,
  0 failures; production Vite build, formatting, `docs:check`, and
  `git diff --check` passed;
- the focused Overlay typecheck passed after the final feedback-accessibility
  adjustment;
- visual acceptance for the new anonymous/directory-free failure state remains
  unresolved: the isolated production page was reachable but its Browser host
  blocked the local API, while the isolated Vite URL was blocked from Browser
  navigation. No screenshot is claimed for the new message;
- the independent read-only Agent's initial P1/P2 findings were repaired and
  sent through a final read-only re-review before delivery.
