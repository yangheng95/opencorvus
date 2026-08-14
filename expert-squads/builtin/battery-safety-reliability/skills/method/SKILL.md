---
name: battery-safety-reliability-method
description: Prepare traceable cell, module and pack configuration, operating-envelope, abuse-test, instrumentation, thermal-runaway, propagation, barrier, failure-population, censoring and reliability evidence for qualified battery review. Use for bounded historical evidence analysis; never use for live testing or operation, BMS changes, damaged-battery handling, emergency or transport action, certification, release, or safety claims.
---

# Battery Safety Reliability Method

## Freeze application, configuration and authority

1. Record host/application, intended lifecycle state, jurisdiction, evidence cutoff, owner, qualified reviewers, proprietary-data boundary and excluded decisions.
2. Create stable IDs for manufacturer/product/model/revision, cell/lot, module, pack, chemistry/form factor, topology, material/BOM change, BMS hardware/firmware/calibration, sensor, fuse/contactor/vent/enclosure/cooling/protection, sample, test, instrument, event, failure, population, model and source.
3. Preserve source locator/authority/version/effective and observation date, quantity/unit/denominator, owner, qualified reviewer, applicability, assumptions, uncertainty/confidence, privacy/license boundary, status, `decision_not_made` and `stop_or_escalation` on every material row.
4. Never merge chemistry, supplier, lot, format, topology, firmware, protection, cooling, enclosure, application or lifecycle revisions silently.

Use [the battery configuration register](assets/battery-system-configuration-operating-envelope-register.md) as the common spine.

## Reconcile configuration and operating envelope

1. Trace cell → module → pack → host/application and every protection/control version.
2. Record intended charge, discharge, storage, transport and environment values only from current controlled sources, including unit, averaging/peak basis and applicability.
3. Keep specification, warning, operating envelope, observed condition, protection setting and test condition separate.
4. Record state of charge (SOC) and state of health (SOH) as separate evidence fields, then record cycle count, calendar age and energy throughput with the exact estimation/measurement method, source, date and uncertainty.
5. Treat a missing or conflicting configuration as a stop condition, not an invitation to use a similar product.

## Reconstruct historical abuse-test evidence

1. Work only from already-authorized, completed test records. Do not produce a procedure or operational sequence.
2. Record test authorization/report, sample/configuration/lot, preconditioning, SOC/SOH, age/cycles, ambient/chamber/fixture, historical initiation category, current criterion source/version and post-test custody.
3. Trace instrument/channel ID, calibration, range, sampling rate, data-file hash and common clock for voltage, current, temperature, pressure, gas, heat, video or radiography evidence.
4. Reconstruct observation chronology without converting recorded parameters into instructions. Preserve raw channels and derived values separately.
5. Capture evidence in [the abuse-test ledger](assets/battery-abuse-test-condition-instrumentation-ledger.csv).

## Distinguish thermal events and propagation

1. Use vent, rupture, fire, thermal runaway and propagation terms only as defined by the supplied current source; a thermal runaway observation must retain the observing channel, time basis and uncertainty.
2. Record first abnormal signal, event time and basis, affected unit, neighboring unit response, path, spacing and configuration; evaluate cell to cell propagation only for the documented test article and observation window.
3. Map venting, enclosure, thermal isolation, cooling, detection, suppression and other barriers as observed configurations and evidence states.
4. Keep installed, present, triggered, operating and effective separate. Absence of observed propagation in one test is not universal proof.
5. Record counterevidence, sensor conflicts and uncertainty in [the propagation/barrier map](assets/thermal-runaway-propagation-barrier-evidence-map.md).

## Build comparable failure and reliability evidence

1. Define unit of analysis, population/cohort, chemistry/configuration/lot/application, inclusion/exclusion, observation window and reporting lag.
2. Define failure/degradation outcome from a controlled source. Separate field, qualification, abuse, surveillance, repair, replacement and retirement events.
3. Record exposure in calendar time, cycles, energy throughput or another controlled unit. Show crude counts/rates with numerator, denominator, exposure and uncertainty.
4. Preserve right-, left- and interval-censoring. Removal or cutoff is not a successful lifetime.
5. Use Weibull, survival, hazard, degradation or remaining-useful-life models only when a qualified statistical plan supplies the method and assumptions can be checked. Show parameters, diagnostics, sensitivity and uncertainty; do not provide a deterministic individual forecast.

Complete [the reliability register](assets/battery-failure-reliability-analysis-register.md).

## Join without generalizing applications

1. Require exact hashes/versions and common configuration/sample/test/event/time/unit/application keys across all branches.
2. Reconcile configuration and SOC/SOH against each test and failure record. Reject comparisons that mix material configurations or application environments without an approved rationale.
3. Preserve conflicting tests, sensors, lots, criteria and field records. Label source fact, observation, derived calculation, hypothesis, assumption, uncertainty and unknown.
4. Treat UNECE transport, FAA aviation, automotive, stationary, consumer and space sources as application-specific. Do not import a criterion into another application.
5. Complete [the qualified review pack](assets/battery-safety-reliability-qualified-review-pack.md). Never fill test acceptance, design, safety, certification or release decisions.

## Stop and retain safety authority

Stop for ambiguous genealogy/configuration, unknown BMS/protection/cooling version, unsupported SOC/SOH, missing authorization, uncalibrated/saturated instruments, unsynchronized clocks, undefined event terms, missing raw data, incomplete exposure/censoring, unsupported reliability assumptions, stale application source, active heat/venting/fire/damage, or a request for operational details.

Never instruct or execute charge/discharge, external short, overcharge, heating, crush, penetration, impact or fire; change BMS/protection; connect/isolate/handle/ship/store a battery; direct emergency response; determine root cause; certify, release, ground, recall or claim safety/reliability. Require battery/electrochemical, BMS/electrical, thermal/mechanical/fire, reliability/statistics, test/lab safety, quality, hazardous-goods, application and certification review.

## Sources and clean-room boundary

Read [the source and provenance record](references/sources.md). This method and its assets are clean-room authored. The reviewed energy and manufacturing Skills are rejected completely; no upstream code, prose, thresholds, schedules, recommendations, predictive models or templates are retained.
