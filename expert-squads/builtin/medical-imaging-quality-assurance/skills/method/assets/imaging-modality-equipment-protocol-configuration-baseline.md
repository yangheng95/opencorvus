# Imaging modality equipment protocol configuration baseline

## Controlled metadata

- artifact_id: MIQA-EQUIPMENT-BASELINE
- artifact_version: 2026.08.11.1
- source_locator: required; cite authorized inventory, configuration, protocol, service, or change record
- source_version_date: required; preserve revision and source publication/export date
- cutoff_effective_date: required; distinguish observation cutoff from configuration effective interval
- quantity_unit_denominator: record every parameter with its original unit and applicable population/context; use not-applicable only with reason
- owner: facility imaging quality owner
- qualified_reviewer: qualified medical physicist plus modality/service owner as applicable
- applicability_jurisdiction: facility, department, modality, device, protocol, intended test use, and governing jurisdiction
- assumptions_uncertainty: list transcription, clock, version, configuration, and measurement uncertainties
- privacy_license_boundary: authorized minimized evidence only; record reuse license and PHI classification
- status: draft | evidence-complete-for-review | qualified-review-required | stopped | superseded
- decision_not_made: no protocol change, acquisition/rescan, clinical acceptance, service, return-to-use, accreditation, or compliance decision
- stop_escalation: missing identity/unit/version/source, conflict, unauthorized data, or consequential request

## Device and component register

| row_id      | facility | modality | manufacturer/model/serial | detector_or_coil      | software_configuration_version | source/version/date | effective_interval | owner/reviewer | applicability | uncertainty | status |
| ----------- | -------- | -------- | ------------------------- | --------------------- | ------------------------------ | ------------------- | ------------------ | -------------- | ------------- | ----------- | ------ |
| MIQA-EQ-001 | required | required | required                  | required or explained | required                       | required            | required           | required       | required      | required    | draft  |

## Protocol and baseline register

| row_id        | device_id | protocol_id/version | supplied_use  | parameter | value    | unit     | approved_baseline_source/version | change_id     | post_change_test       | status |
| ------------- | --------- | ------------------- | ------------- | --------- | -------- | -------- | -------------------------------- | ------------- | ---------------------- | ------ |
| MIQA-PROT-001 | required  | required            | supplied only | required  | required | required | required                         | if applicable | source link or missing | draft  |

Preserve manufacturer specification, facility baseline, service value, phantom observation, and clinical-image observation as separate rows. Never copy a parameter between devices or infer an omitted configuration. Every superseded value remains traceable to its effective interval and approval record. Reviewer notes must identify evidence accepted, conflict retained, and the exact decision still withheld.
