# Incident Timeline, Impact, Command and Handoff Register

## Provenance and authority

Each row records `artifact_id`, `row_id`, incident/service/component/dependency/change/role/handoff IDs, source locator/authority/version/date/hash, evidence cutoff/effective date, source event and ingestion timestamps, time zone/clock, value/unit/denominator where applicable, owner, incident-command authority, qualified reviewer, applicability/jurisdiction, assumptions, uncertainty/confidence, privacy/license boundary, status, `decision_not_made`, `outcome_unknown` and `stop_or_escalation`.

This register organizes supplied evidence. It does not declare an incident or severity, assign a role, page a responder, run a command, approve mitigation or send a communication.

## Append-only timeline

Record each detection, observation, alert, decision, attempted action, change, handoff and verified outcome as a separate event. Preserve the original event time, source time, ingestion time, actor/system, source locator and correction lineage. Never rewrite an earlier event to make the sequence cleaner. Record clock offset, uncertain bounds and conflicting sources.

For attempted actions, record action class and reference, authorized actor, approval reference, intended effect, external-effect identity and authoritative result evidence. If no authoritative result exists, set `outcome_unknown`; require reconciliation before any retry. Do not include executable commands or tell responders what to run.

## Impact evidence

Record impacted journey/service/region/tenant, start/end bounds, affected/eligible numerator and denominator, quantity/unit, source and method. Keep alert state, technical degradation, user-visible impact, support reports and business effect separate. An alert alone does not prove customer impact.

## Command and handoff evidence

Record incident commander, technical lead, communications, service owner, security and change-approval roles only from the declared process. For each handoff preserve current state, active hypotheses and counterevidence, attempted actions and verified outcomes, pending authorized work, risks, dependencies, decision log, key sources, next review and explicit acknowledgement. Missing acknowledgement remains unknown.

## Stop and review

Stop for active life-safety risk, absent command authority, ambiguous incident/service identity, unverified clock mismatch, confidential data outside scope, unsupported impact, ambiguous action result or any request to page, command, mutate or communicate. `decision_not_made` states no severity, declaration, role, mitigation, rollback, deployment, communication, attribution, root cause or closure decision was made.
