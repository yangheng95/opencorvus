# Robot system, application boundary and requirement register

## Control header

- Template ID: `RSV-REQ-TEMPLATE-001`
- Purpose: Freeze the exact application configuration, tasks, modes, lifecycle, interfaces and requirement evidence.
- Quantity and unit rule: record every numeric value with unit, denominator, reference frame, tolerance and basis; use `not applicable` only with an explanation.
- Source rule: record immutable locator, document or dataset version, effective/test date and evidence cutoff.
- Owner: named application evidence owner.
- Qualified reviewer: named robot or machine-safety specialist with role and review date.
- Applicability: identify facility, jurisdiction, robot/application configuration, task, mode and lifecycle phase.
- Assumptions: list only authorized assumptions and their source.
- Uncertainty/confidence: state measurement, model, coverage and interpretation limitations; never convert confidence into safety acceptance.
- Privacy/license boundary: identify restricted operational data and third-party material.
- Status: draft, evidence-present, contradicted, unresolved, or qualified-review-complete.
- Decision not made: no PL/Category/SIL achievement, residual-risk acceptance, commissioning, release or compliance decision.
- Stop/escalation: stop on missing configuration, source, acceptance basis, calibration, authority or a material contradiction.

## Evidence rows

| requirement or interface ID | system/application configuration | task/mode/lifecycle phase       | people and access    | energy/tool/material    | interface and external equipment | requirement statement     | source locator/version/date  | value/unit/basis    | owner      | qualified reviewer            | applicability         | assumptions | uncertainty/confidence | privacy/license boundary | status | decision-not-made | stop/escalation |
| --------------------------- | -------------------------------- | ------------------------------- | -------------------- | ----------------------- | -------------------------------- | ------------------------- | ---------------------------- | ------------------- | ---------- | ----------------------------- | --------------------- | ----------- | ---------------------- | ------------------------ | ------ | ----------------- | --------------- |
| RSV-REQ-001                 | _controlled entry required_      | _do not infer missing evidence_ | _record exact basis_ | _link immutable source_ | _name accountable owner_         | _name qualified reviewer_ | _state application boundary_ | _state uncertainty_ | unresolved | no professional decision made | stop pending evidence |

## Completion procedure

Create one row per independently reviewable claim; do not combine different configurations, modes, people, hazards, safety functions or tests. Link rows by stable identifiers. Keep expected and observed values separate. When a source changes, add a new row or version rather than overwriting history. Attach or link raw evidence; a summary is not a substitute for test output, configuration export, calibration record or signed review.

Reconcile this asset against the other four package assets. Record duplicate IDs, orphan requirements, hazards without measures, safety functions without configuration or tests, tests without authorized acceptance sources and decisions that lack qualified reviewers. Preserve contradictions exactly and identify consequence, owner and due evidence. A complete-looking table does not authorize live work or establish safety.

## Required review questions

1. Is the application/configuration identity exact and consistent across sources?
2. Are units, tolerances, frames, modes, lifecycle phases and evidence dates explicit?
3. Is every inference distinguishable from an observed fact or supplied claim?
4. Are test conditions and limitations sufficient for reproducibility?
5. Does each unresolved issue name a qualified resolver and stop condition?
6. Has the reviewer avoided robot commands, configuration changes, safeguard bypass, threshold invention and risk acceptance?

## Controlled closeout

The owner signs only for record completeness and provenance. The qualified reviewer records disposition in the authoritative engineering system. If the evidence is restricted, store only the approved locator and classification here. Never paste credentials, personal data, protected standard text or live-control details. Retain superseded rows according to the authorized configuration-management policy.
