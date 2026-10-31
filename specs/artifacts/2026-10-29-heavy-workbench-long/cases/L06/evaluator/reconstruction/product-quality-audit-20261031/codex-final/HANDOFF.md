# Reproduce and inspect the maritime optimizer

The submitted root is the current working directory for every command below. No build is required. The declared native interpreter is:

```powershell
$py = 'D:/opencorvus-benchmark-runs/native-operations-reconstruction-20261031/Scripts/python.exe'
```

The compute programme reads only its complete assigned MPS/raw inputs and submitted source/generic packages. It does not read the development vectors, solver logs, figures, reference answers or caches. Python is invoked with `-B`. All output paths should be new owned directories; the programme refuses to overwrite a completed experiment. Native processes finish normally. No Docker, WSL, user-window automation or additional solver worker is used.

## Assigned-input interface

The final programme is optimize.py, the class-block large-neighborhood search (LNS) method declared in submission.json. The declared argv has the complete input/output placeholders and an explicit nominal numerical optimization allocation. The per-run output directory receives `layout.json`; its six relative paths name the complete vector, native objective, all positive original arcs, anonymous paths, every port-period inventory row and the full cost decomposition. The source root is separate from each fresh output namespace. An incomplete solve writes an honest status/error instead of a fabricated plan.

For the class-block programme, the concrete interface is:

```powershell
& $py -B optimize.py --model '{model}' --raw '{raw_archive}' --instance '{instance}' --out '{out}' --optimization-seconds 180
```

For direct SCIP and integer-stock CP-SAT comparisons:

```powershell
& $py -B solve.py --model '{model}' --raw '{raw_archive}' --instance '{instance}' --out '{out}' --optimization-seconds 180 --method scip
& $py -B solve.py --model '{model}' --raw '{raw_archive}' --instance '{instance}' --out '{out}' --optimization-seconds 180 --method cp
```

Replace braces with actual assigned input/output values; these examples are argument templates, not shell expansion syntax. The source root and supplied raw archive may have ordinary arbitrary names. Raw selection is validated against the full model's port/class data, initial injections and all assigned rate rows. Model horizon is derived from MPS inventory rows, never the raw metadata's 360 periods.

## Original-model and operating audit

After any feasible run:

```powershell
& $py -B check.py --model '{model}' --raw '{raw_archive}' --instance '{instance}' --out '{out}'
```

This checks the complete original variable set, original bounds/integrality, every MPS row, original objective dot product, table coverage/types/costs, all source-to-exit flow counts and physical continuity, all port-period stocks/rates/service/alpha/berths and economic decomposition. It writes `independent-audit.json`. It uses the public tolerances, not an economic quality cutoff. Native optimal/local statuses are not treated as table or full-model feasibility proofs.

## Development reproduction

The three development IDs and their MPS files are under `../public/inputs`; `development-raw.zip` contains their original raw inputs. A fresh single-instance reproduction is:

```powershell
$instance = 'LR1_DR02_VC05_V8a_t120'
& $py -B optimize.py --model "../public/inputs/$instance.mps" --raw '../public/inputs/development-raw.zip' --instance $instance --out "reproductions/$instance-classblock" --optimization-seconds 180
& $py -B check.py --model "../public/inputs/$instance.mps" --raw '../public/inputs/development-raw.zip' --instance $instance --out "reproductions/$instance-classblock"
```

Use the same exact model/raw/name/budget and distinct fresh output directories for each comparison method. Run them sequentially to preserve the one-thread numerical comparison. `run_experiments.py` and `run_classblock.py` are the original registered launchers and deliberately refuse to overwrite their preserved evidence. Each original run has a source snapshot, command, native parameters/log, genuine incumbent event stream, terminal status, full feasible vector when available, timing and process return code. Class-block stage records retain local bounds as local. Only unrestricted stages contribute to the reported global bound.

The original development figures and analysis can be regenerated from those preserved artifacts:

```powershell
& $py -B figures.py
& $py -B analyse_operations.py
```

The programmes generate the actual PNGs, `analysis-summary.json`, `operating-analysis.json` and per-plan initial-service tables. source-map.json traces the static report/figures to the experiment directories. Rendering is outside the numerical allocation.

## Dependencies and local provenance

`requirements-lock.txt` lists exact observed package versions. `native-environment.json` records the interpreter and declared generic solver packages. The assigned compute path needs the supplied Python 3.14/PySCIPOpt 6.3.0 runtime (and OR-Tools 9.15.6755 for the comparison engine). `vendor` contains the actually installed plotting/PDF dependencies; `dependency-install.log` records the native install. Matplotlib uses an owned config/cache directory. To reproduce the generic dependency install elsewhere, first set TEMP, TMP and PIP_CACHE_DIR to owned project directories and install exact versions into the owned vendor directory; do not mutate the shared runtime.

All source provenance is local to this isolated submitted project. `.git` contains local reviewable source/delivery commits and no remote. The host repository was not operated on and nothing was pushed or published. Development outputs, caches and vendor packages are delivered on disk but excluded from source-history commits. No old vector is a dependency of assigned-input execution.

See EXPOSURE.md for the precise input boundary, consulted generic documentation and preserved initial failures. See REPORT.md for actual quality, economics and uncertainty. Completion of these artifacts is an engineering result; no external benchmark grade, universal physical-operating guarantee or exact rational optimality is claimed.
