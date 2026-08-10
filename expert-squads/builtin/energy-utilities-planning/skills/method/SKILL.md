---
name: energy-utilities-planning-method
description: Reconcile time-series demand, supply, asset availability, contingency, cost, tariff, and emissions evidence into bounded utility planning scenarios. Use when comparing non-operational energy or utility options that require explicit units, uncertainty, infeasible cases, and qualified engineering review.
---

# Energy and Utilities Planning

## Establish the planning basis

Record the service territory or facility boundary, horizon, interval resolution, time zone, weather basis, demand segments, asset boundary, evidence cutoff, scenario IDs, accountable owner, and excluded operational actions. Assign source IDs and preserve source version, effective date, units, applicability, and uncertainty.

Do not compare series until power versus energy, interval, currency/base year, emissions boundary, and geographic scope are explicit. Mark unresolved conversion as a blocking gap.

## Reconcile demand, energy, and capacity

1. Normalize load and supply series to a declared time basis without inventing missing intervals.
2. Calculate each interval's `net requirement = gross demand + losses - embedded supply`.
3. Reconcile horizon energy separately from peak power. Compare peak requirement with sourced dependable capacity, not nameplate capacity.
4. Track storage charge, discharge, efficiency, power limit, energy limit, and terminal state separately. Prevent double-counting stored energy as supply and reserve.
5. Preserve forecast ranges and the weather-normalization method. Record every infeasible interval.

Use [Demand, Energy, and Capacity Balance](assets/demand-energy-capacity-balance.md).

## Test reliability and contingencies

Build an availability matrix from sourced states and dates. For each supplied contingency calculate `planning margin = available dependable capacity - coincident demand`, while retaining energy-duration and dependency constraints. Never invent reserve, reliability, voltage, thermal, or safety thresholds; label operator-supplied criteria as hypotheses pending current authoritative verification.

Use [Reliability and Contingency Review](assets/reliability-contingency-review.md).

## Normalize cost and emissions

Calculate `scenario cost = fixed cost + sum(activity × sourced unit cost)` with currency, base year, effective date, tariff components, taxes, and transfers visible. Calculate `emissions = sum(activity × sourced factor)` with factor scope, geography, vintage, and unit. Vary only documented sensitivity ranges and disclose correlated assumptions.

## Join without hiding failure

Complete [Utility Scenario Register](assets/utility-scenario-register.md). Reconcile branch quantities and preserve disagreements, uncertainty, non-comparable results, and infeasible cases. Every proposed next check needs an owner, required approval, current source to verify, and reversible method.

## Failure and authority boundary

Stop comparative conclusions when boundaries, units, intervals, asset availability, contingency definitions, price bases, or emissions scopes cannot be reconciled. Do not impute values or substitute generic regulatory criteria.

Never dispatch or isolate infrastructure, direct outages, trade energy, set tariffs, file regulatory claims, certify safety/reliability, approve engineering, or provide investment advice. Require authorized utility planning, operations, engineering, finance, environmental, safety, legal, and regulatory review.

Read [Clean-room Authoring and Source Boundary](references/clean-room-authoring.md) before treating the artifacts as reusable evidence.
