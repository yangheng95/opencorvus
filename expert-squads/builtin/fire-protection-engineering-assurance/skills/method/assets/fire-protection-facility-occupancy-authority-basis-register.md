# Fire Protection Facility Occupancy Authority Basis Register

## Purpose

Freeze facility, area, fire-zone, occupancy/use, hazard, adopted authority basis, approved design, calculation and as-built lineage before any passive, active or model evidence is interpreted. It prevents an obsolete occupancy, drawing or AHJ source from silently controlling the review.

## Controlled provenance

- artifact_id: FPE-BASIS-REGISTER
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
- decision_not_made: no occupancy classification, code applicability, equivalency, compliance, design, acceptance, or enforcement decision
- outcome_unknown: true until the named qualified reviewer records a separate determination
- stop_escalation: unknown facility/area identity, conflicting occupancy or drawing revision, missing AHJ/adopted edition, or live emergency

## Domain records

- Facility/building/area/fire-zone identity, address or controlled location, owner and configuration revision.
- Occupancy/use and hazard evidence with change history, source author, applicable interval and supplied professional classification.
- AHJ identity, adopted source title/edition, approval/variance/equivalency record, design criteria, calculation and as-built revision.

## Reconciliation checks

- Compare occupancy, use and hazard assumptions across drawings, calculations, active-system basis and model scenarios.
- Trace every criterion to an exact adopted source and effective interval; flag recalled, unlicensed or edition-ambiguous requirements.
- Reconcile design, approved and as-built revisions; preserve changes in layout, storage, process, penetrations and fire-zone boundaries.

## Controlled row template

| row_id        | domain_object_and_revision | source_id_locator | source_version_date | cutoff_effective_date | value                        | units_and_denominator               | owner    | qualified_reviewer | applicability_jurisdiction | assumptions_uncertainty | privacy_license_state | status | decision_not_made                                                                                                     | outcome_unknown | stop_escalation                                                                                                           |
| ------------- | -------------------------- | ----------------- | ------------------- | --------------------- | ---------------------------- | ----------------------------------- | -------- | ------------------ | -------------------------- | ----------------------- | --------------------- | ------ | --------------------------------------------------------------------------------------------------------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------- |
| FPE-BASIS-001 | required                   | required          | required            | required              | source value or not supplied | required or explicit not applicable | required | required           | required                   | required                | required              | draft  | no occupancy classification, code applicability, equivalency, compliance, design, acceptance, or enforcement decision | true            | unknown facility/area identity, conflicting occupancy or drawing revision, missing AHJ/adopted edition, or live emergency |

Never treat an empty field as "none," a missing row as absence, a calculation as approval, or a completed template as professional acceptance. Preserve superseded rows, counterevidence, conflicting versions and the reviewer's separate disposition.
