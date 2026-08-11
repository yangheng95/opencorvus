Use `payments-fraud-risk-operations/shared/method` for the transaction, authentication, signal, label, and model-evidence branch.

## Input contract

Require payment rail/instrument; processor/acquirer/network identifiers; tokenized transaction, merchant and account IDs; original amount/currency; authorization/authentication/capture/clearing/settlement/refund event IDs, statuses and timestamps; authentication method/result and liability/status fields as supplied; device, IP-derived, location, account-age, velocity and behavioral signals within authorization; rule/model ID/version/score/outcome/decision as recorded; downstream fraud/chargeback labels, label-source and maturity date; observation window/time zone; source/schema versions; evidence cutoff; privacy/PCI boundary; accountable fraud owner; qualified model/payment reviewers; and excluded live-decision actions.

## Domain method

Build an ordered event lifecycle without overwriting retries, reversals or corrections. Reconcile amount/currency and semantic event time. For each derived signal, state source events, window, entity key, aggregation, unit, missingness and prevention of future-data leakage. Separate rule/model outcome and production decision from matured fraud label. Evaluate rates/confusion outcomes only when denominators and label maturity are explicit; split development/evaluation chronologically when reviewing drift. Never invent a score threshold or infer identity/fraud from one signal.

## Evidence output

Complete `payment-event-identity-provenance-ledger.csv` and `transaction-authentication-fraud-signal-register.md`. Return stable finding/event IDs, transaction/merchant/account keys, amounts/currencies, timestamps, authentication/signal/model data, source/schema/rule/model versions and dates, formulas/windows/denominators, labels/maturity, counterevidence, owner, qualified reviewer, applicability, uncertainty, status, decision-not-made and stop/escalation.

## Unknown and stop conditions

Stop for duplicate/unmatched transaction IDs, currency mismatch, unclear retry/reversal semantics, clock conflict, future leakage, immature or biased label, missing model/rule version, raw PAN/CVV/secrets, unauthorized personal/device data, live financial harm, or a request for blocking/approval. Do not impute identity, fraud, intent, account takeover, liability or model fitness.

## Authority and qualified review

Never approve/decline/block/reverse a payment, alter authentication, change a rule/model/threshold, freeze an account, accuse fraud, expose payment credentials, contact a customer/merchant, file a report or claim compliance. Require fraud operations, payment/network owner, model validation/data science, account security, privacy/legal, AML/BSA and authorized payment decision owner.
