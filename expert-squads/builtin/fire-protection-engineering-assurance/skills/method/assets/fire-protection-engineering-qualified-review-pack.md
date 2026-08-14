# Fire Protection Engineering Qualified Review Pack

## Purpose

Join the four professional branches into one reviewable evidence pack while retaining every source, conflict, uncertainty, deficiency, impairment and withheld decision. Acceptance belongs to the named registered professionals and AHJ.

## Controlled provenance

- artifact_id: FPE-QUALIFIED-REVIEW-PACK
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
- decision_not_made: no code compliance, sealed design, system acceptance, occupancy, impairment, restoration, emergency or enforcement decision
- outcome_unknown: true until the named qualified reviewer records a separate determination
- stop_escalation: any missing root report, baseline mismatch, unresolved live impairment/emergency, or absent qualified reviewer

## Domain records

- Accepted root report and asset revisions with authors, cutoffs, digests, limitations and unresolved items.
- Cross-branch issue linking occupancy/hazard basis, passive boundary, active interface, water evidence, supplied model and inspection/impairment state.
- Qualified reviewer role, scope, review date, disposition, conditions, residual uncertainty and separate AHJ or owner determination.

## Reconciliation checks

- Require all four roots and exact five assets; reject partial or substituted joins.
- Reconcile basis, passive continuity, cause/effect tests, water assumptions, model scenarios and current impairment/restoration state.
- Preserve professional disagreement, superseded evidence and decision_not_made; do not translate completeness into approval.

## Controlled row template

| row_id         | domain_object_and_revision | source_id_locator | source_version_date | cutoff_effective_date | value                        | units_and_denominator               | owner    | qualified_reviewer | applicability_jurisdiction | assumptions_uncertainty | privacy_license_state | status | decision_not_made                                                                                                           | outcome_unknown | stop_escalation                                                                                                |
| -------------- | -------------------------- | ----------------- | ------------------- | --------------------- | ---------------------------- | ----------------------------------- | -------- | ------------------ | -------------------------- | ----------------------- | --------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------- | --------------- | -------------------------------------------------------------------------------------------------------------- |
| FPE-REVIEW-001 | required                   | required          | required            | required              | source value or not supplied | required or explicit not applicable | required | required           | required                   | required                | required              | draft  | no code compliance, sealed design, system acceptance, occupancy, impairment, restoration, emergency or enforcement decision | true            | any missing root report, baseline mismatch, unresolved live impairment/emergency, or absent qualified reviewer |

Never treat an empty field as "none," a missing row as absence, a calculation as approval, or a completed template as professional acceptance. Preserve superseded rows, counterevidence, conflicting versions and the reviewer's separate disposition.
