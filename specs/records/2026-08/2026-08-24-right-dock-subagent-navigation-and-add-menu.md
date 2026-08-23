# Right Dock sub-agent navigation and add-menu regression repair

## Recall

### User request

- Repair the regression on the real WebUI at `http://localhost:7884/ui/` where clicking another child-agent message does not switch the right-side child-agent conversation.
- Repair the adjacent regression where the Right Dock `+` / **Add tool** button has no visible effect.

### Acceptance criteria

- From a selected Task with multiple child Sessions, clicking a child-agent entry in the Agent activity rail opens the Right Dock, activates the **Expert Squad agents** panel, and selects that exact Session.
- With the child-agent panel already open, clicking a different child-agent entry changes the panel's exact `data-session-id` and visible conversation to that Session.
- Clicking **Add tool** presents the complete enabled tool menu in the WebUI; choosing an item opens and activates that tool. Already-open singleton tools are visibly disabled while Browser remains addable.
- The overflow selector uses the same accessible in-document menu primitive and still activates the exact hidden tab.
- The real `7884` page is manually exercised and visually reviewed after a fresh build/reload. No UI automation test is added, changed, or run.

### Hard constraints

- Preserve the selected Task and child-transcript backend routes, Server-Sent Events (SSE) delivery, Session identity, and current Right Dock tab model.
- Reuse the existing `DropdownMenu` primitive; do not add a second WebUI-only shadow menu, synthetic click bridge, hidden message, or host-side routing gate.
- Preserve all unrelated dirty-worktree changes, including the current Tool-disclosure work in `CardParts.tsx`, `InlineToolPart.tsx`, protocol files, and benchmark files.
- UI acceptance is real interaction plus screenshots and manual inspection only. Existing or new UI automation tests must not be run.

### Material read and search evidence

- Real-page reproduction on Task `tsk_g00VT7foiu0069eMZsqu`: clicking the Agent activity entry for Session `ses_-zUWsCllOzzDo2RmB7Yd` left `#rightDock[data-open="false"]`, kept the **Open right dock** action visible, and selected no child Session.
- Real-page reproduction of **Add tool**: after opening the dock through the header toggle, clicking the Right Dock button left `aria-expanded="false"`; no menu or dialog appeared after five seconds.
- The same page has neither `window.__TAURI_INTERNALS__` nor `window.__TAURI__`, while the Right Dock menu path calls `WebviewWindow` through `openNativeMenuSurface`.
- The header toggle successfully opens the dock, proving the dock visibility signal and layout are healthy. The empty dock launcher also renders all tool choices, excluding missing catalog data as the cause.
- Read `ConversationAgentRail.tsx`, `Conversation.tsx`, `SubagentProgressGrid.tsx`, `SubagentConversationPanel.tsx`, `App.tsx`, `main.tsx`, `RightDock.tsx`, `right-dock.ts`, `native-menu-surface.ts`, `DropdownMenu.tsx`, current menu/dock styles, the current Overlay live-delivery architecture, and the prior sub-agent Session-dedup and dock-live-follow records.
- Searched all definitions/callers of `openSubagentConversation`, `onOpenSubagentConversation`, `openRightDockPanel`, `setRightDockVisible`, `openNativeMenuSurface`, Right Dock add/overflow state, and sub-agent progress/rail presentation.
- Independent agent feedback before implementation: none. The repository-mandated independent read-only review will run after implementation and first verification.

## Analysis

### Observable phenomena

1. A child-agent activity row can be clicked but the Right Dock remains closed and no exact child Session is selected.
2. The Right Dock `+` button can be clicked but presents no menu, changes no visible state, and emits no actionable UI error in the WebUI.

### Direct triggers

- `ConversationAgentRail.locateRecord` classifies a child record with `isSubagentActivityRecord` and then calls only `requestConversationCardScroll(subagentProgressCardID(...))`. It never invokes the canonical `openSubagentConversation` owner used by the progress grid and Task runtime shortcut.
- `RightDock.openAddMenu` and `openOverflowMenu` call `openNativeMenuSurface`, whose only presentation implementation constructs a Tauri `WebviewWindow`. The localhost WebUI has no Tauri runtime, so no presentable surface exists.

### Data/control-flow root causes

- Child-agent activation has two competing meanings. The progress grid and Task runtime shortcut address a child by Session and open the dock, while the activity rail addresses the same child record as a main-conversation scroll target. The rail therefore bypasses the single selected-child signal and the exact child-transcript panel.
- Right Dock menu state is modeled in Solid, but presentation is delegated exclusively to a native child Webview. That presentation boundary is not part of the WebUI runtime. The application already owns a mature accessible `DropdownMenu` primitive used across the same Overlay, but the Dock is disconnected from it.

### Why previous fixes did not root-cure this

- Session-occurrence dedup repaired which record represents a child Session, not what clicking that record does.
- Dock live-follow repaired projection after a Session is selected, not selection itself.
- Right Dock visibility and tab activation are correct when invoked through the header toggle or empty launcher, so more signal retries or forced layout work would only hide the missing activation call.
- Waiting longer cannot make a Tauri Webview appear inside a plain browser runtime; the menu requires a presentation implementation that exists on the current surface.

