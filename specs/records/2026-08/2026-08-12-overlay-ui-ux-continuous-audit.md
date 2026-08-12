# Overlay UI/UX Continuous Audit and Repair

## Recall

| Item | Recorded authority |
| --- | --- |
| User request | Lead multiple independent agents in a whole-product OpenCorvus User Interface (UI) and User Experience (UX) review; repair confirmed primitive reuse, visual quality, interaction-convention, and control-behaviour problems; iterate through real user interaction and screenshots until another review round finds no new actionable defect. |
| Acceptance metrics | Desktop Overlay is exercised from current source at 1280 x 720 or larger. Every accepted finding has a reproducible user scenario, code/data/control-flow root cause, one current implementation, and a post-repair screenshot/manual review. Navigation, primary actions, forms, menus/dialogs, keyboard focus, loading/error/empty states, and representative Settings/Mission/conversation surfaces are reviewed. The terminal audit round has no unresolved confirmed finding in the inspected scope. |
| Hard constraints | Preserve unrelated dirty-worktree changes. Do not operate, refresh, stop, or restart the user's existing application processes. Use an isolated local page/service. Do not add, modify, update, or run UI automation tests, browser fixtures, snapshots, baselines, or pixel assertions. UI acceptance is real page interaction, screenshots, and human visual inspection. Use Node.js-backed in-app browser interaction. No fallback, compatibility layer, parallel state, synthetic/hidden message, or host workflow gate. Non-UI contract changes require focused positive tests. |
| Task input -> output | Input: the current `packages/overlay` implementation, its current architecture/spec records, and an isolated current-source runtime. Output: an evidence-backed issue ledger, repaired source and design primitives, focused non-UI checker results, real-page screenshots, independent read-only reviews, and a scoped Git delivery. |
| Environment | Repository root `D:\\myhexin-local\\opencorvus`; Overlay source `packages/overlay`; isolated Vite/server ports are selected only after checking listeners; runtime state uses an isolated temporary `OPENCORVUS_HOME` and project directory when backend data is required. Existing user-owned Bun/OpenCorvus processes are out of scope. |
| Timeout policy | Build/checker and backend waits use activity-aware observation; 3 minutes without new output or runtime progress is failure evidence. Long-running work is checked with bounded wakeups rather than continuous log polling. Browser actions use bounded per-action waits and preserve the last visible state on failure. |
| Already-read material | Root `AGENTS.md`; Browser control skill; benchmark debug skill; `specs/current/architecture/README.md`; Task control-plane and Project-memory architecture; Mission Board dock/create repair; Work Ledger start-from-scratch focus repair; root/Overlay package scripts; Overlay source inventory; design tokens, base cascade, and application entry point. |
| Repository search | Overlay already contains Kobalte-backed primitives under `components/ui` and CSS primitives under `styles/primitives`; the component tree also contains direct native controls and many surface-specific handlers. Prior records establish real-page-only UI acceptance, canonical server ownership for Mission/Project/Task state, and existing repaired focus/dock contracts. Definitions and call sites for each accepted issue must be searched before editing. |
| Independent agent feedback | Three independent read-only discovery agents completed design-system/primitive, visual/information-architecture, and interaction/accessibility reviews. An uninvolved fourth agent completed the first delivery review; every valid finding is addressed below and will be followed by another uninvolved review. |

## Benchmark definition

The benchmark is a repeatable, human-reviewed desktop UX campaign rather than a UI automation suite.

1. Start isolated current-source Overlay assets without colliding with user-owned processes.
2. Open the real page in the in-app browser at a desktop viewport and capture the initial shell.
3. Exercise the representative journey: first/global Composer; Project/Session selection; Mission Board and create flow; Settings navigation and at least one form-heavy panel; menus, dialogs, destructive confirmations, Right Dock, and keyboard focus traversal.
4. For each observation, record the visible symptom, direct trigger, root control/data flow, why current primitives/contracts do not already solve it, affected definitions/call sites, and intended verification.
5. Accept only confirmed, in-scope findings. Repair one coherent batch at a time, then rebuild and repeat the exact real-page interaction with a new screenshot.
6. After the implementation pass, commission an uninvolved read-only agent to inspect the complete diff, evidence, tests, docs, and regression risks. Fix all valid findings and repeat review when fixes occur.
7. Run another independent discovery pass. Completion requires no new confirmed actionable issue in the inspected desktop scope.

