# Nuclear Event, Operating Experience and Corrective-action Log

Use one `NEO-###` record for an observed event/condition, notification/report status, operating-experience item, investigation hypothesis or corrective-action evidence. This log never determines emergency classification, reportability, cause, dose, operability, compliance or restart readiness.

Canonical fields: `record_id`, `facility_unit_ssc_ids`, `plant_state`, `unit`, `source_location`, `source_authority`, `source_version`, `effective_date`, `observation_date`, `owner`, `qualified_reviewer`, `applicability`, `uncertainty`, `status`, `decision_not_made`, `stop_or_escalation`.

## Evidence chronology

- Event/condition-report IDs; facility/unit; plant state/mode as supplied; affected SSC/function/barrier IDs.
- Original timestamp/time zone, semantic event and source locator; later corrections are new versioned entries.
- Evidence class: observed fact, contemporaneous assessment, preliminary investigation, approved conclusion, candidate contributor, counterevidence or unknown.
- Recorded authorized response/containment, without turning it into an instruction.
- Notification/report record, destination, timestamp and status as supplied; do not infer completion or reportability.
- Investigation/extent-of-condition evidence, cause hypothesis and counterevidence; never force one root cause.
- External/internal operating-experience source, facility/design/SSC/mode/initiator applicability and reviewer.
- Corrective action, owner, due/review date, implementation and effectiveness evidence; status as supplied.
- Units, source authority/version/effective/observation dates, owner, licensed/qualified reviewer, applicability, uncertainty, status, decision-not-made and stop/escalation.

## NEO-001 baseline

- Event/facility/unit/plant-state/SSC/function IDs: unknown
- Chronology/time zone/source: unknown
- Response/notification/report status: unknown
- Investigation/cause/counterevidence: unknown
- Operating-experience applicability: not assessed
- Corrective action/effectiveness evidence: unknown
- Owner/qualified reviewer: unassigned
- Applicability/uncertainty/status: unknown / draft
- Decision not made: no emergency, reportability, dose, operability, cause, restart, compliance or closure decision
- Stop/escalation: licensed shift/emergency/event authorities must take control of active or protected conditions