### Shared-mechanism and impact audit

- Child activation entries: main progress grid, Agent activity rail, Task runtime shortcut, dock selector tabs, and dock overflow selector. All must converge on exact Session selection through `openSubagentConversation`; only the rail currently diverges.
- Dock menu entries: add menu and hidden-tab overflow menu share the same unusable native presentation owner and are repaired together.
- Task/Mission/Session occurrences: navigation is read-only presentation state. It changes no lifecycle, queue, wake, recovery, terminal, or persisted conversation fact.
- Project isolation: selected child loading already keys target identity by source, Session, and Project directory. The repair supplies only the existing exact Session ID.
- Normal/terminal/repeated runs: `subagentSessionRecords` remains the authority for one newest record per Session; completed and running Sessions use the same selector.
- Excluded: backend routes, SDK/protocol schemas, transcript hydration/live projection, native menu consumers outside the Right Dock, Task scheduling, Provider behavior, and artifact rendering.
- Risks: menu focus/escape/dismiss behavior, disabled singleton items, Browser multi-tab identity, hidden-tab activation, and accidental interference from surrounding dirty work. These are checked through type/build validation and real-page interaction.

## Implementation plan

1. Pass the existing `onOpenSubagentConversation` owner into `ConversationAgentRail` and use it for child records; retain exact-card navigation for orchestrator/main-conversation records.
2. Replace the Right Dock add and overflow native-popup calls with the canonical in-document `DropdownMenu` primitive, preserving current controlled open state, catalog rules, tab identity, disabled state, and actions.
3. Add only the minimal menu layout styles needed for readable Dock menus.
4. Run Overlay type checking, production build, document checking, and diff checking without running UI automation tests.
5. Reload the isolated real page, verify exact child-session switches and Add tool actions, inspect screenshots manually, then commission an uninvolved read-only agent review.

## Verification record

- `bun run --cwd packages/overlay typecheck`: passed.
- `bun run --cwd packages/overlay build:vite`: passed in 1m46s; the existing dependency directive and large-chunk warnings remained informational.
- `bun run docs:check`: passed with 331 operations across 25 groups.
- `git diff --check`: passed before real-page acceptance.
- `bun run --cwd packages/overlay check:css-tokens` remains blocked by four pre-existing unresolved references in unrelated `composer.css` and `settings.css`; this repair added no token named in that output. The production build parsed and emitted the changed Dock stylesheet successfully.
- Real-page acceptance loaded the fresh `main-BvfVVevq.js` and `main-BQDhmnTH.css` from `http://localhost:7884/ui/` and selected Task `tsk_g00VT7foiu0069eMZsqu`.
- Agent rail selection passed: clicking implementation Session `ses_-zUWsCllOzzDo2RmB7Yd` opened `#rightDock` and selected that exact Session; clicking test Session `ses_-zUWs509MzzJPLf1DLDS` changed both the panel and selected tab to the exact second ID and rendered its transcript.
- Add menu passed: **Add tool** changed to `aria-expanded="true"` and showed Browser, Review, Files, Screenshots, Requirements, and Goals. Selecting Review closed the menu and activated the Review tab; reopening the menu showed Review disabled and Browser enabled.
- Overflow passed after opening six tool panels: **More tabs** presented the five hidden exact tabs, selecting **Expert Squad agents** closed the menu, activated the sub-agent panel, and retained the selected test-engineer Session.
- Manual screenshot inspection confirmed that the add menu is anchored to the Dock `+`, remains within the viewport, separates its tool groups, visibly disables Review, and does not obscure the Dock close control. A second screenshot confirmed the test-engineer transcript, selector tabs, status dots, and adjacent Review tab without clipping or overlap.
- No UI automation test was added, changed, or run.
- During verification, building directly into the live `dist-vite` directory temporarily invalidated the user's loaded asset references. The build was allowed to complete; `/ui/`, the new JS/CSS assets, and the Mission status endpoint all returned HTTP 200. Fresh Task hydration then completed from the unchanged 4,229,978-byte conversation response in about 28 seconds. No runtime data was deleted or rewritten by the build. Future live-port verification must build before opening/reloading the target page or use an isolated build output.
- Independent read-only review found two valid P2 delivery/convergence issues: a controlled overflow menu could remain logically open after responsive reflow made `hiddenTabs()` empty, and the new dated record was hidden by the repository-wide `/specs/` ignore rule. The overflow state now closes when no hidden tab remains; the record is force-added at commit time. No other code, interaction, data-integrity, or scope finding remained.
- After that convergence fix, `typecheck`, `check:i18n`, `docs:check`, and `git diff --check` passed again. A second production Vite build passed in 1m58s with output redirected to `C:\Users\hengu\AppData\Local\Temp\opencorvus-rightdock-verify-20260824-1`; it did not rewrite, restart, or reload the live `7884` service.
- The second independent read-only review found no unresolved issue. It confirmed the overflow close effect is one-way and non-looping, the exact force-add delivery requirement prevents dangling index links, and the final scoped code, interaction, CSS, documentation, and isolated-build evidence are consistent.