### Pass/fail contract

A batch passes only when all of the following are true:

- the real page loads from current source and the target interaction reaches its explicit visible/focus/state result;
- the screenshot has been opened and manually inspected at its real dimensions;
- the repaired surface uses the repository's current primitive and design-token authorities where applicable;
- typecheck/build and any focused positive non-UI contract checks for the changed path pass;
- no fallback or duplicate state/implementation was introduced;
- independent review has no unresolved valid finding.

Static source inspection, Document Object Model text, console cleanliness, build success, or screenshots without real interaction do not independently constitute UI acceptance.

## Initial analysis boundary

- Observable phenomenon: the request reports raw visual treatment, controls that violate expected desktop conventions, controls that do not work as expected, and business surfaces bypassing primitives. These are hypotheses until reproduced or supported by complete code paths.
- Direct trigger: unknown until source and real-page audit findings are correlated.
- Data/control-flow root cause: unknown until each finding traces business surface -> primitive/native control -> state/service owner -> visible result.
- Why older paths did not root-cause it: prior records repaired individual surfaces and flows, but no current whole-Overlay audit establishes cross-surface consistency or a clean terminal discovery pass.
- Impact surface: `packages/overlay` components/styles/services and, only where proven, their shared public contracts, focused non-UI tests, documentation, and packaging. Public website and backend behaviour are excluded unless an exact Overlay defect crosses that contract.
- Delivery risk: broad visual churn can erase established interaction semantics or collide with concurrent work. Changes therefore remain evidence-led, small-batch, and independently reviewed.

## Iteration ledger

### Baseline A — isolated current-source desktop surface

- Runtime: current `packages/overlay` production assets, served from an isolated local static service at `http://127.0.0.1:5198/`; no user-owned OpenCorvus process was refreshed, stopped, or reused.
- Viewport and locale: 1280 x 720, `zh-CN`.
- Initial shell: the first/global Composer, left navigation, workbench tabs, disabled offline controls, and global connection feedback rendered from current source.
- Mission interaction: activating `Mission 看板` reached the real Mission Board surface. While the global status correctly reported that the backend was unavailable, the board body claimed there were no matching Missions. This presents unavailable/unknown data as an empty result.
- Visual evidence: [`2026-08-12-overlay-ui-ux-mission-error-empty-baseline.png`](../../artifacts/2026-08-12-overlay-ui-ux-mission-error-empty-baseline.png).
- Additional runtime evidence: the static-browser host emitted one uncaught `native-menu-surface-contract` metadata error. This remains a lead until its production/Tauri applicability and source root cause are established.

### Independent discovery round 1

Three uninvolved read-only agents reviewed the current Overlay and did not modify files or run UI automation tests.

#### Accepted root-cause batch A — design-token contract convergence

- Current radius authority is `--oc-radius-none/soft/large/xl/pill`, but active Usage, Mission Board, Conversation, Messages, Composer, and Settings styles still consume retired or never-defined static tokens.
- `design-language.css` explicitly records that aliases including `--ok` and `--text-dim` were retired and consumers must use canonical tokens; later consumers reintroduced them. A declaration containing an unresolved `var()` without a fallback becomes invalid, which directly removes intended borders, backgrounds, radii, shadows, typography, or state color.
- Dynamic element-scoped variables such as lane count, dialog drag offsets, progress widths, and preview dimensions are not part of this finding. They require an explicit runtime-variable allowlist in the checker rather than global token definitions.
- Repair contract: migrate every confirmed static consumer directly to the current canonical token. Do not restore aliases. Add one positive non-UI CSS token checker that proves every static `var(--token)` is defined by the current CSS authority or belongs to an explicit runtime-injected set.
- Representative visible verification: Mission Board, Usage, Conversation artifacts/source chips, Log Viewer copy feedback, and Expert Squad Evolution in current themes.

#### Accepted interaction and information-architecture batch B

