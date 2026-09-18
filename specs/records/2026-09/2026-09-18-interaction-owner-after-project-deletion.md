# Interaction ownership after Project deletion

## Recall

- User reports that the Projects panel fails with `API 500 work-ledger?limit=80` and asks for the defect to be fixed.
- Acceptance: Work Ledger returns normally after deleting a Project that produced a Question, Permission request, or inline reconciliation interaction; interaction ownership remains exact after Task and Session projections are removed; active Task interaction counts remain correct; the existing live failure is removed and the rebuilt application starts normally.
- Hard constraints: fix the persisted ownership contract rather than catch or hide the projection error; audit every interaction producer and the Project terminal path; keep LLM calls streaming; do not add or run UI automation tests; preserve unrelated working-tree changes.
- Sources read: live HTTP response and server log; live SQLite interaction, Bus publication, and Protocol event rows; `engine.sql.ts`, `interaction-request.ts`, `interaction.ts`, `store.ts`, `protocol.ts`, `protocol.sql.ts`, Project deletion, attachment reference collection, durable activity projection, schema startup validation, focused interaction and Project deletion tests, and the panel reactivity architecture.
- Whole-repository search: all interaction producers call `insertEngineInteractionRequest`, which atomically appends one `interaction.requested` Protocol event. Source-backed rows deliberately omit `task_id`; the read path reconstructed ownership through mutable Session ancestry. Project deletion removes Task and Session rows but retains immutable Bus and Protocol facts, so the retained interaction became unprojectable and poisoned every global pending-count read. Inline interaction rows have a second terminal-path defect: their `task_id` foreign key cascades through an unconditional immutable delete trigger, so Project deletion can fail when such a row exists.
- Observed live evidence: interaction `int_g0VVXNYcO003SHLPD7nj` points to a retained `question.asked` Bus occurrence and has no direct `task_id`; its Session and Task projections were deleted. Protocol event `pev_g0VVXNYcP00xEkuaol2O`, written for that same interaction, retains aggregate Task `tsk_g00VVXNHAX000G39695n`. The missing mutable ancestry is therefore not missing ownership evidence.
- Independent agent feedback: the first review found that Task-root reduction still filtered source-backed rows through nullable request columns, that Session integrity moved out of foreign keys without an insert-time replacement, and that deletion coverage did not yet exercise all three interaction forms across a database reopen. Those findings were fixed and the focused checks were rerun. The review also identified the expected pre-release schema reset boundary; this delivery records it explicitly rather than claiming an in-place upgrade.

## Plan

1. Make the atomic `interaction.requested` Protocol fact the immutable Task-ownership authority for source-backed interactions, validate its exact type/aggregate/interaction identity, and remove Session-ancestry ownership reconstruction.
2. Store inline interaction `task_id` as immutable correlation rather than a cascading foreign key so Project deletion cannot rewrite or delete the retained request fact.
3. Add focused positive coverage for source-backed projection after Task/Session removal and for Project deletion with inline and source-backed interactions, then run typecheck and relevant schema/interaction/deletion checks.
4. Rebuild the application, recreate the pre-release database as already authorized, verify the real Work Ledger API and page, and complete independent read-only review.

## Status

Complete.

## Verification

- The source-backed Question regression test removes its Task and Session rows, then projects the retained interaction with its original Task and Session identities and a pending count of one. The same checker verifies invalid Session ownership is rejected atomically.
- The Task-root production reducer test proves a source-backed Question is selected by its immutable Protocol Task owner and places the ingress in `waiting` instead of allowing it to advance.
- The Project deletion checker now exercises source-backed Question, source-backed Permission and inline interaction rows. It deletes the Project and Task/Session projections, closes and reopens SQLite, then verifies all retained interactions resolve to their original Task and terminal state.
- `bun run --cwd packages/opencorvus test test/engine-interaction-recovery.test.ts`: 7 passed; the same repository runner for `task-control-reconciliation.test.ts`: 12 passed; `project-directory-and-worktree-gc.test.ts`: 60 passed; `storage/schema-contract.test.ts`: 14 passed.
- OpenCorvus package typecheck, docs check, architecture index, module topology and diff checks pass.
- The full Overlay build passed, including the packaged first-run conversation check (`firstRun: passed`, four Sessions created, two persisted across restart). The first build attempt reached the Windows linker but the running old Overlay held the output executable; after the already-authorized shutdown, the unchanged build completed.
- The already-authorized pre-release database reset removed the old schema and runtime scratch. The rebuilt `0.1.1-beta` Overlay started on port 7878, `/global/health` returned healthy, and `/work-ledger?limit=80` returned HTTP 200 with an empty canonical page.
- The real `/ui` page displayed `Projects` → `No work yet.` and `Connection Diagnostics · Online · Port 7878`; the prior Work Ledger 500 card was absent.
- The interaction Task/Session correlations no longer use cascading foreign keys. Under the repository's pre-0.1.0 canonical-DDL policy, an existing older schema receives `SCHEMA_RESET_REQUIRED`; this is a destructive pre-release schema boundary, not an in-place data-preserving upgrade. The current user explicitly authorized the reset and stated that old data did not need to be retained. A future public build containing this DDL must communicate or automate that reset boundary as part of its release contract.
- The second independent read-only review confirmed all first-round findings were closed and reported no remaining code, test or delivery findings.
