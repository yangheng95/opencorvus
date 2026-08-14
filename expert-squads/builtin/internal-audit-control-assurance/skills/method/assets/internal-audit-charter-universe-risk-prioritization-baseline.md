# Internal Audit Charter, Universe and Risk Prioritization Baseline

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
- engagement_id:
- entity / business unit:
- mandate_or_charter_source_locator:
- source_version:
- source_date:
- cutoff_or_effective_date:
- prepared_by / owner:
- qualified_reviewer:
- applicability / jurisdiction:
- confidentiality_privacy_license_state:
- assumptions:
- uncertainty_confidence:
- status:
- decision_not_made: No audit-plan approval, risk acceptance, audit opinion, fraud or material-weakness conclusion.
- outcome_unknown:
- stop_or_escalation_condition:

## Authority and independence

Record commissioning body, audit owner, reporting line, objectives, permitted systems and records, exclusions, prior management responsibility, actual or perceived conflicts, safeguards and approval evidence. Link each fact to a source locator/version/date. State missing authority or independence evidence explicitly; do not describe silence as independence.

## Audit-universe reconciliation

| auditable_unit_id | entity/process/system/product/third_party | authoritative inventory source | source version/date | owner | lifecycle state | objectives | dependencies | change events | prior coverage | open issues | included/excluded reason | conflict/gap |
| ----------------- | ----------------------------------------- | ------------------------------ | ------------------- | ----- | --------------- | ---------- | ------------ | ------------- | -------------- | ----------- | ------------------------ | ------------ |
| IA-AU-001         |                                           |                                |                     |       | unknown         |            |              |               |                |             | review required          |              |

Reconcile source totals, obtained totals, duplicates, inactive items, acquired/divested items and unexplained omissions. Record the unit of count and cutoff. An incomplete universe stays incomplete; no priority result can erase the limitation.

## Risk-priority evidence

| priority_record_id | auditable_unit_id | factor | definition/source | observed value | unit/ordinal scale | supplied weight | calculation/rationale | counterevidence | uncertainty | resulting planning state | reviewer |
| ------------------ | ----------------- | ------ | ----------------- | -------------- | ------------------ | --------------- | --------------------- | --------------- | ----------- | ------------------------ | -------- |
| IA-RP-001          | IA-AU-001         |        |                   |                |                    | not supplied    |                       |                 |             | unapproved               |          |

List factor conflicts, stale sources, unscored units and owner-supplied overrides. Prioritization is planning evidence only. The Chief Audit Executive or delegated owner decides the audit plan, coverage cadence and accepted limitations.

## Handoff

Identify exact control-design, testing and finding asset IDs that consume each auditable unit. Record unresolved scope questions, source requests, qualified reviewer and next evidence. Set `outcome_unknown: true` until the authorized reviewer records a dated decision.
