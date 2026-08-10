---
name: insurance-claims-operations-method
description: Build traceable insurance-claims evidence packs from claim records, supplied policy text, and process-control evidence. Use for claim intake review, evidence gaps, policy traceability, handoff analysis, and human adjudication preparation without making coverage, fraud, reserve, settlement, or payment decisions.
---

# Insurance Claims Operations Method

## Intake and evidence model

1. Freeze claim ID, line of business, event and first-notice times with time zones, supplied jurisdiction, evidence cutoff, currency and valuation date, authorized sources, privacy/privilege boundary, policy and endorsement versions, and licensed decision owners.
2. Assign stable IDs to sources, events, parties, documents, items, clauses, controls, and transactions. Keep observation, attributed assertion, calculation, interpretation question, conflict, and unknown distinct.
3. Run chronology/custody, policy traceability, and controls/financial reconciliation independently. Join only their complete, versioned outputs.

## Domain rules

- Record reported, occurred, created, received, and modified times separately. Preserve source locator, custodian, original/copy/hash status, and evidence version.
- Deduplicate damage or expense items before arithmetic. Compute `unexplained variance = supplied total - supported unique items` only after normalizing currency, valuation date, tax treatment, and units through a declared rule. This is evidence reconciliation, not an allowability or coverage decision.
- Inventory supplied policy documents and endorsement precedence metadata. Map clauses to fact IDs as matched, missing, conflicting, ambiguous, or review required. Never convert that trace into coverage or legal interpretation.
- Reconcile reserve or payment data only using the supplied transaction semantics and roll-forward definition. Show opening, movements, closing, transaction IDs, formula, and variance. Do not invent signs or set a reserve.
- Treat a fraud indicator as a source-attributed control signal, not a finding about a person. Preserve the operator-supplied indicator definition and route it to authorized specialists.
- Check handoff receipt/completion times, queue duration, maker-reviewer-approver separation, payment references, privacy/access controls, and documented approvals without certifying effectiveness.

## Assets and join

- Use [Claim Event and Custody Ledger](assets/claim-event-and-custody-ledger.md) for chronology, parties, documents, damage, and expense evidence.
- Use [Policy and Endorsement Fact Trace](assets/policy-endorsement-fact-trace.md) for supplied document versions and clause-to-fact questions.
- Use [Claim Financial and Control Register](assets/claim-financial-control-register.md) for reserve/payment reconciliation, handoffs, indicators, privacy, and approvals.
- Join all three in [Claims Evidence Register](assets/claims-evidence-register.md). Carry units, sources, versions, owners, uncertainty, applicable domain, conflicts, and review status into every material row.

Stop when identity, authorization, policy version, transaction semantics, currency/unit normalization, custody, or privacy scope is unresolved. Retain empty fields as visible gaps; do not manufacture confidence.

## Authority boundary

Never decide coverage, liability, fraud, reserve, settlement, denial, approval, or payment; never provide legal or insurance advice; never mutate a claim system, contact a claimant, or initiate an investigation. Route material conclusions to authorized licensed adjusters, counsel, special-investigation professionals, privacy owners, finance reviewers, and payment approvers.

## Adaptation boundary

Apply only the stage-ownership, wait-time, bottleneck-evidence, and handoff-mapping concepts recorded in [upstream provenance](references/upstream.md). Do not import upstream scripts, scoring thresholds, generic process mutation, global agent protocols, or claims adjudication authority.