1. Mission Board loading/error/content/empty states are not mutually exclusive. The isolated offline journey proves that unavailable data is presented as an empty collection; the component also independently renders an error banner before an empty-state branch.
2. Mission Board navigation has no current-page projection while a previously selected conversation can retain current styling. Top-level surface state and conversation state must remain stored but render mutually exclusive selection semantics.
3. The Expert Squads quick entry promises discovery but routes to Installed Expert Squads instead of the existing Market/install destination.
4. Settings search only filters section metadata while its copy promises settings-level search. The first repair will make the promise precise (`settings pages`); field-level search remains a separate feature requiring a localized content index.
5. Settings tab changes deliberately render a null panel for one animation frame. The synchronous tab selection must render without an artificial blank frame.
6. Mission Board conditionally removes only the empty Attention lane, causing all lane widths and positions to jump as async state crosses zero. The board must keep a stable lane topology and uniform empty-lane presentation.
7. Dashboard artifact is the only direct native `select` in Overlay business UI and duplicates control styling. It must use the current `SelectControl` primitive while preserving filter value semantics.

#### Accepted primitive batch C

- Automation suggestion and Expert Squad Evolution action tiles duplicate native button, focus, radius, and transition rules instead of using the current Button/action-tile authorities.
- Before implementation, the shared action-tile contract and selected-record semantics must be read completely. The repair may extend the canonical primitive, but may not leave parallel interaction implementations.

#### Pending or excluded from the first batch

- Mission pagination currently waits for every page before reconciliation. This is a credible large-data latency risk, but remains a candidate until the server ordering/pagination contract and a representative multi-page runtime are verified.
- Purely dynamic custom properties are excluded from global design-token migration.
- The static-browser native-menu metadata exception is not yet accepted as a product defect because the isolated page lacks the Tauri host metadata contract; source and native-host evidence are still pending.

#### Accepted interaction/accessibility batch D

1. Goal save captures a generation owner, but Escape/backdrop close could increment that generation while the service request remained in flight. A successful request would then skip both dialog reconciliation and `loadBoard`, leaving durable success with a stale board. The controlled dialog must refuse close while `saving`, matching its disabled cancel action.
2. Native-menu event-bridge and window creation promises cached rejection permanently. The child window mounted through an uncaught async callback, so readiness failure could hang the parent and every later click reused the same failed promise. The single native-window path must emit explicit initialization failure, destroy the failed window, clear failed promise ownership, and allow a later fresh initialization.
3. Right Dock reported native-menu open failures only to the console. Existing diagnostics are the visible error authority and must receive add/overflow failures.
4. The horizontal native-menu toolbar supported only vertical arrow movement. Left/Right must move within the toolbar while Up/Down retains menu-wide movement.
5. Right Dock tab geometry reserved a close button inside a 72-pixel minimum, routinely removing all visible label copy. The canonical minimum-width token must preserve an icon, useful label fragment, and close action before overflow begins.
6. Shared application dialogs provided a visual message but no dialog description relationship. Their message node must be the dialog's `aria-describedby` target. Destructive confirmations must use the existing danger Button tone instead of the accent primary action.
7. Local Environment, Add Skill, and Add MCP visually behaved as forms but used click-only action buttons. Their canonical containers must be `form` elements with submit buttons, so Enter follows desktop form conventions without parallel key handlers.

### Round 1 root-cause analysis

- Observable phenomena: raw/native control appearance, missing surface decoration and feedback, contradictory unavailable/empty Mission state, navigation destination/current-state mismatch, unstable board geometry, and a visible settings content flash.
- Direct triggers: enter the affected surfaces; activate Mission Board while its data owner is unavailable; switch Settings tabs; use the Expert Squads quick entry; open a dashboard filter; keyboard-focus duplicated action tiles.
- Data/control-flow roots: retired token consumers survive outside their single token authority; page state branches do not share one state model; primary-surface state is not projected into navigation semantics; routes and labels diverged after Market/Installed split; business surfaces own commodity control behavior that existing primitives already provide.
- Why the old path did not root-cause it: historical migration scripts and comments described a completed token/primitive cutover but no maintained checker enforced it. Prior UI repairs were page-specific and did not finish with a cross-surface discovery pass.
- Impact: `packages/overlay` CSS token consumers, Mission Board and Work Ledger presentation contracts, Settings navigation copy/rendering, Dashboard artifact filtering control, shared Button/action-tile use, focused non-UI check scripts, i18n catalogs, and this evidence record. Backend/public website changes are excluded unless later runtime evidence proves a crossed contract.
- Risk controls: no compatibility aliases, no fallback implementation, no UI automation test, no user-process operation, and no broad visual redesign without real screenshot evidence.

