# Native handoff

The declared source map includes run_reference_case.py, run_original_baseline.py,
run_class_pair_study.py, export_operational_plan.py, verify_original_mps.py,
construct_economic_bounds.py, verify_economic_bounds.py,
assess_operating_delivery.py and render_reference_case.py.
Requirements for the compute interpreter are requirements.txt; the report
interpreter uses plot-requirements.txt. Third-party runtimes are declared inputs,
not old solution caches. Use a new owned output directory; preserve this run.

```powershell
python -B run_reference_case.py --model <assigned.mps> --raw-archive <assigned-raw.zip> --instance <assigned-name> --report-python <declared-plot-python.exe> --out <new-owned-output>
```

The numeric profile is the existing 60-second cold solve plus nominal 120-second
method wall, one solver thread and seed0. Actual setup, checks and indivisible
step overruns stay in the recorded facts; they are not candidate effective hours.
The report process is only rendering and does not run an optimizer.
