# Week4: Late data, conflicts and incident explanation
## Timed lesson structure (5 learner hours)
0.5h retrieval/diagnostic;0.75h worked example;1.5h guided experiment;1h transfer challenge;0.5h feedback/retrieval;0.75h reflection/handover. These are design allocations, not measured attendance, learning gain or agent runtime.

Use ROOT as the absolute unpacked course directory. From ROOT/teacher-pack/source execute `python l09_packets.py --source ROOT/source-archive --out <new-packets>` to regenerate all six inputs, or use the supplied ROOT/packets/packetN. The canonical Python is /opt/cpsat/bin/python in the declared offline image; another installed compatible Python/SQLite is allowed. The lab entry is the declared lab_argv from submission.json. Keep STATE across the chain, choose a NEW output for each call. A replacement teacher may start W4 directly with the supplied W3 checkpoint; the full path command is in TEACHER-HANDOVER.

## Objective and restartable entry
Diagnose three different phenomena: older late version, source disagreement and future publication. Use actual W3 state or restore ROOT/handover/checkpoint.json into a new STATE with `--restore ROOT/handover/checkpoint.json`, then run packet4. The supplied packet and ROOT/evidence/guided/lab4/{lab,checkpoint}.json provide a complete teacher reference; a final database is not the only seed.

## Guided incident work
1. Inspect L5 revision0 and the current O5 revision1: the late row belongs in the journal, not the current value. Record both source references instead of dropping evidence.
2. Compare X4a/X4b at revision2 for O4. Same highest rank with different payloads is conflict/null, not first-wins or an average. East's two WIRE payloads are a wire_conflict holding the affected order; no adjudication is supplied.
3. Locate F6 publishedJan15. W4 clockJan10 cannot use it; retain the future row but show exclusion. Distinguish missing/null, conflict/null and cancelled/0 in totals and narrative.
4. Reconcile current known amounts by tenant, list every withheld/future/rejected source, and explain the before/current changes. A held amount contributing0 to a total is not an assertion of a known zero observation.

## Challenge and transfer
Formulate the reconciliation as SQL or a source-indexed table. Change a legitimate value or add a new tenant/late record, rerun a clean copy, and predict exactly which state changes. Explain what further data/authority would resolve each hold; do not invent approval. Deliver an incident handover with source/action/owner, not only a risk-list heading.

## Support and submission
Use keyboard commands and text/CSV companions; consult GLOSSARY and the worked mini-case before the larger archive. Request the supplied language/format support without lowering the same business standard. Submit source-linked evidence and a short mechanism explanation; this constructed response does not establish a stable learner trait.

## Teacher-only actual answer and debrief
Native exit 0; actual runtime 1.68399s is not learner/agent time. Original full objects are ROOT/evidence/guided/lab4/lab.json and checkpoint.json; executed SQL and actual-native.json are alongside.

Receipt: {"equivalent_repeats": 0, "new_records": 14, "received": 14, "rejected": 0, "request_id": "W4"}; replayed=False; journal=47. Known tenant cents={'East': 85750, 'North': 7575, 'South': 57575}; future sources=['East-F6', 'North-F6', 'South-F6'].

|tenant|order|revision|status|cents|source IDs|
|---|---|---:|---|---:|---|
|East|O1|2|ready|20875|['East-C1']|
|East|O2|2|cancelled|0|['East-C2']|
|East|O3|2|missing|None|['East-C3']|
|East|O4|2|conflict|None|['East-X4a', 'East-X4b']|
|East|O5|1|ready|21525|['East-E5']|
|East|O6|1|ready|21625|['East-E6']|
|East|O7|1|ready|21725|['East-E7']|
|East|O8|2|wire_conflict|None|['wire-A', 'wire-B']|
|North|O1|2|ready|875|['North-C1']|
|North|O2|2|cancelled|0|['North-C2']|
|North|O3|2|missing|None|['North-C3']|
|North|O4|2|conflict|None|['North-X4a', 'North-X4b']|
|North|O5|1|ready|1525|['North-E5']|
|North|O6|1|ready|1625|['North-E6']|
|North|O7|1|ready|1725|['North-E7']|
|North|O8|1|ready|1825|['North-E8']|
|South|O1|2|ready|10875|['South-C1']|
|South|O2|2|cancelled|0|['South-C2']|
|South|O3|2|missing|None|['South-C3']|
|South|O4|2|conflict|None|['South-X4a', 'South-X4b']|
|South|O5|1|ready|11525|['South-E5']|
|South|O6|1|ready|11625|['South-E6']|
|South|O7|1|ready|11725|['South-E7']|
|South|O8|1|ready|11825|['South-E8']|

Do not copy these source-dependent answer numbers into a new dataset. Rerun the actual declared answer on changed data and reason from the original raw facts. Full conceptual credit requires the mechanism and boundary; partial credit may retain a correct outcome with an incomplete mechanism, while a contradictory key/authority/retry claim earns zero for that concept. Functional and explanatory marks remain separate.
