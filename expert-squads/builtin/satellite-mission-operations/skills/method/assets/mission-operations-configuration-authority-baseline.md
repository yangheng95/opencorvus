# Mission Operations Configuration Authority Baseline

## Record contract

Create one immutable row per spacecraft, mission phase, controlled configuration, Operations Database, command dictionary, flight-procedure set, ground segment, and time-correlation baseline. Required fields: `baseline_id`, `artifact_version`, `spacecraft_id`, `mission_phase`, `configuration_id`, `source_locator`, `source_version`, `source_date`, `effective_date`, `data_cutoff`, `quantity`, `unit`, `denominator`, `owner`, `qualified_reviewer`, `applicability`, `assumptions`, `uncertainty`, `security_license_boundary`, `status`, `decision_not_made`, and `stop_reason`. Values are evidence pointers; do not paste protected standard or controlled procedure content.

## Template row

- baseline_id: `SMO-CFG-____`
- artifact_version: `____`
- spacecraft_id / mission_phase: `____ / ____`
- configuration_id and authority record: `____`
- Operations Database version / effective date / source locator: `____ / ____ / ____`
- command dictionary and procedure-set versions: `____ / ____`
- ground-segment and contact-service versions: `____ / ____`
- time systems and correlation version: `UTC|TAI|GPS|SCLK / ____`
- data_cutoff and source_date: `____ / ____`
- quantity / unit / denominator: `____ / ____ / per baseline or mission phase`
- owner / qualified_reviewer: `____ / flight director, spacecraft operations, subsystem, ground, or flight-dynamics reviewer`
- applicability: `spacecraft, phase, configuration, station, jurisdiction, effective interval`
- assumptions / uncertainty: `____ / ____`
- security_license_boundary: `authorized locator only; no credentials or protected text`
- status: `draft | review-required | controlled-reference | superseded | stopped`
- decision_not_made: `no operational approval, configuration change, command, contact, or safety decision`
- stop_reason: `missing authority, incompatible version, unknown applicability, or unauthorized source`

## Review rules

Never overwrite a superseded row. Cross-link its successor and preserve effective intervals. Stop when two branches cite incompatible baselines without an accountable reconciliation record. The qualified reviewer records the accepted baseline outside this artifact; this template only preserves evidence and open questions.
