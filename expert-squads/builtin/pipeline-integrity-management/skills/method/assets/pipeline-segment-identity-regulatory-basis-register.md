# Pipeline segment identity regulatory basis register

## Controlled metadata

- artifact_id: PIM-SEGMENT-BASELINE
- artifact_version: 2026.08.11.1
- source_locator_version_date: exact operator, design, construction, geographic, regulatory, or procedure source
- cutoff_effective_date: observation cutoff plus configuration and controlling-source effective intervals
- quantity_unit_denominator: preserve every dimension, pressure, temperature, distance, and population with original unit/context
- owner: operator pipeline integrity data owner
- qualified_reviewer: pipeline integrity engineer, GIS/survey owner, operations owner, and regulatory/legal owner as applicable
- applicability_jurisdiction: operator, system, segment, commodity/service, onshore/offshore context, and jurisdiction
- assumptions_uncertainty: identity, stationing, coordinate, transformation, material, configuration, time, and applicability limits
- privacy_license_boundary: authorized sensitive infrastructure evidence and reuse terms
- status: draft | evidence-complete-for-review | qualified-review-required | stopped | superseded
- decision_not_made: no operating pressure, isolation, inspection, excavation, repair, return-to-service, applicability, or compliance decision
- outcome_unknown: record any unresolved external-effect state; never assume success or failure
- stop_escalation: identity/version/unit/transformation/source conflict, unauthorized data, or live emergency

## Segment and route identity

| row_id      | system/segment | start/end station_or_measure | route_version | measure_direction | coordinate_reference | transformation/version/tolerance | source/version/date | owner/reviewer | uncertainty | status |
| ----------- | -------------- | ---------------------------- | ------------- | ----------------- | -------------------- | -------------------------------- | ------------------- | -------------- | ----------- | ------ |
| PIM-SEG-001 | required       | required                     | required      | required          | required             | owner-approved or none           | required            | required       | required    | draft  |

## Configuration and controlling basis

| row_id         | segment interval | diameter/wall/material/grade/seam | coating/vintage | pressure/temperature/value/unit | supplied class/consequence designation | regulation/procedure/version/effective date | applicability owner | decision_not_made           | stop                         |
| -------------- | ---------------- | --------------------------------- | --------------- | ------------------------------- | -------------------------------------- | ------------------------------------------- | ------------------- | --------------------------- | ---------------------------- |
| PIM-CONFIG-001 | required         | source-bound                      | source-bound    | source-bound                    | supplied only                          | required                                    | named human         | all consequential decisions | missing/conflicting evidence |

Do not inherit values across undocumented intervals or infer regulatory coverage. Preserve superseded configurations, gaps, overlaps, and conflicting sources as separate rows.
