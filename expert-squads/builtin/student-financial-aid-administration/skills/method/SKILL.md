---
name: student-financial-aid-administration-method
description: Source-versioned student financial-aid application, verification, academic, cost, packaging, award, disbursement, reconciliation and exception evidence without eligibility or fund-movement authority. Use for Select for FAFSA/ISIR data provenance, verification documents, academic/program/calendar inputs, cost of attendance, packaging, award, disbursement, reconciliation, satisfactory academic progress, return/withdrawal or overaward evidence. Do not select to determine eligibility, change records, originate/disburse/return funds, contact students or make compliance conclusions.
---

# Student Financial Aid Administration Method

## Purpose and authority

Produce a reproducible evidence pack for qualified review. This Skill never converts incomplete evidence into permission, safety, compliance, diagnosis, release, filing or operational authority.

- Do not determine eligibility, dependency, verification outcome, cost, need, award, SAP, return, overaward or compliance; do not invent deadlines or formulas.
- Do not change FAFSA/ISIR/institutional records, originate/disburse/return/recover funds, post accounts, place holds or contact a student/parent/agency.
- Authorized financial-aid administrators, registrar, bursar/controller, compliance, privacy/data and institutional officials retain decisions.

## Freeze the review baseline

Before analysis, freeze:

- institution, aid year, program, campus, academic calendar/payment periods and source versions
- student/applicant token, FAFSA/ISIR transaction, dependency/status fields as supplied and privacy scope
- cost, need/eligibility inputs, awards, enrollment, academic and disbursement systems of record
- financial-aid administrator, registrar, bursar, compliance, data/privacy and program-review owners

Give every source, object, event, observation and decision question a stable ID. Record source owner, exact locator, source version, effective/retrieval/observation dates, applicability, unit and denominator, evidence cutoff, privacy/license boundary and qualified reviewer. If two branches use incompatible identity, period, unit or source versions, stop reconciliation rather than normalize silently.

## Domain evidence method

1. Anchor every review to institution, aid year, program, academic calendar, payment period and the exact Federal Student Aid/institutional source versions. Do not carry rules or values across aid years by memory.
2. Trace FAFSA/ISIR transactions, corrections, verification selection and supplied documents with transaction numbers, dates, fields, conflict/missing status and authorized resolution owner. Do not infer identity, dependency, income or eligibility.
3. Separate academic eligibility inputs, cost of attendance, student aid index or other supplied need inputs, enrollment intensity/status, packaging policy and award calculations as supplied. Recompute only under an operator-provided approved formula/version.
4. Reconcile award authorization, origination as supplied, anticipated/actual disbursement, student account posting, cash draw/refund/return evidence and program/system records. A scheduled or originated award is not a disbursement.
5. For satisfactory academic progress, withdrawal/return, overaward/overpayment and conflicting information, build a chronology and evidence/owner queue only. Do not determine status, amount, deadline or student communication.

Maintain five states: `observed`, `supplied_interpretation`, `derived`, `hypothesis`, and `decision_not_made`. Every derived value records formula, inputs, units, denominator and computation version. Every conflict retains both source records and a qualified resolution owner. Absence, silence and failed retrieval are never positive evidence.

## Parallel branches and join

### Aid Applicant ISIR Verification Analyst

Freezes applicant token, aid year, FAFSA/ISIR transaction and supplied verification/conflicting-information evidence.

- application/ISIR transaction lineage
- field/source comparison
- verification item/document trace
- correction and conflict chronology

Reconcile:

- aid year and transaction align
- document/source versions recorded
- outcome is not inferred

Stop when:

- identity/privacy scope conflict
- missing ISIR transaction
- eligibility decision requested

### Aid Academic Cost Packaging Analyst

Traces program/calendar/enrollment, cost-of-attendance, need inputs, policy and package calculations as supplied.

- program and academic calendar
- payment period/enrollment status
- cost components and source
- packaging policy/formula version

Reconcile:

- period and program match
- amounts/units/formulas reconcile
- policy applicability has owner

Stop when:

- calendar/program ambiguity
- formula version absent
- award calculation authority requested

### Aid Award Disbursement Reconciliation Analyst

Reconciles supplied award, origination, disbursement, student-account and program cash records without fund movement.

