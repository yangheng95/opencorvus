---
name: one-person-company-operating-system-method
description: Build a source-grounded operating system for a one-person or owner-operated company across offer and demand, revenue and obligations, delivery capacity, customer state, automation approvals, observability, and resilience. Use for a whole-company weekly operating review, commercial profile configuration, cross-functional reconciliation, or owner decision queue without executing external actions or replacing specialist professional review.
---

# One Person Company operating-system method

## Purpose

Treat a One Person Company as an owner-operated business model, not as a legal-form determination and not as several imaginary executives. The goal is one versioned operating state that lets the owner see what is known, what conflicts, what needs approval, what requires a specialist, and what can safely happen next. Use stable identities and source evidence so the same transaction, customer promise, workflow run, or obligation cannot be counted differently by separate functional views.

Read `references/opc-config.schema.json` before using a packaged profile. The four files in `examples/` are complete commercial examples of the same schema. Select an example only when its `business_model`, systems, and authority boundary fit; otherwise create a custom instance of that schema from operator evidence. Never treat a profile as credentials, connector authorization, or permission to write.

## Freeze the operating boundary

Before analysis, record:

1. Company and profile ID/version, business model, stage, operating state, evidence cutoff, and profile digest.
2. Owner approval identity and every qualified external reviewer. If one person prepares and reviews, record `self_review`; never claim independence or separation of duties.
3. IANA time zone and tzdb version, functional currency, transaction currencies and authorized exchange-rate sources, locales, fiscal boundary, and every relevant jurisdiction. Do not infer jurisdiction from currency, language, address, or brand.
4. Systems of record, source versions, refresh/freshness, reconciliation keys, data class, owner, connector/import boundary, and authorization references. Secret material is never accepted; only provider-neutral secret references and their owner/scope metadata are evidence.
5. Offer, customer, channel, funnel stage, order/contract/project/subscription/content, invoice/payment/refund, fulfillment/entitlement, workflow, approval, and obligation identities.
6. Decisions explicitly outside the review and external actions that require owner or qualified professional approval.

Stop if the company, authority, system of record, clock, currency, jurisdiction, or evidence cutoff is too ambiguous to produce a reproducible comparison.

## Run four independent evidence branches

### Offer, demand, and experiments

Freeze offer and price versions, target customer or audience, channel, funnel-stage entry rule, attribution window, and source cutoff. Separate observed behavior, stated intent, inferred explanation, and unknown. Every metric records its business definition, formula version, numerator, denominator, unit, population, window, source, owner, and uncertainty. Every experiment records hypothesis, intervention, population, exposure, success measure, guardrail, result, counterevidence, cost/capacity dependence, and stopping rule. Never invent a universal conversion target, market-size claim, or product-market-fit conclusion.

### Revenue, cash, costs, and obligations

Preserve original transaction amount and currency. Join order or contract, invoice, processor, refund/chargeback, bank, and accounting evidence by stable keys; never silently net incompatible states. Keep billed, collected, refunded, disputed, receivable, and recognized-as-supplied concepts distinct. A currency conversion preserves source amount, converted amount, rate, source, timestamp, and rounding rule. Obligation evidence records jurisdiction, authoritative source, version/effective date, trigger, applicability question, owner, professional reviewer, and current evidence state. The method does not choose account classification, tax treatment, deduction, filing duty, deadline, solvency conclusion, or investment action.

### Delivery, customers, and capacity

Use the delivery unit appropriate to the profile: service request, seat, subscription, order, download, content item, deliverable, project hour, inventory unit, or another operator-defined unit. Build state transitions only from controlled definitions. Keep requested, accepted, scheduled, in progress, delivered, acknowledged, disputed, refunded, and unknown separate. Bind each promise to its source/version, customer/order/project ID, due window, acceptance evidence, dependency, capacity consumption, exception, and owner. Reconcile demand with available owner capacity after unavailable time and existing commitments; do not promise dates or infer entitlement.

### Automation, approvals, and resilience

