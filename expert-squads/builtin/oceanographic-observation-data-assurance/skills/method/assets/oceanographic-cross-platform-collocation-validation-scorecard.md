# Oceanographic Cross Platform Collocation Validation Scorecard

## Purpose

Record a prespecified cross-platform collocation contract, eligible candidate pairs, accepted/rejected matches, differences and uncertainty. It prevents post-hoc tolerance tuning or an unsupported truth-source designation.

## Controlled provenance

- artifact_id: OCEAN-COLLOCATION-SCORECARD
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
- decision_not_made: no truth-source designation, calibration adjustment, platform suitability, data release, forecast, navigation, hydrographic, environmental-health, compliance, or safety decision
- outcome_unknown: true until the named qualified reviewer records a separate determination
- stop_escalation: undefined variables/units/datums/time, missing calibration or QC state, post-hoc tolerances, unknown eligible denominator, restricted data, or live platform issue

## Domain records

- Candidate source pair with platform/instrument/variable/revision, comparable unit/datum and calibration/QC eligibility.
- Prespecified spatial, vertical and temporal tolerance, coordinate conversion, interpolation, exclusion criteria and eligible-pair denominator.
- Accepted/rejected pair with reason, offsets, difference/residual definition, measurement/calibration/coordinate/interpolation/representativeness uncertainty.

## Reconciliation checks

- Freeze the collocation contract before observing results and preserve every rejected candidate/reason.
- Do not assume either platform is truth; record reviewer-supplied reference status separately.
- Reconcile pair eligibility with calibration interval, QC lineage, coordinate/time semantics and source revisions.

## Controlled row template

| row_id           | domain_object_and_revision | source_id_locator | source_version_date | cutoff_effective_date | value                        | units_and_denominator               | owner    | qualified_reviewer | applicability_jurisdiction | assumptions_uncertainty | privacy_license_state | status | decision_not_made                                                                                                                                                                 | outcome_unknown | stop_escalation                                                                                                                                                    |
| ---------------- | -------------------------- | ----------------- | ------------------- | --------------------- | ---------------------------- | ----------------------------------- | -------- | ------------------ | -------------------------- | ----------------------- | --------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| OCEAN-COLLOC-001 | required                   | required          | required            | required              | source value or not supplied | required or explicit not applicable | required | required           | required                   | required                | required              | draft  | no truth-source designation, calibration adjustment, platform suitability, data release, forecast, navigation, hydrographic, environmental-health, compliance, or safety decision | true            | undefined variables/units/datums/time, missing calibration or QC state, post-hoc tolerances, unknown eligible denominator, restricted data, or live platform issue |

Never treat an empty field as "none," a missing row as absence, a calculation as approval, or a completed template as professional acceptance. Preserve superseded rows, counterevidence, conflicting versions and the reviewer's separate disposition.
