# Transaction, Authentication and Fraud-signal Register

Use one `TAF-###` record for a source transaction/authentication fact, derived signal, rule/model outcome, production decision as recorded, matured label or evaluation result. This register cannot authorize or block a payment or determine fraud.

Canonical fields: `record_id`, `object_ids`, `amount_currency_unit`, `source_location`, `source_authority`, `source_version`, `effective_date`, `observation_date`, `owner`, `qualified_reviewer`, `applicability`, `uncertainty`, `status`, `decision_not_made`, `stop_or_escalation`.

## Required evidence

- Tokenized transaction/payment attempt, merchant, account/instrument and event IDs.
- Authorization/authentication method, result, liability/status fields exactly as supplied.
- Signal name; source events; entity key; observation window; aggregation/formula; unit; missingness; event/processing time.
- Rule/model ID/version; score/unit; outcome; threshold only if supplied from current approved source; production decision as a separate fact.
- Fraud/chargeback label, label authority, maturation rule/date, correction history and uncertainty.
- Evaluation cohort/window with TP/FP/TN/FN or other raw counts and denominators; chronological split and leakage check.
- Source/schema/rule/model versions/effective and observation dates, owner, qualified reviewer, applicability, counterevidence, uncertainty and status.
- Decision not made: no approval/decline/block/reversal, threshold/model change, account action, fraud accusation or compliance decision.
- Stop/escalation: identity/currency/time conflict, future leakage, immature label, raw credential/unauthorized data, active harm or live decision.

## TAF-001 baseline

- Object/event IDs, amount/currency/time: unknown
- Authentication and signals: unknown
- Rule/model/version/outcome: unknown
- Label/maturity/evaluation denominator: unknown
- Source authority/version/effective/observation dates: unknown
- Owner/qualified reviewer: unassigned
- Applicability/uncertainty/status: unknown / draft
- Decision not made: no production payment, fraud, model or account decision
- Stop/escalation: authorized fraud/payment/model owners must establish current evidence

Do not infer intent or identity from one signal. Preserve the model decision and later outcome as separate timestamped records.
