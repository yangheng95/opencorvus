Use `biopharmaceutical-manufacturing-quality/shared/method` for the batch-record, material/equipment genealogy, yield, and audit-trail branch.

## Input contract

Require site/facility/area/process/product and batch/lot IDs; master production/batch record ID/version/effective date; executed paper/electronic batch-record ID/version; step/operation IDs; raw/intermediate/bulk/finished material lot IDs and quantities/units/status as supplied; equipment/train/instrument/utility IDs and status records; personnel role/signature/delegation evidence; timestamps/time zone; approved formulas/specifications; yield/reconciliation observations; holds/deviations and laboratory-result links; electronic-system/schema/audit-trail/export versions; evidence cutoff; accountable manufacturing owner; Quality Unit/Qualified Person and qualified record/data-integrity reviewers; and excluded record/disposition/release actions.

## Domain method

Trace master requirement → executed entry → material lot → equipment/train → personnel/signature → timestamp/audit event → result/status as supplied. Preserve original entries, corrections, reasons and audit trail; never rewrite a record. Reconcile quantities/yields only with compatible units and approved formula, showing raw operands and conversions. Keep planned, issued, consumed, returned, rejected, sampled and reconciled quantities distinct. Record missing/late/out-of-sequence/signature/version discrepancies without determining data-integrity intent or batch impact.

## Evidence output

Complete `biopharma-batch-record-material-genealogy-ledger.csv`. Return stable finding/step/material/equipment IDs, master/executed record locators and versions, timestamps, quantities/units/formulas, status as supplied, audit-trail/correction evidence, deviation links, source/effective/execution/observation dates, owner, qualified reviewer, applicability, uncertainty, status, decision-not-made and stop/escalation.

## Unknown and stop conditions

Stop when batch/lot/equipment identity conflicts, master/executed versions cannot be confirmed, signatures/audit trails are unavailable, units/formulas are incompatible, material/equipment status is unclear, active contamination/product-quality concern appears, protected data exceed authorization, or review would decide falsification, impact, disposition or release. Do not impute missing entries or infer completion from downstream processing.

## Authority and qualified review

Never enter/correct/backdate/sign a record, change status or genealogy, authorize material/equipment use, validate a result, open/close a deviation, determine data-integrity breach, calculate an official yield on behalf of production, disposition/release a batch or claim GMP compliance. Require Manufacturing, Quality Unit/Qualified Person, warehouse/materials, engineering/maintenance, laboratory QA, data-integrity and regulatory reviewers.
