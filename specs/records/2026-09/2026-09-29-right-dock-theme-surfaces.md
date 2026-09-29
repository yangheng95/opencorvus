# Right Dock theme surface consistency

## Recall

- User: `右侧dock的面板颜色不跟随主题，系统性修复这个bug`; clarification: `包括files包括brower颜色都不自然，不是完全不对`. Acceptance is coherent theme surfaces across Dock tools, not merely changing a theme identifier.
- Preserve layout and interactions. Use the existing theme palette and primitives, one implementation, no UI automated tests, no model calls, no user process/window manipulation. Work on current main, preserve concurrent changes, commit only this task and merge upstream before normal push.
- Read AGENTS.md, panel architecture Color Themes and material contracts, the September 22 theme record, theme service/registry/bootstrap/native menu, App/RightDock/main mounts, file editor/CodeMirror, browser, files, review, screenshot and task-scope surfaces. Repository searches covered theme writes/selectors, palette definitions, `inspector-surface`, Dock wrappers, shared surface consumers and historical theme decisions. No delegation.
- Real isolated source service at `/ui/`, own empty runtime and sample Git project, frozen private renderer output. Manual browser review at 1600×960 (the default tool viewport clips the app's minimum desktop width). Files and Browser checked in Dark and Ivory; file editor loaded real sample.ts. No credentials or synthetic conversation messages.
- Completion: common Dock canvas and toolbar color roles; all seven named palettes remain complete; theme changes and lazy tab mounts stay coherent; actual Files/Browser/editor and secondary panel screenshots; supporting CSS/build/type/docs checks; scoped commit/push.

## Analysis

1. Observable: switching Dark to Ivory updates root variables and Files correctly, but the Files panel shows the translucent ambient glass while Browser covers that glass with opaque `surface` and `surface-inset`. The editor introduces another large inset rectangle and strong header. User confirmed the issue is these unnatural relationships, not a total failure to update.
2. Trigger/data flow: `applyTheme` writes `html[data-theme]`; palettes inherit correctly. `App` assigns `oc-material-glass` to the right Dock. Transparent file and empty review panels reveal this material; browser stage/new-tab, editor and populated review separately choose different page-sized backgrounds. These competing surface roles create inconsistent results for the same theme.
3. Old path: palette completeness and shared glass alone do not define tool-content hierarchy. `--inspector-surface` is transparent for six themes and opaque only for VS Code Dark, so task-scope tools also change material semantics by theme. The retired Inspector token has only palette definitions and four task-scope CSS consumers; replace those consumers with the existing content canvas and remove the token in every palette.
4. Related defect: dark list interaction overrides still select `body[data-theme]`, although all production writers own the attribute on `html`; Graphite is also omitted. Correct the selector at its existing body token scope and update obsolete comments. Do not add a parallel theme state or observers.
5. Scope: right Dock base, Browser chrome/empty/native host surface, Files inherited canvas, editor/header/gutter, Review panes, task-scope canvas/toolbar, existing selected/hover washes. Existing `--chat-canvas` is the shared reading/editing canvas. Controls retain inset fill, cards retain surface fill, statuses retain semantic colors. Browser web content and captured screenshots keep their authored pixels. No provider, API, configuration, persistence, task lifecycle, queue or recovery behavior changes.
6. Risks: flattening large surfaces can weaken boundaries, so retain divider tokens and selected/hover feedback; inspect Dark, VS Code Dark, Graphite and all four light variants. Native guest webview rendering itself cannot be claimed from a web preview. Concurrent dirty files include App and architecture/indexes; preserve and stage only our hunks.

## Plan

1. Give Dock the existing opaque content canvas; remove its glass assignment. Align page-sized child surfaces with that canvas and use transparent toolbars over it. Delete the retired Inspector palette token. Correct the dark interaction selector for the actual root owner and all dark palettes.
2. Update the panel surface contract and indexes. Build to a private static directory served by the source backend; manually inspect real panel/theme transitions and save representative screenshots.
3. Run CSS token check, overlay typecheck/build and repository docs checks. Review scoped diff, commit, fetch/merge upstream, inspect pending commits and push.

## Reference

[MDN custom properties](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Cascading_variables/Using_custom_properties) documents inherited custom properties and a shared root definition; existing root palette ownership remains authoritative.

## Execution

- Implemented the shared `--chat-canvas` role in Dock, Browser, editor, Review panes and task-scope surfaces. Removed the Dock's glass class and the obsolete Inspector token from all seven palettes. Kept control/card/status colors and existing geometry. Corrected the inherited dark list washes for Dark, VS Code Dark and Graphite Violet.
- `bun run --cwd packages/overlay check:css-tokens` passed: 8571 references, 267 global tokens, both renderer documents. `bun run --cwd packages/overlay typecheck` passed. The Vite production build to `.tmp/dock-theme-repair/ui-after` passed in 1m15s, with existing dependency directive and large chunk warnings. This private build was served by the source backend, not a standalone Vite server.
- `bun run docs:check` passed (342 operations, 25 groups); `bun run check:architecture-index` passed (17 current documents). No UI automated tests created or run.
- [Manual screenshots](../../artifacts/2026-09-29-right-dock-theme/README.md) show Dark/Ivory Browser before and after, Ivory/Sage Files, Mist/Graphite mounted editor, VS Code Dark Requirements, Light Goals/Screenshots and System/Dark Review. Before Files exposed ambient glass and Browser had a different solid fill; after both inherit the conversation canvas while controls remain distinct. Read-only computed style observations confirmed Ivory Dock `rgb(252,250,245)` equals its `#fcfaf5` palette canvas, Graphite editor `rgb(33,29,39)` and the corrected 9% dark hover wash.
- Visual scope limits: secondary task-scope, screenshot and Review panels contain truthful empty states in this no-model isolated conversation. Populated change sets/task-scope content and native guest webview pixels are not claimed as visually verified. The primary reported Files/Browser chrome and actual file editor were reviewed. No user application or process was changed.
- Final scoped diff whitespace checks passed. The isolated page was closed, viewport override reset and owned preview service stopped. Delivery stages only this task's CSS, Dock class, architecture paragraph, indexes and evidence, preserving concurrent workspace changes.
