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

Total: **99** real requests. Failures and runner calibration are preserved rather
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
not process lifetime. Full-file and failure scenarios are implemented, but their
remote results have not yet been obtained within the current allowance.

Local positive contracts additionally read two real persisted megabyte-class
Unicode output files across database reopen, fence other-project Parts, verify
complete exact reconstruction, and check typed scope/field/offset errors. Those
results do not establish remote semantic performance on the full-file cases.

Still unverified: three successful consecutive rounds after the second repair,
remote full-file/failure cases, operating-system restart mid-compaction, parallel
full Task/Mission workloads, broader model distribution, and measured Codex parity.

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
contract. This work adds zero real Provider requests. Ordinary Task-bound fork
authority, real-model semantic continuation and crash recovery remain separate
unverified requirements.

[Streaming-loop integration](citation-stream-integration.log) uses a scripted
streamed model to request the old Part ID through the production compaction
tool dispatcher, processor, persisted Tool result and final checkpoint. The
second model step receives the actual copied source bytes and current identity.
This proves local integration of the alias contract, not remote model reasoning.

[Compaction integrity regression](citation-integrity.log) verifies all 13 budget,
projection, completed/incomplete/nonshrinking checkpoint and local HTTP streaming
contracts with the updated Tool declaration. Together with the final reader/copy
and memory runs, this continuation has 47 distinct passing focused tests.
