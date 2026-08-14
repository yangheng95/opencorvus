---
name: cloud-finops-cost-governance-method
description: Prepare traceable cloud, SaaS, AI, platform and other technology cost/usage evidence across billing quality, allocation, unit economics, forecast, commitment, optimization, anomaly, governance and value. Use for bounded FinOps reviews that must preserve source versions, formulas, uncertainty and qualified decision gates without purchases, production changes, accounting entries or budget authority.
---

# Cloud FinOps Cost Governance Method

Use this method to prepare evidence for qualified FinOps, engineering, finance, procurement and accounting review. Read [source provenance and adaptation](references/source-provenance.md) before reusing upstream concepts. The adapted method is distributed under the package-local [CC BY-SA 4.0 license](references/LICENSE-CC-BY-SA-4.0.md).

## Freeze scope and authority

1. Record review ID, organization boundary, provider and tenant/account/subscription/project IDs, technology categories, billing/service/usage periods, evidence cutoff, currencies, time zone, data classes, source authorization, owner and qualified reviewers.
2. Assign stable IDs to billing sources, exports, invoices, accounts, services, resources, charges, usage records, allocation rules, business units, products, workloads, metrics, forecasts, commitments, candidates, anomalies, controls, exceptions and value claims.
3. Record source locator, source authority, schema/version, export generation time, billing and service dates, ingestion time, checksum or query identity, currency/unit, tax/credit/refund treatment as supplied, owner, applicability, assumptions, uncertainty, privacy/license boundary and status.
4. Keep provider-billed, invoice, effective, amortized, net, list, allocated, forecast and accounting-book values distinct. Reconcile them only through an authorized, versioned mapping.
5. Treat missing identity, source authorization, schema, currency, cutoff, allocation policy, metric definition or reviewer as a stop condition. Never infer a tenant, jurisdiction, exchange rate or finance policy from a label.

Begin with [the technology cost scope and billing-source baseline](assets/technology-cost-scope-billing-source-baseline.md).

## Reconcile cost, usage and billing quality

1. Preserve each source at its native grain before transformation. Record charge category, service/resource identity, usage quantity/unit, pricing quantity/unit, currency, billing period, service period, invoice identity and adjustment lineage.
2. Profile row counts, key completeness, duplicate candidates, late arrivals, credits, refunds, taxes, rounding, currency conversion, missing usage and schema changes. A data-quality flag is evidence, not permission to rewrite the source.
3. Reconcile source totals by explicit dimensions such as provider, account, invoice, currency and period. Compute `difference = compared_total - authoritative_total` only after freezing both total definitions and signs.
4. For conversions, record functional and transaction currencies, source rate, rate timestamp, quotation direction, formula and rounding. Do not choose a rate or accounting treatment.
5. Separate observed usage from estimated, sampled or allocated usage. Preserve provider revisions and restatements as new versions rather than overwriting prior evidence.
6. Record results in [the cost, usage and allocation reconciliation ledger](assets/cost-usage-allocation-reconciliation-ledger.csv), including unresolved differences and counterevidence.

## Build allocation and unit-economics evidence

1. Classify cost only under a supplied, approved allocation policy: directly attributable, shared with a defined driver, intentionally unallocated, disputed or unknown.
2. Record allocation-rule ID/version, eligible cost pool, excluded items, driver source, driver unit, numerator, denominator, period, normalization and residual. Require the allocated total plus residual to reconcile to the input pool within the supplied tolerance; do not invent a tolerance.
3. Never use tags, labels, ownership names or business hierarchy as authoritative unless their system of record, validity period and reconciliation rule are supplied.
4. Define each unit metric with business meaning, formula version, cost numerator, activity/outcome denominator, unit, cohort, window, source cutoff, owner and uncertainty. A ratio without its numerator and denominator is unusable.
5. Keep cost efficiency, demand change, product mix, quality, latency and revenue/value outcomes separate. Do not claim that lower spend caused better value or that a benchmark applies universally.
6. Document formulas and reconciliation in [the unit-economics, budget and forecast register](assets/unit-economics-budget-forecast-register.md).

