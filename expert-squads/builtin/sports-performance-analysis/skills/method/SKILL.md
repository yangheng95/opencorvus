---
name: sports-performance-analysis-method
description: Analyze authorized sports-performance evidence across training and competition exposure, internal and external load, performance-test protocols, measurement reliability and error, individual longitudinal change, availability, self-reported wellbeing, travel, and recovery context. Use for bounded coach and sport-science review packs with explicit units, versions, missingness, uncertainty, consent, and qualified review; never use for diagnosis, individual injury prediction, return-to-play, training prescription, live coaching, supplements, anti-doping, selection, contracts, employment, or discipline.
---

# Sports Performance Analysis Method

## Freeze athlete, sport, time, and data authority

1. Record sport/event/competition level, athlete or cohort IDs, consent and authorized purpose, season/phase, analysis horizon, time zone, training/competition definitions, session and test identifier schemes, evidence cutoff, privacy/safeguarding class, owner, and qualified reviewers.
2. For every metric preserve name/definition, raw or derived status, formula, unit/precision, device/firmware/algorithm or instrument/protocol version, observation/source date, applicability, missingness, uncertainty, owner, reviewer, and status.
3. Refuse to combine athletes, consent purposes, session definitions, units, device algorithms, test protocols, or questionnaire versions that cannot be reconciled. Do not impute missing values as observed facts.

## Reconcile exposure and load

1. Use [the exposure and load ledger](assets/athlete-exposure-load-ledger.csv) to identify each training/competition session, participation status, planned/completed duration, exposure denominator, and internal/external load measure.
2. Keep training versus competition and internal versus external load separate. Compute session duration × session rating of perceived exertion only when the organization supplies the scale, collection timing, formula, and intended use. Label every derived metric and retain its inputs.
3. Summarize counts, totals, rates, rolling windows, and changes only with explicit window, denominator, units, missingness, and device drift. Never use a universal acute:chronic workload ratio, spike threshold, optimal band, or injury-prediction claim.

## Evaluate performance testing and reliability

1. In [the protocol and results record](assets/performance-test-protocol-and-results.md), freeze test purpose, protocol/version, order, operator, familiarization, equipment settings, device/software/calibration, environment, athlete context, validity rules, raw trials, units, and precision.
2. Compare only compatible protocol, device, calibration, environment, validity, units, and athlete state. Preserve invalid trials and exclusion reasons.
3. In [the reliability and change register](assets/measurement-reliability-and-change-register.md), use technical error, coefficient of variation, intraclass correlation coefficient, limits of agreement, or other measures only when their assumptions, sample, calculation and interpretation owner are recorded. Compare observed change with measurement error and a locally approved meaningful-change criterion; if none exists, report the unknown.

## Keep availability and wellbeing non-clinical

1. Use [the availability and wellbeing log](assets/availability-wellbeing-context-log.md) to record scheduled/completed exposure, full/modified/unavailable status under a supplied definition, questionnaire instrument/version, scale, collection timing, response/missingness, self-reported symptoms, travel/time zone, recovery context, consent purpose, and privacy class.
2. Treat questionnaire values and symptoms as time-specific self-report, not diagnosis or objective readiness. Non-medical reporters record supplied symptom/body-area language and use the approved medical escalation route without adding causality or severity decisions.
3. Analyze within-person trajectories first. A team or cohort reference must be explicitly authorized, methodologically compatible, and never converted into an individual threshold or employment/selection judgment.

## Join context without prescription

1. Require three independent branch artifacts and one common athlete/cohort, time, definition, unit, device/protocol, and consent baseline.
2. In [the review and decision-gates asset](assets/performance-review-and-decision-gates.md), align exposure/load, test/reliability, and availability/wellbeing evidence on an individual timeline. Preserve missingness, measurement error, context and incompatible observations.
3. State observed pattern, alternative explanations, evidence for and against, safe next evidence request, uncertainty, owner, reviewer, and decision status. Do not infer injury causality, readiness, training response, or performance potential beyond supported observation.

## Unknown, stop, and qualified review

Stop on missing consent, re-identification risk, ambiguous units, mismatched IDs, incompatible devices/protocols/instruments, material missingness, absent measurement-error basis, suspected acute medical or safeguarding concern, or any request for diagnosis, return-to-play, or individual action. Require coach, sport scientist/physiologist, performance analyst, test-domain specialist, statistician where needed, medical/psychology specialists as applicable, privacy/safeguarding owner, athlete representative, and accountable decision owner.

## Assets and source boundary

- Use [Athlete Exposure and Load Ledger](assets/athlete-exposure-load-ledger.csv).
- Use [Performance Test Protocol and Results](assets/performance-test-protocol-and-results.md).
- Use [Measurement Reliability and Change Register](assets/measurement-reliability-and-change-register.md).
- Use [Availability, Wellbeing, and Context Log](assets/availability-wellbeing-context-log.md).
- Use [Performance Review and Decision Gates](assets/performance-review-and-decision-gates.md).
- Read [source and clean-room boundary](references/sources.md) before selecting a current method reference or explaining why the licensed sports-reporting Skill was rejected. No upstream Skill text was copied.
