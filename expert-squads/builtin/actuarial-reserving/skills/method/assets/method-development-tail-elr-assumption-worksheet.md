# Method, Development, Tail and ELR Assumption Worksheet

## Governance header

- Worksheet ID / entity / segment / valuation date: `____`
- Evidence cutoff and timezone / extraction date: `____ / ____`
- Source / version / source date: `____ / ____ / ____`
- Owner / qualified reviewer: `____ / ____`
- Unit and basis: `currency/exposure; gross/ceded/net; paid/incurred; nominal/discounted`
- Applicability: `chain ladder | Bornhuetter-Ferguson | Cape Cod/ELR | frequency-severity | other supplied method`
- Uncertainty: `____`; status: `draft | open | qualified review required | reviewed`
- Decision not made by this asset: `method, factor, tail, trend, ELR, ultimate, range, reserve estimate, booking or opinion selection`
- Stop condition: `missing formula/input/basis/period/source/owner, incompatible populations, unexplained exclusion or unsupported tail`

## Method and assumption trace

| Method/assumption ID | Method/component                                                      | Population/period | Formula or implementation pointer | Input and unit/basis | Observed evidence | Selected supplied value | Alternatives/sensitivity | Source URI or controlled record | Version | Source/effective date | Owner  | Reviewer | Applicability | Uncertainty | Status | Evidence pointer | Decision not made | Stop condition |
| -------------------- | --------------------------------------------------------------------- | ----------------- | --------------------------------- | -------------------- | ----------------- | ----------------------- | ------------------------ | ------------------------------- | ------- | --------------------- | ------ | -------- | ------------- | ----------- | ------ | ---------------- | ----------------- | -------------- |
| ASM-001              | `development/tail/trend/ELR/exposure/large-loss/reinsurance/discount` | `____`            | `____`                            | `____`               | `____`            | `____`                  | `____`                   | `____`                          | `____`  | `____`                | `____` | `____`   | `____`        | `____`      | `open` | `____`           | `____`            | `____`         |

## Diagnostic disposition

| Diagnostic ID | Factor/observation | Volume and leverage | Calendar/diagonal or operational context | Candidate explanations | Quantitative consequence | Authorized disposition and rationale | Reviewer | Status |
| ------------- | ------------------ | ------------------- | ---------------------------------------- | ---------------------- | ------------------------ | ------------------------------------ | -------- | ------ |
| DIA-001       | `____`             | `____`              | `____`                                   | `____`                 | `____`                   | `____`                               | `____`   | `open` |

For chain ladder evidence, preserve observed link ratios, weights, exclusions, age-to-age selections, cumulative development and tail. For Bornhuetter-Ferguson or expected-loss evidence, preserve the independent expected ultimate or expected loss ratio, denominator and percentage unpaid/unreported. Align frequency, severity, exposure, trend, case practice and large-loss definitions before comparison. An anomaly is a question for qualified review, not automatic permission to exclude a point. This worksheet records supplied methods and their evidence; it does not choose an assumption or convert an indication into a booked reserve.
