# Satellite Mission Operations Qualified Review Pack

## Join identity

- review_pack_id / artifact_version: `SMO-REVIEW-____ / ____`
- spacecraft_id / mission_phase / configuration baseline: `____ / ____ / ____`
- source inventory version / source_date / data_cutoff: `____ / ____ / ____`
- time scales and correlation version: `____`
- branch artifacts and versions: `configuration ____; telemetry ____; contact-plan ____; procedure-anomaly ____`
- owner: `____`
- qualified_reviewers: `flight director; spacecraft operations; named subsystem; flight dynamics; ground/network; payload; space safety; spectrum/regulatory as applicable`
- applicability: `spacecraft, phase, configuration, planning horizon, stations, jurisdiction, effective interval`
- quantity / unit / denominator: `joined issue count / issues / per branch and review cutoff`
- assumptions / uncertainty: `____ / include source, timing, prediction and configuration uncertainty`
- security_license_boundary: `authorized evidence locators only; no credentials, protected standards, or executable commands`
- status: `draft | qualified-review-required | stopped | superseded | human-reviewed`
- decision_not_made: `no flight authorization, command, pass booking, alert, maneuver, spectrum, collision, safety, or emergency decision`
- stop_reason: `____`

## Branch join table

For each joined claim record `claim_id`, branch row IDs, source locators/versions/dates, effective date or cutoff, value with unit and denominator, compatibility of spacecraft/configuration/time mapping, owner, reviewer, applicability, assumptions, uncertainty, status, decision_not_made, and escalation. Do not collapse conflicting observations or predictions. List missing branch evidence and superseded baselines.

## Human review placeholders

Each reviewer records outside this template: identity, role, controlled decision record locator, reviewed artifact versions, date, disposition, conditions, and signature mechanism. A blank placeholder means no decision. The evidence owner must stop the join if a required branch is absent, live access is requested, or operational authority is unclear.
