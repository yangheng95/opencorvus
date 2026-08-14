# Pipeline threat data integration matrix

## Controlled metadata

- artifact_id: PIM-THREAT-DATA-MATRIX
- artifact_version: 2026.08.11.1
- source_locator_version_date: exact inspection, monitoring, patrol, excavation, incident, geotechnical, laboratory, or change source
- cutoff_effective_date: required with source coverage interval
- quantity_unit_denominator: measurement/unit and inspected, monitored, patrolled, or sampled coverage denominator
- owner: operator threat/data owner
- qualified_reviewer: pipeline integrity engineer and competent threat-domain specialist
- applicability_jurisdiction: exact system/segment/configuration and operator taxonomy/procedure
- assumptions_uncertainty: coverage, resolution, calibration, sampling, spatial, temporal, and classification uncertainty
- privacy_license_boundary: authorized sensitive infrastructure data and source license
- status: draft | evidence-complete-for-review | qualified-review-required | stopped | superseded
- decision_not_made: no threat activation, interaction, risk, inspection, response, operating, or compliance decision
- outcome_unknown: preserve ambiguous external effects and source states
- stop_escalation: absent taxonomy, unknown coverage/unit, unverifiable source, unauthorized data, or emergency

## Evidence matrix

| row_id         | segment/configuration | candidate_threat_id | taxonomy/procedure/version | operator_supplied_state                                    | source/type/version/date | coverage | value/unit/denominator | method/tool/calibration | support/counterevidence/gap | interaction_link       | owner/reviewer | uncertainty | status |
| -------------- | --------------------- | ------------------- | -------------------------- | ---------------------------------------------------------- | ------------------------ | -------- | ---------------------- | ----------------------- | --------------------------- | ---------------------- | -------------- | ----------- | ------ |
| PIM-THREAT-001 | required              | required            | required                   | active/inactive/unknown/conflicting/unassessed as supplied | required                 | required | required or reason     | required                | preserve all                | supplied/question only | required       | required    | draft  |

Candidate categories may include corrosion, cracking, manufacturing/construction, equipment, incorrect operations, weather/outside force, third-party/mechanical damage, geohazard, or operator-defined other categories. Listing a category is not classification. Missing evidence never means absence of threat; correlated evidence never proves causation. Cross-link every row to the segment baseline and retain source revisions.
