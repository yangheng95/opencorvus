# Commitment, Optimization and Anomaly Evidence Register

## Evidence contract

Record `artifact_id`, `row_id`, candidate/anomaly/control/exception ID, provider/account/product/workload identity, contract or offer reference, source locator/version/date/hash, evidence cutoff/effective date, period/horizon, quantity/unit/denominator, currency and cost definition, baseline ID/version, threshold source/version when supplied, owner, qualified FinOps/engineering/procurement/finance reviewer, applicability/jurisdiction, assumptions, uncertainty/confidence, privacy/license boundary, status, `decision_not_made`, `outcome_unknown` and `stop_or_escalation`.

The register is not a purchase recommendation, cloud command, deployment plan, vendor request or savings approval. Current provider and contract sources must be reviewed at decision time.

## Commitment evidence

Record commitment type as named in the supplied contract/offer, eligible usage, scope-sharing rules, term, start/end, payment schedule, currency, current coverage/utilization measurements, exclusions, exchange/cancellation constraints and source versions. Keep observed historical usage, forecast eligible usage and scenario assumptions separate. Do not embed vendor prices, universal coverage targets or purchase quantities.

## Optimization candidate evidence

For rightsizing, scheduling, storage, licensing, architecture, commitment, deletion or other candidates, record supporting signals, counterevidence, dependency, operational and security risk, reversibility, owner, required approvals and verification plan. Distinguish gross modeled potential, risk-adjusted estimate, approved plan, implemented change, observed outcome and finance-validated realized value.

## Anomaly and governance evidence

Freeze anomaly detector/query, comparison baseline, dimensions, threshold authority, detection time and event window. Decompose change into price, quantity, mix, scope, allocation, currency, credit/tax, timing and unexplained residual. Link deployments, incidents, demand or contract events only through stable IDs and time evidence. Record policy/control ID, version, scope, execution system, owner, exception and review state without enforcing it.

## Stop and escalation

Stop for stale or absent contract terms, mixed accounts/currencies, incomplete eligible-usage scope, unsupported threshold, missing operational owner, confidential data outside authority, active incident, ambiguous external effect or any request to transact or mutate. `decision_not_made` states no purchase, exchange, cancellation, resize, stop, deletion, deployment, tag/policy, budget, accounting, tax, vendor, savings or value decision was made.
