---
name: biopharmaceutical-manufacturing-quality-method
description: Prepare source-grounded biopharmaceutical GMP batch, material/equipment genealogy, electronic-record, deviation, OOS/OOT, CAPA, process-validation, control-strategy, continued-verification, contamination-control, and data-integrity evidence. Use for bounded manufacturing-quality reviews requiring Quality Unit and qualified human decisions; never use to alter records or parameters, close investigations/CAPA, approve validation, release product/equipment/areas, submit, or claim quality, sterility, or compliance.
---

# Biopharmaceutical Manufacturing Quality Method

## Freeze GMP scope and authority

1. Record site/facility/area, process/product, dosage/form and sterile/non-sterile applicability, batch/lot scope, lifecycle stage, evidence cutoff/time zone, data/privacy boundary, accountable owner and excluded decisions.
2. Establish stable IDs for product, process, batch, lot, material, equipment/train/utility, record/step, person-role/signature, sample/result, deviation/OOS/OOT, investigation, CAPA, change, validation, CQA, CPP and control. Refuse ambiguous joins.
3. Preserve value/unit, controlled source/system/audit-trail locator, source authority, version/effective/execution/observation dates, owner, Quality Unit or qualified reviewer, applicability, uncertainty, status, `decision_not_made` and `stop_or_escalation`.
4. Treat approved specifications, methods, formulas, CQA/CPP, ranges, control strategy, sampling/statistics and acceptance criteria as current controlled inputs only. Never invent a threshold, batch count or sample size.

## Reconcile batch execution and genealogy

1. Trace master production/batch requirement → executed entry → material lot → equipment/train/utility → personnel role/signature → timestamp/audit event → result/status as supplied.
2. Keep planned, issued, consumed, returned, rejected, sampled and reconciled material quantities distinct. Calculate yield/reconciliation only with approved formula and compatible units; show operands and conversions.
3. Preserve original entries, corrections, reason, authorizer, timestamp and audit trail. Do not alter, backdate, complete or reinterpret a record.
4. Record missing, late, out-of-sequence, unsigned, version-conflicting or status-conflicting evidence without deciding falsification, batch impact or disposition.
5. Use [the batch genealogy ledger](assets/biopharma-batch-record-material-genealogy-ledger.csv).

## Investigate deviations and corrective and preventive action as evidence

1. Define the trigger/problem from objective evidence and build an immutable chronology. Separate fact, contemporaneous assessment, hypothesis, test, counterevidence and approved conclusion.
2. Use a cause-analysis tool only if the authorized investigation plan selected it. Do not use fixed recurrence/severity thresholds, automatic method selection or “human error” as a terminal cause.
3. Preserve multiple causes and unresolved alternatives. Trace impact/extent-of-condition status as supplied; do not decide affected product or reportability.
4. Trace every corrective and preventive action (CAPA) → targeted cause/control → implementation/change/training/validation evidence → predeclared effectiveness measure/window → observed result/uncertainty. Completion is not effectiveness or closure.
5. Use [the deviation/CAPA register](assets/deviation-investigation-capa-effectiveness-register.md).

## Trace process-validation lifecycle

1. Keep process design, process qualification and continued process verification stages distinct.
2. Trace CQA → material attribute/process step/CPP → approved range/criterion → monitoring/control → analytical method/sampling/statistical rationale → qualification or batch evidence → deviation/change/CAPA.
3. Link equipment/facility/utility qualification, calibration/maintenance, cleaning, hold-time, transport, contamination control, environmental monitoring and computerized systems only when applicable and supplied.
4. Compare data only after product/process version, batch, method, unit, sample plan and time basis align. Preserve missing/censored/excluded data and multiple-comparison limitations.
5. Record lifecycle evidence in [the validation trace matrix](assets/process-validation-control-strategy-trace-matrix.md) and trends in [the continued-verification review](assets/continued-process-verification-trend-review.md). Never declare validation success or state of control.

## Join independently produced evidence

1. Require all three branch artifacts, exact versions/hashes and compatible product/process/batch/material/equipment/deviation/validation keys.
2. Create contradictions where master/executed records, genealogy, laboratory status, investigation, CAPA, validation or trend evidence disagree.
3. Use only current approved criteria. Limit proposed actions to obtaining current sources, reconciling IDs/units/versions, re-baselining evidence, specialist review, monitoring or verifying an already authorized action/control.
4. Record source need, dependency, owner, qualified reviewer, date, applicability, uncertainty, status, decision authority and stop condition.
5. Complete [the integrated review pack](assets/biopharma-manufacturing-quality-review-pack.md). The agent never fills a Quality Unit, Qualified Person or release decision field.

## Stop and retain quality authority

Stop for identity/version/audit-trail conflict; missing approved specification/method; unresolved laboratory status; active contamination, sterility or product-quality concern; live process/control request; unauthorized personal/proprietary data; or output implying data-integrity breach, root cause, impact, disposition, deviation/OOS/OOT/CAPA closure, validation success, equipment/area/batch release, recall/reportability, submission, product quality/sterility assurance or GMP compliance.

Never create/alter/backdate/sign records, change parameters or status, validate results, decide cause/impact/disposition, close investigations/CAPA, approve protocols/reports/changes, release equipment/areas/batches, submit to authority or advise patients. Require Manufacturing, Quality Unit/Qualified Person, process/validation engineering, laboratory QA, microbiology/contamination control, engineering/maintenance/utilities, statistics, data integrity, regulatory/legal and site leadership.

## Adaptation and sources

Read [adaptation record](references/adaptation.md), [full MIT license](references/LICENSE-MIT.txt) and [primary sources](references/sources.md). The bounded adaptation retains only objective-evidence investigation, cause hypotheses/counterevidence, action ownership and effectiveness verification from the upstream CAPA Skill. It excludes all fixed thresholds, medical-device defaults, auto-routing, scripts, automatic closure and compliance claims. GMP batch and validation methods are clean-room additions.
