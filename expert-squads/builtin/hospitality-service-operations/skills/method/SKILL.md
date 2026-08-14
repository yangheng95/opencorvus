---
name: hospitality-service-operations-method
description: Reconcile guest journeys, booking curves, occupancy, room revenue, inventory, service workload, recovery, safety, and accessibility evidence into bounded hospitality operations plans. Use when property teams need explicit metric denominators, capacity handoffs, privacy limits, uncertainty, and accountable review without live pricing or booking authority.
---

# Hospitality Service Operations

## Freeze the property and data boundary

Record property/service zones, stay-date horizon and time zone, inventory basis, room types, demand segments, journey stages, evidence cutoff, source-system versions, currency and revenue basis, privacy classification, accountable owners, and prohibited live actions. Use anonymized cases or aggregates; reject unnecessary guest, employee, credential, or payment data.

## Reconcile demand and room metrics

For each comparable stay period calculate:

- `occupancy = rooms sold / rooms available`;
- `Average Daily Rate (ADR) = room revenue / rooms sold`;
- `Revenue per Available Room (RevPAR) = room revenue / rooms available = ADR × occupancy`.

Declare out-of-order treatment, gross/net room revenue, taxes/fees, currency, and denominator. Separate booking date, snapshot date, stay date, cancellation, and no-show evidence. Build booking curves by lead-time bucket only from comparable snapshots. Never infer a live rate or inventory action.

Use [Demand and Revenue Scenario](assets/demand-revenue-scenario.md).

## Map journey and recovery handoffs

Trace discover/book/pre-arrival/arrival/stay/departure/post-stay evidence using anonymized identifiers. Calculate elapsed time only from sourced timestamps and distinguish queue, handling, and resolution time. Compare only with a property-supplied standard carrying source/version. Map recovery hypotheses to the existing authority matrix without promising compensation or contacting guests.

## Test service capacity

Calculate `required workload hours = sum(task volume × sourced time per task)` and compare it with role-qualified available hours by service period. Reconcile housekeeping release, maintenance clearance, room availability, food-service capacity, food-safety controls, accessibility, and safety dependencies. Treat productivity and all safety, food-safety, accessibility, labor, maintenance, and emergency thresholds as local sourced inputs or explicit hypotheses pending current qualified review.

Use [Service Capacity and Handoff Plan](assets/service-capacity-handoff-plan.md).

## Join a reversible operations plan

Complete [Guest Service Operations Plan](assets/guest-service-operations-plan.md). Preserve incompatible denominators, disagreement, infeasible handoffs, uncertainty, unknown causes, and privacy boundaries. A proposed experiment needs an owner, approval, affected scope, observation period, success evidence, stop/rollback condition, and no live mutation by the Squad.

## Failure and authority boundary

Stop comparisons when room availability, stay dates, revenue basis, currency, timestamps, workload assumptions, role qualifications, or service criteria cannot be reconciled. Do not infer guest intent, causal attribution, staffing need, compensation, safety clearance, or compliance.

Never change prices, restrictions, inventory, bookings, cancellations, refunds, payments, staffing, compensation, rooms, maintenance, food handling, accessibility, safety, or emergency controls. Require authorized property, revenue, reservations, operations, HR, finance, privacy, guest-relations, safety, accessibility, maintenance, food-service, and legal review.

Read [Clean-room Authoring and Source Boundary](references/clean-room-authoring.md) before property adaptation.
