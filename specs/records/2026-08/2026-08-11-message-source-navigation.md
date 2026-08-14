# Message Source Navigation Repair

Status: complete.

## Recall

| Item | Evidence and decision |
| --- | --- |
| User request | Clicking a reference in the message panel must open the referenced target instead of producing an empty file. A file reference must open the real file and highlight its target line or line range; a URL reference must open the website; other reference kinds should follow their typed target semantics. |
| Supplied evidence | The screenshot shows persisted `opencorvus-read` source chips such as `tests\\runtime\\test_cuda_fail_closed.py:1-85`. Their visible line suffix comes from the structured file-source range. |
| Acceptance metrics | A real source-file chip opens the existing project file in the File Workbench, selects and scrolls to the persisted one-based line range, and never passes the displayed `:start-end` suffix as part of the path. A source-URL chip continues through the single browser-preview URL path. Reopening the same file with a different range updates the selection. |
| Hard constraints | Preserve the typed `source-file.path` plus `source-file.range` contract; retain one File Workbench navigation source; do not add fallback paths, synthesized messages, or UI automation tests; validate the real page with interaction, screenshot, and manual visual inspection. |
| Materials read | `AGENTS.md`; `specs/README.md`; `specs/records/2026-08/README.md`; `packages/opencorvus/src/session/message.ts`; `packages/opencorvus/src/tool/source.ts`; `packages/opencorvus/src/tool/read.ts`; `packages/overlay/src/components/{CardParts,SourceParts,FileEditorPane}.tsx`; `packages/overlay/src/components/ui/CodeEditor.tsx`; `packages/overlay/src/services/file-workbench.ts`; related package scripts and history. |
| Whole-repository search | `source-file` has one current persisted contract: a path plus optional positive inclusive `{startLine,endLine}`. `opencorvus-read` emits absolute paths and the exact read page range. `SourceParts` is the only source-chip renderer; its URL branch already uses `data-browser-preview-url`, while its file branch drops `range` before calling `openFileEditor`. `FileEditorTarget` carries only directory/path, and `CodeEditor` has no target-selection input. `source-document` has metadata but no navigable URL or path and therefore remains informational. |
| Independent agent feedback | The first post-implementation read-only review found two valid gaps: exact repeated citations did not reveal again, and an absolute source outside the active directory was still coerced into a project-relative path. The second review confirmed those fixes and found one API-description mismatch: `/file/source-content` did not name its real `FileInvalidPathError` and `FileNotFoundError` responses. All three findings were fixed; the final third review reported no unresolved findings. |

## Problem-depth and impact analysis

### Observable phenomenon

File source chips correctly display the persisted path and inclusive read range, but activating one does not focus the cited lines. The reported result is an empty-file editor surface rather than the cited content at its location.

### Direct trigger

`SourceParts.openSourceFile` computed a project-relative path and called `openFileEditor(path, {directory})` without the source's structured `range`. When the absolute source was outside that directory it also used the absolute path as a project-relative fallback. The UI therefore lost the typed location and could address the wrong filesystem target.

### Data and control-flow root cause

The backend already creates the correct data: `read` calls `fileSource` with the canonical absolute path and `{startLine,endLine}`. Session persistence and the generated SDK preserve both fields. `SourceParts` displayed both fields, but `FileEditorTarget` stored only directory/path; `FileEditorPane` consequently could not pass a location to CodeEditor. In addition, the generic workbench path normalizer strips POSIX root separators and turns a Windows absolute path into a string later joined under `Instance.directory`. The absolute resource identity and its location were both lost at the first Overlay navigation boundary.

### Why the old path did not root-fix it

The original source-chip implementation established type-specific rendering and file opening but treated the File Workbench target as a file identity only. The display layer knew the range independently, so the chip looked correct even though navigation discarded it. Stripping a rendered `:line-range` suffix or changing path normalization would not restore the missing location data and would duplicate the typed source contract as string parsing.

### Definitions, calls, shared contracts, data, tests, documentation, delivery, and risks

