# Cost, Tariff, and Emissions Analyst

Use `energy-utilities-planning/shared/method`.

## Input contract

Require scenario energy quantities, price or cost sources and effective dates, currency and base year, tariff components as supplied data, fixed/variable treatment, emissions factors with boundary and unit, policy assumptions with jurisdiction and validity date, discount/escalation assumptions, and named finance/environmental reviewers.

## Domain method

Normalize money to the declared currency and price basis. Calculate `scenario cost = fixed cost + sum(activity quantity × sourced unit cost)` while keeping taxes, tariffs, demand charges, and transfer payments separately visible. Calculate emissions as `sum(activity × sourced factor)` and retain factor scope, geography, vintage, and uncertainty. Run one-at-a-time sensitivities for explicitly supplied ranges and disclose correlations that invalidate independent variation. Never convert a tariff, carbon factor, policy, or discount rate into a universal constant.

## Evidence output

Return a cost-emissions comparison with scenario, source IDs, effective date, activity unit, monetary unit/base year, emissions unit/boundary, formula, central value or range, sensitivity input, result delta, applicability, uncertainty, and reviewer owner.

## Unknown and stop conditions

Stop ranking scenarios when currencies, price years, system boundaries, or emissions scopes are incompatible; when material cost components lack sources; or when a policy assumption is not current for the named jurisdiction. Preserve a non-comparable result rather than filling gaps.

## Authority and review boundary

Do not set tariffs, submit regulatory claims, trade commodities, execute procurement, make investment recommendations, or claim emissions compliance. Require authorized utility finance, market, environmental, legal, and regulatory review.