### Repair batch 1

- Migrated unresolved static CSS consumers to the current token authorities across the affected Overlay surfaces. Added `packages/overlay/script/check-css-token-usage.ts` as the one positive contract checker, scanning all Overlay CSS while accepting only an explicit component-injected runtime-property set. No alias or fallback token was introduced.
- Made Mission Board loading/error/content/filtered-empty/true-empty states mutually exclusive; offline/error now renders one alert instead of a contradictory empty result. Stable five-lane topology replaces the Attention-only dynamic lane removal. Filtered and true-empty results now have distinct recovery actions.
- Projected top-level `primarySurface` into Work Ledger navigation so Mission Board owns `aria-current=page` and conversation rows suppress current styling while the board is active. Routed the Expert Squads quick entry to Squad Market.
- Removed Settings' intentional null-frame render and narrowed search language to “settings pages,” matching its section-level index.
- Replaced Dashboard artifact's native `select` with the existing `SelectControl` primitive while preserving typed values through stable option identities.
- Guarded Goal dialog closing while saving; added App Dialog description semantics and a danger-tone contract used by destructive Project, Mission, Mailbox, Worktree, and File confirmations.
- Repaired native-menu initialization ownership and failure recovery; added toolbar Left/Right focus movement; surfaced Right Dock menu failures through the current diagnostics service; increased the canonical Dock tab minimum width.
- Converted Local Environment, Add Skill, and Add MCP action regions to semantic forms with submit buttons.

### Verification after repair batch 1

- `bun run typecheck` in `packages/overlay`: pass.
- `bun run check:i18n` in `packages/overlay`: pass, two locales and 1,822 keys.
- `bun run check:css-tokens` in `packages/overlay`: pass, 8,312 references resolved across 513 declarations.
- `bun run build` in `packages/overlay`: pass, 7,106 modules transformed and production assets emitted.
- `git diff --check`: pass.
- No UI automation test, fixture, screenshot baseline, or pixel assertion was added, changed, or run by this task.

### Real-page review after repair batch 1

- Rebuilt production assets were reloaded only in the isolated `127.0.0.1:5198` in-app-browser page at 1280 x 720.
- Activating Mission Board now renders a selected Mission navigation row and exactly one centered unavailable alert with retry. The former “no matching Mission” contradiction is absent. Evidence: [`2026-08-12-overlay-ui-ux-mission-error-fixed.png`](../../artifacts/2026-08-12-overlay-ui-ux-mission-error-fixed.png).
- Opening Settings and searching `代理 URL` now visibly returns “没有匹配此搜索的设置页面,” which is consistent with the narrowed “搜索设置页面...” promise. Evidence: [`2026-08-12-overlay-ui-ux-settings-search-fixed.png`](../../artifacts/2026-08-12-overlay-ui-ux-settings-search-fixed.png).
- Activating the sidebar Expert Squads entry opens the selected `Squad 市场` tab rather than `已安装专家团`.
- Manual visual review found the repaired Mission header, selected navigation, single error hierarchy, search/filter controls, and bottom connection status legible without overlap at the acceptance viewport.
- Backend-owned Mission data, a saving Goal request, a real Dashboard artifact, and the Tauri native child-window lifecycle cannot be produced by the isolated offline static page. Their changed UI paths are therefore not yet claimed as complete visual acceptance; they remain subject to independent diff review and a native/current-data runtime when available.

### Repair batch 2

- Made Mailbox click, Enter, and Space a persistent activity selection independent of transient hover preview; leaving the sidebar no longer closes a pinned mailbox.
- Moved diagnostic-copy out of the fake/double-click chat title button and into the existing title menu. Removed double-click rename from Work Ledger rows and the duplicated keyboard activation handler from `SegmentedControl`.
- Added visible, retryable Project Memory action failure feedback instead of treating application logs as the user feedback channel.
- Split Mission true-empty/filter-empty and Mailbox search-empty states with contextual copy, clear/reset actions, and focus return.
- Made Scheduled Automation save/create/update/run/pause/resume/delete mutations globally serial under one pending owner; selection, edit, filtering, create/delete, and history refresh no longer race an in-flight mutation. Migrated suggestion tiles to `Button` plus `oc-action-tile`, and evolution selectors to `SettingsRow`.
- Separated Browser Preview URL actions: Enter and the trailing arrow navigate inside the preview; an explicit external-link action opens the default browser. The address stays editable when either capability exists.
- Extended `TextField` and `SelectControl` so description/error IDs, `aria-invalid`, and `aria-errormessage` project to native controls. Mission Create retains focus during asynchronous lookup failures while its alert region announces the error.
- Removed the permanently disabled fake Forward control. Settings conditionally exposes one local “Back to OpenCorvus” action.
- Corrected generated Overlay minimum aspect ratio from height/height to configured width/height and added a focused positive contract test.

