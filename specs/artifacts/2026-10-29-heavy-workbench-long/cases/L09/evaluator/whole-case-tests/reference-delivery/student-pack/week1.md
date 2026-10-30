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
