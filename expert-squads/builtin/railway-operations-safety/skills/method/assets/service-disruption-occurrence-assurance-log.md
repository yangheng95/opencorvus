# Service Disruption, Occurrence and Assurance Log

Use this log to preserve a source-addressable chronology of service variance and railway occurrence evidence. It supports qualified assurance review; it does not classify a statutory occurrence, determine reportability, assign blame or liability, direct recovery, close an action, or authorize service resumption.

Canonical field keys: `record_id`, `object_ids`, `unit`, `source_location`, `source_authority`, `source_version`, `effective_date`, `observation_date`, `owner`, `qualified_reviewer`, `applicability`, `uncertainty`, `status`, `decision_not_made`, `stop_or_escalation`.

## Event and provenance envelope

| Field                           | Content                                                                                                           |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| record_id                       | Stable `SOA-###`; retain source event IDs separately.                                                             |
| service_run_train_path_ids      | Native operational identifiers and operating date.                                                                |
| location_and_asset_ids          | Station, platform, line, route, block, asset or boundary.                                                         |
| event_timestamps_and_time_zone  | Planned and actual semantic events, original clock, corrections and named time zone.                              |
| duration_or_quantity_and_unit   | Formula, operands, unit, conversion and missing-event treatment.                                                  |
| source_location                 | Report, system/export, log entry, message or controlled-document locator.                                         |
| source_authority_version_date   | Issuer/system, schema or taxonomy version, effective date and observation date.                                   |
| evidence_class                  | Observed event, verified attribution, preliminary attribution, candidate contributor, counterevidence or unknown. |
| event_or_occurrence_as_supplied | Preserve original code and narrative; do not reclassify.                                                          |
| affected_control_and_evidence   | Existing control, evidence, gap and control owner.                                                                |
| assurance_action                | Action already authorized elsewhere, owner, due/review date and verification evidence.                            |
| owner_and_qualified_reviewer    | Operations/safety owner and authorized investigator or specialist.                                                |
| applicability                   | Services, period, equipment, investigation and data boundary.                                                     |
| uncertainty                     | Clock, identity, source, causation, completeness, privacy or investigation limits.                                |
| status                          | Draft, source-verified, disputed, investigation-restricted, action-open, verified or human-closed.                |
| decision_not_made               | No classification, report submission, blame, recovery, resumption, compliance or closure decision.                |
| stop_or_escalation              | Active danger/emergency, protected investigation, personal-data excess or missing reporting authority.            |

## SOA-001 — Baseline pending

- Service/run/train/path IDs: unknown
- Location/assets: unknown
- Event timestamps/time zone: unknown
- Duration/quantity/unit: not calculated
- Source/authority/version/effective/observation dates: unknown
- Evidence class: unknown
- Event or occurrence: not classified
- Cause evidence and counterevidence: unknown
- Affected control/action/verification: unknown
- Owner/qualified reviewer: unassigned
- Applicability/uncertainty: evidence unavailable
- Status: draft
- Decision not made: no statutory, operational, disciplinary, legal or assurance decision
- Stop or escalation: authorized operations safety owner must supply controlled event sources and boundaries

Keep personal, medical, fatigue, competence and disciplinary data out unless explicitly authorized and necessary. Link candidate contributors without collapsing them into root cause. Record later corrections as new versioned entries rather than overwriting the original chronology.
