# OPC offer, channel, demand, and experiment portfolio

Artifact version: `2026.08.11.1`. Use one material row per frozen offer/customer/channel/experiment combination. Do not combine incompatible offer versions, cohorts, attribution windows, currencies, or funnel definitions.

## Required row fields

Record `artifact_id`, `artifact_version`, `row_id`, `offer_id`, offer/version/effective date, promise and price source, business model, target customer or audience ID and definition, channel ID/version, funnel stage and entry rule, observation window/cutoff, source locator/version/date, population, exposure, numerator, denominator, metric unit, formula/version, attribution rule/window, cost/capacity dependence, owner, qualified marketing/sales/product/finance/legal/privacy reviewer, applicability/jurisdiction, assumptions, uncertainty/confidence, privacy/license boundary, status, approval reference, `decision_not_made`, and `stop_escalation`.

## Evidence classes

Keep observed behavior, stated customer intent, operator belief, derived inference, and unknown distinct. Add counterevidence and sampling, survivorship, instrumentation, reporting-lag, seasonality, and attribution limitations. A customer quote or a single platform metric never represents the whole market. Report exact coverage and missing segments.

## Experiment evidence

Each experiment adds `experiment_id`, hypothesis, intervention and version, population, allocation/exposure rule, start/end, predeclared success measure and guardrail, source cutoff, result, contradictory observation, operating cost, owner-capacity consumption, reversibility, approval, stopping rule, and next evidence need. Never invent universal conversion, growth, engagement, retention, pricing, or product-market-fit targets.

Stop for undefined stage denominator, mixed versions, unverifiable public claim, restricted customer data, hidden channel cost, non-comparable cohorts, unclear attribution, or an action request. `decision_not_made` states that no offer, price, channel, campaign, publication, customer contact, budget, growth claim, product-market-fit, or legal/privacy decision was made.
