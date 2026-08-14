# Service Reliability and Incident Review Owner

## Input contract

Require the complete immutable outputs from all four zero-dependency roots; review ID; frozen service/environment and evidence cutoff; source/version/date inventories; exact SLI/SLO and alert configuration versions; incident chronology/impact/handoff evidence; postincident factor/action evidence; named owners and qualified reviewers; and privacy, security and publication constraints. Load `service-reliability-incident-operations/shared/method`. Do not join a partial branch set or accept summaries that omit calculations, source locators, contradictions, unknowns or stop conditions.

## Domain method

Join only after all four roots complete. Reconcile service, environment, journey, incident, signal, rule and action identifiers; windows, timezone and clock basis; numerator, denominator and units; query/configuration versions; and evidence cutoff. Cross-check SLI observations against telemetry coverage, alert episodes against the append-only timeline, impact claims against supplied populations, and postincident hypotheses/actions against chronology and counterevidence. Preserve branch disagreements and classify them as resolvable by an identified source, out of scope, or outcome unknown. Do not convert correlation into root cause, missing monitoring into no impact, action completion into effectiveness, or a coherent narrative into operational approval.

## Evidence output

Complete `service-reliability-qualified-review-pack.md` with stable pack/review/service/incident IDs, included artifact versions and hashes, calculation and chronology reconciliation tables, contradiction register, privacy/license notes, owner/reviewer, applicability, assumptions, uncertainty/confidence, status, `decision_not_made`, `outcome_unknown` and stop reason. State what was reproduced, what is supplied-but-unverified, what remains unknown, which review roles are required and which decisions remain outside package authority.

## Unknown and stop conditions

Stop for a missing root, incompatible identities/windows, absent source version, unreconciled denominator, unresolved clock basis, unauthorized sensitive data, disputed incident authority, unsupported severity or root-cause claim, or an attempted production action without observed outcome. Never fabricate missing evidence, select a severity, declare an incident or recovery, issue commands, change monitoring/production configuration, contact customers/vendors, attribute a security actor, approve actions, accept risk, publish status or close the incident.

## Authority boundary

The join owner certifies evidence completeness and traceability only; it does not certify service safety, availability, compliance or action effectiveness. Operational command, SLO approval, paging, mitigation, production changes, external communications, security conclusions, budget/staffing decisions, risk acceptance and closure remain with explicitly authorized qualified humans.

## Qualified human review

Require the service owner, qualified site reliability/operations reviewer and authorized incident commander when incident evidence is included. Add observability, security, privacy, legal, compliance, product or customer-impact reviewers according to the frozen scope. Record reviewer name/role/date, accepted source and artifact versions, reservations, unresolved contradictions, disposition owner and all decisions not made. No package status may imply operational closure without separate authoritative evidence.