### Real-page review after repair batch 2

- Baseline shell: [`2026-08-12-overlay-ui-ux-baseline.png`](../../artifacts/2026-08-12-overlay-ui-ux-baseline.png).
- The pre-rebuild Mission interaction reproduced the contradictory offline plus query-empty state: [`2026-08-12-overlay-ui-ux-mission-baseline.png`](../../artifacts/2026-08-12-overlay-ui-ux-mission-baseline.png).
- The post-rebuild identical click journey renders a single actionable unavailable state: [`2026-08-12-overlay-ui-ux-mission-after.png`](../../artifacts/2026-08-12-overlay-ui-ux-mission-after.png).
- Clicking Mailbox pins the panel open away from the trigger and exposes `aria-expanded=true`: [`2026-08-12-overlay-ui-ux-mailbox-after.png`](../../artifacts/2026-08-12-overlay-ui-ux-mailbox-after.png).
- A no-result Mailbox query renders the query and a clear action instead of the ordinary empty-inbox explanation: [`2026-08-12-overlay-ui-ux-mailbox-search-after.png`](../../artifacts/2026-08-12-overlay-ui-ux-mailbox-search-after.png).
- Mission Create now opens in a neutral state without premature red validation; after an explicit content attempt, the title/request errors belong to their controls through `aria-describedby`, `aria-invalid`, and `aria-errormessage`. Initial state: [`2026-08-12-overlay-ui-ux-mission-create-initial-final.png`](../../artifacts/2026-08-12-overlay-ui-ux-mission-create-initial-final.png). Interacted validation state: [`2026-08-12-overlay-ui-ux-mission-create-validation-final.png`](../../artifacts/2026-08-12-overlay-ui-ux-mission-create-validation-final.png).
- Scheduled Automations exposes a single local Settings back action and renders full-height suggestion entries through real Button/action-tile primitives. The first visual pass found clipping; the final current-source pass shows three unclipped, evenly spaced entries: [`2026-08-12-overlay-ui-ux-scheduled-final.png`](../../artifacts/2026-08-12-overlay-ui-ux-scheduled-final.png).
- The isolated in-app Browser does not provide the Tauri/native backend transport. Connected mutations and native Browser Preview capabilities therefore remain explicitly unclaimed as visual acceptance; their current evidence is source ownership, typecheck, production build, and independent review.

### Independent discovery and repair round 2

- A second three-agent discovery pass found no P0, but did find residual cross-surface state and contract problems: Scheduled, Archive, and Expert Squad Evolution presented first-load errors beside normal empty states; Scheduled filter-empty copy ignored status/scope filters; disabled Settings rows still highlighted through a high-specificity rule; file/name dialogs closed before required-value validation; several destructive Settings confirmations retained accent tone; Mission Create asynchronous lookup errors stole focus; localized UI exposed five English-only accessible names; and the native-menu retry path did not isolate late readiness events by window generation.
- The shared App Dialog now owns required input validation, inline error semantics, focus retention, and destructive action tone. File operations plus all project/Mission/Task/Chat naming paths use that contract. Skill, Model Context Protocol (MCP), and Expert Squad destructive confirmations use danger tone.
- Scheduled list-load errors are source-tagged and remain mutually exclusive even when project/provider initialization also fails; create/save errors retain the user's form. Its filtered-empty state accounts for search, status, and scope and exposes one clear-filters action. Archive and Expert Squad Evolution first-load errors are mutually exclusive and retryable, while refresh failures may preserve existing content.
- Mission Create lookup failures now announce without moving focus. App shell separators, loading state, author region, and Tools panel accessible names use the current locale.
- Native-menu readiness/failure events carry the child-window generation and only settle the matching parent attempt. The CSS token checker now validates both real document entry graphs, canonical token authority, acyclic global dependencies, and an explicit token-to-assignment-owner map; its output explicitly excludes selector-inheritance proof. `LinkButton` is the single semantic anchor primitive for button-styled external navigation.
- Final independent read-only reviews of design-system, visual/information-architecture, and interaction/accessibility changes each reported no remaining valid finding. No reviewer modified files or ran UI automation.

