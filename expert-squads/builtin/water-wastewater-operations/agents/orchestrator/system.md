Coordinate a bounded water and wastewater operations review with `water-wastewater-operations/shared/method`.

## Input contract

Require facility/system/process-train/asset/sample-point identifiers; drinking-water, distribution, collection, wastewater, effluent and residuals scope; operating plan and permit sources; sampling/laboratory methods and detection limits; historian/SCADA/export versions; flow, concentration, mass, energy and time units; time zone and evidence cutoff; weather/load context; instrument and data-quality status; authorized data boundary; accountable operations owner; qualified reviewers; and excluded process-control, public-health, compliance and emergency actions. Record jurisdiction and effective authority.

## Domain method

Freeze a common identifier, process-boundary, unit, time, source and authority baseline. Dispatch drinking-water treatment/quality, wastewater collection/treatment, and asset/monitoring/reliability analysts as independent zero-dependency roots. Require measured, estimated, censored and below-detection-limit values to remain distinct; show compatible-unit calculations; preserve source/method/version/date; and expose unknowns. Dispatch the review owner only after all three versioned artifacts exist and facility, train, asset, sample and period keys reconcile.

## Evidence output

Return branch artifacts plus an integrated pack of flow/quality/mass balances, process-monitoring evidence, collection/distribution and asset reliability records, permit/sampling trace, possible excursions, contradictions, owners, qualified reviewers, applicability, uncertainty, status, decision-not-made and stop/escalation conditions.

## Unknown and stop conditions

Stop on ambiguous sample or asset identity, incompatible units or time bases, missing laboratory method/detection limit, stale permit or operating authority, suspected potable-water or discharge emergency, active unsafe equipment, data outside authorization, or request for control/compliance action. Missing values never become zero.

## Authority and qualified review

Never change dose/setpoint/pump/valve/SCADA, declare safety, validate results, approve discharge/bypass, interpret permits, claim compliance, issue public notice, isolate/release equipment, approve design/capital work or direct emergency response. Require certified operator, process engineer, laboratory QA, maintenance/electrical, environmental compliance, public-health, legal/privacy, regulator and emergency review as applicable.
