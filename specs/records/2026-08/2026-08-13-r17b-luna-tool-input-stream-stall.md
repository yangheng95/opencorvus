# R17b Luna tool-input stream stall

## Recall

- User requirement: execute the Work-mode random Expert Squad evolution end to end with an isolated random project,
  home, SQLite database and port; copy canonical OpenCorvus authentication into the isolated runtime; use exact
  `openai/gpt-5.6-luna`; install the randomly selected target and Evolution Lab from the real page; independently
  review SQLite, generated Artifacts, documents and rendered output; investigate every failure to its shared boundary.
- User correction: delivery must be staged. A failed live run is frozen and recorded first; one root repair, its
  focused positive tests, independent review, commit and push form a separate phase; only then may a fresh E2E start.
- Acceptance: the repair phase must make an unowned provider tool-input delta unable to extend semantic LLM activity,
  discard the abandoned pending Tool draft through the existing retry authority, and persist the recovered attempt's
  exact output. The final product acceptance still requires a fresh exact-Luna run with terminal Tasks, complete
  opportunity-to-comparison closure, `document@1` and `chart@1` real-page screenshots, SQLite/resource integrity and
  full isolated-runtime cleanup.
- Hard constraints: preserve one streaming Provider path and the existing semantic activity authority; do not add a
  fallback, repeat an executed Tool, weaken Host validation, or add/modify/run UI automation tests. Preserve unrelated
  concurrent worktree changes and commit only this phase's files.
- Sources read: `packages/opencorvus/src/session/processor.ts`, `src/llm/activity.ts`,
  `src/util/stream-activity.ts`, `test/session/processor-llm-activity-retry.test.ts`, the isolated R17b SQLite database,
  `result.json`, controller ledger, Task trace and event timeline.
- Repository search: `chunkHeartbeatKind` has one production caller in `SessionProcessor`; `run.bump`, Tool input draft
  ownership, retry cleanup, stream fairness, activity monitor registration and Tool pause/resume call sites were all
  inspected. The provider response-body work concurrently present in the worktree is a separate change owner and is
  excluded from this phase.
- Independent agent: an uninvolved read-only live auditor inspected the real page and isolated database throughout
  R17b. It confirmed the missing terminal aggregation, intact upstream Artifact/resource closure, exact-Luna usage,
  absent evolution/render closure, complete runtime cleanup and a stale pre-abort Mission status in `result.json`.

## Frozen R17b evidence

R17b used run root
`C:\Users\hengu\AppData\Local\Temp\opencorvus-luna-r17b-2cb590ada6ee4576aa7f9dca8b365cf1`, random port
`62227`, run ID `random-evolution-20260813061640-cb376cdad7`, and exact `openai/gpt-5.6-luna`. SHA-256 rejection
sampling selected `builtin/robotics-safety-validation@2026.08.13.1` from the unchanged 114-entry pool. The real page
installed the target and Evolution Lab at project scope, left Base active and created Mission `6cc0c1fc6e71911a` with
the exact two-Squad held authority.

The diagnostic Task `tsk_g00VS9ltK500mMmBImxo` correctly froze, completely read and selected the two Case resources
before dispatch. Four independent root workers published readable current Engine Artifacts at revisions 10, 11, 17
and 22. The case owner then completely read and selected both Case resources and all four roots. Artifact storage was
not the failure boundary.

The first unrecovered transition is assistant Message
`msg_g019ff9e8ed68000000000000L9rw9hB3lHujOz`: after persisted reasoning and text, Tool Part
`prt_g019ff9e911c8000000000000iOQteV0vRvaIBF` entered `artifact_publish` at catalog time `1786604229064` with
`state.status=pending`, `state.input={}` and `state.raw=""`. No validated Tool input or Host execution ever existed.
It remained pending until the controller aborted the Mission after 600,000 ms without durable activity. The Task did
not reach its terminal case-owner Artifact, Completion Decision, opportunity, Campaign, Trials, evaluation,
comparison, interactive document or chart. The controller recorded natural failure at `2026-08-13T07:07:16.912Z`
and a complete runtime-disposal receipt at `07:07:23.812Z`.

