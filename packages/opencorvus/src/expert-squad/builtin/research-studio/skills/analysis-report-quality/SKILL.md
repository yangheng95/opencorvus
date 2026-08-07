---
name: analysis-report-quality
description: Build trustworthy quantitative evidence and turn accepted findings into one integrated, browser-reviewed research report. Use in Research Studio for dataset analysis, calculation-heavy research, dashboards, standalone HTML reports, or any delivery whose primary surface is visual.
---

# Analysis Report Quality

Use this Skill at the role boundary that owns the current work. The Analyst owns reproducible calculations and claim evidence. The Writer owns narrative, rendering, and delivery. Neither role silently repeats the other's work.

For every substantial report, read [the decision research report template](references/decision-research-report-template.md) and [its JavaScript Object Notation Schema](references/decision-research-report.schema.json) before creating the report model. The template's fields, section sequence, chart grammar, and design tokens plus the Schema's positive data contract are this package's single report-template source. Validate the complete model with a mature JSON Schema validator before rendering. Do not substitute an improvised outline or chart-library default theme.

## Quantitative evidence

When the request includes datasets or calculations, the Analyst must produce the numbers before Fact Check begins:

1. Record the source identity, retrieval date, size, digest, schema, units, time zone, population, exclusions, and missing-data rules.
2. Materialize reproducible code and canonical result tables in the project. Snapshot them with the analysis Artifact instead of pasting large data into messages.
3. Give every load-bearing metric and finding a stable claim identifier. Map it to source inputs, formula or algorithm, result-table coordinates, uncertainty, and a positive verification result.
4. Reconcile totals across derived tables and the source population. Explain sampling, deduplication, cancellation, return, currency, cohort, and period-boundary choices.
5. Validate the analytical method, not merely the serialization of its output. Include sensitivity checks and a plausible baseline.

For transaction datasets, classify observed records by evidenced business meaning before calculating the primary population. Keep ordinary merchandise sales, returns, shipping, discounts, fees, vouchers, bad-debt or accounting adjustments, and unresolved transaction types distinguishable. Base the classification on source documentation, identifiers, descriptions, sign behavior, counterpart records, and distribution evidence together; do not implement a single keyword gate. Publish the classification table, primary inclusion rule, unresolved rows, and sensitivity result. A positive accounting adjustment is not a sale merely because its quantity and unit price are positive.

For time-series anomaly work, never equate an absent record with a measured zero. Classify dates as observed activity, structural non-operating periods, confirmed zero-activity periods, or data gaps. Establish the support set or business calendar from evidence; compare within appropriate weekday or seasonal groups; report parameter sensitivity, known-event recovery, and false-positive review. A check that only recomputes the same filled table is not independent algorithm evidence.

## One report model

Before rendering, populate and validate the template's structured report model from accepted claims. It is the single narrative source for every output format and contains:

- title, audience, decision question, scope, data vintage, and method summary;
- key performance indicators with definitions, units, periods, claim identifiers, and evidence links;
- findings with claim, evidence, interpretation, confidence, one evidence-module reference or an explicit no-visual reason, and decision implication;
- ordered sections, comparisons, recommendations, limitations, unresolved items, sources, and reproducibility resources.

Derive Markdown and Hypertext Markup Language (HTML) from this model. Do not independently author two reports or build a report by concatenating headings and chart fragments.

## Integrated primary report

When a browser-visible report is requested, the standalone HTML is the primary user surface. It must integrate the executive summary, key performance indicators, findings, evidence, charts, useful tables, recommendations, limitations, source notes, and reproducibility entry points in reading order. A chart gallery, notebook dump, or Markdown archive with a detached visualization page is incomplete.

Use a maintained template engine, component or design system, and mature charting library already available in the environment. Apply the template's chart grammar and explicit theme to every figure; a default chart-library theme or an uncaptioned plot is incomplete. Keep the delivered report self-contained when offline use is required. Favor meaningful hierarchy, legible typography, compact decision-oriented cards, consistent color semantics, responsive chart containers, accessible labels, and printable structure. Do not hand-concatenate an entire HTML document when a renderer can encode the structure once.

All links in report prose and final narration must resolve from the project root. Snapshot the report model, primary HTML, Markdown archive, calculation code, canonical tables, and supporting media together. In `resource_roles`, identify one `primary_report`, one `markdown_archive`, the `report_model`, and all `reproducibility` or `supporting_evidence` resources.

## Real visual review

For a browser-visible report, completion requires the real Task-scoped preview, not source inspection:

1. Use `browser_preview` to start the real report service and persist its Task-scoped preview target; this tool does not itself navigate or capture screenshots.
2. Call `browser_preview_capture` for that exact target and requested desktop viewport. Read the returned Portable Network Graphics (PNG) attachments as image evidence instead of judging source text. If the active model cannot receive image input, report the blocker and do not substitute Document Object Model, geometry, source-string, or pixel checks.
3. Personally inspect the requested desktop delivery surface for information hierarchy, clipped or empty regions, chart readability, table overflow, contrast, spacing, navigation, and factual consistency with the accepted claims.
4. Correct the source model, renderer, or content and repeat navigation and capture until the observed defects are resolved.
5. Obtain a second independent visual review and preserve its capture locators with the delivery. Research Studio's Writer publishes candidate capture evidence and its Orchestrator performs the independent review before accepting the Task. When a review finds a repairable defect, the owning renderer corrects it, captures fresh evidence, and repeats the independent image review.

This is interactive acceptance work. Do not create, update, or run User Interface automation tests, reusable screenshot scripts, snapshot baselines, pixel comparisons, Document Object Model checks, or source-string assertions as a substitute.

## Role handoff

The Analyst publishes computed claims and reproducibility resources, then stops. Fact Check evaluates those exact post-computation claims. The Writer consumes the accepted analysis and corrections, builds the report model, renders the primary report, and performs visual review. The Writer may fix rendering and narrative defects but must not change or self-approve a quantitative claim. If accepted evidence is materially inconsistent or a quantitative change is required, publish the exact blocker and refuse the current Task's report acceptance. Do not create a repair Task merely to repeat an already executed workflow node or the same closure; Mission may create another Task only for a different fixed Squad boundary or a genuinely new outcome-complete closure.
