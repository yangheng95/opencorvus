# Compaction stress evidence — 2026-10-13

All real calls use the configured `openai/gpt-6.1-sol`, streamed through the
production Provider/LLM and compaction processor in an isolated runtime. Inputs
are authored benchmark histories. This is integration/semantic evidence, not a
full browser, Task/Mission scheduling, or native Codex comparison benchmark.

| Run | Requests | Result and meaning |
| --- | ---: | --- |
| [baseline](baseline.json) | 6 | Runner calibration; latest-user retention masked loss, excluded from acceptance. |
| [baseline-valid](baseline-valid.json) | 8 | Runner calibration with custom system prompt; excluded from production semantic results. |
| [baseline-production-system](baseline-production-system.json) | 8 | Valid baseline: start/end pass; middle facts and Tool provenance fail. |
| [repair-1](repair-1.json) | 20 | 4/4 scenarios, 25/25 exact fields pass after projection/reader repair. |
| [repeated](repeated.json) | 30 | Detects reversion to initial region and references outside reader scope; third Tool round reaches request ceiling. |
| [repeated-text-repair](repeated-text-repair.json) | 14 | After second repair, two rounds pass; third is incomplete at request ceiling. |
| [repeated-tool-repair](repeated-tool-repair.json) | 13 | Two consecutive Tool-evidence rounds pass, including exact input/output/trace/call/Part/cursor. |
| [text-three-rounds](text-three-rounds.json) | 16 | Three consecutive text-middle rounds pass, 15/15 exact fields. |
| [tool-three-rounds](tool-three-rounds.json) | 21 | Three consecutive Tool-evidence rounds pass, 30/30 exact fields. |
| [file-failure-final](file-failure-final.json) | 13 | Full-file case passes 10/10. Failed-Tool checkpoint is valid, but continuation receives Provider overload; that case remains an error. |
| [failure-retry](failure-retry.json) | 5 | Fresh failed-Tool case passes 11/11, including original failure name, trace and cursor. |
| [message-diagnostics-real](message-diagnostics-real.json) | 5 | Model reads all 78,303 diagnostic characters in three pages; 12/12 continuation fields pass with production Tool preparation. |

Total: **159/160** authorized real requests, with **1 remaining**. The final
accepted text/Tool/file/failure/diagnostic cases score **78/78** fields over nine completed
rounds; this finite, single-model corpus is not a general reliability estimate.
[Final request accounting](final-request-ledger.json) reconciles all new sidecars
and confirms completed-run credential/catalog cleanup.
Failures and runner calibration are preserved rather
than removed from the accounting. Every successful checkpoint is checked by
`replay-compaction-errors-validator.ts`; its stored projection is reopened and
compared by actual message identities. Reports include sanitized outgoing probe
positions, continuation inputs, summaries, answers, per-field metrics and request
counts. Observability digests are not acceptance criteria. Credentials/catalog
copies are excluded and removed from completed isolated runs.

The text corpus places a later user correction at the beginning, middle or end
of about 75,000 characters. The Tool corpus places an exact input marker inside
an omitted middle, supplies a short result with quoted hostile instructions,
and requires exact trace/call/Part IDs and original pagination cursor. Repeated
rounds add inconclusive diagnostics and recompact the same Session. Questions
are asked after each checkpoint; expected values are never injected into the
summarizer. Prior probe questions remain real benchmark user messages, but model
answers are kept only in the report to avoid answer feedback between rounds.

## Reproduce

From `packages/opencorvus`, set these environment variables, then run
`bun run check:compaction-stress`:

- `COMPACTION_STRESS_ALLOW_REAL_PROVIDER=1` (requires user authorization)
- `COMPACTION_STRESS_AUTH_SOURCE=<absolute path to authorized auth.json>`; its paired `models.json` must be in the same directory
- `COMPACTION_STRESS_MODEL=<exact provider/model>`
- `COMPACTION_STRESS_RESULT=<absolute report.json path>`
- `COMPACTION_STRESS_MAX_REQUESTS=<remaining authorized request allowance for this run>`
- Optional `COMPACTION_STRESS_CASES=text-start,text-middle,text-end,tool-evidence,tool-file,tool-failure`
- Optional `COMPACTION_STRESS_ROUNDS=3`

