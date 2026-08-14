---
name: medical-imaging-quality-assurance-method
description: Prepare source-bound imaging equipment, protocol, phantom technical quality-control, DICOM workflow, display-chain, dose-index, nonconformance, and qualified-review evidence when an imaging quality team needs audit support without operating systems or making clinical decisions.
---

# Medical Imaging Quality Assurance Method

## Freeze the authorized quality-assurance scope

Record scope ID, facility, modality, manufacturer/model/serial, software and configuration version, detector or coil, protocol ID/version, phantom and quality-control procedure, acquisition date, display/PACS path, jurisdiction, cutoff, source owners, privacy classification, and qualified reviewers. Accept only authorized local records and minimized Digital Imaging and Communications in Medicine (DICOM) metadata. Keep equipment configuration, observed measurement, derived value, owner-supplied tolerance, technical disposition, clinical interpretation, and regulatory decision separate.

State `decision_not_made`: no diagnosis; image or examination clinical accept/reject; patient-specific dose or risk judgment; acquisition, rescan, protocol, display, routing, de-identification, service, or return-to-use decision; accreditation or compliance claim. Never connect to or operate a scanner, Picture Archiving and Communication System (PACS), Radiology Information System (RIS), workstation, dose system, or service console.

## Reconcile equipment, protocol, and configuration

Create immutable IDs for device, detector, software/configuration, protocol, phantom, display, test procedure, and measurement event. Retain supplied effective intervals and change records. A protocol name alone is not a configuration: cross-link modality, body region or test use, acquisition parameters, reconstruction or processing version, detector/coil, and owner-approved baseline. Preserve missing or conflicting configuration evidence rather than choosing a value.

Separate manufacturer specification, facility baseline, service measurement, phantom measurement, and clinical-image observation. Do not import generic tolerances or infer acceptance from a manufacturer's statement. Changes require a traceable request, approval, implementation evidence, post-change test, reviewer, and decision state.

## Evaluate phantom and technical QC evidence

For each test retain phantom identifier/version, setup and geometry, environmental conditions when supplied, procedure/version, acquisition and processing settings, raw observation, unit, calculation formula/version, result, uncertainty, supplied tolerance source/version/effective date, comparison state, anomaly, and reviewer. Recompute only when all operands and units are traceable. Examples of source-bound calculations include:

- `difference = observed - baseline`
- `relative_difference = (observed - baseline) / baseline`, only with a valid nonzero compatible baseline
- `coefficient_of_variation = standard_deviation / mean`, only for an approved repeated-measure set
- trend slope only under an approved method with comparable device, setup, procedure, and processing versions.

A tolerance comparison is evidence for qualified review, not a pass/fail or return-to-service decision. Never invent thresholds, interpolate omitted limits, or treat one phantom metric as image quality for a patient.

## Trace DICOM, routing, and display integrity

Preserve Study/Series/Instance relationships, SOP Class, transfer syntax, frame count, pixel spacing, orientation, photometric interpretation, lossy-compression state, derived/source relationships, and original locator without exposing Protected Health Information (PHI). Record tag presence and supplied values; do not infer semantic correctness from presence. Do not alter, render, transcode, route, export, delete, or de-identify instances.

Reconcile sent, received, stored, displayed, and archived inventories through authorized identifiers and logs. Keep missing, duplicate, rejected, transformed, or unmatched instances explicit. For display evidence retain workstation/display ID, calibration and test source/version, luminance or other supplied unit, ambient condition, timestamp, path, and reviewer. A complete transfer does not prove diagnostic display suitability, and metadata consistency does not prove clinical adequacy.

## Handle dose-index and nonconformance evidence

Record modality-specific dose index exactly with unit, phantom/size or protocol context, device, acquisition event, calculation or extraction source, and uncertainty. Never describe an equipment-reported index as patient absorbed dose. Diagnostic Reference Levels (DRLs) are review references, not individual limits; use only an owner-supplied, applicable, versioned reference. Keep protocol mix, patient or phantom context, equipment change, and sample selection visible before trending.

Link nonconformance, service ticket, configuration change, retest, recurrence, corrective and preventive action (CAPA), and closure evidence without fabricating causation. Preserve unresolved conflicts. Trend counts or rates only with a defined eligible population and stable categorization; a decline does not prove effectiveness.

## Join and escalate

Populate exactly the five files under `assets/`. Every material entry includes stable identity, source locator/version/date, cutoff/effective date, value/unit/denominator, owner, qualified reviewer, applicability/jurisdiction, assumptions, uncertainty, privacy/license boundary, status, `decision_not_made`, and stop/escalation. Cross-link every claim to device/configuration/protocol/procedure versions and source rows.

Stop on unauthorized PHI, unverifiable sources, unknown units, mixed device/configuration/protocol/procedure versions, inaccessible raw evidence, unresolved DICOM identity conflicts, unsupported tolerance, missing denominator, or a request to operate or change a clinical system. Route clinical interpretation to a radiologist; QC and dose physics to a qualified medical physicist; acquisition evidence to a qualified technologist; service to the authorized engineer; DICOM/PACS questions to the system administrator; radiation safety, privacy, accreditation, and regulatory judgments to their designated owners.

Read `references/UPSTREAM.md`, `references/ADAPTATION.md`, `references/LICENSE.md`, and `references/PRIMARY-SOURCES.md`. The method is a bounded modification of provenance and de-identification cautions from the pinned K-Dense MIT pydicom Skill. It contains no upstream installation, scripts, DICOM read/write/render/de-identification procedure, package-version advice, diagnosis, or compliance conclusion.
