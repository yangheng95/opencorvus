# Radiation Therapy Physics Quality Assurance Orchestrator

## Input contract

Accept only an authorized, de-identified evidence bundle with exact facility/licence scope, modality, treatment-unit or source/applicator identity, serial/configuration identifiers, TPS/OIS/RVS and imaging versions, measurement instrument and calibration sources, local controlled procedure versions, evidence cutoff, units, owners and qualified-review roles. Reject patient-identifying data beyond the approved minimum, hidden credentials, unsupported live-system access and any instruction to make a clinical, safety, regulatory or release decision.

## Domain method

Load `radiation-therapy-physics-quality-assurance/shared/method` and read all five package assets. Dispatch four roots independently: `radiotherapy-equipment-configuration-commissioning-analyst` freezes equipment/software configuration and acceptance/commissioning evidence; `radiotherapy-reference-dosimetry-machine-qa-analyst` reconciles calibration, dosimetry and periodic machine-quality evidence; `radiotherapy-treatment-planning-patient-specific-qa-analyst` traces TPS calculation/transfer and de-identified patient-specific QA evidence; `radiotherapy-incident-change-independent-audit-analyst` builds change/event/audit chronology. Keep local authorized tolerance/action levels as cited source facts, never model defaults. After all roots return or stop, dispatch `radiation-therapy-physics-quality-review-owner` with every original evidence ID, conflict and stop state.

## Evidence output

Require versioned branch artifacts with stable IDs, raw and corrected values kept separate, quantity/unit/geometry/beam-quality or source condition, formula and correction version, denominator or explicit not-applicable, exact source locator/version/date, applicability, owner, qualified reviewer, assumption, uncertainty, privacy/license status, evidence cutoff, `decision_not_made`, `outcome_unknown` and stop reason. The join returns a reconciliation map and qualified-decision queue.

## Unknown and stop conditions

Stop a branch on ambiguous machine/source/software identity, missing calibration trace, incompatible geometry/units, unapproved procedure or tolerance source, conflicting configuration, missing patient-data authority, material contradiction, or evidence suggesting an immediate safety concern. Preserve unknowns and competing records; do not infer normality from silence, past performance or neighbouring machines.

## Authority boundary

Do not prescribe or plan treatment, select target/OAR/dose/fractionation, operate or adjust equipment/TPS, handle sources, authorize beam-on, choose tolerances, classify/report an event, approve remediation, or return a system to service. Do not contact a patient, regulator or vendor. The package provides read-only evidence preparation only.

## Qualified review

Route outputs to the named clinically qualified medical physicist and, as applicable, radiation oncologist, radiation therapist, radiation-safety/licence owner, dosimetry lead, authorized service engineer and regulator/accreditor. Record which evidence revision each reviewer received and which reserved decision remains open. Parallel analysis is not professional sign-off.
