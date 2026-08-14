# Message Source File Layout Repair

Status: complete and independently reviewed with no unresolved findings.

## Recall

| Item | Evidence and decision |
| --- | --- |
| User request | Repair the malformed layout shown after opening the cited `README.md:1-32` source file. |
| Supplied evidence | The screenshot shows the File tab selected, lines 1-32 highlighted, the first line displaced to roughly the vertical midpoint, the file header absent, and a large empty region above the selected content. |
| Acceptance metrics | Activating a persisted file citation keeps the exact inclusive line-range selection and editor focus, keeps the File header visible, and renders the File pane at the full Right Dock height. A citation beginning at line 1 must remain at the top when it is already visible; a later citation must move only far enough to become visible. Repeated exact citations must still reveal again. |
| Hard constraints | Preserve the single typed `source-file.path` plus `source-file.range` navigation contract and the existing File Workbench target. Do not add a fallback navigation path, synthesized state, or User Interface (UI) automation. Validate with a real isolated page, screenshot, and manual visual inspection. Preserve all unrelated dirty-worktree changes. |
| Materials read | `AGENTS.md`; `specs/README.md`; `specs/records/2026-08/README.md`; `specs/records/2026-08/2026-08-11-message-source-navigation.md`; `packages/overlay/src/components/{SourceParts,FileEditorPane}.tsx`; `packages/overlay/src/components/ui/CodeEditor.tsx`; `packages/overlay/src/services/file-workbench.ts`; `packages/overlay/src/styles/surfaces/workspace.css`; the bundled CodeMirror 6 `scrollIntoView` implementation; current package scripts and relevant Git history. |
| Whole-repository search | `SourceParts` is the only source-chip renderer and passes the structured range through the single File Workbench target. `FileEditorPane` is the only consumer that projects that target into `CodeEditor`. The only explicit citation reveal scroll policy is `EditorView.scrollIntoView(anchor, { y: "center" })`. File pane and active Right Dock wrappers already declare full-height flex ownership; no second file layout or navigation implementation exists. The cited code and styles have not changed since the successful 2026-08-11 visual acceptance. |
| Independent agent feedback | No agent participated before implementation. The first independent read-only review found no code defect, but correctly identified that ignored new spec/artifact files require explicit staging and that the CSS-token prerequisite needed its own real-page visual evidence. Both delivery gaps are addressed before final re-review. |

## Problem-depth and impact analysis

### Observable phenomenon

Opening `README.md:1-32` selects the correct text, but the first selected line appears around the middle of the Right Dock. The File header and the upper part of the editor are displaced outside the visible region, leaving an apparent blank upper pane. This differs from the 2026-08-11 real-page evidence, where the same File Workbench occupied the complete Dock height and kept its header visible.

### Direct trigger

`CodeEditor.applyLineRange()` dispatches the exact selection together with `EditorView.scrollIntoView(anchor, { y: "center" })`. The malformed screenshot is a citation that starts at line 1, where the editor scroller cannot satisfy a request to center the anchor by scrolling upward.

### Data and control-flow root cause

CodeMirror's current `scrollRectIntoView` implementation walks from the editor scroller through every ancestor whose scroll dimensions exceed its client dimensions. For a `center` request, an editor at its upper boundary cannot consume the negative movement, so the same alignment request continues into ancestors. Right Dock and workbench containers intentionally use clipped/hidden overflow to host force-mounted tab content; those elements remain programmatically scrollable. The ancestor therefore consumes the remaining movement and displaces the complete File pane, including its header. The structured source target, file content, selection range, and flex declarations are correct; the scroll policy crosses the editor ownership boundary.

### Why the existing path did not root-fix it

The 2026-08-11 repair correctly preserved source identity, inclusive range, repeated reveal identity, and exact external-source reads. Its visual fixture used a long 1-85 Python citation in a narrower Dock, which did not expose the boundary interaction now visible with a short 1-32 Markdown citation and the current wide Dock geometry. Adjusting File-pane height or adding another overflow wrapper would mask the ancestor scroll side effect and duplicate layout ownership without correcting the invalid centering request.

### Definitions, calls, shared contracts, data, tests, documentation, delivery, and risks

