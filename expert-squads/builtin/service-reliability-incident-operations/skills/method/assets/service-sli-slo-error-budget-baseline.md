# Service, SLI, SLO and Error-budget Baseline

## Evidence contract

Record `artifact_id`, `row_id`, service/catalog/component/dependency/journey IDs, environment/region/tenant boundary, SLI/SLO/policy IDs and versions, source/query/configuration locator/version/date/hash, cutoff/effective date, measurement window and clock/time zone, numerator and denominator values/units, target only from approved policy, owner, qualified service/SRE/reliability reviewer, applicability/jurisdiction, assumptions, uncertainty/confidence, privacy/license boundary, status, `decision_not_made`, `outcome_unknown` and `stop_or_escalation`.

This baseline records approved definitions and reproduced evidence. It does not create an SLO, set a release gate, declare an incident, change alerts or authorize production action.

## Service and dependency identity

Record the service catalog source, business capability, user journeys, externally visible interfaces, regions, tenants, critical dependencies, data stores, queues and third parties. Preserve owner and version history. Do not infer a dependency or ownership relationship from telemetry labels alone.

## SLI definition rows

For each service-level indicator, record event population or measured quantity, good/valid predicate, source/query, query version, unit, aggregation, exclusions, missing-data rule, late-data rule, window and effective date. Keep client, edge, service, dependency and synthetic perspectives distinct. Record telemetry blind spots and sampling limits.

## SLO and error-budget rows

Record the approved SLO policy source, objective definition, target/comparison operator, window, exclusions, owner and approval evidence exactly as supplied. Show any reproduced numerator, denominator, ratio and error-budget formula with substituted values and units. The package supplies no universal target, burn threshold or release criterion.

## Unknown and stop queue

List absent policy authority, mismatched service identity, stale query/configuration, changed instrumentation, incomplete denominator, missing regions/tenants, disputed exclusions, clock mismatch and privacy restrictions. Stop rather than filling gaps. `decision_not_made` states that no SLO, severity, release, rollback, mitigation, alert, error-budget policy or production decision was made.
