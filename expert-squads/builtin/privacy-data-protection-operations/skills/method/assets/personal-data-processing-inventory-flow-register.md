# Personal Data Processing Inventory Flow Register

## Record grain and provenance

Create one immutable row per processing activity, system/store, interface/flow, recipient/processor, transfer, archive/backup, or deletion-state evidence item. Required fields: `row_id`, `artifact_version`, `activity_id`, `system_flow_id`, `source_locator`, `source_version`, `source_date`, `effective_date`, `data_cutoff`, `quantity`, `unit`, `denominator`, `owner`, `qualified_reviewer`, `applicability_jurisdiction`, `assumptions`, `uncertainty`, `privacy_license_boundary`, `status`, `decision_not_made`, and `stop_reason`.

## Template row

- row_id / artifact_version: `PDP-INV-____ / ____`
- activity / system_store / interface_flow IDs: `____ / ____ / ____`
- business process and supplied purpose: `____ / ____`
- data-subject group / personal-data category / origin state: `____ / ____ / direct|observed|derived|inferred|unknown`
- source and destination / recipient processor subprocessor / geography transfer: `____ / ____ / ____`
- active archive backup log cache deletion-state evidence: `____`
- supplied organization role / legal-basis / safeguard / retention-source claims: `____ / ____ / ____ / ____`
- source_locator / source_version / source_date / effective_date / data_cutoff: `____ / ____ / ____ / ____ / ____`
- quantity / unit / denominator: `____ / records|subjects|bytes|systems or source-defined / per activity, system, flow, or cutoff population`
- owner / qualified_reviewer: `business/data owner / system-security, records, DPO or privacy counsel as applicable`
- applicability_jurisdiction / assumptions / uncertainty: `questions for counsel / ____ / ____`
- privacy_license_boundary: `minimized authorized evidence; no credentials or unnecessary identifiers`
- status: `observed | expected-design | unverified | conflicting | review-required | stopped | superseded`
- decision_not_made: `no controller/processor, lawful-basis, transfer, retention, compliance, access, deletion, or risk decision`
- stop_reason: `unknown authority, activity/system/source version, category, recipient, transfer, role owner, or classification`

Do not merge expected design with observed evidence. Supplied legal fields remain attributed claims until the DPO/privacy counsel decides them.
