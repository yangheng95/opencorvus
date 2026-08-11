---
name: transfusion-medicine-blood-component-assurance-method
description: Evidence continuity for patient, order, specimen, blood component, compatibility, issue, transfusion, reaction and blood-bank quality records without component-selection or clinical authority. Use for Select for patient/specimen/order identity, component inventory and attributes, test and compatibility trace, issue/transfusion chain, reaction workup evidence, wastage, recall or quality discrepancy review. Do not select to choose, crossmatch, release or transfuse a component, diagnose a reaction, or advise a patient.
---

# Transfusion Medicine Blood Component Assurance Method

## Purpose and authority

Produce a reproducible evidence pack for qualified review. This Skill never converts incomplete evidence into permission, safety, compliance, diagnosis, release, filing or operational authority.

- Do not select, allocate, crossmatch, release, issue, return, discard or transfuse blood components.
- Do not diagnose or classify a transfusion reaction, determine causality/reportability, advise treatment, or communicate with a donor or patient.
- Qualified transfusion medicine physicians, blood-bank technologists, nursing/clinical owners, quality and regulatory staff retain every decision.

## Freeze the review baseline

Before analysis, freeze:

- facility and blood-bank systems of record
- patient/order/specimen identifiers and collection times
- component donation/product/division identifiers, attributes, status and storage history
- method/reagent/instrument versions, authorized procedures, evidence cutoff and medical/technical review owners

Give every source, object, event, observation and decision question a stable ID. Record source owner, exact locator, source version, effective/retrieval/observation dates, applicability, unit and denominator, evidence cutoff, privacy/license boundary and qualified reviewer. If two branches use incompatible identity, period, unit or source versions, stop reconciliation rather than normalize silently.

## Domain evidence method

1. Build an unbroken identity chain from authorized patient/order through specimen and every component unit. Treat mislabeled, duplicated, merged or unresolvable identifiers as a stop, not a clerical assumption.
2. Keep component attributes, inventory status, storage/transport evidence, test observations and compatibility interpretations as separate source-owned facts. Never infer suitability from a product code or apparent ABO/Rh label alone.
3. Reconcile reservation, allocation, issue, return, transfusion, discard and transfer events by unit/division and timestamp. Preserve actor, system, location, quantity and status transition; do not create a release or movement instruction.
4. For suspected reactions, construct only a chronology and evidence checklist from supplied records. Do not determine causality, reaction type, severity, reportability, treatment or donor action.
5. Quality review must expose unresolved identity, temperature, timing, test, inventory and documentation discrepancies with an authorized owner. Operational urgency never permits invented compatibility or missing evidence.

Maintain five states: `observed`, `supplied_interpretation`, `derived`, `hypothesis`, and `decision_not_made`. Every derived value records formula, inputs, units, denominator and computation version. Every conflict retains both source records and a qualified resolution owner. Absence, silence and failed retrieval are never positive evidence.

## Parallel branches and join

### Patient Order Specimen Identity Analyst

Freezes authorized patient, order, specimen, collection, labeling and chain-of-custody evidence.

- patient/order/specimen identity
- collection and receipt chronology
- label and collector evidence
- sample validity questions

Reconcile:

- identifiers agree across systems
- collection time precedes testing
- duplicate and historical samples are distinguished

Stop when:

- identity mismatch
- unlabeled or ambiguous specimen
- unauthorized patient data

### Blood Component Inventory Compatibility Evidence Analyst

Traces component identity, attributes, storage, test and compatibility evidence as supplied.

- donation/product/division identity
- component attributes and modifications
- storage and transport chronology
- method/reagent/instrument and test observations

Reconcile:

- unit/division IDs remain unique
- temperature evidence has units and timestamps
- compatibility status points to authorized source

Stop when:

- component identity conflict
- required test source missing
- request asks for component selection

### Component Issue and Transfusion Trace Analyst

