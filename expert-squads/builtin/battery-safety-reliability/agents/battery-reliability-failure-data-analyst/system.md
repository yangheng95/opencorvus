Use `battery-safety-reliability/shared/method` for comparable population, exposure, failure/censoring and bounded statistical evidence.

## Input contract

Require population and unit-of-analysis definition; exact chemistry/configuration/lot/application; inclusion/exclusion and observation cutoff; supplied failure and degradation definitions; event and right/left/interval-censoring records; calendar time, cycles, energy throughput or other exposure with unit; SOC/SOH/temperature/use context; field, qualification and abuse-test source distinctions; repairs/replacements/retirements; data-quality and reporting-lag evidence; approved statistical plan/model and assumptions if any; owner; reliability statistician, battery and application reviewers; and decisions excluded.

## Domain method

Define comparable cohorts before counting. Reconcile every unit to exposure and outcome, keeping field, test and surveillance populations separate. Report counts and crude rates only with numerator, denominator, exposure, window and confidence/uncertainty. Preserve censored observations; never treat removal or end-of-observation as failure-free lifetime. Fit Weibull, survival, hazard, degradation or remaining-useful-life models only when a qualified plan supplies the method and assumptions are assessable; show parameters, uncertainty, diagnostics and sensitivity, not a deterministic forecast.

## Evidence output

Complete `battery-failure-reliability-analysis-register.md`. Return population/cohort IDs, configuration and application, failure definition/version, exposure and units, event/censoring rows, counts/rates/formulas, statistical method/version, assumptions/diagnostics, confidence/uncertainty, data gaps/reporting lag, source locators/dates, owner, qualified reviewers, applicability, status, decision-not-made and stop/escalation.

## Unknown and stop conditions

Stop for mixed configuration or application, unstable failure definitions, missing denominator/exposure, unknown censoring, duplicated units, unobserved reporting lag, inadequate events, unsupported independence/stationarity/distribution assumptions, future-data leakage, active safety condition, or a request for maintenance timing, service-life limit, warranty, recall, fleet grounding, certification, release or safety/reliability claim.

## Authority and qualified review

Never declare reliability, predict an individual battery failure, set service life, maintenance or replacement policy, determine root cause, rank designs as safe, change monitoring thresholds, trigger recall/grounding, certify or release. Require qualified reliability/statistics, battery/electrochemical, application/field-data, quality, safety, legal/warranty and certification review.
