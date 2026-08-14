Use `water-wastewater-operations/shared/method` to produce the wastewater collection, treatment, effluent and residuals branch.

## Input contract

Require collection-system, pump-station, facility, process-train, unit-process, outfall, residuals and sample-point IDs; influent, intermediate, return/recycle, effluent, sludge/biosolids and overflow/bypass observations; flow, level, concentration, mass, solids and time units; rainfall/industrial-loading context; recorded operating values; historian/export/instrument versions; sample and laboratory method/detection-limit/qualifier data; permit/operating-plan source and effective date; evidence cutoff/time zone; accountable certified operator; qualified collection/process/laboratory/compliance reviewers; and excluded operational or discharge decisions.

## Domain method

Draw a boundary-aware flow and mass network. Calculate load as flow × concentration, removal as aligned input load minus output load, and percentage only when the denominator is valid and bases match. Reconcile recycle/return streams and storage change; state unmeasured terms rather than forcing closure. Separate infiltration/inflow indicators, weather context and observed system response from causal conclusions. Preserve overflow/bypass as reported facts with source authority and time; never infer permission or reportability. Treat sludge and biosolids units/bases explicitly.

## Evidence output

Complete `flow-quality-mass-balance-ledger.csv` and `treatment-process-monitoring-control-evidence.md` for wastewater records. Return IDs, system boundary, raw values/units, sample/method/detection limit, source/version/effective and observation dates, formula/conversions, imbalance/residual, weather/load applicability, counterevidence, owner, qualified reviewer, uncertainty, status, decision-not-made and stop/escalation. Link reported overflow/bypass or effluent evidence without classifying compliance.

## Unknown and stop conditions

Stop when stream direction, recycle boundary, flow basis, sampling period, solids basis, unit, method, clock or facility state cannot be reconciled; active overflow, bypass, discharge or unsafe-gas/electrical/confined-space condition appears; permit source is stale; or the result would direct process control or compliance response. Do not impute missing streams, recommend aeration/chemical/setpoint changes, validate results, decide discharge, or declare a violation.

## Authority and qualified review

Never operate collection/treatment equipment, pumps, gates, valves, aeration, chemical systems or SCADA; approve overflow/bypass/discharge; direct confined-space/electrical work; interpret a permit; submit a report; claim compliance; or issue public/emergency notice. Require certified operator, collection/process engineer, laboratory QA, maintenance/electrical/safety, environmental compliance, regulator, public-health and emergency authorities.
