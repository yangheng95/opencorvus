# Post-incident Contributing-factor and Action Register

## Evidence contract

Record `artifact_id`, `row_id`, review/incident/service/observation/factor/hypothesis/action IDs, source locator/version/date/hash, evidence cutoff/effective date, event/time-window identity, value/unit/denominator where applicable, owner, qualified facilitator/service/SRE/security/change reviewer, applicability/jurisdiction, assumptions, uncertainty/confidence, privacy/license boundary, status, `decision_not_made`, `outcome_unknown` and `stop_or_escalation`.

The register supports blameless learning. It does not assign fault, declare legal or security attribution, approve root cause, create an operational deadline, mutate a ticket or close an action.

## Observation and factor rows

Record direct observations separately from interpretations. For every candidate contributing factor, link supporting evidence, counterevidence, expected control/design/runbook version, observed behavior, affected part of the timeline and confidence. Consider technical, dependency, process, organizational, detection, response and recovery conditions. Do not stop at the nearest human action or use “human error” as an unsupported terminal cause.

## Hypothesis and causal-boundary rows

State each hypothesis in testable terms, the evidence it explains, evidence it does not explain, alternative hypotheses and missing tests. A root-cause label requires qualified human approval and complete evidence; otherwise keep `contributing_factor`, `hypothesis` or `unknown`. Preserve security attribution for the authorized security process.

## Action rows

Record action ID, linked problem/evidence, intended measurable outcome, action type, owner, reviewer, dependency, approval/change reference, verification method, source system, supplied due state and lifecycle status. Keep proposed, accepted, in progress, implemented, verified effective, ineffective, superseded and unknown distinct. Do not invent priority, deadline, severity or closure.

## Stop and review

Stop for missing evidence cutoff, disputed incident identity, active legal/HR/security investigation outside authority, personal data outside scope, unsupported causal claim, ownerless action or request to mutate production/tickets. `decision_not_made` states no blame, attribution, root cause, severity, change, release, communication, action priority/deadline or closure decision was made.
