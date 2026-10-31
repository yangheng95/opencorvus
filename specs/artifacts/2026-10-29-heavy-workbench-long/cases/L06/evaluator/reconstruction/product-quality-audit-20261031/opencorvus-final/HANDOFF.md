# Native reproduction and operating handoff

## Entrypoint

Run from this `submission` directory. No build step is needed. The minimal
assigned-run source closure is `solve.py` and `modelio.py`, plus the declared
native Python/PySCIPOpt dependency. No experiment folder, stored vector, plotting
package or cache is needed to generate a new assigned plan.

```powershell
& 'D:/opencorvus-benchmark-runs/native-operations-reconstruction-20261031/Scripts/python.exe' -B solve.py --model '{model}' --raw '{raw_archive}' --instance '{instance}' --out '{out}' --optimization-seconds 180 --method feasibility
```

Replace each placeholder with its full assigned path/ID. The output directory
must be new or have no `native-result.json`; a recorded result is never
overwritten. `--method default` selects the study control. The manifest command
uses feasibility emphasis unconditionally, with no instance-ID answer lookup.
All numeric calculation uses the complete newly supplied MPS and raw ZIP.

The raw archive should contain the standard instance directory with metadata,
loading/discharge port data, vessel-class data and other supplied raw files.
The programme first matches the exact instance directory; a single-directory
assigned archive is accepted even if its directory basename differs. Ambiguous
multi-directory archives fail visibly rather than guessing an instance.

## Per-run output

`layout.json` is generated inside every successful assigned output directory.
It declares `values.json`, `native-result.json:actual_objective`, `arcs.csv`,
`paths.csv`, `port-period.csv`, and `costs.csv`, all relative to that directory.
These implement the six slots of the public contract. Original variable names
and finite numerical values are retained. Terminal exits perform service; they
are not imagined deliveries beyond the model horizon.

Additional evidence: `run-registration.json`, `parameters.set`, `solver.log`,
`incumbents.jsonl`, `raw-input-summary.json`, `validation.json`, and the final
native timing/status record. If no feasible solution is found, no finite
objective/vector is invented; `native-result.json` records that outcome and no
successful numeric layout is emitted. Exceptions are retained in `error.txt`
and the final result record, then propagate as a nonzero process exit.

## Delivered development plans

All six are under `experiments/<instance>/<method>/`, with instance IDs:

- `LR1_DR02_VC01_V6a`
- `LR1_DR02_VC05_V8a`
- `LR1_DR03_VC03_V16a`

Each contains full operating outputs, not just objective summaries. The best
observed development method is `default` for the first and `feasibility` for the
other two. Both results are preserved in full. Do not relabel these as new tests.

The proposed multi-class results still contain priced slack and large lower-bound
gaps. Read `REPORT.md` before interpreting them as an operating recommendation.

## Verify saved plans without reoptimizing

Example from this directory:

```powershell
& 'D:/opencorvus-benchmark-runs/native-operations-reconstruction-20261031/Scripts/python.exe' -B validate.py --model '../public/inputs/LR1_DR02_VC05_V8a_t120.mps' --raw '../public/inputs/development-raw.zip' --instance LR1_DR02_VC05_V8a --out experiments/LR1_DR02_VC05_V8a/feasibility
```

`validate.py` rereads saved outputs, reconstructs the numeric checks, and fails
on discrepancies. `checks.py` reruns only the deliberately corrupt-copy tests;
it performs no numerical optimization. Corrupt copies are isolated under
`validation-tests` and are not candidate plans.

## Reproduce the paired study only when an actual new experiment is intended

`experiments.py` contains the six-run design and uses paths relative to this
source root. On the delivered tree it skips recorded runs rather than consuming
another allocation. To genuinely reproduce all six, use a separate new copy
of these source files **within an authorized owned output scope**, with the
same `../public/inputs` relationship, and no existing experiment results. Then:

```powershell
& 'D:/opencorvus-benchmark-runs/native-operations-reconstruction-20261031/Scripts/python.exe' -B experiments.py
```

This is six sequential single-thread allocations, not a six-times-larger final
assigned-run budget. There are no hidden experiment retries. Timing-limited
SCIP results can vary with machine conditions even with seedshift 0.

## Plotting dependencies and data processing

The declared runtime already provides PySCIPOpt 6.3.0 and NumPy 2.5.4. Final
assigned solving needs no additional package installation. Static plotting used
the pinned generic dependencies in `requirements-lock.txt`, installed under
`deps`; `analyze.py` places Matplotlib configuration under `cache/matplotlib`.
To reinstall plotting packages if necessary, keep installation/cache writes here:

```powershell
& 'D:/opencorvus-benchmark-runs/native-operations-reconstruction-20261031/Scripts/python.exe' -B -m pip install --target deps --cache-dir cache --requirement requirements-plot.txt
& 'D:/opencorvus-benchmark-runs/native-operations-reconstruction-20261031/Scripts/python.exe' -B analyze.py
& 'D:/opencorvus-benchmark-runs/native-operations-reconstruction-20261031/Scripts/python.exe' -B summarize.py
```

These commands process existing outputs and do not solve again. The original
rendered PNGs and `REPORT.md` are static research deliverables; assigned runs do
not overwrite them. All eight delivered figures were visually inspected.

## Provenance and ownership

`source-provenance` stores the solver source used in development, separately from
all solution vectors. `source-only.zip` is a convenience archive of programme,
validation and study source, with no solutions or binary dependencies. The
declared manifest does not require this archive to execute.

No Git operations, containers, WSL, UI automation, other agents or external
solving services were used. The five script-launched solver children returned
naturally; the directly launched first solver also returned naturally. No server
or background listener was started. Owner checks are not independent review.
