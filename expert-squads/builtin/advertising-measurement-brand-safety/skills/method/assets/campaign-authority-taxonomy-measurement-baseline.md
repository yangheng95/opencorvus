# Campaign authority, taxonomy, and measurement baseline

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

- artifact_id: AMBS-BASE-001
- owner: measurement governance owner
- qualified_reviewer: media owner, measurement scientist, privacy/legal reviewer, and brand owner
- decision_not_made: no campaign activation, taxonomy change, metric approval, claim approval, or risk acceptance
- outcome_unknown: delivery, suitability and performance outcomes remain unknown

Freeze written authority, advertiser and brand, campaign/insertion-order/line-item/creative/placement identifiers, property/collection/content hierarchy, channel, device, geography, audience, objective, reporting cutoff and time zone, currency, permitted sources, privacy/consent constraints, and reviewers. Store immutable snapshot IDs and digests. Maintain a cross-source identity table with effective dates, mapping owner, cardinality, aliases and unresolved collisions; never treat display names as unique keys.

For each metric record definition owner/version, event, eligibility, numerator, denominator, unit, time basis, filters, deduplication, sampling, modeled fields, currency conversion, late-arrival and restatement policy, invalid-traffic treatment and attribution-window source. Bind suitability policy versions and experiment protocols to the same baseline. All four roots use this exact version. A changed campaign, source snapshot, metric contract or policy creates a new baseline rather than overwriting evidence.

Stop on missing authority, denominator, time zone, currency, consent, policy version, source digest or reviewer. No remote connection or state change is permitted.
