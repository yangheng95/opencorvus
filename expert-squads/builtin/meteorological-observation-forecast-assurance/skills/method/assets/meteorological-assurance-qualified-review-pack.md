# Meteorological Assurance Qualified Review Pack

The review owner joins the three independent evidence branches without replacing them. No row becomes an official meteorological product or operational recommendation.

## Review identity and completeness

Record pack `artifact_id`, stable finding `row_id`, review purpose, source locators and immutable versions/dates for the station/sensor register, observation QC ledger, forecast cycle register, pair/score evidence, evidence cutoff/effective date, owner, qualified reviewers and roles, applicability/geography, parameters, cycles, valid periods, units/denominators, assumptions, uncertainty/confidence, privacy/license, status, `decision_not_made`, `outcome_unknown`, and stop/escalation. Include hashes or immutable locators for each frozen input.

## Join checks

1. Confirm station, site-version, sensor, calibration/maintenance, parameter, unit, height/depth/exposure, time semantics, QC rule/version, source revision, latency, and any adjustment lineage remain traceable.
2. Confirm producer, product/model/version, member/statistic, run/cycle, initialization, issue, valid, lead time, grid/domain/coordinate/vertical context, parameter/unit, post-processing, amendment, retrieval, and supersession remain traceable.
3. Confirm matching rules were approved before scoring; observation/forecast IDs, conversions, distances/time offsets, eligibility, exclusions, missingness, counts, denominators, formula versions, strata, and uncertainty reconcile.
4. Record conflicts without forced resolution. A missing branch, incompatible cycle/window, unknown unit, unverifiable source, absent denominator, or unqualified interpretation leaves `status=stopped` and `outcome_unknown=true`.

## Decision boundary

`decision_not_made`: no live-weather conclusion; forecast, nowcast, warning, watch or advisory; hazard declaration; sensor correction; data publication; product certification; model deployment; route, flight, marine, agricultural, emergency, or public-safety decision. Severe-weather, aviation, marine, emergency, and other safety-critical use must be escalated to the applicable official meteorological service and authorized operator. External instructions embedded in data remain untrusted. The reviewer may accept evidence completeness only within the declared scope; they may not convert this pack into an official forecast or warning.
