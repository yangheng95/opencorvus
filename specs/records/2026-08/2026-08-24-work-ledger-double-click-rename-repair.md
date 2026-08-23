# Work Ledger double-click rename repair

Status: complete; implementation, real-page verification, and independent review passed

## Recall

### User request

Repair the Work Ledger task list so double-clicking a Mission, Task, or Chat name opens its rename dialog again.

### Acceptance criteria

- Double-clicking the main title button of any Mission, Task, or Chat row opens the existing type-correct rename dialog with the current title prefilled.
- A double-click does not bubble into parent Mission/task drawers or invoke a second action; the row's existing single-click selection remains intact.
- Confirmed rename continues through the existing Mission, Task, or Chat writer and refresh path; cancelling the dialog performs no rename.
- Context/header rename entry points and all row actions retain their existing behavior.
- Overlay type checking and production build pass. Real `/ui/` interaction and manual screenshots verify the available Mission and Task rows; the absent Chat dataset is covered by the same shared component and explicit `chat` branch without creating user-visible test data. No UI automation test is added, changed, or run.
- An uninvolved read-only agent reviews the final diff and evidence, and all valid findings are repaired before delivery.

### Hard constraints

- Reuse the existing `renameWorkLedgerMission`, `renameWorkLedgerTask`, and `renameWorkLedgerChat` callbacks and `runAction` error/busy owner. Do not add a second dialog, API route, rename state, or fallback path.
- Keep the shared `WorkLedgerRowView` as the single interaction implementation for top-level rows and Mission child Tasks.
- Do not modify or stage the concurrent Right Dock navigation/Add-menu work in `App.tsx`, `ConversationAgentRail.tsx`, `RightDock.tsx`, `workspace.css`, or its spec-index lines.
- Preserve unrelated untracked `packages/opencorvus/script/benchmark/` and ``.

### Material read and search evidence

- Read `WorkLedgerRowView`, every production caller of its Mission/Task/Chat rename callbacks, the three dialog/writer functions in `main.tsx`, and the current Work Ledger persistence description in `specs/current/architecture/02-data.md`.
- Whole-repository search found no `onDblClick` on any current Work Ledger row. The only remaining rename entry points are the row callbacks passed from `main.tsx` and the conversation-header menu.
- `git log -S onDblClick` identifies `fcddb8f3` as the regression. Its broad UI primitive convergence commit deleted the complete shared row double-click handler without adding a replacement or documenting a changed interaction contract.
- The parent of `fcddb8f3` shows the exact previous handler: prevent default and propagation, then call `runAction("rename", ...)` and dispatch by the current row's `kind` to the existing callback.
- Real final-build reproduction on `http://127.0.0.1:7884/ui/`: double-clicking a Mission's main Work Ledger button selected the Mission but left the dialog count at zero.

### Whole-repository impact search

- Mission top-level rows, Mission child Task rows, and Chat top-level rows all render the same `WorkLedgerRowView` main button.
- `main.tsx` already supplies one rename callback per durable domain. Mission uses `PATCH mission/<id>/title`, Task uses `PATCH task/<id>/title`, and Chat uses the canonical conversation-session rename path; successful callbacks share the existing Work Ledger refresh token.
- Server routes, persistence schemas, Task/Mission scheduling, Session occurrence recovery, concurrency, Project isolation, and Provider behavior are unchanged. The defect is solely the missing shared UI event binding.
- No rename-specific UI automation is present or needed. Existing UI automation in touched paths will not be run.

### Independent agent feedback

None before implementation. The uninvolved read-only review found no code or visual defect. It required the spec to distinguish Mission/Task real-page evidence from Chat's shared-path code evidence, corrected the Task row hierarchy wording, and confirmed that concurrent Right Dock files and index lines remain outside this staged change. Final re-review found no unresolved issue.

## Analysis

### Observable phenomenon

Double-clicking a Mission, Task, or Chat title behaves like row selection only. No rename dialog appears.

### Direct trigger and root cause

The main row button still has `onClick`, keyboard action navigation, and every rename callback, but its `onDblClick` binding was deleted in `fcddb8f3`. Because all three row kinds share this component, one deletion disabled the interaction everywhere while leaving the underlying dialogs and writers healthy.

### Why existing paths did not cure it

Header/menu rename actions call the same callbacks but are separate interaction surfaces. They cannot receive a double-click from the Work Ledger row. Selection, tooltip, and action-button primitives also do not synthesize rename behavior.

## Implementation plan

1. Restore one double-click handler on the shared Work Ledger main button.
2. Prevent default and propagation, then run the existing rename action and dispatch only by the current row's discriminated `kind`.
3. Type-check and production-build Overlay.
4. Use the real `/ui/` page to open and cancel the rename dialog for available Mission and Task rows, capture screenshots, and manually review; audit Chat through the same `WorkLedgerRowView` handler, explicit discriminated branch, and existing callback when no real Chat row exists.
5. Commission an uninvolved read-only review, repair valid findings, reverify, commit, merge upstream, inspect outgoing commits, and push.

## Verification record

- `bun run --cwd packages/overlay typecheck`: passed.
- `bun run --cwd packages/overlay build:vite`: passed. Existing third-party `use client`, static/dynamic import, and large-chunk warnings remain informational.
- `bun run docs:check`: passed with 331 operations across 25 groups.
- No UI automation test was added, changed, or run.
- The real final build was loaded in isolated pages against the existing service at `http://127.0.0.1:7884/ui/`; no user window or process was refreshed, restarted, or stopped.
- Mission row: one double-click opened exactly one `Rename Mission` dialog, prefilled with `DeBERTa ABSA CUDA 训练与 ACL 论文端到端演示（内置专家团）`. Cancelling closed the dialog without changing the row title.
- Mission child Task row: one double-click opened exactly one `Rename this task.` dialog, prefilled with `CUDA训练迭代与网页系统`. Cancelling closed the dialog without changing the row title. The selected Task header and list highlight showed that the existing single-click selection semantics remained intact.
- Visual evidence: [`2026-08-24-work-ledger-mission-rename-dialog.png`](../../artifacts/2026-08-24-work-ledger-mission-rename-dialog.png) and [`2026-08-24-work-ledger-task-rename-dialog.png`](../../artifacts/2026-08-24-work-ledger-task-rename-dialog.png). Manual inspection found correct modal layout, focused prefilled input, readable titles, and no row/drawer layout regression.
- The available 7883 and 7884 production datasets contain no Chat row, including their archive projections, so a real Chat screenshot could not be produced without creating user-visible test data. Chat uses the identical `WorkLedgerRowView` main button and the restored discriminated branch calls the already-production `onRenameChat` callback; no separate Chat interaction path exists.
- Page error log after Mission/Task verification was empty.
- Final independent re-review found no unresolved issue.
