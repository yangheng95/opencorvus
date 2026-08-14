# Risk, Control Objective, Design and Walkthrough Trace Matrix

## Reusable evidence contract markers

- artifact_id: stable artifact or row identity
- source_id_locator: exact authoritative source locator
- source_version_date: immutable source version and applicable date
- qualified_reviewer: named discipline reviewer with decision authority
- units_and_denominator: value, unit, currency, population and denominator or not-applicable rationale
- assumptions_uncertainty: authorized assumptions, unknowns, confidence and reason
- decision_not_made: explicit professional decisions this artifact does not make
- outcome_unknown: unresolved outcome stated without inference
- stop_escalation: exact hold point, reason, escalation owner and required review

## Record control

- artifact_id:
- engagement_id / auditable_unit_id:
- criteria_source_locator / version / date:
- cutoff_or_effective_date:
- owner:
- qualified_reviewer:
- applicability / jurisdiction:
- privacy_confidentiality_license_state:
- assumptions:
- uncertainty_confidence:
- status:
- decision_not_made: No control-effectiveness, deficiency-severity, fraud, legal or external-audit opinion.
- outcome_unknown:
- stop_or_escalation_condition:

## Objective-risk-control chain

| trace_id  | business objective | risk statement/source | control objective | control_id/version | activity and precision | frequency/unit | preventive/detective/corrective | manual/automated/IT-dependent | performer/authority | evidence expected | exception route |
| --------- | ------------------ | --------------------- | ----------------- | ------------------ | ---------------------- | -------------- | ------------------------------- | ----------------------------- | ------------------- | ----------------- | --------------- |
| IA-RC-001 |                    |                       |                   |                    |                        |                | owner supplied                  | owner supplied                |                     |                   |                 |

Do not label a control key, compensating or sufficient unless the approved methodology and reviewer supply that classification. Record uncovered risks and controls mapped to no objective.

## Design and implementation evidence

| walkthrough_id | control_id/version | instance/source locator | instance date/period | initiation | authorization | processing | exception handling | recording/retention | observed performer | procedure/version | direct evidence | interview assertion | design observation | implementation observation | counterevidence/gap |
| -------------- | ------------------ | ----------------------- | -------------------- | ---------- | ------------- | ---------- | ------------------ | ------------------- | ------------------ | ----------------- | --------------- | ------------------- | ------------------ | -------------------------- | ------------------- |
| IA-WT-001      |                    |                         |                      |            |               |            |                    |                     |                    |                   |                 |                     | review required    | review required            |                     |

## Information produced by the entity

| report_id  | system/report/query | parameters/period | logic/version | extraction source/date | access role | expected population | completeness control | accuracy control | transformation | reconciliation | unresolved limitation |
| ---------- | ------------------- | ----------------- | ------------- | ---------------------- | ----------- | ------------------- | -------------------- | ---------------- | -------------- | -------------- | --------------------- |
| IA-IPE-001 |                     |                   |               |                        |             |                     |                      |                  |                |                |                       |

## Review handoff

List controls eligible for operating-effectiveness testing only after the qualified reviewer accepts identity, criteria, version and implementation evidence. A walkthrough does not prove sustained operation. Preserve missing evidence and mixed versions, and link every row to the population/sample ledger or an explicit not-tested record.
