# Decision Research Report Template

This is the required information architecture for a substantial Work or Research Studio report. Preserve the section order and required fields, and validate the completed model against `decision-research-report.schema.json` before rendering. Omit a section only when its applicability is explicitly recorded in the report model; do not replace it with an invented section.

## Report model

Populate these fields before rendering:

```yaml
report:
  title: ""
  decision_question: ""
  audience: ""
  publication_date: ""
  template_id: "decision-research-report/v1"
  primary_surface: "standalone_html | markdown"
  section_applicability: {}
  scope:
    population: ""
    geography: ""
    period: ""
    currency_and_units: ""
    exclusions: []
  data_vintage: ""
  executive_answer: ""
  decision_bullets: []
  confidence: "high | medium | low"
  analysis_modes: ["transaction | time_series | other"]
  transaction_analysis:
    taxonomy:
      merchandise: {}
      return: {}
      shipping: {}
      discount: {}
      fee: {}
      voucher: {}
      bad_debt_accounting_adjustment: {}
      unknown: {}
    primary_population_rule: ""
    unresolved_rows: []
    sensitivity_results: []
    reconciliation: ""
  time_series_analysis:
    date_support:
      observed_activity: []
      structural_non_operating: []
      confirmed_zero_activity: []
      data_gap: []
    business_calendar_evidence: []
    anomaly_validation:
      parameters: ""
      sensitivity_results: []
      known_event_recovery: ""
      false_positive_review: ""
  kpis: []
  findings: []
  evidence_modules: []
  comparisons: []
  recommendations: []
  limitations: []
  methods: []
  sources: []
  reproducibility_resources: []
```

`template_id` and the fixed page sequence are immutable renderer inputs. All sections except comparative evidence are required for a substantial report; comparative evidence needs either `required` or a concrete `not_applicable_reason`. The declared `analysis_modes` determine which structured quality object is mandatory. A non-applicable transaction or time-series object contains only `not_applicable_reason`; it cannot replace the required taxonomy or date-support evidence when that mode is declared. `decision_bullets` contains three to five bounded decisions or implications. `kpis` contains four to eight decision metrics, and `findings` contains three to seven ranked findings. Every KPI requires `label`, `value`, `unit`, `period`, `definition`, `claim_id`, `evidence_ref`, and `change_context`. Every finding requires `headline`, `claim_id`, `evidence_ref`, `interpretation`, `confidence`, `decision_implication`, and either one `evidence_module_ref` or an explicit `no_visual_reason`.

Every transaction class records evidence, primary-population treatment, record count, and amount. The classification object must close merchandise, returns, shipping, discounts, fees, vouchers, bad-debt/accounting adjustments, and unknown rows, then state the primary rule, unresolved rows, sensitivity results, and source-total reconciliation. Time-series analysis must classify the date support and record business-calendar evidence plus anomaly parameters, sensitivity, known-event recovery, and false-positive review.

`evidence_modules` is the single typed plan for chart and table evidence used by every renderer. Each module declares its stable `module_id`, `kind`, `data_ref`, conclusion-led `title`, contextual `subtitle`, population, period, unit, claim identifiers, source note, takeaway, and `presentation`. The presentation records the analytical `form`, encodings, direct annotation or decision-row emphasis, color semantics, and an accessibility description. A renderer may change implementation details for its medium, but it must not invent a second evidence plan or silently change these semantics. Every recommendation requires `action`, `evidence_claim_ids`, `expected_effect`, `owner_or_decision_maker`, `priority`, `time_horizon`, and `risk_or_tradeoff`. For standalone HTML, resource roles include exactly one primary report, report model, and Markdown archive plus reproducibility and visual-review evidence.

## Fixed page sequence

1. **Report masthead** — title, decision question, audience, data period, publication date, and confidence badge.
2. **Executive answer** — one bounded answer paragraph followed by three to five decision bullets. Never open with methodology.
3. **KPI scorecard** — four to eight decision-relevant metrics, each with definition and comparison context; numbers without a denominator or period are invalid.
4. **Critical findings** — three to seven ranked finding modules. Each module pairs a concise conclusion and evidence explanation with its chart or table, then states the decision implication.
5. **Comparative evidence** — the small number of segments, cohorts, alternatives, or periods required to understand the findings. Use a formatted table when exact lookup matters.
6. **Recommended actions** — a priority-ordered action matrix tied to accepted claim identifiers, expected effect, owner, horizon, and tradeoff.
7. **Risks, limitations, and unresolved questions** — separate data limits, method sensitivity, contrary evidence, and decisions still requiring judgment.
8. **Method and reproducibility** — source population, transformations, formulas or algorithms, validation, canonical tables, and runnable resources.
9. **Source notes** — direct source pointers, retrieval dates for volatile facts, and claim mappings.

## Chart grammar

Charts are evidence modules, not library output dumps. Select the form by analytical question:

| Question                     | Preferred form                                                          |
| ---------------------------- | ----------------------------------------------------------------------- |
| Trend or change over time    | line or indexed line, with important events annotated                   |
| Ranked comparison            | horizontal bar sorted by the decision metric                            |
| Composition                  | stacked bar; use a donut only for at most five stable parts             |
| Distribution                 | histogram, box plot, or violin with sample size                         |
| Relationship                 | scatter with meaningful encodings and a fitted line only when justified |
| Retention or cohort behavior | cohort heatmap with a perceptually ordered scale                        |
| Geography                    | map only when location itself explains the decision                     |
| Exact multi-metric lookup    | formatted table with conditional emphasis                               |

Every chart must have a conclusion-led title, a subtitle naming population and period, human-readable units, source/claim note, accessible hover text, and a one-sentence takeaway outside the plotting canvas. Annotate the decisive point directly. Use consistent series semantics across the report.

Apply a deliberate theme rather than chart-library defaults:

```yaml
chart_theme:
  font_family: "Inter, Aptos, Segoe UI, sans-serif"
  text: "#172033"
  muted_text: "#5B6475"
  surface: "#FFFFFF"
  plot_surface: "#F7F9FC"
  grid: "#DCE2EA"
  primary: "#2F6BFF"
  positive: "#168A5B"
  warning: "#C87A12"
  negative: "#C9414A"
  categorical: ["#2F6BFF", "#7A5AF8", "#10A6A6", "#D97904", "#D1498B", "#60758F"]
  title_size_px: 18
  label_size_px: 12
  plot_height_px: 360
  corner_radius_px: 14
```

Format currency, percentages, and large values consistently. Keep legends close to the data and prefer direct labels for short series. Limit categorical charts to the categories the reader can compare; group the remainder transparently. Do not use 3D effects, rainbow palettes, default blue-on-white charts, unexplained dual axes, clipped labels, decorative gauges, chart titles such as “Chart 1”, or dense figures that require zooming to read.

## Visual composition

Use a restrained editorial grid with a readable text measure, strong section rhythm, generous plot margins, card backgrounds only where they express hierarchy, and one accent system shared by KPI states, findings, and charts. Alternate evidence-module composition when it improves scanning, but keep alignment and chart dimensions consistent. Tables need sticky or repeated headers for long output, aligned numeric columns, unit-bearing headers, zebra or rule separation, and emphasized decision rows.

The desktop report must remain understandable when printed or viewed offline. Responsive behavior may prevent clipping, but desktop is the delivery target unless the request explicitly adds other devices.
