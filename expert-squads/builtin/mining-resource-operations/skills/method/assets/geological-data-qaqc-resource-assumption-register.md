# Geological Data, QA/QC and Resource Assumption Register

## Control header

- Register ID: `GEO-QAQC-____`
- Site / commodity / orebody or domain: `____`
- Database and model version: `____`
- Data cut-off and timezone: `____`
- Coordinate reference system: `____`
- Units, density basis and moisture basis: `____`
- Applicable reporting code/version/date: `____`
- Source set and extraction date: `____`
- Owner / qualified reviewer: `____ / ____`
- Applicability: `exploration | grade control | model validation | other: ____`
- Uncertainty statement: `____`
- Status: `draft | open exception | qualified review required | reviewed`

## Evidence rows

| Row ID  | Object type and stable ID | Hole/sample/batch/domain interval | Quantity and unit or result | Method and acceptance rule source | Source URI/record, version, observation date | Owner / reviewer | Applicability | Uncertainty | Status | Evidence pointer / next action |
| ------- | ------------------------- | --------------------------------- | --------------------------- | --------------------------------- | -------------------------------------------- | ---------------- | ------------- | ----------- | ------ | ------------------------------ |
| GEO-001 | sample / `____`           | `____`                            | recovery `____ %`           | documented rule `____`            | `____`                                       | `____ / ____`    | `____`        | `____`      | `open` | `____`                         |

## QA/QC batch evaluation

| Batch ID | Laboratory / method | Certified reference material result vs certified value and uncertainty | Blank result and contamination rule | Duplicate class and precision calculation                       | Failure/disposition evidence | Reviewer | Status |
| -------- | ------------------- | ---------------------------------------------------------------------- | ----------------------------------- | --------------------------------------------------------------- | ---------------------------- | -------- | ------ |
| `____`   | `____`              | value `____`, certified `____ ± ____`, unit `____`                     | `____`                              | field/coarse/lab `____`; formula, numerator, denominator `____` | `____`                       | `____`   | `____` |

## Model and assumption trace

| Assumption ID | Domain / estimate object | Data selection, compositing or capping basis | Density and survey basis | Estimation/search/validation evidence | Classification rationale as supplied | Qualified reviewer question | Status                      |
| ------------- | ------------------------ | -------------------------------------------- | ------------------------ | ------------------------------------- | ------------------------------------ | --------------------------- | --------------------------- |
| ASM-001       | `____`                   | `____`                                       | `____`                   | `____`                                | quoted only by source pointer `____` | `____`                      | `qualified review required` |

Do not use this register to classify or sign a Mineral Resource or Mineral Reserve. Missing chain of custody, units, coordinate system, acceptance criteria or model lineage is an explicit stop condition, not a presumed pass. All calculated metrics retain formula, population, numerator and denominator. Resolution requires the named Qualified Person or Competent Person and authorized geology, survey, laboratory or QA reviewer.