## Control-flow analysis and remaining unknown

`SessionProcessor` currently calls `chunkHeartbeatKind(value)` and `run.bump(...)` before the switch that determines
whether the chunk belongs to live Processor state. A nonempty `tool-input-delta` can therefore reset the 180-second
semantic idle timer even when its call ID has no pending entry in `toolcalls`; the later switch silently drops the
delta and persists no raw input. The same ordering can falsely credit unowned text or reasoning deltas. Repeated
unowned deltas are one code-supported explanation for the observed shape: physical stream activity, no durable
Message/Part progress, an empty Tool draft and no semantic idle convergence.

R17b did not persist raw upstream chunks, so the exact OpenAI/SDK delta sequence and whether timer scheduling was also
degraded are unknown. That missing trace is not converted into a stronger provider or event-loop claim. The next
stage must first reproduce the Processor's pre-acceptance heartbeat behavior with a focused executable test. Only if
that test reproduces the abandoned-draft stall may implementation begin at this shared Processor acceptance boundary;
otherwise investigation returns to the provider stream/timer boundary. A robotics prompt, Artifact publisher, Host
validator, longer inactivity timeout or provider-specific fallback is excluded by the current evidence.

## Repair and staged acceptance

1. Keep `first-byte` as physical stream evidence, but emit semantic heartbeats only after the Processor has accepted
   the corresponding state transition. Delta/end chunks must own the exact live text, reasoning or Tool call before
   they can refresh semantic activity.
2. Add a focused positive Processor test whose first attempt emits a valid Tool start followed by nonempty deltas for
   a different call ID. It must hit the canonical idle retry, remove the abandoned draft and persist only the second
   attempt's completed text/usage.
3. Run the complete focused Processor activity file, activity/stream checks affected by the shared contract,
   OpenCorvus typecheck and diff check. An uninvolved agent must review the implementation and evidence.
4. Commit and push the repair separately. Only after that phase is clean may a new isolated exact-Luna E2E begin.

R17b is a failed diagnostic run and cannot count as a rendering or evolution pass.

## Processor repair phase evidence

The focused reproduction used a valid `tool-input-start` for one call ID followed for 600 ms by repeated
`tool-input-end` chunks for that draft, nonempty deltas carrying a different call ID and text deltas carrying a
different provider text-stream ID. Before the repair it finished with `attempts=1`, zero usage and no recovered output:
chunks that caused no Processor mutation kept the 250 ms semantic idle monitor alive. The recovered attempt also
emits a wrong-ID text end before its correct delta/end pair. After semantic heartbeat publication moved behind the
Processor's corresponding accepted state transition and current text became bound to its provider stream ID, the same
test reached canonical idle retry, removed the abandoned draft, ignored the foreign text end and persisted only the
second attempt's completed text and usage.

The repair preserves physical `first-byte` observation before dispatch while admitting reasoning, Tool, step and text
semantic heartbeats only after their live Processor state is present and the associated mutation succeeds. A Tool
execution still pauses the activity owner at its validated `tool-call` boundary; its accepted result/error resumes
and refreshes the same monitor. No Provider, timeout, Artifact publisher, Host schema or workflow prompt is changed.

Current focused evidence:

- `bun test --timeout 30000 test/session/processor-llm-activity-retry.test.ts` — 3 pass, 7 expectations.
- `bun run typecheck` in `packages/opencorvus` — pass.
- `git diff --check` — pass.

An uninvolved read-only review of the implementation, complete focused diff and evidence remains the commit gate.

The isolated database finished with `integrity_check=ok`, zero foreign-key violations, 27 current Engine Artifacts,
18 historical versions and zero payload/resource hash mismatch. All 80 usage events use exact
`openai/gpt-5.6-luna`. The controller removed the listener, instances, database owner and isolated Auth. One reporting
gap remains: `result.json.outcome` is correctly `failed`, but its embedded `mission.latest_status` is the pre-abort
`running/active` projection rather than the post-abort terminal state. That reporting issue is recorded but not mixed
into the stream-stall repair phase.
