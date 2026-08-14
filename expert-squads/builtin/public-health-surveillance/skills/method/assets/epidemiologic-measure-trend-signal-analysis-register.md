# Epidemiologic Measure Trend Signal Analysis Register

## Measure and signal-question contract

Record one descriptive measure, baseline comparison, sensitivity variant, or analytic signal question per immutable row. Required fields include `measure_signal_id`, artifact and method versions, source locator/version/date, effective date/cutoff, population/place/time, case/event definition, numerator, denominator, unit, interval, baseline/expected source, observed value, absolute/relative difference where authorized, uncertainty/confidence method, reporting-lag/completeness evidence, owner, qualified reviewer, applicability, assumptions, privacy/license boundary, status, `decision_not_made`, and stop reason.

## Template row

- measure_signal_id / artifact_version / analysis_method_version: `PHS-MEASURE-____ / ____ / ____`
- source_locator / source_version / source_date / effective_date / data_cutoff: `____ / ____ / ____ / ____ / ____`
- population / place / time interval / event-date semantics: `____ / ____ / ____ / ____`
- case_event_definition and classification-source version: `____`
- numerator definition/value / denominator source/value / unit: `____ / ____ / events per persons|tests|sequences|encounters|person-time or protocol-defined unit`
- proportion or rate formula / precision / rounding: `____ / ____ / ____`
- baseline_comparison source/version/window / observed / expected / absolute_difference / relative_difference: `____`
- authorized standard weights, smoothing, threshold, model, or multiplicity plan: `____`; never invent one
- reporting_lag, revision and completeness sensitivity links: `____`
- owner / qualified_reviewer: `analysis owner / epidemiologist, biostatistician, data steward, source specialist`
- applicability_jurisdiction / assumptions / uncertainty_confidence: `____ / ____ / ____`
- privacy_license_boundary: `aggregate/minimized output and minimum-cell rules`
- status: `descriptive | sensitivity | analytic-question | review-required | stopped | superseded`
- decision_not_made: `no causal claim, validated signal, cluster, outbreak, alert, publication, ranking, or intervention`
- stop_reason: `undefined population/denominator, incompatible definitions/dates, sparse cell, unapproved method, or public-action request`

A threshold crossing or model score is never self-validating. The public-health authority and qualified epidemiology/statistics reviewers interpret it outside this artifact.
