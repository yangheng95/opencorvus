# Nuclear Facility Operations Safety Review Pack

Complete this explicit join only after all three independent branches produce source-addressable artifacts. It is not an operating instruction, operability determination, event report, safety analysis, licensing conclusion or risk acceptance.

Canonical fields: `record_id`, `facility_unit_ssc_ids`, `plant_state`, `unit`, `source_location`, `source_authority`, `source_version`, `effective_date`, `observation_date`, `owner`, `qualified_reviewer`, `applicability`, `uncertainty`, `status`, `decision_not_made`, `stop_or_escalation`.

## Join provenance

- `review_pack_id`, facility/unit, jurisdiction/license, plant state/mode, cutoff/time zone and security/safeguards boundary.
- Configuration/design-basis artifact path/version/digest.
- Plant-state/surveillance artifact path/version/digest.
- Defence-in-depth artifact path/version/digest.
- Event/operating-experience artifact path/version/digest.
- Source authorities, versions, effective and observation dates.
- Accountable licensee owner and licensed/qualified operations, configuration, engineering, work-control, radiation-protection, event/quality, independent-safety, emergency and regulatory reviewers.
- Applicability, exclusions, uncertainty and status.
- Decision not made: no reactor/system operation, reactivity/power/setpoint/alignment change, bypass, operability/Technical Specification action, event/emergency classification, reportability, dose, work/test, modification, startup/shutdown, compliance or risk acceptance.
- Stop/escalation: missing branch/current authority, ID/plant-state/version conflict, active abnormal/emergency state or protected information.

## Branch completeness

| Branch                     | Artifact/version/digest | IDs and plant state reconcile | Current authority | Unknowns retained | Owner/reviewer | Status |
| -------------------------- | ----------------------- | ----------------------------- | ----------------- | ----------------- | -------------- | ------ |
| Configuration/design basis | unknown                 | no                            | unknown           | yes               | unassigned     | draft  |
| Defence in depth/barriers  | unknown                 | no                            | unknown           | yes               | unassigned     | draft  |
| Event/operating experience | unknown                 | no                            | unknown           | yes               | unassigned     | draft  |

For each joined finding, cite linked `NCB/PSL/DIB/NEO` IDs, exact sources/versions, units, evidence/counterevidence, controls, applicability, uncertainty, owner, qualified reviewer and status. Preserve contradictions. Allow only current-source request, ID/version reconciliation, evidence re-baseline, specialist review, monitoring or verification of an already authorized control. Record later human decisions separately; the agent never fills them as the decision maker.
