---
name: corporate-treasury-liquidity-operations-method
description: Corporate cash-position, forecast, funding, payment, settlement, bank-account and reconciliation evidence operations without payment, trade, borrowing, hedge, accounting or investment authority. Use for Select for bank/account/authority inventory, daily cash position, forecast variance, liquidity scenarios, funding maturity, payment queue, settlement evidence, bank fee/signatory/control or reconciliation review. Do not select to move money, approve payments, trade, borrow, hedge, open accounts, set limits or book entries.
---

# Corporate Treasury Liquidity Operations Method

## Purpose and authority

Produce a reproducible evidence pack for qualified review. This Skill never converts incomplete evidence into permission, safety, compliance, diagnosis, release, filing or operational authority.

- Do not initiate, approve, release, cancel or retry payments; do not move cash, trade, borrow, lend, invest, hedge, open/close accounts or change signatories/limits.
- Do not make accounting, tax, legal, covenant, liquidity-adequacy, credit or investment conclusions and do not contact banks or counterparties.
- Treasurer, payment operations, controller/accounting, risk, legal/tax and authorized bank/counterparty owners retain decisions.

## Freeze the review baseline

Before analysis, freeze:

- legal entities, currencies, accounts, banks, ownership, signatories and treasury-system versions
- value date, cutoff, timezone, opening position, available/ledger balance definitions and restricted cash treatment
- forecast horizon/scenario, source systems, payment/funding instruments and evidence cutoff
- treasurer, controller/accounting, payment operations, risk, legal/tax and bank relationship owners

Give every source, object, event, observation and decision question a stable ID. Record source owner, exact locator, source version, effective/retrieval/observation dates, applicability, unit and denominator, evidence cutoff, privacy/license boundary and qualified reviewer. If two branches use incompatible identity, period, unit or source versions, stop reconciliation rather than normalize silently.

## Domain evidence method

1. Build an authorized entity-account-currency map before aggregation. Separate ledger, available, collected, restricted and intraday balances as supplied; never net currencies or entities without an approved basis.
2. Reconcile opening balance plus value-dated inflows, outflows, transfers and adjustments to closing position for each account/currency. Preserve pending, rejected, returned and outcome-unknown items until bank evidence resolves them.
3. Forecast by source, value date, confidence and scenario. Compare forecast to actual on compatible bases; attribute variance to timing, amount, scope, FX basis, cancellation or data error rather than silently reforecasting history.
4. Map liquidity need, funding source, maturity, covenant/limit source as supplied, collateral/security and settlement dependency. Do not select funding, execute a transaction or judge adequacy.
5. For payments and bank operations, trace request, evidence, approval as supplied, segregation, instruction identifier, bank acceptance, settlement/finality evidence and reconciliation. A submitted instruction is not a settled payment.

Maintain five states: `observed`, `supplied_interpretation`, `derived`, `hypothesis`, and `decision_not_made`. Every derived value records formula, inputs, units, denominator and computation version. Every conflict retains both source records and a qualified resolution owner. Absence, silence and failed retrieval are never positive evidence.

## Parallel branches and join

### Treasury Cash Account Authority Analyst

Freezes entity, bank, account, currency, balance-definition, ownership, signatory and control evidence.

- entity/account/currency inventory
- bank and system-of-record
- balance definitions and restrictions
- signatory/delegation/control source

Reconcile:

- account ownership resolves
- balance types are not conflated
- authority remains as supplied

Stop when:

- unknown account ownership
- currency/balance basis conflict
- credential or signatory change requested

### Treasury Cash Position Forecast Analyst

Reconciles value-dated positions, forecasts, actuals, scenarios and variance evidence.

- opening-to-closing cash bridge
- value date and cutoff
- forecast source/confidence
- actual/forecast variance attribution

Reconcile:

- cash bridge balances per currency
- pending/outcome-unknown visible
- forecast/actual bases compatible

Stop when:

- opening balance unresolved
- value-date ambiguity
- liquidity decision requested

### Treasury Payment Funding Liquidity Analyst

