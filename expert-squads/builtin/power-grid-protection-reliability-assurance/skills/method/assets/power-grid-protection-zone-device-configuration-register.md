# Power Grid Protection Zone Device Configuration Register

## Purpose

Freeze the network model, topology state and complete protection chain from primary element through sensing, relay logic, trip path, breaker, DC supply and teleprotection. It distinguishes design, approved, downloaded, active and observed states.

## Controlled provenance

- artifact_id: GRID-ZONE-CONFIG-REGISTER
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
- decision_not_made: no operability, redundancy, settings, scheme, switching, trip, reclose, energization, compliance, or cybersecurity decision
- outcome_unknown: true until the named qualified reviewer records a separate determination
- stop_escalation: unknown topology/active group/device identity, inaccessible critical-infrastructure evidence, live condition, or request to access equipment

## Domain records

- Network model/one-line revision, system base, voltage level, topology state, effective timestamp, study case and owner.
- Protected element and zone with primary/backup scheme, relay make/model/serial/firmware, settings group and logic revision.
- CT/VT circuits and ratios/polarity, DC source, trip coils, breakers/poles, communications/teleprotection channels and maintenance state.

## Reconciliation checks

- Trace every protection zone end-to-end and expose gaps, overlaps, stale drawings and unmatched device identifiers.
- Compare approved, downloaded, active and observed configuration without assuming the most recent is active.
- Bind settings, firmware, CT/VT, breaker, DC and communications revisions to the same effective topology interval.

## Controlled row template

| row_id        | domain_object_and_revision | source_id_locator | source_version_date | cutoff_effective_date | value                        | units_and_denominator               | owner    | qualified_reviewer | applicability_jurisdiction | assumptions_uncertainty | privacy_license_state | status | decision_not_made                                                                                                           | outcome_unknown | stop_escalation                                                                                                                              |
| ------------- | -------------------------- | ----------------- | ------------------- | --------------------- | ---------------------------- | ----------------------------------- | -------- | ------------------ | -------------------------- | ----------------------- | --------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------- | --------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| GRID-ZONE-001 | required                   | required          | required            | required              | source value or not supplied | required or explicit not applicable | required | required           | required                   | required                | required              | draft  | no operability, redundancy, settings, scheme, switching, trip, reclose, energization, compliance, or cybersecurity decision | true            | unknown topology/active group/device identity, inaccessible critical-infrastructure evidence, live condition, or request to access equipment |

Never treat an empty field as "none," a missing row as absence, a calculation as approval, or a completed template as professional acceptance. Preserve superseded rows, counterevidence, conflicting versions and the reviewer's separate disposition.
