# Unit Economics, Budget and Forecast Register

## Provenance and authority

Each row records `artifact_id`, `row_id`, metric/budget/forecast/scenario ID, organization/product/workload/allocation-scope IDs, source locator/version/date/hash, cutoff/effective date, numerator value/unit/source, denominator value/unit/source, formula and formula version, currency/exchange-rate source/time where applicable, time grain/window/horizon, cohort, owner, qualified reviewer, applicability/jurisdiction, assumptions, uncertainty/confidence, privacy/license boundary, status, `decision_not_made`, `outcome_unknown` and `stop_or_escalation`.

This register documents supplied definitions and reproducible calculations. It does not create a budget, select a target, approve a forecast, determine accounting treatment or claim business value.

## Unit-economics definition rows

Record the approved business meaning before the formula. Preserve cost numerator type—billed, effective, amortized, net or allocated—plus eligible charge categories and exclusions. Preserve activity or outcome denominator, source system, validity rule, cohort and measurement window. A metric without a complete numerator and denominator remains `definition_incomplete`.

For every derived value, show the formula substitution, units and rounding rule. Keep technology cost per request, user, transaction, workload, model invocation, token, build, order or other unit distinct. Do not compare unlike definitions or treat an external benchmark as universally valid.

## Budget and forecast rows

Record author/owner, approval state, version, created date, forecast issue date, covered periods, scenario, currency, scope, assumptions and source. Link later actual evidence only by matching scope, period, currency and cost definition. Report signed and absolute variance under an approved formula; preserve restatements and revised forecasts as separate versions.

## Interpretation and stop conditions

Separate demand, mix, price, scope, allocation, currency, credits and timing as candidate variance drivers with evidence and counterevidence. Never claim causation from a ratio alone. Stop for missing metric authority, incomplete denominator, mixed currency or period, unknown source revision, unsupported target, confidential business data outside scope or a request to set a budget or approve value.

`decision_not_made` enumerates no unit target, budget, forecast approval, commitment, optimization, accounting, tax, pricing, product or investment decision. A qualified FinOps and finance reviewer owns acceptance.
