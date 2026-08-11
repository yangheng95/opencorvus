# Mine Plan, Grade Control and Stockpile Reconciliation

## Control header

- Reconciliation ID: `REC-____`
- Site / mining area / commodity: `____`
- Model, plan, grade-control and survey versions: `____`
- Period, data cut-off and timezone: `____`
- Units and dry/wet/density bases: `____`
- Spatial boundary and plant-feed measurement point: `____`
- Stockpile master version/date: `____`
- Owner / reviewer: `____ / ____`
- Applicability: `model-to-plan | plan-to-mine | mine-to-stockpile | stockpile-to-mill`
- Uncertainty statement: `____`
- Status: `draft | open mismatch | qualified review required | reviewed`

## Stage-pair comparison

| Row ID  | Stage pair   | Period / area / material | Planned or upstream tonnes, grade, contained metal | Actual or downstream tonnes, grade, contained metal | Units, dry/wet and density basis | Formula with numerator/denominator                             | Source/version/date | Owner/reviewer | Applicability | Uncertainty | Status          |
| ------- | ------------ | ------------------------ | -------------------------------------------------- | --------------------------------------------------- | -------------------------------- | -------------------------------------------------------------- | ------------------- | -------------- | ------------- | ----------- | --------------- |
| REC-001 | plan-to-mine | `____`                   | `____ t; ____ unit; ____ metal-unit`               | `____ t; ____ unit; ____ metal-unit`                | `____`                           | variance `actual - plan`; ratio `actual / plan`; inputs `____` | `____`              | `____ / ____`  | `____`        | `____`      | `open mismatch` |

## Stockpile movement ledger

| Stockpile stable ID | Opening         | Receipts | Issues | Documented adjustment and evidence | Calculated closing                                  | Reported closing | Difference | Measurement basis / date | Owner / reviewer | Status |
| ------------------- | --------------- | -------- | ------ | ---------------------------------- | --------------------------------------------------- | ---------------- | ---------- | ------------------------ | ---------------- | ------ |
| `____`              | `____ t @ ____` | `____`   | `____` | `____`                             | opening + receipts - issues +/- adjustment = `____` | `____`           | `____`     | `____`                   | `____ / ____`    | `____` |

## Cause and decision trace

| Exception ID | Evidence-supported cause category | Supporting record IDs | Competing explanation | Decision needed         | Qualified reviewer | Due date       | Status       |
| ------------ | --------------------------------- | --------------------- | --------------------- | ----------------------- | ------------------ | -------------- | ------------ | ------ | ------ | ------ | ------ | ------ | ------ |
| EX-001       | `timing                           | dilution              | ore loss              | classification movement | sampling           | survey/density | unexplained` | `____` | `____` | `____` | `____` | `____` | `____` |

Compare only compatible periods, measurement points, material identities, units and bases. Never force-balance a stockpile, infer a cause from closure alone, approve a mine plan or turn this worksheet into a production instruction. Planning, geology, grade-control, survey, operations, metallurgy and metallurgical-accounting owners must review; Resource/Reserve implications require the Qualified Person or Competent Person.
