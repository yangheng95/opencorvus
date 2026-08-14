# Mission Board create flow and dock ownership repair

## Recall

- Original user requirements:
  - The Mission Board creation dialog layout is visibly cramped and must be corrected.
  - Switching to the Mission Board management surface must automatically collapse the Right Dock.
  - Professional independent agents must review the whole panel logic; implementation must not be designed in isolation.
- Acceptance metrics:
  - Mission Board is a stable dock-closed surface: delayed Browser Preview readiness or another background presenter cannot reopen the Right Dock.
  - The desktop creation dialog uses the canonical wide-dialog width and collapses its execution-context grid at a narrow viewport.
  - Creation method, Project, Mission type, request, and Expert Squad are visible and locally owned; changing Project or Mission type never clears title/request text and never activates or mutates the hidden global workspace/session.
  - Expert Squad options are loaded for the exact selected Project and Mission type. Artificial Intelligence creation and manual-draft dispatch omit a global Composer model override and use the target project's canonical server-side model resolution.
  - Mission create/dispatch responses cannot steal navigation after a newer selection, dispatch/delete actions are mutually exclusive, and action failures are visible on the board.
  - Mission Board navigation supersedes an in-flight workspace selection without leaving a permanent busy state.
- Hard constraints:
  - UI acceptance uses a real local page, interaction, screenshot, and manual visual review; no UI automation test is added or run.
  - The existing Right Dock signal, workspace selection epoch, target-directory service contracts, and server model resolver remain the only facts; no parallel Board-only dock state, hidden restore state, or frontend model fallback is introduced.
  - Existing unrelated working-tree changes are preserved and excluded from this delivery.
- Materials read:
  - `AGENTS.md`
  - `packages/overlay/src/main.tsx`
  - `packages/overlay/src/components/App.tsx`
  - `packages/overlay/src/components/MissionBoard.tsx`
  - `packages/overlay/src/components/MissionCreateDialog.tsx`
  - `packages/overlay/src/components/ComposerModelSelector.tsx`
  - `packages/overlay/src/components/ui/Dialog.tsx`
  - `packages/overlay/src/components/ui/SegmentedControl.tsx`
  - `packages/overlay/src/services/composer-model.ts`
  - `packages/overlay/src/services/expert-squad.ts`
  - `packages/overlay/src/services/mission.ts`
  - `packages/overlay/src/services/workspace.ts`
  - `packages/overlay/src/store/right-dock.ts`
  - `packages/overlay/src/styles/surfaces/dialog.css`
  - `packages/overlay/src/styles/surfaces/mission-board.css`
  - `packages/opencorvus/src/agent/model.ts`
  - `packages/opencorvus/src/server/routes/mission.ts`
  - `specs/current/architecture/04-extensions.md`
- Repository search results:
  - `openMissionBoard()` closes the dock only at the entry instant; the force-mounted Browser Preview can later invoke `openRightDockPanel("browser")` from `onReady` and reopen it.
  - `MissionCreateDialog` uses one broad reactive initialization effect. Catalog/search prop updates retrigger it and erase the user's draft.
  - The Project field is local, but Model and Expert Squad currently come from global Composer state. `ComposerModelSelector` can patch the hidden selected Session, and the submit path sends the global model to a different target Project.
  - `productPillar` is inherited invisibly from the prior Composer although it is immutable Mission context and filters compatible squads.
  - Mission wake/dispatch model fields are optional. Omitting them delegates to the server's single target-project Mission model resolver; no frontend fallback is needed.
  - AI create and manual dispatch reset the center surface before selection-epoch validation. Dispatch/delete errors are dropped by `void` event handlers and actions are not mutually exclusive.
  - Mission Board filter behavior that hides the Attention lane when empty is an explicit historical product contract recorded in the August index and is retained.
- Independent agent feedback before implementation:
  - `mission_board_ux_review` found the draft-reset, cross-project model/squad, hidden Mission type, naming, error-feedback, responsiveness, required-state, focus, and duplicate-search issues. It recommends local target-directory squad ownership and omitting the global model in this scoped repair.
  - `mission_board_logic_review` confirmed the delayed dock reopen, orphan busy state, stale navigation, concurrent mutation, and target-owner defects. It recommends a stable surface invariant, one canonical Mission navigation owner, server-settled mutation/navigation separation, and a single pending panel action owner.

