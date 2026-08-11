# Service Reliability Qualified-review Pack

## Package identity and provenance

Record `artifact_id`, package/version/hash, service and incident scope, evidence cutoff, time-zone/clock basis, SLI/SLO/query/alert/incident/change/process versions and dates, branch artifact hashes, quantities/units/denominators, owner, qualified service/SRE/incident-command/observability/security/change/communications reviewers, applicability/jurisdiction, assumptions, uncertainty/confidence, privacy/license boundary, status, `decision_not_made`, `outcome_unknown` and `stop_or_escalation`.

This is a joined evidence pack. It is not an incident declaration, operational runbook, production command, status communication, security attribution, root-cause approval or action-closure record.

## Required branch closure

1. SLI/SLO/error-budget branch: service baseline hash, approved definitions, query/input versions, numerator/denominator, exclusions, windows, reproduced calculations, blind spots and policy decisions excluded.
2. Observability/alert branch: signal ledger hash, instrumentation and query versions, freshness/completeness, sampling, alert episodes, routing evidence, duplicates/suppression, blind spots and unknowns.
3. Incident/handoff branch: append-only timeline hash, impact definitions, clock reconciliation, declared roles, decision log, attempted-action outcomes, pending work and acknowledged handoff evidence.
4. Post-incident branch: observation/factor/hypothesis/action register hash, counterevidence, causal limits, action ownership, verification method and lifecycle state.

## Joined evidence and contradictions

For every statement record claim ID, classification as source fact/telemetry observation/human observation/calculation/interpretation/hypothesis/decision/attempted action/verified outcome/unknown, exact source row, timestamp, formula/unit, reviewer and uncertainty. Reconcile service/dependency identity, time, SLI/SLO, query/configuration, alert, incident, impact, role, action and handoff conflicts without selecting a convenient source.

Separate detection from impact, attempted mitigation from verified effect, contributing factor from root cause, and implemented action from verified effectiveness. Preserve missing telemetry and unverified handoff acknowledgement as gaps.

## Decision and stop matrix

List every open evidence need, accountable owner, qualified reviewer and external decision system. Stop for active life-safety risk, missing command authority, ambiguous service/incident identity, incompatible clocks, stale query/configuration, unsupported impact or causal claim, confidential data outside scope, security/legal investigation boundary or ambiguous external effect.

`decision_not_made` enumerates no severity, incident declaration, paging, responder assignment, mitigation, rollback, deployment, alert/SLO policy, internal/external communication, security attribution, blame, root cause, release or action-closure decision. `outcome_unknown` remains until authoritative operational records reconcile an ambiguous effect.
