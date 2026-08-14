# Medical Device Postmarket Qualified Review Pack

## Purpose and decision boundary

Join device/complaint/event/trend/PMCF/RWE/action/CAPA evidence while preserving jurisdictional, medical and quality decisions for authorized reviewers. This is a reusable evidence structure for qualified human review, not a complaint closure, medical assessment, regulatory filing, signal or benefit-risk conclusion, recall/field-action decision, CAPA approval or compliance statement.

## Artifact control

Shared contract aliases: `source_id_locator` identifies the resolvable evidence pointer; `source_version_date` records exact version plus effective, observation and retrieval dates; `units_and_denominator` records unit, basis, denominator, time window and formula revision. These aliases are mandatory in addition to the domain-specific control fields below.

| Field                       | Required content                                                                                      |
| --------------------------- | ----------------------------------------------------------------------------------------------------- |
| artifact_id                 | Stable device/postmarket identifier with immutable row IDs                                            |
| artifact_version            | Dated revision and supersedes/superseded-by links                                                     |
| source_locator_version_date | Exact locator, source owner, version, effective/observation/retrieval dates                           |
| evidence_cutoff             | Timestamp and timezone bounding included evidence                                                     |
| applicability_jurisdiction  | Manufacturer role, device/version/intended use, market and current rule scope                         |
| value_unit_denominator      | Raw/derived value, unit, numerator definition, denominator basis, exposure window and formula version |
| owner                       | Source or process owner accountable for correction                                                    |
| qualified_reviewer          | Named complaint, medical, quality, risk, statistical, regulatory or privacy role                      |
| assumptions_uncertainty     | Missingness, capture/duplicate bias, confidence, limitations and competing explanations               |
| privacy_license             | Personal-data authority, de-identification, confidentiality, data-use and reuse boundary              |
| status                      | observed, supplied_interpretation, derived, hypothesis, blocked or decision_not_made                  |
| decision_not_made           | True until an authorized separately referenced determination exists                                   |
| outcome_unknown             | True whenever causality, reportability, signal, benefit-risk, action or compliance is unresolved      |
| stop_escalation             | Stop reason, affected IDs, qualified owner and approved human escalation route                        |

## Domain records

Use one row or subsection for each stable record:

- `review_pack_id`
- `scope_baseline_id`
- `branch_artifact_ids_and_digests`
- `complaint_event_trace_status`
- `cohort_denominator_comparability`
- `pmcf_rwe_applicability`
- `action_capa_risk_trace_status`
- `jurisdictional_rule_source_matrix`
- `conflicting_evidence_ids`
- `missing_evidence_queue`
- `qualified_decision_question`
- `separately_signed_decision_reference`

Preserve raw narrative/code, normalized terminology, supplied interpretation, derived rate, hypothesis and reserved decision separately. Never erase a source because another record appears more complete.

## Procedure

1. Freeze device/version, jurisdiction, evidence cutoff, terminology/rule sources and privacy authority.
2. Copy only authorized source facts and bind every fact to exact source/version/date.
3. Define numerator, denominator, unit and exposure window before any calculation.
4. Record transformations, duplicate handling and terminology mapping without overwriting raw data.
5. Link supporting and contradictory evidence IDs and run the checks below.
6. Assign gaps and reserved decisions to qualified reviewers; do not contact external parties or execute actions.

## Reconciliation checks

- all four roots are present or explicitly stopped
- complaint populations reconcile to trend cohorts
- actions and CAPA trace to source evidence and risk versions
- no branch conclusion becomes reportability, signal or recall authority
- device/version and jurisdiction agree across linked records
- terminology and regulatory sources have explicit version/as-of dates
- unknown, conflicting and stopped evidence remains visible
- `decision_not_made` remains true without a separate authorized decision reference

## Completion boundary

Completing fields means only that evidence is ready for review. It does not establish causality, seriousness, reportability, safety signal, benefit-risk, CAPA effectiveness, recall, compliance, submission or clinical action.
