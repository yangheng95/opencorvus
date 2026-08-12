# Startup Surface Visual Redesign

## Recall

| Item | Recorded authority |
| --- | --- |
| User request | “把开屏页做成这个风格”，with a supplied reference showing a quiet dark full-screen composition, a centered character/brand focal point, a large preparation heading, explanatory copy, a wide thin progress track, and one small current-stage label. |
| Acceptance metrics | The real desktop startup document preserves the existing native progress/failure/retry contract while visibly matching the reference hierarchy and spacing at the desktop acceptance viewport. The current OpenCorvus bird remains the sole brand mark. Loading and failure states are both manually reviewed from the real built page. |
| Hard constraints | Read current code, history, architecture, and prior audit evidence before editing. Do not add, modify, or run User Interface (UI) automation. Validate through production build plus real-page screenshots and manual inspection. Preserve unrelated dirty-worktree changes. Commit only this task and push only if the complete outgoing commit set is safe. |
| Read material | `AGENTS.md`; `packages/overlay/src/index.html`; the startup handoff in `packages/overlay/src/main.tsx`; native `StartupProgress` production and event flow in `packages/overlay/src-tauri/src/main.rs`; Overlay palette, typography, base-shell and Button styles; `packages/overlay/vite.config.ts`; `packages/overlay/package.json`; `specs/current/architecture/**` search results; and the prior `2026-08-12-overlay-ui-ux-continuous-audit.md` startup findings. |
| Repository search | The startup document and all of its loading/failure markup and behavior have one owner: `packages/overlay/src/index.html`. Solid waits on `window.__opencorvusStartupReady`, removes the static child, and mounts into the same host. Native Rust emits real `extracting`, `starting`, `ready`, and `failed` payloads with actual byte totals and optional diagnostic-log path. The light/dark bird SVGs are the existing brand assets. No separate startup component or same-semantic implementation was found. |
| Independent agent feedback | None before implementation. The mandatory uninvolved read-only delivery review is recorded below after first-pass verification. |

## Analysis

### Observable phenomenon

The current page is a generic compact loading placeholder: a 52-pixel bordered logo tile, one small mutable status line, a 320-pixel progress bar, and a percentage. It does not reproduce the reference's deliberate full-screen composition, large central visual, primary/secondary text hierarchy, or long horizontal progress rhythm.

### Direct trigger

The inline startup CSS and markup in `packages/overlay/src/index.html` define the entire pre-application surface. They deliberately keep the footprint compact and use the native phase message as the only title.

### Data and control-flow root cause

The native data path is not the defect. `StartupProgress` already carries the real phase, completed bytes, total bytes, user-visible message, and diagnostic-log path; `index.html` maps these to progress/failure state; `main.tsx` waits for the ready Promise before replacing this document child. The missing layer is presentation: the current markup has no stable title/description hierarchy or visual stage capable of expressing the supplied direction.

### Why the old path did not resolve it

The 2026-08-12 audit correctly converged theme ownership, failure semantics, accessible busy/alert state, real retry behavior, and canonical primitives. It intentionally retained the earlier compact composition. Theme and contract correctness therefore did not address this new visual-direction request.

### Impact surface

- Definitions: startup markup, inline CSS, and its document-local update/retry behavior in `packages/overlay/src/index.html`.
- Callers/contracts: native Rust event payload and Solid mount handoff are read-only and remain unchanged.
- Public behavior: loading, extraction/starting messages, percent completion, ready handoff, failure alert, Retry, View log, reduced motion, and light/dark/vscode-dark theme selection remain supported.
- Assets: reuse the two current bird SVGs; no generated mascot, duplicate logo, external fetch, or new image source.
- Tests: UI automation is excluded by repository policy. Focused positive evidence is production build output and real-page manual visual review of loading and failure states.
- Documentation/delivery: this record and both `specs` indexes are updated. A narrow commit will be created after independent review.
- Risk: the inline document loads before the application, so styles must rely only on already-linked canonical tokens and static assets. Failure must not hide the actual diagnostic message. Unknown: native WebView startup timing cannot be made deterministic in an isolated browser; exact native event production remains evidenced by the existing Rust owner and build, while the document states are inspected through the existing acceptance query.

