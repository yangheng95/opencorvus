# Radiotherapy Facility Equipment Software Authority Baseline

## Purpose and decision boundary

Freeze the licensed facility, modalities, treatment systems, sources, accessories, imaging and clinical software configurations plus controlled authority boundaries. This reusable structure records evidence for qualified review; it is not an approval, clinical instruction, calibration certificate, safety determination, compliance statement or release authorization.

## Artifact control

Shared contract aliases: `source_id_locator` identifies the resolvable evidence pointer; `source_version_date` records exact version plus effective, observation and retrieval dates; `units_and_denominator` records unit, basis, denominator, time window and formula revision. These aliases are mandatory in addition to the domain-specific control fields below.

| Field                       | Required content                                                                                                              |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| artifact_id                 | Stable package-domain identifier; never reuse an ID for a changed object                                                      |
| artifact_version            | Immutable revision or dated draft with supersedes/superseded-by                                                               |
| source_locator_version_date | Resolvable locator, source owner, exact version, effective/observation/retrieval dates                                        |
| evidence_cutoff             | Timestamp and timezone after which evidence is excluded                                                                       |
| applicability               | Facility, licence, modality, machine/source/software/configuration, procedure and jurisdiction scope                          |
| value_unit_denominator      | Raw and derived value, unit, geometry/reference basis, denominator and formula/correction version, or explicit not applicable |
| owner                       | Role accountable for source custody and correction                                                                            |
| qualified_reviewer          | Named professional role; blank means review incomplete                                                                        |
| assumptions_uncertainty     | Missingness, measurement uncertainty, confidence, competing explanations and limitations                                      |
| privacy_license             | Access, de-identification, confidentiality, copyright and reuse boundary                                                      |
| status                      | observed, supplied_interpretation, derived, hypothesis, blocked or decision_not_made                                          |
| decision_not_made           | Always true until a separately authorized decision reference is attached                                                      |
| outcome_unknown             | True whenever safety, acceptability, causality, compliance or release is unresolved                                           |
| stop_escalation             | Stop reason, affected evidence IDs, qualified owner and approved escalation channel                                           |

## Domain records

Use one row or subsection per stable record. Required domain fields:

- `facility_id`
- `licence_scope_source`
- `modality`
- `treatment_unit_or_source_id`
- `manufacturer_model_serial`
- `applicator_or_accessory_id`
- `hardware_firmware_version`
- `tps_algorithm_model_dataset_version`
- `ois_rvs_imaging_version`
- `configured_mode_and_limitation`
- `controlled_procedure_id`
- `authorized_role`

Keep raw observation, corrected/normalized value, supplied interpretation, independent check, hypothesis and reserved decision in different fields. Link every value and statement to an evidence pointer.

## Procedure

1. Freeze the orchestrator scope, configuration and evidence cutoff.
2. Copy only authorized source facts; preserve original units, geometry, versions and timestamps.
3. Record transformation, correction or comparison formula and every input before deriving a value.
4. Link supporting and contradicting evidence IDs without overwriting either source.
5. Run the reconciliation checks and record pass, fail, unknown or not applicable.
6. Assign each gap and reserved decision to a qualified reviewer; never self-close it.

## Reconciliation checks

- one physical or logical object maps to one controlled configuration revision
- commissioned-use limitations are explicit
- software and transfer interfaces identify both endpoint versions
- licence and role sources are current as of the evidence cutoff
- stable IDs are unique and resolve across package assets
- source versions, dates, units and configuration scopes are comparable
- every conflict, unknown and stopped branch remains visible
- every qualified decision has an owner and remains `decision_not_made` until separately signed

## Completion boundary

The template is complete only when required fields and evidence links are populated and all unknowns have named owners. Completion does not establish clinical fitness, safety, compliance, acceptance, commissioning, treatment authorization or return-to-service.
