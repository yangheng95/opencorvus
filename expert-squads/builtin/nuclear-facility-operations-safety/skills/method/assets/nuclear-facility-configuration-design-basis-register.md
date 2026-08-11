# Nuclear Facility Configuration and Design-basis Register

Use one record for one design/licensing requirement and its independent physical-configuration and controlled-document evidence. This register does not establish as-built correctness, design adequacy, operability, modification approval or licensing compliance.

Canonical fields: `record_id`, `facility_unit_ssc_ids`, `plant_state`, `unit`, `source_location`, `source_authority`, `source_version`, `effective_date`, `observation_date`, `owner`, `qualified_reviewer`, `applicability`, `uncertainty`, `status`, `decision_not_made`, `stop_or_escalation`.

## Required trace

- Stable `NCB-###` finding plus facility, unit, system, train, component and function IDs.
- Plant state/mode and evidence timestamp/time zone as supplied; no inference from power/process values.
- Design/licensing requirement locator, authority, revision and effective period.
- Physical-configuration evidence type, exact SSC/tag/boundary, authorized observer/source and observation date.
- Controlled drawing, specification, calculation, procedure, database or safety-analysis locator/version.
- Permanent/temporary modification, work, test, restoration and closure links as supplied.
- Alignment result: source-aligned, evidence-gap, identity-conflict, version-conflict, physical-document discrepancy or qualified-review-required.
- Applicability, counterevidence, uncertainty, accountable configuration owner and licensed/qualified design/system/operations reviewer.
- Status and `decision_not_made`: no operability, design, work, modification, startup/shutdown or licensing decision.
- `stop_or_escalation`: active abnormal state, unclear SSC/unit, stale controlled source, protected information or missing authority and named recipient.

## NCB-001 baseline

- Facility/unit/SSC/function IDs: unknown
- Plant state, unit and time zone: unknown
- Requirement source/version/effective date: unknown
- Physical evidence/source/observation date: unknown
- Controlled document/version: unknown
- Change/work/test/restoration evidence: unknown
- Owner/qualified reviewer: unassigned
- Applicability/uncertainty/status: unknown / draft
- Decision not made: no configuration acceptance, operability, modification, work or licensing decision
- Stop or escalation: licensee configuration and licensed operations authorities must establish the controlled baseline

Preserve contradictory documents and later corrections as versioned records. Never choose a “newer-looking” source or infer installed state from document approval.