## Root cause and impact

The screenshot is the visual symptom of a broader ownership failure. A dense multi-section form was placed in the base 380px dialog, while fields that look local actually read and mutate the hidden global Composer context. The initialization effect also treats every asynchronous catalog change as a fresh open, so ordinary squad search can erase the draft. The old layout work only adjusted presentation and did not define resource or navigation owners.

Mission Board was added as a second primary surface without a stable Dock invariant or an in-flight selection handoff. Closing the canonical signal once does not stop force-mounted presenters from reopening it. Similarly, create and dispatch allocate a selection epoch but perform surface reset before the canonical Mission opener validates that epoch, so stale server responses can override newer operator navigation. Card mutations have display-only IDs rather than one action owner and drop rejected promises, producing silent failure or races.

The target Project is the correct owner of Mission type, Expert Squad authority, and default Mission model. The server already owns model precedence. Reusing `ComposerModelSelector` here duplicates ownership and can patch an unrelated hidden Session. This repair therefore keeps model resolution server-side, makes Project/Mission type/Squad dialog-local, and uses request owner keys so stale resource responses cannot commit.

## Implementation

1. Make Mission Board a stable dock-closed surface, suppress background Dock presenters while it is active, and explicitly return to the conversation surface only for a direct operator request to open a Dock tool.
2. Supersede an in-flight workspace selection on Board entry and clear its partial busy projection through one workspace primitive.
3. Make `openMissionSession()` the only Mission surface-reset owner. After successful create/dispatch, refresh Board facts first and navigate only if the request still owns the selection epoch.
4. Replace the dialog's broad initialization effect with an open-edge initializer. Keep Project, explicit Mission type, query, and Squad state local; load/search squads using the exact directory and pillar with generation/sequence ownership.
5. Remove the global Composer model selector and model argument from Board create/dispatch. Keep the server's target-project model resolver as the only model source.
6. Use the wide dialog, responsive execution-context layout, required semantics and visible missing/loading/error explanations. Rename creation labels from Task to Mission.
7. Give card mutation one pending owner, disable competing dispatch/delete actions, catch errors, normalize stale project filters, and focus the Board surface after navigation. Retain the explicitly designed conditional Attention lane.
8. Run focused non-UI checks and build, then exercise the real page and manually inspect a fresh screenshot. Request a fresh independent read-only delivery review; fix valid findings and repeat until clean.

## Risks

- Removing the per-create model override is deliberate for this scoped repair: the old control was not locally owned and could mutate a hidden Session. A future override requires a new request-local, explicit-directory provider snapshot picker rather than reuse of the Composer selector.
- A target Project without a valid Mission model now produces the server's typed configuration error in the dialog or Board action error; the UI does not invent a fallback.
- Project/Mission type changes intentionally clear only the dependent Squad selection. User-authored title and request text remain intact.
- The Mission Board does not remember or restore a previously open Dock. Direct operator tool actions explicitly return to the conversation surface; background presenters remain suppressed.

## Validation

- `bun run --cwd packages/overlay typecheck` passed.
- `bun test packages/overlay/test/task-selection-guard.test.ts` passed: 7 tests, 0 failures.
- `bun run docs:check` passed: 330 operations across 25 groups.
- `bun run --cwd packages/overlay build` passed; output contained only the repository's existing Vite `use client` warnings.
- `git diff --check` passed.
- No UI automation test was added, modified, or run.
- A real isolated page was exercised at 1280×720. Board entry focused `missionBoardTitle`, the Right Dock was closed and hidden, and the wide creation dialog rendered at 820×688 with its footer and submit action visible. The request field rendered at 762×196 before the final CSS-only reduction from 196px to 168px, which removes the measured 27px body overflow while preserving the existing 150px narrow-window rule. The browser tool then rejected the local reload under its URL security policy, so an exact post-adjustment screenshot was not obtainable; build, typecheck, diff checks, and independent CSS review were repeated after that adjustment.
- Independent read-only review was repeated after every valid fix. `mission_board_logic_review` and `mission_board_ux_review` reported no unresolved findings in the final scoped diff, including the last textarea-height adjustment.
