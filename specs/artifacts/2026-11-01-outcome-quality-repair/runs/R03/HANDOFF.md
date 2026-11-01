# Forecasting/replenishment repair

## Deliverables and use

- `deliverable.pyz`: standalone executable zip application; Python 3 standard library only.
- `main.py`: maintainable CSV ingestion, training-only predictors, validation selection, and planning source.
- `build.py`: rebuild with `python build.py`, from any working directory using the script's full path.
- `test_delivery.py`: packaged-entry-point regression and independent reference tests.

Run from any working directory, using the appropriate path to the archive:

```sh
python /path/to/deliverable.pyz INPUT_DIRECTORY --output OUTPUT_JSON
```

Input and output paths are resolved relative to the caller's working directory. The output parent directory must exist. No installation or third-party packages are required.

## Repairs

CSV is read with `csv.DictReader` and `newline=""`, preserving exact Unicode item text and supporting quoting, embedded newlines, reordered columns, metadata, LF, and CRLF. All three strategies fit only training observations. Global validation MSE uses equal weight per row; exact rational comparisons enforce lexicographic tie-breaking without floating-point selection drift. JSON conversion happens only after selection and planning.

Every future prediction executes the selected strategy. `release.json` and historical scores are no longer runtime inputs; their development copies are left untouched. Orders use the original stock independently for every future row. All future rows are emitted in date/item order.

## Actual validation

Executed `python build.py` and `python -m unittest -v test_delivery` successfully. All **8 test groups passed**, invoking the final archive in temporary working directories outside the project. Tests compare complete JSON values, not just exit status or schema.

Coverage includes hand-calculated cases forcing each of the three winners; stale and absent release metadata; exact ties; unequal validation counts per item; fractional means; shuffled training and future records; independent replenishment; empty future input; quoted Unicode names (including embedded CRLF, quotes, commas, whitespace, and distinct Unicode normalization forms); reordered columns and ignored metadata; and 12 reproducible randomized multi-item datasets checked against a separate direct-history reference calculation. The future metadata test includes a nonnumeric `demand` column to ensure it is not treated as a label.

For the supplied `sample/`, the packaged program produced:

| Strategy | Validation MSE |
| --- | ---: |
| last | 214.28571428571428 |
| open | 0 |
| weekday | 71.42857142857143 |

Selected strategy: **open**. All six future rows matched hand calculations:

| Date | Item | Forecast | Order |
| --- | --- | ---: | ---: |
| 2026-01-26 | Alpha | 10 | 9 |
| 2026-01-26 | Beta | 20 | 16 |
| 2026-01-27 | Alpha | 0 | 0 |
| 2026-01-27 | Beta | 0 | 0 |
| 2026-01-28 | Alpha | 10 | 9 |
| 2026-01-28 | Beta | 20 | 16 |

No known unresolved contract failures. Testing covers the listed representative legal inputs, not an exhaustive enumeration. An empty validation set is rejected because its MSE is undefined.
