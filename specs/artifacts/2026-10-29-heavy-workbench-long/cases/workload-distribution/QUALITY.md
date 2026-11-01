# Workload review quality contract

This prototype reports separate dimensions. It has no aggregate score, private acceptance cutoff or minimum elapsed work requirement. Requirements are public in TASK; an unassessed item stays unassessed. A correct original-source numerical result does not establish useful management advice, full delivery, unseen-input generalization or professional equivalence.

| ID | Object and observable result | Evidence |
| --- | --- | --- |
| Q01 | All four source sheets, 23 registered people and the separately unregistered person are accounted for | Source rows, raw workbook data and reconciliation |
| Q02 | Actual per-person project/Admin/total hours equal the original charges | Three independent absolute hour error columns per person; preserve each error, not only an average |
| Q03 | Nominal/project capacities follow the public calendar and 85% convention | Absolute hour error and precedent inspection |
| Q04 | Personal allocation ratios and inclusive threshold statuses follow the public definitions | Ratio error per person and exact status; unknown capacities/rates stay unavailable |
| Q05 | Five department totals/capacities/ratios cover exactly registered personnel | Per-department numeric errors, exact statuses and disclosed coverage |
| Q06 | Nine projects include every person's project hours and use the supplied budget | Per-project actual/budget/excess errors; exact overrun status |
| Q07 | The project spelling map is explicit; unknown HR attributes are not invented | Source heading, mapping and unassigned-person record |
| Q08 | Recorded, registered and unassigned hours reconcile with Admin/project breakdown | Independent source controls and workbook totals |
| Q09 | Workbook quantities can be traced to editable inputs and update on source-hour/capacity changes | Actual saved/imported workbook recalculation and changed dependent results |
| Q10 | A usable tracker, required registry, written answers and reproducible source/run instructions are delivered | Open actual files; rebuild from supplied original source; no credit merely for names/counts |
| Q11 | The three management answers identify the actual affected departments/people/projects and explain denominators | Read the full answers against the actual workbook/source |
| Q12 | Recommendations respect missing HR and March31 information, and do not claim measured burnout or final actual monthly utilization | Specific assertions tied to source evidence |
| Q13 | Tables are readable, typed quantities and unknowns are distinguishable, and the raw data remains inspectable | Render and actually view every output/support sheet |

`check_workbook.py` consumes saved XLSX values, finding labelled tables without fixed sheet names, row locations or column order. It verifies Q02–Q06 numerical contents plus the corresponding population. It preserves every numerical difference and reports `VALUE_MISMATCH`, `ROW_MISSING`, `TABLE_LOCATION_ERROR` or `NUMERICAL_OR_POPULATION_MISMATCH` with exit4. A matching workbook exits0. The same code is used for reference and intentionally wrong program output.

Q01/Q07–Q13 additionally need actual source, formulas, rerun/refresh, written-content and visual review. The machine result explicitly does not certify those items. The current author self-check is not the required independent whole-task review. No candidate has run, and no aggregate grade, overall model rank, heavy qualification or effective-hour evidence exists.

The published GDPval rubric and expert workbook are retained unchanged in the external source cache. The original expert uses a four-week capacity and project hours divided by nominal capacity; this derivative publicly declares a different denominator/calendar before computing its own reference. Neither rubric nor original answer is used as a hidden pass line for this derivative. Do not publish these results as official GDPval scores or transfer the original expert's standing to this reference.
