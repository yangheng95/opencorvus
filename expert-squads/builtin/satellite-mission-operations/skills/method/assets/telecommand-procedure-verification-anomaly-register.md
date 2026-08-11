# Telecommand Procedure Verification and Anomaly Register

## Non-executable evidence contract

Create one row per evidence-chain element, never an executable command sequence. Required fields are `chain_id`, `row_id`, `artifact_version`, `request_source`, `source_locator`, `source_version`, `source_date`, `data_cutoff`, `spacecraft_id`, `configuration_id`, `procedure_id_version`, `command_dictionary_version`, supplied parameter name/value/unit/denominator, validation-range source, precondition/inhibit evidence, independent-check evidence, rehearsal/simulation locator and result, authorization locator, window/route record, expected and observed verification, time scale/correlation, owner, qualified reviewer, applicability, uncertainty, status, decision_not_made, and stop reason.

## Template row

- chain_id / row_id / artifact_version: `SMO-TC-____ / ____ / ____`
- request_source / source_locator / source_version / source_date: `____ / ____ / ____ / ____`
- data_cutoff / spacecraft / configuration / mission phase: `____ / ____ / ____ / ____`
- procedure_id_version / command_dictionary_version: `____ / ____`
- supplied parameter record / value / unit / denominator: `name only / ____ / ____ / per authorized procedure occurrence`
- validation_range_source: `locator only; do not repeat protected or operational content`
- precondition / inhibit / independent-check evidence: `____ / ____ / ____`
- rehearsal_simulation / authorization / window_route evidence: `____ / ____ / ____`
- expected_verification / observed_verification / time_scale_correlation: `____ / ____ / ____`
- anomaly fact, hypothesis, contradiction, or decision-point evidence: `____`
- owner / qualified_reviewer / applicability: `____ / flight director, operator, subsystem and ground reviewers / ____`
- assumptions / uncertainty / status: `____ / ____ / incomplete|review-required|stopped|superseded`
- decision_not_made: `no command creation, approval, scheduling, transmission, retry, abort, verification, recovery, or emergency classification`
- stop_reason: `missing authority, version mismatch, unknown unit/inhibit/time mapping, or request for live action`

## Handling rule

Do not place credentials, endpoints, command syntax, recommended parameters, bypasses, or recovery instructions in this register. Preserve conflicting evidence. Human operators and the flight director resolve readiness and authorize actions only in controlled systems.
