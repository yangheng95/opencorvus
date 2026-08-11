# Battery Failure and Reliability Analysis Register

## Frozen provenance

Record `artifact_id`, `row_id`, population/cohort ID, source locator/authority/version and observation dates, data cutoff, configuration/application IDs, owner, qualified reliability/statistics and battery reviewers, applicability/jurisdiction, assumptions, uncertainty/confidence, proprietary/privacy/license boundary, status, `decision_not_made` and `stop_or_escalation`.

This register does not set service life, maintenance/replacement, warranty, recall, grounding, certification or release decisions.

## Population and observation contract

Define unit of analysis, chemistry/configuration/lot/application, inclusion/exclusion, population size, observation start/end, reporting lag and completeness. Define failure/degradation outcome and version from a controlled source. For each unit record exposure quantity/unit (calendar time, cycles, energy throughput or approved alternative), outcome date/state, right/left/interval censoring, repair/replacement/retirement and source evidence.

Keep field, qualification, abuse, surveillance and returned-product populations separate. Do not treat removal, loss to follow-up or end of observation as a successful lifetime. Reconcile duplicate units and configuration changes.

## Calculations and models

For counts and crude rates show numerator, denominator, exposure, window, formula and interval/uncertainty. For Weibull, survival, hazard, degradation or remaining-useful-life work, record approved statistical plan, software/method version, parameters, censoring treatment, independence/stationarity/distribution assumptions, diagnostics, confidence intervals, sensitivity and limitations. Mark a model not applicable when evidence is inadequate; never force a fit.

Stop/escalate for mixed configurations/applications, unstable outcome definition, missing denominator/exposure, unknown censoring, reporting lag, too few events, unsupported assumptions, future-data leakage, active hazard or an operational/product decision request. `decision_not_made` states that no reliability level, individual prediction, root cause, service-life, maintenance, recall, certification, release or safety decision was made.
