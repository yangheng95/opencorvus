# CS-030 — Delete the dead JSON Storage namespace

## Recall

- User request: continue repairing the accepted code-smell backlog directly and in parallel, with isolated file ownership and no substitute technical debt.
- Finding: `src/storage/storage.ts` defines a complete JSON read/write/update/remove/list authority with locks and error semantics, but no production, test, package, or generated caller imports or invokes it.
- Acceptance: delete the unused parallel persistence primitive without compatibility export or replacement; current database, Attachment Store, and Artifact Catalog positive contracts remain healthy.
- Hard constraints: pure deletion only; no negative “file does not exist” test, migration, fallback reader, UI work, or UI automation. Preserve unrelated storage work already present in the dirty worktree.
- Read/search scope: the entire dead module; all repository imports/references; current database/Attachment/Artifact authorities and their focused tests; audit finding `CS-030`.
- Independent agent feedback before implementation: none for this isolated pure-deletion batch; the repository audit independently confirmed zero callers.

## Root cause and boundary

The repository migrated current persistence to database, Attachment Store, and immutable Artifact authorities but retained the old general JSON namespace. Because it has no caller, preserving it provides only a future wrong choice and a second set of locking/error semantics. The complete repair is deletion of the one module. No replacement or compatibility surface is created.

## Positive verification

- Run focused current database schema-contract, Attachment Store, and Artifact Catalog positive tests that exercise the surviving authorities.
- Run OpenCorvus typecheck and exact diff check. If typecheck is blocked by a concurrent non-owned file, record that exact external blocker and retain focused green evidence.
- Do not add or run a test whose main assertion is absence of the deleted module.

## Impact

There is no public, generated, data-migration, or documentation consumer. Existing data is unaffected because no current code reads or writes the legacy `data/storage/*.json` namespace.
