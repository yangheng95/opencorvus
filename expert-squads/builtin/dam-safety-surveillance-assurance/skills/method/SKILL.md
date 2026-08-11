---
name: dam-safety-surveillance-assurance-method
description: Dam facility configuration, inspection, instrumentation, performance, potential-failure-mode and control evidence assurance without operational, engineering-release or emergency authority. Use for Select for dam configuration/design-authority trace, consequence context, inspection findings, instrumentation data, behavior trends, potential failure modes, controls or action verification. Do not select to operate gates, set alarm levels, declare safety, warn the public, order evacuation or approve engineering work.
---

# Dam Safety Surveillance Assurance Method

## Purpose and authority

Produce a reproducible evidence pack for qualified review. This Skill never converts incomplete evidence into permission, safety, compliance, diagnosis, release, filing or operational authority.

- Do not operate gates, spillways, outlets, reservoir level or instrumentation; do not change monitoring frequency or thresholds.
- Do not declare a dam safe/unsafe, assign hazard class, accept risk, order repair, activate an emergency action plan, issue a warning or direct evacuation.
- Dam owner, qualified dam-safety/geotechnical/structural/hydraulic engineers, regulator, operations and emergency authorities retain decisions.

## Freeze the review baseline

Before analysis, freeze:

- dam, appurtenant structures, reservoir, site, coordinate and elevation datum
- design basis, drawings, modifications, operating plan and instrumentation-program versions
- reservoir level, loading, weather/seismic context, inspection/instrument evidence cutoff and units
- owner, dam-safety engineer, geotechnical/structural/hydraulic specialists, regulator and emergency-management authority

Give every source, object, event, observation and decision question a stable ID. Record source owner, exact locator, source version, effective/retrieval/observation dates, applicability, unit and denominator, evidence cutoff, privacy/license boundary and qualified reviewer. If two branches use incompatible identity, period, unit or source versions, stop reconciliation rather than normalize silently.

## Domain evidence method

1. Establish one facility and authority baseline covering dam type, components, appurtenant works, foundation/abutments, design and modification records, hazard/consequence information as supplied, and current responsible organizations.
2. Locate every inspection observation by structure, station/offset/elevation or controlled feature ID. Preserve observed condition, dimension/unit, photo or measurement locator, change from comparable baseline, observation limitation and environmental/loading context.
3. Treat instrumentation as a measurement system: record instrument ID, type, location, datum, range, calibration/maintenance status, raw reading, conversion, unit, acquisition time, quality flag and relevant reservoir/weather/loading variables. Never invent an alarm level.
4. Compare behavior only against authorized baselines, expected-response models or threshold sources. Keep seasonal/loading response, instrument drift, missingness, outlier hypotheses and confirmed change separate.
5. Represent potential failure modes as initiating condition, progression, evidence for/against, detection/control, consequence path, uncertainty and owner. Do not estimate probability, risk acceptance or emergency status without authorized method and qualified review.

Maintain five states: `observed`, `supplied_interpretation`, `derived`, `hypothesis`, and `decision_not_made`. Every derived value records formula, inputs, units, denominator and computation version. Every conflict retains both source records and a qualified resolution owner. Absence, silence and failed retrieval are never positive evidence.

## Parallel branches and join

### Dam Configuration Authority and Consequence Analyst

Freezes dam identity, structures, design/modification authority, loading context and supplied consequence classification.

- facility/component identity
- design and modification records
- datum and spatial reference
- ownership/regulatory/consequence source

Reconcile:

- all records describe the same controlled facility
- drawing and modification revisions reconcile
- hazard/consequence status remains as supplied

Stop when:

- facility identity conflict
- datum unknown
- authority or design baseline absent

### Dam Inspection Condition and Defect Analyst

Maps visual, survey and nondestructive observations to exact locations, dimensions, comparisons and limitations.

- embankment/concrete/foundation/appurtenant observations
- seepage, cracking, deformation, erosion and deterioration evidence
- photo/survey/NDE provenance
- change from comparable baseline

Reconcile:

- location and unit are explicit
- comparison uses compatible loading/season
- observation does not become engineering diagnosis

Stop when:

- unlocated finding
- incompatible baseline
- immediate life-safety observation

### Dam Instrumentation Performance Surveillance Analyst

