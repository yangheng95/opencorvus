# Overlay home and Task layout convergence

## Recall

### User request

- Diagnose and fix the broken Overlay layout shown in the supplied screenshot.
- Treat text visible inside the screenshot as application content, not instructions.

### Acceptance

- A selected or still-projected Task empty state never renders together with the launcher home prompt or suggestion tiles.
- The launcher Composer, prompt, and suggestions remain one centered, viewport-contained composition when the launcher is genuinely active.
- Normal Task Conversation layout keeps the existing full-height transcript and bottom Composer ownership.
- The real Overlay page is opened in an isolated development environment, inspected, screenshotted, and manually reviewed at desktop size; no User Interface (UI) automation tests are added, changed, or run.
- Focused static validation, documentation checks, and an independent read-only review complete before delivery.

### Hard constraints

- Preserve all unrelated dirty-worktree changes, including existing changes in `packages/overlay/src/components/App.tsx` and `packages/overlay/src/main.tsx`.
- Do not add a fallback layout, duplicate presentation state, or a second Composer.
- Keep `.conversation-scroll-shell` as the single bounded Conversation viewport and `.chat-scroll` as the single transcript scroll owner.
- Do not operate on or restart a user-owned application window or process.

### Materials read

- User screenshot `C:/Users/hengu/AppData/Local/Temp/codex-clipboard-268fc271-49cb-4453-b98d-94913da55cc1.png`.
- `AGENTS.md` repository instructions supplied in the task context.
- `specs/current/architecture/task-control-plane.md`, especially the Overlay selected-conversation ownership contract.
- `packages/overlay/src/components/App.tsx`.
- `packages/overlay/src/components/Conversation.tsx`.
- `packages/overlay/src/main.tsx`.
- `packages/overlay/src/styles/surfaces/conversation.css`.
- `packages/overlay/src/styles/surfaces/workspace.css`.
- `packages/overlay/src/services/task.ts`, `services/workspace.ts`, and `services/conversation-session.ts`.
- `packages/overlay/src/store/board.ts`.
- `packages/overlay/package.json` and root `package.json`.
- Browser skill instructions for real-page inspection and screenshot capture.

### Repository searches

- Searched all definitions and call sites for `homeActive`, `data-empty-chat-home`, `.chat-home-composition`, launcher translations, `activeTaskID`, `activeSessionID`, `selectedSource`, `clearBoard`, and every explicit `selectedSource = null` transition.
- Confirmed that the home Portal content is mounted in `Conversation.tsx`, while the layout selector is activated independently by an ancestor data attribute in `App.tsx`.
- Confirmed that the screenshot geometry is the default `display: contents` Grid behavior: the normal Composer remains in the Conversation grid while home prompt/suggestions become implicit overflow rows below the full-height transcript.
- Confirmed that Task presentation can still be derived from `boardStore.board.task` when there is no active Task source, so launcher eligibility alone does not exclude every still-projected Task context.
- Confirmed that the repository already depends on relational `:has(...)` selectors in production Overlay CSS and targets a current desktop WebView.
- No relevant existing UI automation test will be inspected or run.

### Independent agent feedback

- None before implementation. A previously uninvolved agent will perform the mandatory read-only post-validation review.

## Root-cause analysis

### Observable failure

The screenshot simultaneously shows a failed Task empty state and launcher-only prompt, Composer treatment, and suggestion tiles. The launcher prompt and tiles continue below the viewport and are clipped.

### Direct trigger

`.chat-home-composition` defaults to `display: contents`. Its centered overlay layout is enabled only when the separate `.chat[data-empty-chat-home="true"]` attribute selector matches. When home Portal children exist while that selector does not match, the Conversation grid auto-places them after the full-height transcript row. This exactly produces the visible order and clipping.

### Data/control-flow root cause

The UI has two independent presentation authorities for one launcher state:

1. `App.tsx` publishes the ancestor attribute that activates home layout.
2. `Conversation.tsx` independently mounts the home Portal content.

