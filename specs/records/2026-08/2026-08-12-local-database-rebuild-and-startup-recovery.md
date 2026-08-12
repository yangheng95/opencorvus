# Local database rebuild and startup recovery

Status: migration, canonical switch, and systemic Project deletion remediation complete; ninth frozen-diff independent review found no unresolved P0/P1/P2 issue.

## Recall

| Item | Record |
| --- | --- |
| User request | The database change prevents startup; export the existing data, import it into a new database, then switch the runtime to the new database. Then investigate and repair why undeletable `project` rows, missing paths/artifacts, and deletion failures can damage database authority; control blast radius globally rather than patching one symptom; obtain independent review. |
| Acceptance | Preserve and switch the database as originally requested. For Project deletion, missing owned roots are a valid idempotent state; unreadable roots fail with a typed pre-commit error and preserve authority; one private deletion workflow owns Task/Session settlement, Instance eviction, filesystem quarantine, exact database commit, and successor cleanup; stale caller snapshots, same-ID recreation, database replacement, ambiguous directory registration, pending locks/disposers, and malformed cleanup manifests fail closed with bounded, typed outcomes. |
| Hard constraints | Do not modify or stop a user process; no OpenCorvus/Bun backend currently owns the database. Never expose transfer contents or legacy serialized environment values in logs/specs. Use the repository's strict transfer contract and current DDL as the only import authority. Archive rather than delete the old database and unreconcilable temporary artifacts. Do not add a fallback, compatibility reader, UI automation, release, or tag. Preserve unrelated worktree changes. |
| Sources read | `AGENTS.md`; `packages/opencorvus/src/storage/db.ts`; `schema-migration.ts`; `mysql-transfer.ts`; `shell/process-supervisor.ts`; `cli/server-runtime.ts`; `global/index.ts`; `specs/current/architecture/task-control-plane.md`; `specs/records/2026-08/2026-08-11-windows-worker-scheduler-liveness-convergence.md`; focused recovery tests; current runtime logs. |
| Whole-repository search | In addition to migration/startup paths, searched every Project registry writer, relocation/promotion/merge path, DELETE caller, Task and Session insertion, Instance cache admission/lease/disposal path, filesystem absence helper, startup recovery caller, public error mapping, generated API consumer, and cleanup/ownership primitive. Project ID is deterministic from Git identity and is therefore not an occurrence token. |
| Independent agent feedback | The initial migration-only review became clean after delivery fixes. The deletion audit then found systemic gaps across ambiguous persisted routing, missing-root recreation, active Instance leakage, access-error misclassification, stale Project snapshots, public delete bypasses, unbounded cache settlement, cross-media commit ordering, cleanup identity/path validation, and HTTP error mapping. Each valid finding was verified against code and incorporated. The ninth frozen-diff review found no unresolved P0/P1/P2 issue. |

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

### Systemic Project deletion root cause

The historical path treated database cascade deletion as the operation and filesystem/runtime cleanup as best-effort surroundings. Multiple authorities could therefore diverge: request context held a possibly stale `Project.Info`; `Project` publicly exposed registry closure plus destructive commit; Instance disposal observed only some cache entries and could wait forever; Task deletion could recreate missing runtime directories; filesystem helpers collapsed every access error into absence; and cleanup recovery inferred commit state from a reusable Project ID. A missing directory was consequently interpreted inconsistently—sometimes as fatal, sometimes as permission to erase the row, and sometimes recreated during deletion.

The replacement has one commit boundary. The caller supplies only a target Project ID. A private deletion-registry module closes writers and freezes the current database row; all durable Task/Session creation checks that same admission. Runtime settlement and cache disposal are bounded. The exact Project-owned root is preflighted, a versioned cleanup manifest is flushed, and the root is renamed to quarantine before one transaction revalidates the frozen Project occurrence/paths and deletes its rows. Before that transaction, every failure rolls the root back and returns `ProjectDeletePendingError`; after it, cleanup failure returns a committed receipt with residue that only the startup owner may converge.

