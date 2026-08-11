# Medical imaging quality assurance qualified review pack

## Controlled metadata

- artifact_id: MIQA-QUALIFIED-REVIEW-PACK
- artifact_version: 2026.08.11.1
- source_locator_version_date: index every exact evidence row and source revision
- cutoff_effective_date: common cutoff plus retained effective intervals
- quantity_unit_denominator: cross-link all measurements and counts to unit, context, and denominator
- owner: facility imaging QA owner
- qualified_reviewer: named radiologist, qualified medical physicist, technologist, engineer, PACS/DICOM administrator, radiation-safety, privacy, and regulatory/accreditation owner as applicable
- applicability_jurisdiction: facility, modality, equipment/configuration, protocol/procedure, route/display, and jurisdiction
- assumptions_uncertainty: consolidated unresolved measurement, identity, tolerance, sampling, clock, and version limitations
- privacy_license_boundary: minimized authorized evidence and license closure
- status: draft | evidence-complete-for-review | qualified-review-required | stopped | superseded
- decision_not_made: no clinical, acquisition, patient-dose, operational, service, return-to-use, accreditation, or compliance decision
- stop_escalation: absent branch/reviewer, incompatible scope/version/cutoff, unverifiable source, or unauthorized request

## Branch join

| branch                 | required artifact                                                     | scope/version reconciliation | evidence state | unresolved conflicts | named owner/reviewer | stop/escalation |
| ---------------------- | --------------------------------------------------------------------- | ---------------------------- | -------------- | -------------------- | -------------------- | --------------- |
| equipment and protocol | imaging-modality-equipment-protocol-configuration-baseline.md         | required                     | required       | preserve             | required             | required        |
| phantom technical QC   | imaging-phantom-technical-qc-measurement-ledger.csv                   | required                     | required       | preserve             | required             | required        |
| DICOM and display      | dicom-series-metadata-transfer-display-workflow-integrity-register.md | required                     | required       | preserve             | required             | required        |
| dose and CAPA          | imaging-dose-nonconformance-capa-trend-register.md                    | required                     | required       | preserve             | required             | required        |

## Claim review queue

| claim_id       | evidence_row_links | observation | derivation | supplied_rule | uncertainty | qualified_review_needed | decision_not_made           | status                    |
| -------------- | ------------------ | ----------- | ---------- | ------------- | ----------- | ----------------------- | --------------------------- | ------------------------- |
| MIQA-CLAIM-001 | required           | required    | if any     | if any        | required    | named role              | all consequential decisions | qualified-review-required |

Do not resolve conflicts by preference or summarize away missing evidence. Signed human determinations remain attributed attachments; the package only indexes them. If one root is missing or scope/version cannot be reconciled, the join is stopped rather than presented as complete.
