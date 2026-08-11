---
name: laboratory-quality-assurance-method
description: Structure laboratory method-performance, metrology, uncertainty, sample-custody, QC, proficiency-testing, nonconformance, and CAPA evidence when qualified laboratory review is required.
---

# Laboratory Quality Assurance Method

## Freeze scope before analysis

1. Assign a scope ID and record laboratory/service scope, measurand, matrix, intended use, reportable range, units, method/version, equipment/configuration, governing procedures/versions, source inventory, data lock, responsible owner, and named qualified reviewers.
2. Label the activity correctly: method development, full validation, transfer, modification assessment, or local verification. Do not treat verification as a replacement for validation or infer equivalence across matrices, ranges, sites, instruments, or intended uses.
3. Preserve raw observations and stable source locators. Keep protocol requirements, owner-supplied acceptance criteria, calculations, deviations, observed comparisons, and approval decisions separate.
4. Record the decision explicitly not made. This method never approves method fitness, a decision rule, measurement uncertainty, metrological traceability, calibration status, sample or QC disposition, OOS/OOT/PT/CAPA closure, result release, clinical interpretation, certification, or accreditation.

## Structure method-performance evidence

Treat **method validation** as evidence that performance has been studied for a declared intended use, and verification as local evidence against a previously established claim. Neither label is an approval.

Freeze performance claims and acceptance criteria before inspecting results. Evaluate only characteristics justified by intended use and the authorized protocol. Depending on scope, these may include precision, bias or trueness, recovery, selectivity/specificity, linearity or calibration model, reportable range, detection and quantification capability, carryover, stability, and robustness.

Preserve replicate and run structure, operators, instruments, lots, levels, units, missing values, exclusions, transformations, software/version, formula, and rounding. Distinguish repeatability from intermediate precision. Record bias against the declared reference and its uncertainty without claiming trueness or fitness. Never invent universal thresholds, remove outliers without an approved rule, or extrapolate beyond the studied matrix/range.

For every performance row capture the protocol criterion as supplied, observed result with unit and denominator/replicates, calculation version, deviation, uncertainty, applicability, and required reviewer. A comparison to criteria is evidence for review, not approval.

## Trace equipment and metrology

Metrological traceability is a property of a measurement result, supported by a documented unbroken chain of calibrations in which each contributes uncertainty. An instrument label or accredited supplier name alone is not proof.

Trace reported result to method, equipment/configuration and use date, calibration and intermediate checks, certificate scope, reference standard or certified reference material, calibration hierarchy, and stated reference. At each link record quantity, value, unit, range, date, validity, uncertainty, source/version, environmental applicability, and responsible owner. Distinguish calibration, adjustment, verification, maintenance, and intermediate checks.

When an authorized measurement model `y=f(x)` is supplied, record Type A components derived from observations and Type B components derived from certificates/specifications/other information. Preserve distribution, divisor, standard uncertainty, sensitivity coefficient, covariance/correlation, degrees of freedom if used, and source. Calculate combined standard uncertainty under the authorized model and expanded uncertainty `U = k × u_c` only with the supplied coverage factor and rationale. Never select the model, distribution, correlation, or `k`; never declare that the result is traceable or fit.

## Audit samples, QC, PT, and quality events

Reconstruct chain of custody using sample/batch/run ID, actor, date/time/timezone, location, condition, preservation, transfer, receipt, preparation, aliquot, storage, and disposition evidence. Do not fill custody gaps or change state.

Compare blanks, duplicates, spikes, control materials, certified reference materials, environmental observations, and run-order effects only against limits from a versioned authorized procedure and a valid baseline. Never generate generic control limits or choose a baseline. Preserve target, units, lot, observed value, denominator, rule, calculation, and exception.

For proficiency testing, reproduce a `z` score or normalized error `E_n` only when the scheme supplies assigned value, standard deviation or participant/reference uncertainties, scoring rule, units, and version. Do not apply generic interpretations. Trace nonconformance from detection through containment, investigation, cause evidence, correction, CAPA, effectiveness evidence, reviewer decision, and closure evidence; absence of a record remains a gap, not proof of failure or closure.

## Join the branches

Cross-check method and equipment versions, units, sample/run identity, criteria versions, calibration validity, data locks, QC/PT schemes, and dates. Link evidence; do not overwrite conflicts. Classify each branch as complete, qualified-review-required, stopped, or superseded. A complete branch means its evidence record is complete for review, not that the method, equipment, result, or laboratory is approved.

Populate exactly the five templates under `assets/`. Every material row must carry artifact or row ID, artifact version, source ID/locator/version/date, effective/data-lock date, value/count and unit/denominator, responsible owner, qualified reviewer, jurisdiction or applicability, assumptions, uncertainty/confidence, privacy/license, status, decision explicitly not made, and stop condition/reason.

## Stop and escalate

Stop on unknown measurand, matrix, method/equipment version, unit, criteria provenance, source identity, calibration scope, certificate validity, sample custody, PT rule, uncertainty model, privacy authorization, or incompatible data locks. Stop before changing equipment/LIMS/sample state, choosing acceptance criteria or decision rules, excluding data, approving uncertainty or traceability, invalidating/rerunning/releasing results, closing OOS/OOT/PT/CAPA, interpreting a patient result, or claiming certification/accreditation.

Route method evidence to method subject-matter experts and the technical manager; metrology and uncertainty to a metrologist; deviations, nonconformance and CAPA to quality management; release to the laboratory director or authorized signatory; clinical meaning to a qualified clinician; conformity to the applicable accreditation/regulatory body. The artifacts are evidence aids, not clinical, legal, certification, or accreditation advice.

## Source boundary

Read `references/UPSTREAM.md`. This method is a bounded modification of general evidence-readiness ideas in the pinned MIT K-Dense source. It excludes device-quality lanes, standard text, scripts, tools, scores, and conformity conclusions. The verbatim upstream license is in `references/LICENSE.md`.
