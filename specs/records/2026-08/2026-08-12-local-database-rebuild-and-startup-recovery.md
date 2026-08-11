# Local database rebuild and startup recovery

Status: migration, switch, real startup verification, and independent review complete; no unresolved findings.

## Recall

| Item | Record |
| --- | --- |
| User request | The database change prevents startup; export the existing data, import it into a new database, then switch the runtime to the new database. |
| Acceptance | Preserve the existing portable OpenCorvus rows in a separately materialized current-schema SQLite database; verify transfer row counts, SQLite integrity, foreign keys, and current schema fingerprint; retain a recoverable copy of the original database; switch the canonical database path only after the new database passes; reconcile the independently proven stale startup artifacts; prove the real backend reaches healthy startup. |
| Hard constraints | Do not modify or stop a user process; no OpenCorvus/Bun backend currently owns the database. Never expose transfer contents or legacy serialized environment values in logs/specs. Use the repository's strict transfer contract and current DDL as the only import authority. Archive rather than delete the old database and unreconcilable temporary artifacts. Do not add a fallback, compatibility reader, UI automation, release, or tag. Preserve unrelated worktree changes. |
| Sources read | `AGENTS.md`; `packages/opencorvus/src/storage/db.ts`; `schema-migration.ts`; `mysql-transfer.ts`; `shell/process-supervisor.ts`; `cli/server-runtime.ts`; `global/index.ts`; `specs/current/architecture/task-control-plane.md`; `specs/records/2026-08/2026-08-11-windows-worker-scheduler-liveness-convergence.md`; focused recovery tests; current runtime logs. |
| Whole-repository search | Searched database paths, schema migration, transfer export/import, runtime ownership, Windows orphan request recovery, temporary artifact ownership, and startup ordering definitions/callers. The canonical database path is `<runtime data>/opencorvus.db`; no second database-path configuration exists. Startup request recovery scans `<runtime tmp>/supervisor-*` independently of database contents. |
| Independent agent feedback | None before implementation. The post-implementation reviewer verified transfer/backup hashes, all three archive manifests, source and canonical schema/integrity/foreign-key results, archive separation from active scan roots, real health evidence, and the live canonical path. It found two delivery issues: the ignored spec requires explicit force-add and the shared README hunks require line-scoped staging; the 6,928-row statement also required an explicit observation time because a healthy user-started runtime continues appending facts. Both findings were corrected before re-review. |

## Analysis and evidence

### Observable failure

The latest packaged backend log opens the canonical database, reports `schema applied`, then exits before listener bind with `WindowsOrphanRequestRecoveryBlockedError: Windows supervisor request recovery retained 65 unknown artifact occurrence(s)`. The Overlay consequently reports that its managed backend exited before becoming healthy.

### Direct trigger

The runtime scans 65 `supervisor-*` directories under the canonical temporary root. They predate the current strict Windows request protocol. Fifty-four parse as the legacy field shapes containing `env` and `ready_file` but no owner PID, process-instance identity, runtime occurrence, cancel path, or settled path; eleven request files are not valid JSON. All 65 have readable legacy ready markers but no current settlement proof.

### Root cause and why the old path did not recover

The current startup contract intentionally treats missing, malformed, or foreign-layout process artifacts as unknown and refuses listener bind. It cannot infer death from a reused numeric PID and has no compatibility reader for the legacy layout. These artifacts are filesystem state, not database rows, so copying the database alone would preserve the startup failure whenever the canonical temporary root remains unchanged.

The database itself is healthy: its schema fingerprint equals the current DDL fingerprint `84af4e18ec989a211a7ee4dc574b535fce8cfbb7237eb73feb549a82ace1b058`, `PRAGMA integrity_check` returns `ok`, and `PRAGMA foreign_key_check` returns no violations. Therefore the user's export/import/switch request is a preservation and clean-materialization operation, while startup recovery additionally requires explicit operator reconciliation of the legacy temporary artifacts.

### Process-safety evidence

