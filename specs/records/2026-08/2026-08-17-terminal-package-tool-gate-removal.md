# Terminal package-Tool gate removal

## Recall

- User request: continue the deletion-led minimal-Host refactor. This slice is `docs/state-audit.md` STA-06, the third layer of terminal-status enforcement on package Tools.
- Acceptance:
  - the derived terminal-status refusal in the Task Artifact execution scope is gone, with no replacement gate and no "log and continue" downgrade;
  - the real boundaries that survive are the physical ones an operating system can move under a live execution — project ownership, project root, Task runtime root — plus the Artifact's own version, ownership, publication sequence and committed-snapshot verification;
  - a Task carrying a terminal lifecycle fact can publish through a package Tool, which is what a continued occurrence needs;
  - a moved project root still refuses;
  - a falsification probe shows the new test fails while the gate exists.
- Hard constraints: no new gate, status word, or capability wrapper; one current implementation, no flag or fallback; do not lean on the two Phase 2 transitional gates (terminal ingress admission and `projectTerminalConversationTools`) as proof that this layer is safe — they are themselves scheduled for deletion; preserve every unrelated working-tree change.
- Read material: `specs/records/2026-08/2026-08-17-minimal-host-reform-plan-calibration.md`; `docs/state-audit.md` (STA-06 and Appendix B); `packages/opencorvus/src/task-artifact/store.ts`; `packages/opencorvus/test/task-artifact-git-commit-publication.test.ts`.
- Whole-repository search: `assertTaskScope` is called from ten sites in `task-artifact/store.ts` — the execution-active predicate and every snapshot verification, publication-sequence reservation and commit path. No test anywhere asserted the terminal refusal, and `isTaskTerminal` had no other use in the file, so its import went with the check.
- Starting workspace: the same in-flight reform slice as the preceding record, plus that record's changes. Typecheck was green before this change.
- Independent agent feedback: none.

## Observed facts and diagnosis

`assertTaskScope` mixed two unlike things. Three of its checks are physical and hold regardless of what the model believes: the Task's project ownership, its project root, and its Task runtime root, each re-verified on every step because the filesystem can move under a live execution. The fourth was `isTaskTerminal(task)` — a projection of lifecycle Protocol Events — used to refuse execution outright.

Under the occurrence model that check is wrong twice over. A completed Task continues in a new occurrence, so "terminal" describes the previous execution's history, not the current one's authority. And what actually protects an Artifact is its own identity: version, ownership, publication sequence, committed-snapshot verification. A lifecycle word cannot substitute for any of those, and its presence invited exactly the reasoning the reform removes — that a status may authorize or refuse an effect.

It was also the third redundant layer. Terminal ingress admission and the projected terminal conversation Tool table already stand upstream, and both are transitional gates this program is deleting; a layer whose only justification is two doomed layers above it has no justification.

## Canonical repair

1. Delete the terminal-status refusal from `assertTaskScope` and the now-unused `isTaskTerminal` import.
2. Document on the function what the surviving boundaries are and why a derived status is not among them.
3. Extract the projected-scheduler snapshot fixture in the publication test into one helper, with an option to append a real `task.completed` fact for the current epoch, and add a positive contract test: a continued occurrence publishes exact bytes, while a moved project root still refuses.

## Verification

- `bun run typecheck` (root, all 10 packages): passed.
- `bun run test test/task-artifact-git-commit-publication.test.ts test/package-tool-capsule-rpc.test.ts test/package-tool-files-capability.test.ts`: 4 + 3 + 2 passed, 0 failed. The publication file's own count rose from 3 to 4 with no duplicated setup, because both current-project tests now share one fixture helper.
- Falsification probe: with the terminal check reinstated, `publishes for a continued occurrence whose previous execution already completed` fails with `TaskArtifactStore: Task is terminal and cannot execute package tools` — the exact refusal this slice deletes. Removed again, all four pass.
