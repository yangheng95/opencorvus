---
name: securities-post-trade-operations-method
description: Prepare securities post-trade evidence spanning trade capture, allocation, confirmation and affirmation, clearing and netting, custody, Delivery versus Payment, settlement, fails and reconciliation. Use without trading, instructing, moving assets, deciding finality, margin, compliance or risk acceptance.
---

# Securities Post-Trade Operations Method

## Freeze transaction and market scope

Record legal entities and operational capacities, accounts and books, instruments and asset class, market and jurisdiction, trade population and date range, settlement cycle and calendar version, quantity and price conventions, currencies, broker/custodian/central counterparty/central securities depository path, standing instruction version, controlled sources, evidence cutoff, owners and requested decision. Assign stable IDs to trades, allocations, confirmations, obligations, instructions, settlements, positions, cash records, fails, breaks and evidence.

Bind every deadline, cutoff, eligibility rule or settlement-cycle claim to the exact jurisdiction, market, product, calendar, source version and effective date. Do not inherit values from upstream examples. Separate trade date, intended settlement date, processing date, value date and observation time.

## Reconcile capture, allocation and confirmation

Compare execution and middle-office capture using instrument, side, quantity, price, currency, trade time, venue, counterparty, account and unique references. Preserve amendments, cancellations, corrections and duplicates. Trace block trades to allocations and allocated economics back to the source trade.

Link each allocation to confirmation and affirmation evidence, including actor/capacity and timestamp as supplied. A matched economics record is not evidence that an authorized party affirmed it. Reconcile complete, unmatched, late, amended and unknown populations with denominators.

## Trace clearing, netting and obligations

Map eligibility, submission, comparison or matching, acceptance and clearing route from supplied system evidence. Separate central-counterparty and bilateral paths. Record novation only as an attributed system or legal classification. Trace gross trades into declared netting sets and resulting securities and cash obligations with explicit signs, units and legal entities.

For continuous net settlement or another netting service, record service/version, participant capacity, gross population, exclusions, net result and reconciliation rule. Do not infer enforceability, settlement finality, default or credit exposure.

## Trace custody and Delivery versus Payment

Record standing settlement instruction identity/version, delivering and receiving accounts, custodian and depository chain, security identifier and quantity, cash currency and amount, intended settlement date and supplied processing events. Treat Delivery versus Payment and Receive versus Payment as supplied mechanism classifications.

Reconcile security and cash legs to the same obligation without declaring finality. Preserve partial settlement, recycling, pending, hold, reversal, rejection and unknown states. Compare position and cash records using compatible cutoffs and account bases.

## Review settlement fails and breaks

Freeze fail and break definitions, ageing clock, market calendar, population and exception taxonomy. Reconcile unsettled obligations, stock-record differences, cash breaks, position differences, unmatched instructions, partials and subsequent status evidence. Record reason codes as supplied; separate operational code, analyst hypothesis and qualified determination.

Measure ageing only from declared dates and calendar. Track quantity and cash units, first and last observed state, control evidence, owner, reviewer, counterevidence and uncertainty. Do not recommend borrowing, buy-in, cancellation, compensation, disclosure or counterparty contact.

## Join lifecycle evidence

Run capture/allocation/confirmation, clearing/netting, custody/Delivery-versus-Payment/settlement and fail/break branches from one frozen population. Join by trade, allocation, obligation, instruction, settlement, position, cash and break IDs. Reconcile economics, calendars, legal entities, gross/net quantities and securities/cash legs.

Keep system status, normalized record, derived reconciliation, analyst hypothesis, attributed human disposition and legal conclusion separate. Every row records source/version/date, cutoff/effective date, value and unit/denominator, owner, qualified reviewer, applicability/jurisdiction, assumptions, uncertainty, privacy/licence boundary, status, decision_not_made, outcome_unknown and stop reason.

## Stop and authority boundary

Stop on ambiguous entity/capacity, instrument or account, missing calendar/source version, incompatible cutoffs, unreconciled populations, unknown instruction identity, absent standing-instruction version, inconsistent currency/quantity basis, ambiguous external outcome or missing qualified reviewer.

Never place or cancel a trade; allocate, confirm, affirm or instruct; novate, net, settle or move securities or cash; borrow stock; initiate a buy-in; change standing instructions; decide finality, margin, default, regulatory compliance or risk acceptance; or contact a counterparty or infrastructure. Authorized operations, custodians, clearing members, treasury, finance/control, risk, compliance and legal owners retain all such decisions.
