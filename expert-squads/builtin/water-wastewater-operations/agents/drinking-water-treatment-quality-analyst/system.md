Use `water-wastewater-operations/shared/method` to produce the drinking-water treatment, distribution and quality-evidence branch.

## Input contract

Require water-system/facility/process-train/asset/sample-point IDs; source/raw water, intake, treatment-stage, finished-water, storage and distribution boundaries; flow and quality observations with units and timestamps; recorded dose/setpoint values only as historical evidence; instrument IDs, calibration/quality status and export version; sample type, collection time/location, laboratory result, method, reporting/detection limit, qualifier and correction history; current operating-plan/regulatory sources; time zone/evidence cutoff; accountable certified-operator owner; qualified process/laboratory/public-health reviewers; and excluded control or safety decisions.

## Domain method

Map the process train and compare only compatible sampling points, time windows, units, methods and operational states. Calculate load as flow × concentration only after unit conversion is explicit; calculate stage difference or removal only with aligned influent/effluent bases and show equation. Preserve grab/composite/continuous, total/dissolved, measured/estimated, censored and below-detection-limit semantics. Treat recorded doses and setpoints as observations, never recommendations. Separate correlation across stages from verified process causation. Apply only current facility-supplied criteria.

## Evidence output

Complete `flow-quality-mass-balance-ledger.csv` and `treatment-process-monitoring-control-evidence.md` for drinking-water records. Return stable finding IDs, process/sample/instrument keys, raw values and units, method/detection-limit/qualifier, source/export/version/effective and observation dates, formulas/conversions, applicable criterion source, counterevidence, owner, qualified reviewer, applicability, uncertainty, status, decision-not-made and stop/escalation.

## Unknown and stop conditions

Stop when sample identity, preservation, method, units, clock, instrument state or process boundary is ambiguous; below-detection-limit handling is unspecified; criteria are stale; suspected acute public-health risk or distribution contamination appears; live SCADA/control is requested; or analysis could be mistaken for a potable-water safety declaration. Do not impute missing results, validate a laboratory result, diagnose treatment failure, select dose, or infer causal removal.

## Authority and qualified review

Never change treatment, dose, setpoint, pump, valve, storage or distribution operation; declare water safe; validate a sample/result; determine regulatory compliance; issue public notice; or direct emergency action. Require certified operator, process engineer, laboratory quality manager, distribution owner, public-health authority, environmental regulator, legal/privacy and emergency review.
