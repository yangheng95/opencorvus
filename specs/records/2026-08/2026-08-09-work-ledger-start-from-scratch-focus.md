# Work Ledger “Start from scratch” focus repair

## Recall

- User request: fix the project-creation menu action “Start from scratch”, which appears to do nothing.
- Acceptance: from a selected Project conversation, open **Create project**, choose **Start from scratch**, and reach the directory-free new-Chat Composer with the message input focused and visibly ready for typing.
- Hard constraints: preserve the single anonymous-Project lifecycle; do not allocate an empty Project before durable Composer content; do not add, change, or run User Interface (UI) automation tests; validate through the real page, screenshots, and manual visual review.
- Read material: `AGENTS.md`; `packages/overlay/src/components/WorkLedger.tsx`; `packages/overlay/src/main.tsx`; `packages/overlay/src/services/workspace.ts`; shared `DropdownMenu` and `Tooltip` primitives; root and Overlay package scripts; Kobalte local type contracts.
- Repository search: both the sidebar **New chat** action and **Start from scratch** call `onCreateGlobalChat`, which reaches the sole `openGlobalComposer` / `openGlobalChatLauncher` lifecycle. The only path-specific difference is that **Start from scratch** executes inside a Kobalte Dropdown Menu. Kobalte exposes `Content.onCloseAutoFocus` as the owner of close-time focus restoration.
- Independent agent feedback before implementation: none.

## Problem-depth and impact analysis

### Observable behavior

On the real Overlay page, selecting a Mission establishes a Project-scoped conversation. Choosing **Create project → Start from scratch** closes the menu and changes the center surface to the global “What should we build?” Composer, but the final active element is still the **Create project** trigger. No new Project row appears because the current durable contract intentionally creates an anonymous Project only at first real submission. Without input focus or a new row, the transition appears inert.

### Direct trigger

`WorkLedger.startGlobalChat` invokes `props.onCreateGlobalChat`. The business callback transitions to the directory-free launcher and schedules Composer focus. Independently, Kobalte closes the Dropdown Menu and performs its default close autofocus, restoring focus to the menu trigger after the business path has requested Composer focus.

### Data and control-flow root cause

The project/Composer data flow is correct and singular:

1. `WorkLedger` emits `onCreateGlobalChat`.
2. `main.tsx` calls `openGlobalComposer(DEFAULT_COMPOSER_INTENT)`.
3. `openGlobalChatLauncher` enters the directory-free workspace.
4. Anonymous Project allocation remains deferred to `resolveGlobalComposerProject` at durable submission or attachment ingress.

The defect is at the UI focus-control boundary: the menu does not declare that this specific selection transfers focus outside the menu, so the menu primitive applies its normal trigger-restoration behavior and wins the final focus race.

### Why existing paths did not root-fix it

Both `openGlobalChatLauncher` and `handleComposerIntentChange` already request message-input focus. Adding another timer would remain an ordering workaround against the menu primitive and could regress across rendering or platform timing. The direct **New chat** action works because it has no menu-close autofocus owner. The correct repair is to record Kobalte's canonical selection, let the menu enter its close-autofocus contract, and only then start the existing global-Composer transition so its normal focus request follows the trigger restoration.

### Definitions, call sites, contracts, data, tests, docs, delivery, and risk

- Definitions/call sites: retain `openGlobalChatLauncher`, `openGlobalComposer`, and `resolveGlobalComposerProject` unchanged. No public interface, route, backend data, persistence schema, or transport contract changes.
- Shared semantics: **Use an existing folder**, menu dismissal, and all other Dropdown Menus keep normal trigger focus restoration.
- Tests: repository rules prohibit UI automation. No existing UI test in the touched path will be run or extended. Positive acceptance is a real selected-Project → menu selection → focused empty Composer interaction, plus manual screenshot review.
- Toolchain: the root override uses esbuild 0.28 while Vite development dependency optimization defaults to downlevel browser targets that this esbuild no longer transforms. Production already targets `esnext`; development dependency optimization must use the same target so the real-page checker can start from current source.
- Documentation: this record and both spec indexes are the only documentation changes.
- Delivery: focused typecheck/build, real page verification, independent read-only review, clean scoped commit, and safe upstream push.
- Risks: changing close autofocus unconditionally would harm keyboard users and folder-picker behavior. The implementation therefore arms a one-shot flag from Kobalte's canonical `onSelect` only for the scratch item, clears it during the matching close-autofocus event, and starts the workspace transition only after that close contract is running. Kobalte remains the sole owner of pointer and keyboard activation semantics.

## Implementation plan

1. Add a one-shot Work Ledger menu focus-transfer flag, arm it from the scratch item's canonical selection, and start the existing callback during the matching `onCloseAutoFocus` sequence.
2. Align Vite development dependency optimization with the existing `esnext` production target.
3. Run Overlay typecheck and build checks without UI automation.
4. Start the real page, select a Project conversation, activate the menu action, verify the Composer textarea is the final active element, and inspect a screenshot.
5. Request independent read-only review of the full diff and evidence; resolve every valid finding and repeat acceptance if anything changes.

## Evidence ledger

- Pre-fix real page: after **Start from scratch**, the center heading becomes “What should we build?”, but `document.activeElement` is the `button[data-ui="work-ledger-create-trigger"]` element.
- Pre-fix development checker: Vite exits during dependency optimization with `Transforming destructuring ... is not supported yet`; the production build succeeds because `build.target` is already `esnext`.
- Post-fix development checker: Vite 6.4.3 starts from current source at `http://127.0.0.1:5173/` after dependency optimization uses `esnext`; the prior 8,114 transform failures do not recur.
- Post-fix pointer acceptance: selected the real running Mission, clicked **Create project → Start from scratch**, observed heading “What should we build?”, and observed final active element `textarea#chatTextarea[data-ui="work-composer-input"]`.
- Post-fix keyboard acceptance: repeated the selected-Mission flow and activated **Start from scratch** with Enter; the same Composer textarea is the final active element.
- Post-fix unaffected close behavior: reopening and dismissing the menu through its trigger restores focus to `button[data-ui="work-ledger-create-trigger"]`.
- Manual visual review: the real desktop page shows the directory-free Composer, visible blue focus ring, and text caret in the message input; the existing Project list remains intact until durable content creates a new anonymous Project.
- Independent review: the first read-only pass found the ignored new spec and identified duplicated pointer/key activation plus an inaccurate `preventDefault` explanation. The implementation now uses Kobalte's sole `onSelect` contract, starts the transition from close autofocus without claiming to suppress Kobalte's trigger focus, and explicitly stages the ignored spec. The final read-only pass reviewed the complete five-file staged/unstaged difference, Kobalte pointer/keyboard/close semantics, unaffected menu paths, Vite scope, Recall, indexes, and validation evidence, and reported no unresolved findings.
