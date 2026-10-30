# Week3: Committed write and original-request replay
## Timed lesson structure (5 learner hours)
0.5h retrieval/diagnostic;0.75h worked example;1.5h guided experiment;1h transfer challenge;0.5h feedback/retrieval;0.75h reflection/handover. These are design allocations, not measured attendance, learning gain or agent runtime.

Use ROOT as the absolute unpacked course directory. From ROOT/teacher-pack/source execute `python l09_packets.py --source ROOT/source-archive --out <new-packets>` to regenerate all six inputs, or use the supplied ROOT/packets/packetN. The canonical Python is /opt/cpsat/bin/python in the declared offline image; another installed compatible Python/SQLite is allowed. The lab entry is the declared lab_argv from submission.json. Keep STATE across the chain, choose a NEW output for each call. A replacement teacher may start W4 directly with the supplied W3 checkpoint; the full path command is in TEACHER-HANDOVER.

## Objective and prerequisite
Use the actual W1/W2 state, not a new database. Separate committed work from an acknowledgement. Read the supplied unsafe initial-teaching-note v1; it is a historical draft to audit, not authority. Predict the consequence of recreating state when only W3 incremental rows are available.

## Real committed-write experiment
1. Call the lab entry with `--data ROOT/packets/packet3 --state STATE --out CRASH_OUT --route guided --crash-after-commit`. Expected native code is73. Inspect CRASH_OUT/committed.json and checkpoint.json, including W3 receipt and the preserved W1 rows. A committed result can exist despite no normal answer.
2. Keep exactly STATE and packet3/requestW3. Call the original command without the crash flag, with a NEW output. Expected normal code0, replayed=true and the original W3 receipt. Compare journal identities and counts before/after; do not append duplicate money or use a fresh request.
3. Preserve the original crash and replay outputs. A native2/schema error is not this planned73; stop and inspect its actual cause rather than deleting state. This exercise tests process exit after a real SQLite commit; power loss, real distributed transport and all storage backends remain unqualified.

## Scaffold, challenge and evidence
Use a receipt/journal checklist before retry; the glossary defines commit/ACK. Advanced students explain the transaction boundary, demonstrate why packet3 alone cannot reconstruct W1, and compare a constructed reset-on-retry program's lost state to the valid run. Assess the durable receipt, same-key result and preserved history separately. The revised recovery rule is supported by actual objects, not by a fictitious learner outcome.

## Support and submission
Use keyboard commands and text/CSV companions; consult GLOSSARY and the worked mini-case before the larger archive. Request the supplied language/format support without lowering the same business standard. Submit source-linked evidence and a short mechanism explanation; this constructed response does not establish a stable learner trait.

## Teacher-only actual answer and debrief
Native exit 0; actual runtime 1.69131s is not learner/agent time. Original full objects are ROOT/evidence/guided/lab3/lab.json and checkpoint.json; executed SQL and actual-native.json are alongside.

Receipt: {"equivalent_repeats": 3, "new_records": 9, "received": 12, "rejected": 0, "request_id": "W3"}; replayed=True; journal=33. Known tenant cents={'East': 129000, 'North': 9000, 'South': 69000}; future sources=[].

|tenant|order|revision|status|cents|source IDs|
|---|---|---:|---|---:|---|
|East|O1|2|ready|20875|['East-C1']|
|East|O2|2|cancelled|0|['East-C2']|
|East|O3|2|missing|None|['East-C3']|
|East|O4|1|ready|21425|['East-E4']|
|East|O5|1|ready|21525|['East-E5']|
|East|O6|1|ready|21625|['East-E6']|
|East|O7|1|ready|21725|['East-E7']|
|East|O8|1|ready|21825|['East-E8']|
|North|O1|2|ready|875|['North-C1']|
|North|O2|2|cancelled|0|['North-C2']|
|North|O3|2|missing|None|['North-C3']|
|North|O4|1|ready|1425|['North-E4']|
|North|O5|1|ready|1525|['North-E5']|
|North|O6|1|ready|1625|['North-E6']|
|North|O7|1|ready|1725|['North-E7']|
|North|O8|1|ready|1825|['North-E8']|
|South|O1|2|ready|10875|['South-C1']|
|South|O2|2|cancelled|0|['South-C2']|
|South|O3|2|missing|None|['South-C3']|
|South|O4|1|ready|11425|['South-E4']|
|South|O5|1|ready|11525|['South-E5']|
|South|O6|1|ready|11625|['South-E6']|
|South|O7|1|ready|11725|['South-E7']|
|South|O8|1|ready|11825|['South-E8']|

Do not copy these source-dependent answer numbers into a new dataset. Rerun the actual declared answer on changed data and reason from the original raw facts. Full conceptual credit requires the mechanism and boundary; partial credit may retain a correct outcome with an incomplete mechanism, while a contradictory key/authority/retry claim earns zero for that concept. Functional and explanatory marks remain separate.

Inspect ROOT/evidence/guided/lab3-commit-exit/committed.json and the retry receipt for this supplied input: received12/new9/equivalent repeats3, with33 canonical rows. Compare the constructed reset-on-retry work: R2 counterexample should locate replayed=false or the lost W1 history. Modified input may alter counts; regenerate from its actual original objects.
