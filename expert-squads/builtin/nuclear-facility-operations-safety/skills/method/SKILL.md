---
name: nuclear-facility-operations-safety-method
description: Prepare source-grounded nuclear-facility configuration, design/licensing-basis, plant-state, defence-in-depth, safety-function, barrier, event, corrective-action, and operating-experience evidence. Use for bounded nuclear operations-safety reviews requiring licensed and qualified human decisions; never use for reactor control, operability, reportability, dose, emergency classification, work instruction, modification, startup, shutdown, compliance, or risk acceptance.
---

# Nuclear Facility Operations Safety Method

## Freeze facility state and authority

1. Record facility, unit, jurisdiction/license, plant state/mode, timestamp/time zone, evidence cutoff, authorized security/safeguards boundary, accountable licensee owner and excluded decisions.
2. Establish stable IDs for Structures Systems and Components (SSCs), safety functions, barriers, controlled documents, requirements, modifications, temporary changes, work, surveillance/tests, alarms, events, notifications and corrective actions. Refuse ambiguous joins.
3. Preserve unit, source locator and authority, source version/effective date, observation date, owner, licensed/qualified reviewer, applicability, uncertainty, status, `decision_not_made` and `stop_or_escalation` for every record.
4. Use only current licensee/regulator-controlled safety classifications, limits, success criteria, barrier credit, reporting criteria and prioritization. Never invent thresholds, probabilities or risk scores.

Start with [the configuration/design-basis register](assets/nuclear-facility-configuration-design-basis-register.md).

## Reconcile configuration in three directions

1. Trace each design or licensing requirement to exact document section and affected SSC/function.
2. Link it independently to authorized physical-configuration evidence and to current controlled facility documents. Keep requirement ↔ physical state ↔ document alignment visible.
3. Trace permanent/temporary changes through supplied authorization status, affected documents/SSCs, implementation/work evidence, testing, restoration and closure evidence. Do not infer as-built state from a drawing or approval from implementation.
4. Record discrepancy where IDs, boundaries, plant state, revisions, effective periods or evidence conflict. Never select a controlling source without qualified licensee authority.
5. Store records in the configuration register and plant-state rows in [the operating-limit/surveillance ledger](assets/plant-state-operating-limit-surveillance-ledger.csv).

## Map defence in depth without crediting it

1. Use the facility-supplied framework to map safety function → challenge/initiating condition → credited SSC/barrier/control as supplied → availability evidence → support dependency → common-cause/spatial interaction → failure evidence/unknown → owner.
2. Keep prevention, control and mitigation layers distinct. Preserve independence, redundancy, diversity and qualification claims only with current approved analysis.
3. Treat design intent, physical status, test result, alarm state and work record as different evidence classes. Absence of a failure/alarm does not prove availability.
4. Do not simulate plant response, set success criteria, credit a barrier, determine operability, prescribe compensatory action or calculate nuclear risk.
5. Use [the defence-in-depth map](assets/defence-in-depth-safety-function-barrier-map.md).

## Reconstruct event and operating experience

1. Build an immutable chronology from logs, alarms, process/computer data, work/test records, communications and corrections. Retain original timestamps and sources.
2. Separate observed fact, contemporaneous assessment, preliminary investigation, approved conclusion, candidate contributor and counterevidence. Do not force one root cause.
3. Link event → plant state → challenged function/barrier → response already recorded by authorized personnel → notification/report status as supplied → investigation/extent of condition → corrective action → verification evidence.
4. Apply external operating experience only after facility, design/technology, SSC, mode, initiating condition and time applicability are documented.
5. Preserve the chain in [the event and operating-experience log](assets/nuclear-event-operating-experience-corrective-action-log.md). Never determine classification, reportability or restart readiness.

## Join independently produced evidence

1. Require all three branch artifacts, exact versions/hashes, one compatible facility/unit/plant-state/time baseline and current controlled-source authority.
2. Join through stable SSC/function/barrier/event/change/action keys only. Create contradiction records instead of resolving incompatible design, physical, document, status or event evidence.
3. Limit options to obtaining a current source, reconciling IDs/versions, re-baselining evidence, qualified specialist review, monitoring or verifying an already authorized control/action.
4. Record source need, existing control, dependency, owner, licensed/qualified reviewer, date, applicability, uncertainty, status, decision authority and stop condition.
5. Complete [the integrated review pack](assets/nuclear-facility-operations-safety-review-pack.md). The agent never completes a human decision field.

## Stop and retain nuclear authority

Stop for identity/version/plant-state conflict; missing approved criteria; active abnormal/emergency condition; live control request; protected security/safeguards information; or any output that could imply operability, Technical Specification/Limiting Condition for Operation applicability, emergency class, reportability, authoritative dose, configuration acceptance, work/test instruction, modification/startup/shutdown approval, compliance or risk acceptance.

Never operate or advise operation; change reactivity, power, setpoints or alignment; bypass/isolate equipment; credit a barrier; determine operability; issue a notification; direct emergency/work/testing response; or approve/accept nuclear safety. Require licensed operator/shift manager, configuration/system/design engineering, maintenance/work control/testing, radiation protection, fire/protection, quality/event investigation, independent nuclear safety review, emergency director, licensee management and regulator.

## Sources and clean-room boundary

Read [sources and clean-room boundary](references/sources.md) before selecting authority. This method is clean-room authored. The reviewed energy-expert Skill concerned smart-grid monitoring/control, not nuclear safety, and was rejected. No upstream Skill text, code, threshold or live-control behavior was copied.