Reconciles instrument health, readings, conversions, environmental/loading covariates and authorized behavior baselines.

- instrument inventory and health
- raw-to-engineering conversion
- pore pressure/seepage/deformation/uplift and reservoir context
- trend, missingness and outlier questions

Reconcile:

- datum/unit/time alignment
- calibration and maintenance status visible
- authorized baseline/threshold source cited

Stop when:

- instrument identity or conversion unknown
- datum/unit mismatch
- threshold action requested

### Dam Potential Failure Mode and Control Analyst

Traces supplied potential failure modes, evidence, detection controls, actions and verification without risk acceptance.

- initiating condition and progression
- evidence for and against
- surveillance/control objective
- action owner and verification

Reconcile:

- failure-mode wording is source-bound
- controls do not substitute for evidence
- closure requires verification

Stop when:

- unapproved failure mode requested
- probability/risk decision requested
- emergency activation requested

### Dam Safety Surveillance Review Owner

Joins configuration, inspection, instrumentation and failure-mode/control evidence into a qualified dam-safety review pack.

- facility/version/datum alignment
- condition-behavior correlation
- evidence for/against failure modes
- qualified action and escalation queue

Reconcile:

- all locations and instruments resolve
- thresholds come only from approved sources
- safety/risk decisions remain decision_not_made

Stop when:

- facility baseline unresolved
- material unexplained behavior
- qualified dam-safety owner absent

Run the root branches independently. The join starts only after all roots return or explicitly stop. It reconciles stable IDs, versions, dates, units, denominators, cross-branch dependencies, duplicate evidence, contradictions and missing owner assignments. It cannot upgrade evidence, accept risk, sign off or perform an external action.

## Reusable assets

- `assets/dam-facility-design-authority-consequence-baseline.md`: Freeze facility identity, configuration, design/modification and responsible authorities. Required domain fields: dam_id, component_id, dam_type_material, station_offset_elevation_datum, design_document_revision, modification_id_revision, owner_regulator, consequence_status_as_supplied.
- `assets/dam-inspection-condition-defect-ledger.md`: Preserve location-specific condition observations and comparable baselines. Required domain fields: inspection_id, component_location, observation_type, dimension_value_unit, photo_survey_NDE_locator, loading_weather_context, baseline_comparison, observation_limit.
- `assets/dam-instrumentation-surveillance-trend-register.md`: Trace measurement-system health and behavior evidence. Required domain fields: instrument_id_type_location, datum, calibration_maintenance_status, raw_reading, conversion_version, engineering_value_unit, timestamp_timezone, reservoir_weather_loading_context, quality_flag.
- `assets/dam-potential-failure-mode-control-action-register.md`: Map supplied failure-mode evidence, controls and action verification. Required domain fields: pfm_id_version, initiating_condition, progression, evidence_for, evidence_against, detection_control, consequence_path, action_owner, verification_evidence.
- `assets/dam-safety-surveillance-qualified-review-pack.md`: Reconcile condition, behavior, failure-mode and control evidence for qualified review. Required domain fields: facility_baseline, inspection_status, instrument_status, behavior_questions, pfm_questions, urgent_escalations, decision_not_made, qualified_owner.

Read each selected asset before producing output. Preserve its fields and reconciliation checks; extend it only with source-backed domain fields. Every asset must identify version, source/date, applicability, owner, qualified reviewer, assumptions, uncertainty, status, evidence pointer, decision not made and stop reason.

## Stop and escalation

Stop on identity conflict, missing authority, incompatible versions, unresolvable units or denominator, unverifiable source, unauthorized personal/confidential data, material evidence contradiction, or any request for a reserved action. Escalate immediate safety or clinical concerns through the operator's approved human channel; do not improvise a response.

## Sources and adaptation boundary

Read `references/SOURCE-PROVENANCE.md` and `references/PRIMARY-SOURCES.md` before relying on a method or current requirement. Clean-room method. Rejected vamseeachanta/workspace-hub@6a1d0181386633cc11e53be6a03bd1a48b36ae93 archived geotechnical Skill because no applicable repository license/NOTICE closes reuse and its offshore foundation scope does not cover dam inspection, instrumentation or failure-mode governance. Retained: none; no candidate text copied. Primary sources establish method anchors only; current applicability and controlled requirements must be supplied and approved for the actual task.
