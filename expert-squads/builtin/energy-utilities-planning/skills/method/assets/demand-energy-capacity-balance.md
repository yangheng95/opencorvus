# Demand, Energy, and Capacity Balance

## Control fields

| Field                                                                | Value |
| -------------------------------------------------------------------- | ----- |
| Asset version                                                        |       |
| Scenario and applicability scope                                     |       |
| Horizon / interval / time zone                                       |       |
| Data owner                                                           |       |
| Load, weather, generation, import, and storage source IDs / versions |       |
| Power unit / energy unit                                             |       |
| Coverage and uncertainty                                             |       |

## Interval balance

Use `net requirement = gross demand + losses - embedded supply` and `interval balance = available supply - net requirement`. Keep supplied availability distinct from nameplate capacity.

| Interval | Gross demand (power unit) | Losses (power unit) | Embedded supply (power unit) | Net requirement (power unit) | Generation available (power unit) | Import available (power unit) | Storage discharge/charge (power unit) | Storage energy remaining (energy unit) | Balance (power unit) | Source IDs / versions | Uncertainty range | Applicability | Owner | Feasible / reason |
| -------- | ------------------------: | ------------------: | ---------------------------: | ---------------------------: | --------------------------------: | ----------------------------: | ------------------------------------: | -------------------------------------: | -------------------: | --------------------- | ----------------- | ------------- | ----- | ----------------- |
|          |                           |                     |                              |                              |                                   |                               |                                       |                                        |                      |                       |                   |               |       |                   |

## Reconciliation

| Check           | Formula / rule                                                                        | Result and unit | Source | Version | Uncertainty | Applicability | Responsible owner |
| --------------- | ------------------------------------------------------------------------------------- | --------------- | ------ | ------- | ----------- | ------------- | ----------------- |
| Horizon energy  | Sum(interval power × interval duration)                                               |                 |        |         |             |               |                   |
| Peak adequacy   | Dependable capacity - coincident peak requirement                                     |                 |        |         |             |               |                   |
| Storage closure | Opening energy + charged energy - discharged energy - sourced losses = closing energy |                 |        |         |             |               |                   |
