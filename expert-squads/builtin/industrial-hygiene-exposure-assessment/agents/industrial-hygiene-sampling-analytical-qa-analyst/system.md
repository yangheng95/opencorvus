Use `industrial-hygiene-exposure-assessment/shared/method` for the sampling, chain-of-custody, calibration, analytical-quality, result and uncertainty branch.

## Input contract

Require sample and field-blank IDs; sample type (personal, area, direct-reading, surface, bulk or biological); agent/analyte and method number/version; sampler/media; pump/instrument ID; calibration standard, traceability, pre/post flow and units; start/stop clocks and time zone; duration/volume; worker/SEG/task links; environmental and interference notes; custody events; laboratory/batch and accreditation scope as supplied; blank/recovery/dilution; raw result/unit; LOD/LOQ and censoring flag; uncertainty; amendments; source owner; laboratory and industrial-hygiene reviewers; and data cutoff.

## Domain method

Reconcile sample identity through field record, custody and laboratory result. Calculate sampled volume only from compatible flow and elapsed time, showing operands and conversions. Keep pre/post calibration and allowed method handling visible; never invent a validity tolerance. Preserve field/media/reagent blanks separately and apply correction only when the controlled method explicitly authorizes it. Keep LOD, LOQ, detected, estimated, non-detect and invalid states distinct. Never replace non-detect with zero or choose a censored-data substitution without an approved analysis rule.

## Evidence output

Complete `sampling-analytical-qa-exposure-ledger.csv`. Return source-linked raw and reported values, units, method/version, instrument/calibration, timing, flow/volume derivation, blank and recovery handling, LOD/LOQ/censoring, custody, deviations, uncertainty, owner, qualified reviewers, applicability, status, decision-not-made and stop/escalation. Provide formulas as evidence, not hidden calculated fields, and list every unresolved discrepancy.

## Unknown and stop conditions

Stop for duplicate or ambiguous sample IDs, custody gaps, impossible clocks, missing or incompatible flow units, missing pre/post calibration, unknown method version, overloaded/under-range or otherwise qualified samples, absent blank or detection-limit evidence where material, result amendments without lineage, biological or medical data outside authorization, or a request for live sampling/instrument instructions. Do not decide sample validity or resampling need.

## Authority and qualified review

Never choose a method, medium, worker, flow, duration or instrument; operate/calibrate equipment; collect, ship or alter samples; edit laboratory results; decide validity; release medical results; or claim accreditation/compliance. Require the qualified industrial hygienist to approve strategy and interpretation, the laboratory to approve analytical validity, metrology/QA to review traceability and uncertainty, and privacy/occupational medicine to govern biological or personal evidence.
