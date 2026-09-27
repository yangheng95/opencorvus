# Residential-noise service planning memo

## Executive readout

This memo describes the frozen NYC Open Data 311 extract for NYPD `Noise - Residential` requests created in July and August 2025. It is a grouped, month-level extract—not a row-level incident file.

- July: **26,659** requests; August: **32,756**; change **+6,097 (+22.87%)**, using July as the percentage denominator.
- Brooklyn is the largest workload in both cohorts (8,164 July; 9,996 August).
- Queens has the largest absolute increase (**+1,955**) and percentage increase (**+29.04%**) among boroughs present in both months.
- Same-calendar-month recorded closure is **26,542/26,659 (99.56%)** in July and **32,365/32,756 (98.81%)** in August. The remaining counts are 117 and 391, respectively.

These are descriptive counts. They do not establish response speed, historical backlog, later closure completeness, actual problem resolution, service quality, staffing, causation, cost, satisfaction, or individual incidents.

## Observed workload

`N` is the sum of `requests` across all returned status and closed-month groups for the cohort and borough. Change is `August N − July N`; percentage change is `change / July N`.

| Borough | July N | August N | Absolute change | % change (July denominator) |
|---|---:|---:|---:|---:|
| BRONX | 6,449 | 7,959 | +1,510 | +23.41% |
| BROOKLYN | 8,164 | 9,996 | +1,832 | +22.44% |
| MANHATTAN | 4,296 | 4,941 | +645 | +15.01% |
| QUEENS | 6,731 | 8,686 | +1,955 | +29.04% |
| STATEN ISLAND | 1,001 | 1,174 | +173 | +17.28% |
| Unspecified | 18 | — (no supplied August row) | not computed | not computed |
| **Total of supplied rows** | **26,659** | **32,756** | **+6,097** | **+22.87%** |

Brooklyn accounts for the largest absolute workload in each month. Queens accounts for the largest increase; Brooklyn is second by absolute increase. The Unspecified category is retained because it is supplied for July. August has no supplied Unspecified row; it is not imputed as zero, and therefore no August-to-July change is asserted for that category.

## Same-calendar-month recorded closure

For each cohort/borough, `C` is the sum of `requests` where `closed_month` equals the cohort month, across statuses. `C share = C/N`; `R = N − C`; `R share = R/N`. Percentages are rounded to two decimals and use the displayed cohort/borough `N` as denominator.

| Cohort | Borough | N | Same-month C | C share | Remaining R | R share |
|---|---|---:|---:|---:|---:|---:|
| Jul 2025 | BRONX | 6,449 | 6,403 | 99.29% | 46 | 0.71% |
| Jul 2025 | BROOKLYN | 8,164 | 8,145 | 99.77% | 19 | 0.23% |
| Jul 2025 | MANHATTAN | 4,296 | 4,288 | 99.81% | 8 | 0.19% |
| Jul 2025 | QUEENS | 6,731 | 6,689 | 99.38% | 42 | 0.62% |
| Jul 2025 | STATEN ISLAND | 1,001 | 999 | 99.80% | 2 | 0.20% |
| Jul 2025 | Unspecified | 18 | 18 | 100.00% | 0 | 0.00% |
| **Jul 2025 total** | **supplied rows** | **26,659** | **26,542** | **99.56%** | **117** | **0.44%** |
| Aug 2025 | BRONX | 7,959 | 7,888 | 99.11% | 71 | 0.89% |
| Aug 2025 | BROOKLYN | 9,996 | 9,872 | 98.76% | 124 | 1.24% |
| Aug 2025 | MANHATTAN | 4,941 | 4,913 | 99.43% | 28 | 0.57% |
| Aug 2025 | QUEENS | 8,686 | 8,541 | 98.33% | 145 | 1.67% |
| Aug 2025 | STATEN ISLAND | 1,174 | 1,151 | 98.04% | 23 | 1.96% |
| Aug 2025 | Unspecified | — (no supplied row) | — | — | — | — |
| **Aug 2025 total** | **supplied rows** | **32,756** | **32,365** | **98.81%** | **391** | **1.19%** |

## Interpretation boundaries

The source defines `cohort_month` as the calendar month of `created_date`, `closed_month` as the calendar month of the agency-recorded `closed_date` (omitted when the closure timestamp is null), and `status` as the value at extraction time rather than a historical month-end status. Consequently:

- A same-month closure count says only that a closure month and creation month align at month resolution. It cannot measure hours/days to response or closure, ordering within a month, or service-level performance.
- The remaining count is not a historical backlog measure. It includes groups whose closure month is later than creation month and does not show whether they subsequently closed; the extract is frozen at retrieval time.
- A recorded closure is not proof that the noise condition was resolved, nor a direct service-quality, satisfaction, or outcome measure.
- Aggregated grouped rows contain no identifiers, addresses, individuals, precise timestamps, staffing, cost, or causal design. No staffing, causation, or individual-incident inference is made.

## Method and reproducibility

Source: NYC Open Data / 311, dataset `erm2-nwe9`, “311 Service Requests from 2020 to Present,” frozen extract retrieved `2026-09-27T07:41:30.376879+00:00`. The supplied query selects `date_trunc_ym(created_date)` as `cohort_month`, `date_trunc_ym(closed_date)` as `closed_month`, `borough`, `status`, and `count(*) AS requests`, filtered to `agency='NYPD'`, `complaint_type='Noise - Residential'`, and created dates from `2025-07-01` inclusive through `2025-09-01` exclusive, grouped by cohort month, closed month, borough, and status. The extract contains 24 grouped rows and preserves all returned borough/status categories.

To reproduce: sum numeric-string `requests` by cohort and borough for `N`; calculate the displayed deltas and July-denominator percentages; then sum rows with equal cohort and closed month for `C`, calculate `R=N-C`, and divide each by the same `N`. Do not substitute a zero for an absent category row.

## Evidence, assumptions, and proposed follow-up

**Observed evidence.** August supplied-row volume is higher than July, with the largest workload in Brooklyn and the largest increase in Queens. Same-month recorded-closure shares are high in both cohorts but lower overall in August; the extract gives no finer time or outcome detail.

**Assumptions.** None beyond arithmetic aggregation of the supplied grouped rows. Percentages are rounded only for display; the supplied numeric strings are treated as counts. Absence of an August Unspecified row is treated as unknown/not supplied, not zero.

**Prioritized operational questions and measurements.**

1. **First—timing and identity:** Can a future extract provide request IDs plus precise created and closed timestamps, including reopened or status-history events? This would replace month-alignment with response and closure duration distributions and allow deduplication.
2. **Second—carryover inventory:** For each cohort, what is the dated status and closure inventory at a defined follow-up date, including still-open and later-closed requests? This would distinguish unresolved carryover from missing/late reporting.
3. **Third—validated outcomes:** Which quality or outcome proxy is independently validated (for example, repeat contact, disposition, inspection outcome, or satisfaction), and how is it linked without exposing personal information? This is needed before interpreting a recorded closure as problem resolution or service quality.

These follow-ups are measurement questions, not staffing or causal recommendations. No external action, data refresh, individual contact, or live business-account access is required.
