---
name: bridge-structural-integrity-assurance-method
description: Bridge asset configuration, element inspection, defect, load-rating, scour, fatigue, maintenance-action and independent QC/QA evidence assurance without posting, closure or engineering-release authority. Use for Select for bridge identity/configuration, element condition, inspection findings, load-rating inputs/results, scour, fatigue/fracture evidence, maintenance actions or independent QC/QA. Do not select to rate, post, close, reopen, permit loads, control traffic or approve repair.
---

# Bridge Structural Integrity Assurance Method

## Purpose and authority

Produce a reproducible evidence pack for qualified review. This Skill never converts incomplete evidence into permission, safety, compliance, diagnosis, release, filing or operational authority.

- Do not assign condition codes or load ratings, post/restrict/close/reopen a bridge, approve overweight movement or direct traffic.
- Do not design or approve repair, strengthening, scour countermeasure or inspection interval; do not operate inspection or traffic-control equipment.
- Qualified bridge program managers, team leaders, load raters, registered structural/geotechnical/hydraulic engineers and owners retain decisions.

## Freeze the review baseline

Before analysis, freeze:

- bridge/structure/span/element IDs, owner, route, geometry, material and current as-inspected configuration
- design/as-built/rehabilitation/damage-event and inspection-manual revisions
- inspection type/date, loading, hydraulic/scour and environment evidence cutoff
- program manager, team leader, load rater, structural/geotechnical/hydraulic and independent QA authorities

Give every source, object, event, observation and decision question a stable ID. Record source owner, exact locator, source version, effective/retrieval/observation dates, applicability, unit and denominator, evidence cutoff, privacy/license boundary and qualified reviewer. If two branches use incompatible identity, period, unit or source versions, stop reconciliation rather than normalize silently.

## Domain evidence method

1. Freeze a component hierarchy from bridge through span, member, connection, bearing, deck, substructure and foundation; preserve unknown plans, undocumented modifications and damage events as gaps.
2. Record inspection observations by element and reproducible location with material, defect type, extent, dimension/unit, image/NDE locator, access/visibility limitation, environment and comparable prior observation. Do not assign a condition code without authority.
3. For load-rating evidence, preserve model/software version, geometry, material properties, deterioration assumptions, loads, boundary conditions, distribution, analysis method, controlling member and result as supplied. Do not recompute or approve a rating unless explicitly authorized by the load rater.
4. Keep scour, fatigue/fracture and impact evidence in distinct lanes with hydraulic/bed survey, detail/cycle, NSTM/fracture-critical, event and inspection capability context.
5. Trace maintenance/restriction recommendations as supplied through owner, implementation, inspection and verification. Quality control and independent quality assurance remain separate reviews and never become traffic authority.

Maintain five states: `observed`, `supplied_interpretation`, `derived`, `hypothesis`, and `decision_not_made`. Every derived value records formula, inputs, units, denominator and computation version. Every conflict retains both source records and a qualified resolution owner. Absence, silence and failed retrieval are never positive evidence.

## Parallel branches and join

### Bridge Asset Configuration Authority Analyst

Freezes bridge/span/element identity, records, modifications, inspection program and professional authority.

- asset and element hierarchy
- design/as-built/rehabilitation records
- damage and modification chronology
- inspection/manual/owner authority

Reconcile:

- element IDs are unique
- records match current configuration
- unknown plans remain explicit

Stop when:

- bridge identity conflict
- unresolved modification
- inspection authority absent

### Bridge Inspection Condition Defect Analyst

Maps material and element observations to reproducible locations, dimensions, evidence and limitations.

- deck/superstructure/substructure/foundation observations
- corrosion/cracking/section loss/deformation/movement
- photo/NDE/access evidence
- prior-observation comparison

Reconcile:

- location and units reproducible
- observed and inferred states separated
- comparison uses compatible inspection method

Stop when:

- unlocated critical finding
- access limitation hides required area
- immediate public-safety observation

### Bridge Load Rating Scour and Fatigue Analyst

Traces supplied analysis models, loads, scour, fatigue/fracture and controlling evidence without engineering decisions.

