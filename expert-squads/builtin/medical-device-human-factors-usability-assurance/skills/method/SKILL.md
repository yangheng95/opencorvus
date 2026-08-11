---
name: medical-device-human-factors-usability-assurance-method
description: Medical-device use specification, task and use-related-risk analysis, formative and summative evidence, and usability-engineering traceability without compliance or residual-risk authority. Use for Select for intended users, uses and environments, user-interface inventory, task analysis, use-error evidence, critical-task trace, formative studies, summative protocol/results, labeling/training dependencies, or usability-file gaps. Do not select for UI automation, device modification, participant activity, regulatory submission or conformance decisions.
---

# Medical Device Human Factors Usability Assurance Method

## Purpose and authority

Produce a reproducible evidence pack for qualified review. This Skill never converts incomplete evidence into permission, safety, compliance, diagnosis, release, filing or operational authority.

- Do not recruit, consent, expose, observe or contact participants; do not operate or modify a medical device.
- Do not approve a protocol, critical-task list, risk rating, sample size, usability validation, residual risk, compliance or submission.
- Qualified human-factors engineers, risk management, clinical, quality, regulatory and device owners retain decisions.

## Freeze the review baseline

Before analysis, freeze:

- device/model/software/UI/labeling/training versions
- intended user groups, use environments, indications and operating contexts as supplied
- known use problems, risk file and task taxonomy versions
- study protocol, participant groups, simulated-use configuration, evidence cutoff and authorized human-factors/risk owners

Give every source, object, event, observation and decision question a stable ID. Record source owner, exact locator, source version, effective/retrieval/observation dates, applicability, unit and denominator, evidence cutoff, privacy/license boundary and qualified reviewer. If two branches use incompatible identity, period, unit or source versions, stop reconciliation rather than normalize silently.

## Domain evidence method

1. Create a use specification that binds intended users, use environments, operating principle, user interface, training and reasonably foreseeable contexts to one controlled device version.
2. Decompose use scenarios into perceivable user tasks, information, controls, feedback and consequences. Link task failure, omission, delay or sequence error to supplied hazardous situations without inventing risk severity or acceptability.
3. Use formative evidence to discover and trace interaction problems, root observations in participant/task/context records, and link design responses to controlled versions. A design response is not effectiveness evidence.
4. Keep summative protocol adequacy, execution deviations, task outcomes, close calls, use errors, subjective feedback and root-cause hypotheses separate. Do not turn a sample count or success percentage into a pass decision.
5. Reconcile every critical task and known use problem through risk analysis, formative evidence, design/label/training control and summative evidence. Leave residual-risk, regulatory and release decisions to authorized reviewers.

Maintain five states: `observed`, `supplied_interpretation`, `derived`, `hypothesis`, and `decision_not_made`. Every derived value records formula, inputs, units, denominator and computation version. Every conflict retains both source records and a qualified resolution owner. Absence, silence and failed retrieval are never positive evidence.

## Parallel branches and join

### Device Use Specification and Interface Analyst

Freezes intended users, uses, environments, device/UI versions, labeling, training and interface boundaries.

- user populations and capabilities
- use environments and operating contexts
- device/interface element inventory
- labeling and training dependencies

Reconcile:

- all evidence points to one controlled version
- user groups are not collapsed
- environmental constraints are explicit

Stop when:

- device version ambiguous
- intended user group absent
- uncontrolled labeling or training

### Critical Task and Use-Risk Analyst

Maps task sequences, use difficulties, errors and supplied hazardous situations without risk acceptance.

- task decomposition
- perception/cognition/action/feedback
- known use problems
- critical-task rationale and risk trace

Reconcile:

- task and harm pathways are traceable
- risk attributes remain as supplied
- mitigations do not erase observed failures

Stop when:

- hazard source missing
- criticality requested without authority
- device behavior unknown

### Formative Usability Evidence Analyst

Traces formative study scope, observations, design hypotheses and controlled design responses.

