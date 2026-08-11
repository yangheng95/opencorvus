# Clinical Estimand SAP Analysis Population Baseline

## Purpose and decision boundary

Freeze clinical questions, estimand attributes, endpoints, intercurrent-event strategies, SAP chronology and analysis-population rules. This reusable structure prepares evidence for role-appropriate qualified review; it is not an approved SAP, data correction, validated program, signed result, DMC recommendation, regulatory conclusion or clinical decision.

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

- `study_protocol_amendment_id`
- `objective_id`
- `estimand_id`
- `population_attribute`
- `treatment_condition`
- `variable_endpoint_timepoint`
- `intercurrent_event_strategy`
- `population_level_summary`
- `sap_version_effective_date`
- `analysis_population_rule_id`
- `protocol_deviation_rule`
- `treatment_code_blinding_state`
- `change_or_deviation_reference`

Keep prespecified specification, amendment, source fact, derived result, independent check, interpretation and reserved decision separate. Never expose restricted treatment information to a role that is not authorized.

## Procedure

1. Freeze protocol/SAP/charter, data snapshot/checksum/cutoff, standards, program environment and role-access map.
2. Copy only authorized source facts with exact locator/version/date and access class.
3. Build predecessor links before claiming derivation or reproducibility.
4. Record formula, inputs, analysis set, unit/denominator, program and environment for every derived value.
5. Preserve conflicting specifications/results and run the reconciliation checks below.
6. Assign gaps and decisions to qualified roles without unblinding, data mutation or external submission.

## Reconciliation checks

- each estimand has all required source-supplied attributes
- endpoint/time point and population rule map to exact protocol/SAP versions
- prespecified, amended and post hoc states are explicit
- chronology is checked against cutoff and authorized unblinding
- stable IDs and predecessor links resolve across selected assets
- protocol, SAP, data cutoff, analysis set and program versions are aligned
- access/blinding restrictions remain intact
- unknown/conflicting/stopped evidence remains visible and `decision_not_made`

## Completion boundary

Template completion means the evidence is reviewable. It does not approve a method, threshold, analysis population, dataset, result, unblinding, stop/continue/adapt recommendation, filing or clinical conclusion.
