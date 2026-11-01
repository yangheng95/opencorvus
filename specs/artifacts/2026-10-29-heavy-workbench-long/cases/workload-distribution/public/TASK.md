# March workload distribution review

Act as the project manager preparing a workload tracker for management. Use the three supplied original workbooks: `WDTStakeholderRegistry.xlsx`, `WDTTimekeepingExport_1.xlsx` and `MarchBudget.xlsx`. Produce one usable Excel workbook and brief written answers about departmental capacity, individual allocation and project budget overruns. Include the 23 registered employees, their roles, departments and full monthly capacity on a supporting `Stakeholder Registry` sheet.

This is a clarified derivative of GDPval task `ce864f41-8584-49ba-b24f-9c9104b47bf0`, not an official GDPval evaluation. The original task text is supplied alongside this contract. The definitions below resolve its ambiguous month/overhead conventions for this exercise. Follow these definitions consistently; do not substitute figures from a published answer.

## Period and capacity

- Use all four source sheets, `Mar. 3`, `Mar. 10`, `Mar. 17` and `Mar. 24`, as the supplied March booking export. A blank hour cell for a named person/project means no recorded charge in that cell. A completely blank row is not a person.
- March 2025 has 21 Monday–Friday working days under this exercise's calendar, with no additional holidays: nominal monthly capacity is 168 hours for FT and 84 hours for PT. Keep this assumption editable and visible.
- Department utilization is registered employees' total recorded hours, including Admin, divided by their nominal capacity. Flag below 95% as `under`, above 105% as `over`, and the inclusive interval as `within`.
- An individual's project hours exclude the actual `Admin` column. Available project capacity is 85% of nominal capacity. Project allocation is project hours divided by available project capacity. Flag below 60% as `under`, above 90% as `over`, and the inclusive interval as `within`. These are exercise flags, not measured clinical burnout.
- These ratios describe the supplied records against the stated monthly capacity. The export has no `Mar. 31` sheet; do not assert that unprovided work or actual March 31 activity was zero, or that these records establish final actual monthly utilization.

## Reconciliation and uncertainty

Match people by name and projects by supplied headings. The export's `Wrike Transition Intiative` maps to the budget's `Wrike Transition Initiative`; disclose this spelling mapping. Preserve the original raw headings separately.

Ellen Zhu occurs in the timekeeping export but has no personnel record. Include all her project and Admin hours in source/project reconciliation. Show her separately with unknown department, employment type, capacity and allocation rate. Do not assign an invented department/type, silently drop her, or divide by a guessed capacity. Department ratios cover the 23 registered employees; report unassigned hours separately and identify the HR information needed for a company-wide conclusion.

Compare each of the nine projects' recorded hours, including unregistered personnel, against its March budget. Report actual hours, budget, signed excess `actual − budget`, and `over` only when the excess is strictly positive.

## Deliverables and reuse

Deliver `tracker.xlsx`, a concise `answers.md` or PDF answering all three management questions with named risks, scope limitations and practical next steps, and complete source/run instructions that rebuild the workbook from the three original files. Keep the raw records available in the workbook. Preserve traceable links or formulas from editable capacity/budget/raw inputs to the summaries; changing one source hour or capacity must update the relevant results. No specific algorithm or spreadsheet library is required.

For interoperable numerical review, include the following labelled tables in the workbook (any sheet, row position, column order and styling; each header appears once in its table). The other workbook layout is free.

- People: `person`, `department`, `employment`, `nominal_h`, `project_capacity_h`, `project_h`, `admin_h`, `total_h`, `allocation`, `status`. Include all 23 registered people and the separately identified unregistered person. Unknown values remain blank or `unknown`, not numeric zero.
- Departments: `department`, `nominal_h`, `total_h`, `utilization`, `status`. Five registered departments only.
- Projects: `project`, `budget_h`, `actual_h`, `excess_h`, `status`. All nine budget projects.

Rates are stored as numeric ratios, e.g. `0.8`, with a readable percentage format. Hours may be fractional. Include total recorded hours, registered hours and unassigned hours with an explicit reconciliation. The supplied original records are research exercise materials; names are fictional according to the source dataset disclosure.

## Quality interpretation

Numerical accuracy, treatment of missing personnel/period information, traceability and refresh behavior, and management explanation are separate results. No score threshold or reference-file existence establishes professional quality. There is no minimum duration or required number of tools, plots, formulas or tokens. No result from this prototype establishes multi-hour difficulty, model superiority or performance on unseen tasks.
