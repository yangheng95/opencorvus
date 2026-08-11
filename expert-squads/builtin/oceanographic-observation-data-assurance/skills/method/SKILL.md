---
name: oceanographic-observation-data-assurance-method
description: Prepare source-bound ocean platform, instrument, calibration, profile, time-series, QARTOD, multidimensional-format, coordinate, provenance, and cross-platform validation evidence. Use for bounded oceanographic data assurance without sensor control, flag overwrite, publication, forecasting, navigation, or marine-safety authority.
---

# Oceanographic Observation Data Assurance Method

## Freeze observation identity and semantics

Freeze program/mission, platform, station/cruise, deployment/recovery, cast/profile/sample, instrument/channel, calibration/configuration, source dataset/file/object revision, processing level, variable/measurand, unit, horizontal and vertical datum, depth/pressure convention, time reference/time zone/calendar, sampling and averaging, source cutoff, evidence owner and qualified reviewers.

Assign stable identifiers to platforms, deployments, instruments, calibrations, profiles, samples, variables, dimensions, coordinates, files/stores, transformations, quality-control tests, flags and collocation pairs. Preserve source_id_locator, source_version_date, value and units_and_denominator, applicability, assumptions_uncertainty, privacy/license state, decision_not_made, outcome_unknown and stop/escalation.

Keep raw observations, adjusted observations and derived products separate. Keep original flags, test-level flags, aggregate flags and reviewed overrides separate. Never silently replace a value, coordinate, flag, attribute or source object.

## Build platform and instrument metadata lineage

Trace program and mission to platform, cruise/station, deployment, cast/profile, instrument and channel. Record make/model/serial, firmware/software, mounting/orientation, nominal and observed position, sensor depth or intake geometry, sample path, clock source, sampling rate, averaging, calibration certificate/event/range/uncertainty, configuration changes, recovery and custody.

Distinguish planned configuration, deployed configuration, recovered configuration and data-file metadata. Expose serial swaps, firmware drift, clock uncertainty, missing calibration intervals, inconsistent position/depth, duplicate profile identifiers and uncertain custody. Do not infer calibration corrections, fitness for use, platform safety or observation validity.

## Govern profile and time-series quality control

Before applying any Quality Assurance of Real-Time Oceanographic Data (QARTOD) or project test, freeze the variable, unit, measurement method, vertical/time semantics, sampling interval, manual/version, test vocabulary, thresholds and aggregation rule. Apply only the supplied approved procedure.

For each test, record test name/version, input record set, eligible denominator, threshold source, result, original value and flag, aggregate rule, operator override, reason, reviewer and timestamp. Preserve suspect, failed, missing, censored and below-detection values. For profiles, retain cast direction, bin/sample definition, pressure-depth conversion method, sensor lag/response and reversal handling. Do not invent gross-range, climatology, spike, rate-of-change, flat-line, neighbor or location thresholds.

## Preserve multidimensional coordinate and format integrity

Retain the following bounded concepts from the pinned UW-SSEC Xarray Skill: labeled dimensions, coordinate labels, attributes, NetCDF/HDF5/Zarr identity, coordinate-aware selection and alignment, lazy/chunk-aware bounded processing, explicit missing-value handling and metadata preservation.

Inventory dataset, group/tree, variable, dimension, coordinate, bounds, grid mapping, coordinate reference system, standard name, long name, unit, calendar, fill value, scale/offset, chunking, compression, convention and encoding. Before selection, alignment, concatenation, interpolation, aggregation or conversion, record exact inputs, coordinate semantics and compatibility rules. Afterward, record software/environment version, parameters, output identity and digest. Do not install packages, execute upstream examples, fetch remote data, plot automatically, silently align incompatible calendars/datums/units or treat generic array operations as oceanographic QC.

## Build cross-platform validation evidence

Define a collocation contract before matching: source revisions, platforms/instruments, variables and units, coordinate/datum conversions, temporal/spatial/vertical tolerances, interpolation, exclusions, eligible-pair denominator and uncertainty components. Do not select tolerances after observing results.

Record all candidate pairs, accepted pairs, rejected pairs and reasons. Preserve individual observations, coordinates, time/depth offsets, conversions, residual or difference definition, measurement uncertainty, calibration uncertainty, coordinate/time uncertainty, interpolation effect and representativeness difference. Treat neither source as truth unless a qualified reviewer supplied that designation. Never turn collocation into calibration adjustment, sensor command, forecast or operational suitability.

## Reconcile branches and conflicting evidence

Require all four zero-dependency reports. Join by mission/platform/deployment/profile/instrument/channel/variable and exact dataset revision. Check:

- data-file metadata against deployed instrument and calibration lineage;
- QC input variable, unit, time, depth/pressure and processing level against the frozen observation identity;
- original, adjusted and derived lineage against transformations and digests;
- original/test/aggregate/reviewed flag lineage against the approved procedure;
- dimension, coordinate, calendar, datum and encoding semantics across format transformations;
- collocation eligibility and denominators against QC state, calibration interval and uncertainty;
- publication or downstream status against unresolved gaps.

Preserve mismatched datums, calendars, units, serials, calibrations, duplicate profiles, disputed flags, noncomparable variables and unsupported truth-source assumptions. A complete pack is not a release or scientific acceptance.

## Use the assets and references

Populate exactly:

- [platform/instrument metadata register](assets/ocean-observing-platform-instrument-metadata-register.md)
- [profile/time-series QC ledger](assets/oceanographic-profile-timeseries-quality-control-ledger.csv)
- [coordinate/variable/format provenance map](assets/ocean-data-coordinate-variable-format-provenance-map.md)
- [cross-platform collocation scorecard](assets/oceanographic-cross-platform-collocation-validation-scorecard.md)
- [qualified review pack](assets/oceanographic-observation-data-qualified-review-pack.md)

Read [UPSTREAM.md](references/UPSTREAM.md) and [ADAPTATION.md](references/ADAPTATION.md) before using retained Xarray concepts; preserve the bundled [BSD-3-Clause license](references/LICENSE). Read [PRIMARY-SOURCES.md](references/PRIMARY-SOURCES.md) when establishing QARTOD, GOOS, CF or NCEI provenance. Do not copy manuals, thresholds or protected material.

## Stop and preserve authority

Stop on ambiguous platform/instrument/profile identity, missing calibration or configuration interval, incompatible units/datums/calendars, unknown time source, unapproved QC test or threshold, overwritten raw data, missing transformation digest, invalid or unexplained coordinate mapping, undefined collocation denominator, restricted data, live platform condition, or request to change sensors, flags, data, publication state, forecasts, warnings, routes or safety decisions.

Oceanographers own scientific interpretation; metrologists and instrument owners own calibration; data stewards own controlled flag and release processes; platform operators own deployment and operations; hydrographic and metocean services own official products; navigation and safety authorities own operational decisions. This Skill prepares evidence only.