Trace every workflow from versioned input and source cutoff through decision logic, approval reference, action class, external effect, output locator, duration/cost, result, retry, error, and reconciliation. Classify read, draft, reversible internal write, and external/irreversible action distinctly. Default `automation_mode` is `observe_and_draft`; default `external_write`, `auto_approve`, and `auto_retry` are false. A retry can enter an approval queue only when idempotency, reversibility, current authorization, bounded cost, and outcome reconciliation are all evidenced. Any timeout or disconnection around an external action becomes `outcome_unknown`; reconcile the system of record before considering retry.

Record logs, metrics, traces, and business events with stable event/correlation IDs, workflow and input versions, source cutoff, approval, action class, external effect, duration/cost, result, retry, error, and output locator. Do not access secret bytes, enable connectors, deploy, change permissions, or execute workflows.

## Join into one operating review

The join must reconcile these cross-branch chains before priority decisions:

- offer -> customer/channel -> funnel event -> commercial outcome;
- order/contract -> invoice -> processor -> bank/accounting evidence;
- promise -> capacity -> delivery/entitlement -> acceptance/support outcome;
- proposed action -> workflow version -> approval -> external effect -> observability -> reconciliation;
- obligation -> source/effective date -> trigger -> evidence -> owner/professional decision.

Do not add branch totals until identity, unit, denominator, clock, cutoff, currency, and state definitions agree. Preserve contradictions and unmatched events. A priority item needs an evidence-backed objective, benefit/risk, required capacity, cash effect as supplied, dependency, reversible next step, owner, approval class, professional review, uncertainty, and stop condition. Return a small owner decision queue and a separate qualified-review queue, not a long unranked task list.

Complete the five core assets in `assets/`. Every material row carries stable identity, source locator/version/date, cutoff/effective date, quantity/unit/denominator, owner, reviewer, applicability/jurisdiction, assumptions, uncertainty, privacy/license boundary, status, approval reference, `decision_not_made`, `outcome_unknown` when relevant, and stop/escalation.

## Commercial profile behavior

- `examples/micro-saas.json` joins subscription, entitlement, product analytics, support, deployment/availability, billing, and accounting evidence. Pricing, refund, deployment, migration, entitlement, terms/privacy, and customer-data actions always require approval.
- `examples/consulting.json` joins opportunity, proposal/contract, capacity, deliverable, invoice/payment/expense, and client-communication evidence. Proposal release, scope/price change, signature, subcontractor engagement, deliverable release, invoice, refund, and client commitment remain external actions.
- `examples/creator-media.json` joins content/rights, editorial calendar, platform/audience, newsletter/customer, sponsor/affiliate, and payment evidence. Publication, sponsored claims, rights use, disclosures, audience export, pricing, and refunds require approval.
- `examples/digital-product-commerce.json` joins catalog/SKU/rights, order, payment/refund, entitlement/download/fulfillment, optional inventory/vendor, support/returns, accounting, and tax-configuration evidence. Reconcile order, payment, and fulfillment sources before any retry; never double-charge, double-refund, or double-fulfill.

Examples provide field shape and commercial operating completeness, not vendor endorsements, universal benchmarks, legal rules, or pre-authorized connectors.

## Authority and professional boundary

Never send, publish, pay, refund, sign, file, deploy, delete, change access, contact a customer or authority, or represent an external effect as complete without evidence. Never provide legal, tax, accounting, investment, financing, insurance, employment, privacy, regulated, medical, or security conclusions. Route specialist scopes to the matching Expert Squad and named qualified professional. The owner retains every public claim, price, discount, contract, payment, refund, procurement, tax filing, data export/deletion, production deployment, permission/secret, and bulk-contact decision.

## Provenance

This Skill is clean-room OpenCorvus work. `references/upstream-decisions.md` records investigated candidates and why no text was reused. `references/sources.md` records public method anchors. Those sources inform evidence categories and stop boundaries; they do not authorize copied protected playbooks, fixed jurisdictional rules, or claims that the package is legal, tax, accounting, financial, security, or operational advice.
