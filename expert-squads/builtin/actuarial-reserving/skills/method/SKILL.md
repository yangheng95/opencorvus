---
name: actuarial-reserving-method
description: Evidence-first property and casualty unpaid-claim reserving method for source and triangle reconciliation, supplied method and assumption diagnostics, uncertainty, validation, roll-forward, governance and disclosure review. Use when valuation scope and controlled evidence are supplied; never to select or book a reserve or replace the appointed actuary.
---

# Actuarial Reserving Method

## Establish the valuation contract

Freeze the legal entity, portfolio, line of business, coverage, geography, accident/report/underwriting period, development grain, valuation date, data cutoff and timezone. Record currency and exchange-rate basis; gross, ceded and net basis; paid, incurred, case and expense definitions; allocated loss adjustment expense (ALAE) and unallocated loss adjustment expense (ULAE) treatment; nominal or discounted basis; reinsurance structure; accounting and regulatory bases; source systems; booked balance; prior valuation; evidence versions; owners; independent reviewer; and appointed actuary. Do not compare or aggregate cells until these dimensions agree or a controlled transformation is documented.

Write every quantity with a unit and basis. A number such as `12.4` is unusable without currency, nominal/discounted status, gross/net status, measure, origin period, development age and valuation date. Preserve as-of versus extraction dates and late corrections separately. If scope, basis or authority is absent, produce a gap register and stop rather than silently assume.

## Data and triangle reconciliation branch

Trace source claim, transaction, exposure and financial records to the analysis dataset and from that dataset to each **incremental triangle** and cumulative triangle. Document inclusion/exclusion rules, claim status, reopenings, salvage/subrogation, large-loss treatment, catastrophe or latent claim tagging, recoveries, reinsurance, commutations, currency conversion, expense allocation and negative values. Preserve source identifiers and transformation version without disclosing personal claim data unnecessarily.

Reconcile row, development-period and grand totals to controlled ledgers or supplied financial control totals. Verify cumulative cells equal the documented sum of increments, and derived increments reconcile back from cumulative cells. Separate paid, incurred and case outstanding. Check development age conventions, diagonals, partial periods, missing cells, duplicate records and cutoff leakage. Record every unexplained difference with amount, unit, basis, owner, materiality context and stop condition. Reconciliation demonstrates lineage; it does not establish claim correctness or accounting acceptance.

## Method and assumption diagnostics branch

Treat supplied methods as competing views with explicit applicability, not automatic answers. For **chain ladder**, preserve link-ratio population, weighting, exclusions, selected age-to-age factors, cumulative development factors, tail factor, maturity and stability diagnostics. Show which observations influence selection and why. Examine mix shifts, operational changes, case-reserving changes, settlement speed, inflation, social/legal environment, catastrophe and sparse mature periods before applying historical development.

For **Bornhuetter-Ferguson**, preserve the independent expected loss ratio or ultimate basis, exposure measure, earned premium or other denominator, percentage unreported/unpaid, development pattern and independence limits. For Cape Cod or expected-loss-ratio approaches, record how the expected level is estimated and whether the exposure and loss bases align. For frequency-severity, separate count definition, exposure, reopenings, severity unit, limits, trend and large-loss handling. `IBNR` means incurred but not reported only when the local analysis definition says so; distinguish pure IBNR from development on known claims when material.

Development, trend, on-level, rate, exposure, tail, discount and reinsurance assumptions each need source, version, effective date, owner, reviewer, applicability and uncertainty. Do not manufacture factors or reperform calculations whose inputs or formulas are absent. Compare supplied indications on like bases and decompose differences into data, pattern, expected level, trend/tail, large-loss, reinsurance, discount and judgment components.

## Diagnostics and backtesting

Use age-to-age heat maps, weighted/unweighted factor comparison, volume and leverage diagnostics, residuals, calendar-period/diagonal effects, claim-count and severity views, paid-versus-incurred relationships, case outstanding changes and large-loss sensitivity when supported by data. An anomaly is a review question, not an instruction to exclude a point. Record the candidate observation, competing explanations, quantitative consequence and authorized disposition.

