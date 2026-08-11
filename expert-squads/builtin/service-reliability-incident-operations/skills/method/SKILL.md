---
name: service-reliability-incident-operations-method
description: Prepare traceable service-level, observability, alert-quality, incident coordination, handoff, post-incident learning and action evidence for qualified reliability review. Use for bounded historical or current evidence organization without severity declaration, paging, production mitigation, external communication, security attribution or unsupported root-cause claims.
---

# Service Reliability Incident Operations Method

Use this method to assemble evidence without assuming incident-command or production authority. Read [the upstream and modification record](references/source-provenance.md) before applying adapted runbook, handoff or postmortem structures. The exact upstream [MIT license](references/LICENSE-MIT.txt) is preserved.

## Freeze service and review authority

1. Record review ID, service/catalog identity, business capability, environment, regions, tenant/data boundary, owners, dependencies, SLI/SLO policy versions, telemetry and alert configuration versions, incident/change IDs, evidence cutoff, time-zone/clock basis, privacy boundary and qualified reviewers.
2. Assign stable IDs to services, components, dependencies, user journeys, service-level indicators, objectives, windows, events, telemetry signals, queries, alerts, incidents, impact claims, roles, decisions, changes, handoffs, observations, factors, hypotheses, actions and verification evidence.
3. For every row record source locator/authority/version/date, event and ingestion timestamps, unit/denominator, owner, qualified reviewer, applicability, assumptions, uncertainty, privacy/license boundary, status, `decision_not_made`, `outcome_unknown` and stop/escalation reason.
4. Keep source fact, telemetry observation, human observation, interpretation, hypothesis, decision, attempted action, external effect and verified outcome separate.
5. Treat absent service ownership, time basis, source authorization, current query/configuration, command authority, incident identity or qualified reviewer as a stop condition.

Begin with [the service, SLI, SLO and error-budget baseline](assets/service-sli-slo-error-budget-baseline.md).

## Reconcile SLI, SLO and error-budget evidence

1. Freeze each service-level indicator definition: event population, good-event predicate or measured quantity, source/query, unit, aggregation, exclusions, missing-data rule, window and version.
2. Freeze each service-level objective as a supplied approved policy. Record target and comparison operator only from that policy; the Skill contains no universal objective, severity or release threshold.
3. Reproduce historical calculations using the exact query/configuration and immutable input cutoff when available. Preserve numerator, denominator, excluded events, late data, corrections and uncertainty.
4. For event-based availability, compute `good_events / valid_events` only when both sets and validity rules are supplied. For latency or other distributions, retain statistic, population, unit and aggregation rather than reducing them to an unlabeled number.
5. Compute error-budget allowance, consumption or remaining evidence only from the approved SLO definition and measurement window. Keep policy interpretation and engineering decision outside the calculation.
6. Preserve SLI disagreement across client, edge, service, dependency and synthetic perspectives. Do not select the most favorable signal.

## Map observability and alert quality

1. Inventory metrics, logs, traces, events, synthetics, probes and business signals by signal ID, producer, collector, query, labels/dimensions, sampling, retention, clock, schema and access boundary.
2. Trace every alert state to condition/query version, evaluation window, source signals, routing configuration, owner and observed notification record. Do not run the query against production unless the user has separately authorized that operation; prefer supplied frozen results.
3. Assess signal completeness, freshness, continuity, cardinality limits, sampling, saturation, missing regions/tenants, aggregation loss and instrumentation changes.
4. Reconstruct alert episodes with fired/resolved timestamps, incident linkage, duplicate/suppressed state, acknowledged record and disposition supplied by humans. The method assigns no universal severity or response target.
5. Separate actionable, informational, noisy, duplicate, stale, blind-spot and unknown classifications as review candidates with evidence and reviewer, not automatic routing changes.
6. Record the result in [the observability and alert signal-quality ledger](assets/observability-alert-signal-quality-ledger.csv).

## Build incident coordination and handoff evidence

1. Use the declared incident commander and organization process as authority. This package records but never declares an incident, assigns roles, pages responders or changes severity.
2. Build an append-only timeline from source events. Record source timestamp, ingestion timestamp, clock/time zone, actor/system, event type, observation, decision or attempted action, evidence locator, confidence and correction lineage.
3. Record impact claims with affected service/journey/region/tenant, start/end bounds, quantity/unit/denominator, source, method and uncertainty. Never infer customer impact from an alert alone.
4. Maintain role and authority evidence for incident command, technical leads, communications, service ownership, security, change approval and external liaison. A missing role remains a gap.
5. For handoff, record current state, active hypotheses and counterevidence, actions attempted and verified outcomes, pending authorized work, risks, dependencies, source links, decision log, next review and explicit acknowledgement evidence.
6. If an attempted external action has no authoritative result, record `outcome_unknown` and require reconciliation before retry. Do not tell a responder to repeat an ambiguous command.
7. Use [the incident timeline, impact, command and handoff register](assets/incident-timeline-impact-command-handoff-register.md).

## Prepare blameless learning and actions

1. Define the review scope, participants, evidence cutoff and facilitation authority. Preserve human impact and operational context without naming blame as cause.
2. Separate chronology, observed conditions, contributing factors, hypotheses and root-cause claims. Require evidence and counterevidence for every factor; use “unknown” when the causal chain is incomplete.
3. Examine technical, process, organizational, dependency, detection, response and recovery conditions without treating the nearest human action as a terminal explanation.
4. Compare expected controls and observed behavior only against versioned runbooks, designs, policies, tests or change records. Do not assume that documentation matched production.
5. Record lessons as bounded evidence statements. Record actions with action ID, problem/evidence link, intended outcome, owner, reviewer, dependency, verification method and supplied due state; never invent a deadline or close an action from narrative alone.
6. Distinguish proposed, accepted, in progress, implemented, verified effective, ineffective, superseded and unknown states. Only an authorized owner changes workflow state.
7. Use [the post-incident contributing-factor and action register](assets/postincident-contributing-factor-action-register.md).

## Join the evidence

1. Require all four branch reports and hashes. Do not synthesize a missing SLO, observability, incident or learning branch.
2. Reconcile service/dependency identity, time semantics, SLI/SLO versions, signal/query versions, incident events, impact bounds, roles, attempted actions, handoffs, factors and action ownership.
3. Preserve conflicts between telemetry, logs, tickets, chat exports, change records, human accounts and customer-impact sources. Record correction lineage instead of overwriting.
4. Produce [the service reliability qualified-review pack](assets/service-reliability-qualified-review-pack.md) containing branch hashes, contradiction table, unknowns, evidence-backed findings, action evidence and required qualified decisions.
5. Mark `decision_not_made` for severity, declaration, mitigation, rollback, deployment, communication, security attribution, root cause, SLO policy, release gate and action closure decisions not made by this package.

## Stop and escalate

Stop for an active life-safety condition, missing production authorization, ambiguous service or incident identity, unverified clock mismatch, confidential data outside scope, absent current query/configuration, unsupported impact or causal claim, ambiguous external effect, or any request to page, command, mutate or communicate.

Never declare severity or incident state; page or assign responders; run production commands; restart, scale, fail over, roll back, deploy or change configuration; send status messages; contact customers or vendors; attribute a security incident; assign blame; declare root cause; or approve closure. Route live decisions to the incident commander, service owner, on-call responders, security authority, communications lead, change approver and qualified Site Reliability Engineering reviewers.
