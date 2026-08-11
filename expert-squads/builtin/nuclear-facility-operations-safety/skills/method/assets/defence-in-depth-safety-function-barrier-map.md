# Defence-in-depth Safety Function and Barrier Map

Map approved evidence without assigning barrier credit or calculating risk. One `DIB-###` record represents one supplied safety function under one facility/unit/plant-state and challenge boundary.

Canonical fields: `record_id`, `facility_unit_ssc_ids`, `plant_state`, `unit`, `source_location`, `source_authority`, `source_version`, `effective_date`, `observation_date`, `owner`, `qualified_reviewer`, `applicability`, `uncertainty`, `status`, `decision_not_made`, `stop_or_escalation`.

## Record structure

- Safety function and classification exactly as supplied, with controlled source locator/version/effective date.
- Initiating condition or challenge, scope and consequence description from the approved analysis; do not create scenarios.
- Prevention, control and mitigation layers kept distinct.
- Credited SSC/barrier/control only as named by the current source; include SSC IDs, trains, spatial boundary and plant-state applicability.
- Availability evidence class and date: design intent, physical status, surveillance/test, alarm, work record or approved evaluation.
- Support systems and electrical, cooling, instrumentation/control, environmental, fire/flood/seismic or human-action dependencies as applicable.
- Independence, redundancy, diversity, qualification and common-cause claims with exact source; missing evidence remains unknown.
- Failure/degraded evidence, counterevidence, owner, licensed/qualified reviewer, applicability, uncertainty and status.
- Decision not made: no barrier credit, operability, Technical Specification action, compensatory measure, emergency class or risk acceptance.
- Stop/escalation: uncertain plant state/SSC/criterion, active alarm/abnormal condition, missing dependency evidence or protected information.

## DIB-001 baseline

- Facility/unit/plant state/function: unknown
- Challenge and defence layers: unknown
- SSCs/barriers/controls: not credited
- Availability and dependency evidence: unknown
- Source authority/version/effective/observation dates: unknown
- Units/applicability/uncertainty: unknown
- Owner/qualified reviewer: unassigned
- Status: draft
- Decision not made: no operational, operability, barrier-credit, emergency or safety decision
- Stop/escalation: licensed operations and nuclear safety engineering must confirm current controlled inputs

Link to `NCB-###`, `PSL-###` and `NEO-###` through stable IDs only. Contradictory evidence remains visible.
