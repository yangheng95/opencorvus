# Stock importer handoff

## Run

```sh
python deliverable.pyz INPUT_CSV --db DATABASE --output REPORT_JSON
```

Python 3, standard library only; no installation or extraction required. The
database must already contain the contracted `stock` table. Paths are used as
supplied (relative paths are relative to the caller's working directory).

- Success: exit 0, JSON `{"success":true,"processed":N}`.
- First insufficient-stock data record: exit 2, JSON
  `{"success":false,"error":{"code":"INSUFFICIENT_STOCK","record":N,"item":"..."}}`.
- Invalid input or database errors: exit 1 and a diagnostic on stderr, with the
  transaction rolled back. These errors are outside the two contracted reports.
- Supply a writable report path distinct from the input and database paths.

## Source and rebuild

`main.py` contains the importable CLI and transaction implementation. `build.py`
packages that source as `__main__.py` in `deliverable.pyz`:

```sh
python build.py
python -m unittest -v test_importer
```

The importer uses `csv.DictReader`, UTF-8 and `newline=''`, binds SQL parameters,
and performs ordinary INSERT/UPDATE operations inside one `BEGIN IMMEDIATE`
transaction. It does not recreate tables, replace database files, or change
schema objects. Each successful update replaces the cost even for zero delta.

## Tested handoff

All 7 black-box tests pass against the actual packaged CLI in fresh subprocesses
from a separate working directory, with temporary databases and paths containing
spaces. Expected stock and audit rows are asserted explicitly, using separately
opened and closed SQLite connections after the CLI exits.

Coverage: reordered headers and extra metadata; standard header order; UTF-8
items with commas, doubled quotes, whitespace and embedded CRLF/LF; both record
line endings; a 200,000-character Unicode item; SQLite signed-64-bit boundary;
repeated items and zero quantities; header-only input; persisted success;
unchanged tables/indexes/triggers and untouched rows; exact INSERT/UPDATE audit
events; first-error record numbering; rollback of earlier stock and audit changes;
negative new-item rejection; rollback after a late invalid cost.

The original `sample.csv` and `sample.db` are unchanged. Testing was performed
directly, without delegation. Numeric storage remains subject to SQLite INTEGER
limits; transaction atomicity covers SQLite changes, not an atomic commit shared
with the separate JSON report file.
