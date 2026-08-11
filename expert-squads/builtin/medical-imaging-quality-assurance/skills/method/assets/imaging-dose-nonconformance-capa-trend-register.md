# Imaging dose nonconformance CAPA trend register

## Controlled metadata

- artifact_id: MIQA-DOSE-CAPA-REGISTER
- artifact_version: 2026.08.11.1
- source_locator_version_date: required for dose-system export, nonconformance, service, retest, and CAPA evidence
- cutoff_effective_date: required and separated from event date
- quantity_unit_denominator: preserve modality-specific dose-index name/value/unit/context; trends require an eligible denominator
- owner: imaging QA and CAPA process owner
- qualified_reviewer: qualified medical physicist plus radiation-safety/service/CAPA owners
- applicability_jurisdiction: facility, modality, device/configuration, protocol, phantom/size context, and jurisdiction
- assumptions_uncertainty: extraction, calculation, sampling, protocol mix, configuration, missingness, and comparison uncertainty
- privacy_license_boundary: authorized minimized evidence only with source license
- status: draft | evidence-complete-for-review | qualified-review-required | stopped | superseded
- decision_not_made: no patient dose/risk, protocol, exam/rescan, service, CAPA closure, return-to-use, or regulatory decision
- stop_escalation: unknown unit/context, unsupported reference, missing denominator, unlinked service/retest, or unauthorized data

## Dose-index context

| row_id        | device/configuration/protocol | index_name | value    | unit     | phantom_size_or_supplied_context | source/version/date | eligible_denominator     | comparison_source/version | owner/reviewer | uncertainty | status |
| ------------- | ----------------------------- | ---------- | -------- | -------- | -------------------------------- | ------------------- | ------------------------ | ------------------------- | -------------- | ----------- | ------ |
| MIQA-DOSE-001 | required                      | required   | supplied | required | required                         | required            | required for aggregation | owner-supplied or none    | required       | required    | draft  |

## Nonconformance and CAPA chain

| row_id        | nonconformance_id | event_source/date | service_or_change_id | retest_id/result_source | recurrence_link | CAPA_action_source | verification_source | closure_state_source     | decision_not_made                       | stop_escalation             |
| ------------- | ----------------- | ----------------- | -------------------- | ----------------------- | --------------- | ------------------ | ------------------- | ------------------------ | --------------------------------------- | --------------------------- |
| MIQA-CAPA-001 | required          | required          | supplied             | supplied or missing     | supplied        | supplied           | supplied            | supplied, never inferred | no cause/effectiveness/closure decision | escalate gaps and conflicts |

Never call an equipment dose index patient absorbed dose. A Diagnostic Reference Level is a contextual review reference, not an individual limit. Trend only stable categories with explicit protocol mix, device/configuration changes, sample selection, numerator, and denominator. A lower count or value does not prove corrective-action effectiveness.
