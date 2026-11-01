# Forecasting/replenishment repair

## Deliverables and use

- `deliverable.pyz`: standalone Python 3 application; standard library only.
- `main.py`: CSV loading, training-only predictors, validation selection and planning.
- `build_release.py`: rebuild the archive with `python build_release.py`.
- `test_release.py`: packaged-entry-point regression tests.

From the project directory:

```sh
python deliverable.pyz sample --output output.json
```

From another working directory, use the archive's absolute path:

```sh
python /path/to/deliverable.pyz INPUT_DIRECTORY --output OUTPUT_JSON
```

Relative input and output paths resolve against the caller's working directory.
The output's parent directory must exist. No installation or third-party packages
are required. The archive can be copied and run without the source files.

## Repairs

CSV is parsed by named columns with Python's CSV reader, preserving exact Unicode
item names, quoted commas/quotes/newlines, and CRLF/LF. Training alone determines
all predictors. All three strategies are scored on separate validation rows,
equally weighted globally. Exact rational arithmetic governs means, MSE and ties;
nonintegral output numbers are serialized as floats. The selected strategy drives
every released prediction. Orders are independent per row and the complete plan
is sorted by date then item. `release.json` and historical scores are not read.

## Actual validation

`python -m unittest -v test_release` passed **9 test methods**, comprising **40
packaged application executions**, on 2026-11-01. Checks include independently
hand-calculated sample values, each strategy winning, exact ties, fractional means,
closed training observations, latest-date selection with shuffled history, unequal
validation counts per item, independent inventory scenarios, empty future data,
reordered columns, extra metadata, quoted Unicode/whitespace/newline item names,
mixed CSV line endings, paths with spaces, and 30 seeded datasets compared with a
separate oracle. Every ordinary test runs the archive from outside the project;
one additionally copies the archive away from source and runs Python in isolated
mode. All returned losses, forecasts, quantities, row identities and row counts
are compared to expected results within absolute error `1e-8`.

Supplied sample: selected `open`; validation MSE `last = 1500/7`
(`214.28571428571428`), `open = 0`, `weekday = 500/7`
(`71.42857142857143`). Date/item-sorted forecasts are
`[10, 20, 0, 0, 10, 20]`; corresponding orders are `[9, 16, 0, 0, 9, 16]`.

`git diff --check` also passed. Tests are representative contract checks, not
exhaustive enumeration. Empty validation is rejected explicitly because its MSE
is undefined. Original sample and development artifacts were left unchanged.
