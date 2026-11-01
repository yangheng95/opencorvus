# SQLite query exporter

Run with Python 3 (standard library only):

```sh
python deliverable.pyz INPUT_DIRECTORY --output RESULT_JSON
```

The input directory supplies `source.db` and UTF-8 `export.json` as specified in
`CONTRACT.md`. The output parent directory must already exist. Relative paths are
relative to the caller's working directory; the archive needs no adjacent source files.

## Implementation

- `main.py`: readable CLI and exporter. Complete identifiers are double-quoted,
  embedded quotes are doubled, and match text is bound as a parameter.
- Unary `+` removes column affinity for comparison and explicit `COLLATE BINARY`
  prevents NOCASE/RTRIM matching. Integer cells do not match numeric-looking text.
- SQLite supplies ascending ordering; JSON preserves text, integers and nulls,
  requested columns, export order and exact names.
- The source is opened with a percent-encoded read-only URI and queried in one
  read transaction. Output paths aliasing either input are rejected.
- `build.py`: packages only `main.py` as `__main__.py` in `deliverable.pyz`.

## Rebuild and verify

```sh
python build.py
python -m unittest -v test_export
```

Five end-to-end tests passed on Python 3.14/Windows. They copy the actual archive
to an unrelated working directory and assert explicit expected JSON values.
Coverage includes Unicode, spaces, punctuation, embedded identifier quotes,
SQL-expression-looking identifiers, apostrophes/SQL-looking values, embedded NUL
and empty match text, case distinctions, trailing spaces, numeric-looking text,
TEXT/INTEGER/untyped affinities, NOCASE/RTRIM overrides, mixed-type ordering,
multi-column ordering, empty matches/exports, exact export names and source-byte
preservation (including a database with an index and nonzero user_version).
An additional guard test rejects overwriting the source database.

Inputs are assumed contract-valid. Rows are materialized in memory; this is not a
streaming exporter. Output writes are not atomic on interruption.
