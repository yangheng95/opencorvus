# Veterinary inventory cold chain biosecurity client follow-up register

## Controlled metadata

- artifact_id: VCO-INVENTORY-BIOSECURITY-FOLLOWUP
- artifact_version: 2026.08.11.1
- source_locator_version_date: required for receipt, lot, storage, temperature, transaction, biosecurity event, signed instruction, delivery, and acknowledgment
- cutoff_effective_date: required; preserve event and instruction effective intervals
- quantity_unit_denominator: stock count, transaction, temperature, and client instruction values retain units and context
- owner: inventory/biosecurity/client-communication process owner
- qualified_reviewer: licensed veterinarian, inventory/pharmacy owner, biosecurity lead, animal/public-health authority, and clinic lead
- applicability_jurisdiction: facility, location/zone, product/lot, patient/episode, client authority, and jurisdiction
- assumptions_uncertainty: inventory, device calibration, clock, excursion, movement, instruction-version, and acknowledgment limitations
- privacy_license_boundary: authorized data only with source license and communication authorization
- status: draft | evidence-complete-for-review | qualified-review-required | stopped | superseded
- decision_not_made: no stock mutation/release/disposal, excursion disposition, isolation/quarantine/reporting, zoonotic advice, missed-dose advice, or client contact
- stop_escalation: unknown lot/unit/device, unexplained difference, unsupported instruction, unauthorized data, exposure, or emergency

## Inventory and biosecurity

| row_id      | product/lot/expiry | receipt_storage_location | temperature/value/unit/device/calibration | transaction/count/denominator | excursion_disposition_source    | zone/movement/PPE/cleaning/exposure_source | owner/reviewer | status |
| ----------- | ------------------ | ------------------------ | ----------------------------------------- | ----------------------------- | ------------------------------- | ------------------------------------------ | -------------- | ------ |
| VCO-INV-001 | required           | required                 | source only                               | source only                   | authorized source or unresolved | source only                                | required       | draft  |

## Client follow-up

| row_id         | patient/episode/client_authority | signed_instruction_source/version | restriction/label/followup/warning | plain_language_mapping     | contact_channel_source | delivery/time | acknowledgment | decision_not_made        | stop_escalation                                     |
| -------------- | -------------------------------- | --------------------------------- | ---------------------------------- | -------------------------- | ---------------------- | ------------- | -------------- | ------------------------ | --------------------------------------------------- |
| VCO-FOLLOW-001 | required                         | required and current              | exact signed content               | sentence-level source link | supplied               | supplied      | supplied       | no new advice or contact | stop on unsigned/superseded/conflicting instruction |

Never decide whether an excursion is acceptable, release or discard stock, impose isolation, classify disease, report externally, or contact a client. Plain-language wording must not change dose, timing, restriction, warning, or action and must remain traceable to the signed source.
