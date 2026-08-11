# Passive Fire Compartmentation Egress Evidence Matrix

## Purpose

Trace fire/smoke barriers, assemblies, openings, penetrations, firestopping and source-defined egress evidence by exact location and revision. This matrix records evidence continuity and deficiencies without assigning ratings or declaring compliance.

## Controlled provenance

- artifact_id: FPE-PASSIVE-EGRESS-MATRIX
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
- decision_not_made: no fire-resistance rating, listing applicability, barrier acceptance, egress capacity, tenability, equivalency, or occupancy decision
- outcome_unknown: true until the named qualified reviewer records a separate determination
- stop_escalation: unlocatable barrier/opening/route, missing drawing or listing source, incompatible revisions, or emergency condition

## Domain records

- Fire or smoke compartment and boundary segment with drawing/grid/location, supplied rating reference and construction revision.
- Opening, door, damper, glazing, joint, penetration or firestop identity with listing/design source, installation, inspection, repair and retest.
- Egress route segment, door, corridor, stair, exit/discharge and supplied occupant/geometry/criterion evidence.

## Reconciliation checks

- Test barrier continuity around openings, penetrations, joints, shafts and interfaces without inferring an unrecorded assembly.
- Match inspection findings and repairs to the same location, system/listing design and as-built revision.
- Compare egress source geometry and occupant basis to approved records only; expose missing accessibility, lighting or marking evidence.

## Controlled row template

| row_id          | domain_object_and_revision | source_id_locator | source_version_date | cutoff_effective_date | value                        | units_and_denominator               | owner    | qualified_reviewer | applicability_jurisdiction | assumptions_uncertainty | privacy_license_state | status | decision_not_made                                                                                                                     | outcome_unknown | stop_escalation                                                                                                      |
| --------------- | -------------------------- | ----------------- | ------------------- | --------------------- | ---------------------------- | ----------------------------------- | -------- | ------------------ | -------------------------- | ----------------------- | --------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------- | --------------- | -------------------------------------------------------------------------------------------------------------------- |
| FPE-PASSIVE-001 | required                   | required          | required            | required              | source value or not supplied | required or explicit not applicable | required | required           | required                   | required                | required              | draft  | no fire-resistance rating, listing applicability, barrier acceptance, egress capacity, tenability, equivalency, or occupancy decision | true            | unlocatable barrier/opening/route, missing drawing or listing source, incompatible revisions, or emergency condition |

Never treat an empty field as "none," a missing row as absence, a calculation as approval, or a completed template as professional acceptance. Preserve superseded rows, counterevidence, conflicting versions and the reviewer's separate disposition.
