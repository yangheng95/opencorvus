# Dispute and Chargeback Evidence Timeline

Use one `DCE-###` record per dispute/chargeback event or evidence item. Preserve source custody and contradictions. This is not representment, adjudication, refund, liability assignment or legal advice.

Canonical fields: `record_id`, `object_ids`, `amount_currency_unit`, `source_location`, `source_authority`, `source_version`, `effective_date`, `observation_date`, `owner`, `qualified_reviewer`, `applicability`, `uncertainty`, `status`, `decision_not_made`, `stop_or_escalation`.

## Required timeline

- Dispute/chargeback, transaction/payment, merchant and tokenized customer/account IDs.
- Processor/acquirer/network/jurisdiction, reason code/description as supplied, current rule/process source/version/effective date.
- Amount/currency and original transaction, authorization/authentication, order/fulfillment/delivery, cancellation, communication, refund and dispute events with semantic timestamp/time zone.
- Deadline calculation only from supplied trigger event, calendar/time-zone rule and authority; show formula and unknowns.
- Evidence item locator, format/version, custody/audit trail, observation date, relevant supplied reason-code element and authenticity/custody limitation.
- Case state and network outcome only as supplied; keep fraud label, consumer error, contractual dispute and network result separate.
- Counterevidence, gaps, owner, qualified dispute/network/legal/privacy reviewer, applicability, uncertainty and status.
- Decision not made: no submission/withdrawal/acceptance/denial, evidence alteration, sufficiency/liability/fraud outcome, refund or funds movement.
- Stop/escalation: unmatched transaction, amount/currency conflict, stale/missing rule, deadline ambiguity, unverifiable evidence, privacy excess or legal hold.

## DCE-001 baseline

- Dispute/transaction/merchant IDs: unknown
- Reason/rule/version/deadline: unknown
- Events/time zone/amount/currency: unknown
- Evidence locator/custody: unknown
- Source authority/effective/observation dates: unknown
- Owner/qualified reviewer: unassigned
- Applicability/uncertainty/status: unknown / draft
- Decision not made: no dispute, fraud, liability, evidence, refund or legal decision
- Stop/escalation: authorized dispute/network/legal owners must establish current case authority
