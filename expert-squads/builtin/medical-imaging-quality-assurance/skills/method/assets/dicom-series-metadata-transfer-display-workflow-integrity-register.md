# DICOM series metadata transfer display workflow integrity register

## Controlled metadata

- artifact_id: MIQA-DICOM-DISPLAY-REGISTER
- artifact_version: 2026.08.11.1
- source_locator_version_date: required for every minimized metadata inventory and system log
- cutoff_effective_date: required; state system clock and time-zone semantics
- quantity_unit_denominator: instance/frame/transfer counts and display measurements require unit and eligible inventory
- owner: PACS/DICOM workflow owner
- qualified_reviewer: PACS/DICOM administrator, privacy owner, medical physicist, and radiologist as applicable
- applicability_jurisdiction: facility, system, route, modality, device, display, and authorized use
- assumptions_uncertainty: identity matching, logging, clock, transformation, sampling, and measurement limitations
- privacy_license_boundary: no direct identifiers; record authorization and reuse license
- status: draft | evidence-complete-for-review | qualified-review-required | stopped | superseded
- decision_not_made: no rendering, transfer, routing, de-identification, deletion, image acceptance, rescan, display adjustment, or compliance decision
- stop_escalation: unauthorized PHI, identity conflict, unverifiable log, unsupported transformation, or live-system request

## Instance and transfer reconciliation

| row_id         | minimized_study_series_instance_relation | SOP_class | transfer_syntax | frames   | pixel_or_orientation_context | sent_received_stored_displayed_archived | source/version/date | count/unit/denominator | owner/reviewer | uncertainty | status |
| -------------- | ---------------------------------------- | --------- | --------------- | -------- | ---------------------------- | --------------------------------------- | ------------------- | ---------------------- | -------------- | ----------- | ------ |
| MIQA-DICOM-001 | required                                 | supplied  | supplied        | supplied | supplied only                | preserve each state and mismatch        | required            | required               | required       | required    | draft  |

## Display-chain evidence

| row_id           | workstation_display_id | calibration_version/date | test_source/version | supplied_measurement | unit     | ambient_condition   | route    | qualified_reviewer | decision_not_made                  | stop_escalation                      |
| ---------------- | ---------------------- | ------------------------ | ------------------- | -------------------- | -------- | ------------------- | -------- | ------------------ | ---------------------------------- | ------------------------------------ |
| MIQA-DISPLAY-001 | required               | required                 | required            | supplied only        | required | supplied or unknown | required | required           | no diagnostic-suitability decision | stop on unknown identity/source/unit |

Tag presence is not semantic correctness, transfer completeness is not clinical adequacy, and a calibration record is not a display-acceptance decision. Preserve missing, duplicate, rejected, transformed, and unmatched items. Cross-link any derived object only through an authorized source relationship.
