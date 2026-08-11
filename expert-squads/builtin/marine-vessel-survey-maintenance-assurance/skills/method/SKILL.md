---
name: marine-vessel-survey-maintenance-assurance-method
description: Marine vessel identity, statutory/class source, hull survey, machinery/electrical maintenance, defect, repair, nonconformity and verification evidence assurance without seaworthiness or sailing authority. Use for Select for vessel identity, flag/class/statutory record trace, hull/structure condition, machinery/electrical maintenance, critical equipment, defects, repairs, nonconformities or survey verification. Do not select to declare seaworthiness, class/certificate validity, authorize sailing, issue a survey or accept a defect.
---

# Marine Vessel Survey Maintenance Assurance Method

## Purpose and authority

Produce a reproducible evidence pack for qualified review. This Skill never converts incomplete evidence into permission, safety, compliance, diagnosis, release, filing or operational authority.

- Do not operate vessel, machinery, electrical, ballast, fire, lifesaving, navigation or pollution-control equipment.
- Do not declare seaworthiness, class maintained, certificate valid, defect accepted, survey complete or vessel ready to sail; do not issue work, isolation, repair or deferment.
- Master, chief engineer, company designated person, flag administration, recognized organization/class surveyor and repair/quality authorities retain decisions.

## Freeze the review baseline

Before analysis, freeze:

- IMO number, vessel name, flag, type, service, owner/manager and class/recognized-organization identities
- configuration, drawings, machinery/equipment register, planned-maintenance and safety-management versions
- certificate/survey/condition records as supplied, evidence cutoff, voyage/operating context
- master, chief engineer, designated person, flag, class surveyor, repair and quality authorities

Give every source, object, event, observation and decision question a stable ID. Record source owner, exact locator, source version, effective/retrieval/observation dates, applicability, unit and denominator, evidence cutoff, privacy/license boundary and qualified reviewer. If two branches use incompatible identity, period, unit or source versions, stop reconciliation rather than normalize silently.

## Domain evidence method

1. Anchor all records to IMO number and controlled vessel configuration. Keep flag-state, class, recognized-organization, port-state and company safety-management sources separate; one source never substitutes for another's approval.
2. Map hull/structure observations to compartment, frame, deck, tank or member with material, coating, corrosion/crack/deformation, thickness/NDE method, value/unit, allowable source as supplied, access limitation and survey context.
3. Trace machinery, electrical and safety-critical equipment by equipment ID, system, redundancy, maintenance-plan task/version, work order, test, failure, deferment as supplied, spare and verification. Execution does not prove effectiveness.
4. Represent defect, temporary measure, repair, test, survey/inspection and closure as distinct states. Preserve condition/recommendation, due window and extension only as supplied by authorized records.
5. Reconcile survey/certificate applicability and maintenance evidence without declaring validity, class status, seaworthiness or fitness for voyage. Route conflicts to flag/class/company and technical owners.

Maintain five states: `observed`, `supplied_interpretation`, `derived`, `hypothesis`, and `decision_not_made`. Every derived value records formula, inputs, units, denominator and computation version. Every conflict retains both source records and a qualified resolution owner. Absence, silence and failed retrieval are never positive evidence.

## Parallel branches and join

### Vessel Identity Statutory Class Authority Analyst

Freezes vessel/configuration identity and separates flag, statutory, class, port-state and company records.

- IMO/vessel/flag/owner identity
- class and recognized organization
- configuration/service/area
- certificate/survey/condition source map

Reconcile:

- one vessel identity across records
- issuer and authority are explicit
- validity is not inferred

Stop when:

- IMO/configuration conflict
- issuer unknown
- certificate determination requested

### Vessel Hull Structure Condition Survey Analyst

Maps hull, tank, deck, member, coating, corrosion, cracking, deformation and thickness evidence.

- compartment/member location
- visual/NDE/thickness method
- value/unit and allowable source as supplied
- access and survey limitations

Reconcile:

- location reproducible
- measurement and allowable sources separate
- condition does not become seaworthiness conclusion

Stop when:

- unlocated defect
- measurement basis missing
- immediate vessel-safety concern

### Vessel Machinery Electrical Maintenance Analyst

Traces critical equipment, redundancy, maintenance, tests, failures, deferments, spares and verification.

