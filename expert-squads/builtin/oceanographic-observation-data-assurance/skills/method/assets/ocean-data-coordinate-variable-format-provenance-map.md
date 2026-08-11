# Ocean Data Coordinate Variable Format Provenance Map

## Purpose

Trace labeled multidimensional data from source object through selection, alignment, transformation and output while preserving dimensions, coordinates, attributes, encodings and missing-value semantics.

## Controlled provenance

- artifact_id: OCEAN-FORMAT-PROVENANCE-MAP
- artifact_version: 2026.08.11.1
- row_id: required and stable across revisions
- source_id_locator: exact authoritative source, record, page/object/channel, and access boundary
- source_locator_version_date: source locator plus edition/revision and issue or observation date
- source_version_date: preserve both source version and date without silently replacing either
- cutoff_effective_date: observation cutoff and the interval in which configuration or authority applies
- units_and_denominator: record original value, unit, basis, population/coverage denominator, and conversion method
- owner: evidence or asset owner responsible for source custody
- qualified_reviewer: named role with the professional authority to interpret this evidence
- applicability_jurisdiction: exact facility/system/dataset, location, operating state, authority, and jurisdiction
- assumptions_uncertainty: assumptions, measurement/model/coverage uncertainty, confidence limits, and representativeness
- privacy_license_state: classification, access permission, redistribution limit, copyright/license, and retention restriction
- status: draft | evidence-complete-for-review | qualified-review-required | stopped | superseded
- decision_not_made: no silent alignment, regridding, datum/calendar/unit substitution, source replacement, publication, scientific acceptance, forecast, navigation, or safety decision
- outcome_unknown: true until the named qualified reviewer records a separate determination
- stop_escalation: incompatible or missing dimension/coordinate/datum/calendar/unit, unknown encoding, absent transform parameters/digest, restricted source, or remote-fetch request

## Domain records

- NetCDF/HDF5/Zarr file/store, group/tree, dataset/variable, processing level, source revision, object path and digest.
- Dimensions, coordinates, bounds, grid mapping/CRS, time/calendar, depth/pressure, variable/standard/long name, unit, fill, scale/offset, chunks, compression and conventions.
- Selection, alignment, concatenation, interpolation, aggregation or conversion with software/environment version, parameters, input/output identity and digest.

## Reconciliation checks

- Use coordinate labels and explicit alignment rules; never rely on array position when identities differ.
- Verify missing values, attributes and encodings before and after each bounded transformation.
- Stop on incompatible calendars, datums, units or coordinates rather than silently coercing them.

## Controlled row template

| row_id           | domain_object_and_revision | source_id_locator | source_version_date | cutoff_effective_date | value                        | units_and_denominator               | owner    | qualified_reviewer | applicability_jurisdiction | assumptions_uncertainty | privacy_license_state | status | decision_not_made                                                                                                                                                   | outcome_unknown | stop_escalation                                                                                                                                                    |
| ---------------- | -------------------------- | ----------------- | ------------------- | --------------------- | ---------------------------- | ----------------------------------- | -------- | ------------------ | -------------------------- | ----------------------- | --------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| OCEAN-FORMAT-001 | required                   | required          | required            | required              | source value or not supplied | required or explicit not applicable | required | required           | required                   | required                | required              | draft  | no silent alignment, regridding, datum/calendar/unit substitution, source replacement, publication, scientific acceptance, forecast, navigation, or safety decision | true            | incompatible or missing dimension/coordinate/datum/calendar/unit, unknown encoding, absent transform parameters/digest, restricted source, or remote-fetch request |

Never treat an empty field as "none," a missing row as absence, a calculation as approval, or a completed template as professional acceptance. Preserve superseded rows, counterevidence, conflicting versions and the reviewer's separate disposition.
