# Candidate handoff: L02 release-aware hierarchy study

The final numerical submission is **submission.json**. It declares every source file and literal argv, the three frozen configurations and the selection pool. Final source is in **src/**; the predictor fits from the supplied legal packet each time, selector performs exact rational three-inner loss selection, and reporter consumes completed results/provenance only after numerical sealing.

## What has actually run

- validation/cold-001: first environment-probe failure, retained. A read-only probe omitted writable /tmp and Matplotlib could not create its cache. The final runner fixes that dependency setup.
- validation/cold-002: original public exploration,18 real prediction containers +1 selector +1 reporter, all exited0. Weather extension was worse than the no-weather ablation; its original outputs, source snapshot and figures remain intact.
- validation/cold-003: final NUMERICAL source/configurations,18 real prediction containers +1 selector +1 reporter, all exited0. Runs all six public development origins and all three methods from fresh legal raw packets. Every container has only the declared source files, a single input packet, new output and /tmp; root/project/input read-only, networknone, CPU1, dropped capabilities and fixed thread environment. Real create/start/inspect/removal records, stdout/stderr, projected inputs, source copies and results are retained.
- validation/checks-003: positive closed-form numerical checks and actual input/output/lineage audit over all18 final prediction cells:34,174 fit rows and111,280 historical issue-bias pairs, plus all feature/label refs and84-row outputs per cell.
- validation/selector-controls-001:5 real selector containers, each declared method forced to be best, exact tie, and legal tiny decimal differences below floating-point precision; exact output losses matched independent recalculation. These synthetic controls are never presented as model performance.
- validation/final-report-001: final reporter source executed in a fresh container on the ORIGINAL final numerical/provenance input from cold-003, after a reporting-only enhancement. It adds weather-bias/target-feature tables and explicit12-case operating contrasts; forecasts/selection were preserved. Its3 actual PNG figures were viewed after generation. Its report is the current public research entry point: **validation/final-report-001/report-output/result/report.md**.

The first five public cuts display a preset no-weather strategy diagnostic; the November cut uses a genuinely executed selector on the first three earlier public dev cuts whose labels were then available. This is explicitly labeled public exploration, NOT the36 registered private inner runs. Per-method development results are real for all six cuts. Public scales used for scoring/selection were not mounted to any predictor.

**No private outer labels, packets, quality reference predictions or evaluator code were available or accessed. The formal12 outer/36 inner execution, independent quality floor and candidate score remain pending evaluator execution after this handoff.** No claim of official checker pass, full-assignment completion or quality success is made. All later code/config tuning is prohibited once the evaluator seals this submission.

## Proven runtime and dependencies

Runtime image: sha256:23ff8bfbf8055caa0b9fa5745ddb27cceea2f31d7d15b7a900c81112cdfe8ddf.
Actual probe: CPython3.11.13 (conda-forge), NumPy2.4.6, Matplotlib3.10.3; details in validation/cold-003/environment.json. Production executable is /opt/cpsat/bin/python. No solver is used. Host public runner used Python3.14.2 standard library and Docker CLI. requirements.txt declares the only nonstandard imports. All dependencies must be preinstalled before a no-network worker starts; no runtime installation or credentials are used.

Production literal commands (cwd=/project):

```
/opt/cpsat/bin/python -B src/predict.py
/opt/cpsat/bin/python -B src/selector.py
/opt/cpsat/bin/python -B src/report.py
```

Defaults read /input and write /output/result. Source files are exactly those in submission.json; the report also needs METHODS.md/references.json. Python -B and a writable /tmp suffice in a read-only container; set MPLCONFIGDIR=/tmp/matplotlib, and OMP_NUM_THREADS/OPENBLAS_NUM_THREADS/MKL_NUM_THREADS/NUMEXPR_NUM_THREADS=1. Each call must have its own fresh /output and /tmp. Reporter uses Matplotlib Agg and never opens UI.

Input/output/error domain is INTERFACES.md and METHODS.md. Native exceptions exit nonzero with their traceback; insufficient history/calibration is a named ValueError, never a fabricated forecast. The formal runner must preserve that terminal state as required by EXECUTION-CONTRACT.md. Candidate self-report cannot override a native failure.

## Clean public rebuild

Use a NEW directory containing the16 original public inputs and this submission's sources/docs/scripts; extract the public ZIP into development/ without changing contents. Prepare the declared cached image. From that directory on Windows:

```
Expand-Archive -LiteralPath development-materials.zip -DestinationPath development
python run_development.py --output validation/new-public-run
python verify_development.py --run validation/new-public-run --output validation/new-public-checks
```

The runner refuses an existing output root, copies the declared programs/configuration before any cell, projects raw releases separately per origin, and stages only a single packet for each predictor. Its local scoring code/scale sources run outside numerical sandboxes. It cannot obtain private data or install dependencies. The positive fixtures and lineage audit use the --run directory, so no old numeric output is required. To execute fresh numeric controls use: python run_selector_controls.py --run validation/new-public-run --output validation/new-selector-controls. All development scripts refuse an existing output root; use a new name for another scientifically necessary run without changing frozen production sources.

To run ONE official predict call, the evaluator prepares /input/packet/{packet.json,observations.csv,covariate-vintages.csv} and /input/method.json from the original pool; it mounts only that program's declared files at /project. Selector gets only inner.json/study.json, and report only results.json/provenance. Do not mount this entire public development folder or other worker outputs to a predictor.

Public development receipts are not a replacement for evaluator persistence. native/cell-*/native.json is written before create, CID is saved before start, then original real state/output is saved before removing only that own exited container. The local runner is deliberately fresh-only, not a crash-resume service. On an interrupted local run retain its directory/CID and inspect that original object; do not claim unstarted cells failed or restart an exited CID. Formal restore/locking/accepted-object identity follows the evaluator contract. Local code does not implement an alternative database or shadow official lifecycle.

## Evidence, source fidelity and archives

candidate-submission.zip contains all16 original public inputs, the current production sources/configuration, development/rebuild helpers and research docs. The separate validation evidence archives contain actual original native executions/results. build_bundle.py rebuilds the source/public-material handoff; archive_evidence.py creates fresh evidence archives and then the same bundle. Neither performs an official private assessment.

validation/*.zip are lossless archives of the original named evidence directories, including inputs, sealed source copies, raw native terminal facts and all outputs. Uncompressed folders remain for direct review and plotting; they are working copies of those archives. No mutable source digest is used as a correctness test. Git records the reviewable source and archived evidence; source fidelity is checked by direct byte comparison with the actual numerical/selector/report source copies that ran. The complete predictions, calibration residuals, training samples/feature matrices/parameters, and raw-row registry are not replaced by a verbal receipt.

METHODS.md gives the scientific method/ablation and all priors. specs/plan.md includes Recall and the analysis before coding; specs/development.md records real failures, public-only design changes, numeric findings and figure review. references.json records checked primary sources. The three public contract JSON files remain the protocol authority.

The methods carry material assumptions: unobserved closure/transfer effects are not identified by announcement status, the shutdown prior can be overconfident, day14 weather is an estimate, historical residual tails are finite, and unannounced changes cannot be known in advance. There is no real supply-agency, joint path, inventory/capacity or causal-effect certification. See the report's full adverse results and per-leaf/per-cost ledger rather than inferring every period improved from an overall average.
