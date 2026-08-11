# Forecast Product, Cycle, and Valid-Time Provenance Register

Create one row for each immutable forecast product/cycle/revision. Never collapse initialization, issue, valid, retrieval, amendment, or supersession times. This register traces evidence and does not issue or endorse a forecast.

## Required row fields

- `artifact_id`, stable `row_id`, producing organization/system, product/model/ensemble ID and version, run/cycle ID, deterministic member or ensemble statistic, and source locator.
- Source version/date, retrieval timestamp, cutoff/effective date, initialization time, issue time, valid instant or interval, lead time with unit, time zone/calendar, and amendment/supersession relationship.
- Domain/grid ID, coordinate reference system, horizontal resolution and unit, location/cell mapping, vertical coordinate/level and unit, parameter, forecast value and unit, denominator or accumulation interval.
- Post-processing, calibration, blending, bias-correction, or forecaster-amendment method/version exactly as supplied; no inferred method.
- Owner, qualified meteorological reviewer, applicability/geography, assumptions, uncertainty/confidence, source license/access/privacy, status, `decision_not_made`, `outcome_unknown`, and stop/escalation.

## Controlled row template

`artifact_id=FPCV-REGISTER-001`; `row_id=FPCV-CYCLE-0001`; `producer_system=authoritative producer pending`; `product_model_version=pending`; `run_cycle_id=pending`; `member_statistic=pending`; `source_locator=exact product URI or immutable object locator`; `source_version/source_date=pending`; `retrieval_time=YYYY-MM-DDThh:mm:ssZ`; `cutoff_or_effective_date=YYYY-MM-DD`; `initialization_time=pending`; `issue_time=pending`; `valid_time_or_interval=pending`; `lead_time_and_unit=pending`; `domain_grid_crs_resolution=pending`; `vertical_level_and_unit=pending`; `parameter_value_unit_denominator=pending`; `post_processing_version=pending`; `owner=forecast-data custodian`; `qualified_reviewer=authorized meteorologist`; `applicability=declared product/domain/cycle only`; `assumptions=none where time or product identity is absent`; `uncertainty=product identity and time semantics unresolved`; `privacy_license=source terms pending`; `status=stopped`; `decision_not_made=no forecast, warning, routing, safety, publication, or model-selection decision`; `outcome_unknown=true`; `stop_escalation=obtain immutable product and all issue/valid/lead-time metadata from the producer`.

Reject consumer summaries, screenshots without machine-readable provenance, mixed cycles, or values lacking parameter/unit/spatial/vertical context. A later revision is a new row linked to the superseded row; it never overwrites evidence available at the original cutoff.
