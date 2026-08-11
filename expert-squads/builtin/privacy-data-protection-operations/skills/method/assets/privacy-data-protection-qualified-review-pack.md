# Privacy Data Protection Qualified Review Pack

## Review identity

- review_pack_id / artifact_version: `PDP-REVIEW-____ / ____`
- organization and supplied controller_processor roles: `____`
- processing/request/incident scope and inventory version: `____ / ____`
- jurisdiction questions / source inventory version / source_date / effective_date / data_cutoff: `____ / ____ / ____ / ____ / ____`
- branch artifacts and versions: `inventory-flow ____; impact-assessment ____; request-retention ____; incident-evidence ____`
- quantity / unit / denominator: `joined issue count / issues / per branch and review cutoff`
- owner: `____`
- qualified_reviewers: `DPO; privacy counsel; records/data/system owners; security incident response; Human Resources or sector counsel; controller/processor governance`
- applicability / assumptions / uncertainty: `jurisdiction and role questions for counsel / ____ / ____`
- privacy_license_boundary: `minimized authorized evidence; no credentials, unnecessary identifiers, exports, response payloads, or deletion instructions`
- status: `draft | qualified-review-required | stopped | superseded | human-reviewed`
- decision_not_made: `no legal applicability/basis/role/exemption/notification/risk/compliance, production search/disclosure/deletion, hold release, containment, or external-contact decision`
- stop_reason: `____`

## Joined claim contract

For each claim record `claim_id`, branch row IDs, inventory/activity/system/flow references, source locators/versions/dates, effective date/cutoff, quantity with unit/denominator, owner/reviewer, applicability/jurisdiction, assumptions, uncertainty, status, decision_not_made, and escalation. Preserve conflicting system, role, retention, request, incident, and jurisdiction evidence. Never emit a compliance score.

## Controlled human decisions

Qualified reviewers record decisions outside this artifact with identity, role, controlled decision locator, reviewed versions, date, disposition, conditions, and signature mechanism. A placeholder means no approval. Stop when a branch or authority is missing, personal data is unnecessary, or the request would take legal, production, security, lifecycle, or external action.
