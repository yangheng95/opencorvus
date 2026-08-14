# Deal authority, perimeter, materiality, and VDR baseline

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

## Evidence governance

Every record must carry a stable artifact or row ID; exact source locator, version, and date; the authorized cutoff or effective date; owner and named qualified reviewer; applicability, entity, jurisdiction, period, currency, unit, and denominator where relevant; operator-approved assumptions; uncertainty and confidence with reasons; privacy, privilege, confidentiality, and license state; current evidence status; decision_not_made; outcome_unknown; and explicit stop/escalation conditions. Missing fields remain visibly unknown and are never inferred. Evidence is restricted to the authorized transaction perimeter and immutable source snapshot.

- artifact_id: MADD-BASELINE-001
- owner: deal diligence coordinator
- qualified_reviewer: transaction counsel, finance lead, and deal sponsor
- decision_not_made: no valuation, materiality, transaction structure, disclosure, filing, or go/no-go decision
- outcome_unknown: transaction outcome and undisclosed liabilities remain unknown

Record matter ID, buyer and target legal entities, authorized advisers, transaction form, included and excluded subsidiaries, assets, liabilities, geographies, periods, currencies, accounting basis, Virtual Data Room (VDR) snapshot identifier and digest, request-list version, materiality-rule issuer, privilege protocol, redaction rules, and source-access limitations. Every rule points to its operator-issued source; a numeric value without currency, denominator, period, and issuer is unusable.

Maintain stable scope IDs with included, excluded, pending, or disputed status and retain competing citations. VDR document counts are snapshot facts, not proof of completeness. Link authority and confidentiality questions to a named decision owner. All four roots must receive the identical frozen perimeter, cutoff, evidence authority, materiality rule, and snapshot IDs. Later VDR changes create a new version and never overwrite the original. Stop before remote access or party contact.
