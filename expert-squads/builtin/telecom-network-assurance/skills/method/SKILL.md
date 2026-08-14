---
name: telecom-network-assurance-method
description: Prepare telecom network-assurance evidence packs covering demand, topology, service-level indicators, error budgets, incident patterns, capacity, and proposed change risk. Use for planning and human review without accessing or modifying live network infrastructure.
---

# Telecom Network Assurance Method

## Intake and network boundary

1. Freeze service/customer-impact IDs, technology/layer/geography, topology and inventory versions, observation and busy-hour windows/time zone, traffic profile, usable-capacity definition, direction and units, maintenance assumptions, indicator/query/threshold sources, evidence-freshness cutoff, authorized offline sources, security classification, and accountable human owners.
2. Assign stable IDs to services, nodes, links, paths, failure domains, indicators, incidents, changes, sources, and scenarios. Keep observed, reported, computed, forecast, threshold-as-input, and unknown values distinct.
3. Run service/topology, service-level, and capacity/change analysis independently. Join only complete outputs sharing explicit IDs, versions, layers, units, and windows.

## Domain rules

- Trace services through logical and physical topology, inventory state, capacity, protection roles, dependencies, and shared site/power/duct/fiber/control-plane/provider failure domains. Two drawn paths are not evidence of diversity.
- Define indicator population and eligible window first. Use `availability = good eligible time / eligible time`, `packet loss = lost packets / transmitted packets`, and a declared latency percentile over a stated sample distribution. Preserve layer, direction, unit, filters, and aggregation.
- Use only an authorized target source. Compute `error budget = (1 - target) * eligible population or time` and `budget consumption = bad eligible population or time / error budget`; mark undefined at zero denominator. Never invent an objective or interpret an SLA.
- Normalize load and usable capacity to the same layer, direction, unit, aggregation, and window. Use `utilization = observed load / usable capacity` and `headroom = usable capacity - selected demand`; label demand as peak, percentile, busy-hour, forecast, or scenario.
- Recompute usable capacity for each named failure or maintenance scenario. Preserve oversubscription, overhead, equipment state, licensing, growth, seasonality, shared-failure, and source-freshness assumptions.
- Compare proposed before/after change states, affected services, dependencies, abort evidence, rollback prerequisites, and maintenance constraints without any live action.

## Assets and join

- Use [Service Topology and Failure-Domain Map](assets/service-topology-failure-domain-map.md) for service-to-inventory trace, redundancy, and shared risks.
- Use [Service-Level Indicator Window Register](assets/service-level-indicator-window-register.md) for formulas, windows, targets-as-inputs, incidents, and evidence quality.
- Use [Capacity and Change Scenario Register](assets/capacity-change-scenario-register.md) for traffic profiles, headroom, failure/maintenance scenarios, and rollback prerequisites.
- Join all three in [Telecom Network Assurance Register](assets/network-assurance-register.md). Carry units, sources, versions, freshness, owners, uncertainty, applicable service/layer/domain, and approval state into every material row.

Stop when service identity, topology/inventory version, source authority, window, layer/direction/unit, target source, exclusion authority, usable-capacity definition, or security handling is unresolved. Preserve contradictions and stale evidence as explicit findings.

## Authority boundary

Never access, scan, query, configure, test, fail over, dispatch, alert, or change live networks; never create operational alarms, declare compliance, make customer SLA commitments, or give legal interpretations. Require authorized NOC, network engineering, reliability, security, capacity, vendor, commercial, legal, and change-management review.

## Adaptation boundary

Apply only the user-relevant-indicator, explicit-objective-window, error-budget, and written-response-policy concepts in [upstream provenance](references/upstream.md). Exclude upstream calculators, web-service assumptions, alert creation, live observability, cross-Skill/global protocols, and network or SLA authority.