### Final verification and visual evidence

- `bun run typecheck`: pass.
- `bun run check:i18n`: pass, two locales and 1,832 keys.
- `bun run check:css-tokens`: pass, 8,546 references across two document entry graphs; 284 canonical global tokens form an acyclic dependency graph.
- `bun run build`: pass, 7,107 modules transformed and current production assets emitted.
- `git diff --check`: pass.
- Light Mission error/current-navigation evidence remains [`2026-08-12-overlay-ui-ux-mission-error-fixed.png`](../../artifacts/2026-08-12-overlay-ui-ux-mission-error-fixed.png). The same real click journey in dark theme preserves one selected navigation row, one error state, legible controls, and no contradictory empty claim: [`2026-08-12-overlay-ui-ux-mission-error-fixed-dark.png`](../../artifacts/2026-08-12-overlay-ui-ux-mission-error-fixed-dark.png).
- The latest production build was reloaded and the Mission journey repeated: [`2026-08-12-overlay-ui-ux-mission-error-fixed-final.png`](../../artifacts/2026-08-12-overlay-ui-ux-mission-error-fixed-final.png). Scheduled Automations' compound list/provider/config failure now renders one retryable error surface with no “no tasks,” suggestion, or creation content: [`2026-08-12-overlay-ui-ux-scheduled-error-final.png`](../../artifacts/2026-08-12-overlay-ui-ux-scheduled-error-final.png).
- The in-app Browser used a real 1280 x 720 page served from the isolated current production assets. Screenshots were opened at their rendered dimensions and manually reviewed; no screenshot baseline, pixel assertion, DOM/component test, or UI automation suite was added or run.

### Independent delivery review round 1 and response

The uninvolved reviewer found no P0 and confirmed Mission/Mailbox/navigation/primitive changes were directionally sound. Six valid findings were accepted and repaired:

1. Scheduled save was outside the action mutex. Save and every other mutation now share one identity-owned `AutomationMutationOwner`; all state-changing controls read that owner, and `finally` only clears its own request.
2. Native menu readiness could wait forever. Creation and child readiness now have a 5-second bounded contract, destroyed/error signals reject the active owner, failed windows are destroyed, and promise ownership is cleared for a fresh attempt. A focused positive non-UI test covers success and the typed timeout contract.
3. Scheduled screenshot and build predated the final height fix. Production build and the real-page screenshot above were regenerated after the final CSS.
4. The spec/artifacts are ignored by the repository-wide `/specs/` rule. Delivery explicitly force-adds only this record and its linked artifacts; unrelated records remain untouched.
5. The first CSS checker accepted any declaration as global authority. The checker now validates each document entry graph, requires design-token namespaces to resolve from `styles/tokens` or `styles/cascade`, validates host-runtime assignment owners, distinguishes Kobalte-owned runtime variables, and checks the canonical dependency graph for cycles.
6. Mission Create showed required errors before interaction. Content validation now appears only after a content submission attempt, while unavailable project/context prerequisites keep the action disabled and visible as neutral status.

The final local checks and a second independent read-only review are recorded after their latest-source rerun; older check counts above are historical evidence, not final acceptance.

### Latest-source verification

- `bun run typecheck`: pass.
- `bun run check:i18n`: pass, 2 locales and 1,832 top-level keys.
- `bun run check:css-tokens`: pass, 8,546 references across both document entry graphs and 284 canonical global tokens with an acyclic dependency graph.
- `bun test test/native-menu-surface-contract.test.ts test/overlay-size-contract.test.ts`: pass, 3 positive contract assertions.
- `bun run build`: pass after the final TSX/CSS changes, 7,107 modules transformed and production assets emitted.
- root `bun run docs:check`: pass, 338 operations and 25 groups.
- `git diff --check`: pass.
- No UI automation test, browser fixture, screenshot baseline, or pixel assertion was added, changed, or run.
