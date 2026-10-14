# Compaction stress evidence — 2026-10-13

Initial real calls use `openai/gpt-6.1-sol`; later sections identify additional
models and runtime recovery experiments. Model calls stream through the production
Provider/LLM and compaction processor in isolated runtimes. Inputs are authored
benchmark histories. Each section states its scope and limits.

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
| [policy-actions-real](policy-actions-real.json) | 80 | Nine paired rounds pass; the final grant compactor reaches the former request ceiling. Original failure retained. |
| [policy-actions-real-resume](policy-actions-real-resume.json) | 12 | Reopens that exact fifth-round history; checkpoint and both actual Tool actions pass. |
| [native-policy-real](native-policy-real.json) | 20 | Two one-checkpoint native/full/portable comparisons pass six actual actions and 30 fields. |

Initial phase total: **271** real requests. The user authorized increasing limits as needed;
the latest native comparison retained a 40-request hard cap and used 20. The final
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

## Open execution Message coverage

[Compact results](open-message-summary.json) link the reproducible loss of a late
Tool result to the exact checkpoint boundary repair. The
[baseline](open-message-before.log.gz) records two failed projections despite
intact raw Tool trace/cursor rows. [Final runtime evidence](open-message-final-evidence.log.gz)
contains five passing tests, ten local streamed requests and one joined replay
checker. A real Task ingress keeps one assistant through four Provider steps and
an automatic checkpoint; the fourth HTTP request contains the later read result.
The native Task process is replaced only by the existing in-process driver hook;
the Task admission, activation, compactor, Provider transport and Tools are real.

The open-message case covers three open checkpoints and a fourth after completion,
changed text, newly settled Tools, late diagnostics, exact source bindings,
ordinary/side copying, reopen and pruning. [Related contracts](open-message-final-contracts.log.gz)
and [regression](open-message-regression.log.gz) bring distinct coverage across
eight files to 53 tests. Earlier repeated passes do not inflate that total.
[Initial expanded check](open-message-expanded.log.gz) retains a nonexistent-file
invocation error; [initial Task check](open-message-task-runtime.log.gz) retains
the corrected immediate-park expectation. These are checker calibration, not
unresolved product failures. [Initial activation check](open-message-fixture-activation.log.gz)
records rejection of a fabricated activation and is excluded from runtime claims.

[Final typecheck](open-message-typecheck-final.log), [SDK generation](open-message-sdk-build.log.gz)
and [documentation checks](open-message-docs.log) record the public contract
validation. Paid use remains 159/160. Full concurrent Task/Mission recovery,
provider-native comparison and real five-round policy behavior remain open.


## Real five-round policy actions and exact resume

[Combined verification](policy-actions-real-summary.json) covers two authority
changes, five rounds each and full/compacted probe histories. All **20 actual
Tool/file actions and 100 fields pass**. Every effect file was reopened and
matched directly with its completed Tool receipt and original expected scope.
The original [80-request report](policy-actions-real.json) retains its final
budget failure; the [12-request resume](policy-actions-real-resume.json) preserves
the exact Session/anchor/update/source identities of that unfinished round.
Both request sidecars reconcile with their reports. All 92 requests are streamed,
use the exact target model and reach source-reader EOF. Cumulative paid use is
**251**; copied auth/catalog cleanup was observed after exit.

Paired probe inputs total 246,460 versus 71,945 actual Provider tokens. This
70.81% reduction excludes compactor/read cost; it is not a total cost-saving
estimate. These are authored histories using one real model, not a general
policy reliability guarantee. Earlier 159-request statements describe earlier
milestones; the ledger and this section are current.

[Local resume tests](policy-action-resume-local.log.gz) pass seven cases, including
an interrupted original round reopened through the same runner. The
[summary/replay regression](summary-waiter-regression.log.gz) passes 24 tests in
four files. These are **31 distinct tests**, excluding repeat runs.

## Formal backend interruption in two Task projects

[Compact verification](native-task-crash-summary.json) records two actual Task
admissions, one checkpoint and four original scheduler requests each. Both
summary HTTP waiters return true before the owned backend is forcibly cut.
Normal bootstrap then recovers the same logical Tasks with new physical
assistants; their real requests carry the original late Tool traces. All 32
original Parts, six Tool requests and six outcomes retain exact payloads.
Logical Tasks remain active; no_action settles their recovered ingress.