- participant/task/context coverage
- observation and evidence coding
- root-cause hypotheses
- design/label/training response trace

Reconcile:

- raw observation remains distinct from interpretation
- design versions are explicit
- unresolved findings carry forward

Stop when:

- participant privacy scope absent
- study record incomplete
- live participant work requested

### Summative Usability Traceability Analyst

Reviews supplied summative protocol/execution/results and critical-task coverage without declaring validation success.

- protocol and simulated-use fidelity
- participant and task coverage
- use errors, close calls and difficulties
- deviations and root-cause trace

Reconcile:

- denominators are explicit
- deviations are not silently excluded
- every critical task maps to evidence

Stop when:

- protocol version conflict
- missing raw outcome evidence
- pass/fail or submission decision requested

### Medical Device Human Factors Usability Review Owner

Joins use specification, use-risk, formative and summative branches into a controlled usability-engineering review pack.

- version alignment
- critical-task evidence coverage
- known-use-problem closure
- qualified decision queue

Reconcile:

- trace IDs resolve end to end
- observations and decisions are separated
- compliance remains decision_not_made

Stop when:

- device baseline unresolved
- critical branch missing
- qualified review owner absent

Run the root branches independently. The join starts only after all roots return or explicitly stop. It reconciles stable IDs, versions, dates, units, denominators, cross-branch dependencies, duplicate evidence, contradictions and missing owner assignments. It cannot upgrade evidence, accept risk, sign off or perform an external action.

## Reusable assets

- `assets/device-use-specification-interface-baseline.md`: Freeze the device-user system and controlled interface. Required domain fields: device_model_version, software_UI_version, intended_user_group, use_environment, operating_context, interface_element_id, labeling_version, training_version.
- `assets/critical-task-use-error-hazard-trace-matrix.md`: Trace tasks and supplied use-related risk evidence. Required domain fields: scenario_id, task_id, step, information_or_control, possible_use_error, hazardous_situation_id, risk_attributes_as_supplied, critical_task_rationale.
- `assets/formative-study-observation-design-response-ledger.md`: Preserve participant/task observations and controlled responses. Required domain fields: study_version, participant_group, task_id, observation_id, raw_observation, interpretation, root_cause_hypothesis, design_response_version, verification_status.
- `assets/summative-protocol-result-deviation-register.md`: Reconcile protocol coverage, outcomes and deviations. Required domain fields: protocol_version, simulated_use_configuration, participant_group, task_id, attempt_denominator, outcome, use_error_or_close_call, deviation_id, evidence_pointer.
- `assets/human-factors-usability-qualified-review-pack.md`: Present end-to-end trace, gaps and decisions reserved for qualified owners. Required domain fields: device_baseline, critical_task_coverage, known_problem_status, formative_response_status, summative_evidence_status, unresolved_risk_questions, decision_not_made, qualified_owner.

Read each selected asset before producing output. Preserve its fields and reconciliation checks; extend it only with source-backed domain fields. Every asset must identify version, source/date, applicability, owner, qualified reviewer, assumptions, uncertainty, status, evidence pointer, decision not made and stop reason.

## Stop and escalation

Stop on identity conflict, missing authority, incompatible versions, unresolvable units or denominator, unverifiable source, unauthorized personal/confidential data, material evidence contradiction, or any request for a reserved action. Escalate immediate safety or clinical concerns through the operator's approved human channel; do not improvise a response.

## Sources and adaptation boundary

Read `references/SOURCE-PROVENANCE.md` and `references/PRIMARY-SOURCES.md` before relying on a method or current requirement. Bounded MIT adaptation of use specification, critical task, formative/summative separation and traceability from sven-jungmann/iec62366-usability-skill at 635077cdabfab79f595f305d9318cbf981a637ff, SKILL.md. Standard text, hard-coded risk ratings, pass/compliance conclusions, participant activity, device changes and submission behavior are excluded; evidence governance is clean-room. Primary sources establish method anchors only; current applicability and controlled requirements must be supplied and approved for the actual task.
