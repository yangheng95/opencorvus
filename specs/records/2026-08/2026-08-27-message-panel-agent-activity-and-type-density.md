# Message panel Agent activity and type-density convergence

Date: 2026-08-27

## Recall

### User request

- Child-Agent thumbnail cards remain on “no activity” for a long time and feel
  severely delayed.
- The message panel typography has become unexpectedly large and materially
  harms the visual result.
- Repair the shared causes; do not trade one local symptom for another.

### Acceptance criteria

- A visible Text stream updates the owning child-Agent occurrence card from its
  exact `message.part.delta` facts instead of waiting for the terminal full Part.
- Full Part updates, Part removal, and Message removal converge the same bounded activity item or execution occurrence;
  Reasoning remains excluded, and no synthetic Message or second durable state
  source is introduced.
- Task-backed Mission, ordinary Task, and standalone Session streams keep their
  existing aggregate ownership while sharing the same selected-conversation
  event projection. Retry/restart/replay recovery still converges from persisted
  Parts, and repeated physical Sessions remain partitioned by input-Message
  execution occurrence.
- Historical child-Agent activity hydration performs work bounded primarily by
  visible Part types/pages, rather than multiplying the query count by every
  execution occurrence, while preserving exact per-occurrence ordering and the
  24-item contract.
- Message prose returns to the body scale and card identity remains a modest
  title scale through canonical typography tokens/semantics, at `--ui-scale=1`.
  The repair must not add a child-card-only font override.
- Focused positive non-UI contracts, affected typechecks, production build,
  root checks, isolated route timing, and a manually inspected real-page
  screenshot pass.
- A previously uninvolved Agent performs the required final read-only review.

### Hard constraints

- Preserve all unrelated staged, unstaged, deleted, and untracked work in the
  shared `v0.0.55beta` checkout.
- Do not restart, stop, refresh, or manipulate the user's application. Use only
  the already isolated server/page for runtime acceptance.
- Do not add, modify, or run UI automation tests. Visual acceptance uses the
  real Overlay and manually inspected screenshots.
- Persisted Message/Part and Tool facts remain the sole content authority.
  Live delta accumulation is an ephemeral view projection of those real events.
- Keep Language Model interaction streaming; visible Reasoning is not restored.

### Sources read

- `AGENTS.md`
- `specs/current/architecture/02-data.md`
- `specs/current/architecture/07-panel.md`
- `specs/current/architecture/07-panel-reactivity.md`
- `specs/current/architecture/12-overlay-card-system.md`
- `specs/records/2026-08/2026-08-26-session-stream-message-cutover-convergence.md`
- `specs/records/2026-08/2026-08-27-message-panel-stream-and-payload-convergence.md`
- Message bridge, Task/Session event routers, Card Tree writer, conversation
  Agent store, compact activity projector, Message Store activity hydration,
  child-Agent progress renderer, typography tokens, message-card CSS, and
  persisted Overlay settings.

### Whole-repository search results

| Boundary | Result and disposition |
| --- | --- |
| Task stream | The selected Task stream already carries exact enriched `message.part.delta` events. The Card Tree consumes them, but the child-Agent activity store consumes only `message.part.updated`. Add the missing projection at the existing selected-stream writer; do not add polling. |
| Mission | A Task-backed Mission selects the Task aggregate and therefore shares the same fix. A standalone Mission Session uses the Session aggregate, whose selected events enter the same Overlay message writer. No Mission-local activity channel is required. |
| Session occurrence | One physical Session may own several input-Message executions. Both live and hydrated activity must resolve through `sessionID + messageID/inputMessageID`, never a latest-session shortcut. |
| Retry/restart/replay | Deltas are intentionally ephemeral. Initial/reconnect/restart state comes from canonical persisted full Parts; retained deltas re-anchor through the Card Tree's exact hydrated Part, or the exact occurrence activity when the compact projection is the available authority. |
| Parallel/Project isolation | Each selected source key and project-owned database instance already isolate the store and route. New ephemeral Part state must be source-scoped and bounded; hydration queries stay inside the current Instance database. |
| Message removal/move | `message.removed` can delete an assistant Message or an authoritative input Message without individual Part removal events, so live activity must mirror exact Part ownership and remove the whole occurrence for an input deletion. Repository-wide production search found `message.moved` has one emitter, the Mission root user-Message transfer into its orchestrator Session; both source and target are `main` conversation participants and are intentionally excluded from child activity. |
| Historical activity | `latestConversationAgentActivityByExecution` currently performs up to eight paged SQL scans independently for every execution and then performs Tool projection reads. Real copied Tasks with 10 and 19 occurrences took about 0.92 s and 0.88 s to hydrate. Replace the occurrence multiplier with set-based, occurrence-partitioned pages. |
| Typography | Persisted zoom is `1.0`, computed `--ui-scale` is `1.000`, and packaged Geist/Noto fonts are active. The actual message paragraph computes to 17 px because `.chat-bubble-row ... .msg-text` assigns `--ui-font-title`; body and activity text compute to 14 px. The Aug-24 type-scale change raised title from 15 px to 17 px, exposing the semantic misuse. |
| UI tests | Existing UI automation in touched areas is not required for this repair and will not be run. Store/transport/database contracts are non-UI tests; visual acceptance remains manual. |

