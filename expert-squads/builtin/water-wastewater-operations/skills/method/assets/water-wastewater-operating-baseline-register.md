# Water and Wastewater Operating Baseline Register

Use this register to establish one common evidence boundary before calculations or possible-excursion review. One record represents one versioned system, facility, process, asset hierarchy, data export, analytical method, permit/operating-plan source or decision authority. Do not combine drinking-water and wastewater boundaries or different facilities, methods, units, periods or jurisdictions without explicit reconciliation.

Canonical field keys: `record_id`, `object_ids`, `unit`, `source_location`, `source_authority`, `source_version`, `effective_date`, `observation_date`, `owner`, `qualified_reviewer`, `applicability`, `uncertainty`, `status`, `decision_not_made`, `stop_or_escalation`.

## Mandatory provenance envelope

| Field                                   | Required content                                                                                                             |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| record_id                               | Stable `WWB-###`.                                                                                                            |
| system_facility_train_asset_sample_ids  | Native IDs and hierarchy for system, facility, train, process, stream, asset, instrument and sample point.                   |
| scope_and_boundary                      | Drinking water, distribution, collection, wastewater, effluent, residuals or support process; inflow/outflow and exclusions. |
| unit_and_time_zone                      | Flow, level, concentration, mass, solids, energy and time units; named time zone and aggregation basis.                      |
| source_location                         | URI, controlled document/section, historian/SCADA/export, laboratory record or work-order locator.                           |
| source_authority                        | Facility, certified operator, laboratory, regulator or other named issuer.                                                   |
| source_or_method_version_effective_date | Document/export/schema/analytical method revision and valid period.                                                          |
| observation_sample_or_retrieval_date    | Relevant event chronology, not a substitute for effective date.                                                              |
| owner                                   | Accountable certified operations, asset, laboratory or compliance owner.                                                     |
| qualified_reviewer                      | Process/asset engineer, laboratory QA, maintenance/electrical, environmental compliance or public-health role.               |
| applicability                           | Facility, train, stream, state, sample type, analytical fraction, period and exclusions.                                     |
| uncertainty                             | Identity, unit, clock, method, detection limit, instrument, coverage, estimate or censoring limits.                          |
| status                                  | Draft, source-verified, conflict, superseded, review-required or human-approved.                                             |
| decision_not_made                       | No control, safety, result-validation, discharge, compliance, notice, release, design or emergency decision.                 |
| stop_or_escalation                      | Trigger and authorized recipient.                                                                                            |

## Baseline rows

| record_id | system_facility_train_asset_sample_ids | scope_and_boundary         | unit_and_time_zone | source_location | source_authority | source_or_method_version_effective_date | observation_sample_or_retrieval_date | owner   | qualified_reviewer | applicability | uncertainty | status | decision_not_made                                                      | stop_or_escalation                                                |
| --------- | -------------------------------------- | -------------------------- | ------------------ | --------------- | ---------------- | --------------------------------------- | ------------------------------------ | ------- | ------------------ | ------------- | ----------- | ------ | ---------------------------------------------------------------------- | ----------------------------------------------------------------- |
| WWB-001   | unknown                                | Operating baseline pending | unknown            | unknown         | unknown          | unknown                                 | unknown                              | unknown | unknown            | unknown       | unknown     | draft  | No operational public-health compliance maintenance or design decision | Stop until IDs boundaries units methods and authorities reconcile |

Record authorities separately for certified operation, treatment/process engineering, laboratory QA, asset/maintenance/electrical, environmental compliance, public health, notification, equipment isolation/release, design/capital, regulator and emergency command. A database role or contact list does not prove authority. Preserve conflicting IDs, methods, permits, exports and dates as issues with owners and review dates.
