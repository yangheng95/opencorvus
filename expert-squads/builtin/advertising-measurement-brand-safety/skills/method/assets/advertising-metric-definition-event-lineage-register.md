# Advertising metric definition and event lineage register

## Reusable evidence contract markers

- artifact_id: stable artifact or row identity
- source_id_locator: exact authoritative source locator
- source_version_date: immutable source version and applicable date
- qualified_reviewer: named discipline reviewer with decision authority
- units_and_denominator: value, unit, currency, population and denominator or not-applicable rationale
- assumptions_uncertainty: authorized assumptions, unknowns, confidence and reason
- decision_not_made: explicit professional decisions this artifact does not make
- outcome_unknown: unresolved outcome stated without inference
- stop_escalation: exact hold point, reason, escalation owner and required review

## Mandatory provenance envelope

Every record includes artifact_id or row_id; exact source locator, producer, version and date; extraction method; cutoff/effective period and time zone; owner and named qualified reviewer; campaign, property, geography and jurisdiction applicability; value, currency, unit and denominator; transformation logic; operator-approved assumptions; uncertainty/confidence with reason; privacy, consent, confidentiality and license state; decision status; decision_not_made; outcome_unknown; and explicit stop/escalation. Unknown is never converted to zero or a default.

- artifact_id: AMBS-METRIC-001
- owner: campaign taxonomy and metric-contract analyst
- qualified_reviewer: measurement governance and data engineering owners
- decision_not_made: no metric certification, platform configuration, reporting publication, or performance claim
- outcome_unknown: cross-source comparability remains unknown until contracts and lineage reconcile

Create a stable metric_contract_id for every value. Record business label, canonical event, source schema/version, eligibility population, numerator, denominator, unit, currency, time basis, event timestamp semantics, attribution window only if operator supplied, filters, deduplication key, identity resolution, sampling, modeled fields, invalid-traffic treatment, late-arrival/backfill/restatement behavior and transformation owner. Trace source event through collection, validation, normalization, join, aggregation and report with code/query/config version locators where authorized.

Maintain separate rows for source-reported, filtered, modeled and analyst-derived values. Record schema drift, clock mismatch, duplicate keys, null policy, consent gating, bot flags, excluded geographies, and known outages. Comparable status requires compatible definitions and populations; label similarity is insufficient. Conflicting contracts remain parallel and route to reviewers.

A row may be draft, source-verified, lineage-verified, incomparable, superseded or reviewer-resolved. Stop if a transformation cannot be traced, source permission is unclear, a denominator is missing, or identity mapping is ambiguous. Never edit a source schema, tag or dashboard.
