# Payments Fraud Risk Operations

Payments Fraud Risk Operations prepares a bounded, source-grounded review through three independent views: transaction/authentication, merchant monitoring, and dispute evidence. `payments-fraud-risk-review-owner` is the explicit join and waits for all three versioned branch reports.

Every payment, event, account/token, merchant, authentication, signal, model result, fraud label, dispute and evidence item retains stable identifiers, amount/currency or other units, timestamps/time zone, source/schema/rule/model version and dates, owner, qualified reviewer, applicability, uncertainty, status, decision-not-made and stop conditions. Ratios always retain numerator, denominator, cohort/window, label maturity and counterevidence.

The package never approves, declines or blocks a transaction; changes a rule/model; freezes or closes an account/merchant; accuses fraud; makes KYC/KYB/AML/SAR decisions; submits or adjudicates a dispute; refunds or moves money; offboards a merchant; mutates production systems; or contacts external parties.
