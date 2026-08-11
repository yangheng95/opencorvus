# Entity Governing Authority Register

## Purpose

Freeze entity and governing-record evidence. This is a reusable evidence structure for Corporate Governance Entity Secretariat; it is not a completed determination, approval or operational instruction.

## Artifact control

| Field                   | Required value                                                                       |
| ----------------------- | ------------------------------------------------------------------------------------ |
| artifact_id             | Stable package/domain identifier                                                     |
| artifact_version        | Immutable revision or dated draft                                                    |
| scope_and_applicability | Exact object, population, facility, entity, system, jurisdiction or case boundary    |
| evidence_cutoff         | Timestamp and timezone after which evidence is excluded                              |
| source_id_locator       | Resolvable record, document, dataset or observation pointer                          |
| source_version_date     | Version plus effective, observation and retrieval dates                              |
| owner                   | Person or role accountable for the source                                            |
| qualified_reviewer      | Named professional role; blank means review is not complete                          |
| units_and_denominator   | Unit, basis, denominator and formula version, or explicit not applicable             |
| assumptions_uncertainty | Assumptions, missingness, confidence and competing explanations                      |
| privacy_license         | Access, privacy, confidentiality and reuse boundary                                  |
| status                  | observed, supplied_interpretation, derived, hypothesis, blocked or decision_not_made |
| stop_reason             | Why analysis or reconciliation cannot continue                                       |

## Domain records

Use one row or section per stable record. Required fields:

- entity_id_legal_name
- jurisdiction_type
- official_status_as_supplied
- charter_bylaw_agreement_revision
- governing_body
- member_officer_role
- delegation_resolution_source
- counsel_owner

Each record also includes evidence ID, source locator, version/date, applicability, owner, reviewer, uncertainty, status and decision not made. Never collapse separate sources into one row merely because they appear consistent.

## Procedure

1. Freeze the controlling scope and evidence cutoff from the orchestrator.
2. Copy identifiers and observations only from authorized sources; preserve raw value, normalized/derived value and transformation separately.
3. Record units, denominator, time basis and formula/version before comparison.
4. Link every supplied interpretation or hypothesis to supporting and contradicting evidence IDs.
5. Run the checks below and record pass, fail, unknown or not applicable with evidence.
6. Assign every gap, conflict and decision question to a qualified owner; never self-close it.

## Reconciliation checks

- entity identity consistent
- effective versions known
- authority not inferred

Also verify source/version alignment, unique stable IDs, date chronology, unit and denominator compatibility, duplicate evidence, cross-asset references and qualified-review ownership. A failed or unknown check remains visible.

## Completion boundary

The asset is complete only when every row has source/version/date, applicability, owner, reviewer, uncertainty, evidence pointer and status, and when all unresolved issues have a named owner. Completion of the template does not mean the underlying professional decision is approved. Record `decision_not_made: true` until the authorized reviewer supplies a separately traceable decision.