- model/input/version provenance
- load-rating result as supplied
- hydraulic/bed/scour evidence
- fatigue/fracture/impact evidence

Reconcile:

- input/output model trace complete
- units and configuration align
- rating and scour status are not inferred

Stop when:

- model baseline absent
- material or geometry conflict
- rating/posting decision requested

### Bridge Maintenance Action QC QA Analyst

Traces findings, owner actions, restrictions as supplied, repair evidence, verification and independent QC/QA.

- finding-to-action trace
- temporary/permanent measure evidence
- implementation and verification
- QC versus independent QA

Reconcile:

- closure has field evidence
- QA reviewer is independent
- traffic action source is authorized

Stop when:

- unverified closure
- same reviewer claims independence
- live traffic or repair action requested

### Bridge Structural Integrity Review Owner

Joins asset, inspection, analysis and action/QC-QA evidence into a qualified bridge-owner review pack.

- configuration alignment
- defect-analysis correlation
- critical finding/action trace
- independent review queue

Reconcile:

- every finding resolves to an element
- analysis uses current condition
- posting/closure/repair remain decision_not_made

Stop when:

- configuration unresolved
- critical evidence gap
- qualified bridge authority unavailable

Run the root branches independently. The join starts only after all roots return or explicitly stop. It reconciles stable IDs, versions, dates, units, denominators, cross-branch dependencies, duplicate evidence, contradictions and missing owner assignments. It cannot upgrade evidence, accept risk, sign off or perform an external action.

## Reusable assets

- `assets/bridge-asset-configuration-authority-baseline.md`: Freeze bridge, span, element, record and authority identity. Required domain fields: bridge_id, span_element_id, route_owner, geometry_material, design_asbuilt_revision, rehabilitation_modification_id, damage_event, inspection_program_revision.
- `assets/bridge-inspection-element-condition-defect-ledger.md`: Preserve element observations and limitations. Required domain fields: inspection_id_type, element_location, material, defect_observation, extent_dimension_unit, photo_NDE_locator, access_visibility_limit, prior_comparison.
- `assets/bridge-load-rating-scour-fatigue-evidence-register.md`: Trace supplied structural/hydraulic/fatigue analysis evidence. Required domain fields: analysis_id_version, configuration_date, model_software, loads_and_units, material_geometry_assumptions, boundary_distribution, controlling_result_as_supplied, scour_fatigue_evidence.
- `assets/bridge-maintenance-restriction-qcqa-action-register.md`: Trace findings through owner-controlled action and independent verification. Required domain fields: finding_id, action_or_restriction_as_supplied, authority_source, work_order_design_revision, implementation_evidence, verification, QC_reviewer, independent_QA_reviewer.
- `assets/bridge-structural-integrity-qualified-review-pack.md`: Present configuration, findings, analysis and actions for authorized decisions. Required domain fields: asset_baseline, inspection_status, analysis_status, critical_findings, action_verification, QA_questions, decision_not_made, owner_authority.

Read each selected asset before producing output. Preserve its fields and reconciliation checks; extend it only with source-backed domain fields. Every asset must identify version, source/date, applicability, owner, qualified reviewer, assumptions, uncertainty, status, evidence pointer, decision not made and stop reason.

## Stop and escalation

Stop on identity conflict, missing authority, incompatible versions, unresolvable units or denominator, unverifiable source, unauthorized personal/confidential data, material evidence contradiction, or any request for a reserved action. Escalate immediate safety or clinical concerns through the operator's approved human channel; do not improvise a response.

## Sources and adaptation boundary

Read `references/SOURCE-PROVENANCE.md` and `references/PRIMARY-SOURCES.md` before relying on a method or current requirement. Clean-room method. Rejected zwright8/OpenClaw-Code@ec1b3b08616195dbe709f116bcfc092c009bb753 theater autonomous bridge inspection Skill because no license/NOTICE closes reuse and its military autonomous passage-ranking authority is incompatible. Rejected unlicensed workspace-hub offshore structural Skill. Retained: none; no candidate text copied. Primary sources establish method anchors only; current applicability and controlled requirements must be supplied and approved for the actual task.