[Successful raw report](native-task-crash-fourth.json.gz) and
[execution log](native-task-crash-fourth.log.gz) contain 16 scripted local
streamed requests and two physically joined backend children. Detailed before,
crashed and after facts, startup receipts and child logs are listed in the
[archive manifest](policy-native-artifact-manifest.json). This proves formal
backend/Task recovery mechanics; Mission, OS power loss and native OpenAI
compaction remain outside this sample.

The [shared waiter reproduction](native-task-summary-waiter-repro.json) and
[second raw report](native-task-crash-second.json.gz) retain consumed controls
whose HTTP waiters remained pending before the fix. The initial and third
samples preserve checker calibration and a repaired startup parse error.
The [pre-run typecheck](policy-native-typecheck-final.log) and
[delivery typecheck](policy-native-typecheck-delivery.log) exit 0.
[Documentation checks](policy-native-docs.log) pass for the current indexes.
All gzip files preserve original bytes; no digest stands in for behavioral
acceptance. Run the backend checker with a new absolute
COMPACTION_RUNTIME_CRASH_RESULT and
bun run --cwd packages/opencorvus script/compaction-runtime-crash-check.ts.


## Native streamed reference comparison

[Verified results and canonical usage receipts](native-policy-real-summary.json)
record two one-checkpoint full/portable/native comparisons using the same exact
real model and authority changes. Six actual file-writing Tool actions and all
30 fields pass. The [raw report](native-policy-real.json) matches its
[20-request sidecar](native-policy-real.json.requests.json). Cumulative usage is
**271**, and both copied credential/catalog files were observed removed.

The native endpoint returns a completed opaque state in one request per case;
the portable helper uses six requests including evidence pagination. Native
preparation logical input is 19,769 / 19,771 tokens; portable preparation is
81,563 / 81,450 including 62,592 / 44,800 cached tokens. Probe input is about
7k for both compressed lanes and 20k for full history. These are actual usage
fields, not ciphertext-length estimates or a general cost/quality ranking.

Native output is saved and reopened as an experimental artifact. Its exact
opaque states and every calibration log are listed in the
[archive manifest](native-reference-artifact-manifest.json). This is not a
product Session-native checkpoint, native five-round acceptance, Azure native
integration or Codex parity.

[Baseline wire evidence](native-reference-baseline.log.gz) shows the old Provider
transform deleting both compaction and item_reference IDs. The single transform
now normalizes only its defined ordinary replay item kinds and preserves native
context/reference identities. [Final local validation](native-reference-delivery.log.gz)
passes six native/protocol/action tests; the existing seven policy tests also
pass in [combined regression](native-reference-matrix-local.log.gz), whose two
initial matrix failures are retained and fixed in the later native suite. Total
coverage is **13 distinct tests**, not the sum of repeated runs. Incomplete and
progress-only native state returns an explicit failure without a text substitute.

[Final TypeScript check](native-reference-typecheck-complete.log) and
[documentation/index checks](native-reference-docs.log) pass. Earlier typing
receipts retain the transient concurrent Permission edit failure and its
successful recheck; this task changed no Permission source.


## Request-budget-aware transcript packing

[Combined real results](transcript-budget-policy-real-summary.json) record both authorization changes through five portable checkpoints: 20 actual actions / 100 fields pass in 51 real requests. Cumulative use is **322**. The [original 50-call batch](transcript-budget-policy-real.json) preserves its final budget interruption; the [exact pending-probe continuation](transcript-budget-policy-real-resume.json) completes the missing action from the same fifth checkpoint. Their matching request sidecars and canonical usage receipts retain exact accounting. Credential and catalog copies are removed.

Complete fields now enter the compactor when the whole request can fit them; omitted fields retain exact references and optional budgeted previews. No file-backed preview is treated as complete. The first round takes one compactor call in each case; later rounds may reread original evidence. This is not native product integration or a guarantee of perfect compression.

The [artifact manifest](transcript-budget-artifact-manifest.json) lists exact gzip copies of baseline failures, local repairs, real execution and checks. The baseline reproduced premature omission and request overflow; the final nine suites pass 89 distinct contracts. Final [fixture regressions](transcript-budget-fixture-regression.log.gz), [policy continuation](transcript-budget-resume-final.log.gz), [native regression](transcript-budget-resume-local.log.gz), [TypeScript](transcript-budget-typecheck-delivery.log.gz) and [documentation checks](transcript-budget-docs-delivery.log.gz) retain their raw output. Immutable source/file equality and actual actions establish correctness; hashes are not an acceptance substitute.