No OpenCorvus or Bun process is running and no listener owns ports 7878/7879. The legacy artifact modification interval is 2026-08-09T06:25:10Z through 2026-08-11T13:52:35Z. Their 129 distinct recorded helper/target PIDs are no longer the recorded processes. Four numeric PIDs are currently reused by Snipping Tool, PowerShell, Codex Node REPL, and Visual Studio Code; each current process started after its corresponding artifact timestamp. No process will be terminated. The legacy directories will be moved intact into a maintenance backup with a manifest.

### Impact surface

- Database definitions and public schema contracts remain unchanged.
- Portable business data is exported and imported through `opencorvus.mysql-transfer.v1`; `database_authority` remains local physical identity and is regenerated by the destination.
- The canonical database filename remains the one runtime source of truth. Switching is an offline file replacement, with the original database and sidecars archived together.
- Legacy supervisor artifact directories are archived outside the active temporary scan root. Their serialized contents are not copied into repository files or printed.
- Configuration, project runtime directories, logs, credentials, and user applications are not modified.

## Execution plan

1. Capture a pre-operation manifest: database/sidecar sizes and SHA-256 hashes, current schema fingerprint, integrity, foreign keys, table counts, and stale-artifact classification. Do not serialize row contents.
2. Export the strict transfer package from the existing database into a protected maintenance directory and hash it.
3. Import the snapshot under an isolated `OPENCORVUS_HOME` using the current importer, producing a fresh current-schema `opencorvus.db` and fresh database authority.
4. Compare every portable table row count, schema fingerprint, integrity result, and foreign-key result between export and destination. Run the current database data-integrity validation by opening the isolated runtime.
5. Archive the 65 proven legacy `supervisor-*` roots intact, with a metadata-only manifest and without logging request payloads.
6. Archive the canonical database and any `-wal`/`-shm` sidecars. Move the validated destination database into the canonical path. Never overwrite the archived source.
7. Start an isolated real backend process against the switched canonical runtime only long enough to prove the health endpoint, database identity, and startup recovery result, then stop that verification-owned process cleanly. Do not start or control the user's graphical application.
8. Recheck canonical schema fingerprint, integrity, foreign keys, portable table counts, backup hashes, active supervisor artifact count, logs, and `git status --short`.
9. Obtain an independent read-only review. Repair any valid finding and repeat the relevant verification until no finding remains; then commit only the spec/index changes and push after checking the complete upstream commit set.

## Execution outcome

### Export and new-database import

- Maintenance root: `C:\Users\hengu\AppData\Local\opencorvus\data\maintenance-backups\manual-rebuild-20260811T181650Z-35375a53-5b25-4851-a569-c2341fcb14e9`.
- The source database was 21,282,816 bytes before transfer. The strict transfer package is 18,844,691 bytes with SHA-256 `0C8FC0F48A9359BA0500686C26B58B48A31EAE89A90B6CB473DFBD9A77FE30DE`.
- The package uses `opencorvus.mysql-transfer.v1`, transfer fingerprint `53549c9b58d3563273a44c5a07169e72e9fe7340c0f42c9c73dd5d52236d3d83`, and contains 45 portable tables with 6,800 total rows.
- Import under an isolated runtime root produced a 21,061,632-byte database. Pre-switch comparison found no row-count mismatch in any portable table. Source and destination both had schema fingerprint `84af4e18ec989a211a7ee4dc574b535fce8cfbb7237eb73feb549a82ace1b058`, integrity `ok`, and zero foreign-key violations. The destination created a distinct local database authority.

### Artifact reconciliation

