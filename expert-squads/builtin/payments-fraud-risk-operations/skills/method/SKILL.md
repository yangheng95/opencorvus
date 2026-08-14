---
name: payments-fraud-risk-operations-method
description: Prepare source-grounded payment transaction, authentication, account/device signal, merchant-cohort, fraud-label, model, dispute, chargeback, and control evidence. Use for bounded payments-fraud reviews requiring authorized human decisions; never use to approve, decline, block, freeze, close, accuse, perform KYC/KYB/AML/SAR, adjudicate disputes, refund, move funds, change production rules/models, contact parties, or claim compliance.
---

# Payments Fraud Risk Operations Method

## Freeze payment identity and authority

1. Record payment rail/instrument, processor, acquirer, network, merchant context, jurisdiction, evidence cutoff, time zone, PCI/security/privacy boundary, accountable owner and excluded actions.
2. Establish stable tokenized IDs for account/instrument, merchant, transaction/payment attempt, authorization, authentication, capture, clearing/settlement, reversal/refund, fraud label, dispute/chargeback, model/rule and evidence item. Never store raw PAN, CVV, secrets or unnecessary personal data.
3. Preserve amount/currency or other unit, source locator/authority, schema/rule/model version, effective and observation dates, owner, qualified reviewer, applicability, uncertainty, status, `decision_not_made` and `stop_or_escalation`.
4. Accept thresholds, reason codes, deadlines, monitoring programs and action criteria only from current supplied network/acquirer/processor/jurisdiction sources. Do not invent a universal fraud score.

Use [the payment event provenance ledger](assets/payment-event-identity-provenance-ledger.csv) as the common identity spine.

## Reconstruct transaction and authentication evidence

1. Build ordered authorization → authentication → capture → clearing/settlement → reversal/refund → dispute events. Preserve retries, partials, reversals, corrections and original clocks.
2. Reconcile transaction amount/currency and semantic event time. A processor status is evidence from that source, not a legal or fraud conclusion.
3. Define each signal with entity key, source events, observation window, aggregation, unit, missingness and timestamp. Prevent future-data leakage.
4. Keep rule/model result and production decision separate from a matured fraud/chargeback label. Record label source and maturity date.
5. Calculate rates and false positive, false negative, precision, recall, or other confusion outcomes only with explicit numerators, denominators, windows and mature labels. Use chronological evaluation for drift. Never present a false positive rate without its exact label definition and maturity basis. Store details in [the signal register](assets/transaction-authentication-fraud-signal-register.md).

## Build merchant cohorts without accusation

1. Define comparable cohort dimensions: category, channel, geography, tenure, volume/value, currency, payment rail and label maturity. Preserve exclusions.
2. For authorization, decline, refund, dispute, chargeback or fraud measures, state numerator, denominator, amount/count basis, window and source.
3. Show small-sample and delayed-label uncertainty. Never rank a merchant on a numerator alone or mix currencies without an authorized conversion source/date.
4. Treat shared device/account/bank/domain/address or graph links only as association evidence. Do not infer common ownership, collusion, laundering or fraud.
5. Record the analysis in [the merchant cohort asset](assets/merchant-account-monitoring-cohort-analysis.md).

## Preserve dispute and chargeback evidence

1. Bind each dispute to the exact transaction, processor/acquirer/network, reason code and current rule/process version.
2. Build an immutable timeline of transaction, authentication, order/fulfillment, communication, cancellation/refund and dispute events.
3. Calculate a deadline only from an explicit trigger event, calendar/time-zone method and current authority. Show formula; do not infer waiver or extension.
4. Map evidence to supplied reason-code elements while keeping evidence existence, authenticity/custody and sufficiency separate. The agent never decides sufficiency or outcome.
5. Complete [the dispute evidence timeline](assets/dispute-chargeback-evidence-timeline.md).

## Join and review controls

1. Require all three independent branch artifacts, exact versions/hashes and compatible transaction/merchant/dispute/event/time/currency keys.
2. Preserve contradictions across processor events, merchant cohorts, model labels and dispute records.
3. Use only supplied current criteria. Limit proposals to current-source request, identity/currency reconciliation, evidence re-baseline, independent model/control review, monitoring or verification of an authorized action.
4. Record source need, owner, qualified reviewer, applicability, uncertainty, status, decision authority and stop condition.
5. Complete [the integrated review pack](assets/payments-fraud-risk-review-pack.md). Never fill a human decision field.

## Stop and retain authority

Stop for ambiguous IDs, inconsistent currency/amount/clock, missing denominator or label maturity, future leakage, stale rule/model/network source, raw credentials, unauthorized personal/device/link data, active account takeover or financial harm, legal hold, live-decision request, or output implying fraud, KYC/KYB/AML/SAR/sanctions, dispute, account or merchant adjudication.

Never approve/decline/block/reverse a transaction, change rule/model/threshold, freeze/close an account or merchant, accuse fraud, perform compliance reporting, submit/adjudicate a dispute, create/alter evidence, refund/move funds, offboard, mutate systems or contact external parties. Require fraud operations, merchant/acquiring risk, network liaison, disputes, model validation, AML/BSA, finance/payment approver, cybersecurity, privacy/legal, consumer-protection and regulator.

## Sources and clean-room boundary

Read [sources and clean-room boundary](references/sources.md). This method is clean-room authored. Stripe’s mature integration Skill was reviewed and rejected because it creates/configures payment integrations rather than operating fraud evidence. No upstream Skill text, code, version defaults, API actions or thresholds were copied.
