# Safe import handoff

The existing sqlite-utils package now includes persistent import invariants, connection-local nested checkpoints with named lifecycle errors, safe insert/upsert/CSV/JSON APIs, six CLI management commands, and `--safe-mode` on insert/upsert/bulk (including UPDATE). Safe operations validate all registered tables to cover trigger writes. Rollback covers processing batches, parser/converter/SQL/validation failures and transactional schema changes. First-use metadata setup is included in the rollback boundary. CLI `--strict` retains its existing SQLite STRICT-table meaning.

Public task/runtime files were not modified. Work stayed on main; no branch, worktree, remote write, push, download, model call, delegation, Docker, WSL or UI operation was used. The source commit is identified by `git log -1 --format="%H %s"` after this handoff is committed.

## Reproduce from this project root (PowerShell)

```powershell
$taskPython = 'D:/opencorvus-benchmark-runs/sqlite-safe-import-pair-20261101/runtime/Scripts/python.exe'
New-Item -ItemType Directory -Force .local-tmp | Out-Null
$env:TEMP = (Resolve-Path .local-tmp).Path
$env:TMP = $env:TEMP
$env:PYTHONDONTWRITEBYTECODE = '1'
& $taskPython -B -m sqlite_utils --help
& $taskPython -B -m pytest tests/test_safe_import.py tests/test_cli_insert.py tests/test_cli_bulk.py tests/test_upsert.py tests/test_create.py tests/test_transform.py tests/test_enable_counts.py tests/test_fts.py tests/test_docs.py -q -rs --basetemp .local-tmp/pytest-review
& $taskPython -B specs/artifacts/safe-import/verify.py
```

Observed relevant regression result: **471 passed, 1 skipped**; the skip is the upstream optional pandas/numpy test, whose dependencies are not installed. This is behavior evidence, not a benchmark grade. The first regression run caught a counts-tracer regression and incomplete command docs; both were corrected and the original check set rerun successfully.

The verification script compiles the current source to project-owned bytecode, builds a standard-library zipapp of the same sqlite-utils package and launches actual native CLI subprocesses for both source and rebuilt archive. It also checks CLI reference generation with the existing embedded generator. The archive path is recorded in `specs/artifacts/safe-import/evidence.json`; run it using:

```powershell
$evidence = Get-Content specs/artifacts/safe-import/evidence.json -Raw | ConvertFrom-Json
& $taskPython -B $evidence.source_rebuild.archive --help
```

This is a reproducible source-only runnable build, **not a wheel**. The declared runtime lacks setuptools, wheel, build, Black, Cog and Sphinx. No dependency downloads are authorized, so the official setuptools wheel build, formatter executables and rendered Sphinx documentation build were not run. Python compilation, native execution, generated CLI-reference consistency and focused tests completed with the supplied runtime.

## Evidence and usage

- `specs/artifacts/safe-import/evidence.json`: actual command arguments/stdin/stdout/stderr/exit codes, source build facts, complete before/after schema/data and failure identities. Native SQLite database files and runnable archives remain under the recorded project-owned `.local-tmp/source-evidence/` directory.
- `specs/artifacts/safe-import/regression.txt`: real final regression transcript.
- `tests/test_safe_import.py`: actual SQLite lifecycle, persistence, scalar/aggregate/SELECT semantics, custom aggregates, schema rollback, deferred constraint failures at commit, parser/stream failures, nested operations, first-use metadata restoration and native CLI contracts.
- `docs/cli.rst`, `docs/cli-reference.rst`, `docs/python-api.rst`: command examples, API contracts, error identities and transaction boundaries.
- `specs/records/2026-11/sqlite-safe-import.md`: initial analysis, decisions and validation record.

Example commands (JSON is default; CSV requires `--csv`):

```powershell
& $taskPython -B -m sqlite_utils add-import-invariant demo.db inventory 'quantity >= 0'
& $taskPython -B -m sqlite_utils insert demo.db inventory input.json --pk id --safe-mode
& $taskPython -B -m sqlite_utils bulk demo.db 'UPDATE inventory SET quantity = :quantity WHERE id = :id' changes.json --safe-mode
& $taskPython -B -m sqlite_utils validate-import-invariants demo.db inventory
```

Failed safe CLI writes exit 1; successful writes exit 0. Completed validation exits 0 even for failed invariants and prints `Validation failed` with failing IDs. Check the JSON `valid` field. Safe Python helpers return `{success: true}` or `{success: false, checkpoint_id: str, failures: list, error_report: str}`; strict mode rolls back and raises. See the API docs for cleanup and nested finalization semantics.

## Material boundaries / remaining limit

Checkpoints are SQLite savepoints, not durable recovery snapshots. They are connection-local; support settings and invariants persist. Caller-owned outer transactions remain caller-owned. Direct connection commit/rollback/context-manager operations, autocommit changes and explicit transaction-control SQL must not be mixed with active checkpoints. SQLite journal recovery handles process termination; no crash/power-loss experiment was performed. External side effects of generators, converters and SQL functions are outside a SQLite transaction.

SQLite transaction-wide conflict actions (`RAISE(ROLLBACK, ...)` in triggers or `OR ROLLBACK`) can also undo earlier writes in an enclosing caller transaction or manual checkpoint. A top-level safe import with a ROLLBACK trigger is tested to restore its original state and report the original error; nested transaction-wide rollback is **not narrowed to the inner operation**. Thus the task's unconditional exact-pre-operation guarantee is not fully satisfied for that explicit SQLite edge. Use statement-local `RAISE(ABORT, ...)` inside nested checkpoints. Ordinary nested commit/rollback and nested safe imports are verified. No snapshot fallback or speculative SQL rewriting was introduced to hide that limitation.

All owned subprocesses completed naturally. No publishing action is included.
