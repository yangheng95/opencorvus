Use `payments-fraud-risk-operations/shared/method` for the merchant cohort, ratio, trend, and linked-entity evidence branch.

## Input contract

Require merchant/account IDs and authorized onboarding/KYB status as supplied; processor/acquirer/network and payment-rail scope; merchant category, geography, channel, tenure, volume/value and currency; transaction, authorization/decline, refund, dispute/chargeback and matured fraud-label events; related-account/device/bank/domain/address evidence within privacy authorization; cohort dimensions; observation and label-maturity windows/time zone; current network/acquirer monitoring criterion sources and effective versions; rule/model versions; evidence cutoff; accountable merchant-risk owner; qualified acquiring/fraud/model/privacy reviewers; and excluded merchant action.

## Domain method

Define comparable cohorts before calculating. Preserve merchant size, channel, geography, category, tenure and label maturity. For every count/rate state numerator, denominator, currency/value basis, window, exclusion and source. Use time-aware baselines and show uncertainty for small or delayed cohorts; never rank a merchant on a numerator alone. Treat shared identifiers and graph links as evidence of association, not common control or fraud. Compare only to current supplied network/acquirer criteria and record their scope/version; do not invent thresholds.

## Evidence output

Complete `merchant-account-monitoring-cohort-analysis.md`. Return stable cohort/finding IDs, merchant/entity keys, raw counts/amounts/currencies, formulas/denominators/windows, comparator cohort, criteria source/version/dates, trends, linkage evidence/counterevidence, label maturity, owner, qualified reviewer, applicability, uncertainty, status, decision-not-made and stop/escalation.

## Unknown and stop conditions

Stop when merchant identity/ownership evidence conflicts, cohort or denominator is unstable, currencies cannot be normalized with an authorized source, labels are immature, network/acquirer criteria are stale, linked-entity data exceed authorization, active financial/security harm appears, or output would drive live merchant action. Do not infer beneficial ownership, collusion, fraud, laundering, sanctions status, intent or compliance from patterns. Keep unknown, not-applicable, unavailable and contradictory states distinct; never convert missing evidence into a normal or low-risk result.

## Authority and qualified review

Never onboard/offboard, restrict, reserve, price, freeze or close a merchant; change monitoring rules; initiate KYC/KYB/AML/SAR/sanctions action; accuse fraud; contact a merchant/network; move funds; or make a legal/compliance determination. Require merchant/acquiring risk, fraud operations, network liaison, model validation, KYB/AML/BSA/sanctions, finance, cybersecurity, privacy/legal and authorized executive review. The output is an evidence pack for those qualified reviewers, not an instruction to a live payment, account, merchant, dispute, reporting, or funds system.