Maps payment obligations, funding instruments, maturities, settlement dependencies and supplied limits without execution.

- payment queue and priority as supplied
- funding/maturity profile
- currency and settlement windows
- limit/covenant/collateral source

Reconcile:

- obligations have owner and due basis
- funding source status is evidenced
- submitted versus settled separated

Stop when:

- unapproved payment/funding request
- limit source missing
- live transaction requested

### Treasury Bank Reconciliation Control Analyst

Reconciles bank statement, treasury, ERP and instruction evidence with exceptions and control ownership.

- bank-to-book matching
- fees/interest/FX as supplied
- rejected/returned/duplicate items
- approval/segregation and bank evidence

Reconcile:

- every difference has stable ID
- duplicates and reversals handled
- settlement/finality evidence resolves

Stop when:

- unexplained material break
- source-system mismatch
- journal or bank write requested

### Corporate Treasury Liquidity Review Owner

Joins authority, position/forecast, payment/funding and reconciliation branches into a controlled treasury review pack.

- entity/account/currency alignment
- position and variance bridge
- funding/payment dependency
- exception and authorized decision queue

Reconcile:

- cash positions reconcile
- outcome-unknown remains open
- payment/funding/accounting decisions remain reserved

Stop when:

- cash baseline unresolved
- material reconciliation break
- authorized treasurer unavailable

Run the root branches independently. The join starts only after all roots return or explicitly stop. It reconciles stable IDs, versions, dates, units, denominators, cross-branch dependencies, duplicate evidence, contradictions and missing owner assignments. It cannot upgrade evidence, accept risk, sign off or perform an external action.

## Reusable assets

- `assets/treasury-entity-bank-account-authority-baseline.md`: Freeze entity/account/currency and authority evidence. Required domain fields: entity_id, bank_account_token, currency, account_purpose, balance_definitions, restricted_status, system_of_record, signatory_delegation_as_supplied.
- `assets/cash-position-forecast-variance-ledger.md`: Reconcile value-dated cash and forecast evidence. Required domain fields: account_currency, value_date_timezone, opening_balance, inflow_outflow_adjustment, closing_balance, forecast_scenario, actual, variance_amount_reason_confidence.
- `assets/liquidity-funding-maturity-scenario-register.md`: Map obligations, sources, maturities and supplied constraints. Required domain fields: obligation_id, currency_amount_value_date, funding_source_instrument, availability_as_supplied, maturity, limit_covenant_source, collateral_dependency, scenario_confidence.
- `assets/payment-settlement-bank-evidence-register.md`: Trace instruction lifecycle without moving money. Required domain fields: payment_id, request_evidence, approval_as_supplied, instruction_id, bank_acceptance, settlement_finality_evidence, rejection_return, outcome_unknown.
- `assets/treasury-reconciliation-control-qualified-review-pack.md`: Present positions, funding, payments, breaks and reserved decisions. Required domain fields: cash_baseline, position_forecast_status, funding_questions, payment_status, bank_to_book_breaks, control_exceptions, decision_not_made, authorized_treasurer.

Read each selected asset before producing output. Preserve its fields and reconciliation checks; extend it only with source-backed domain fields. Every asset must identify version, source/date, applicability, owner, qualified reviewer, assumptions, uncertainty, status, evidence pointer, decision not made and stop reason.

## Stop and escalation

Stop on identity conflict, missing authority, incompatible versions, unresolvable units or denominator, unverifiable source, unauthorized personal/confidential data, material evidence contradiction, or any request for a reserved action. Escalate immediate safety or clinical concerns through the operator's approved human channel; do not improvise a response.

## Sources and adaptation boundary

Read `references/SOURCE-PROVENANCE.md` and `references/PRIMARY-SOURCES.md` before relying on a method or current requirement. Clean-room method. Rejected joellewis/finance_skills liquidity-management material because it addresses personal wealth/liquidity rather than multi-entity corporate cash, value-date, payment, funding and bank reconciliation operations. Retained: none; no candidate text or thresholds copied. Primary sources establish method anchors only; current applicability and controlled requirements must be supplied and approved for the actual task.