## Compactor read-window pressure

[File results](read-pressure-file-receipts-summary.json) and [failure-diagnostic results](read-pressure-diagnostics-receipts-summary.json) pass all 22 held-out fields with a 19,000-token prompt ceiling and unchanged 20-step helper limit. Canonical read receipts cover the entire 70,492-character file and 78,303-character diagnostic field. Their actual original reader-call identities and merged ranges are independently checked against the database. The successful repairs use 20 and 18 streamed requests; [the ledger](final-request-ledger.json) records **414 cumulative requests**, including the preceding failed 54-call candidate. Both credential/catalog copies are removed after each run.

The compactor packs against the final request envelope, fits evidence pages to its shared remaining window and can save model-authored cumulative notes as normal Tool Parts. Successful notes retain factual read ranges so removing raw pages from the current request does not cause circular rereading. Original source data and settled Tool results remain available. Failed/aborted attempts retain typed errors and can be reopened. Read receipts prove delivery, not semantic truth or authorization.

The [wire baseline](read-pressure-wire-baseline.log.gz) preserves all three pre-repair capacity failures. The [original real candidate report](read-pressure-real.json) intentionally retains its invalid JSON: overly broad credential-name matching treated the numeric context setting as a secret, and raw serialized-text redaction corrupted its numeric value. The [derived readable view](read-pressure-real-observed.json) explicitly quotes that one redaction marker without reconstructing the value. Its [request sidecar](read-pressure-real.json.requests.json) and [canonical progress/usage evidence](read-pressure-real-progress.json) retain independent exact accounting. The report serializer and classifier are repaired and positively tested; the two new reports parse with numeric context metadata.

The [artifact manifest](read-pressure-artifact-manifest.json) inventories byte-preserving gzip copies of all failed/calibration/final logs and the original/derived reports. Final coverage is **150 distinct local contracts**: [112 regression tests](read-pressure-final-regression.log.gz), [14 working-context and pressure/reopen tests](read-pressure-receipts-local.log.gz), and [24 audit contracts](read-pressure-audit-repair.log.gz). The [expanded TypeScript check](read-pressure-typecheck-delivery.log.gz) and [documentation/index checks](read-pressure-docs-delivery.log.gz) provide their actual command output. Scripted local streams prove mechanics; the real probes supply the bounded semantic observations. Native product persistence, repeated pressure/action matrices, broader models and Mission recovery remain open. The record also pins the public Codex source comparison; it does not claim parity with an installed Desktop build or private compression internals.

## Repeated authority under read-window pressure

[The combined matrix](policy-pressure-matrix-summary.json) passes both authorization changes through five consecutive checkpoints: **20 actual actions / 100 exact fields**, with a 19,000-token compactor/compacted ceiling and the unchanged 20-step helper limit. Complete-history controls explicitly receive 256,000 tokens. This is a semantic control with different resource budgets, not a same-budget efficiency claim.

The [original revoke run](policy-pressure-revoke-real.json) preserves its third-round network interruption. Its [38-request summary](policy-pressure-revoke-real-summary.json) records two passed rounds; the [exact continuation](policy-pressure-revoke-resume-summary.json) completes rounds 3–5 in 20 more requests. The [grant run](policy-pressure-grant-real-summary.json) passes five rounds in 58 requests. Phase use is **116**, cumulative use **530**. There are 115 completed canonical usage receipts; the interrupted request remains counted and its usage/billing are unknown. All copied credential/catalog files are removed.

[Physical and canonical failure evidence](policy-pressure-network-failure.json) identifies HTTP 200 followed by a read-origin TypeError/ECONNRESET. [Post-recovery comparison](policy-pressure-failure-retention.json) confirms the original failed Message and all twelve prior Tool request/outcome payloads are exact. Source-reader EOF/error facts are retained in each run summary. Original failures are not relabeled as successful runs.

The replay guard now preserves its redacted nested Error cause chain and string codes in the existing durable error message. It retains its original refusal to replay an attempt with executed Tools. The checker uses the single project Config surface for declared comparison budgets, restores it after each full probe, and resumes an interrupted middle checkpoint or probe through the remaining originally planned rounds.