The runner enforces its per-run budget and audits actual model/streaming. The
operator must account for all earlier runs against the user's total allowance.
The `.requests.json` sidecar persists accounting before each remote request.
The 180-second timeout measures inactivity at the real Provider source reader,
not process lifetime. The latest four runs also retain their `.requests.json`
sidecars; request counts include unsuccessful calls and agree with each report.

Local positive contracts additionally read two real persisted megabyte-class
Unicode output files across database reopen, fence other-project Parts, verify
complete exact reconstruction, and check typed scope/field/offset errors. Those
results do not establish remote semantic performance on the full-file cases.

Still unverified: operating-system restart mid-compaction, parallel full
Task/Mission workloads, broader model distribution, and measured Codex parity.
The Task-bound copy contract below qualifies history-copy ownership; it does
not implement a new Task execution branch or certify the complete Task driver.

## Retained evidence lifetime

[Retention contracts](retention-contracts.log) exercise the actual age cleanup,
database reopening, canonical Session forks, exact full-output reads, pending
recovery receipts and live Tool metadata. Baseline code deleted referenced files
older than seven days; the fixed code retains canonical references and reclaims
aged orphans. A 193-file case publishes a reference after cleanup has started,
then verifies 192 reclaimed orphans and the exact retained source bytes. This is
local storage/cleanup evidence and adds **zero** remote model requests.

## Copy and deletion lifecycle

[Original reproduction](fork-before.log) records loss of the checkpoint anchor
and tail after both native fork and side-chat, and missing full-output bytes
after source deletion. [Causal-order reproduction](fork-causal-before.log)
records a later-created accepted input being frozen before its copied Parts can
be written. Both use the real Session/Engine APIs, database and filesystem.

[Final local contracts](fork-final.log) cover copied checkpoint reconstruction
after database reopen, exact accepted-input and timeline identity, inherited
execution-reference scope, source deletion, copy/deletion concurrency and
cross-Project isolation. They also exercise Session memory integration and
accepted-input immutability. These results add **zero** remote requests and do
not establish semantic model quality or whole-process crash recovery.

## Exact citations across copies

[Citation baseline](citation-before.log) reproduces three failures for old Part
identities after copying. [Final citation contracts](citation-final.log) exercise
literal unchanged summary text, all readable fields through successive copies,
32 generations of a 136,000-character source, edited-copy staleness, excluded and
later source material, and another Project. Checks compare actual recovered
content and typed errors; digest strings are not the test oracle. The source
identity digest is only an integrity check against a fixed copy-time payload.

The current copier records exact ancestry on the canonical Message, and the
reader resolves that ancestry only to Parts present in the bound snapshot. No
old-ID lookup expands to another Session's live history. Copies predating the
new provenance field still lack that proof and return the explicit scope error.
The [SDK generation](citation-sdk-build.log) synchronizes the public message
contract. This work adds zero real Provider requests. Full Task continuation
remains a separate unverified requirement. Later semantic, process and copy
ownership runs extend coverage without certifying that complete Task lifecycle.

[Streaming-loop integration](citation-stream-integration.log) uses a scripted
streamed model to request the old Part ID through the production compaction
tool dispatcher, processor, persisted Tool result and final checkpoint. The
second model step receives the actual copied source bytes and current identity.
This proves local integration of the alias contract, not remote model reasoning.

[Compaction integrity regression](citation-integrity.log) verifies all 13 budget,
projection, completed/incomplete/nonshrinking checkpoint and local HTTP streaming
contracts with the updated Tool declaration. Together with the final reader/copy
and memory runs, this continuation has 47 distinct passing focused tests.

## Physical interruption and recovery

The [compact process ledger](crash-summary.json) lists each case, physical exit,
settlement receipt and local request count. Full raw JSON/log pairs are gzip
compressed without changing their bytes; no digest-only check is used to score
recovery. The [accepted matrix](crash-final.json.gz) and its
[process log](crash-final.log.gz) cover 24 real child commands across eight cases:

| Abrupt exit boundary | Manual | Automatic | Verified recovery |
| --- | --- | --- | --- |
| After a real nonempty summary Part commit | Pass | Pass | Persisted text plus ProcessExecutionInterruptedError; previous checkpoint remains authoritative until retry succeeds. |
| After summary completion, before marker publication | Pass | Pass | Previous checkpoint before recovery; a new valid checkpoint after normal lease recovery. |
| During checkpoint transaction, before commit | Pass | Pass | SQLite rollback preserves previous checkpoint; retry settles one checkpoint binding. |
| After checkpoint commit, before control consumption | Pass | Pass | Existing summary reused; pending control consumed with that exact summary ID. |

