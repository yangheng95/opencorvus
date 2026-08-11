# Monitoring Verification Deviation Corrective Action Ledger

## Evidence-chain contract

Record one immutable chain element per monitoring observation, calibration record, deviation, correction, affected-product record, corrective action, effectiveness check, verification, or validation item. Required fields: `chain_id`, `row_id`, artifact version, facility/product/lot/process/control IDs, source locator/version/date, effective date/cutoff, parameter and observed/reference values, unit/denominator, instrument/calibration version, owner, qualified reviewer, applicability, assumptions, uncertainty, privacy/license boundary, status, decision_not_made, and stop reason.

## Template row

- chain_id / row_id / artifact_version: `FSQ-CTRL-____ / ____ / ____`
- facility_product_lot_process_control: `____ / ____ / ____ / ____ / ____`
- authorized control-plan ID/version/effective date: `____ / ____ / ____`
- source_locator / source_version / source_date / data_cutoff: `____ / ____ / ____ / ____`
- monitored parameter / observation / unit / denominator: `____ / ____ / ____ / per sample, lot, batch, interval, or source-defined event`
- supplied reference or limit locator/version: `____ / ____`; do not invent or approve it
- instrument ID / calibration source/version/status: `____ / ____ / ____`
- deviation / correction / affected-product record / corrective action: `____ / ____ / ____ / ____`
- verification / validation / effectiveness evidence: `____ / ____ / ____`
- owner / qualified_reviewer: `____ / food-safety or quality owner plus technical reviewer`
- applicability / assumptions / uncertainty: `____ / ____ / ____`
- privacy_license_boundary: `authorized controlled-record locators; no protected procedure text`
- status: `observed | review-required | action-recorded | verification-recorded | stopped | superseded`
- decision_not_made: `no conformance, product impact, control adequacy, validation, closure, release, hold, rework, destroy, safety, or compliance decision`
- stop_reason: `version mismatch, unknown unit/instrument/lot/authority, missing source, or operational request`

Monitoring, verification, and validation remain separate. Preserve the controlled human disposition verbatim with its locator; this ledger never creates one.
