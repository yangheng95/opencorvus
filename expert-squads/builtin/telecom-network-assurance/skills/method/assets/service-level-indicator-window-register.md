# Service-Level Indicator Window Register

> Targets and exclusions are authorized inputs. This register does not interpret SLAs or declare compliance.

## Indicator control

| Register version | Service/population scope | Applicable layer/direction | Observation window/time zone | Maintenance/exclusion rule source/version | Target/threshold source/version | Query/telemetry source version | Data freshness/completeness | Responsible reliability owner | Uncertainty |
| ---------------- | ------------------------ | -------------------------- | ---------------------------- | ----------------------------------------- | ------------------------------- | ------------------------------ | --------------------------- | ----------------------------- | ----------- |
|                  |                          |                            |                              |                                           |                                 |                                |                             |                               |             |

## Indicator definitions and calculations

| Indicator ID | Availability / latency / loss / error / other | Exact good/bad event and eligible population definition | Numerator | Denominator | Formula | Result/range and unit | Aggregation/percentile/sample method | Window and time zone | Filters/exclusions | Source/query version/freshness | Target-as-input and source | Error budget / consumption | Uncertainty/bias | Responsible reviewer |
| ------------ | --------------------------------------------- | ------------------------------------------------------- | --------- | ----------- | ------- | --------------------- | ------------------------------------ | -------------------- | ------------------ | ------------------------------ | -------------------------- | -------------------------- | ---------------- | -------------------- |
|              |                                               |                                                         |           |             |         |                       |                                      |                      |                    |                                |                            |                            |                  |                      |

Use `availability = good eligible time / eligible time`, `packet loss = lost / transmitted`, `error budget = (1 - target) * eligible population or time`, and `budget consumption = bad eligible population or time / error budget`. Mark undefined at zero denominator.

## Incident and data-quality reconciliation

| Reconciliation ID | Service/window | Incident IDs | Bad-time/population evidence | Planned exclusion evidence | Counter reset/gap/late data | Indicator source/version | Applicable unit | Unexplained difference | Uncertainty | Responsible NOC/reliability owner | Commercial/legal question | Status |
| ----------------- | -------------- | ------------ | ---------------------------- | -------------------------- | --------------------------- | ------------------------ | --------------- | ---------------------- | ----------- | --------------------------------- | ------------------------- | ------ |
|                   |                |              |                              |                            |                             |                          |                 |                        |             |                                   |                           |        |