Cleanup manifests bind `Database.Identity()`, an immutable UUID `projectGeneration`, the canonical Project directory, and one exact owned target. Active-manifest recovery rolls back only when the same database and same Project generation remain; a foreign-database active manifest fails startup for manual recovery. An absent or different-generation row means the old deletion committed and only its quarantine may be removed. Completed ledgers are instead enumerated across every validated database-identity directory and may idempotently remove only their exact committed quarantine under the live current owner, so database rebuilds do not orphan Windows namespace residue. Malformed/out-of-scope targets always fail closed; recovery never guesses from path names or current ID coincidence.

Filesystem publication uses a synced exclusive manifest file before namespace movement. POSIX platforms additionally fsync affected directories; Windows uses `MOVEFILE_WRITE_THROUGH` for the same-volume namespace operation after flushing the manifest file. This is the strongest repository-supported operating-system persistence contract, not a claim that arbitrary hardware or network filesystems can never lose acknowledged writes after power loss.

Two test-isolation incidents occurred during the investigation and are part of the evidence, not hidden exceptions. The main agent twice invoked a package test without the repository preload; each fail-closed fixture prevented reset, exact backups were retained, and subsequent read-only checks proved the canonical database remained intact. The independent reviewer later made the same class of invocation; the fixture prevented reset but module initialization applied the already-pending shared permission schema migration and wrote its own exact schema-migration backup. No user process was stopped. All later tests use `script/run-tests.ts`, whose database path is under `OPENCORVUS_TEST_PROCESS_ROOT`.

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

### Project deletion remediation verification

- The isolated `project-directory-and-worktree-gc` suite passes `33/33` with 48 assertions. Its positive contracts cover missing repositories without path recreation, terminal Task and Session cleanup, ambiguous directory rejection, initialized and identity-only cache eviction, stale caller snapshot/current-row deletion, access-error preservation, active lease/write-lock/State inactivity, process-settlement precedence, live runtime ownership, durable Task/Session admission with real HTTP 409, retained and committed cleanup recovery, same-ID Project recreation, database-identity mismatch, exact target containment, completed-ledger recovery after database identity replacement, database-commit rollback, anonymous promotion conflict, and Worktree garbage-collection uncertainty.
- OpenCorvus TypeScript checking passed with no diagnostics on the current candidate. The isolated schema migration suite passes 8 tests / 52 assertions and proves multiple legacy Projects receive distinct immutable UUID generations while existing related rows survive the backup-first backfill. `docs:check` passes with 335 operations across 25 groups. `git diff --check` passes.
- Recovery now requires an exact live `RuntimeServerOwnership.Handle` for `Database.Path()`. Startup acquires that ownership before scanning. Thus another process cannot remove a just-published live deletion manifest; direct recovery without the canonical runtime owner is rejected.

## Independent review

The uninvolved read-only reviewer reproduced the transfer package hash, all archive manifest hashes/counts, source-backup 45-table/6,800-row import baseline, current schema fingerprint, integrity `ok`, zero foreign-key violations, and one canonical database authority. It confirmed the check-workspace archive is outside both task-scoped and taskless active scan roots. During review the user had independently started the ordinary backend on port 7878; `/global/health` returned `healthy: true` with the exact canonical database/data paths, and the seven active supervisor requests all belonged to that live owner occurrence rather than being archived artifacts returned to the scan root.

The migration reviewer found the ignored-spec/staging boundary and the time-unstable row-count wording described in Recall. Those findings were corrected. Eight deletion reviews then found deeper cross-authority, race, durability, identity, and bounded-settlement defects. The latest finding—completed Windows cleanup ledgers being scanned only for the current database identity—was corrected by enumerating every UUID-scoped completed directory, validating each manifest against that directory identity, and idempotently cleaning committed residue under the live canonical owner. The ninth frozen-diff independent review verified that protocol, its identity-switch test, the UUID backup-first migration, both evidence records, and the task-scoped diff, and reported no unresolved P0/P1/P2 issue.

## Rollback

If export, import, validation, switch, or startup verification fails, do not discard either database. Keep the canonical path on the last validated database. If failure occurs after switch, move the new database back into the maintenance directory and restore the archived original database plus exact sidecars. Restore legacy temporary artifacts only when diagnosing the startup fail-closed behavior, not as part of normal rollback, because they are independently proven to be the startup blocker.
