# Privacy Impact Assessment Risk Measure Ledger

## Scenario and measure contract

Create one row for each assessment-scope fact, rights-and-freedoms scenario, measure, implementation/test evidence item, DPO advice record, or accountable decision reference. Required fields include `scenario_measure_id`, artifact and assessment versions, inventory/activity/system/flow IDs, source locator/version/date, effective date/cutoff, affected quantity with unit/denominator, nature/scope/context/purpose evidence, event/cause/effect, supplied risk-scale source/value, measure owner/evidence, qualified reviewer, applicability/jurisdiction, assumptions, uncertainty, privacy/license boundary, status, decision_not_made, and stop reason.

## Template row

- scenario_measure_id / artifact_version / assessment_version: `PDP-DPIA-____ / ____ / ____`
- inventory_activity_system_flow IDs: `____`
- nature / scope / context / purpose evidence: `____ / ____ / ____ / ____`
- necessity and proportionality claim source/owner: `____ / ____`; do not create a legal conclusion
- data-subject group / event or cause / potential rights-and-freedoms effect: `____ / ____ / ____`
- source_locator / source_version / source_date / effective_date / data_cutoff: `____ / ____ / ____ / ____ / ____`
- affected quantity / unit / denominator: `____ / subjects|records|events or source-defined / per processing population and cutoff`
- authorized risk method/scale/source and supplied value: `____ / ____`
- measure design / implementation / test evidence / owner: `____ / ____ / ____ / ____`
- DPO advice and accountable-decision locators: `____ / ____`
- qualified_reviewer / applicability_jurisdiction: `DPO, privacy counsel, security, system/data and domain reviewers / questions for counsel`
- assumptions / uncertainty / status: `____ / ____ / draft|review-required|stopped|superseded|human-decision-recorded`
- privacy_license_boundary: `minimized evidence; upstream and legal texts by locator`
- decision_not_made: `no DPIA applicability, lawful basis, necessity, proportionality, risk acceptance, consultation, notification, or compliance decision`
- stop_reason: `missing scope, authority, risk-method source, measure evidence, inventory alignment, or qualified owner`

Never generate a generic risk score. A completed row or ledger is not an approved DPIA.