Backtest prior valuation predictions against the next observed diagonal and subsequent development on exactly matched scope and basis. Build actual-versus-expected comparisons by origin and development period; record expected definition, actual definition, unit, denominator, sign convention and cutoff. Track repeated directional miss, instability and structural breaks. Never claim independence if the same observations set assumptions and test them.

## Uncertainty and validation branch

Separate parameter, process, model, data and operational uncertainty. Use scenario or sensitivity evidence to show how supplied alternate development, tail, trend, expected-loss, large-loss, reinsurance, discount and cutoff assumptions change indicated results. Keep a central estimate, range, percentile or scenario label distinct. A range is not a confidence interval unless its probabilistic meaning and method support that claim.

Mack or bootstrap evidence may be reviewed only when model assumptions, residual definition, input triangle, implementation/version, treatment of zeros/negatives, tail, number of simulations and reproducibility records are supplied. Record diagnostics for dependence, heteroscedasticity, structural change and data sparsity. Do not infer a distribution, percentile or diversification benefit from a point estimate. Discuss correlation and aggregation basis explicitly when portfolio ranges are combined.

Independent validation checks data lineage, mathematical reproduction, method applicability, assumption evidence, change from prior, diagnostics, sensitivity, uncertainty interpretation and documentation. Validation does not choose the estimate. Materiality thresholds and escalation triggers come from authorized policy or the appointed actuary, never from the worker.

## Governance, roll-forward and disclosure branch

Reconcile prior booked or indicated unpaid claims to current on a consistent basis. Identify paid/runoff, new origin periods, prior-period development, assumption changes, method changes, data corrections, portfolio mix, acquisitions/disposals, commutations, reinsurance changes, foreign exchange, discount unwind and other supplied movements. Require the roll-forward equation to close, with every residual explicitly open. Separate booked from indicated; a difference is evidence for review, not a booking recommendation.

Trace each material judgment to evidence, author, reviewer, approval state and effective date. Document model/spreadsheet/code version, access/change control, peer review, reproducibility and known limitations. Link disclosure statements to the exact scope, valuation date, accounting basis, uncertainty evidence and supporting records. Avoid implying that a property and casualty unpaid-claim analysis covers pricing, capital, life liabilities, tax or claim settlement.

## Join protocol and five assets

Use exactly five package assets. The data root owns the source/triangle/reinsurance reconciliation register. The method root owns the development/tail/expected-loss assumption worksheet. The validation root owns the diagnostic/backtest register and uncertainty register. The governance root owns the booked/indicated roll-forward and disclosure decision register. The join owner links, but does not rewrite, evidence IDs; reports agreements and contradictions; keeps missing controls visible; and identifies the qualified authority for every unresolved decision.

Each asset row must carry stable ID, unit and basis, source URI or controlled record, version, source/effective and extraction dates, owner, qualified reviewer, applicability, uncertainty, status, evidence pointer, decision-not-made and stop condition. Preserve unknown values as `unknown` with consequence and resolver. Never substitute plausible values or collapse gross/net, nominal/discounted, paid/incurred or booked/indicated bases.

## Unknown and stop conditions

Stop numerical interpretation when the valuation date, portfolio, measure, unit, currency, gross/net basis, nominal/discounted basis, triangle orientation, development convention, source version, reconciliation, formula, assumption source, booked balance, reinsurance treatment or decision authority is missing or contradictory. Stop on unexplained material control differences, corrupted formula lineage, confidential data exposure, or a request to change source systems, spreadsheets, journals, claims or filings. Return the bounded evidence, gaps, consequence and named resolver.

## Authority and qualified review

This method cannot select a final method, assumption, range or reserve estimate; recommend or authorize a booked amount; post an accounting entry; sign an actuarial report or opinion; approve a regulatory filing; interpret accounting, tax, solvency or law; decide claim liability or settlement; or provide pricing, capital or investment advice. The appointed actuary, credentialed reserving actuaries, finance/accounting control owners, claims and reinsurance specialists, model validators, auditors, legal/compliance and authorized governance bodies retain their respective judgments and approvals.

## Source posture

This package is clean-room authored. Use `references/source-provenance.md` only to identify public professional concepts and current source locations. Do not reproduce copyrighted standards or rejected repository text. Verify the current effective professional and jurisdictional requirements with the appointed actuary and qualified legal/accounting reviewers before reliance.
