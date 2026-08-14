---
name: aviation-maintenance-reliability-method
description: Build traceable aircraft configuration, maintenance reliability, and due-work evidence packs. Use for fleet reliability review, life-limit reconciliation, repeat-defect analysis, maintenance-program traceability, and authorized continuing-airworthiness preparation without prescribing maintenance or approving return to service.
---

# Aviation Maintenance Reliability Method

## Freeze the basis

1. Record aircraft/fleet identity, serialized configuration, operator and supplied jurisdiction, program basis, evidence/utilization cutoff, time zone, flight-hour/cycle/calendar units, approved-data revisions, confidentiality and qualified owners.
2. Assign stable IDs to aircraft, assemblies, serialized components, positions, records, events, tasks, sources and decisions. Preserve source version, effective date and custodian.
3. Run configuration/records, reliability, and planning branches independently; join only complete source-addressable results.

## Apply the method

- Reconstruct installed configuration as a dated graph. Calculate remaining life only from an operator-supplied approved limit minus accumulated value in the same unit and at the same cutoff.
- Mark task, Airworthiness Directive and Service Bulletin applicability as reported, supported, conflicting, unknown, or qualified-review-required. Never decide applicability.
- Deduplicate events by a declared key. Report rate as unique eligible events divided by matching flight hours or cycles and a declared scale. Stratify by configuration and observation window; show denominator drift.
- Apply repeat definitions and alert/control limits only when supplied with an owner and version. Do not infer causal failure modes from correlation.
- Calculate due status only from supplied approved interval, last accomplishment, applicable tolerance and compatible calendar/hour/cycle basis. Keep current status separate from forecast scenarios.
- Use Weibull, mean-time-between-failure, B10, control charts or P-F intervals only when the necessary population, censoring, baseline and distribution assumptions are documented; otherwise record the method as unsupported.

## Produce evidence

Use all five assets: the configuration/life ledger, maintenance-event reliability register, program/task/AD/SB trace, due/deferred-work register, and final decision pack. Every material row carries ID, unit, source/version/date, owner/reviewer, applicability, uncertainty, assumptions and decision status.

Stop on ambiguous identity, uncontrolled data, broken record continuity, mixed units, missing applicability/revision authority, irreconcilable exposure, or privacy restrictions. Do not manufacture missing values.

## Review discipline

- Keep aircraft, engine, auxiliary-power-unit and serialized-component configuration revisions separate until an authorized owner supplies an equivalence rule.
- Preserve event occurrence, report, maintenance action, installation/removal, record creation and record amendment timestamps independently with time zones.
- Reconcile every rate and remaining-life value back to exact event, exposure and approved-limit IDs. A blank denominator or carry-forward source blocks the metric.
- Treat shop findings, no-fault-found records, repeat labels and reliability alerts as attributed evidence. Record supporting and contradicting records before proposing a qualified review question.
- Keep current due status, forecast due crossing, resource feasibility and authorized operational disposition as four different states. A planning scenario never changes the approved record.
- At the join, retain dissent and revision conflicts; name the record owner, qualified reviewer, evidence still needed and exact decision that remains human-owned.

## Authority boundary

Do not troubleshoot or direct maintenance, change an interval or program, interpret an AD/SB/MEL/CDL, approve a deferral, certify a part or record, dispatch an aircraft, or approve return to service. Require current approved data and authorized maintenance, engineering, reliability, quality, records and continuing-airworthiness review.

This is a clean-room method. Read [source record](references/sources.md) for public method inputs and rejected Skill decisions; do not copy rejected Skill text.
