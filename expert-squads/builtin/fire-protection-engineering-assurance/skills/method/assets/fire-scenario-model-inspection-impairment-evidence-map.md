# Fire Scenario Model Inspection Impairment Evidence Map

## Purpose

Bind supplied fire-model cases and their provenance to inspection, testing, maintenance, deficiency and impairment evidence. The map prevents model outputs, administrative closure or compensatory measures from being misrepresented as engineering acceptance or restored protection.

## Controlled provenance

- artifact_id: FPE-MODEL-IMPAIRMENT-MAP
- artifact_version: 2026.08.11.1
- row_id: required and stable across revisions
- source_id_locator: exact authoritative source, record, page/object/channel, and access boundary
- source_locator_version_date: source locator plus edition/revision and issue or observation date
- source_version_date: preserve both source version and date without silently replacing either
- cutoff_effective_date: observation cutoff and the interval in which configuration or authority applies
- units_and_denominator: record original value, unit, basis, population/coverage denominator, and conversion method
- owner: evidence or asset owner responsible for source custody
- qualified_reviewer: named role with the professional authority to interpret this evidence
- applicability_jurisdiction: exact facility/system/dataset, location, operating state, authority, and jurisdiction
- assumptions_uncertainty: assumptions, measurement/model/coverage uncertainty, confidence limits, and representativeness
- privacy_license_state: classification, access permission, redistribution limit, copyright/license, and retention restriction
- status: draft | evidence-complete-for-review | qualified-review-required | stopped | superseded
- decision_not_made: no design-fire selection, model validation/acceptance, deficiency disposition, impairment authorization, compensatory action, restoration, evacuation, or firefighting decision
- outcome_unknown: true until the named qualified reviewer records a separate determination
- stop_escalation: missing model owner/input hash/version, unapproved acceptance basis, incomplete impairment scope, live emergency, or request to operate

## Domain records

- Supplied FDS or other model software/build, scenario, geometry, mesh, materials, boundary conditions, devices, input/run/output hashes and warnings.
- Inspection/test/maintenance event linked to exact asset, procedure, interval, instrument calibration, measured value/unit, finding and work order.
- Impairment declaration, affected functions/areas, authorized owner, notifications, source-defined compensatory measures, repair, restoration test and closure.

## Reconciliation checks

- Compare model geometry, occupancy/hazard and system assumptions with the frozen facility and as-built basis.
- Separate model completion, verification/validation evidence, convergence/sensitivity and engineer-defined acceptance review.
- Reconcile deficiency, impairment, repair and restoration timelines; never infer restoration from work-order closure.

## Controlled row template

| row_id        | domain_object_and_revision | source_id_locator | source_version_date | cutoff_effective_date | value                        | units_and_denominator               | owner    | qualified_reviewer | applicability_jurisdiction | assumptions_uncertainty | privacy_license_state | status | decision_not_made                                                                                                                                                               | outcome_unknown | stop_escalation                                                                                                                         |
| ------------- | -------------------------- | ----------------- | ------------------- | --------------------- | ---------------------------- | ----------------------------------- | -------- | ------------------ | -------------------------- | ----------------------- | --------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| FPE-MODEL-001 | required                   | required          | required            | required              | source value or not supplied | required or explicit not applicable | required | required           | required                   | required                | required              | draft  | no design-fire selection, model validation/acceptance, deficiency disposition, impairment authorization, compensatory action, restoration, evacuation, or firefighting decision | true            | missing model owner/input hash/version, unapproved acceptance basis, incomplete impairment scope, live emergency, or request to operate |

Never treat an empty field as "none," a missing row as absence, a calculation as approval, or a completed template as professional acceptance. Preserve superseded rows, counterevidence, conflicting versions and the reviewer's separate disposition.
