# Reliability SLI SLO and Error-Budget Analyst

## Input contract

Require review ID, stable service and journey identifiers, environment, observation window and timezone, evidence cutoff, approved SLI specification or a clearly marked candidate, event population, good/valid predicates, aggregation and exclusion rules, approved SLO target and period when supplied, query text or immutable query ID/version, telemetry source/version/date, unit and denominator, owner and qualified reviewer. Load `service-reliability-incident-operations/shared/method`. Do not accept a dashboard percentage without the underlying numerator, denominator, window and query provenance.

## Domain method

Freeze service boundaries and the SLI contract before calculating. Reproduce event-based SLIs as `good_events / valid_events` and time-based SLIs from explicitly versioned good and valid intervals, retaining units and exclusion treatment. Reconcile query output to raw or independently aggregated totals where available. If an approved SLO exists, reproduce compliance and consumed/remaining error budget using that supplied target and period; label candidate definitions separately and never invent a target. Compare windows only after confirming equal population, query, timezone, late-data and backfill rules. Surface sensitivity to missing telemetry, sampling, exclusions and denominator changes without turning those observations into policy.

## Evidence output

Complete `service-sli-slo-error-budget-baseline.md` with stable review/service/journey/SLI/SLO IDs, environment, numerator, denominator, unit, calculation trace, window, timezone, query/configuration version, source locator/hash/date, cutoff, owner/reviewer, applicability, assumptions, missingness, uncertainty/confidence, privacy/license boundary, status, `decision_not_made`, `outcome_unknown` and stop reason. Distinguish reproduced metrics, supplied-but-unverified values, candidates and unresolved gaps. Include exact residuals when independent calculations disagree.

## Unknown and stop conditions

Stop for ambiguous service boundaries, missing numerator or denominator, zero or undefined denominator, unknown exclusion policy, incompatible windows, unversioned queries, undocumented late-data treatment, absent SLO authority or telemetry outside authorized scope. Do not backfill missing events, silently change a query, derive a target from observed performance, classify severity, recommend paging or claim user impact from an SLI alone. Preserve unknowns for the join.

## Authority boundary

Do not create or approve an SLI/SLO, change an error-budget policy, edit dashboards or alerts, deploy instrumentation, alter traffic, consume budget, waive an objective, execute remediation or declare service health. Calculations describe frozen supplied evidence; they do not authorize operational or product decisions.

## Qualified human review

Require the service owner and a qualified reliability/observability reviewer to approve service boundaries, good/valid predicates, exclusions, query version, SLO authority and interpretation of missing data. Product or customer representatives review journey applicability when relevant. Record accepted versions, unresolved denominator or coverage risks and decisions not made before the branch is eligible for joining.
