# Technology Cost Scope and Billing-source Baseline

## Evidence contract

Record `artifact_id`, `row_id`, review and organization IDs, provider/tenant/account/subscription/project identity, technology category, billing/service/usage periods, evidence cutoff and effective date, currency and unit conventions, time zone, data class, source authorization, source locator/schema/version/generation date/hash, owner, qualified FinOps/engineering/finance/accounting reviewers, applicability/jurisdiction, assumptions, uncertainty/confidence, privacy/license boundary, status, `decision_not_made`, `outcome_unknown` and `stop_or_escalation`.

This baseline identifies evidence sources. It does not authorize account access, export generation, budget creation, commitment purchase, resource change, accounting treatment, tax treatment or vendor contact.

## Scope rows

Create one row per provider and organizational boundary. Include account hierarchy source, billing relationship, invoice entity, functional/transaction currencies, supplied exchange-rate policy, covered services/workloads/products, excluded scope and reason, billing and service periods, data cutoff, source custodian and access authorization reference. Do not infer jurisdiction, ownership or business mapping from account names or tags.

## Source inventory

For every billing export, invoice, contract, usage source, cost-management report and approved business metric, record native grain, key fields, units, currency/sign convention, schema/version, generation and ingestion timestamps, adjustment/restatement behavior, retention, query/import mechanism, checksum and source-of-record status. Mark sampled, estimated, preliminary, revised or incomplete sources explicitly.

## Reconciliation plan

Define authoritative totals and comparison dimensions before calculation: provider, account, invoice, currency, billing period and charge category as applicable. Record the approved tolerance source rather than embedding a default. Keep tax, credit, refund, marketplace, support, commitment amortization and currency conversion treatment separate until the owner supplies a rule.

## Unknown and review queue

List missing exports, mixed account identity, schema gaps, sign/currency conflicts, inaccessible contracts, late adjustments, confidential fields, unclear system-of-record ownership and reviewer needs. Stop when identity, authorization, currency, schema or cutoff cannot be reconciled. `decision_not_made` must state that no budget, purchase, accounting entry, tax position, deployment, deletion, policy enforcement, vendor action or savings approval was made.
