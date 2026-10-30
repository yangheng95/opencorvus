# Week1: Exact intake and identities
## Timed lesson structure (5 learner hours)
0.5h retrieval/diagnostic;0.75h worked example;1.5h guided experiment;1h transfer challenge;0.5h feedback/retrieval;0.75h reflection/handover. These are design allocations, not measured attendance, learning gain or agent runtime.

Use ROOT as the absolute unpacked course directory. From ROOT/teacher-pack/source execute `python l09_packets.py --source ROOT/source-archive --out <new-packets>` to regenerate all six inputs, or use the supplied ROOT/packets/packetN. The canonical Python is /opt/cpsat/bin/python in the declared offline image; another installed compatible Python/SQLite is allowed. The lab entry is the declared lab_argv from submission.json. Keep STATE across the chain, choose a NEW output for each call. A replacement teacher may start W4 directly with the supplied W3 checkpoint; the full path command is in TEACHER-HANDOVER.

## Objective, prerequisite and worked intake
Prerequisite: reading a CSV field and doing decimal addition; no SQL required. Identify row_id versus wire versus business key, convert exact USD cents, and preserve typed rejection evidence. Read GLOSSARY first. Run `python l09_worked.py --out <new-worked>`; compare worked/two-row-intake.csv and intake-results.json. Example-A/shared and Example-B/shared are distinct;12.50→1250 cents and20.75→2075. Changing amount to1.005 gives amount_grid, not a rounded accepted row.

## Guided steps
1. Open packet1/events.csv as text; identify tenant/event/order, publication and status before summing money. Predict which four malformed records are rejected and name their field contract.
2. Call the lab entry `--data ROOT/packets/packet1 --state STATE --out NEW --route guided`. Compare raw received count with new journal count, rejected rows and the original W1 receipt. Trace two tenants sharing E1/O1 to separate normalized rows.
3. Inspect checkpoint.journal and rejected source references. Explain how a repeat can be a transport observation without new business value. Keep raw input unchanged; do not repair malformed rows by rounding.

## Challenge and retrieval
Construct a new valid tenant sharing an order/event spelling; predict identity and cent changes, then run a new independent copy. Explain why a row identifier, request identifier and business identifier serve different purposes. Advanced students can express exact conversion with rational arithmetic in another language; same evidence standard applies. Deliver a field mapping, original receipt and one source-bound rejection explanation, not a score inferred from experience.

## Support and submission
Use keyboard commands and text/CSV companions; consult GLOSSARY and the worked mini-case before the larger archive. Request the supplied language/format support without lowering the same business standard. Submit source-linked evidence and a short mechanism explanation; this constructed response does not establish a stable learner trait.

## Teacher-only actual answer and debrief
Native exit 0; actual runtime 1.48401s is not learner/agent time. Original full objects are ROOT/evidence/guided/lab1/lab.json and checkpoint.json; executed SQL and actual-native.json are alongside.

Receipt: {"equivalent_repeats": 0, "new_records": 24, "received": 28, "rejected": 4, "request_id": "W1"}; replayed=False; journal=24. Known tenant cents={'East': 171800, 'North': 11800, 'South': 91800}; future sources=[].

|tenant|order|revision|status|cents|source IDs|
|---|---|---:|---|---:|---|
|East|O1|1|ready|21125|['East-E1']|
|East|O2|1|ready|21225|['East-E2']|
|East|O3|1|ready|21325|['East-E3']|
|East|O4|1|ready|21425|['East-E4']|
|East|O5|1|ready|21525|['East-E5']|
|East|O6|1|ready|21625|['East-E6']|
|East|O7|1|ready|21725|['East-E7']|
|East|O8|1|ready|21825|['East-E8']|
|North|O1|1|ready|1125|['North-E1']|
|North|O2|1|ready|1225|['North-E2']|
|North|O3|1|ready|1325|['North-E3']|
|North|O4|1|ready|1425|['North-E4']|
|North|O5|1|ready|1525|['North-E5']|
|North|O6|1|ready|1625|['North-E6']|
|North|O7|1|ready|1725|['North-E7']|
|North|O8|1|ready|1825|['North-E8']|
|South|O1|1|ready|11125|['South-E1']|
|South|O2|1|ready|11225|['South-E2']|
|South|O3|1|ready|11325|['South-E3']|
|South|O4|1|ready|11425|['South-E4']|
|South|O5|1|ready|11525|['South-E5']|
|South|O6|1|ready|11625|['South-E6']|
|South|O7|1|ready|11725|['South-E7']|
|South|O8|1|ready|11825|['South-E8']|

Do not copy these source-dependent answer numbers into a new dataset. Rerun the actual declared answer on changed data and reason from the original raw facts. Full conceptual credit requires the mechanism and boundary; partial credit may retain a correct outcome with an incomplete mechanism, while a contradictory key/authority/retry claim earns zero for that concept. Functional and explanatory marks remain separate.
