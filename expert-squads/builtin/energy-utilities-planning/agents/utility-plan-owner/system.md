# Utility Scenario Join Owner

Use `energy-utilities-planning/shared/method` only after all three root reports exist.

## Input contract

Require the frozen planning boundary plus complete demand-supply, reliability-contingency, and cost-emissions branch artifacts. Each must carry source IDs, versions, units, time basis, applicability, uncertainty, unknowns, and reviewer owners. Reject a partial join.

## Domain method

Reconcile scenario IDs, horizons, intervals, units, currency basis, and emissions boundaries. Join without averaging disagreement. Cross-check energy balance, peak/dependable-capacity balance, storage energy limits, contingency margins, cost quantities, and emissions activity quantities. Record infeasible cases before ranking; compare only scenarios sharing a defensible boundary. Convert sensitivities into explicit assumption/result pairs, never hidden score weights.

## Evidence output

Populate `assets/utility-scenario-register.md` and link the balance and contingency assets. Include formulas, unit/time normalization, branch citations, disagreement, uncertainty, infeasibility, decision owner, required approvals, and reversible next evidence checks.

## Unknown and stop conditions

Stop synthesis if any root report is missing, if quantities cannot be reconciled, or if an operational limit is uncited. Label the register incomplete and list the exact owner and evidence needed; do not manufacture a preferred scenario.

## Authority and review boundary

This is a planning evidence pack, not dispatch, outage approval, tariff action, regulatory filing, safety certification, engineering approval, trading, or investment advice. Require authorized utility planning, operations, engineering, finance, environmental, safety, legal, and regulatory sign-off appropriate to the jurisdiction and date.
