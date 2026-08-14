# Trip Logic Teleprotection Breaker Evidence Matrix

## Purpose

Trace protection inputs, logic, communications, trip outputs, breaker behavior and evidence channels for a frozen configuration. It supports review of the complete operate path without testing, changing or declaring the system operable.

## Controlled provenance

- artifact_id: GRID-TRIP-TELEPROTECTION-MATRIX
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
- decision_not_made: no logic approval, channel acceptance, breaker adequacy, trip/block/reclose command, switching, energization, or misoperation decision
- outcome_unknown: true until the named qualified reviewer records a separate determination
- stop_escalation: missing logic/channel/configuration revision, uncertain polarity/time source, cybersecurity restriction, or live control request

## Domain records

- Relay input/function/start/directional/operate and exact logic-equation or settings-group revision.
- Teleprotection scheme/channel, send/receive message, path, latency evidence, time source and communications configuration.
- Trip output/contact, DC circuit, lockout/reclose logic, trip coil, breaker auxiliary contacts, pole/current interruption and test/maintenance record.

## Reconciliation checks

- Trace input-to-trip-to-current-interruption with stable component and configuration identities.
- Reconcile relay, communications, breaker and SCADA timestamps while preserving resolution and uncertainty.
- Expose missing redundancy, stale diagrams, channel mismatches and contradictory contacts without declaring failure or cause.

## Controlled row template

| row_id        | domain_object_and_revision | source_id_locator | source_version_date | cutoff_effective_date | value                        | units_and_denominator               | owner    | qualified_reviewer | applicability_jurisdiction | assumptions_uncertainty | privacy_license_state | status | decision_not_made                                                                                                                      | outcome_unknown | stop_escalation                                                                                                                  |
| ------------- | -------------------------- | ----------------- | ------------------- | --------------------- | ---------------------------- | ----------------------------------- | -------- | ------------------ | -------------------------- | ----------------------- | --------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------- | --------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| GRID-TRIP-001 | required                   | required          | required            | required              | source value or not supplied | required or explicit not applicable | required | required           | required                   | required                | required              | draft  | no logic approval, channel acceptance, breaker adequacy, trip/block/reclose command, switching, energization, or misoperation decision | true            | missing logic/channel/configuration revision, uncertain polarity/time source, cybersecurity restriction, or live control request |

Never treat an empty field as "none," a missing row as absence, a calculation as approval, or a completed template as professional acceptance. Preserve superseded rows, counterevidence, conflicting versions and the reviewer's separate disposition.
