---
name: equity-research-method
description: Produce decision-useful public-equity investment research with dated primary evidence, normalized financials, institutional valuation disciplines, balanced scenarios, falsifiable theses, and independent numerical audit.
---

# Equity research method

## Professional upstream basis

This Skill combines the original FinRobot-inspired evidence/concept/thesis separation with a bounded adaptation of Anthropic's Apache-2.0 `initiating-coverage`, `dcf-model`, `comps-analysis`, `thesis-tracker`, and `audit-xls` Skills, pinned to `anthropics/financial-services` commit `38652224c10610fa52eee2acee3ac712dcff01f2`. See `references/upstream.md` and `references/upstream-license.txt`. It preserves institutional research and model-quality disciplines while excluding provider-specific connectors, spreadsheet automation, external commands, proprietary data assumptions, trade execution, position sizing, and personalized advice.

## Evidence and normalization

1. Freeze the company/security, as-of date, audience, time horizon, investor question, peer policy, source policy, materiality, and stopping conditions with `assets/investment-research-charter.md`.
2. Prefer regulator filings, exchange records, company investor-relations material, and official industry data. Label reputable secondary context; never present search snippets or unsourced market data as verified facts.
3. In `assets/source-normalization-ledger.md`, record publisher, title, URL or identifier, publication and access dates, covered period, units, currency, reported versus adjusted basis, and exact fact supported.
4. Reconcile fiscal calendars, restatements, share counts, stock compensation, non-GAAP definitions, segments, peer definitions, and enterprise-to-equity bridges before comparison. Separate observed values, management guidance, calculations, estimates, assumptions, and missing inputs.

## Fundamental analysis

Analyze business model and revenue drivers; pricing and volume; segment and geographic mix; growth durability; gross and operating margins; cash conversion; working capital; capital intensity; return on invested capital; balance-sheet resilience; dilution; accounting quality; capital allocation; management guidance; competitive position; and relevant unit economics. Explain mechanisms and limitations rather than listing ratios. Every material conclusion maps to dated evidence.

## Valuation discipline

Use methods appropriate to the business and document them in `assets/valuation-model-checklist.md`.

- Comparable-company analysis states peer-selection logic, periods, definitions, normalization, observation dates, enterprise/equity bridges, and the distribution of selected multiples. Do not mix incomparable growth, margin, accounting, or capital structures without explanation.
- Discounted cash flow states forecast horizon, revenue and margin drivers, tax, depreciation, capital expenditure, working capital, free cash flow definition, discount rate construction, terminal method, net debt, non-operating items, diluted shares, currency, and formula lineage.
- Provide bull/base/bear scenarios and at least two-dimensional sensitivity around the assumptions that dominate value. A formula result is not an observed market fact.
- When required price, peer, or financial inputs are unavailable, produce only the supported partial analysis and name the missing inputs. Never manufacture completeness.

## Thesis, catalysts, and risk

Use `assets/thesis-catalyst-risk-register.md`. State what the market may misunderstand, the evidence and mechanism, valuation implication, catalyst and timing, principal risks, falsification signals, and scenario-specific operating assumptions. Check that fundamental and valuation cases use the same assumptions. Recommendation language is conditional research framing, never personalized advice, trade instruction, or false certainty.

## Independent quality control

Use `assets/investment-research-audit.md` after the thesis exists. Recalculate sampled growth, margins, free cash flow, enterprise-to-equity bridges, discounted cash flow, multiples, scenario outputs, and per-share values. Check formula lineage, dates, units, currencies, source entailment, peer comparability, sensitivity behavior, internal consistency, stale inputs, copied values, circular logic, and claim-evidence coverage. Record explicit passing coverage, corrections, accepted limitations, and unresolved professional-review items; never silently repair the work under audit.

## Deliverable boundary

The final report includes as-of date, executive summary, company and industry context, operating and financial quality, peer comparison, valuation methods and sensitivities, thesis, catalysts, risks and falsifiers, bull/base/bear cases, source index, model limitations, audit resolution, and a research-not-personalized-investment-advice notice. Facts, calculations, assumptions, estimates, and unknowns remain visibly distinct.
