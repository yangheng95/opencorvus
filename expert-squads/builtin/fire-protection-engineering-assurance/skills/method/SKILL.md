---
name: fire-protection-engineering-assurance-method
description: Prepare source-bound facility fire-protection basis, passive and active system, supplied model, inspection, testing, and impairment evidence for qualified review. Use for bounded building or facility fire/life-safety assurance where compliance, design, emergency, and equipment decisions remain with the AHJ and registered professionals.
---

# Fire Protection Engineering Assurance Method

## Establish the review baseline

Freeze the facility, building, area, occupancy/use, fire zone, jurisdiction, Authority Having Jurisdiction (AHJ), adopted source edition, design criteria, approved design and calculation revisions, as-built revision, inspection interval, effective date, review cutoff, evidence owner, and qualified reviewers. Treat each revision as a distinct baseline. Do not combine code editions, design phases, occupancies, drawing sets, system configurations, or inspection intervals without a documented crosswalk.

Require stable identifiers for buildings, floors, rooms, fire/smoke compartments, barriers, openings, penetrations, exits, systems, devices, valves, pumps, tanks, mains, control panels, interfaces, impairments, tests, findings, work orders, model cases, input files, and runs. Record source locator/version/date, units_and_denominator, applicability, assumptions_uncertainty, privacy/license boundary, status, decision_not_made, outcome_unknown, and stop/escalation for every material row.

Separate five layers of evidence:

1. observed condition or test result;
2. source-authored design or as-built record;
3. supplied engineering calculation or model output;
4. registered-professional or AHJ interpretation;
5. authorized operational, impairment, acceptance, or emergency action.

Never promote one layer into another.

## Analyze basis, occupancy, and hazards

Build the facility/occupancy/authority basis before examining system adequacy. Trace area and use, occupant basis, construction type as supplied, contents, storage, process or special hazards, fuel or fire-load source, fire scenario identity, change history, approved alternatives and applicable drawing/calculation set. Link each criterion to the exact adopted source and edition supplied by the operator. Do not recall or reproduce protected code requirements, classify occupancy, select design fires, set acceptance criteria, or decide equivalency.

Expose changes in occupancy, layout, storage, penetrations, equipment, process, utilities or fire-zone boundaries that make an earlier basis uncertain. Preserve conflicting drawings, superseded approvals and missing AHJ records. Route every interpretation to a registered fire-protection professional and the AHJ.

## Trace passive fire protection and egress evidence

Construct a graph from fire/smoke compartment to boundary assembly, opening, door, damper, glazing, joint, penetration, firestop system, supporting construction, installation record, inspection finding, repair and retest. Preserve rating or listing references exactly as supplied without deciding whether they apply. Reconcile barrier schedules, plans, details, penetration inventories, product/listing records, field photographs and inspection records by location and revision.

For egress, record only the supplied occupant basis, route segment, door, corridor, stair, exit, discharge, accessibility feature, emergency-lighting or marking evidence and approved source criterion. Keep measured geometry and sourced requirements separate. Do not calculate permitted capacity, declare a route compliant, predict evacuation, establish tenability, or authorize occupancy.

## Trace active systems, water supply, and interfaces

Build component and cause/effect lineage for detection, alarm, supervisory, trouble, notification, releasing service, sprinkler, standpipe, special suppression, pumps, tanks, mains, smoke control, emergency power, monitoring, shutdowns, doors/dampers, elevator functions and other interfaces. Key every item by tag, zone, service, panel, circuit or loop, configuration revision and effective interval.

Use only an approved cause-and-effect matrix. Trace initiating input through panel logic and output action to dated test evidence. For water evidence, retain flow, pressure, duration, datum, elevation, test configuration, source condition, instrument/calibration identity and units. Preserve hydraulic calculations as supplied. Never size systems, set alarm/trip/release points, prescribe valve positions, operate or isolate equipment, or state that supply is adequate.

## Preserve supplied modeling evidence

Treat Fire Dynamics Simulator (FDS) or other fire/smoke modeling as evidence authored by a named qualified party. Record software name/build, model owner, scenario and acceptance-basis source, geometry revision, meshes, material/property sources, fire/source definition, boundary and initial conditions, vents and devices, solver controls, input digest, run identity, log/output digests, completion status, warnings, verification/validation references, convergence evidence and sensitivity cases.

Do not create or edit an input model, choose a design fire, invent properties, reuse the rejected upstream thresholds, run a model against a live decision, or interpret output as approval. If geometry, mesh, property, boundary, scenario or software version is missing, stop the modeling branch and preserve the exact gap.

## Reconcile inspection, testing, maintenance, and impairment

Join each inspection/test/maintenance record to the exact asset, procedure edition, interval, technician/test agency, instrument calibration, preconditions, measured value/unit, expected criterion source, finding, deficiency, work order, repair and retest. Distinguish not tested, inaccessible, failed, passed by the source, administratively closed, restored and independently verified.

For impairments, preserve declaration identity, affected assets/functions/areas, start and end time, authorized owner, reason, risk review reference, notifications, source-defined compensatory measures, work, restoration test and closure authorization. Do not recommend compensatory measures, authorize an impairment, declare restoration, reset a panel, open/close a valve, order evacuation or direct firefighting.

## Join the four branches

Require all four zero-dependency reports. Join by facility/area/fire-zone, system/component, drawing/calculation revision, adopted source and effective time. Reconcile:

- occupancy and hazard basis against passive, active and model assumptions;
- barrier continuity against penetrations, openings and active interfaces;
- cause/effect definitions against tested inputs and outputs;
- water-supply assumptions against dated source tests and hydraulic evidence;
- supplied model geometry and scenarios against the frozen facility basis;
- deficiencies and impairments against repairs, restoration tests and current status.

Keep supported facts, professional interpretations, AHJ determinations, conflicts, missing links, superseded records and unverified outcomes separate. A complete asset set is not a compliance or design approval.

## Use the assets

Populate exactly these package assets:

- [facility/occupancy/authority basis](assets/fire-protection-facility-occupancy-authority-basis-register.md)
- [passive protection and egress matrix](assets/passive-fire-compartmentation-egress-evidence-matrix.md)
- [active-system interface and test ledger](assets/active-fire-protection-system-interface-test-ledger.csv)
- [model, inspection, and impairment map](assets/fire-scenario-model-inspection-impairment-evidence-map.md)
- [qualified review pack](assets/fire-protection-engineering-qualified-review-pack.md)

Read [primary sources](references/PRIMARY-SOURCES.md) when establishing provenance. Read [rejected candidate evidence](references/REJECTED-CANDIDATE.md) before handling FDS material so its text, formulas, thresholds and execution behavior are not reused.

## Stop and preserve authority

Stop on ambiguous facility or system identity, mixed revisions or editions, missing units, unapproved criteria, unverifiable listing/design reference, incomplete cause/effect lineage, unknown water-test basis, missing model inputs or hashes, live impairment/emergency, or a request to operate, design, approve, certify or command. Record the partial evidence and exact escalation.

Registered fire-protection engineers own engineering interpretation and design; architects and discipline engineers own their sealed work; system designers and test agencies own their records; the facility fire/life-safety owner controls authorized impairment processes; the AHJ decides acceptance and enforcement; incident command owns emergencies. This Skill only prepares evidence for those reviewers.
