# Pipeline excavation repair MOC evidence map

## Controlled metadata

- artifact_id: PIM-EXCAVATION-REPAIR-MOC
- artifact_version: 2026.08.11.1
- source_locator_version_date: exact notification, permit, excavation, examination, engineering, work, repair, test, restoration, as-built, pressure, authorization, and change source
- cutoff_effective_date: required with planned/performed/effective dates
- quantity_unit_denominator: retain field dimensions, examination values, material properties, test values, and counts in source units/context
- owner: operator integrity work and management-of-change owner
- qualified_reviewer: integrity engineer plus field safety, NDE, materials/corrosion, construction, operations, and regulatory roles
- applicability_jurisdiction: exact segment/anomaly/work order/change and jurisdiction
- assumptions_uncertainty: location, identity, field measurement, examination, material, test, chronology, and closure limitations
- privacy_license_boundary: authorized sensitive infrastructure evidence and reuse terms
- status: planned | authorized | performed | verified | deferred | cancelled | reopened | qualified-review-required | stopped | superseded
- decision_not_made: no excavation, repair, pressure restriction, restoration, return-to-service, change acceptance, or compliance decision
- outcome_unknown: external action outcome is unknown until reconciled to authoritative source
- stop_escalation: absent authorization, identity/unit/source conflict, incomplete verification, unauthorized data, or emergency

## Excavation and repair chain

| row_id       | segment/anomaly | notice/permit/authorization | location verification | excavation/exposure | field measurement/NDE | engineering evaluation | work order/repair/material/procedure | test/coating/restoration/backfill | as-built/pressure/return authorization | owner/reviewer | status |
| ------------ | --------------- | --------------------------- | --------------------- | ------------------- | --------------------- | ---------------------- | ------------------------------------ | --------------------------------- | -------------------------------------- | -------------- | ------ |
| PIM-WORK-001 | required        | source-bound                | source-bound          | source-bound        | source-bound          | source-bound           | source-bound                         | source-bound                      | source-bound, never inferred           | required       | draft  |

## Management-of-change chain

| change_id   | request/technical_basis | affected segment/data/model/procedure | integrity/hazard review | approvals     | implementation source | validation   | training/communication | effective date | contingency/rollback | closure state |
| ----------- | ----------------------- | ------------------------------------- | ----------------------- | ------------- | --------------------- | ------------ | ---------------------- | -------------- | -------------------- | ------------- |
| PIM-MOC-001 | required                | required                              | required                | named sources | source-bound          | source-bound | source-bound           | required       | source-bound         | supplied only |

Never advise a crew or infer that planned work occurred. Preserve missing, conflicting, reopened, and superseded states and link every action to exact authority.
