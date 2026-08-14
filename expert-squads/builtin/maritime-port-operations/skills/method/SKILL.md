---
name: maritime-port-operations-method
description: Prepare source-grounded maritime-port evidence across vessel calls, berth compatibility, nautical-service dependencies, terminal yard and gate flow, cargo documents, Verified Gross Mass status, dangerous-goods declaration status, and custody handoffs. Use for bounded port-operations reviews requiring qualified human decisions; never use to navigate, clear, dispatch, handle, classify, release, or direct emergency activity.
---

# Maritime Port Operations Method

## Freeze scope, identity and authority

1. Record port, terminal, berth, anchorage, operating area, jurisdiction, vessel-call/voyage, cargo operation, accountable owner, evidence cutoff, time zone, authorized data boundary and excluded actions.
2. Establish stable IDs for vessel IMO/MMSI, call, voyage, berth, service, cargo unit, container, booking, bill of lading, manifest, document, equipment resource, yard block, appointment and custody event. Do not join ambiguous identities.
3. Preserve value, unit, source URI or controlled-document location, issuing authority, source version, effective date, observation date, owner, qualified reviewer, applicability, uncertainty and status. Missing evidence remains unknown.
4. Accept dimensional, nautical, berth, capacity, VGM, dangerous-goods, customs, security and clearance criteria only from current named authorities. Do not import example thresholds.

Use [the port baseline and authority register](assets/port-operating-baseline-and-authority-register.md) for the common branch contract.

## Reconcile vessel call and berth evidence

1. Keep requested, predicted, confirmed and actual ETA, ETB, ATB, ATD and ETD events distinct. Retain original time zone and later corrections.
2. Compare berth occupation intervals only after call, berth, operation, time and source versions reconcile. Calculate waiting or turnaround from explicit semantic event pairs and state equation and unit.
3. Compare vessel length overall, beam, declared draft and air draft with a berth or port criterion only when units, vessel condition, tide/weather basis, location, authority and effective period are explicit.
4. Treat tide, weather, under-keel, pilot, tug, mooring and Vessel Traffic Services evidence as dependencies supplied by competent authorities. Never turn evidence into navigation, sequencing or clearance advice.
5. Preserve the analysis in [the vessel-call and nautical-services plan](assets/vessel-call-berth-nautical-services-plan.md).

## Reconcile terminal, yard and gate flow

1. Define terminal zone, cargo cohort, operation, resource pool and time window before aggregating moves, Twenty-foot Equivalent Units, mass, slots, occupancy, dwell or rehandles.
2. Compute productivity only as documented compatible moves divided by documented working or elapsed time. State exclusions. Compute occupancy only from compatible used and available capacity with a common unit and boundary.
3. Keep planned, forecast and actual values separate. Trace each bottleneck as demand evidence → named equipment/labor/space resource → supplied capacity and availability → observed queue/delay → uncertainty.
4. Separate reefer, dangerous-goods, out-of-gauge, bonded, maintenance and restricted areas. Never infer safe stacking, equipment fitness, staffing adequacy or dispatch order.
5. Record calculations and gaps in [the terminal flow ledger](assets/terminal-yard-gate-capacity-flow-ledger.csv).

## Reconcile cargo, document and custody evidence

1. Match vessel call, booking, bill of lading, manifest, shipment and cargo-unit IDs before comparing descriptions, quantities or masses. Keep commercial declaration, regulatory declaration and physical observation separate.
2. Record Verified Gross Mass value, unit, method/status and responsible document source exactly as supplied. Report discrepancy; do not approve VGM or determine whether loading is permitted.
3. Record dangerous-goods classification/declaration, customs, border, security, carrier, FAL and port-community-system statuses only with issuing authority, version/time and cargo key. Never infer a status from an empty field or downstream movement.
4. Construct custody as ordered party/location/time/evidence events. Preserve seal discrepancies, missing handoffs and counterevidence without declaring title, lawful possession or complete chain of custody.
5. Use [the cargo document and custody register](assets/cargo-document-safety-custody-register.md).

## Join the three independent roots

1. Require the three branch artifacts and common baseline. Verify path, version/hash, evidence cutoff, time zone, units and stable ID compatibility.
2. Join only through call, voyage, berth, cargo-unit, document and event keys. Create explicit contradictions when milestones, terminal windows, cargo records and workflow statuses disagree.
3. Use a locally supplied priority or risk rubric. Do not invent berth priority, nautical clearance, yard-capacity threshold, productivity target, dangerous-goods rule or customs/security test.
4. Limit proposed actions to evidence reconciliation, current-source request, re-baseline, specialist review, monitoring or verification of a control already authorized elsewhere.
5. Complete [the integrated port review pack](assets/port-operations-integrated-review-pack.md), including `decision-not-made` and the named human decision authority.

## Stop and retain human authority

Stop on conflicting vessel/call/cargo identities; missing or stale authority; incompatible time zones, units or effective dates; live navigation or terminal-control requests; active safety, security, pollution or emergency events; protected commercial/personal data; or any request to infer berth clearance, under-keel safety, equipment readiness, dangerous-goods classification, customs/security release, lawful title or compliance.

Never direct VTS, vessel, pilot, tug, mooring, berth, crane, yard, gate, rail, barge, cargo, document, customs, security, pollution or emergency activity. Require harbour master, VTS operator, pilot/master, berth planner, terminal control, equipment/labor owners, dangerous-goods and reefer specialists, shipper/carrier, customs/security, legal/privacy, port-state/regulatory and emergency review.

## Sources and clean-room boundary

Read [sources and clean-room boundary](references/sources.md) before using a current convention, recommendation or local rule. This method is clean-room authored. A public maritime-expert Skill was reviewed at a fixed commit and rejected because it embeds arbitrary operational constants and direct allocation/routing behavior without adequate authority or evidence boundaries. No rejected text, threshold or code was copied.