## Compare budget, forecast, commitment and optimization evidence

1. Record budget/forecast owner, version, approval state, time grain, horizon, currency, scope, assumptions, scenario and source. Do not create or approve a budget.
2. For historical forecast evaluation, align forecast issue date with the later actual period and record absolute and signed variance using the approved definition. Never compare a revised forecast with an earlier actual without preserving the revision lineage.
3. Describe commitments using contract/offer ID, provider/product, eligible usage, term, start/end, payment schedule, currency, sharing/scope, current utilization, coverage and supplied exchange/cancellation constraints. Do not rely on remembered vendor mechanics or prices.
4. Treat rightsizing, scheduling, storage, licensing, architecture, commitment and deletion ideas as candidates. Record supporting signals, counterevidence, dependencies, risk, reversibility, owner and verification plan without executing them.
5. Separate gross potential, modeled potential, approved plan, implemented change, observed result and finance-validated realized value. Never relabel a model estimate as savings.
6. Record all candidates and anomalies in [the commitment, optimization and anomaly evidence register](assets/commitment-optimization-anomaly-evidence-register.md).

## Reconstruct anomalies, governance and value

1. Freeze anomaly definition, comparison baseline, dimensions, threshold source/version, detection time, event window and current state. The method supplies no universal percentage, severity or alert threshold.
2. Decompose a cost change using traceable dimensions such as price, quantity, mix, scope, allocation, currency, credit/tax and timing, while retaining an unexplained residual.
3. Link observations to deployments, migrations, incidents, contract events or demand changes only by stable identifiers and time evidence. Correlation is not causation.
4. Record governance policies as supplied evidence with policy/control ID, version/effective date, scope, control owner, execution system, exception owner and review state. Do not enforce tags, budgets or policy.
5. Link technology cost to an approved business or service metric through an explicit formula and cutoff. Preserve uncertainty, missing denominators and conflicting owners.
6. If an external purchase, deployment, cancellation or vendor interaction has an ambiguous result, set `outcome_unknown`; reconcile authoritative provider and finance records before any retry.

## Join the evidence

1. Require all four branch reports and their asset hashes before synthesis. Do not manufacture a missing branch or substitute an earlier version.
2. Reconcile common identities, periods, currencies, totals, allocation rules, metric formulas, forecasts, commitments, candidates, anomalies and owners. Preserve each source when conflicts remain.
3. Classify every statement as source fact, observation, derived calculation, assumption, hypothesis, estimate, approved decision, implemented change, observed outcome, uncertainty or unknown.
4. Produce [the qualified-review pack](assets/cloud-finops-qualified-review-pack.md) with branch hashes, formula inventory, contradiction table, unresolved gaps, candidate decisions, accountable owners and qualified reviewers.
5. State `decision_not_made` for every purchase, exchange, resize, deletion, scheduling, architecture, budget, accounting, tax, vendor, policy, savings and value decision not made by this package.

## Stop and escalate

Stop for missing authorization, mixed tenant/account identity, incompatible schema or billing periods, unreconciled currency/sign conventions, absent allocation or metric authority, confidential data outside scope, ambiguous external effect or any request to transact or mutate systems.

Never purchase or exchange a commitment; resize, stop, delete or deploy a resource; change a tag or policy; create or approve a budget; post an entry; determine tax or regulatory treatment; contact a vendor; or approve savings/value. Route those decisions to authorized FinOps, engineering, procurement, finance, accounting, tax, security and service owners.

> This local method is adapted from Cloud FinOps Skill by [OptimNow](https://optimnow.io), fixed at commit `897d97baf43ad8622fce6bb1d6ac918fb4abd974`, and is licensed under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). It has been modified for bounded evidence preparation; see the modification notice.
