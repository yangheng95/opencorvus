"""Substantive per-lesson handouts; data results remain original execution facts."""
import json
GLOSSARY='''# Field and reasoning glossary

| Term | Operational meaning | Common mistake to test |
|---|---|---|
| row_id | Original row evidence reference; retained in lineage | Using a displayed total instead of its source |
| tenant,event_id | A wire identity within one tenant | Assuming E1 is globally unique |
| tenant,order_id | Current business identity | Grouping all tenants' O1 together |
| revision | Source version, including missing/cancelled | Filtering valid/active before selecting highest |
| released_at / as_of | Canonical UTC publication / allowed clock | Treating a future release as currently eligible |
| received batch | When this experiment actually acquired a row | Dropping an old-version late row from history |
| amount / amount_minor | Decimal USD / exact integer cents | Binary float rounding1.005 into a valid cent |
| missing / cancelled | Unknown held value / known zero | Replacing unknown with an older active value |
| conflict / wire_conflict | Highest payload disagreement / conflicting immutable wire | First-arrival wins without explicit adjudication |
| request_id | Stable transport/application request for an original receipt | New key after an unacknowledged commit |
| commit / ACK | Durable transaction / later acknowledgement | Interpreting missing ACK as no committed state |
| checkpoint | Versioned journal, receipts, rejects and audit for restore | Final totals alone or deletion of accepted history |
| principal / requested tenant | Authority / untrusted target | Treating caller-selected target as permission |
| scripted rehearsal | Constructed program/operator trial | Claiming observed human learning or production proof |
'''
REFERENCES='''# Interface references

The business semantics and teaching commission are original synthetic material. No learning-effect claim is derived from these links.

- [SQLite transaction semantics](https://www.sqlite.org/lang_transaction.html): transaction/commit boundaries support interpreting the actual committed-write experiment. This run tests process exit/restart, not arbitrary power loss.
- [SQLite window functions](https://www.sqlite.org/windowfunctions.html): OVER/PARTITION and ranking support the correct alternative SQL route. Query equivalence here is also actually executed, not inferred from syntax alone.

Use the exact declared offline image/runtime for reproduction. A documentation link is not an acceptance test, security certification or validation of the course's human learning effect.
'''
def render(n,observed,native):
 header=f'# Week{n}: '+['Exact intake and identities','Relational highest-state query','Committed write and original-request replay','Late data, conflicts and incident explanation','Principal-scoped access and durable audit','Transfer, assessment and operational handover'][n-1]
 common='''\n## Timed lesson structure (5 learner hours)
0.5h retrieval/diagnostic;0.75h worked example;1.5h guided experiment;1h transfer challenge;0.5h feedback/retrieval;0.75h reflection/handover. These are design allocations, not measured attendance, learning gain or agent runtime.
'''
 setup='''\nUse ROOT as the absolute unpacked course directory. From ROOT/teacher-pack/source execute `python l09_packets.py --source ROOT/source-archive --out <new-packets>` to regenerate all six inputs, or use the supplied ROOT/packets/packetN. The canonical Python is /opt/cpsat/bin/python in the declared offline image; another installed compatible Python/SQLite is allowed. The lab entry is the declared lab_argv from submission.json. Keep STATE across the chain, choose a NEW output for each call. A replacement teacher may start W4 directly with the supplied W3 checkpoint; the full path command is in TEACHER-HANDOVER.
'''
 body={
 1:'''## Objective, prerequisite and worked intake
Prerequisite: reading a CSV field and doing decimal addition; no SQL required. Identify row_id versus wire versus business key, convert exact USD cents, and preserve typed rejection evidence. Read GLOSSARY first. Run `python l09_worked.py --out <new-worked>`; compare worked/two-row-intake.csv and intake-results.json. Example-A/shared and Example-B/shared are distinct;12.50→1250 cents and20.75→2075. Changing amount to1.005 gives amount_grid, not a rounded accepted row.

## Guided steps
1. Open packet1/events.csv as text; identify tenant/event/order, publication and status before summing money. Predict which four malformed records are rejected and name their field contract.
2. Call the lab entry `--data ROOT/packets/packet1 --state STATE --out NEW --route guided`. Compare raw received count with new journal count, rejected rows and the original W1 receipt. Trace two tenants sharing E1/O1 to separate normalized rows.
3. Inspect checkpoint.journal and rejected source references. Explain how a repeat can be a transport observation without new business value. Keep raw input unchanged; do not repair malformed rows by rounding.

## Challenge and retrieval
Construct a new valid tenant sharing an order/event spelling; predict identity and cent changes, then run a new independent copy. Explain why a row identifier, request identifier and business identifier serve different purposes. Advanced students can express exact conversion with rational arithmetic in another language; same evidence standard applies. Deliver a field mapping, original receipt and one source-bound rejection explanation, not a score inferred from experience.
''',
 2:'''## Objective, prerequisite and SQL worked derivation
Use the real W1 state. State which current observation is selected before interpreting validity. Run l09_worked.py and read query-fragments.sql plus its actual query-fragments-results.json. Fragment1 is the original relation;2 groups tenant/order to find highest revision;3 rejoins that rank to the raw state;4 is an actually equivalent dense_rank window;5 deliberately filters active first and gives the wrong1250/2075 instead of missing/null and cancelled/0.

## Guided steps
1. Execute fragments1–3 one at a time and annotate each relation's key. Explain why joining only on order_id would mix tenants. Do not select the largest amount or first-arriving row.
2. Call `--data ROOT/packets/packet2 --state STATE --out NEW --route guided` on the same W1 state; no new events are introduced. Read the actual queries.sql, selected source_ids and current totals.
3. Find one tenant/order in raw rows and prove its selected revision/source. The worked missing/cancelled examples illustrate later lessons; do not silently replace unknown with old active values.

## Challenge and assessment
Run the challenge route on a clean equivalent W1 state and W2 packet. Compare complete state/lineage/totals with guided, ignoring row order; explain OVER/PARTITION/rank versus grouped MAX/join. Correct alternative SQL gets identical marks. Retrieval: which predicate ordering error does valid-first selection introduce? Submit intermediate relations and a counterexample, not a screenshot of final totals alone.
''',
 3:'''## Objective and prerequisite
Use the actual W1/W2 state, not a new database. Separate committed work from an acknowledgement. Read the supplied unsafe initial-teaching-note v1; it is a historical draft to audit, not authority. Predict the consequence of recreating state when only W3 incremental rows are available.

## Real committed-write experiment
1. Call the lab entry with `--data ROOT/packets/packet3 --state STATE --out CRASH_OUT --route guided --crash-after-commit`. Expected native code is73. Inspect CRASH_OUT/committed.json and checkpoint.json, including W3 receipt and the preserved W1 rows. A committed result can exist despite no normal answer.
2. Keep exactly STATE and packet3/requestW3. Call the original command without the crash flag, with a NEW output. Expected normal code0, replayed=true and the original W3 receipt. Compare journal identities and counts before/after; do not append duplicate money or use a fresh request.
3. Preserve the original crash and replay outputs. A native2/schema error is not this planned73; stop and inspect its actual cause rather than deleting state. This exercise tests process exit after a real SQLite commit; power loss, real distributed transport and all storage backends remain unqualified.

## Scaffold, challenge and evidence
Use a receipt/journal checklist before retry; the glossary defines commit/ACK. Advanced students explain the transaction boundary, demonstrate why packet3 alone cannot reconstruct W1, and compare a constructed reset-on-retry program's lost state to the valid run. Assess the durable receipt, same-key result and preserved history separately. The revised recovery rule is supported by actual objects, not by a fictitious learner outcome.
''',
 4:'''## Objective and restartable entry
Diagnose three different phenomena: older late version, source disagreement and future publication. Use actual W3 state or restore ROOT/handover/checkpoint.json into a new STATE with `--restore ROOT/handover/checkpoint.json`, then run packet4. The supplied packet and ROOT/evidence/guided/lab4/{lab,checkpoint}.json provide a complete teacher reference; a final database is not the only seed.

## Guided incident work
1. Inspect L5 revision0 and the current O5 revision1: the late row belongs in the journal, not the current value. Record both source references instead of dropping evidence.
2. Compare X4a/X4b at revision2 for O4. Same highest rank with different payloads is conflict/null, not first-wins or an average. East's two WIRE payloads are a wire_conflict holding the affected order; no adjudication is supplied.
3. Locate F6 publishedJan15. W4 clockJan10 cannot use it; retain the future row but show exclusion. Distinguish missing/null, conflict/null and cancelled/0 in totals and narrative.
4. Reconcile current known amounts by tenant, list every withheld/future/rejected source, and explain the before/current changes. A held amount contributing0 to a total is not an assertion of a known zero observation.

## Challenge and transfer
Formulate the reconciliation as SQL or a source-indexed table. Change a legitimate value or add a new tenant/late record, rerun a clean copy, and predict exactly which state changes. Explain what further data/authority would resolve each hold; do not invent approval. Deliver an incident handover with source/action/owner, not only a risk-list heading.
''',
 5:'''## Objective and policy source
Authorize from packet.principals; the requested tenant is untrusted. The original four requests are own North, cross South by north_reader, unknown principal to East, and admin all. Expected policy decisions are allow/deny/deny/allow. Do not infer authority from a URL, self-score or a correctly calculated total.

## Guided access/audit experiment
1. On the actual W4 state run packet5. Predict each principal role and target before executing.
2. For own scope inspect actual state/amounts and ensure another tenant's data is absent. For cross/unknown examine permission_denied with empty states/totals; an error message alongside leaked rows still fails.
3. For teacher admin verify all actual current tenants, including an added tenant in a changed input. Compare each query_id to the durable principal/request/decision audit. A scoped query and an audit record are different evidence.
4. Explain how a numerically correct implementation can still disclose unauthorized data. Use the actual constructed access-error coursework and its A-item counterexamples as teacher feedback, not as proof of a real person's competence.

## Challenge and retrieval
Add a legitimate new tenant/reader and write own/cross/admin requests; use policy-driven decisions rather than hardcoded names. Describe who could access the audit in a real system and why this instructional CLI is not a production security certification. Submit query decisions and source/policy evidence; correct alternate languages keep the same marks.
''',
 6:'''## Objective, complete chain and final incident
Run packet6 on the same state; the clock advances toJan20. R4/R3 higher unique revisions resolve the ordinary O4 conflict/O3 missing state, Jan15 F6 becomes eligible, Jan25 CF7 remains future, and an unresolved wire conflict stays held. Do not erase the original event/receipt history to make the final total attractive.

## Guided synthesis
1. Compare W4/W6 state and source lineage for O3/O4/O6/O7/O8. Reconcile current known tenant totals and explain every held/zero/future category with a raw source and rule.
2. Restore the actual W3 checkpoint into a second fresh state and repeat W4 using TEACHER-HANDOVER. Compare the full checkpoint/receipt/current state, not only a total; the supplied original packet, source and native receipts make this later lesson independent.
3. Use the paired pre/post forms' same constructs and2/1/0 conceptual anchors. The fixed20 functional items give domain partial marks; a wrong access policy and wrong current-state arithmetic are different failures. The actual unfamiliar correct window SQL and join implementation both earn full functional credit.

## Challenge, debrief and honest measurement
Audit unfamiliar work with source-bound observed/expected fields. Defend a different correct implementation; reject filename/style grading and a blanket all-full policy. Propose an authorized human learning study with suitable baseline/outcome/limitations, but do not claim one happened here. Complete the teacher handover with raw inputs, declared source, exact new-state/new-output commands, retry/stop rules, actual tables/figures and remaining uncertainty. Teacher/student material separation is instructional, not an access-control certification.
'''}[n]
 manual=header+common+setup+'\n'+body+'\n## Support and submission\nUse keyboard commands and text/CSV companions; consult GLOSSARY and the worked mini-case before the larger archive. Request the supplied language/format support without lowering the same business standard. Submit source-linked evidence and a short mechanism explanation; this constructed response does not establish a stable learner trait.\n'
 states=observed['snapshot']['states'];table='|tenant|order|revision|status|cents|source IDs|\n|---|---|---:|---|---:|---|\n'+'\n'.join('|'+ '|'.join(str(x[k]) for k in ('tenant','order_id','revision','status','amount_minor','source_ids'))+'|' for x in states)
 teacher=manual+f"\n## Teacher-only actual answer and debrief\nNative exit {native['exit_code']}; actual runtime {native['wall_seconds']:.5f}s is not learner/agent time. Original full objects are ROOT/evidence/guided/lab{n}/lab.json and checkpoint.json; executed SQL and actual-native.json are alongside.\n\nReceipt: {json.dumps(observed['receipt'],sort_keys=True)}; replayed={observed['replayed']}; journal={observed['journal_count']}. Known tenant cents={observed['snapshot']['totals_minor']}; future sources={observed['snapshot']['future_rows']}.\n\n{table}\n\nDo not copy these source-dependent answer numbers into a new dataset. Rerun the actual declared answer on changed data and reason from the original raw facts. Full conceptual credit requires the mechanism and boundary; partial credit may retain a correct outcome with an incomplete mechanism, while a contradictory key/authority/retry claim earns zero for that concept. Functional and explanatory marks remain separate.\n"
 if n==3:teacher+=f"\nInspect ROOT/evidence/guided/lab3-commit-exit/committed.json and the retry receipt for this supplied input: received{observed['receipt']['received']}/new{observed['receipt']['new_records']}/equivalent repeats{observed['receipt']['equivalent_repeats']}, with{observed['journal_count']} canonical rows. Compare the constructed reset-on-retry work: R2 counterexample should locate replayed=false or the lost W1 history. Modified input may alter counts; regenerate from its actual original objects.\n"
 if n==5:teacher+='\nActual query decisions: '+json.dumps(observed['access'],ensure_ascii=False)+'\nAudit: '+json.dumps(observed['audit'],ensure_ascii=False)+'\n'
 return manual,teacher
