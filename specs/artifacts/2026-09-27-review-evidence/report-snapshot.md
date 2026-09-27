# NYC 311 Residential-Noise Planning Memo

## Decision summary

This memo compares fixed July and August 2025 creation cohorts for NYPD `Noise - Residential` requests. The extract contains **26,659** July requests and **32,756** August requests: **+6,097 (+22.87%)**, with August as the numerator and July as the percentage denominator. Brooklyn carried the largest workload in both cohorts; Queens had the largest named-borough increase. These are descriptive cohort results, not staffing, causal, incident-level, or service-quality findings.

## Observed workload

| Borough/category | July requests | August requests | Absolute change | Change (%) | July share | August share |
|---|---:|---:|---:|---:|---:|---:|
| BRONX | 6,449 | 7,959 | +1,510 | +23.41% | 24.19% | 24.30% |
| BROOKLYN | 8,164 | 9,996 | +1,832 | +22.44% | 30.63% | 30.52% |
| MANHATTAN | 4,296 | 4,941 | +645 | +15.01% | 16.12% | 15.08% |
| QUEENS | 6,731 | 8,686 | +1,955 | +29.04% | 25.23% | 26.51% |
| STATEN ISLAND | 1,001 | 1,174 | +173 | +17.28% | 3.75% | 3.58% |
| Unspecified borough | 18 | Not supplied | Not computable | Not computable | 0.07% | Not computable |
| **All supplied categories** | **26,659** | **32,756** | **+6,097** | **+22.87%** | **100.00%** | **100.00%** |

Brooklyn was the largest workload (8,164 in July; 9,996 in August). Queens led named-borough absolute growth (+1,955) and percentage growth (+29.04%). Brooklyn and Queens together represented 55.86% of July and 57.02% of August. The July `Unspecified` category is retained as an explicit unknown bucket. No August borough-`Unspecified` row is supplied; the extract does not establish whether that means zero, omission, suppression, or another rule, so no August value or change is imputed.

## Same-calendar-month recorded closure

“Same-month recorded closure” means `closed_month = cohort_month`. The denominator is every request in that cohort and borough, across all supplied closure-month and status groups. `Remaining` is denominator minus same-month count; it is a residual, not an open, unresolved, overdue, failed, or later-outcome category.

| Cohort | Borough/category | Denominator | Same-month recorded closure | Share | Remaining | Remaining share |
|---|---|---:|---:|---:|---:|---:|
| July | BRONX | 6,449 | 6,403 | 99.29% | 46 | 0.71% |
| July | BROOKLYN | 8,164 | 8,145 | 99.77% | 19 | 0.23% |
| July | MANHATTAN | 4,296 | 4,288 | 99.81% | 8 | 0.19% |
| July | QUEENS | 6,731 | 6,689 | 99.38% | 42 | 0.62% |
| July | STATEN ISLAND | 1,001 | 999 | 99.80% | 2 | 0.20% |
| July | Unspecified borough | 18 | 18 | 100.00% | 0 | 0.00% |
| **July total** | **All supplied categories** | **26,659** | **26,542** | **99.56%** | **117** | **0.44%** |
| August | BRONX | 7,959 | 7,888 | 99.11% | 71 | 0.89% |
| August | BROOKLYN | 9,996 | 9,872 | 98.76% | 124 | 1.24% |
| August | MANHATTAN | 4,941 | 4,913 | 99.43% | 28 | 0.57% |
| August | QUEENS | 8,686 | 8,541 | 98.33% | 145 | 1.67% |
| August | STATEN ISLAND | 1,174 | 1,151 | 98.04% | 23 | 1.96% |
| August | Unspecified borough | Not supplied | Not computable | Not computable | Not computable | Not computable |
| **August total** | **All supplied categories** | **32,756** | **32,365** | **98.81%** | **391** | **1.19%** |

The August aligned count is larger in absolute terms but its share is lower (98.81% versus 99.56%). This is a calendar alignment observation only. September closures for August requests are outside the measure.

## What the extract supports—and does not support

**Observed evidence.** The frozen grouped extract supports creation-cohort volume, supplied borough/category totals, arithmetic changes, and whether the recorded closure month matches the creation month. It also shows the extraction-time `status` values and literal `Unspecified` categories.

**Interpretation limits.** Month-level fields cannot measure elapsed response or closure speed; a same-month match could occur at any point in that month. There is no pre-July inventory or longitudinal cutoff history, so historical backlog/opening inventory is unknown. A remaining request may later close, remain open, or lack a recorded closure; it is not evidence of unresolved work. Recorded closure and extraction-time status do not prove actual problem resolution. The extract has no satisfaction, direct outcome, recurrence, staffing, capacity, cost, or causal-driver fields, so it cannot establish service quality, staffing needs, causes of volume/alignment changes, or individual incidents.

## Prioritized follow-up measurements

1. **Measure elapsed performance (Priority 1):** add row-level creation, first-response, and closure timestamps; publish timestamp completeness plus median and percentile durations by cohort and borough.
2. **Separate backlog from later outcomes (Priority 2):** create dated opening/cutoff snapshots and later-state fields distinguishing later-closed, still-open, and unavailable closure records.
3. **Resolve category completeness (Priority 3):** document borough/status `Unspecified` semantics and test omission/suppression rules, especially why August has no borough-`Unspecified` row; retain unmappable records.
4. **Measure outcomes separately (Priority 4):** add validated direct-resolution, experience/satisfaction, recurrence, and outcome fields with explicit denominators; do not substitute closure alignment for these measures.

## Reproducible method and sources

- **Source:** frozen `metrics.json`, NYC Open Data / 311 dataset `erm2-nwe9`, retrieved `2026-09-27T07:41:30.376879+00:00`; no refresh was performed. The supplied query filters `agency='NYPD'`, `complaint_type='Noise - Residential'`, `created_date >= 2025-07-01` and `< 2025-09-01`, and groups by `cohort_month`, `closed_month`, `borough`, and `status` across 24 rows.
- **Totals:** sum numeric `requests` across all closure-month/status groups for each cohort and borough.
- **Change:** `August - July`; percentage is `100 × (August - July) / July`. If a July denominator is unavailable or zero, the percentage is not computed.
- **Shares:** borough share is borough requests divided by the all-category cohort total. Same-month share is aligned count divided by the full borough/cohort denominator; remaining share is remaining divided by that denominator. Displayed percentages are rounded to two decimals.
- **Reconciliation:** aligned + remaining equals each displayed denominator; July `26,542 + 117 = 26,659` and August `32,365 + 391 = 32,756`.
- **Evidence used:** accepted `data-analysis/analysis-charter`, `data-analysis/data-dossier`, `data-analysis/performance-analysis`, `data-analysis/segment-analysis`, `data-analysis/insight-brief`, and `data-analysis/audit`, plus the frozen `metrics.json`. The audit found no material calculation discrepancy and requires the August borough-`Unspecified` unknown to remain explicit.
