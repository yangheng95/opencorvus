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
