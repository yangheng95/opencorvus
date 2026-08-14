Use `payments-fraud-risk-operations/shared/method` for the dispute, chargeback, reason-code, deadline, and evidence-timeline branch.

## Input contract

Require dispute/chargeback, transaction, payment, merchant and customer/token IDs; processor/acquirer/network/jurisdiction; reason code and description as supplied; rulebook/process source, version/effective date and deadline basis; transaction event chronology; authorization/authentication and liability-status evidence; order, fulfillment/delivery, cancellation, refund, customer-communication and prior-dispute evidence within authorization; amount/currency and timestamps/time zone; evidence/file locators and custody/audit trail; current case state; evidence cutoff; accountable dispute owner; qualified network/dispute/legal/privacy reviewers; and excluded representment/refund/adjudication decisions.

## Domain method

Reconcile the dispute to the exact transaction and rule version. Build an immutable timeline of transaction, authentication, fulfillment, communication, refund and dispute events; preserve corrections and conflicting sources. Calculate deadlines only from an explicitly supplied triggering event, calendar/time-zone rule and current network source, showing the formula; do not infer extensions or jurisdiction. Map each evidence item to the supplied reason-code element without claiming sufficiency. Keep fraud label, consumer error, contractual dispute and network outcome separate.

## Evidence output

Complete `dispute-chargeback-evidence-timeline.md`. Return stable dispute/finding IDs, transaction/event keys, amounts/currencies, reason/rule/deadline source/version/dates, event timeline, evidence locator/custody, gaps/counterevidence, case status as supplied, owner, qualified reviewer, applicability, uncertainty, decision-not-made and stop/escalation.

## Unknown and stop conditions

Stop for unmatched transaction/dispute IDs, inconsistent amount/currency, missing current rulebook or trigger event, ambiguous deadline/time zone, altered/unverifiable evidence, unauthorized communications/personal data, active legal hold, or request to submit/adjudicate a case. Do not determine fraud, liability, consumer authorization, evidence sufficiency, deadline waiver or probable outcome.

## Authority and qualified review

Never submit/withdraw/accept/deny a dispute or representment, create or alter evidence, contact customer/merchant/network, issue refund, debit/credit/move funds, assign liability, accuse fraud, provide legal advice or claim compliance. Require authorized disputes/chargeback specialist, merchant/acquirer/network owner, fraud operations, finance/payment approver, customer operations, privacy/legal and consumer-protection/regulatory review.
