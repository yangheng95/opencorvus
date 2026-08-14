# Power Grid Protection Reliability Qualified Review Pack

## Purpose

Join all four branches under one topology, effective interval, jurisdiction and evidence cutoff. The pack exposes study/configuration/event/outage mismatches for protection, operations, reliability, cybersecurity and regulatory reviewers.

## Controlled provenance

- artifact_id: GRID-QUALIFIED-REVIEW-PACK
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
- decision_not_made: no setting, coordination, scheme, switching, dispatch, trip, reclose, energization, misoperation, root-cause, compliance, filing, or reliability-publication decision
- outcome_unknown: true until the named qualified reviewer records a separate determination
- stop_escalation: missing root report, incompatible topology/base/time, live condition, critical access issue, or absent qualified protection/operations/reliability reviewers

## Domain records

- Accepted root report, source snapshot and asset revisions with digest, cutoff, owner, limitations and conflicts.
- Cross-branch issue connecting element/zone/device/configuration, study case, event timeline, breaker/outage evidence and reliability definition.
- Qualified protection engineer, operator, asset owner, reliability authority, cybersecurity and regulator review routing and separate dispositions.

## Reconciliation checks

- Require four roots and five assets; reject partial joins and hidden substitutions.
- Reconcile study topology/settings with active configuration, event channels/time with equipment, and outage population with metric definitions.
- Preserve contradictory targets, unresolved cause/misoperation, incomplete restoration, denominator drift and decision_not_made.

## Controlled row template

| row_id          | domain_object_and_revision | source_id_locator | source_version_date | cutoff_effective_date | value                        | units_and_denominator               | owner    | qualified_reviewer | applicability_jurisdiction | assumptions_uncertainty | privacy_license_state | status | decision_not_made                                                                                                                                                     | outcome_unknown | stop_escalation                                                                                                                                              |
| --------------- | -------------------------- | ----------------- | ------------------- | --------------------- | ---------------------------- | ----------------------------------- | -------- | ------------------ | -------------------------- | ----------------------- | --------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| GRID-REVIEW-001 | required                   | required          | required            | required              | source value or not supplied | required or explicit not applicable | required | required           | required                   | required                | required              | draft  | no setting, coordination, scheme, switching, dispatch, trip, reclose, energization, misoperation, root-cause, compliance, filing, or reliability-publication decision | true            | missing root report, incompatible topology/base/time, live condition, critical access issue, or absent qualified protection/operations/reliability reviewers |

Never treat an empty field as "none," a missing row as absence, a calculation as approval, or a completed template as professional acceptance. Preserve superseded rows, counterevidence, conflicting versions and the reviewer's separate disposition.
