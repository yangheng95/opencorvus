# Public Health Surveillance Qualified Review Pack

## Join identity

- review_pack_id / artifact_version: `PHS-REVIEW-____ / ____`
- surveillance purpose / monitored population / geography / interval: `____ / ____ / ____ / ____`
- event_case_definition versions and effective dates: `____`
- source inventory/schema/revision versions / source_date / data_cutoff: `____ / ____ / ____`
- branch artifact IDs and versions: `baseline ____; data-quality ____; measure-trend ____; indicator-linkage ____`
- quantity / unit / denominator: `joined issue count / issues / per branch and review cutoff`
- owner: `____`
- qualified_reviewers: `public-health authority; epidemiologist; biostatistician; surveillance informatician/data steward; laboratory/genomic and other source specialists; privacy/legal; communications`
- applicability_jurisdiction / assumptions / uncertainty: `____ / ____ / include source, definition, denominator, lag, revision and sampling uncertainty`
- privacy_license_boundary: `minimized authorized evidence; minimum-cell and source-license controls`
- status: `draft | qualified-review-required | stopped | superseded | human-reviewed`
- decision_not_made: `no diagnosis, case classification, validated signal, cluster/outbreak/emergency, alert, report, contact tracing, publication, order, or intervention`
- stop_reason: `____`

## Joined claim table

For every claim record `claim_id`, branch row IDs, source locators/versions/dates, definition/method versions, effective date/cutoff, population/place/time, numerator/denominator/unit, reporting lag/completeness/coverage, owner/reviewer, applicability, assumptions, uncertainty, privacy boundary, status, `decision_not_made`, and escalation. Preserve incompatible definitions, cutoffs, revisions, and indicators. Do not generate a composite outbreak or system-fitness score.

## Human decision records

Qualified roles record controlled decisions outside this pack with identity, role, reviewed artifact versions, date, decision locator, disposition, conditions, and signature mechanism. A blank decision record means no decision. Stop the join if a branch, denominator, definition, privacy authority, or accountable public-health owner is missing.
