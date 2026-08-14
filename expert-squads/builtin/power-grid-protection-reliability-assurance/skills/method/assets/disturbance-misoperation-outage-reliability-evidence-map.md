# Disturbance Misoperation Outage Reliability Evidence Map

## Purpose

Join disturbance, COMTRADE, sequence-of-events, relay, breaker, communications, outage, restoration and reliability-definition evidence. It preserves hypotheses and formal authority determinations separately.

## Controlled provenance

- artifact_id: GRID-EVENT-RELIABILITY-MAP
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
- decision_not_made: no fault-location, root-cause, misoperation, reportability, corrective-action, outage-classification, reliability-publication, switching, or dispatch decision
- outcome_unknown: true until the named qualified reviewer records a separate determination
- stop_escalation: uncertain event identity/time quality/channel scaling, disputed scope, unknown denominator/definition, cybersecurity restriction, or live emergency

## Domain records

- Event and UTC interval with original time zone, clock source/synchronization, COMTRADE configuration/data hash, channel ratios/polarity/units.
- Relay targets, sequence of events, communications send/receive, trip, breaker, SCADA, operator and maintenance evidence with hypotheses/counterevidence.
- Outage event, affected elements/customers/load/energy, interruption/restoration stages, classification source, metric formula/version, eligible events and denominator.

## Reconciliation checks

- Build a time-uncertainty-aware event sequence without overwriting original timestamps.
- Link protection-event and outage identities while keeping initiating/consequential elements and cause questions separate.
- Recompute no official metric unless exact formula, event population, exclusions and denominator are supplied; preserve correction lineage.

## Controlled row template

| row_id         | domain_object_and_revision | source_id_locator | source_version_date | cutoff_effective_date | value                        | units_and_denominator               | owner    | qualified_reviewer | applicability_jurisdiction | assumptions_uncertainty | privacy_license_state | status | decision_not_made                                                                                                                                              | outcome_unknown | stop_escalation                                                                                                                                     |
| -------------- | -------------------------- | ----------------- | ------------------- | --------------------- | ---------------------------- | ----------------------------------- | -------- | ------------------ | -------------------------- | ----------------------- | --------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| GRID-EVENT-001 | required                   | required          | required            | required              | source value or not supplied | required or explicit not applicable | required | required           | required                   | required                | required              | draft  | no fault-location, root-cause, misoperation, reportability, corrective-action, outage-classification, reliability-publication, switching, or dispatch decision | true            | uncertain event identity/time quality/channel scaling, disputed scope, unknown denominator/definition, cybersecurity restriction, or live emergency |

Never treat an empty field as "none," a missing row as absence, a calculation as approval, or a completed template as professional acceptance. Preserve superseded rows, counterevidence, conflicting versions and the reviewer's separate disposition.
