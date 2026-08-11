# Surveillance System Population Case Definition Baseline

## Record contract

Create immutable rows for the surveillance purpose, monitored population/place/time, reporting entities and flow, health event, event/case-definition version, source system/extract/schema, data dictionary, revision policy, duplicate rule, denominator source, privacy authority, and intended users. Required fields are `baseline_row_id`, `artifact_version`, `source_locator`, `source_version`, `source_date`, `effective_date`, `data_cutoff`, `quantity`, `unit`, `denominator`, `owner`, `qualified_reviewer`, `applicability_jurisdiction`, `assumptions`, `uncertainty`, `privacy_license_boundary`, `status`, `decision_not_made`, and `stop_reason`.

## Template row

- baseline_row_id / artifact_version: `PHS-BASE-____ / ____`
- surveillance purpose and intended uses: `____`
- monitored population / geography / time interval: `____ / ____ / ____`
- health event / event or case-definition ID/version/effective interval: `____ / ____ / ____`
- reporting entity and source-to-ingest-to-curation-to-analysis flow: `____`
- source_locator / source_version / schema_version / source_date / data_cutoff: `____ / ____ / ____ / ____ / ____`
- initial, revised, withdrawn, duplicate-candidate, and superseded record semantics: `____`
- duplicate and revision rule source/version: `____ / ____`
- numerator population / denominator source / quantity / unit / denominator: `____ / ____ / ____ / records|persons|events|tests|sequences|person-time or source-defined / per declared population and interval`
- owner / qualified_reviewer: `surveillance owner / epidemiologist, biostatistician, informatician/data steward, source specialist, privacy/legal`
- applicability_jurisdiction / assumptions / uncertainty: `____ / ____ / ____`
- privacy_license_boundary: `minimized authorized evidence; no credentials or unnecessary identifiers`
- status: `draft | source-verified | review-required | conflicting | stopped | superseded`
- decision_not_made: `no diagnosis, person-level case classification, signal/outbreak, reporting, alert, publication, or intervention decision`
- stop_reason: `unknown population, definition, source/schema, denominator, revision rule, privacy authority, or accountable owner`

Never overwrite an earlier definition or source baseline. Cross-link its successor and preserve effective intervals. A human classification or report remains a separately controlled record.
