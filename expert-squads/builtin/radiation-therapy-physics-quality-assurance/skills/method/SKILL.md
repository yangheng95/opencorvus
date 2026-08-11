---
name: radiation-therapy-physics-quality-assurance-method
description: Builds source-bound radiotherapy equipment, commissioning, reference dosimetry, machine-quality, TPS, patient-specific QA, change, incident and independent-audit evidence packs. Use for qualified medical-physics review preparation, never treatment planning, beam-on, tolerance selection, event classification or return-to-service.
---

# Radiation Therapy Physics Quality Assurance Method

## Purpose and authority

Produce reproducible evidence for qualified medical-physics review. Never convert a completed template or apparent agreement into permission to treat, evidence of safety, calibration validity, regulatory compliance or release authority.

- Do not prescribe, delineate, optimize or approve a treatment plan; do not select dose, fractionation, beam arrangement, targets, organs at risk or clinical constraints.
- Do not operate or adjust a treatment unit, source, applicator, imaging system, TPS, OIS or RVS; do not authorize beam-on or return-to-service.
- Do not choose tolerance/action levels, classify a medical event, contact a patient/regulator/vendor, submit a report or approve corrective action.
- Reserve decisions to clinically qualified medical physicists, radiation oncologists, radiation therapists, radiation-safety/licence owners and authorized service/regulatory reviewers.

## Freeze the physics baseline

Before analysis, freeze facility and licence scope; modality; treatment-unit/source/applicator/accessory identity; serial and configuration state; TPS algorithm, beam/model/data set, grid and commissioned-use limitations; OIS/RVS/imaging and transfer versions; measurement instrument, calibration certificate and traceability; controlled procedure and locally authorized criterion versions; evidence cutoff; privacy authority; owner and qualified-review map.

Assign stable IDs to every object, configuration, measurement, case, change, event, audit item and decision question. Record exact source locator, source owner, version, effective/observation/retrieval date, quantity and unit, geometry/reference basis, formula/correction version, applicability, privacy/license, assumption and uncertainty. Keep raw observation, corrected value, supplied interpretation, derived check, hypothesis and `decision_not_made` separate. Never treat silence, missing records or failed retrieval as positive evidence.

## Field procedure

1. Build an equipment/software dependency graph. Distinguish procurement specification, factory evidence, installation, acceptance, commissioning, periodic QA and clinical-use state. Bind every machine mode, source/applicator, accessory, imaging chain, TPS model and OIS/RVS interface to a controlled configuration revision.
2. For acceptance and commissioning, trace each test to the authorized procedure, instrument/calibration source, setup/geometry, raw observation, correction inputs, derived result, local criterion source and independent check. Acceptance does not imply commissioning; commissioning does not imply current clinical release.
3. For reference dosimetry and machine quality, preserve beam quality/source condition, reference point, field or applicator geometry, environmental conditions, instrument coefficients and correction formula/version. Keep reference, relative and routine performance measurements distinct. Compare only against the exact locally authorized criterion revision.
4. For TPS and patient-specific quality, trace TPS configuration and calculation object through export/transfer/RVS representation to independent calculation or measurement. Preserve de-identified case/revision, algorithm/model/data set, detector/phantom/setup and evaluation-method version. Do not evaluate clinical prescription or acceptability.
5. For change and incidents, construct chronology from observations and controlled records. Link each hardware/software/data/procedure change to affected commissioning and QA evidence. Keep causal hypotheses separate from authorized conclusions. For independent audits, preserve requested evidence, sample identity, finding as supplied, response and closure authority.
6. Reconcile branches only by stable identity, comparable configuration, unit and procedure. If configurations, geometry, criteria or dates differ, mark noncomparable. Retain both sides of contradictions and assign a qualified resolution owner.

## Parallel branches and join

### Equipment Configuration and Commissioning Analyst

Freeze treatment-unit/source/software/interface versions; separate acceptance from commissioning; trace configured modes, accessories and limitations to procedures, measurements and independent verification. Stop on unknown serial/version, configuration drift, uncontrolled data/model, missing calibration evidence or live-device action.

### Reference Dosimetry and Machine Quality Analyst

Reconcile instrument traceability, beam/source identity, raw and corrected readings, setup, environmental factors, formula versions, periodic tests and cited local criteria. Stop on unit/geometry ambiguity, missing calibration, undocumented correction, noncomparable conditions or unexplained drift.

### Treatment Planning and Patient-Specific Quality Analyst

Trace de-identified TPS calculation, plan/export, transfer/RVS and independent measurement/check evidence under one controlled configuration. Stop on privacy breach, missing plan revision, model mismatch, broken transfer trace or absent local criterion. Never approve a plan.

### Incident Change and Independent Audit Analyst

Build evidence chronology for configuration changes, maintenance, events and independent audits. Preserve observations, hypotheses, findings and authorized decisions separately. Stop on uncontrolled change, missing chronology, unsafe request, privacy breach or requested event classification.

### Radiation Therapy Physics Quality Review Owner

Start only after all roots return or explicitly stop. Reconcile configuration, dosimetry, TPS/case, change/event and audit records; verify cross-branch version alignment; retain contradictions and stopped branches. Produce a review pack and reserved-decision queue, never acceptance, compliance or release.

## Reusable assets

- `assets/radiotherapy-facility-equipment-software-authority-baseline.md`: facility/licence, modalities, machine/source/applicator, software/interface configuration, authorized procedures and role map.
- `assets/radiotherapy-commissioning-reference-dosimetry-machine-qa-ledger.csv`: acceptance/commissioning, instrument calibration, reference dosimetry and periodic machine-quality evidence.
- `assets/radiotherapy-treatment-planning-patient-specific-qa-register.md`: TPS configuration, calculation/transfer trace and de-identified patient-specific QA evidence.
- `assets/radiotherapy-change-incident-independent-audit-register.md`: change chronology, affected configurations, incidents, audit requests/findings and response evidence.
- `assets/radiation-therapy-physics-qualified-review-pack.md`: cross-branch trace, contradictions, missing evidence and qualified-decision queue.

Read every selected asset before output. Preserve its stable identity, source/version/date, cutoff, value/unit/reference basis, owner/reviewer, applicability, assumptions, uncertainty, privacy/license, status, `decision_not_made`, `outcome_unknown` and stop/escalation fields.

## Conflict handling and stop boundary

Do not average, normalize or select a favourable source to resolve disagreement. Record the competing IDs, configuration/procedure versions and consequence of nonresolution. Stop on identity conflict, unresolvable unit/geometry, unverifiable source, missing authority, patient-data exposure, material contradiction, uncontrolled change, request for a reserved action or possible immediate safety concern. Escalate through the operator's approved human channel without generating operational instructions.

## Sources and clean-room boundary

Read `references/SOURCE-PROVENANCE.md` and `references/PRIMARY-SOURCES.md` before relying on a method or current requirement. This is clean-room OpenCorvus authorship. The rejected CaseMark treatment-planning Skill contains clinical dose/fractionation and constraint behaviour outside this evidence boundary; no text, formula, threshold, table, code or workflow is copied. Primary references anchor the field decomposition only. The operator must supply and qualified reviewers must approve the current local licence, procedure, tolerance and regulatory basis.
