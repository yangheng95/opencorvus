# SQLite query-export handoff

Run with Python 3 (standard library only):

```text
python deliverable.pyz INPUT_DIRECTORY --output RESULT_JSON
```

`INPUT_DIRECTORY` supplies `source.db` and UTF-8 `export.json` as specified in
`CONTRACT.md`. Paths can be absolute or relative to the caller's working directory.
The archive is self-contained; source files are not needed at runtime.

## Repair

- `main.py`: readable CLI/export functions, escaped double-quoted identifiers,
  bound match values, explicit BINARY comparison with column affinity removed,
  and native ascending SQLite ordering. INTEGER values are not silently coerced
  to matching text. JSON preserves export/column order and cell types.
- Database opened with a read-only SQLite URI and one consistent read transaction;
  the connection is explicitly closed. Output cannot alias the source database.
- `build.py`: rebuilds `deliverable.pyz` from `main.py`, independent of build cwd.
- `test_export.py`: black-box regression tests with literal expected outputs.

## Rebuild and test

```text
python build.py
python -m unittest -v test_export
```

Tested on Windows with Python 3.14: six tests exercise the supplied sample,
quoted/Unicode/SQL-looking identifiers, apostrophes and SQL-looking values,
NOCASE override, exact numeric-looking text versus INTEGER, NULLs, integer limits,
multi-column ordering, empty exports/results, exact names and column ordering,
and refusal to overwrite the database. Each export runs a copied archive without
adjacent source files from an unrelated working directory. Checks compare complete
decoded JSON against fixed expected values and compare database bytes, logical
schema/data/index dumps, and user_version before and after.

Inputs are assumed to meet CONTRACT.md; this is not a general input-validation tool.
Results are materialized in memory. No third-party dependencies or delegation used.
