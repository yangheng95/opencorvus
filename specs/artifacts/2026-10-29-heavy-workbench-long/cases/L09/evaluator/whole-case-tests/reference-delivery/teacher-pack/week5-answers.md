# Week5: Principal-scoped access and durable audit
## Timed lesson structure (5 learner hours)
0.5h retrieval/diagnostic;0.75h worked example;1.5h guided experiment;1h transfer challenge;0.5h feedback/retrieval;0.75h reflection/handover. These are design allocations, not measured attendance, learning gain or agent runtime.

Use ROOT as the absolute unpacked course directory. From ROOT/teacher-pack/source execute `python l09_packets.py --source ROOT/source-archive --out <new-packets>` to regenerate all six inputs, or use the supplied ROOT/packets/packetN. The canonical Python is /opt/cpsat/bin/python in the declared offline image; another installed compatible Python/SQLite is allowed. The lab entry is the declared lab_argv from submission.json. Keep STATE across the chain, choose a NEW output for each call. A replacement teacher may start W4 directly with the supplied W3 checkpoint; the full path command is in TEACHER-HANDOVER.

## Objective and policy source
Authorize from packet.principals; the requested tenant is untrusted. The original four requests are own North, cross South by north_reader, unknown principal to East, and admin all. Expected policy decisions are allow/deny/deny/allow. Do not infer authority from a URL, self-score or a correctly calculated total.

## Guided access/audit experiment
1. On the actual W4 state run packet5. Predict each principal role and target before executing.
2. For own scope inspect actual state/amounts and ensure another tenant's data is absent. For cross/unknown examine permission_denied with empty states/totals; an error message alongside leaked rows still fails.
3. For teacher admin verify all actual current tenants, including an added tenant in a changed input. Compare each query_id to the durable principal/request/decision audit. A scoped query and an audit record are different evidence.
4. Explain how a numerically correct implementation can still disclose unauthorized data. Use the actual constructed access-error coursework and its A-item counterexamples as teacher feedback, not as proof of a real person's competence.

## Challenge and retrieval
Add a legitimate new tenant/reader and write own/cross/admin requests; use policy-driven decisions rather than hardcoded names. Describe who could access the audit in a real system and why this instructional CLI is not a production security certification. Submit query decisions and source/policy evidence; correct alternate languages keep the same marks.

## Support and submission
Use keyboard commands and text/CSV companions; consult GLOSSARY and the worked mini-case before the larger archive. Request the supplied language/format support without lowering the same business standard. Submit source-linked evidence and a short mechanism explanation; this constructed response does not establish a stable learner trait.

## Teacher-only actual answer and debrief
Native exit 0; actual runtime 1.37869s is not learner/agent time. Original full objects are ROOT/evidence/guided/lab5/lab.json and checkpoint.json; executed SQL and actual-native.json are alongside.

Receipt: {"equivalent_repeats": 0, "new_records": 0, "received": 0, "rejected": 0, "request_id": "W5"}; replayed=False; journal=47. Known tenant cents={'East': 85750, 'North': 7575, 'South': 57575}; future sources=['East-F6', 'North-F6', 'South-F6'].

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

