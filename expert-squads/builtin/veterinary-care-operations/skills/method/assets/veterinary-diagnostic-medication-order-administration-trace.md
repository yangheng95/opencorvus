# Veterinary diagnostic medication order administration trace

## Controlled metadata

- artifact_id: VCO-ORDER-MEDICATION-TRACE
- artifact_version: 2026.08.11.1
- source_locator_version_date: required for signed order, specimen, result/amendment, dispense, administration, omission, variance, procedure, and handoff
- cutoff_effective_date: required; preserve order and event chronology
- quantity_unit_denominator: result, strength, concentration, volume, count, and other supplied values retain exact unit and context
- owner: attending veterinarian and veterinary medication/procedure record owner
- qualified_reviewer: licensed veterinarian, credentialed technician/nurse, laboratory expert, and medication/inventory owner
- applicability_jurisdiction: patient, episode, order, facility, product/procedure, and jurisdiction
- assumptions_uncertainty: signatures, identity, custody, transcription, time, result amendment, and missing-event uncertainty
- privacy_license_boundary: authorized patient/client data and source licenses
- status: draft | evidence-complete-for-review | qualified-review-required | stopped | superseded
- decision_not_made: no result interpretation, dose calculation, prescription, dispensing, administration, treatment, procedure, or client-advice decision
- stop_escalation: unsigned order, identity/unit/strength conflict, broken custody, unauthorized data, or live clinical request

## Diagnostic chain

| row_id       | order_id/version/signature | specimen_id/type | collection/custody | laboratory_method/version | result/unit | amendment | veterinarian_interpretation_source | status |
| ------------ | -------------------------- | ---------------- | ------------------ | ------------------------- | ----------- | --------- | ---------------------------------- | ------ |
| VCO-DIAG-001 | required                   | required         | required           | required                  | source only | preserve  | source only                        | draft  |

## Medication and procedure chain

| row_id      | order_id/version       | product/strength/concentration/form | route/frequency/duration | lot/expiry | dispense_event | administration_omission_variance | procedure/consent/team/equipment | owner/reviewer | stop_escalation                       |
| ----------- | ---------------------- | ----------------------------------- | ------------------------ | ---------- | -------------- | -------------------------------- | -------------------------------- | -------------- | ------------------------------------- |
| VCO-MED-001 | signed source required | supplied exact units                | signed source only       | supplied   | source         | preserve each state              | if applicable, source-bound      | required       | stop on conflict or missing authority |

Do not calculate or convert a dose for use, infer a missed event, interpret a laboratory result, or create a client instruction. Planned, changed, cancelled, declined, performed, and amended states remain distinct and cross-linked to source.
