# Temperature report handoff

Run with Python 3; no third-party dependencies or installation are required:

```sh
python /path/to/deliverable.pyz /path/to/input --output /path/to/report.json
```

Input and output paths may be absolute or relative to the caller's working directory.
The input directory must contain the two UTF-8 CSV files specified in CONTRACT.md.

- `main.py`: maintainable application source and CLI.
- `build_zipapp.py`: rebuilds `deliverable.pyz` from `main.py`, independently of cwd.
- `test_deliverable.py`: subprocess integration tests against the actual zipapp.

Rebuild and verify from the project directory:

```sh
python build_zipapp.py
python -m unittest -v test_deliverable
```

Verification: all seven integration tests passed. They exercise C/F/K conversion,
calibration, inclusive thresholds, negative thresholds, original-unit absolute-zero
boundaries and errors, first invalid reading, order and counts, exact text IDs,
Unicode/whitespace/quoted multiline CSV, reordered and extra columns, LF/CRLF,
empty readings, repeating conversion, large-magnitude absolute precision, and
absolute/relative input-output paths from unrelated temporary working directories.

Arithmetic and threshold comparisons use exact fractions parsed from decimal text.
JSON temperature numbers are rounded only during serialization, with precision
scaled to magnitude to satisfy the absolute error tolerance. Physical validity is
checked in the original unit before conversion or calibration. Invalid physical
temperatures produce the specified error JSON and exit 2; valid reports exit 0.
Other input preconditions are those guaranteed by CONTRACT.md.
