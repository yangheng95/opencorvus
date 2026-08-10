---
name: construction-project-controls-method
description: Build traceable construction project-control packs from scope, schedule, cost, procurement, site-risk, and quality evidence. Use for baseline review, variance analysis, milestone readiness, change preparation, and executive controls reporting.
---

# Construction Project Controls Method

## Intake and controls basis

1. Freeze project/package IDs, WBS and CBS versions, approved baseline and change status, data date, calendars/time zone, currency/base date and escalation rules, progress-measurement basis, source-system snapshots, confidentiality boundary, and accountable professional reviewers.
2. Keep approved baseline, current update, forecast, recovery scenario, and proposal distinct. Assign stable IDs to activities, costs, changes, procurement items, RFIs, submittals, inspections, nonconformances, permits, risks, and sources.
3. Run schedule/scope, cost/procurement, and site/risk/quality analysis independently. Join only complete outputs sharing explicit baseline, data-date, unit, and version semantics.

## Schedule and cost rules

- Preserve network relationship type, lag, calendar, constraint, actuals, remaining duration, free float, total float, and source version. Claim a critical or driving path only from a named schedule calculation or a complete independently calculated network.
- Reconcile baseline/current/forecast milestone dates at the same data date and calendar. Flag open ends, out-of-sequence progress, hard constraints, negative float, future actuals, and unsupported look-ahead work.
- Keep actual, accrual, commitment, forecast-to-complete, approved change, pending change, and contingency values separate. Map every amount to CBS/WBS, currency/base date, source, and owner.
- Use Earned Value Management only on common scope, status date, currency, and measurement basis: `SV = EV - PV`, `CV = EV - AC`, `SPI = EV / PV`, `CPI = EV / AC`. Ratios are undefined at zero denominator.
- State the chosen Estimate at Completion formula and assumptions. Then compute `ETC = EAC - AC` and `VAC = BAC - EAC`; present alternative EAC formulas as scenarios, never as approved forecasts.
- Trace required-on-site dates through procurement, submittal, RFI, inspection, logistics, access, quality, safety, and permit dependencies. Treat engineering, contractual, safety, and permit judgments as qualified-review questions.

## Assets and join

- Use [WBS and Schedule Baseline Register](assets/wbs-schedule-baseline-register.md) for logic, calendars, float, milestones, and look-ahead reconciliation.
- Use [Cost, Earned Value, and Change Register](assets/cost-earned-value-change-register.md) for budget, actual, commitment, forecast, change, contingency, and formulas.
- Use [Interface, Procurement, and Site Risk Register](assets/interface-procurement-site-risk-register.md) for RFIs, submittals, materials, inspections, quality, safety, permits, and site dependencies.
- Join all three in [Construction Project Controls Register](assets/project-controls-register.md). Carry units, sources, versions, data dates, owners, uncertainty, applicable WBS/domain, formulas, and approval status into every material row.

Stop when baseline authority, data date, calendar, currency/unit rules, progress basis, source lineage, or WBS/CBS mapping is unresolved. Preserve blank and conflicting fields as explicit gaps.

## Authority boundary

Never certify design or construction, direct site activity, interpret contracts, approve change orders, procurement, invoices, forecasts, contingency use, or payments, or issue safety, quality, or permit clearance. Require authorized project, engineering, planning, quantity-surveying, quality, safety, legal, commercial, contractor, and owner review.

## Adaptation boundary

Apply only the baseline-discipline, dependency-mapping, variance-reporting, risk-ownership, and decision-record concepts in [upstream provenance](references/upstream.md). Exclude software-portfolio assumptions, upstream scripts and fixed models, global agent protocols, and engineering, contractual, site, procurement, change, or payment authority.
