# Treatment Process Monitoring and Control Evidence

Use one `TPM-###` record for a process-stage observation, instrument/sample relationship, recorded control state, alarm/deviation or evidence gap. This is retrospective evidence. It must never be used as a chemical-dose, setpoint, pump, valve, aeration, storage, distribution, discharge or Supervisory Control and Data Acquisition instruction.

Canonical field keys: `record_id`, `object_ids`, `unit`, `source_location`, `source_authority`, `source_version`, `effective_date`, `observation_date`, `owner`, `qualified_reviewer`, `applicability`, `uncertainty`, `status`, `decision_not_made`, `stop_or_escalation`.

## Record contract

- **record_id and process keys:** system, facility, train, process stage, stream, asset, instrument and sample-point IDs.
- **process boundary and operating state:** inflows/outflows, recycle/return, residuals, batch/continuous state, production mode and exclusions.
- **observed value and unit:** flow, level, quality, concentration, mass, solids, energy, recorded dose/setpoint/state or alarm; label measured/calculated/estimated/censored/missing.
- **time evidence:** timestamp or aggregation window, named time zone, sample collection/result time and relevant process lag if supplied.
- **instrument/sample/method evidence:** instrument ID and quality/calibration status; sample type/fraction/preservation; analytical method/version, detection/reporting limit, qualifier and correction history.
- **source location / authority / version / effective and observation dates:** historian/export, laboratory, operating record or controlled document locator.
- **criterion or expected state:** only a current facility-supplied operating/monitoring criterion with source and applicability; do not infer a regulatory limit.
- **comparison and counterevidence:** equation/unit conversion, compatible baseline, conflicting instrument/lab/process evidence and limitations.
- **owner / qualified reviewer:** certified operator plus process engineer, laboratory QA, instrumentation or public-health/compliance reviewer as applicable.
- **applicability / uncertainty / status:** exact train/state/period/method and evidence limits; draft, verified, conflict, possible-excursion, specialist-review or human-approved.
- **decision_not_made:** no process change, potable-safety declaration, laboratory validation, discharge, compliance, notice or emergency decision.
- **stop_or_escalation:** acute risk, active alarm/unsafe equipment, method/identity conflict, unauthorized data or missing authority and named recipient.

## TPM-001 — Baseline pending

- Process/sample/instrument IDs and boundary: unknown
- Observed value/unit/state/time: unknown
- Method/detection-limit/qualifier and source: unknown
- Source authority/version/effective/observation dates: unknown
- Criterion/comparison/counterevidence: not assessable
- Owner/qualified reviewer: unassigned
- Applicability/uncertainty/status: unknown / draft
- Decision not made: no operational, public-health, laboratory, compliance or emergency decision
- Stop or escalation: certified operator and qualified method owner must supply compatible evidence

Keep correlation separate from a supplied professional diagnosis or verified causal conclusion. Retain corrected results as versioned events. Do not diagnose process failure or recommend corrective operations.
