# Week2: Relational highest-state query
## Timed lesson structure (5 learner hours)
0.5h retrieval/diagnostic;0.75h worked example;1.5h guided experiment;1h transfer challenge;0.5h feedback/retrieval;0.75h reflection/handover. These are design allocations, not measured attendance, learning gain or agent runtime.

Use ROOT as the absolute unpacked course directory. From ROOT/teacher-pack/source execute `python l09_packets.py --source ROOT/source-archive --out <new-packets>` to regenerate all six inputs, or use the supplied ROOT/packets/packetN. The canonical Python is /opt/cpsat/bin/python in the declared offline image; another installed compatible Python/SQLite is allowed. The lab entry is the declared lab_argv from submission.json. Keep STATE across the chain, choose a NEW output for each call. A replacement teacher may start W4 directly with the supplied W3 checkpoint; the full path command is in TEACHER-HANDOVER.

## Objective, prerequisite and SQL worked derivation
Use the real W1 state. State which current observation is selected before interpreting validity. Run l09_worked.py and read query-fragments.sql plus its actual query-fragments-results.json. Fragment1 is the original relation;2 groups tenant/order to find highest revision;3 rejoins that rank to the raw state;4 is an actually equivalent dense_rank window;5 deliberately filters active first and gives the wrong1250/2075 instead of missing/null and cancelled/0.

## Guided steps
1. Execute fragments1–3 one at a time and annotate each relation's key. Explain why joining only on order_id would mix tenants. Do not select the largest amount or first-arriving row.
2. Call `--data ROOT/packets/packet2 --state STATE --out NEW --route guided` on the same W1 state; no new events are introduced. Read the actual queries.sql, selected source_ids and current totals.
3. Find one tenant/order in raw rows and prove its selected revision/source. The worked missing/cancelled examples illustrate later lessons; do not silently replace unknown with old active values.

## Challenge and assessment
Run the challenge route on a clean equivalent W1 state and W2 packet. Compare complete state/lineage/totals with guided, ignoring row order; explain OVER/PARTITION/rank versus grouped MAX/join. Correct alternative SQL gets identical marks. Retrieval: which predicate ordering error does valid-first selection introduce? Submit intermediate relations and a counterexample, not a screenshot of final totals alone.

## Support and submission
Use keyboard commands and text/CSV companions; consult GLOSSARY and the worked mini-case before the larger archive. Request the supplied language/format support without lowering the same business standard. Submit source-linked evidence and a short mechanism explanation; this constructed response does not establish a stable learner trait.
