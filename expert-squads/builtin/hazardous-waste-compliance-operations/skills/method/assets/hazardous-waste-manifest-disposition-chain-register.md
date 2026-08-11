# Hazardous Waste Manifest and Disposition Chain Register

Use immutable rows to trace each manifest line and event. This register does not create, sign, submit, amend, retry, certify, route, transport, receive, treat, or dispose of waste.

## Required identity and event fields

- `artifact_id`, stable `row_id`, manifest/tracking ID, source revision, line ID, originating stream/event and site-month ledger IDs.
- Generator/site, transporter(s), receiving/designated facility identifiers exactly as supplied; party role, signature/certification actor and timestamp references without reproducing sensitive credentials.
- Waste description and codes only as source data, quantity/value, unit, denominator/container type/count, conversion and source; no inferred classification.
- Preparation, submission, transmission outcome, shipment, custody, receipt, rejection, discrepancy, amendment, exception, return, and final disposition event IDs/dates/statuses, each with authoritative source locator/version/date.
- Evidence cutoff/effective date, owner, authorized/qualified reviewer, applicability/jurisdiction, assumptions, uncertainty/confidence, privacy/license, status, `decision_not_made`, `outcome_unknown`, and stop/escalation.

## Reconciliation template

`artifact_id=HWMD-REGISTER-001`; `row_id=HWMD-LINE-0001`; `manifest_tracking_id/revision=pending`; `line_id=pending`; `origin_stream_event_site_month=pending`; `parties=pending authoritative IDs`; `source_description_codes=pending`; `quantity_unit_container=pending`; `shipment_signature_receipt_events=pending`; `discrepancy_amendment_exception_return=pending`; `final_disposition_record=pending`; `source_locator/version/date=pending`; `cutoff_or_effective_date=YYYY-MM-DD`; `owner=facility waste coordinator`; `qualified_reviewer=authorized generator/receiving-facility and environmental reviewer`; `applicability_jurisdiction=declared manifest/site/shipment only`; `assumptions=no acceptance or final disposition inferred`; `uncertainty_confidence=chain incomplete`; `privacy_license=restricted party/signature and system records`; `status=stopped`; `decision_not_made=no classification, signature, submission/retry, shipment, receipt, treatment, or disposal`; `outcome_unknown=true`; `stop_escalation=reconcile authoritative e-Manifest/paper and party records before authorized action`.

A timeout, absent return copy, or apparently accepted electronic message is not final disposition. Preserve the original revision and add linked amendment rows; never overwrite signed evidence.