[The artifact manifest](policy-pressure-artifact-manifest.json) inventories raw reports, independent summaries and byte-preserving gzip logs, including the failed baseline/fixture calibration. [Final local verification](policy-pressure-recovery-local.log.gz) passes 31 distinct contracts; [expanded TypeScript](policy-pressure-recovery-typecheck.log.gz) and [documentation/index checks](policy-pressure-docs-delivery.log.gz) retain the command evidence. Scripted local streams prove mechanics; real persisted effects provide the semantic results. Native product persistence, broader models, Mission/whole-OS recovery and larger source catalogs remain open.

## Task and Mission checkpoint crash recovery

[The independently reviewed final matrix](mission-recovery-matrix-summary.json) covers both owners, two separate Projects, and interruption during compaction or after a completed checkpoint with later Tool evidence. Eight owner cases pass in **72 local streamed requests**. Remote request use is zero; the paid ledger remains **530**. These streams are scripted and establish recovery/data-flow behavior, not model quality or operating-system power-loss durability.

Three reproduced production defects are repaired: Projects opened after scoped host startup now install the existing Mission recovery driver; queued compaction preserves inputs accepted after its original source as an exact retained tail; the exclusive compaction-control owner settles abandoned helper attempts before rereading their typed diagnostics. The repair reuses current Project, Prompt, control-lease and checkpoint authorities without a new queue or stored protocol.

[Mission startup-gap evidence](mission-after-checkpoint-repair.json.gz) retains the original failure where alpha recovered and the later-opened beta did not. [Task input-loss evidence](mission-task-during-compaction.json.gz) retains completed replacement summaries followed by the exact Task input-identity mismatch. [Local boundary reproduction](mission-input-boundary-baseline.log.gz) has four failures; [final boundary checks](mission-input-boundary-final.log.gz) retain both later accepted inputs and the old helper's original Parts plus typed interruption. The earlier [Mission marker calibration](mission-after-checkpoint.json.gz) remains a checker failure against a valid whole-Message checkpoint, not a production compaction failure.

Final verification covers **55 distinct local contracts**: [40 compaction/runtime/producer contracts](mission-input-boundary-repair.log.gz), [four Project-open/frontier contracts](mission-project-open-contracts-final.log.gz), and ten cross-process plus one streamed Mission recovery contract in [the initial combined log](mission-recovery-contracts.log.gz). That combined command remains marked failed because its first suite contained the stale Project-open expectation; the separately linked final suite fixes and passes that contract. Repeated runs are not counted again. [Expanded TypeScript](mission-final-typecheck.log.gz), [module topology and clean imports](mission-delivery-module-topology.log.gz), and [documentation checks](mission-docs-delivery.log.gz) preserve command evidence.

The [archive manifest](mission-recovery-artifact-manifest.json) inventories byte-preserving compressed reports, actual request bodies, canonical before/after facts, checkpoint-reader results, public Mission outcomes and owned process receipts. Existing leases may defer takeover until expiry (120 seconds for the compaction control); this phase preserves that protocol. Broader models, native product persistence, whole-OS failure and larger catalogs remain open.

Reproduce with Bun 1.4.0 and the single `packages/opencorvus/script/compaction-runtime-crash-check.ts` entry. Set `COMPACTION_RUNTIME_CRASH_RESULT` to a new absolute report path, `COMPACTION_RUNTIME_CRASH_OWNER` to `task` or `mission`, and `COMPACTION_RUNTIME_CRASH_CUT` to `during-compaction` or `after-checkpoint`; run `bun run --cwd packages/opencorvus script/compaction-runtime-crash-check.ts`. It creates and settles only its own isolated runtimes and needs no credentials.

## Cross-model authority stress: Luna

[The Luna matrix](cross-model-luna-matrix-summary.json) is **failed**, with ten valid checkpoints and **19/20 correct actions, 96/100 fields** across both authorization changes and five rounds each. [Revoke](cross-model-luna-revoke-projected-summary.json) passes all five rounds in 53 calls. [Grant](cross-model-luna-grant-summary.json) uses 35 calls; its third compacted action returns to the original draft/old destination while the paired full-history action and the actual summary contain the correct later release scope. All 88 streamed source readers settle EOF and match 88 completed canonical usage receipts. Cumulative request use is **618**, operating ceiling **740**, and no paid run remains active; both credential/catalog copies are removed.

[Failure evidence](cross-model-luna-authority-loss.json) preserves the exact checkpoint text, actual files/Tool inputs/outcomes and audited request positions. The current authorization occurs in a user-role field in the full request, but only an assistant-role summary in the compacted request. The old user anchor survives. This shows that preserving wording alone can degrade instruction authority; a candidate source-role-preserving intervention is still under investigation. Later successful rounds are retained as later rounds and do not repair the failed observation.