Every case uses separate project/runtime/database state, then reopens it in a
fresh recovery child and again in an inspection child. Original authored fields
are compared exactly, allowing only the real validated catalog-binding pair
added by automatic normal-turn continuation. Final memory, projection and
control identity agree across fresh reads. Automatic cases await the ordinary
reply as well as checkpoint settlement. The matrix uses **18 loopback streaming
requests and zero remote requests**. It waits for the real 120-second abandoned
lease to expire; it never rewrites lease deadlines or stored statuses.

The [final teardown smoke](crash-final-smoke.json.gz) and
[typed-hook recheck](crash-typed-hooks.json.gz) exercise the delivered runner after
review adjustments. Preparation failures are reported within their case, all
parallel cases are joined before server cleanup, and owned runtimes are removed
only after confirmed child/output settlement and successful checks. A focused
TypeScript check includes both scripts and existing ambient declarations;
standard backend typecheck excludes scripts.

Preserved calibration evidence:

- [Manual baseline](crash-calibration.json.gz): committed-checkpoint recovery passes.
- [Automatic calibration](crash-automatic-calibration.json.gz): an early summary-mode snapshot raced the legitimate normal-turn continuation. The runner now awaits that reply and validates the canonical catalog annotations.
- [Role-parser calibration](crash-runner-role-calibration.json.gz): strict user-input parsing was incorrectly applied to assistant Messages; no local Provider call occurred. Corrected the checker to parse user inputs.
- [Live-delta boundary](crash-volatile-window.json.gz): six durable-boundary cases pass; two live-delta cuts retain original history and truthful interrupted failure but lose uncommitted partial summary text. Delta publication is ephemeral; accumulated Parts persist on the existing 200 ms cadence. The accepted streaming cut is after a real Part commit. **Uncommitted visible fragments can be lost**, and process exit tests do not prove power-loss durability.

Reproduce from `packages/opencorvus` with
`COMPACTION_CRASH_RESULT=<absolute report.json path>` and
`bun run check:compaction-crash`. Optional selections are
`COMPACTION_CRASH_CUTS=streaming,summary_saved,checkpoint_transaction,checkpoint_saved`
and `COMPACTION_CRASH_KINDS=manual,automatic`. The existing native process
supervisor owns and joins each child. Inactivity timeout is 180 seconds of no
stdout/stderr activity; the existing test-command resource deadline is separate.
The fixed local model output proves persistence and recovery mechanics, not
semantic reasoning, full application startup or Task/Mission scheduling.

## Task-bound checkpoint and copy ownership

[Task authority baseline](task-authority-baseline.log.gz) proves exact original
worker authority through three authored checkpoints and reproduces a normal
worker fork whose copied anchor names a descriptor belonging to the source
Session. Its new Session lacks a descriptor, so compaction projection returns
the precise authority error. The same baseline contains one checker expectation
mistake: metadata is the documented `{part,state}` envelope, not a bare object.
[Fork admission baseline](task-fork-before.log) records the missing typed
ownership conflict; its first fixture case also exposes separately sampled
creation timestamps, now corrected to one Task creation instant.

[Focused contracts](task-authority-final.log) exercise actual Task/dispatch/
descriptor persistence, checkpoint reconstruction, exact source reads and
database reopen, plus ordinary copy/atomicity/citation regression. The canonical
writer now returns `TaskBoundSessionForkError` for normal Task-root or worker
forks. Explicit side-chat retains the source as independent history using the
same copier. Strict current-worker authority remains intact. The change prevents
publishing an invalid execution container; it does not synthesize a dispatch or
add an alternative execution identity.

[Public route contracts](task-fork-routes.log) cover actual HTTP Session/Gateway
requests and the panel Tool, plus existing Mission ownership. These are backend
contracts, not UI automated tests or a full Task lifecycle run. The
[final six-case matrix](task-fork-complete.log) covers Task-root/worker copies
both before and after compaction, alongside original authority and side history.
Combined with the copy/atomicity/Mission regressions, 24 distinct tests pass.
The [SDK build](task-authority-sdk-build.log) synchronizes error responses. This
continuation consumes **zero** remote model requests; total remains 154/160.