Actual query decisions: [{"id": "own", "status": "allowed", "states": [{"tenant": "North", "order_id": "O1", "revision": 2, "status": "ready", "amount_minor": 875, "source_ids": ["North-C1"]}, {"tenant": "North", "order_id": "O2", "revision": 2, "status": "cancelled", "amount_minor": 0, "source_ids": ["North-C2"]}, {"tenant": "North", "order_id": "O3", "revision": 2, "status": "missing", "amount_minor": null, "source_ids": ["North-C3"]}, {"tenant": "North", "order_id": "O4", "revision": 2, "status": "conflict", "amount_minor": null, "source_ids": ["North-X4a", "North-X4b"]}, {"tenant": "North", "order_id": "O5", "revision": 1, "status": "ready", "amount_minor": 1525, "source_ids": ["North-E5"]}, {"tenant": "North", "order_id": "O6", "revision": 1, "status": "ready", "amount_minor": 1625, "source_ids": ["North-E6"]}, {"tenant": "North", "order_id": "O7", "revision": 1, "status": "ready", "amount_minor": 1725, "source_ids": ["North-E7"]}, {"tenant": "North", "order_id": "O8", "revision": 1, "status": "ready", "amount_minor": 1825, "source_ids": ["North-E8"]}], "totals_minor": {"North": 7575}}, {"id": "cross", "status": "denied", "error": "permission_denied", "states": [], "totals_minor": {}}, {"id": "unknown", "status": "denied", "error": "permission_denied", "states": [], "totals_minor": {}}, {"id": "admin", "status": "allowed", "states": [{"tenant": "East", "order_id": "O1", "revision": 2, "status": "ready", "amount_minor": 20875, "source_ids": ["East-C1"]}, {"tenant": "East", "order_id": "O2", "revision": 2, "status": "cancelled", "amount_minor": 0, "source_ids": ["East-C2"]}, {"tenant": "East", "order_id": "O3", "revision": 2, "status": "missing", "amount_minor": null, "source_ids": ["East-C3"]}, {"tenant": "East", "order_id": "O4", "revision": 2, "status": "conflict", "amount_minor": null, "source_ids": ["East-X4a", "East-X4b"]}, {"tenant": "East", "order_id": "O5", "revision": 1, "status": "ready", "amount_minor": 21525, "source_ids": ["East-E5"]}, {"tenant": "East", "order_id": "O6", "revision": 1, "status": "ready", "amount_minor": 21625, "source_ids": ["East-E6"]}, {"tenant": "East", "order_id": "O7", "revision": 1, "status": "ready", "amount_minor": 21725, "source_ids": ["East-E7"]}, {"tenant": "East", "order_id": "O8", "revision": 2, "status": "wire_conflict", "amount_minor": null, "source_ids": ["wire-A", "wire-B"]}, {"tenant": "North", "order_id": "O1", "revision": 2, "status": "ready", "amount_minor": 875, "source_ids": ["North-C1"]}, {"tenant": "North", "order_id": "O2", "revision": 2, "status": "cancelled", "amount_minor": 0, "source_ids": ["North-C2"]}, {"tenant": "North", "order_id": "O3", "revision": 2, "status": "missing", "amount_minor": null, "source_ids": ["North-C3"]}, {"tenant": "North", "order_id": "O4", "revision": 2, "status": "conflict", "amount_minor": null, "source_ids": ["North-X4a", "North-X4b"]}, {"tenant": "North", "order_id": "O5", "revision": 1, "status": "ready", "amount_minor": 1525, "source_ids": ["North-E5"]}, {"tenant": "North", "order_id": "O6", "revision": 1, "status": "ready", "amount_minor": 1625, "source_ids": ["North-E6"]}, {"tenant": "North", "order_id": "O7", "revision": 1, "status": "ready", "amount_minor": 1725, "source_ids": ["North-E7"]}, {"tenant": "North", "order_id": "O8", "revision": 1, "status": "ready", "amount_minor": 1825, "source_ids": ["North-E8"]}, {"tenant": "South", "order_id": "O1", "revision": 2, "status": "ready", "amount_minor": 10875, "source_ids": ["South-C1"]}, {"tenant": "South", "order_id": "O2", "revision": 2, "status": "cancelled", "amount_minor": 0, "source_ids": ["South-C2"]}, {"tenant": "South", "order_id": "O3", "revision": 2, "status": "missing", "amount_minor": null, "source_ids": ["South-C3"]}, {"tenant": "South", "order_id": "O4", "revision": 2, "status": "conflict", "amount_minor": null, "source_ids": ["South-X4a", "South-X4b"]}, {"tenant": "South", "order_id": "O5", "revision": 1, "status": "ready", "amount_minor": 11525, "source_ids": ["South-E5"]}, {"tenant": "South", "order_id": "O6", "revision": 1, "status": "ready", "amount_minor": 11625, "source_ids": ["South-E6"]}, {"tenant": "South", "order_id": "O7", "revision": 1, "status": "ready", "amount_minor": 11725, "source_ids": ["South-E7"]}, {"tenant": "South", "order_id": "O8", "revision": 1, "status": "ready", "amount_minor": 11825, "source_ids": ["South-E8"]}], "totals_minor": {"East": 85750, "North": 7575, "South": 57575}}]
Audit: [{"decision": "allowed", "principal": "teacher", "query_id": "admin", "requested_tenant": "*"}, {"decision": "denied", "principal": "north_reader", "query_id": "cross", "requested_tenant": "South"}, {"decision": "allowed", "principal": "north_reader", "query_id": "own", "requested_tenant": "North"}, {"decision": "denied", "principal": "unknown", "query_id": "unknown", "requested_tenant": "East"}]
