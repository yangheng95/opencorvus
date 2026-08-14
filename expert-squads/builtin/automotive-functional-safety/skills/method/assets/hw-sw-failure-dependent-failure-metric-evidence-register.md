# HW/SW Failure, Dependent-Failure and Metric Evidence Register

## Governance header

- Register ID / item / variant / architecture and configuration: `____`
- Analysis method/source/version/effective date: `FMEA | FMEDA | FTA | DFA | other: ____`
- Failure-rate/diagnostic data source/version/date: `____`
- Cutoff and extraction date: `____`
- Owner / HW-SW safety reviewer / assessor: `____ / ____ / ____`
- Units/basis/population definition: `____`
- Applicability/uncertainty/status: `____ / ____ / ____`
- Decision not made: `failure classification/rate, diagnostic coverage, ASIL metric acceptance, mechanism adequacy`
- Stop condition: `missing component/function/rate/coverage/formula/population/configuration/authority`

| Row ID   | Function/component/software unit | Failure mode/cause | local/end effect | linked requirement/hazard | safety mechanism/detection | fault classification as supplied | rate/value/unit/basis and source | diagnostic coverage as supplied | dependent/common cause | metric population/formula/numerator/denominator/result | Source/version/date | Owner/reviewer | Applicability | Uncertainty | Status | Evidence pointer | Decision not made | Stop condition |
| -------- | -------------------------------- | ------------------ | ---------------- | ------------------------- | -------------------------- | -------------------------------- | -------------------------------- | ------------------------------- | ---------------------- | ------------------------------------------------------ | ------------------- | -------------- | ------------- | ----------- | ------ | ---------------- | ----------------- | -------------- |
| FAIL-001 | `____`                           | `____`             | `____`           | `____`                    | `____`                     | `____`                           | `____`                           | `____`                          | `____`                 | `____`                                                 | `____`              | `____ / ____`  | `____`        | `____`      | `open` | `____`           | `____`            | `____`         |

## Analysis-to-test link

| Link ID | failure/mechanism ID | verification case/configuration | fault injection or stimulus | expected/actual result | anomaly | reviewer/status |
| ------- | -------------------- | ------------------------------- | --------------------------- | ---------------------- | ------- | --------------- |
| VT-001  | `____`               | `____`                          | `____`                      | `____ / ____`          | `____`  | `____ / open`   |

Recalculate only when the authorized metric definition and all inputs exist; preserve formula and population. Never source generic rates, infer independence or label a safety mechanism adequate. Passing sampled tests is not completeness. Qualified HW/SW safety, reliability, system/test and independent functional-safety reviewers own classification, metrics and adequacy.
