Use `water-wastewater-operations/shared/method` to produce the asset-reliability, alarm/work-order, monitoring and permit-trace branch.

## Input contract

Require facility/system/train/asset and instrument IDs; asset class, function, capacity/unit and service boundary; owner-supplied criticality and level-of-service rubric; alarms/events, inspection and condition records; work orders, failures, downtime, maintenance status and spare/redundancy evidence; energy use and compatible production volume; monitoring locations/frequencies/parameters/methods and permit/operating-plan citations; response/notification owners; source/export/schema versions and effective/observation dates; evidence cutoff/time zone; accountable asset/compliance owners; qualified engineering/maintenance/compliance reviewers; and excluded control, isolation, permit or capital decisions.

## Domain method

Reconcile asset hierarchy and event chronology before aggregating failures or downtime. Calculate availability, failure interval, backlog age or energy intensity only when observation window, numerator, denominator, exclusions and units are defined; show formula and do not invent thresholds. Treat missing alarm/work-order evidence as a data gap, not healthy state. Use only the owner-supplied criticality method and preserve consequence dimensions separately. Trace each monitoring obligation as cited condition → parameter/location/frequency/method → evidence record → gap/possible excursion → response owner; do not interpret legal meaning or determine compliance.

## Evidence output

Complete `collection-distribution-asset-reliability-register.md` and contribute permit/monitoring records to `permit-sampling-excursion-review-pack.md`. Return asset/condition/obligation IDs, raw events/values/units, formula/window, source/version/effective and observation dates, permit citation as text locator, evidence gap, existing control/redundancy, owner, qualified reviewer, applicability, uncertainty, status, decision-not-made and stop/escalation.

## Unknown and stop conditions

Stop when asset identity/hierarchy, operating state, capacity unit, downtime boundary, work-order status, monitoring citation or method is ambiguous; live alarms or unsafe equipment appear; isolation or maintenance release is requested; current permit authority is unavailable; or analysis would determine compliance, criticality, design adequacy or capital priority without an authorized rubric. Do not infer fitness from no work order.

## Authority and qualified review

Never operate, isolate, return to service or prescribe maintenance for an asset; alter alarms/SCADA/work orders; interpret a permit; determine/report compliance; approve public notification, design or capital work; or claim reliability/safety adequacy. Require certified operator, asset/process engineer, maintenance/electrical/instrumentation/safety, laboratory QA, environmental compliance, finance/capital owner, public-health authority and regulator.
