---
name: water-wastewater-operations-method
description: Prepare source-grounded drinking-water and wastewater operations evidence across treatment processes, flow-quality-mass balances, collection and distribution, sampling and laboratory methods, asset reliability, alarms, work orders, permits, and monitoring. Use for bounded reviews requiring certified and qualified human decisions; never use for process control, public-health declarations, compliance decisions, equipment release, design approval, or emergency action.
---

# Water and Wastewater Operations Method

## Freeze system, process and authority boundaries

1. Record water system, facility, process train, collection/distribution area, asset, sample point, jurisdiction, accountable owner, evidence cutoff, time zone, authorized data boundary and excluded actions.
2. Establish stable IDs for facility, train, process stage, stream, asset, instrument, alarm, work order, sample, laboratory result, permit condition, monitoring obligation, event and action. Do not merge ambiguous IDs.
3. Preserve raw value, unit, qualifier, source URI or controlled-document location, export/schema/method version, effective date, observation/sample/result date, owner, qualified reviewer, applicability, uncertainty and status.
4. Separate measured, calculated, estimated, censored, below-detection-limit, corrected and missing data. Missing is not zero; below a limit is not a quantified zero.
5. Accept limits, operating criteria, sampling requirements, criticality rubrics and response rules only from current facility/jurisdiction authorities. Never invent a universal threshold.

Use [the operating baseline register](assets/water-wastewater-operating-baseline-register.md) before opening a branch.

## Reconcile flow, quality and mass

1. Define each process or system boundary and stream direction. Align flow and concentration observations by compatible location, time basis, sample type, analytical fraction, method and operating state.
2. Convert units explicitly before calculating load. Use `mass load = flow × concentration × documented conversion factor`; show raw operands, units and factor. Do not calculate if the factor or basis is unknown.
3. Calculate removal as aligned input load minus output load. Calculate removal percentage only when input load is nonzero and valid. Preserve recycle/return streams, storage change, residuals and unmeasured terms.
4. For hydraulic balance, state `storage change = inflows − outflows` over a defined interval. A residual is an evidence gap, not automatically leakage, infiltration, process loss or meter error.
5. Record every calculation in [the flow-quality-mass balance ledger](assets/flow-quality-mass-balance-ledger.csv).

## Review treatment and monitoring evidence

1. Map source/influent, each treatment stage, finished water/effluent, residuals, storage and distribution/receiving boundaries using stable IDs.
2. Preserve recorded dose, setpoint, pump/valve state and alarm as historical observations. Never convert them into a recommended control action.
3. Trace instrument ID, calibration/quality state, historian/export version, sample location/type/time, laboratory method, reporting/detection limit, qualifier, correction and chain of evidence.
4. Compare stages only when samples, methods, fractions, units and time windows are compatible. Label correlation, supplied professional diagnosis and verified causal conclusion distinctly.
5. Store process evidence in [the treatment process monitoring template](assets/treatment-process-monitoring-control-evidence.md).

## Review collection, distribution and asset reliability

1. Reconcile the asset hierarchy, service boundary and observation window before aggregating alarms, inspections, failures, work orders, downtime, backlog, redundancy or energy use.
2. Calculate availability, failure interval, backlog age or energy intensity only with defined numerator, denominator, exclusions and units. Preserve planned/unplanned and available/installed distinctions.
3. Use only an owner-supplied criticality or level-of-service rubric; keep consequence dimensions separate and record rubric source/version. No work order or alarm in the supplied extract is not proof of healthy operation.
4. Separate drinking-water distribution, wastewater collection, pump station, treatment, storage, residuals and support assets. Do not infer equipment fitness, isolation state or return-to-service readiness.
5. Record evidence in [the collection/distribution asset reliability register](assets/collection-distribution-asset-reliability-register.md).

## Trace permit, sample and possible excursion evidence

1. Record permit or operating-plan condition by exact document, section/table, version and effective period. Do not paraphrase it into a new legal rule.
2. Trace condition → parameter → location → frequency/period → sample/method/result → qualifier/correction → evidence gap or possible excursion → response owner.
3. Call a result a possible excursion only against an explicit current criterion and compatible basis. Preserve alternative readings, method/quality limitations and professional review status.
4. Do not determine compliance, reportability, public-health consequence, discharge permission or notification duty. Keep actions already authorized elsewhere distinct from proposed evidence review.
5. Complete [the permit, sampling and excursion review pack](assets/permit-sampling-excursion-review-pack.md).

## Join independent evidence

Require all three root reports and compatible artifact hashes, IDs, units, time windows and authority versions. Join through facility/train/stream/asset/instrument/sample/period keys only. Record contradictions rather than averaging incompatible laboratory, historian, work-order or permit data. Limit options to source request, identity/unit reconciliation, data re-baseline, specialist review, monitoring or verification of an existing authorized control. Preserve owner, reviewer, applicability, uncertainty, status, decision-not-made and stop condition.

## Stop and retain qualified authority

Stop on ambiguous identity, incompatible units or sampling bases, absent method/detection limit, stale operating/permit source, unexplained active alarm, suspected acute public-health risk, active overflow/bypass/discharge or equipment hazard, unauthorized personal/security data, or any request for control, declaration, compliance, isolation/release, design or emergency action.

Never change dose/setpoint/pump/valve/SCADA; declare water safe; validate a laboratory result; approve discharge/bypass/overflow; interpret a permit or claim/report compliance; issue public notice; direct confined-space/electrical/chemical work; isolate/release equipment; approve design/capital work; or direct emergency response. Require certified operator, process/asset engineer, laboratory quality, maintenance/electrical/instrumentation/safety, environmental compliance, public-health, legal/privacy, regulatory and emergency review.

## Sources and clean-room boundary

Read [sources and clean-room boundary](references/sources.md) before applying a current public or facility authority. This method is clean-room authored. A public water-network-design document was reviewed at a fixed commit and rejected because it is not a portable Agent `SKILL.md`, lacks a reusable license, and concerns proposal-stage design rather than operations. No rejected text, thresholds or design logic was copied.
