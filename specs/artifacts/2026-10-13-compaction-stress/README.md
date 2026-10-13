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
