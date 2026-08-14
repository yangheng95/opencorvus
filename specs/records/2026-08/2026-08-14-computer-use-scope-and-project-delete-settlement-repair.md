# Computer Use Scope and Project Delete Settlement Repair

## Recall

### User request

- Explain why enabling Browser and Computer Use appeared to restart the backend.
- Repair the restart and the apparent ineffectiveness of the capability toggles in both Chat and Work.

### Acceptance criteria

- Deleting a Project while one of its Session prompts is being cancelled completes through the existing Project-deletion admission instead of producing an unhandled rejection.
- A typed execution cancellation does not attempt ordinary Session lifecycle re-entry after Project admission has closed.
- Browser and Computer Use settings visibly identify the exact Project and Chat/Work product scope they mutate.
- Focused non-UI tests exercise the successful deletion-settlement contract.
- The real Overlay settings page is inspected in an isolated development runtime and the changed scope presentation is manually verified from screenshots.

### Hard constraints

- Preserve one Project-deletion admission authority; do not add a fallback, compatibility path, hidden message, or Host routing gate.
- Keep all language-model interaction streaming and do not alter tool-selection policy.
- Do not add, modify, or run UI automation tests. UI acceptance uses real-page interaction and screenshots only.
- Preserve unrelated staged and unstaged user changes in the shared worktree.
- Commit this task's changes separately, then merge the configured upstream and push when credentials and remote state permit.

### Sources read

- `AGENTS.md`
- `specs/current/architecture/04-extensions.md`
- `specs/current/architecture/task-control-plane.md`
- `packages/opencorvus/src/config/config.ts`
- `packages/opencorvus/src/conversation/capability.ts`
- `packages/opencorvus/src/conversation/capability-transaction.ts`
- `packages/opencorvus/src/server/routes/conversation-capability.ts`
- `packages/opencorvus/src/project/delete.ts`
- `packages/opencorvus/src/project/instance.ts`
- `packages/opencorvus/src/project/independent-project-owner.ts`
- `packages/opencorvus/src/engine/cancellation-scope.ts`
- `packages/opencorvus/src/session/loop.ts`
- `packages/opencorvus/src/session/prompt/state.ts`
- `packages/opencorvus/src/session/status-publication.ts`
- `packages/opencorvus/src/orchestrator/protocol/message-bridge.ts`
- `packages/opencorvus/src/task-api/index.ts`
- `packages/opencorvus/src/util/process-error-logging.ts`
- `packages/overlay/src/components/settings/ConversationCapabilityPanel.tsx`
- `packages/overlay/src/store/dialog.ts`
- the two 2026-08-14 desktop runtime logs under `%LOCALAPPDATA%/opencorvus/log`
- the affected per-Project `.opencorvus/opencorvus.jsonc` files under `%LOCALAPPDATA%/opencorvus/data/projects`

### Whole-repository search evidence

- Capability assignment definitions and callers show that `primary_assistant_capabilities` is Project-local and separately keyed by `chat` and `work`; Computer Use remains intentionally default-disabled.
- The observed successful capability writes were both `PATCH /work/capability` against one anonymous Project. The selected Chat was in another Project and had neither Browser nor Computer tools in its runtime diagnostic.
- Project deletion is entered from the Project route and global Chat/Task deletion services. All converge on `deleteProject`, `Instance.closeProjectAdmission`, Task deletion, remaining-Session cancellation, Instance disposal, filesystem quarantine, and database commit.
- Session cancellation is shared by operator abort, Task/Mission deletion, right-sidebar abort, queue cancellation, writer replacement, and Project deletion. Only Project deletion closes admission before publishing the cancelled Session terminal fact.
- `publishSessionStatus` always acquired ordinary independent Project identity. During Project deletion this violated the already-closed admission even though the deletion owner held the canonical `ProjectDeletionAdmission`.
- The detached Session loop caught the original execution cancellation, then attempted ordinary lifecycle re-entry before recognizing the typed cancellation. That secondary rejection escaped its detached async task, reached the process-level unhandled-rejection logger, and produced exit code 7; the desktop supervisor then restarted the backend.
- Task, Mission, Session-occurrence, normal completion, terminal cancellation, retry/restart recovery, serial/parallel queue, sandbox and multi-Project entrypoints were searched. The same deletion authority must cover nonterminal Task convergence, remaining standalone Sessions, and sandbox-to-main-worktree lifecycle relay; ordinary cancellation and restart recovery do not close Project admission.
- The detached Session loop had no final rejection observer. A non-cancellation failure whose terminal publication also lost Project admission could therefore escape even after the inner settlement catch.
- No UI automation test references the capability settings panel in the touched Overlay paths.

### Independent agent feedback