- award and origination identity
- anticipated versus actual disbursement
- student account posting
- program/system/bank reconciliation

Reconcile:

- amounts reconcile by fund/period
- scheduled/originated/paid separated
- returns and adjustments have evidence

Stop when:

- material cash/system break
- award identity conflict
- disbursement/return action requested

### Aid SAP Return Overaward Exception Analyst

Builds source-bound chronology for academic-progress, withdrawal/return, overaward and conflicting-information questions.

- SAP inputs/status as supplied
- withdrawal/attendance chronology
- return calculation as supplied
- overaward/overpayment/conflict evidence

Reconcile:

- dates and periods align
- calculations point to approved source
- status and notification remain reserved

Stop when:

- attendance/withdrawal date unresolved
- current rule source absent
- student decision/contact requested

### Student Financial Aid Administration Review Owner

Joins application, academic/package, disbursement and exception evidence into an authorized aid-administration review pack.

- student/aid-year/program alignment
- input-to-award trace
- award-to-cash reconciliation
- exception and authorized decision queue

Reconcile:

- all transaction IDs resolve
- amounts reconcile or remain open
- eligibility/fund actions remain decision_not_made

Stop when:

- student baseline unresolved
- material reconciliation break
- authorized aid administrator absent

Run the root branches independently. The join starts only after all roots return or explicitly stop. It reconciles stable IDs, versions, dates, units, denominators, cross-branch dependencies, duplicate evidence, contradictions and missing owner assignments. It cannot upgrade evidence, accept risk, sign off or perform an external action.

## Reusable assets

- `assets/aid-year-applicant-isir-verification-ledger.md`: Preserve application transaction and verification evidence. Required domain fields: student_token, institution_aid_year, FAFSA_ISIR_transaction, transaction_date, field_id_value_as_supplied, verification_item_document, correction_conflict, authorized_owner.
- `assets/academic-calendar-cost-packaging-input-register.md`: Trace academic, cost and policy inputs. Required domain fields: program_campus, academic_year_calendar, payment_period, enrollment_status_intensity_as_supplied, cost_component_amount, need_input_as_supplied, packaging_policy_version, formula_source.
- `assets/award-origination-disbursement-reconciliation-ledger.md`: Reconcile award and cash lifecycle evidence. Required domain fields: award_id_fund, payment_period, authorized_amount_as_supplied, origination_status, scheduled_disbursement, actual_disbursement, student_account_posting, program_cash_record, adjustment_return.
- `assets/sap-withdrawal-return-overaward-exception-register.md`: Preserve exception chronology and supplied calculations. Required domain fields: exception_id_type, academic_attendance_source, withdrawal_date_as_supplied, SAP_status_as_supplied, calculation_version_inputs_result_as_supplied, overaward_overpayment, conflicting_information, notification_status_as_supplied.
- `assets/student-financial-aid-qualified-review-pack.md`: Present reconciled evidence, gaps and reserved institutional decisions. Required domain fields: student_aid_year_baseline, verification_status, package_input_status, award_cash_reconciliation, exception_questions, privacy_contact_boundary, decision_not_made, authorized_aid_owner.

Read each selected asset before producing output. Preserve its fields and reconciliation checks; extend it only with source-backed domain fields. Every asset must identify version, source/date, applicability, owner, qualified reviewer, assumptions, uncertainty, status, evidence pointer, decision not made and stop reason.

## Stop and escalation

Stop on identity conflict, missing authority, incompatible versions, unresolvable units or denominator, unverifiable source, unauthorized personal/confidential data, material evidence contradiction, or any request for a reserved action. Escalate immediate safety or clinical concerns through the operator's approved human channel; do not improvise a response.

## Sources and adaptation boundary

Read `references/SOURCE-PROVENANCE.md` and `references/PRIMARY-SOURCES.md` before relying on a method or current requirement. Clean-room method. Search found no mature licensed Agent Skill with a complete institution/aid-year/ISIR/verification/academic/cost/package/disbursement/reconciliation/exception boundary and safe human authority. No handbook or regulation text, deadlines, formulas or eligibility rules are copied. Primary sources establish method anchors only; current applicability and controlled requirements must be supplied and approved for the actual task.
