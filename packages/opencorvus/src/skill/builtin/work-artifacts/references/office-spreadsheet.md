# Qualified office.spreadsheet@1 profile

Create a new editable XLSX from `filename`, `locale`, and 1–8 ordered `sheets`.
Each sheet has a unique Excel `name`, 1–12 column headings, and 1–40 data rows.
Every row must have exactly one value per column: string, finite number,
boolean, or null for a blank cell. Strings remain strings, including leading
zeros and text starting with `=`. Formulas, charts, macros, external links,
templates and editing existing workbooks are outside this profile.

Keep totals numeric and label their units. Calculate requested totals from the
actual source data before authoring. Inspect and validate the exact canonical
source, then review every worksheet PNG for complete rows, headings, numeric
values, totals and readable widths. Reauthor the full plan when needed.

Deliver the source URL, exact completed validation receipt and localized title.
XLSX is the primary deliverable; the derived PDF is a review preview. Do not
claim Microsoft Excel pixel fidelity or formula recalculation support.