- The 65 old `tmp\supervisor-*` directories were moved intact to `legacy-supervisor-artifacts`; the active supervisor scan root became empty. The metadata-only manifest SHA-256 is `5EC0FB4D87412C4F12ABB811FA410E38AFACB04BEE0816645DCAE2AFA3160396`.
- After the first blocker was removed, real startup exposed seven previously masked isolated check-workspaces under `D:\myhexin-local\demos\long-absa-task\.opencorvus\.r\tasks\...\acceptance\check-workspaces`. All predated the strict `owner.json` contract, all lacked that owner file, and no live process command line referenced the project or exact workspace identities. They were atomically renamed on the same volume into `.opencorvus\.r\maintenance-archives\manual-rebuild-20260811T181650Z\check-workspaces`. The metadata-only manifest SHA-256 is `F3E127C97740650DF83A1181CE24A599F4296F7DA59F51442B1A00F0FF6680EC`.
- The successful health run recovered the existing unfinished Task and began seven current supervisor requests. Shutdown arrived before any helper wrote `ready.json`. All seven requests carried the exact verification owner PID 34088 and occurrence `f2976351-19e9-41cb-a870-378886a0f7a9`; that process was dead, every request had its shutdown cancel marker, and none had a helper/target PID or settlement marker. This is the documented owner-death-before-helper-ready boundary. The seven verification-owned roots were archived separately; manifest SHA-256 `2EFDFCD2AA68494B69E039CD3F5A9D4BC8918610B006FFCE7608348EA29FE75E`.
- A final direct execution of both current startup scanners returned zero inspected, removed, current, live, or unknown supervisor requests and zero corresponding check-workspaces.

### Canonical switch and startup proof

- The first switch attempt stopped before mutation because a PowerShell array expression repeated the main database path instead of producing explicit WAL/SHM paths. Read-only checks proved source and destination remained in place. The corrected switch used three explicit absolute paths.
- The original database, zero-byte WAL, and 32,768-byte SHM are preserved under `source-database`. Their SHA-256 values are respectively `423B5D36B26545388B2DA4E8AD995E5E5CDC80BCC2940A910A04C816279F1252`, `E3B0C44298FC1C149AFBF4C8996FB92427AE41E4649B934CA495991B7852B855`, and `FD4C9FDA9CD3F9AE7C962B0DDF37232294D55580E1AA165AA06129B8549389EB`.
- The validated destination database was moved to the single canonical path `C:\Users\hengu\AppData\Local\opencorvus\data\opencorvus.db`; no parallel database path or configuration was introduced.
- A real source backend started against that canonical path on loopback port 17878. It returned `healthy: true`, `databaseUnavailable: null`, and the exact canonical database/data paths. Startup recovery reported `attempted=1 initialized=1 failures=0` for the persisted project before listener bind. The verification-owned process then received SIGINT, settled two process-owned prompt sessions, disposed the project Instance, released its listener, and exited. No graphical application or unrelated Bun test process was controlled.
- Real recovery appended visible current-runtime facts after the exact migration comparison: 34 artifact catalog revisions, 31 current Artifacts, three Artifact versions, five Messages, seven Parts, 47 protocol events, and one worker-turn descriptor (128 rows total). These are post-switch Task recovery data, not import mismatches. Immediately after the verification-owned process completed its clean shutdown, the canonical database contained 6,928 portable rows, retained the current schema fingerprint, had no drift, returned integrity `ok`, reported zero foreign-key violations, and contained exactly one local database authority. This row count is an observation at that boundary, not a stable invariant; a subsequently user-started healthy runtime continues appending visible execution facts.

## Independent review

The uninvolved read-only reviewer reproduced the transfer package hash, all archive manifest hashes/counts, source-backup 45-table/6,800-row import baseline, current schema fingerprint, integrity `ok`, zero foreign-key violations, and one canonical database authority. It confirmed the check-workspace archive is outside both task-scoped and taskless active scan roots. During review the user had independently started the ordinary backend on port 7878; `/global/health` returned `healthy: true` with the exact canonical database/data paths, and the seven active supervisor requests all belonged to that live owner occurrence rather than being archived artifacts returned to the scan root.

The reviewer found the ignored-spec/staging boundary and the time-unstable row-count wording described in Recall. The spec is explicitly force-added, only this task's index lines are staged, and the row-count evidence is now tied to the verification-owned shutdown boundary. A second read-only review of the corrected cached diff reported no unresolved findings before commit.

## Rollback

If export, import, validation, switch, or startup verification fails, do not discard either database. Keep the canonical path on the last validated database. If failure occurs after switch, move the new database back into the maintenance directory and restore the archived original database plus exact sidecars. Restore legacy temporary artifacts only when diagnosing the startup fail-closed behavior, not as part of normal rollback, because they are independently proven to be the startup blocker.
