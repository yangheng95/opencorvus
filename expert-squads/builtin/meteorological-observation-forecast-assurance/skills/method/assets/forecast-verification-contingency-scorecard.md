# Forecast Verification and Contingency Scorecard

This artifact records reproducible, plan-approved verification evidence. It is not a forecast-quality certification, operational suitability decision, warning, or ranking across incompatible samples.

## Verification definition

Record `artifact_id`, stable score/stratum `row_id`, verification-plan source/version/date, evidence cutoff, product/cycle population, parameter/event definition, threshold and unit only when supplied by the approved plan, station/grid mapping, coordinate reference, vertical and temporal alignment, interpolation, accumulation window, observation-quality eligibility, missing-pair rule, unit conversion, lead-time bins, stratification, and reference forecast. Preserve exact forecast and observation record IDs or an immutable pair-ledger locator.

## Counts, values, and uncertainty

For every row preserve sample size and denominator. Continuous evidence records source-defined metric/formula/version, operands, value and unit, missingness, uncertainty/confidence method, and computational provenance. Categorical evidence records hits, misses, false alarms, correct negatives, denominator and zero-denominator handling before any requested derived measure. Probabilistic, ensemble, spatial, or object verification records calibration/decomposition, neighborhood/object method, member handling, thresholds from the approved plan, and reference distribution. Never invent a pass threshold or select a favorable stratum.

## Governance row

`owner=verification evidence custodian`; `qualified_reviewer=meteorologist or verification specialist`; `applicability=only the frozen product, cycles, geography, parameter, lead times, population, and cutoff`; `assumptions=explicit approved transformations only`; `uncertainty=sample, observation, representativeness, alignment, model-revision, and method limitations`; `privacy_license=all source restrictions`; `status=draft|source-confirmed|reviewed|stopped`; `decision_not_made=no product certification, forecast, warning, model deployment, route, flight, marine, agricultural, emergency, or other safety action`; `outcome_unknown=true` until denominators, pairing, and review are complete; `stop_escalation=stop for absent plan, incompatible cycles/windows, unknown QC eligibility, missing denominator, unverifiable source, or safety-critical interpretation and refer to the applicable official service/authorized operator`.

Comparisons require identical eligibility, cutoff, observation revision, geography, parameter, lead-time definition, and denominator or a documented qualified rationale. A metric cannot establish cause, user value, all-weather performance, or future behavior.
