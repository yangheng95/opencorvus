# Railway Operating Baseline and Authority Register

Use this template to freeze the common operating scope before any path, infrastructure or occurrence analysis. One row must describe one versioned authority or baseline object. Do not combine rules from different infrastructure managers, operating dates, signalling configurations or jurisdictions. Empty fields are `unknown`, never silently `not applicable`.

Canonical field keys: `record_id`, `object_ids`, `unit`, `source_location`, `source_authority`, `source_version`, `effective_date`, `observation_date`, `owner`, `qualified_reviewer`, `applicability`, `uncertainty`, `status`, `decision_not_made`, `stop_or_escalation`.

## Mandatory provenance envelope

| Field                             | Required content                                                                                                       |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| record_id                         | Stable `ROB-###` identifier.                                                                                           |
| object_ids                        | Network, line, station, platform, route, block, signal, train/service/path or authority IDs in their native namespace. |
| object_type_and_scope             | Exact geography, direction, operating day, equipment and service scope.                                                |
| unit_and_time_zone                | Units for distance, time, speed, length or count; named time zone and operating-day convention.                        |
| source_location                   | URI, controlled document ID, section/page/table, database export or record locator.                                    |
| source_authority                  | Issuing infrastructure manager, railway undertaking, regulator or other named authority.                               |
| source_version_and_effective_date | Revision plus valid-from/valid-to; do not substitute download date.                                                    |
| observation_or_retrieval_date     | When evidence was observed or retrieved.                                                                               |
| owner                             | Accountable railway operating owner.                                                                                   |
| qualified_reviewer                | Named role with timetable, signalling, operations or safety competence.                                                |
| applicability                     | Included routes, services, rolling stock, equipment states and excluded cases.                                         |
| uncertainty                       | Missing pages, stale exports, identity conflicts, interpretation limits or confidence basis.                           |
| status                            | Draft, source-verified, conflict, superseded, review-required or human-approved.                                       |
| decision_not_made                 | State that no route, speed, movement, timetable, possession, release, classification or approval is decided.           |
| stop_or_escalation                | Condition, owner and channel that halt analysis or require qualified review.                                           |

## Baseline records

| record_id | object_ids | object_type_and_scope            | unit_and_time_zone | source_location | source_authority | source_version_and_effective_date | observation_or_retrieval_date | owner   | qualified_reviewer | applicability | uncertainty | status | decision_not_made                | stop_or_escalation                   |
| --------- | ---------- | -------------------------------- | ------------------ | --------------- | ---------------- | --------------------------------- | ----------------------------- | ------- | ------------------ | ------------- | ----------- | ------ | -------------------------------- | ------------------------------------ |
| ROB-001   | unknown    | Operating geography and services | unknown            | unknown         | unknown          | unknown                           | unknown                       | unknown | unknown            | unknown       | unknown     | draft  | No operational authority granted | Stop until scope and authority agree |

## Authority map

Record separate owners for timetable publication, capacity allocation, signalling principles, live control, infrastructure configuration, possession/isolation, rolling-stock compatibility, maintenance release, occurrence reporting/investigation, emergency response and safety acceptance. For each, cite delegation or controlled-document evidence and its effective period. A contact list is not proof of authority.

## Reconciliation notes

List duplicate IDs, conflicting names, version gaps, daylight-saving or operating-day ambiguity, superseded notices and assumptions requested by stakeholders. Assign each issue an owner and review date. Do not resolve a conflict by selecting the newest-looking file; require the issuing authority to confirm current applicability.
