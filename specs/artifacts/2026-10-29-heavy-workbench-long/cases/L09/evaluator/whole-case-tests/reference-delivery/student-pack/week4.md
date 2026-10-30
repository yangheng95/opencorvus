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
