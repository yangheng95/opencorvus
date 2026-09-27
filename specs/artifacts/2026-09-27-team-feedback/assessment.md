# Result: one small self-correction, a business interpretation still missed

The registered run is closed. The original controller exited 0 at 2026-09-27 17:05:17 Shanghai after the Mission's acceptance Tool receipt and completed final reply. Runtime disposal and deletion of the copied auth/models pair were verified. Task `tsk_g00VWPBCxD00HpB2NIEq` and Mission `b6fc7138760eba83` retain their original accepted state; this independent assessment does not rewrite them.

**The complete business-feedback goal did not pass.** The same writer did correct a self-discovered rounding error and republish. A separate interpretation error survived the stage audit, final delivery and Mission acceptance. This is classified as **missed** for that business claim, with a narrower positive observation for the actual same-Task repair route. It is not a reliability estimate, controlled improvement or evolution gain. There is no replacement run.

## What the original reports prove

The production `readExactArtifact` and `readTaskArtifactRef` readers verified all nine relevant Engine artifacts and both original immutable report resources, using a backup obtained through a read-only connection to the original database. No original database or artifact was changed. [reader-receipt.json](reader-receipt.json) preserves the exact identities and byte counts.

[evidence.json](evidence.json) contains the original coordination, continuation, merge, acceptance and full final-report read receipts, plus the relevant stage artifacts. These are read-only exports, not messages introduced into the run.

- [First published report, revision 39](report-r39.md): 7,200 bytes, resource SHA-256 `54429e7bfeb50007c0e320f989ccad079295c1a1e31fc868ac8230f5fea5273f`.
- [Corrected published report, revision 47](report-r47.md): 7,200 bytes, resource SHA-256 `66195766e3d3494b8a117ab338bde726c6d05c43b0644dfad9cc8d492460af00`.
- Their only textual difference is Bronx's July-to-August percentage: `23.42%` became `23.41%`. The exact calculation is `1510 / 6449 × 100 = 23.41448286556…%`. All other report bytes are preserved.
- Independent aggregation from the frozen source matches all 19 displayed numeric workload/closure rows in the corrected report, including totals and rounded percentages. [arithmetic-check.json](arithmetic-check.json) records the actual and expected values. Correct arithmetic does not validate the report's interpretation.

The writer itself identified the rounding discrepancy after its first publication and requested another authorized Turn through `request_orchestrator_decision`. The scheduler used `respond_agent_coordination` and a continuation with explicit evidence/input. Both dispatch results identify the same writer Session `ses_hDHLDWcodZU8L9Mmajga` and original Task. The two real `merge_back` receipts returned commits `fb72c7c9a7997d9f080b3b24b7692243898acc6c` and `5328e09a8f38d0e1074b4bbd68aba45cba2f1953`; two immutable reports followed. This verifies a functioning repair route, not independent discovery of a major error. The scheduler called the rounding issue “material”; this assessment treats 0.01 percentage point, without a changed ranking or recommendation, as a small correction.

## Business interpretation that remained wrong

Both reports say that the remaining count “does not show whether they subsequently closed.” The source directly contradicts that claim at the level of **recorded administrative closure**:

| Creation cohort | Remaining after same-month closure measure | Source-recorded later closure month | Source status for these groups |
| --- | ---: | --- | --- |
| July 2025 | 117 | August 2025 | Closed |
| August 2025 | 391 | September 2025 | Closed |

Every one of the 24 supplied groups has a `closed_month`; the ten groups outside the same-month measure account for exactly these 508 requests. The evidence supports recorded closure in the later month. It still does **not** establish real-world noise resolution, exact response duration, reopening history, service quality, a complete historical opening inventory or causation. Those separate cautions remain valid.

The false unknown matters to the requested explanation of the remaining population: the report presents information already in the extract as unavailable and partly motivates a further measurement request on that basis. This is not another rounding issue. The input supplied the relevant field and did not instruct the team to conceal later closure.

The retained artifacts show how this interpretation persisted. The charter already described a lack of a “complete later-closure view”; the segment analysis states “No opening backlog or later closure.” The brief, audit and writer instructions repeat limitations about later closure. The brief's Core review is `clean` and cites the charter's prohibition as supporting evidence. These are observable claims and source relationships, not proof of the model's internal reasoning or a causal experiment establishing which prompt caused the failure. Broad caution about data completeness should not be confused with the narrower, demonstrable closure-month fact.

The final Mission Tool call `prt_g0VWPSpdv00FezmbDI30` returned the entire corrected Markdown: 7,200/7,200 bytes, `complete=true`, `truncated=false`, including the false sentence. Its accepted read reference `ar_JmMDqh5t4yJUuW9f` names that resource. Mission acceptance followed in `prt_g0VWPT8Wo00jJPh2owKR`; the final reply `msg_g0VWPT9YY00BqqYcwRXz` settled before cleanup. Thus the failure cannot be attributed simply to the final report never being delivered to the Mission Tool. The original serialized Provider context is not a complete attention trace.

Only the existing brief-targeted Core FactCheckReview was persisted; no later report-targeted review was created. Mission did inspect the final report, but accepted the incorrect interpretation. The small writer correction is therefore not evidence that the whole independent-review obligation succeeded.

## Other observed team behavior

The fact-checker initially reported that the insight brief was missing. The original brief, revision 22, predates its queries; those queries excluded Engine sources or combined mismatching filters. The scheduler returned exact evidence through native coordination and continued the same reviewer Session, which then published the brief audit. This is a real recovery of a source judgment, separately recorded from the missed business interpretation. The scheduler's “now available” wording does not establish a new publication: the original timestamp shows the brief was already present.

The performance and segment branches were dispatched through separate `dispatch_agent` calls, with the second request following the first branch's completion and explicitly including its performance result as input. The actual dispatch receipts returned acceptance promptly. This confirms serial dispatch and an added informational dependency, not a reproduced failure of a requested parallel batch. No claim is made that the live Provider tool definitions or every shared scheduling entry point were audited here; no scheduling refactor follows automatically from this observation.

## Usage and limits

The native audit contains 315 streaming requests for exactly `gpt-5.6-luna`, all with HTTP 200. The original native usage table contains 312 rows, all `openai/gpt-5.6-luna`, purpose `session`, locally marked priced:

| Recorded measure | Total |
| --- | ---: |
| Input tokens | 2,622,230 |
| Output tokens | 117,678 |
| Reasoning tokens | 13,663 |
| Cache-read tokens | 18,351,104 |
| Cache-write tokens | 0 |
| Total recorded tokens | 21,104,675 |
| Local recorded cost (USD) | 0 |

The provider-activity records have 309 logical requests with done outcomes: 306 record one attempt and three record two attempts, for 312 recorded attempts. These sources have different counting scopes. The native HTTP audit does not retain a request identity or timestamp per entry, so a complete per-request join and billing reconciliation has not been established. Equal or differing counts are not used to invent missing charges or a cancellation cause. Local cost 0 is not a free-service claim or invoice; complete external billing remains unknown. [run-receipt.json](run-receipt.json) retains these distinctions.

## Decision

The feedback transport is demonstrably capable of continuing the original worker, re-merging and preserving other report bytes. The larger unresolved issue is a judgment accepting an upstream interpretation despite contradictory source fields. Adding another role, schema, ledger or generic scheduling gate is not justified by this result. Preserve this closed run and its failure; any next mechanism intervention requires its own evidence, scope and independent registration. The user's external-calibration correction and this result take priority in the scheduled Opus handback.