- Definitions and calls: extend the current File Workbench navigation target with one optional inclusive line range and an explicit read-only absolute-source identity; pass the existing `source.range` into it; project it into CodeMirror selection and scroll behavior. File Explorer callers remain project-relative and writable.
- Shared contract: the backend/session/SDK source schema does not change. The Overlay consumes the existing typed fields directly. URL references retain the existing HTTP(S) browser-preview route. `source-document` is excluded because its contract contains no navigation target.
- Data and persistence: selection is ephemeral view state and must not be written back to the file or session.
- Positive tests: add focused non-UI tests showing that a valid range is retained, a new range becomes current, repeated exact navigation increments the reveal revision, an external absolute source remains exact, and the server reads that exact absolute source. No UI automation is added or run.
- UI acceptance: start the real Overlay, activate a real persisted file-source chip, inspect the loaded file and selected line range, capture a screenshot, and verify the URL branch from a real source URL when available. A console/build check is supporting evidence only.
- Documentation: this record plus the two existing spec indexes are the documentation changes.
- Delivery: focused test, Overlay typecheck/build, real-page validation, independent read-only review, scoped commit, and safe upstream push after checking the complete outgoing commit set.
- Risks: programmatic selection can fight normal editing if reapplied on draft updates, so it changes only for an explicit navigation reveal. Absolute external sources are intentionally read-only in the workbench and use a dedicated source-content route; they are not re-scoped as projects and cannot enter the write endpoint. Ranges beyond the current document are clamped to available lines without inventing another navigation path.

## Implementation plan

1. Carry the existing source range through `SourceParts` and the single File Workbench target, including same-file/different-range and repeated exact reveal identity.
2. Preserve directory-external absolute sources as read-only exact targets through one dedicated server read contract.
3. Apply the target range once per navigation reveal in CodeMirror, selecting the inclusive lines and scrolling the start into view.
4. Add and run focused positive non-UI workbench and server tests, then run type, route, documentation, and build checks.
5. Use the real Overlay for source-file interaction, capture a screenshot, and manually inspect the result without UI automation; verify URL behavior from its existing typed contract when no real URL source is present.
6. Request independent read-only review of the complete diff and evidence; fix every valid finding and repeat affected verification until no findings remain.

## Evidence ledger

- Pre-fix code: `SourceParts.openSourceFile` drops `source.range`; `FileEditorTarget` and `CodeEditorProps` have no location field.
- Focused Overlay state tests: 3 passed, 0 failed, covering line-range updates, repeated reveal revision, exact external absolute target, and existing workbench revision behavior.
- Focused server test: 1 passed, 0 failed; `File.readSource` returned the exact external file content.
- Static checks: targeted Biome check passed; OpenCorvus TypeScript check passed; API route inventory passed; API documentation check passed; generated Software Development Kit (SDK) and OpenAPI artifacts were regenerated.
- Overlay production build: passed with 7,100 modules transformed. Full Overlay typecheck is currently blocked by an unrelated concurrent `MissionCreateDialogProps.productPillar` mismatch; the same source tree still completed the Vite production build.
- Real-page visual evidence: clicking the persisted `tests\\runtime\\test_cuda_fail_closed.py:1-85` chip opened the real file, visibly selected lines 1–85, focused CodeMirror, and produced `specs/artifacts/2026-08-11-message-source-navigation.png`. A fresh isolated-current-UI pass then switched the right dock from `File` to `Squad agents` (`aria-selected=true`), clicked the exact same persisted chip, and observed `File` become selected again (`aria-selected=true`) with three fresh CodeMirror selection rectangles spanning the cited range; `specs/artifacts/2026-08-11-message-source-navigation-repeat.png` records the reactivated File tab and highlighted file. No persisted source-URL row exists, so URL validation is limited to the unchanged HTTP(S) anchor/browser-preview contract. No real external-absolute source chip exists in the current session, so that UI state is not claimed as visually covered.
- Real server checker: an isolated current-code server returned the exact text of `C:\\Users\\hengu\\.codex\\skills\\.system\\imagegen\\SKILL.md` through `/file/source-content` while the active project directory was `D:\\myhexin-local\\opencorvus`, proving that the absolute path was not joined under the project.
- API error contract: `/file/source-content` now declares query validation plus `FileInvalidPathError` at 400 and `FileNotFoundError` at 404; OpenAPI, generated SDK, and English/Chinese API documentation were regenerated. The focused backend typecheck, route inventory, and documentation checks passed afterward.
- Independent review: first review found the repeated-reveal and external-absolute gaps; second review confirmed those repairs and found the API error-contract mismatch. All findings were repaired; the final third read-only review reported no unresolved findings.
