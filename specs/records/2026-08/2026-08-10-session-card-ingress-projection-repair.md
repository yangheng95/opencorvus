# Session card ingress projection repair

## Recall

- User requirement: diagnose and fix the right-sidebar Work conversation card failure `Cannot read properties of undefined (reading 'find')`, including the apparent loss of the visible conversation turn.
- Acceptance metrics:
  - the affected standalone Session conversation renders its persisted user input, assistant response, and completed Schedule tool result instead of `Card render failed`;
  - Task user messages continue to project `queued_operator_wake` lifecycle badges from the canonical Task board artifacts;
  - the Overlay production build and focused typecheck pass;
  - the real affected page is opened, screenshotted, and manually reviewed without adding, modifying, or running User Interface (UI) automation.
- Hard constraints:
  - Task ingress remains a server-fact projection; do not synthesize artifacts, messages, or ingress state;
  - ordinary Session hydration must not acquire a parallel Task-board contract;
  - do not add, modify, or run UI automation tests;
  - preserve unrelated worktree changes, obtain independent read-only review after verification, then create one focused commit and push only after the upstream commit-set safety check.
- Sources read:
  - `AGENTS.md`;
  - `specs/current/architecture/task-control-plane.md`;
  - `specs/records/2026-08/2026-08-10-task-control-responsiveness-and-cancellation-convergence-plan.md`;
  - `packages/overlay/src/components/Conversation.tsx`;
  - `packages/overlay/src/components/ConversationCard.tsx`;
  - `packages/overlay/src/components/ChatBubble.tsx`;
  - `packages/overlay/src/store/board.ts`;
  - `packages/overlay/src/services/conversation.ts`;
  - `packages/opencorvus/src/server/routes/session.ts`;
  - `packages/opencorvus/src/workbench/board.ts`;
  - the Browser skill instructions for real-page visual acceptance.
- Repository-wide search results:
  - `operatorIngressPresentation` is the only Overlay consumer that maps a user message directly to `queued_operator_wake` artifacts;
  - `queued_operator_wake` is a Task-only durable control-plane occurrence;
  - Task boards produced by `compileBoard` contain required `artifacts`;
  - standalone Session conversation boards deliberately contain `kind: "session"`, lifecycle/composer/change fields, and no Task `artifacts` collection;
  - the affected live hydration response contained three persisted transcript messages and no `board.artifacts` field.
- Independent agent feedback before implementation: none.

## Problem depth and impact

### Observable behavior

Opening the affected Work Session replaces its user card with a per-card render failure. Because the card-level `ErrorBoundary` replaces the failed conversation item, assistant content owned by that visible turn can also disappear and make the otherwise idle, persisted Session appear dead.

### Direct trigger

`operatorIngressPresentation` runs for every user bubble and evaluates `boardStore.board?.artifacts.find(...)`. Optional access covers only `board`; a standalone Session board exists but has no `artifacts`, so the browser calls `.find` on `undefined`.

### Data and control-flow root cause

The new Task ingress badge presentation was attached to the shared `ChatBubble` renderer without first applying the existing `BoardSource` discriminator. The Task control-plane contract and standalone Session hydration contract are intentionally different, but the shared view treated the Task-only artifact collection as universal.

### Why the prior path did not prevent it

Task ingress implementation and acceptance concentrated on selected Task boards. Standalone Session hydration accepts its own smaller board projection and does not call Task-board validation. The card error boundary prevented a whole-application crash, but it could only replace the failed turn and therefore hid the contract mismatch instead of preserving content.

### Related contracts and excluded scope

- The durable ingress lifecycle, Task board artifact schema, Session transcript persistence, and Session backend lifecycle are correct and remain unchanged.
- No database repair, transcript migration, compatibility reader, or Session-side artifact synthesis is needed.
- No styling or layout change is required; visual acceptance checks restored content and absence of the failure card.

## Implementation plan

1. Restrict `operatorIngressPresentation` to the selected Task source before reading Task board artifacts.
2. Preserve the existing Task artifact lookup unchanged so missing/corrupt Task facts remain visible as a real Task contract failure rather than silently falling back.
3. Run focused typecheck/build and repository document checks; do not run UI tests.
4. Open the real affected Session in the actual Overlay, capture a screenshot, and manually confirm the persisted turn renders.
5. Obtain an independent read-only review of the complete diff and evidence, resolve every valid finding, then commit and safely push.

## Verification evidence

- `bun run typecheck` in `packages/overlay`: passed.
- `bun run build` in `packages/overlay`: passed; Vite transformed 7,098 modules and produced the production bundle.
- `bun run docs:check`: passed with 329 operations across 25 groups.
- `git diff --check`: passed.
- Real-page visual acceptance:
  - started an isolated Vite page on `http://127.0.0.1:5174/` and connected it to the existing loopback backend;
  - selected the exact affected Work Session through the visible sidebar;
  - manually confirmed that the user message, Work response, completed Schedule tool row, and final answer render together with no `Card render failed` replacement;
  - captured and manually inspected [`2026-08-10-session-card-ingress-projection-repair.png`](../../artifacts/2026-08-10-session-card-ingress-projection-repair.png).
- The repository's existing browser-host startup path attempted an unrelated Tauri-only Expert Squad handoff bridge before hydration. A temporary browser-validation-only capability guard allowed the real page to load; that exact temporary source change was removed immediately after capture and is absent from the delivery diff.
- UI automation tests were neither added, modified, nor run.
- Independent post-implementation review:
  - confirmed the Task/Session source discriminator preserves Task ingress mapping and removes the false Session contract;
  - independently reran Overlay typecheck, `docs:check`, and `git diff --check`, and confirmed the production bundle contains the Task-source guard;
  - manually reviewed the screenshot and found the complete affected turn visible with no render-failure card;
  - identified that the new ignored record and screenshot required exact forced staging, which was corrected before commit;
  - found no remaining code, contract, visual, or documentation defect after that correction.
