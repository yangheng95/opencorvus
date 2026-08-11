# Pipeline integrity qualified review pack

## Controlled metadata

- artifact_id: PIM-QUALIFIED-REVIEW-PACK
- artifact_version: 2026.08.11.1
- source_locator_version_date: exact source and row index for every claim
- cutoff_effective_date: common cutoff and retained configuration/procedure effective intervals
- quantity_unit_denominator: cross-link every measurement, calculation, coverage, and count
- owner: pipeline integrity management owner
- qualified_reviewer: named integrity engineering, domain-specialist, operations, field-safety, emergency, GIS/survey, and legal/regulatory roles
- applicability_jurisdiction: operator, system/segment, route/configuration, procedure/model, and jurisdiction
- assumptions_uncertainty: consolidated identity, spatial, temporal, coverage, tool, model, measurement, and authorization limitations
- privacy_license_boundary: authorized sensitive infrastructure evidence and source license
- status: draft | evidence-complete-for-review | qualified-review-required | stopped | superseded
- decision_not_made: no operation, pressure, threat/risk, anomaly disposition, inspection, excavation/repair, return-to-service, emergency, submission, or compliance decision
- outcome_unknown: preserve ambiguous external effects until authoritative reconciliation
- stop_escalation: missing branch/reviewer, incompatible scope/version/cutoff, unverifiable evidence, unauthorized data, or emergency

## Branch join

| branch                   | required artifact                                      | scope/version reconciliation | evidence state | conflicts/gaps | named owner/reviewer | stop/escalation |
| ------------------------ | ------------------------------------------------------ | ---------------------------- | -------------- | -------------- | -------------------- | --------------- |
| segment/configuration    | pipeline-segment-identity-regulatory-basis-register.md | required                     | required       | preserve       | required             | required        |
| threat/data              | pipeline-threat-data-integration-matrix.md             | required                     | required       | preserve       | required             | required        |
| assessment/anomaly       | pipeline-assessment-run-anomaly-correlation-ledger.csv | required                     | required       | preserve       | required             | required        |
| excavation/repair/change | pipeline-excavation-repair-moc-evidence-map.md         | required                     | required       | preserve       | required             | required        |

## Review queue

| claim_id      | evidence_row_links | observation | classification_source | calculation/model    | interpretation/authorization owner | uncertainty | decision_not_made           | status                    |
| ------------- | ------------------ | ----------- | --------------------- | -------------------- | ---------------------------------- | ----------- | --------------------------- | ------------------------- |
| PIM-CLAIM-001 | required           | required    | source-bound          | source-bound or none | named human                        | required    | all consequential decisions | qualified-review-required |

Do not resolve mismatches by preference or report incomplete evidence as an integrity conclusion. Signed human decisions remain attributed records.
