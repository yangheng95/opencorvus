# Native operational handoff

The exporter uses only Python standard-library modules and the current
verify_original_mps.py. It reads a closed original plan directory containing its
original MPS, final-values.json and native result.json, plus the original Group2
data-only ZIP. Use a fresh output directory, retaining all previous failures.

```powershell
python -B export_operational_plan.py --closed-plan <original-closed-instance-directory> --raw-archive <Group2_data_format_only_files.zip> --instance <original-instance-name> --out <new-operational-directory>
```

The successful output contains class-arc-plan.csv, anonymous-vessel-paths.csv,
port-period-ledger.csv, economic-components.csv, operational-closure.json,
the original mathematical check and execution-started/terminal.json. A facility
failure instead preserves execution-error.json and the completed prior facts.
The exporter does not run an optimizer or silently switch to another model.

The report renderer additionally uses the declared plot-requirements.txt. Its
index names actual successful exports; published-context JSON is a recorded
scalar observation of the original MIRPLIB table, not a current web query.

```powershell
python -B report_operational_study.py --index <operational-study-index.json> --published-context <group2-published-scalar-context-rows.json> --out <new-report-directory>
```

The data-fetch, actual original solver and first quality-plot commands are in
the reconstruction README. Current studies are closed and must not be repeated
for qualification. A new end-to-end cold rebuild has not been performed for this
operational report. The source versions and real execution receipts are the
authority for what actually ran, not this command example.
