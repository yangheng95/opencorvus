# Telemetry Health Mode Event Ledger

## Purpose and grain

Record one source-bound parameter sample, aggregation, mode transition, or event per row. Do not label a spacecraft healthy, failed, safe, or recoverable. Required provenance: `row_id`, `artifact_version`, `packet_channel_id`, raw source locator/version/date, configuration/database/calibration/limit-set versions, original timestamp/time scale, time-correlation version, engineering value, unit, denominator or sample window, quality flag, observed/derived/predicted state, owner, qualified reviewer, applicability, assumptions, uncertainty, status, decision_not_made, and stop reason.

## Template row

- row_id / artifact_version: `SMO-TLM-____ / ____`
- spacecraft / mission phase / configuration: `____ / ____ / ____`
- source_locator / source_version / source_date / data_cutoff: `____ / ____ / ____ / ____`
- packet_channel_id / raw representation: `____ / ____`
- calibration conversion version: `____`; never invent constants
- timestamp / original time scale / correlation version / time uncertainty: `____ / ____ / ____ / ____ seconds`
- engineering value / unit / denominator or sample window: `____ / ____ / per sample, second, orbit, or declared interval`
- quality flag and provenance semantics: `____`
- mode / event / applicable limit-set version: `____ / ____ / ____`
- owner / qualified_reviewer: `____ / spacecraft operator plus named subsystem engineer`
- applicability / assumptions / uncertainty: `____ / ____ / ____`
- security_license_boundary: `authorized mission record; no credential or protected-standard text`
- status: `observed | derived | predicted | conflicting | missing | review-required | stopped`
- decision_not_made: `no alert, health diagnosis, recovery, mode change, or limit authorization`
- stop_reason: `unknown configuration, conversion, unit, time mapping, quality semantics, or authority`

## Evidence checks

Preserve raw and converted values together. A quality-invalid or limit-excursion row is a review question. Do not interpolate across gaps without an owner-supplied method. Link every interpretation to the exact source row and let the qualified subsystem reviewer decide significance in the controlled operational process.
