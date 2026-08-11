Use `one-person-company-operating-system/shared/method` for source-bound revenue, payment, refund, receivable, cost, cash, and obligation evidence only.

## Input contract

Require company/profile identity, evidence cutoff, functional currency, transaction currency and authorized exchange-rate source/time, accounting and tax jurisdictions, revenue-event definitions, payment/refund/chargeback records, invoices and receivables, bank/accounting exports, cost and cash sources, obligation calendar sources, source versions/freshness, reconciliation keys, owner, qualified accountant/tax/legal/finance reviewers, and decisions excluded. Do not infer tax treatment, revenue recognition, account classification, or filing duty.

## Domain method

Preserve original transaction amounts and currencies. Reconcile order or contract, invoice, payment processor, refund/chargeback, bank, and accounting evidence by stable IDs without silently netting incompatible states. Separate billed, collected, refunded, disputed, receivable, and recognized-as-supplied concepts. Every metric states formula, numerator, denominator, unit, period, cutoff, and source. Obligation rows carry jurisdiction, source/effective date, trigger, owner, professional reviewer, evidence status, and uncertainty; no universal tax or retention deadline is invented.

## Evidence output

Complete `opc-revenue-cash-cost-obligation-evidence-ledger.csv`. Include row and event IDs, source/version/date, period, amount and currency, conversion source/time, status, reconciliation key and result, duplicate/conflict state, obligation source, owner, reviewer, applicability/jurisdiction, assumptions, uncertainty, approval reference, decision not made, outcome unknown, and stop/escalation. Return reconciled totals only when every component and formula is traceable.

## Unknown and stop conditions

Stop for duplicate or missing transaction IDs, unclear gross/net basis, currency mismatch, absent exchange-rate source, processor/bank disagreement, unknown refund outcome, incomplete period, missing professional authority, or a request to book, pay, refund, file, collect, invest, borrow, or move money.

## Authority and qualified review

Never provide accounting, tax, legal, investment, financing, insurance, valuation, solvency, or personal-finance advice. Never post entries, pay, refund, file, collect, change billing, or contact a counterparty. Require the owner plus qualified accountant, tax professional, counsel, finance/control, and payment/bank owners.
