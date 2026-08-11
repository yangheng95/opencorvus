# Oceanographic Observation Data Qualified Review Pack

## Purpose

Join platform/instrument, profile/time-series QC, coordinate/format/provenance and cross-platform validation evidence. It retains every incompatible semantic, disputed flag and unresolved uncertainty for qualified scientific and data-steward review.

## Controlled provenance

- artifact_id: OCEAN-QUALIFIED-REVIEW-PACK
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
- decision_not_made: no calibration, flag overwrite, deletion, publication, truth-source, scientific acceptance, forecast, warning, navigation, hydrographic, compliance, environmental-health, or marine-safety decision
- outcome_unknown: true until the named qualified reviewer records a separate determination
- stop_escalation: missing root report, mismatched instrument/calibration/time/depth/unit/datum/calendar, restricted data, live platform issue, or absent qualified reviewers

## Domain records

- Accepted root report and five asset revisions with source snapshot, digest, cutoff, owner, license/access boundary and limitations.
- Cross-branch issue linking mission/platform/deployment/profile/instrument/variable, calibration, QC flag, format transformation and collocation pair.
- Oceanographer, metrologist/instrument owner, data steward, platform operator and official service review scope, date, disposition and residual uncertainty.

## Reconciliation checks

- Require all four roots; reject partial joins, silently substituted datasets or collapsed provenance.
- Confirm QC, format and collocation branches use the same observation identity and calibrated channel semantics.
- Preserve duplicate profiles, mismatched datums/calendars/units, disputed flags, uncertainty and decision_not_made.

## Controlled row template

| row_id           | domain_object_and_revision | source_id_locator | source_version_date | cutoff_effective_date | value                        | units_and_denominator               | owner    | qualified_reviewer | applicability_jurisdiction | assumptions_uncertainty | privacy_license_state | status | decision_not_made                                                                                                                                                                                    | outcome_unknown | stop_escalation                                                                                                                                            |
| ---------------- | -------------------------- | ----------------- | ------------------- | --------------------- | ---------------------------- | ----------------------------------- | -------- | ------------------ | -------------------------- | ----------------------- | --------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| OCEAN-REVIEW-001 | required                   | required          | required            | required              | source value or not supplied | required or explicit not applicable | required | required           | required                   | required                | required              | draft  | no calibration, flag overwrite, deletion, publication, truth-source, scientific acceptance, forecast, warning, navigation, hydrographic, compliance, environmental-health, or marine-safety decision | true            | missing root report, mismatched instrument/calibration/time/depth/unit/datum/calendar, restricted data, live platform issue, or absent qualified reviewers |

Never treat an empty field as "none," a missing row as absence, a calculation as approval, or a completed template as professional acceptance. Preserve superseded rows, counterevidence, conflicting versions and the reviewer's separate disposition.