- equipment/system hierarchy
- planned-maintenance task/version
- work order/test/failure chronology
- redundancy and spare dependencies

Reconcile:

- task matches equipment/configuration
- deferment source is authorized
- test result has acceptance source as supplied

Stop when:

- equipment identity conflict
- critical redundancy unknown
- live maintenance instruction requested

### Vessel Defect Repair Nonconformity Analyst

Traces defect, temporary measure, repair, nonconformity, survey/inspection, verification and closure evidence.

- defect/nonconformity identity
- temporary measure and authority
- repair design/work evidence
- inspection/test and closure

Reconcile:

- state transitions are complete
- repair version and evidence resolve
- closure authority is explicit

Stop when:

- unverified repair
- condition/extension approval requested
- sailing decision requested

### Marine Vessel Survey Maintenance Review Owner

Joins vessel authority, hull, machinery and defect/repair evidence into a qualified marine review pack.

- vessel/configuration alignment
- flag/class/company source separation
- critical equipment and defect state
- qualified survey/maintenance decision queue

Reconcile:

- all equipment and defects resolve
- closures have verification
- seaworthiness and sailing remain decision_not_made

Stop when:

- vessel identity unresolved
- critical safety evidence gap
- authorized maritime reviewer absent

Run the root branches independently. The join starts only after all roots return or explicitly stop. It reconciles stable IDs, versions, dates, units, denominators, cross-branch dependencies, duplicate evidence, contradictions and missing owner assignments. It cannot upgrade evidence, accept risk, sign off or perform an external action.

## Reusable assets

- `assets/vessel-identity-statutory-class-authority-baseline.md`: Freeze vessel, configuration, issuer and authority sources. Required domain fields: IMO_number, vessel_name_flag_type, owner_manager, service_area, class_RO, configuration_revision, certificate_survey_record_as_supplied, issuer_authority.
- `assets/vessel-hull-structure-corrosion-survey-ledger.md`: Preserve location-specific hull/structure evidence. Required domain fields: survey_id, compartment_frame_member, material_coating, observation, thickness_NDE_method, value_unit, allowable_source_as_supplied, access_limit.
- `assets/vessel-machinery-electrical-critical-equipment-maintenance-register.md`: Trace equipment and maintenance/test evidence. Required domain fields: equipment_id_system, criticality_as_supplied, redundancy, PMS_task_version, work_order, test_result, failure_deferment_as_supplied, spare_dependency, verification.
- `assets/vessel-defect-repair-nonconformity-verification-register.md`: Track controlled defect-to-closure states. Required domain fields: defect_NC_id, location_equipment, temporary_measure, authority_source, repair_design_work_revision, inspection_test, condition_recommendation_as_supplied, closure_verification.
- `assets/marine-vessel-survey-maintenance-qualified-review-pack.md`: Present source-separated survey/maintenance evidence and reserved decisions. Required domain fields: vessel_baseline, statutory_class_questions, hull_status, machinery_status, defect_repair_status, critical_gaps, decision_not_made, authorized_owner.

Read each selected asset before producing output. Preserve its fields and reconciliation checks; extend it only with source-backed domain fields. Every asset must identify version, source/date, applicability, owner, qualified reviewer, assumptions, uncertainty, status, evidence pointer, decision not made and stop reason.

## Stop and escalation

Stop on identity conflict, missing authority, incompatible versions, unresolvable units or denominator, unverifiable source, unauthorized personal/confidential data, material evidence contradiction, or any request for a reserved action. Escalate immediate safety or clinical concerns through the operator's approved human channel; do not improvise a response.

## Sources and adaptation boundary

Read `references/SOURCE-PROVENANCE.md` and `references/PRIMARY-SOURCES.md` before relying on a method or current requirement. Clean-room method. Rejected vamseeachanta/workspace-hub@6a1d0181386633cc11e53be6a03bd1a48b36ae93 marine-offshore-engineering and fitness-for-service Skills because no applicable license/NOTICE closes reuse and their offshore-design/pressure-equipment scope lacks vessel identity, statutory/class survey and planned-maintenance governance. Retained: none; no candidate text copied. Primary sources establish method anchors only; current applicability and controlled requirements must be supplied and approved for the actual task.
