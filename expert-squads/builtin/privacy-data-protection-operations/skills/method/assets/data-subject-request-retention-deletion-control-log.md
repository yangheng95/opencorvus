# Data Subject Request Retention Deletion Control Log

## Chain contract

Record one immutable request-intake, identity-evidence, clarification, authorized search, result inventory, review question, response-decision, retention rule, trigger, hold/exception, deletion/anonymization request, backup/processor propagation, or sampled-verification evidence item per row. Required fields: `chain_id`, `row_id`, artifact/request/schedule versions, source locator/version/date, effective date/cutoff, system/category/result quantity with unit/denominator, owner, qualified reviewer, applicability/jurisdiction, assumptions, uncertainty, privacy/license boundary, status, decision_not_made, and stop reason.

## Template row

- chain_id / row_id / artifact_version: `PDP-DSR-____ / ____ / ____`
- request_id_version / request_type as supplied / receipt source and date semantics: `____ / ____ / ____`
- identity_evidence_status_locator: `____`; never store or verify identity documents here
- scope clarification and counsel-supplied deadline locator: `____ / ____`
- inventory/system/source/search-plan/result locators and versions: `____`
- result quantity / unit / denominator: `____ / records|systems|files or source-defined / per searched source and request scope`
- duplicate/version, redaction, third-party, privilege, exemption questions: `____`
- data category / retention schedule version/effective date / trigger / supplied period: `____ / ____ / ____ / ____`
- legal hold or exception / archive backup processor-chain / sampled verification evidence: `____ / ____ / ____`
- source_locator / source_version / source_date / data_cutoff: `____ / ____ / ____ / ____`
- owner / qualified_reviewer: `request or records owner / DPO, privacy counsel, system/data, records and hold owners`
- applicability_jurisdiction / assumptions / uncertainty: `questions for counsel / ____ / ____`
- privacy_license_boundary: `minimized identifiers; no credentials, exports, response payloads, or deletion instructions`
- status: `intake-recorded | search-evidence | review-required | decision-recorded | stopped | superseded`
- decision_not_made: `no identity verification, deadline, scope, exemption/refusal, disclosure/response, deletion/anonymization, retention change, hold release, or compliance decision`
- stop_reason: `authorization, identity-evidence, source/system, counsel deadline, retention/hold, privacy, or action boundary unresolved`

Never infer completion from zero results and never execute a search or lifecycle change from this log.