The first [0-request startup failure](cross-model-luna-revoke.json.gz) found an independent model-projection defect: the Codex OAuth hook required a decimal model version and compared it as a floating-point number. The parser now handles integer major and optional integer minor components under the existing admission policy. The [catalog baseline](cross-model-projection-catalog-baseline.log.gz) reproduces both local failures; [seven focused contracts](cross-model-projection-repair.log.gz) and [expanded TypeScript](cross-model-projection-typecheck.log.gz) pass after repair. The target stays exactly openai/gpt-6-luna. No source credentials, model declarations, request transport, configured limits or product permission policy are changed.

[The artifact manifest](cross-model-artifact-manifest.json) retains original failed/successful reports, request sidecars, local calibration logs and independent summaries. The [preflight](cross-model-luna-preflight.json) is a source inventory, not proof of usable model projection; the original failure demonstrates that distinction. The previous Sol pressure matrix remains a separate reference with different authored identifiers. These samples do not establish a statistical model ranking, cross-vendor coverage or universal compression fidelity. [Documentation checks](cross-model-docs-delivery.log.gz) accompany this evidence delivery; the source-authority defect remains an explicit unfinished requirement.

## Original user-text retention

[The final Luna matrix](user-retention-matrix-summary.json) passes **20/20 actual actions, 100/100 fields and 10/10 original authorization user-role projections** across grant/revoke and five checkpoints each. The compactor/compacted ceiling remains 19,000 tokens, the full-history control 256,000. Each passing run uses 36 streamed requests; original Parts, outgoing request roles, actual Tool inputs/outcomes and action files are independently verified.

| Intervention | Requests | Actions | Authorization role retained | Result |
| --- | ---: | ---: | ---: | --- |
| [Initial source retention](cross-model-user-retention-grant-summary.json) | 28 | 5/10 | 0/5 | Failed: mistyped source ID followed by unsupported inference. |
| [Read-error guidance](cross-model-user-retention-read-repair-grant-summary.json) | 51 | 8/10 | 0/5 | Failed: original page cleared into notes, later paraphrase/guessed offset rejected. |
| [Select while visible: grant](cross-model-user-retention-eager-grant-summary.json) | 36 | 10/10 | 5/5 | Passed. |
| [Select while visible: revoke](cross-model-user-retention-eager-revoke-summary.json) | 36 | 10/10 | 5/5 | Passed. |

The role evidence reports ([initial](cross-model-user-retention-grant-role-evidence.json), [read repair](cross-model-user-retention-read-repair-grant-role-evidence.json), [grant](cross-model-user-retention-eager-grant-role-evidence.json), [revoke](cross-model-user-retention-eager-revoke-role-evidence.json)) preserve original authorization text/identity, exact selected excerpts, failed and successful Tool facts, and outgoing request probes. Early correct actions with assistant-only authorization remain distinct from preserved user role.

This phase consumes **151** requests including failures; [the ledger](final-request-ledger.json) totals **769**, ceiling 820, with no live run and all four copied auth/catalog pairs removed after joined completion. The model chooses excerpts through a visible Tool; the host validates exact source/provenance/range/capacity only. It never upgrades assistant or Tool text to user authority.

[The archive manifest](user-retention-artifact-manifest.json) preserves all original reports/sidecars, failed calibration logs, final checks and review scripts. Final local coverage is **95 distinct positive contracts**, including actual streamed compactor/notes/repeated-checkpoint/copy/provider-role replay, current source validation at atomic publication, source edits, Unicode, reversed parallel Tool-result order and capacity. [Expanded TypeScript](user-retention-typecheck-final-verified.log.gz) and [documentation checks](user-retention-docs-delivery.log.gz) accompany the delivery.

These are bounded observations on authored histories. Source selection and quotation context still depend on model reasoning. Physical process-crash validation with the new selection capability, richer alternating authorization histories, larger catalogs/scaling, native product persistence, cross-vendor coverage and whole-OS power loss remain open. No perfect retention or private Codex equivalence is claimed.

Implementation/evidence is committed as `d6fc0a555`. The [first normal push log](user-retention-push-shared-owner-block.log.gz) preserves a shared-workspace blocker after successful migrations/type/route/docs checks: another task's uncommitted Permission source has two control-lease acquire sites while the registry declares one. Its source/validation/registration must converge before normal synchronization; the hook was not bypassed.
