# Clinical Biostatistics Data Monitoring Qualified Review Pack

## Purpose and decision boundary

Join estimand, derivation, model and interim-monitoring evidence while preserving access separation and all scientific decisions for qualified owners. This reusable structure prepares evidence for role-appropriate qualified review; it is not an approved SAP, data correction, validated program, signed result, DMC recommendation, regulatory conclusion or clinical decision.

## Artifact control

Shared contract aliases: `source_id_locator` identifies the resolvable evidence pointer; `source_version_date` records exact version plus effective, observation and retrieval dates; `units_and_denominator` records unit, basis, denominator, time window and formula revision. These aliases are mandatory in addition to the domain-specific control fields below.

| Field                       | Required content                                                                                                      |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| artifact_id                 | Stable study/statistical identifier and immutable row ID                                                              |
| artifact_version            | Dated revision with supersedes/superseded-by                                                                          |
| source_locator_version_date | Exact document/dataset/program/output locator, owner, version, effective/observation/retrieval dates                  |
| evidence_cutoff             | Authorized snapshot timestamp/timezone and checksum where applicable                                                  |
| applicability               | Study, objective, estimand, endpoint, population, analysis, data standard and regulatory context                      |
| value_unit_denominator      | Authorized value, unit, denominator/analysis set, formula and program/environment version, or explicit not applicable |
| owner                       | Source/document/data/program custodian accountable for correction                                                     |
| qualified_reviewer          | Named statistician, programmer/data manager, DMC, medical, privacy/ethics or regulatory role                          |
| assumptions_uncertainty     | Missingness, model assumptions, sensitivity limits, confidence and competing explanations                             |
| privacy_license_blinding    | Personal-data authority, reuse boundary, blinded/unblinded class and permitted roles                                  |
| status                      | prespecified, amended, post_hoc, observed, derived, hypothesis, blocked or decision_not_made                          |
| decision_not_made           | True until a separately authorized and signed decision reference exists                                               |
| outcome_unknown             | True whenever statistical, monitoring, clinical or regulatory conclusion is unresolved                                |
| stop_escalation             | Stop reason, affected IDs, access-safe qualified owner and approved escalation route                                  |

## Domain records

Use one row or subsection for each stable record:

- `review_pack_id`
- `controlled_baseline_id`
- `branch_artifact_ids_and_digests`
- `estimand_to_result_coverage`
- `source_sdtm_adam_trace_status`
- `model_missing_multiplicity_status`
- `interim_access_blinding_status`
- `deviation_and_change_map`
- `conflicting_evidence_ids`
- `missing_evidence_queue`
- `role_bounded_decision_question`
- `separately_signed_decision_reference`

Keep prespecified specification, amendment, source fact, derived result, independent check, interpretation and reserved decision separate. Never expose restricted treatment information to a role that is not authorized.

## Procedure

1. Freeze protocol/SAP/charter, data snapshot/checksum/cutoff, standards, program environment and role-access map.
2. Copy only authorized source facts with exact locator/version/date and access class.
3. Build predecessor links before claiming derivation or reproducibility.
4. Record formula, inputs, analysis set, unit/denominator, program and environment for every derived value.
5. Preserve conflicting specifications/results and run the reconciliation checks below.
6. Assign gaps and decisions to qualified roles without unblinding, data mutation or external submission.

## Reconciliation checks

- all four roots are present or explicitly stopped
- every result traces to estimand, population, data and program versions
- restricted artifacts do not cross access roles
- no branch conclusion becomes statistical sign-off or DMC advice
- stable IDs and predecessor links resolve across selected assets
- protocol, SAP, data cutoff, analysis set and program versions are aligned
- access/blinding restrictions remain intact
- unknown/conflicting/stopped evidence remains visible and `decision_not_made`

## Completion boundary

Template completion means the evidence is reviewable. It does not approve a method, threshold, analysis population, dataset, result, unblinding, stop/continue/adapt recommendation, filing or clinical conclusion.
