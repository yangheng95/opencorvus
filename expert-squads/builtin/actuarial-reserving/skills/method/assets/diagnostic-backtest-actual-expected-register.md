# Diagnostic, Backtest and Actual-versus-Expected Register

## Governance header

- Register ID / portfolio / method-version / valuation comparison: `____`
- Evidence cutoff and timezone / extraction date: `____ / ____`
- Source / version / source date: `____ / ____ / ____`
- Owner / qualified reviewer: `____ / ____`
- Unit and basis: `currency/count/ratio; gross/ceded/net; paid/incurred; origin and development grain`
- Applicability: `prior-estimate backtest | actual-versus-expected | factor stability | residual | calendar-period diagnostic`
- Uncertainty: `____`; status: `draft | open | challenged | qualified review required | reviewed`
- Decision not made by this asset: `model validation approval, method/assumption selection, reserve adequacy, booking or actuarial opinion`
- Stop condition: `mismatched scope, absent expected definition/denominator, circular test, hidden exclusion or unknown implementation version`

## Test results

| Test ID  | Prior prediction / expected definition | Observed actual definition | Origin/development/population | Expected value / unit / basis | Actual value / unit / basis | Variance/sign/denominator | Method/config version | Independence and cutoff evidence | Source URI | Source version/date | Owner  | Reviewer | Applicability | Uncertainty | Status | Evidence pointer | Decision not made | Stop condition |
| -------- | -------------------------------------- | -------------------------- | ----------------------------- | ----------------------------- | --------------------------- | ------------------------- | --------------------- | -------------------------------- | ---------- | ------------------- | ------ | -------- | ------------- | ----------- | ------ | ---------------- | ----------------- | -------------- |
| TEST-001 | `____`                                 | `____`                     | `____`                        | `____`                        | `____`                      | `____`                    | `____`                | `____`                           | `____`     | `____`              | `____` | `____`   | `____`        | `____`      | `open` | `____`           | `____`            | `____`         |

## Pattern and finding log

| Finding ID | Related test IDs | Repeated direction or instability | Data/parameter/model/operational candidate cause | Evidence for and against | Potential estimate impact | Resolver | Reviewer | Status |
| ---------- | ---------------- | --------------------------------- | ------------------------------------------------ | ------------------------ | ------------------------- | -------- | -------- | ------ |
| FIND-001   | `____`           | `____`                            | `____`                                           | `____`                   | `____`                    | `____`   | `____`   | `open` |

Match prior predictions to subsequent observations on identical scope, measure, unit, currency, gross/net status, nominal/discounted basis and origin/development definition. Record failed, null and adverse tests along with supportive results. Show whether the same observations influenced assumption selection and evaluation; do not call such evidence independent. A one-period miss, a stable aggregate or a favorable point estimate is not proof of adequacy. Qualified actuaries and validators decide the relevance of diagnostics; this register cannot select a model or reserve.
