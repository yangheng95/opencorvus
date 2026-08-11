# Personal Data Incident Facts Effects Action Evidence Register

## Facts-first event contract

Create one row per occurrence, detection, discovery, triage, escalation, evidence capture, containment record, scope estimate, hypothesis, contradiction, consequence scenario, remedial evidence, processor communication, or supplied notification-decision record. Required fields include `incident_event_id`, artifact/incident/system/inventory versions, source locator/version/date, event timestamp/timezone/correlation, data cutoff, affected quantity with unit/denominator and estimation method, owner, qualified reviewer, applicability/jurisdiction, assumptions, uncertainty, chain-of-custody/privacy boundary, status, decision_not_made, and stop reason.

## Template row

- incident_event_id / artifact_version / incident_version: `PDP-INC-____ / ____ / ____`
- system_configuration_log and processing-inventory versions: `____ / ____`
- source_locator / source_version / source_date / data_cutoff: `____ / ____ / ____ / ____`
- event_type / timestamp / timezone / clock uncertainty: `fact|hypothesis|contradiction|remedial-evidence|decision-record / ____ / ____ / ____ seconds`
- affected system/activity / data category / data-subject group: `____ / ____ / ____`
- affected quantity / unit / denominator / estimation method: `____ / records|subjects|systems or source-defined / per bounded incident population / ____`
- confidentiality_integrity_availability effect evidence: `____`
- possible rights-and-freedoms consequence scenario: `____`; not a finding
- remedial/processor/notification-decision evidence locator and accountable owner: `____ / ____`
- owner / qualified_reviewer: `incident evidence owner / security incident response, system/data, DPO/privacy counsel, communications/regulatory roles`
- applicability_jurisdiction / assumptions / uncertainty: `questions for counsel / ____ / ____`
- privacy_license_boundary: `restricted evidence; minimized data; chain-of-custody and access rules apply`
- status: `observed | hypothesis | conflicting | review-required | stopped | superseded | human-decision-recorded`
- decision_not_made: `no breach, legal risk, notification/reportability, deadline, containment, remediation, regulator/data-subject contact, or compliance decision`
- stop_reason: `unauthorized evidence, unsafe handling, unknown source/clock/scope, credentials, or live/legal/external action request`

Later corrections append rows and supersede earlier evidence; they never overwrite the historical record.
