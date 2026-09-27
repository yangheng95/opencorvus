# Operating review: service completion rates

## Executive decision

The aggregate service success rate declined from **75.3846% in July 2026** (98 successful of 130 eligible) to **66.3636% in August 2026** (73 of 110), a change of **−9.0210 percentage points**. Both observed segment rates improved, so the overall decline is explained arithmetically by the August segment mix shifting sharply toward the lower-rate complex segment. The bounded operating next step is to validate the complex-segment completion process and review a small, representative sample of August failures before selecting a remediation; these aggregates alone do not identify the cause.

## Metric definition and provenance

- **Source:** `metrics.json` only; dataset ID `g58-service-mix-2026-07-08-v1`.
- **Nature:** synthetic local data (`synthetic: true`); no business systems, accounts, or external actions were used.
- An eligible request belongs to exactly one segment in its period.
- `successful` counts eligible requests completed successfully in that same period.
- Success rate is `successful / eligible`. Overall rate is total successful divided by total eligible; segment percentages are not averaged without eligible-count weights.
- No `data-analysis/audit` predecessor Artifact was available in the current Task catalog. No additional audit facts are assumed.

## Counts and rates

| Period | Segment | Eligible | Successful | Success rate |
|---|---|---:|---:|---:|
| 2026-07 | standard | 100 | 80 | 80.0000% |
| 2026-07 | complex | 30 | 18 | 60.0000% |
| 2026-07 | **overall** | **130** | **98** | **75.3846%** |
| 2026-08 | standard | 10 | 9 | 90.0000% |
| 2026-08 | complex | 100 | 64 | 64.0000% |
| 2026-08 | **overall** | **110** | **73** | **66.3636%** |

Calculations: July overall = `98 / 130`; August overall = `73 / 110`. Segment rates are July standard `80 / 100`, July complex `18 / 30`, August standard `9 / 10`, and August complex `64 / 100`.

## Rate and mix analysis

### Segment changes

- Standard: 80.0000% → 90.0000% (**+10.0000 pp**), while its share of eligible requests fell from `100/130 = 76.9231%` to `10/110 = 9.0909%`.
- Complex: 60.0000% → 64.0000% (**+4.0000 pp**), while its share rose from `30/130 = 23.0769%` to `100/110 = 90.9091%`.

### July-reference fixed-weight comparison

Use **July segment shares as the fixed reference weights** and apply August segment rates:

`(100/130 × 90.0000%) + (30/130 × 64.0000%) = 84.0000%`.

This is the August rate under July’s composition. Relative to July’s actual 75.3846%, the fixed-weight rate effect is **+8.6154 pp**. August’s actual overall rate is 66.3636%, so the remaining mix residual is **−17.6364 pp**. The arithmetic identity is:

`66.3636% − 75.3846% = (+8.6154 pp rate effect) + (−17.6364 pp mix residual) = −9.0210 pp`.

The decomposition is a descriptive accounting identity based on the supplied counts and the stated July reference weights. It does **not** establish that mix caused the outcome, nor does it establish why either segment’s rate changed. The residual is called a mix residual because it is the remainder after the specified fixed-weight comparison, not a causal estimate.

## Bounded operating next step

Prioritize a focused review of the **complex** segment because it supplied 100 of 110 August eligible requests and had the lower August rate (64.0000%), while preserving the metric definition. Review a bounded, representative sample of August complex failures and compare failure reasons with the corresponding July records if such records are available within the operating process. Use that review to decide whether a process or capacity intervention is warranted; do not infer a remediation from these aggregates alone.

## Limitations and assumptions

- The analysis assumes the supplied rows are complete for July and August, segment labels are mutually exclusive, and `successful` is a subset of `eligible` as defined in the request.
- Counts provide no failure reasons, timing, queue/capacity measures, customer or case characteristics, denominator quality checks beyond the supplied values, or uncertainty estimates.
- The data cannot establish causation, operational root cause, persistence beyond these two periods, representativeness outside this synthetic dataset, or whether the segment mix was controllable.
- The standard August rate is based on only 10 eligible requests; it should not be treated as a stable estimate without additional observations.
- No external actions, account access, or business-system validation were performed.
