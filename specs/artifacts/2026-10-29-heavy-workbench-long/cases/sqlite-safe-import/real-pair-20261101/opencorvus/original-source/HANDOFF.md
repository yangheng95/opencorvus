# Safe import handoff

## Delivered

Integrated into the existing `sqlite_utils.Database` and CLI, not a replacement
application:

- Persistent safe-import enablement and invariant registration/removal/listing.
- Nested connection-local SQLite savepoints with named lifecycle errors, finalization
  and cleanup; transactional data and schema rollback.
- SELECT, aggregate and per-row invariant evaluation with ID/expression/error reports.
- Safe bulk insert/upsert, CSV and JSON helpers; strict rollback-then-raise and
  non-strict structured failure results.
- All six configuration/invariant CLI commands and `--safe-mode` on insert,
  upsert and bulk (including UPDATE). CSV conversion/schema transformation stays
  inside the safe operation. Safe file imports infer CSV/TSV/JSONL/NDJSON from
  their suffix when no explicit format is selected. Ordinary imports retain
  their existing behavior.
- CLI guide, CLI reference and Python API documentation updated.

Source is on `main`. The source commit containing this handoff is identified by
`git log -1 --oneline`; the final delivery message gives its exact ID. No branch,
worktree, remote change, push, publishing, dependency download or model delegation
was used. Pre-existing `.gitignore`, `.gitattributes` and `.opencorvus` changes
were not included in the source commit. Public task/runtime inputs were unchanged.

## Native run / source rebuild / validation

From this project root in PowerShell:

```powershell
$py = 'D:/opencorvus-benchmark-runs/sqlite-safe-import-pair-20261101/runtime/Scripts/python.exe'
& $py -B -m sqlite_utils --help
& $py -B -m validation.run_safe_import
& $py -B -m pytest tests/test_safe_import.py -q --basetemp=.test-tmp
& $py -B -m pytest tests/test_cli_insert.py tests/test_cli_bulk.py tests/test_upsert.py tests/test_transform.py -q -k 'not test_cli_bulk_batch_size and not test_insert_streaming_batch_size_1' --basetemp=.regression-tmp
```

The package is pure Python: the source entry point needs no binary build or
installation. The validation harness compiles all package source with Python's
`compile()`, imports the local package, runs real CLI subprocesses using this same
interpreter and captures the focused/upstream regression output. It uses only
project-local temporary databases and waits for every child with `subprocess.run`.

Observed runtime: Python **3.12.14**, SQLite **3.53.1**.

## Evidence and observed results

`validation/evidence/results.json` records exact commands, inputs, exit codes,
stdout/stderr, complete before/after schema SQL, item/audit rows, and development
failure history. `validation/evidence/safe-import.db` is the actual saved database;
`focused.txt` and `regression.txt` are captured pytest output. Re-running the harness
replaces only its own evidence database and output files.

- Focused suite: **43 passed**. Checks checkpoint lifecycle/nesting, persistence,
  quoted table names, empty tables/imports, SQL errors, strict/non-strict imports,
  late iterator/JSON errors, multi-batch failures, composite primary keys, both
  upsert implementations, trigger side effects, caller transactions and native CLI
  behavior, format inference, explicit-format precedence and deferred foreign-key
  errors raised at commit time.
- Scoped upstream regression suite: **114 passed, 2 deselected**. The two excluded
  tests intentionally sleep/poll streaming subprocesses; this task prohibits sleeps.
- A rejected multi-batch insert removed its added column and all inserted item/audit
  rows. Dropped/replaced indexes and triggers, an added column and a new table were
  restored by checkpoint rollback. Full schema/row snapshots compared equal.
- Safe bulk UPDATE changed a row in an earlier batch then violated an invariant in
  a later batch: exit **1**, invariant ID visible, pre-operation state restored.
- Safe upsert subsequently committed quantity **9**; an independent CLI query read
  exactly `[{"id": 1, "quantity": 9}]` from the reopened file.
- Diagnostic validation returned **0** both for PASS and for an intentionally
  failing `COUNT(*) = 999` invariant. That failing invariant remains in the saved
  evidence database deliberately. Its presence is not a claim that the final
  demonstration database passes every registered invariant.
- SQLite `PRAGMA integrity_check` returned **ok**.

Development failure retained honestly: the first expanded run had **35 passed,
1 failed** because the test compared against its state before deliberately
removing an invariant. The expected baseline was moved after that removal; no
product state or task requirements were changed to satisfy the assertion. The
initial smaller suite had 31 passes. Final output is captured separately above.

## Semantics and limits

- Enablement persists, but each write must opt in. All registered table invariants
  are checked after a safe write, including trigger-modified tables. A pending
  caller transaction still owns the outer commit. Checkpoint IDs are local to the
  connection, not crash-recovery snapshots or cross-process undo handles.
- Do not commit/rollback directly through `db.conn`, issue transaction-control SQL,
  or close the connection while checkpoints are active. SQLite `RAISE(ROLLBACK)`
  triggers abort an entire outer transaction, including a caller's pending work;
  a normal top-level safe import reports that original trigger error and restores
  its pre-import committed state. Normal validation/constraint/parse failures use
  rollback-to-savepoint and preserve pending caller changes.
- Only SQLite state is transactional. External effects in trusted user conversion
  code, SQL functions or extensions cannot be undone. Database power-loss recovery,
  multi-process writer contention and additional Python/SQLite versions were not
  tested. Reserved internal metadata tables should not be edited manually.
- CLI `--strict` keeps its upstream STRICT-table meaning. Python helper `strict`
  means raise after rollback; see the API guide for signatures and error classes.
- No wheel/sdist build or Sphinx rendering was claimed: `setuptools`, `wheel`,
  `build` and `sphinx` are absent from the declared runtime, and downloads/runtime
  modification are forbidden. Source compilation, local entry-point execution,
  SQLite state comparisons and scoped behavior tests were performed instead.
- No claim about the entire upstream suite, benchmark score, ranking or duration
  qualification is made.