### Independent Agent feedback

- No Agent participated before implementation.
- The mandatory post-validation read-only reviewer found and reproduced the
  following cross-path defects in the first implementation: main-channel deltas
  entering child activity; reconnect deltas lacking an initial live snapshot;
  per-token activity writes bypassing the existing coalescing principle;
  Message/input removal leaving stale activity or a ghost execution; both SQL
  `VALUES` stages exceeding SQLite's bind limit at larger occurrence counts;
  and Card Tree tail state being unable to authoritatively identify a removed
  Message's older Parts. The reviewer also found that globally lowering the
  title token would affect dozens of unrelated title consumers, and rejected an
  unbounded `partIDs` array on `message.removed`. All findings were accepted:
  activity items now carry their bounded owning `messageID`, removal events
  carry canonical Message `info`, and final re-review is recorded after
  validation below.

## Problem depth and impact

### Observable behavior

A running child Agent can show “Waiting for activity…” throughout a long
text-only answer and update only when the runtime persists and emits the full
Text Part. Selecting a populated historical Task also waits close to one second
for activity hydration. In the main conversation, ordinary prose occupies the
17 px title rung with a 28.56 px CJK line height, producing a visibly oversized,
low-density panel even though application zoom is normal.

### Direct triggers

1. `writeSelectedMessageToTree` forwards Part updates to the child-Agent store
   but deliberately skips Part deltas for its transcript sequence and never
   applies their visible content to activity.
2. The initial empty Text Part is correctly not renderable activity, but its
   identity/order snapshot is also discarded, so later deltas cannot project
   the same canonical item without waiting for the completed Part.
3. Hydration loops `execution occurrence × visible part type × page`, producing
   query amplification as parallel/reused child Sessions accumulate.
4. A message-card selector assigns the global title token to prose. The later
   title-scale increase made that earlier semantic mismatch highly visible.

### Data and control-flow root cause

The Card Tree and the child-Agent progress grid diverge after the selected event
router: both receive the same real stream, but only the Card Tree owns a delta
accumulator. The progress store treats a full Part update as the only activity
fact, even though the transport contract now supplies visible Part type and the
preceding Part snapshot carries its stable order key. Historical projection then
reconstructs correct facts through repeated occurrence-local queries rather
than a set-wise occurrence partition.

The typography issue is similarly a semantic-source problem: message prose is
bound to `title`, so changing the canonical title hierarchy changes body copy.
It is not caused by zoom, missing fonts, theme, or a child-card rule.

### Why earlier work did not cure it

- The preceding message-panel repair removed duplicate hydrate authority and
  oversized Tool/Reasoning payloads. It preserved Text deltas for the Card Tree
  but did not add them to the separate bounded Agent-progress projection.
- Existing Part-delta buffering prevents Card Tree render storms; it does not
  update the progress-card store.
- The current activity query is logically correct per occurrence, so completed
  examples eventually display activity, but its N-by-type shape delays first
  presentation and hides the live gap once hydration finishes.
- The Aug-24 typography commit intentionally strengthened the title rung. Its
  repository analysis classified title consumers but missed that the message
  transcript selector applies the token to prose paragraphs.

## Decision

1. Keep the selected message router as the sole live ingress. Add one ephemeral,
   source-scoped Part snapshot/delta projection in the conversation-Agent store.
   The initial Part update records exact identity and order; visible Text deltas
   update the same bounded activity item through a 50 ms coalesced flush; the
   completed Part replaces it; Part and Message removal delete exact ownership.
   Main-channel and user participants remain excluded. Reasoning remains omitted
   by transport.
2. Resolve every live update/removal against the exact execution occurrence via
   `sessionID + messageID`, preserving reused Session and parallel child
   isolation. Re-anchor retained/reconnect deltas from the exact hydrated Card
   Tree Part, then from matching compact occurrence activity. Clear ephemeral
   Part snapshots at source reset and bound their count. Deleting the occurrence
   input Message removes that occurrence, not its physical Session peers.
3. Replace per-execution activity scans with set-based pages partitioned by
   execution occurrence for each visible Part type. Chunk both Message-scope
   and Part-scope `VALUES` inputs at 64 occurrences, merge and globally order
   the results per occurrence, and continue paging only occurrences that have
   not produced 24 valid projected items. This preserves corruption, empty-Part,
   and cross-chunk cursor semantics without exceeding SQLite's bind limit.
4. Keep the audited global title rung at 17 px. Restore both expanded message
   prose and collapsed prose previews to `--ui-font-body` at 14 px. This fixes
   the two semantic misbindings without changing unrelated title consumers or
   adding a child-card-only override.

## Implementation and verification sequence