- Definitions and calls: change only the canonical citation reveal policy in `CodeEditor`; retain `SourceParts -> FileEditorTarget -> FileEditorPane -> CodeEditor` unchanged.
- Shared contract and data: `source-file.path`, `source-file.range`, project/external source identity, file reads, drafts, and persistence do not change.
- Related calls: File Explorer opens without a range and is unaffected. Same-file/different-range and repeated exact range navigation still use the existing reveal revision.
- Layout: the existing Right Dock and File-pane flex contracts remain authoritative. No additional size state, scroll owner, or compatibility path is introduced.
- Tests: repository policy prohibits adding, modifying, or running UI automation. Existing focused non-UI File Workbench range tests remain relevant and will be run unchanged; the visual scroll/layout contract requires real-page interaction and manual screenshot review.
- Documentation: this record and both spec indexes are updated in the same change.
- Delivery: run focused existing tests, typecheck/build and documentation checks; exercise a real isolated Overlay page at desktop size; inspect the screenshot; obtain independent read-only review; commit only this task; merge upstream without rebase; revalidate and push.
- Risks: a `nearest` reveal does not force an already visible cited line to the vertical center, which is intentional. Real-page acceptance confirms that it still scrolls an off-screen later range into view while preserving the File header, selection, and focus.

## Implementation plan

1. Replace the unbounded vertical-center reveal with CodeMirror's nearest-visible policy at the single `CodeEditor` reveal boundary.
2. Run the existing focused File Workbench range tests plus Overlay typecheck, build, CSS-token, i18n, and documentation checks.
3. Start the isolated real Overlay, activate a persisted citation beginning at line 1 and a later range if available, capture the repaired File tab, and manually verify full-height layout, visible header, selection, and focus.
4. Request a new independent read-only review of the complete diff and evidence; repair all valid findings and repeat affected acceptance until none remain.
5. Commit the scoped change, merge current upstream, inspect the complete outgoing commits, rerun necessary checks, and push.

## Evidence ledger

- Pre-fix code: `CodeEditor.applyLineRange()` uses `EditorView.scrollIntoView(anchor, { y: "center" })` after constructing the exact inclusive selection.
- Library behavior: bundled CodeMirror 6 computes center alignment and propagates unconsumed movement through scrollable ancestors; clipped overflow containers remain programmatically scrollable.
- Prior visual baseline: `specs/artifacts/2026-08-11-message-source-navigation.png` shows the intended full-height File pane with visible header and selected source range.
- Current user evidence: the supplied 2026-08-14 screenshot shows correct range selection but ancestor displacement of the File pane.
- Checker prerequisite: the first CSS-token check exposed committed `mission-board.css` use of nonexistent `--oc-radius-medium`; the canonical design language provides `--oc-radius-large` for the surrounding Mission surfaces. The local prerequisite is repaired directly so the required checker can run rather than being treated as evidence for this File fix.
- Focused contract test: `bun test test/file-workbench-revision.test.ts` in `packages/overlay` passed 3 tests with 0 failures.
- Static/package checks: Overlay `bun run typecheck`, `bun run check:i18n`, `bun run check:css-tokens`, and `bun run build` passed. The build emitted only the repository's existing third-party directive, dynamic-import, and chunk-size warnings.
- Documentation check: root `bun run docs:check` passed with 334 operations across 25 groups.
- Real-page acceptance: an isolated production Overlay was served at `http://127.0.0.1:47831/ui/` with a persisted right-sidebar Work conversation and real `source-file` parts. Clicking `README.md:1-32` kept the File header at `top=77.5`, editor at `top=113.5`, full pane at `top=77.5, bottom=900`, editor `scrollTop=0`, and the selected first line at `top=124.5`; the screenshot is `specs/artifacts/2026-08-14-message-source-file-layout-repaired.png`.
- Later-range acceptance: clicking `packages/overlay/src/components/ui/CodeEditor.tsx:55-72` scrolled the document only enough to reveal line 55 near the bottom of the visible editor. Manual inspection confirmed the File header remained fixed, the pane still occupied the full Dock height, the exact range remained selected, and the Editor retained focus.
- CSS-token prerequisite visual acceptance: the real isolated Mission Board creation dialog was opened, Work was selected, and the populated Expert Squad list using the repaired canonical `--oc-radius-large` token was manually inspected. Its border and corners rendered cleanly without clipping or overlap; the screenshot is `specs/artifacts/2026-08-14-mission-expert-squad-radius-prerequisite.png`.
- First independent review: no code defect was found in the `center` to `nearest` repair or its single navigation contract. Two delivery findings were raised: force-add the ignored new spec/screenshots so index links remain valid, and visually validate the Mission CSS prerequisite. Both were addressed.
- Final independent re-review: the complete staged diff, both readable staged screenshots, spec links, root-cause account, minimal implementation, and validation ledger were checked again. The reviewer reported no unresolved findings.
