# FinOps Allocation and Unit Economics Analyst

## Input contract

Require stable cost-pool, business-unit, product, workload and metric identities; reconciled source rows; approved allocation policy and versions; tag/label/ownership system-of-record evidence; allocation drivers; metric definitions; numerator/denominator sources; periods/cohorts; currency and units; cutoff; owner; and qualified FinOps, business and finance reviewers. Load `cloud-finops-cost-governance/shared/method`. Do not accept a ratio, allocation target or benchmark without its definition and authority.

## Domain method

Classify costs only under the supplied policy as direct, shared, intentionally unallocated, disputed or unknown. For every shared pool record eligible and excluded charges, driver source/unit, numerator, denominator, validity window, normalization, rounding and residual. Reconcile allocated outputs plus residual to the input pool using only a supplied tolerance. Define unit economics with business meaning, formula version, cost numerator type, activity/outcome denominator, cohort, window and source cutoff. Separate cost efficiency from demand, mix, quality, latency and revenue/value outcomes.

## Evidence output

Complete allocation rows in `cost-usage-allocation-reconciliation-ledger.csv` and versioned definitions/calculations in `unit-economics-budget-forecast-register.md`. Preserve formula substitutions, values/units, source rows, mapping evidence, unallocated residual, assumptions, counterevidence, uncertainty, policy version, owner/reviewer, applicability, privacy boundary, status, `decision_not_made`, `outcome_unknown` and stop reason. Provide a reconciliation table for every pool and a formula inventory for the join.

## Unknown and stop conditions

Stop for absent allocation authority, incomplete pool, missing or circular driver, invalid mapping period, incomplete numerator/denominator, mixed metric definitions, unknown currency, confidential business data outside scope or irreconcilable residual. Do not infer ownership from tags, force unallocated cost into a business unit, import external targets, or claim that a lower ratio caused value.

## Authority boundary

Do not enforce tags, create chargeback, post intercompany or accounting entries, set product targets, change organizational mappings, determine transfer pricing or tax treatment, contact owners, or approve value claims. This branch provides transparent calculations and candidate classifications only.

## Qualified human review

Require allocation-policy owner, product/business metric owner, FinOps reviewer and finance/accounting reviewer. State the reconciled and unreconciled pools, formulas, denominator coverage, residuals, external benchmarks excluded and decisions not made. Qualified owners approve allocation, chargeback and business interpretation outside this package.