1. Add positive store contracts for live empty-Part → Text delta → completed
   Part convergence and exact removal within reused Session occurrences.
2. Add positive Message Store contracts for multiple Sessions, multiple
   occurrences in one Session, ordering, filtering, and 24-item bounds; implement
   set-based paged hydration.
3. Apply the shared event-router and typography corrections.
4. Run only focused non-UI tests, affected package typechecks, Overlay production
   build, API/routes/document checks, and copied-runtime route timing.
5. Inspect the isolated real Task page at `--ui-scale=1`, record computed styles,
   and manually review screenshots of the conversation and child-Agent cards.
6. Obtain the required independent read-only review, resolve all valid findings,
   rerun affected acceptance, commit only owned paths, merge upstream, inspect
   the complete outgoing set, and push.

## Verification evidence

### Contract and build checks

- `bun test packages/transport-protocol/test/contract.test.ts packages/transport-protocol/test/source-message-parts.test.ts`: 26 passed, 0 failed with 1,138 assertions. The public compact-activity projection now requires and preserves the owning `messageID` for every visible activity variant.
- `bun test packages/overlay/test/conversation-agent-live-activity.test.ts packages/opencorvus/test/conversation-transport-projection.test.ts`: 14 passed, 0 failed. These positive non-UI contracts include delegated/main separation, coalesced live convergence, reconnect anchoring, exact Part/Message removal beyond the bounded Card Tree tail, and reused-Session occurrence deletion.
- `bun test packages/opencorvus/test/session/message-store-conversation-activity.test.ts`: 1 passed, 0 failed with 7 assertions and a 60-second test budget for its real temporary Git project and database setup. The 65-occurrence case crosses both SQL chunk boundaries and completed in 3.87 seconds in the final main validation run (15.87 seconds in the independent reviewer's loaded-worktree run).
- `bun run --cwd packages/transport-protocol typecheck`: passed.
- `bun run --cwd packages/overlay typecheck`: passed.
- `bun run --cwd packages/opencorvus typecheck`: passed after the unrelated
  concurrent process-abstraction work converged.
- `bun run --cwd packages/overlay build`: passed from both the shared checkout and an exact copied source tree; 7,117/7,118 modules transformed respectively, followed by a passing renderer-public-surface check.
- `bun ./packages/sdk/js/script/build.ts`: generated the final OpenAPI/SDK
  closure from a clean `HEAD` copy plus only this task's public schema edits;
  the generated diff contains canonical removed-Message `info` and bounded
  activity `messageID` ownership without unrelated worktree schemas.
- `bun run docs:check`: passed with 337 operations and 25 groups.
- `bun run api:routes-check`: final rerun passed with 6 rules across 34 files.
- `bun run check:sdk-imports`: passed.
- `bun run check:architecture-index`: passed for 26 architecture documents.
- `git diff --check` over the owned paths: passed.

### Real page and performance evidence

- Before the typography correction, the real page computed `--ui-scale: 1.000`,
  body text at 14 px, and message prose at 17 px with a 28.56 px line height.
  Packaged Geist and Noto Sans SC were active, excluding zoom and font fallback.
- After the correction, the final isolated production-built page computed
  `--ui-scale: 1.000`, message prose at 14 px with a 23.52 px line height, the
  global title token at 17 px, child-card base/title text at 14 px, and the
  deliberately compact visible activity rows at 12 px/18 px. Packaged Geist and
  Noto Sans SC remained active. Manual screenshot inspection showed two
  child-Agent cards populated with multiple real activity rows and a denser
  transcript. No UI automation was run.
- The two final copied-runtime payloads were 1,249,066 bytes with 76/76 activity
  items carrying `messageID`, and 1,306,817 bytes with 110/110 owned items.
  Three quiet samples were 2.32-2.93 seconds and 2.53-3.72 seconds respectively
  under concurrent worktree load. The size increases over the old projection
  were 2,964 and 4,290 bytes. Exact deletion ownership is structurally bounded
  to at most one `messageID` per retained activity item, hence at most
  `24 × visible execution occurrences`; it does not reintroduce the unbounded
  Message-Part payload rejected during review. The overall route remains
  database/payload-bound, so this evidence does not claim a dramatic endpoint
  latency reduction; the user-visible live gap is removed by the event path.

### Final independent re-review

- The uninvolved read-only reviewer returned `no unresolved findings` after
  checking the complete diff, generated OpenAPI/SDK closure, spec, focused
  tests, typechecks, root checks, final copied-runtime payload evidence, and
  production-page manual acceptance. P0/P1/P2/P3 findings are all empty. The
  reviewer did not modify files and no UI automation was run.

### Acceptance boundary

The visible live-gap repair is proven through the real selected-stream contract,
positive store projection tests, production build, and real-page inspection of
the resulting card state. No real Provider credentials were used, so a fresh
Provider-generated token stream was not recorded during this acceptance. The
canonical persisted-Part hydrate/restart path remains the source of recovery;
live deltas are deliberately ephemeral and do not create a second durable fact.
