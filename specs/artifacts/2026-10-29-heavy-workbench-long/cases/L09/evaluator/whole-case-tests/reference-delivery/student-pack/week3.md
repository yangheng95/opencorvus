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