## Failed-attempt replay and terminal admission

[Original converter baseline](failed-history-before.log.gz) records eight new
positive contracts failing while the two existing history contracts pass.
[First streamed chain](failed-history-wire.log.gz) and
[repeated lifecycle baseline](failed-history-lifecycle-before.log.gz) retain the
actual manual-summary/reply race: a completed summary and consumed control,
durable next user input, two Provider requests, and cleanup rejecting the next
reply callback. These are captured runtime facts, not a model's explanation.

[Final replay contracts](failed-history-final.log) verify 11 diagnostic/history
cases and the two-project real HTTP streaming chain. They record diagnostics,
original accepted input IDs and exact Tool call/results as received by the
local Provider, including compactor and post-checkpoint requests. One project
reuses its completed manual checkpoint and immediately continues; the other
attaches a reply while compaction is held at an HTTP barrier. Both issue three
local requests. Scripted responses prove transport and settlement, not model
semantic quality. The canonical failed Message remains unchanged.

[Five-file regression](failed-history-settlement-final.log) passes 33 tests;
[owner termination](failed-history-owner-settlement.log) adds nine selected
cases; [compaction, memory and cross-process regression](failed-history-compaction-regression.log)
adds 30. These sets contain **72 distinct passing tests**; repeated runs are
not additional coverage. The
[first regression log](failed-history-settlement-regression.log.gz) preserves
a checker XML quote-decoding mistake, corrected before final acceptance.

[Physical crash summary](failure-replay-crash-summary.json) records all eight
manual/automatic durable interruption boundaries passing with 24 joined child
commands, 18 local streamed requests and zero remote requests. The full
[report](failure-replay-crash.json.gz) and [log](failure-replay-crash.log.gz)
preserve exact physical/output settlement receipts. Compression preserves the
original report bytes. This is process-crash recovery, not whole-OS power loss.

The same canonical diagnostic projection serves ordinary replay and compaction;
the existing Provider redactor handles credential fields. Terminal callbacks
close admission on their exact owner before releasing callers, unless other
accepted work remains. This uses the existing reusable receipt and in-memory
termination state. It does not add a retry queue or Task execution authority.
The Message-level pagination gap left by this stage is addressed below; full
Task/Mission orchestration and native-compaction comparisons remain open.
The [focused typecheck receipt](failed-history-typecheck.log) covers the two
changed tests and their production dependencies. Documentation and architecture
index checks also pass.

## Complete Message diagnostics and copy identity

[Baseline](message-diagnostics-before.log.gz) contains four positive failures:
truncated diagnostic JSON, a missing Message reader, and two real atomic-copy
paths rejected for mismatched failure-occurrence ownership. The source rows
remain intact. Three existing typed scope-error assertions pass on that baseline.

The same evidence reader now pages Message diagnostics by `message_id` and
`field=diagnostics`, alongside its Part fields. The canonical copy ancestry adds
diagnostic identities and fixed payload bindings; it stores no duplicate error
body. Local copied owners satisfy the Message schema, and historical reads
restore original Session/Message/parent/input/failure identities. Current copied
diagnostics identify their recorded sources. Credentials use the existing
redactor; original diagnostic content and historical Tool/Part trace IDs remain
source data.

[Final eight-file regression](message-diagnostics-final.log) passes 74 tests;
[atomic-copy regression](message-diagnostics-atomic.log) adds three. The
[final ten-case suite](message-diagnostics-strict-final.log) adds the OpenAI
strict Tool input contract, for **78 distinct passing tests**. Its real
production adapter materializes nullable Message/Part locators and default
offsets into correct executable inputs; this is local ABI coverage, not a
remote model call. [Final trace cases](message-diagnostics-trace-final.log)
repeat the nine new tests with explicit unpersisted Part/write-error references.
The [narrow typecheck](message-diagnostics-typecheck-final.log) and
[SDK generation](message-diagnostics-sdk.log) pass. The initial narrow check
required only explicit test Tool context and page-array annotations; its
[diagnostics](message-diagnostics-typecheck.log) are retained.

