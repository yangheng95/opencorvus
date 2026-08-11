# Signalling, Infrastructure, Restriction and Risk Register

Create one record for each versioned change, degraded condition, possession, temporary restriction, conflicting source or control-evidence gap. This is an evidence register, not an interlocking model, maintenance instruction, route-availability decision or authorization for degraded working.

Canonical field keys: `record_id`, `object_ids`, `unit`, `source_location`, `source_authority`, `source_version`, `effective_date`, `observation_date`, `owner`, `qualified_reviewer`, `applicability`, `uncertainty`, `status`, `decision_not_made`, `stop_or_escalation`.

## Required record

- **risk_id:** stable `SIR-###`.
- **asset_and_location_ids:** line, route, block, signal, point, track circuit, axle counter, crossing, platform, power or communications IDs with direction and boundary.
- **affected_train_path_service_ids:** native identifiers and effective time window.
- **units_and_time_zone:** distance, speed, time, state or count units and named time zone.
- **evidence_class:** approved rule/notice, configuration diagram, alarm, inspection, work record, occurrence, supplied professional opinion or inference.
- **source_location / authority / version / effective_date / observation_date:** exact controlled locator and issuer; preserve valid-from and valid-to.
- **change_or_condition:** source event or observed condition without diagnosis beyond evidence.
- **hazard_scenario:** affected operation → hazardous event → consequence, tied to named assets and circumstances.
- **approved_control_and_evidence:** control named by the authorized source, evidence that it exists, failure mode and evidence gap.
- **applicability:** equipment state, route, direction, rolling stock, operating mode and exclusions.
- **uncertainty:** identity, timing, configuration, measurement or interpretation limitations.
- **owner / qualified_reviewer:** accountable infrastructure owner and competent signalling, track, electrical, operations or safety reviewer.
- **status:** draft, source-verified, control-evidence-gap, conflict, active-review, superseded or human-approved.
- **decision_not_made:** no signal aspect, route, speed, movement, possession, isolation, restoration, equipment-fitness or safety decision.
- **stop_or_escalation:** active danger, live alarm, boundary conflict, missing authority or protected information plus authorized recipient.

## Record template

### SIR-001 — Baseline pending

- Asset and location IDs: unknown
- Affected train/path/service IDs and window: unknown
- Units and time zone: unknown
- Evidence class and source: unknown
- Source authority/version/effective and observation dates: unknown
- Change or condition: baseline not supplied
- Hazard scenario: not assessable
- Approved control and evidence: unknown
- Applicability and uncertainty: unknown; analysis does not proceed
- Owner and qualified reviewer: unassigned
- Status: draft
- Decision not made: no operational, maintenance, release or safety decision
- Stop or escalation: infrastructure manager must confirm identifiers, current configuration and authority

## Cross-branch links

Link each record to affected `TPC-###` path findings and `SOA-###` service/occurrence records. Preserve contradictions between diagrams, notices, alarms, work records and actual events as explicit records. Never infer normal operation from absent defect evidence or infer fail-safe behavior from equipment naming.