## Implementation plan

1. Replace the compact logo tile with a larger atmospheric brand stage built around the current theme-specific bird SVG.
2. Add a stable preparation heading and explanatory sentence, then project native phase messages into a subordinate live-status row.
3. Expand the progress track to the reference's wide, thin proportion. Represent pre-measurement progress as indeterminate; once a native byte total exists, render the truthful percentage.
4. Preserve one failure surface with the exact native diagnostic, Retry, and View log actions; reset all visual and accessible state together on Retry.
5. Build the current source, serve the production assets in isolation, capture loading and failure states at a desktop viewport, inspect them manually, and iterate on visible issues.
6. Obtain an uninvolved read-only review of source, full task diff, verification evidence, documentation, and regression risk. Repair every valid finding and repeat review if needed.

## Verification record

- `bun run check:css-tokens`: pass; 8,608 references across both document entry graphs, 284 canonical global tokens, and an acyclic dependency graph.
- `bun run typecheck`: pass (`tsc --noEmit`).
- `bun run build`: pass on the latest source; Vite transformed 7,107 modules and emitted the production `dist-vite` page. Existing third-party `use client` and large-chunk warnings remain non-blocking and are unrelated to this startup-only change.
- Root `bun run docs:check`: pass; 338 operations and 25 groups.
- `git diff --check`: pass before visual acceptance; it is rerun after final documentation updates.
- Real production-page acceptance used an isolated Python static server on `127.0.0.1:4173` and the in-app Browser at 1280 x 720. No UI automation test, browser fixture, screenshot baseline, pixel assertion, or component/Document Object Model test was added, modified, or run.
- Dark loading evidence: [`2026-08-12-startup-surface-dark-loading.png`](../../artifacts/2026-08-12-startup-surface-dark-loading.png). Manual inspection confirmed the reference-aligned center axis, prominent brand stage, heading/description hierarchy, wide progress track, no redundant unknown-percent label, and exact 1280 x 720 document bounds with no scroll or clipping.
- Dark failure evidence: [`2026-08-12-startup-surface-dark-failure.png`](../../artifacts/2026-08-12-startup-surface-dark-failure.png). Manual inspection and live state read confirmed `data-failed=true`, `aria-busy=false`, one alert status, visible Retry/View log actions, hidden progress, and exact viewport bounds.
- Light loading evidence: [`2026-08-12-startup-surface-light-loading.png`](../../artifacts/2026-08-12-startup-surface-light-loading.png). Manual inspection confirmed the same hierarchy with the existing light-theme bird asset, canonical light palette, visible progress, and no clipping.
- The first visual pass exposed a redundant right-side `Starting…` label while total bytes were unknown. The latest source hides the detail until the native payload supplies a real total, was rebuilt, reloaded, and recaptured before the three artifacts above were saved.

## Independent delivery review

The uninvolved read-only reviewer found no implementation, visual, theme, progress, failure/retry, accessibility, reduced-motion, or single-owner regression. Four delivery findings were accepted:

1. The new record and three screenshots are ignored by the repository-wide `/specs/` rule and must be force-added by exact path so the new index links do not ship broken.
2. `origin/main..HEAD` already contains fourteen unrelated outgoing commits at the delivery checkpoint. Their authorization, verification, and independent-review state is not established by this task, so automatic push is blocked and must be reported instead of merging, rebasing, force-pushing, or silently publishing them.
3. Both existing spec indexes also contain another task's database wording edits. Only this task's new top-level index blocks may be staged through an exact patch.
4. The required root documentation check had passed but was missing from this verification record; its exact result is now recorded above.

The main agent verified all four against Git/status/check output and applied the documentation correction. Exact force-add, patch staging, staged-diff inspection, and the second independent read-only review are complete. The second review found two record-accuracy issues—the outgoing count and a premature completion claim—which were corrected before a third read-only review. The third review reported no findings.

## Delivery record

Exact staging is complete: the cached diff contains only the startup document, this record, the two task-owned index blocks, and the three visual artifacts. The unrelated database wording remains unstaged. The task commit is created immediately after this record snapshot; its exact hash is reported in the final delivery instead of being predicted here.