The new real HTTP streaming chain completes three compactions, reading all
approximately 73,000 characters in three pages each. The third checkpoint runs
in a copied independent history and resolves the original Message citation from
the previous summary. Every received full error body preserves the exact middle
trace and source cursor; current copy IDs and requested source IDs are recorded
separately. Twelve local streaming requests per successful chain prove actual
processor/Tool transport and publication. They are scripted, not real-model
semantic scoring, and consume zero remote allowance. Earlier local
[contract](message-diagnostics-contracts.log) and
[repaired wire](message-diagnostics-wire-repaired.log) runs are repeats, not
additional distinct coverage. The
[first wire run](message-diagnostics-wire.log.gz) preserves a checker-only error:
the model-facing Tool result is already page JSON, not the internal wrapper the
first checker expected. Raw compressed failures preserve their original bytes.

At this local-only stage, remote use was **154/160**. Full Task/Mission orchestration, native
compaction comparison, multi-model distribution and OS power-loss behavior
remain unverified; no perfect-compression or Codex-equivalence claim is made.

## Real-model Message diagnostics

The [real report](message-diagnostics-real.json),
[request sidecar](message-diagnostics-real.json.requests.json) and
[terminal log](message-diagnostics-real.log) record five completed streaming
requests on the exact configured model. The model calls the Message reader
three times and receives offsets 0–30000, 30000–60000 and 60000–78303. Its
published summary and held-out answer retain all 12 exact fields, including
original occurrence, evidence, trace, source cursor, unfinished persistence,
observation and denied deployment. The quoted hostile diagnostic does not
change the answer. Checkpoint validation, original-source comparison and
reopened projection identity all pass. No new production repair was needed.

This run now uses SessionLoop.prepareProviderTool, including the production
schema/execution adapter. Earlier real runs used the same compactor with an
identity callback at that boundary and remain scoped accordingly. The runner
also closes a startup cleanup gap for partial credential/catalog copies.
[Startup failure evidence](diagnostic-model-startup.json) and its
[log](diagnostic-model-startup.log) use an empty authored auth object and no
model catalog: the exact error is copy-models.json/ENOENT, before Provider
initialization, with awaited credential-removal receipts. The probe runtime
has already been reclaimed by its outer runner at post-exit inspection.
The real run's still-present runtime/data directory is independently inspected
for credential/catalog cleanup in the [ledger](final-request-ledger.json).

[Narrow script typecheck](diagnostic-model-typecheck-final.log) passes after
explicit role/input narrowing; the [initial diagnostics](diagnostic-model-typecheck.log)
remain preserved. The request ledger now totals **159/160**. This is one seeded
semantic run, not five-round policy-update behavior, an action benchmark or a
native-Codex quality comparison. The research update and precise next acceptance
dimensions are in the main investigation record.

## Paired policy-action checker (local validation)

The [compact matrix](policy-action-summary.json) records two five-round cases:
revoking an initial release authorization, and granting one scoped release after
an initial draft-only rule. The genuine correction is in a long middle user
Message. Each round compares full and compacted history under the same model,
Tool surface and context capacity. Probe histories are separate copies; their
answers and writes cannot become later source-summary input. Actual input size
estimates are reported rather than represented as equal lengths.

The production streaming processor calls WriteDeliveryArtifact, which writes
every supplied action into a fresh sandbox file without enforcing the expected
policy. Each file is read and matched to its completed canonical Tool receipt.
Ten checkpoints and 20 correct local actions pass. A separate wrong-target run
actually writes two wrong files and is graded POLICY_ACTION_SCOPE_MISMATCH;
missing/multiple/wrong-kind actions also have explicit result contracts.

[Final settlement log](policy-action-settlement-final.log.gz) passes the six
policy tests; [combined regression](policy-action-final.log.gz) also passes 13
compaction-integrity tests, for **19 distinct tests**. The first
[mechanical run](policy-action-mechanics.log.gz) is retained as earlier evidence,
not added to the count. All logs preserve their original bytes. The final local
chain uses **33 loopback requests, zero remote calls and 11 joined checker
children**, including the deliberately wrong scenario. The
[final typecheck](policy-action-typecheck-final.log) and
[initial typecheck](policy-action-typecheck.log) both pass.

These Provider responses are scripted; no five-round semantic model result is
claimed. Actual processor errors or another requested compaction remain
execution errors, not policy scores. The ready real cases are `policy-revoke`
and `policy-grant`, five rounds each, with a minimum of 30 requests and a planned
80-request cap for paging/retries. The main record contains the exact invocation
and acceptance contract. Current real usage stays **159/160**; additional paid
approval is required before running that matrix.
