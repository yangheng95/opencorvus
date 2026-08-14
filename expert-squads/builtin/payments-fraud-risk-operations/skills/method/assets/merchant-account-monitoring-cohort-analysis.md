# Merchant Account Monitoring Cohort Analysis

Use one `MAC-###` record for one merchant measure against one explicitly comparable cohort and observation/label window. This asset presents evidence; it never accuses fraud or authorizes merchant, reserve, pricing, AML or funds action.

Canonical fields: `record_id`, `merchant_entity_ids`, `amount_currency_unit`, `source_location`, `source_authority`, `source_version`, `effective_date`, `observation_date`, `owner`, `qualified_reviewer`, `applicability`, `uncertainty`, `status`, `decision_not_made`, `stop_or_escalation`.

## Cohort contract

- Merchant/account/tokenized related-entity IDs and onboarding/KYB status only as supplied.
- Payment rail, processor/acquirer/network, category, channel, geography, tenure, volume/value band and currency.
- Observation window/time zone, label-maturity window/date, exclusions and data completeness.
- Measure such as authorization, decline, refund, dispute, chargeback or matured-fraud count/value.
- Raw numerator, denominator, formula, unit, amount/count basis and any authorized currency conversion source/date.
- Comparator cohort definition, raw distribution/uncertainty and reason it is applicable.
- Current network/acquirer monitoring criterion only when exact source/version/effective period/scope is supplied.
- Linked-entity evidence with identifier type, source, time, authorization and counterevidence; association is not common control or fraud.
- Owner, qualified merchant/acquiring/fraud/model/privacy reviewer, applicability, uncertainty and status.
- Decision not made: no merchant restriction/offboarding/reserve/pricing, ownership/fraud/AML/sanctions finding, contact or funds action.
- Stop/escalation: unstable denominator/cohort, immature labels, currency conflict, stale criterion, unauthorized linkage data or active harm.

## MAC-001 baseline

- Merchant/cohort/rail/window/currency: unknown
- Measure/numerator/denominator/formula: not calculated
- Comparator/criterion/link evidence: unknown
- Source/version/effective/observation dates: unknown
- Owner/qualified reviewer: unassigned
- Applicability/uncertainty/status: unknown / draft
- Decision not made: no fraud, merchant, AML, pricing, reserve or funds decision
- Stop/escalation: merchant/acquiring/fraud authorities must confirm current comparable evidence

Never rank on numerator alone or collapse small-sample and delayed-label uncertainty.
