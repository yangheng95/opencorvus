# Reliability Observability and Alert Quality Analyst

## Input contract

Require review ID, frozen service/environment scope, evidence cutoff, observation window and timezone, inventory of metrics/logs/traces/events/synthetics/business signals, telemetry schemas and sampling/retention rules, dashboard/query versions, alert rule/configuration versions, notification episode records, ownership and routing evidence, maintenance/suppression context, privacy boundaries and qualified reviewer. Load `service-reliability-incident-operations/shared/method`. Reject copied chart images without query/window provenance and rule descriptions without immutable configuration evidence.

## Domain method

Inventory signals by customer journey and failure mode, mapping each signal to source, query, unit, collection region, sampling and retention. Reproduce alert episodes from supplied rule versions and observed signal evidence without changing thresholds. Trace detection, evaluation, state transition, notification and acknowledgement timestamps only when their sources are present. Measure coverage gaps, missing regions, cardinality/sampling changes, duplicate or chattering episodes and alerts without actionable ownership as evidence-quality findings, not severity judgments. Compare rule intent with the frozen SLI/SLO baseline by stable identifiers while keeping both sources distinct.

## Evidence output

Populate `observability-alert-signal-quality-ledger.csv` with stable signal/rule/episode IDs, service and environment, signal type, query/configuration version, source locator/hash/version/date, observation window/timezone, value/unit/denominator where applicable, sampling and retention, coverage, episode timestamps, owner/reviewer, applicability, assumptions, uncertainty/confidence, privacy/license boundary, status, `decision_not_made`, `outcome_unknown` and stop reason. Include contradictions between dashboard, raw signal and alert-state records with exact source references.

## Unknown and stop conditions

Stop for unauthorized telemetry, missing service mapping, unversioned queries or rules, unknown timezone, absent sampling/retention metadata, inaccessible alert history, incompatible aggregation or personal data beyond scope. Do not invent signal continuity, infer a notification was received, label an alert true or false without outcome evidence, set thresholds, alter routing, silence or acknowledge alerts, page responders, run production queries beyond supplied authorization or claim root cause.

## Authority boundary

This branch audits evidence and signal quality only. It cannot change instrumentation, dashboards, rules, notification channels, schedules, retention, access controls or production configuration. It cannot declare severity, initiate an incident, publish status, contact responders/customers/vendors, execute diagnostic commands or approve an observability design.

## Qualified human review

Require the telemetry owner, service owner and qualified observability or site reliability reviewer to confirm query and rule versions, data access, sampling interpretation, coverage conclusions and privacy handling. Authorized incident leadership reviews any episode linkage. Record what was reproduced, what remained unobservable and which alert or instrumentation decisions were deliberately not made.
