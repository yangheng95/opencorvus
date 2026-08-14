# Ocean Observing Platform Instrument Metadata Register

## Purpose

Freeze mission, platform, deployment, cast/profile, instrument/channel, calibration, configuration, sampling and custody metadata. It establishes the identities and physical/time/depth semantics required by QC, format and collocation branches.

## Controlled provenance

- artifact_id: OCEAN-PLATFORM-INSTRUMENT-REGISTER
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
- decision_not_made: no calibration adjustment, sensor fitness, platform operation, observation validity, data release, forecast, navigation, or marine-safety decision
- outcome_unknown: true until the named qualified reviewer records a separate determination
- stop_escalation: ambiguous platform/instrument/profile identity, missing calibration/configuration interval, unknown time/depth datum, restricted data, or live platform issue

## Domain records

- Program/mission, platform type/identifier, cruise/station, deployment/recovery, cast/profile/sample and custody lineage.
- Instrument make/model/serial, firmware, channel, mounting/orientation, intake/sensor position, clock source, configuration and calibration event/certificate/range/uncertainty.
- Variable/measurand, unit, sampling rate/averaging, horizontal datum, vertical reference, pressure/depth method, time zone/calendar and source dataset revision.

## Reconciliation checks

- Compare planned, deployed, recovered and data-file configurations; expose serial/firmware/position drift.
- Verify observation times and depth/pressure coordinates are traceable to a clock, datum and method.
- Bind every QC and collocation record to the exact calibrated instrument/channel and applicable interval.

## Controlled row template

| row_id         | domain_object_and_revision | source_id_locator | source_version_date | cutoff_effective_date | value                        | units_and_denominator               | owner    | qualified_reviewer | applicability_jurisdiction | assumptions_uncertainty | privacy_license_state | status | decision_not_made                                                                                                                                  | outcome_unknown | stop_escalation                                                                                                                                               |
| -------------- | -------------------------- | ----------------- | ------------------- | --------------------- | ---------------------------- | ----------------------------------- | -------- | ------------------ | -------------------------- | ----------------------- | --------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| OCEAN-META-001 | required                   | required          | required            | required              | source value or not supplied | required or explicit not applicable | required | required           | required                   | required                | required              | draft  | no calibration adjustment, sensor fitness, platform operation, observation validity, data release, forecast, navigation, or marine-safety decision | true            | ambiguous platform/instrument/profile identity, missing calibration/configuration interval, unknown time/depth datum, restricted data, or live platform issue |

Never treat an empty field as "none," a missing row as absence, a calculation as approval, or a completed template as professional acceptance. Preserve superseded rows, counterevidence, conflicting versions and the reviewer's separate disposition.
