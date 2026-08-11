# Maintenance Event, Defect, and Reliability Register

> Analytical evidence only. Rates and signals are not maintenance instructions, failure diagnoses, approved alert levels, or interval decisions.

## Dataset control

| Register ID | Revision | Fleet/configuration applicability | Observation window/time zone | Event taxonomy version | Exposure source/version/date | Event source/version/date | Rate units and scale             | Responsible owner | Qualified reviewer | Uncertainty | Decision status |
| ----------- | -------- | --------------------------------- | ---------------------------- | ---------------------- | ---------------------------- | ------------------------- | -------------------------------- | ----------------- | ------------------ | ----------- | --------------- |
|             |          |                                   |                              |                        |                              |                           | events per 1,000 hours or cycles |                   |                    |             |                 |

## Event and exposure reconciliation

| Evidence row ID | Aircraft/configuration | ATA/system/component/position | Event type and event IDs | Eligibility/deduplication rule | Unique numerator | Exposure denominator | Denominator unit | Scale | Formula/result                  | Window | Source/version/date | Missing/censored exposure | Uncertainty | Owner/reviewer | Status |
| --------------- | ---------------------- | ----------------------------- | ------------------------ | ------------------------------ | ---------------- | -------------------- | ---------------- | ----- | ------------------------------- | ------ | ------------------- | ------------------------- | ----------- | -------------- | ------ |
|                 |                        |                               |                          |                                |                  |                      |                  |       | numerator / denominator × scale |        |                     |                           |             |                |        |

## Repeat, removal, and trend evidence

| Signal ID | Scope/configuration | Operator-supplied repeat definition or baseline | Compared periods | Rate or count with unit | Alert/control input and version | Statistical assumptions | Denominator drift | Shop finding/no-fault-found evidence | Competing hypotheses | Source IDs | Confidence/uncertainty | Responsible owner | Qualified reviewer | Decision status |
| --------- | ------------------- | ----------------------------------------------- | ---------------- | ----------------------- | ------------------------------- | ----------------------- | ----------------- | ------------------------------------ | -------------------- | ---------- | ---------------------- | ----------------- | ------------------ | --------------- |
|           |                     |                                                 |                  |                         |                                 |                         |                   |                                      |                      |            |                        |                   |                    |                 |

## Stop and review queue

| Review ID | Unknown or conflict | Affected metric/configuration | Missing source/version/unit | Why calculation or interpretation stops | Required evidence | Authorized next check | Owner | Qualified reviewer | Status |
| --------- | ------------------- | ----------------------------- | --------------------------- | --------------------------------------- | ----------------- | --------------------- | ----- | ------------------ | ------ |
|           |                     |                               |                             |                                         |                   |                       |       |                    |        |