- The first read-only review found three P1 gaps: nonterminal Task cancellation did not carry deletion admission, sandbox lifecycle relay reacquired ordinary main-worktree identity, and the detached Session loop lacked a final rejection observer.
- The second read-only review confirmed those three paths, then found that deletion-owned Task and bridge identities still depended on initialized Instance cache entries surviving a restart or convergence.
- The third read-only review found two remaining races: convergence selected before admission closure could still dispose the entry later, and registered-root seeding omitted a Session's exact persisted subdirectory.
- The fourth read-only review found a narrower handoff race: admission could close after convergence's last closed-admission check but before asynchronous disposal began, while admission closure seeded only after observing the still-cached entry.
- The fifth read-only review confirmed that latest race coverage, then found that a convergence-settlement timeout before authority return could leave admission permanently closed. The handshake now removes only its own token-scoped admission and any identity-only entries it seeded on every pre-authority error; a positive timeout test verifies both the typed inactivity error and successful ordinary Project re-entry.
- The sixth read-only review found that deleting identity-only entries from `Symbol.dispose` after authority publication could bypass lazy Instance State and Bus cleanup. The final ownership rule discards seeds only before authority publication; afterward, successful Project disposal cleans them formally, while a failed deletion retains them for ordinary bootstrap or later convergence. The filesystem-preflight retry test now re-enters the exact persisted Session directory under the original Project before retrying deletion.
- The seventh read-only review required the principal test to run the physical `SessionLoop`, the capability surface to retain the exact server-returned scope, and the real-page evidence to be recorded. The repair drives `SessionPrompt.prompt` through the real `SessionLoop` and `SessionProcessor`, renders the normalized Project directory in the badge and explanatory notice, and records both Chat and Work screenshots. `Instance.worktree` remains the exact execution sandbox, matching `refreshedContext`; the registered Project root remains `Project.worktree`.
- The eighth read-only review found that successful disposal still deleted uninitialized identity entries without formal State and Bus cleanup even though deletion-authorized publication could already have used them. Project disposal now calls the same `disposeEntry` path regardless of capability-bootstrap state, and the sandbox relay regression observes `server.instance.disposed` for both the retained host seed and sandbox Instance.
- The repair now carries the same admission through Task cancellation and prompt settlement, propagates it across the sandbox message bridge, observes every detached-loop rejection locally, seeds deletion-only identities from the durable Project and bounded Session directories, and atomically hands already-selected convergence work to admission closure by awaiting its settlement before seeding. Positive Project-deletion tests cover a real active `SessionLoop` with an attached prompt, a persisted nonterminal Task after cache convergence, a nested Session directory, that latest controlled convergence/admission race, timeout recovery, and a sandbox Session whose host main-worktree entry has converged.
- A final read-only review is required after the latest focused validations and real-page evidence are complete.

## Design

1. Thread the existing `ProjectDeletionAdmission` through Project-wide Task and Session cancellation and terminal publication. When no initialized cache entry survives, seed identity-only deletion contexts from the durable Project snapshot and every persisted Session directory that remains inside a registered root; do not reopen ordinary discovery or capability initialization. Admission closure waits for already-selected convergence disposals before seeding so cache ownership changes atomically across the handoff, and rolls back its exact token plus still-unused identity entries if that pre-authority handshake fails. After authority publication, retain entries not formally disposed so normal bootstrap or later convergence owns State and Bus cleanup.
2. Carry the same deletion authority through sandbox-to-main-worktree lifecycle relay, rather than reopening ordinary admission in the bridge.
3. In the Session loop's outer failure path, treat the typed execution cancellation as already terminal before any lifecycle re-entry. Catch and diagnose a failed non-cancellation terminal publication, and attach a final observer to the detached loop so no rejection reaches the process-level handler.
4. Rename the capability settings product presentation from ambiguous `Code` to `Chat` and show a concise, localized statement that assignments apply only to the displayed Project and product. Use the server-returned directory as the persisted scope source.
5. Add focused positive backend coverage for Project deletion settling a real active `SessionLoop` and attached prompt, a persisted nonterminal Task after Instance convergence, an exact nested Session directory, an entry already selected by concurrent convergence, timeout recovery, and a sandbox Session lifecycle relay after its host entry converges; deletion paths must return committed receipts and timeout recovery must restore ordinary entry.

## Verification plan

- Run the focused Project deletion/cancellation test file, including the nonterminal Task and sandbox Session cases.
- Run focused TypeScript checks for the changed packages and the root documentation check.
- Start the real development UI on an isolated port, open the capability settings with the in-app Browser, toggle/select only within the isolated Project, capture screenshots, and manually verify the Project plus Chat/Work scope wording and layout.
- Obtain an independent read-only review of the full diff and validation evidence; repair and re-run any affected checks until findings are resolved.

## Verification evidence

- The real OpenCorvus package runner completed `46 pass, 0 fail, 73 expect` for `test/project-directory-and-worktree-gc.test.ts`. The principal deletion case entered `SessionPrompt.prompt`, started the physical `SessionLoop` processor, received the exact typed Project-deletion cancellation, persisted the exact terminal lifecycle event, and committed deletion only after prompt and State ownership settled.
- The filesystem-preflight failure case preserved the Project, then proved ordinary `Instance.provide` adopted the retained exact-directory seed under the original Project before retrying deletion to a committed receipt. Its later `Instance.disposeAll` used formal State and Bus disposal.
- `packages/opencorvus` TypeScript checking passed after the backend and test changes.
- `packages/overlay` TypeScript checking and the production Vite build passed. Vite emitted only its existing third-party `use client`, mixed dynamic/static import, and chunk-size warnings.
- A fresh isolated server served the rebuilt production Overlay at `http://127.0.0.1:17878/ui/` with Project directory `C:/Users/hengu/AppData/Local/Temp/opencorvus-capability-visual-final-20260814/exact-project-alpha`. Manual desktop inspection confirmed that Chat and Work each show their own product label plus the full normalized Project path, the long path wraps without collision or clipping, and the capability list remains readable.
- Real-page screenshots: `specs/artifacts/2026-08-14-computer-use-scope-chat.png` and `specs/artifacts/2026-08-14-computer-use-scope-work.png`.
- The isolated server was stopped after verification. Its exact temporary runtime root remains outside the repository because the environment rejected the bounded recursive-cleanup command; it is not a product artifact or Git input.