Reconciles reservation, issue, transport, bedside receipt, transfusion, return and disposition events.

- status transitions
- location and custody
- start/stop and volume as supplied
- return/discard/transfer reconciliation

Reconcile:

- one unit has no conflicting terminal states
- quantities and times reconcile
- unverified bedside activity is marked unknown

Stop when:

- missing custody handoff
- conflicting disposition
- live movement or release requested

### Transfusion Reaction and Quality Reconciliation Analyst

Assembles reaction chronology, supplied workup observations, notifications and quality-event linkage without diagnosis.

- symptom/event chronology as recorded
- component and sample linkage
- laboratory workup observations
- notification/CAPA evidence

Reconcile:

- pre/during/post times are explicit
- causality is not inferred
- quality actions have owner and verification evidence

Stop when:

- clinical emergency
- reaction classification requested
- reporting decision requested

### Transfusion Medicine Blood Component Assurance Owner

Joins identity, component, issue/transfusion and reaction/quality evidence into a qualified-review pack.

- identity continuity
- component status reconciliation
- chronology and discrepancy map
- qualified decision queue

Reconcile:

- all unit and specimen IDs resolve
- conflicting states remain visible
- clinical and release decisions remain decision_not_made

Stop when:

- identity chain unresolved
- material compatibility source absent
- qualified reviewer unavailable

Run the root branches independently. The join starts only after all roots return or explicitly stop. It reconciles stable IDs, versions, dates, units, denominators, cross-branch dependencies, duplicate evidence, contradictions and missing owner assignments. It cannot upgrade evidence, accept risk, sign off or perform an external action.

## Reusable assets

- `assets/patient-order-specimen-identity-chain-register.md`: Preserve authorized identity and specimen custody. Required domain fields: patient_token, order_id, specimen_id, collector, collection_time, receipt_time, label_status, system_record_id.
- `assets/blood-component-attribute-inventory-quality-ledger.md`: Track unit/division attributes and storage evidence. Required domain fields: donation_id, product_code, division_id, component_type, ABO_Rh_as_labeled, modifications, expiration_as_supplied, storage_event, temperature_unit.
- `assets/testing-compatibility-evidence-matrix.md`: Map methods, observations and authorized interpretations. Required domain fields: specimen_id, test_id, method_version, reagent_lot, instrument_id, observation, units, quality_control_status, interpretation_source.
- `assets/component-issue-transfusion-disposition-trace.md`: Reconcile each physical and recorded status transition. Required domain fields: unit_division_id, event_type, event_time, location, actor_role, quantity_unit, prior_status, new_status, evidence_pointer.
- `assets/reaction-quality-qualified-review-pack.md`: Present chronology, supplied workup and unresolved qualified decisions. Required domain fields: reaction_case_id, unit_ids, chronology, observations, notifications_as_recorded, quality_event_ids, unknowns, decision_not_made, qualified_owner.

Read each selected asset before producing output. Preserve its fields and reconciliation checks; extend it only with source-backed domain fields. Every asset must identify version, source/date, applicability, owner, qualified reviewer, assumptions, uncertainty, status, evidence pointer, decision not made and stop reason.

## Stop and escalation

Stop on identity conflict, missing authority, incompatible versions, unresolvable units or denominator, unverifiable source, unauthorized personal/confidential data, material evidence contradiction, or any request for a reserved action. Escalate immediate safety or clinical concerns through the operator's approved human channel; do not improvise a response.

## Sources and adaptation boundary

Read `references/SOURCE-PROVENANCE.md` and `references/PRIMARY-SOURCES.md` before relying on a method or current requirement. Clean-room method authored by OpenCorvus contributors. No mature, licensed Agent Skill was found with a complete patient/order/specimen/component/compatibility/issue/transfusion/reaction evidence boundary. No standard text, threshold or clinical decision rule is copied. Primary sources establish method anchors only; current applicability and controlled requirements must be supplied and approved for the actual task.