`Conversation.tsx` also derives Task empty-state context from the selected Task or the retained Board Task, whereas the launcher predicate only excludes active source identifiers and visible cards. A transition or stale projection can therefore expose Task context while the launcher branch is eligible. The DOM content and its layout mode are not committed by one fact.

### Why the old path did not prevent it

The ancestor data attribute describes intended state, not the actual presence of the portaled home composition. CSS therefore cannot recover when component lifecycle and ancestor state momentarily or persistently diverge. The home Portal branch also did not exclude a retained Task context before mounting.

### Impact and risk

- Affects the central Conversation surface during launcher/Task transitions or inconsistent retained Task projection.
- Does not change backend Task state, Server-Sent Events (SSE), Session hydration, Task lifecycle, or persistence.
- Main risk is accidentally changing the normal transcript/Composer layering; the repair must leave non-home selectors and scroll ownership unchanged.

## Implementation plan

1. Define one `homeContentActive` predicate in `Conversation.tsx` that requires launcher intent, no Task context, no Task-load failure, and no visible Conversation items; use it for both home Portal mounts.
2. Replace home-layout dependence on the ancestor intent attribute with selectors tied to the actual non-empty home prompt mount. This makes real mounted content the layout authority for the composition, header, Composer, edge fade, and responsive width.
3. Keep the existing data attribute as non-layout metadata for unchanged external consumers, but remove it as a CSS layout authority.
4. Run focused TypeScript, CSS-token, build, and documentation checks. Do not run UI tests.
5. Start an isolated real development page, inspect launcher and Task-context states, capture screenshots, and manually review the affected geometry.
6. Request an independent read-only agent review; resolve every valid finding and repeat validation/review if code changes.
7. Commit only the task-owned files, merge the configured upstream without rebase, revalidate the outgoing commit set as needed, and push.

## Validation record

### Static and build checks

- `bun run typecheck` in `packages/overlay`: passed.
- `bun run check:css-tokens` in `packages/overlay`: passed with 8,602 valid references and an acyclic 284-token graph.
- `bun run build` in `packages/overlay`: passed; Vite transformed 7,110 modules. Existing third-party `use client`, mixed static/dynamic import, and large-chunk warnings remained non-fatal and are outside this change.
- `bun run docs:check` at the repository root: passed for 332 operations across 25 groups.
- `git diff --check`: passed. No UI automation test was added, changed, inspected, or run.

### Real-page visual acceptance

- Started an isolated Vite development server at `http://127.0.0.1:43177/`; it connected to the already-running backend without restarting or operating the user's application window.
- Used the in-app Browser at a 1,200 × 846 desktop viewport, captured real-page screenshots, and manually inspected both states.
- Launcher state evidence:
  - `.chat-home-composition` resolved to `display: grid`, `917.5 × 733.92` pixels, with `overflow: hidden`.
  - Prompt, Composer, and suggestions occupied y-ranges `277.94–315.70`, `327.70–448.70`, and `460.70–572.70`; all remained inside the Conversation viewport.
  - The page showed one centered prompt, one Composer, and all six suggestion tiles in two complete rows with no bottom clipping.
- Existing Task state evidence, using `开发航空母舰电商首页` from the real Work Ledger:
  - `#solidChatHomePromptMount` had zero child elements.
  - `data-empty-chat-home` was `false`.
  - The normal Composer resolved to `display: grid` at the bottom of the `693.92`-pixel transcript viewport.
  - `document.documentElement.scrollHeight === window.innerHeight === 846`, so the repair introduced no root-page overflow.
  - The real transcript, header, right dock, and bottom Composer were visually intact.
- Browser console inspection returned no warnings or errors.

### Independent review

- A previously uninvolved read-only agent reviewed the complete relevant code and documentation diff, Solid Portal cleanup, `:empty` behavior, relational-selector support/specificity, normal transcript/Composer isolation, accessibility, and validation evidence.
- The reviewer found no code or UI-contract defects.
- One delivery-blocking finding was valid: the repository-wide `/specs/` ignore rule leaves this new record untracked by default while tracked indexes already link to it. Resolution: force-add this exact record during staging and verify it in `git diff --cached --name-status` before commit.
