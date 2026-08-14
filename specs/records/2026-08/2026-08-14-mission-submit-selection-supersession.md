# Mission Submit Selection Supersession Settlement

Status: implemented, locally verified, and independently reviewed with no unresolved findings.

## Recall

| Item | Evidence and decision |
| --- | --- |
| User request | Repair the `Send failed: Mission selection superseded` dialog that appears after a Mission message has been sent and the operator opens its message page. |
| Supplied evidence | The screenshot shows a newly created Mission selected under an anonymous Project, a Mission card already present in the conversation, the composer in a running state, and a modal that reports the internal workspace-selection cancellation as a send failure. |
| Acceptance metrics | Once `wakeMission` has returned its persisted Mission/Session result, a later operator navigation owns the visible page and the completed submit resolves successfully without a failure modal. The older submit must not steal navigation, clear the newer selection, or leave `taskSwitching`/launcher busy state stuck. Genuine wake or currently owned hydration failures remain visible. |
| Hard constraints | Preserve the single workspace selection epoch, canonical `openMissionSession` owner, server-settled Mission wake, and real participant messages. Do not add a fallback navigation path, synthetic success, error-text matching, or UI automation. Validate on a real isolated page and preserve unrelated working-tree changes. |
| Materials read | `AGENTS.md`; `specs/records/2026-08/2026-08-11-mission-board-create-layout-and-dock-collapse.md`; the Git-initialization selection follow-up in `2026-08-10-task-start-e2e-recovery.md`; `packages/overlay/src/main.tsx`; `components/ChatComposer.tsx`; `services/{workspace,conversation-session,task}.ts`; all `openMissionSession`, `beginWorkspaceSelection`, supersession, and `AbortError` call sites. |
| Whole-repository search | Mission submit, Multica Mission launch, Board create/dispatch, Work Ledger selection, automation selection, and handoff all converge on `openMissionSession`. Board create/dispatch already settle a committed mutation by checking ownership before navigation. Composer Mission submit and Multica launch pass an older epoch directly and can still receive a thrown `AbortError`. Conversation creation differs because its user message is sent only after Session activation; Task selection already returns on stale epochs. |
| Independent agent feedback | The first post-implementation read-only review found two broader ownership defects: Mission mutation callers changed Composer/dock state before the canonical opener proved ownership, and a newer mutation could inherit an older `taskSwitching=true` without clearing it if the newer wake failed. It also found that the initial Mission-A-to-Mission-B screenshot did not exercise the exact Composer submit path. All three findings were accepted. The second review correctly rejected submit-to-File as selection-supersession evidence because opening the Right Dock does not allocate a workspace-selection epoch; the exact user path was therefore rerun by clicking the newly published Mission row while its originating submit was pending. |

## Problem-depth and impact analysis

### Observable phenomenon and direct trigger

The Mission wake succeeds and publishes a Work Ledger row. The operator clicks that row while the original Composer submit is still continuing from `wakeMission` into automatic navigation. The click allocates a newer workspace-selection epoch. The original submit then calls `openMissionSession` with its older epoch, which throws `DOMException("Mission selection superseded", "AbortError")`; `ChatComposer.handleSubmit` classifies every rejection as a send failure and opens the modal shown in the screenshot.

### Data and control-flow root cause

The existing selection epoch correctly prevents an older asynchronous navigation from overwriting a newer operator choice. The defect is its settlement contract: `openMissionSession` represents expected loss of navigation ownership as an exception even when its caller's irreversible Mission wake has already succeeded. That conflates two independent outcomes—durable submit success and optional UI navigation—and makes the post-commit navigation cancellation retroactively falsify the send result.

### Why the earlier repair did not close this path

The Mission Board repair established that create/dispatch responses must not steal navigation and added caller-side ownership checks there. It retained throwing branches inside the canonical opener. The global Composer and Multica callers do not repeat the Board checks, so the same shared opener still exports an error for a normal stale epoch. Catching the exact message in `ChatComposer` would hide only one presentation surface, keep Multica/runtime diagnostics wrong, and bind behavior to error text instead of ownership facts.

### Horizontal shared-mechanism audit

- Mission: every Mission selection converges on `openMissionSession`. Initial and post-directory ownership loss throw, later ownership loss returns, and an asynchronous failure after ownership transfer can still be rethrown. This inconsistent settlement is the shared root.
- Mission mutation takeover: Composer submit, Multica import, Board create, and Board dispatch can begin while an older selection is still hydrating. Allocating only a new epoch leaves the old `taskSwitching=true` owner unable to clean up; if the newer mutation then fails before opening, the busy state is stranded. These post-mutation navigation owners must explicitly supersede and settle the pending selection before waiting on their server mutation.
- Conversation: Session creation happens before activation, but the user message is sent only after activation. A superseded creation therefore has different delivery semantics; it must retain its draft and is excluded from claiming successful message delivery. Conversation creation still participates in the same takeover cleanup so it cannot inherit an older pending selection.
- Task: `selectTask` uses the same epoch and returns on stale normal phases; it has no create/send transaction in this path. Its persisted Task and Session data are unchanged.
- Normal/terminal, retry/restart, serial/parallel, and project isolation: the defect is confined to post-wake UI navigation. Mission lifecycle, wake admission, retries, recovery, model execution, and project-scoped persistence have already committed before the stale opener runs and are not modified. Multiple Projects remain isolated by the directory passed to the winning selection.
- Error visibility: wake failure and hydration failure while the opener still owns selection remain errors. Only loss of selection ownership becomes a normal `false` result.

## Implementation plan

1. Make the canonical `openMissionSession` return a boolean navigation result: `false` for expected ownership loss at every async boundary and `true` after successful hydration/startup.
2. In its error path, return `false` when a newer selection owns the workspace; retain cleanup and rethrow only for the still-current selection.
3. Keep callers on the single opener. Remove Composer/dock mutations from callers before ownership is proven; the successful opener remains the only owner of those visible changes.
4. Use the existing `supersedePendingWorkspaceSelection` takeover primitive for Mission mutation callers and Conversation creation so an older pending selection is settled before the newer asynchronous mutation starts.
5. Run Overlay typecheck/build, CSS/i18n and documentation checks. Do not add or run UI automation.
6. Reproduce the exact Composer Mission submit race on an isolated real Overlay through a loopback proxy that deterministically delays Session conversation hydration, click the newly published Mission row while the originating opener is still awaiting that response, confirm the Mission page remains selected without a send-failed dialog or stuck busy state, capture a screenshot, then obtain final independent read-only review.

## Evidence ledger

- `ChatComposer.handleSubmit` displays `chat.send_failed` for every `onSubmit` rejection.
- Global Composer Mission submit awaits `wakeMission`, then calls `openMissionSession(result, directory, selectionEpoch)` without rechecking ownership.
- `openMissionSession` throws `Mission selection superseded` before mutation of the target selection and after `applyDirectory` returns false; later stale checks already return normally.
- Board create and dispatch explicitly test `ownsWorkspaceSelection(selectionEpoch)` after their server mutations and return without navigation.
- Implementation: `openMissionSession` now returns `false` whenever a newer epoch owns navigation, including errors that settle after ownership transfer; it returns `true` only after the selected Mission is hydrated and streaming is started. A still-current failure retains the existing cleanup and rejection path.
- Implementation after independent review: Composer Mission submit and Multica no longer change intent or reset the center/dock before `openMissionSession` proves ownership. Composer submit, Multica, Board create/dispatch, and Conversation creation take over through `supersedePendingWorkspaceSelection`, which clears an older pending selection without disturbing a stable current selection.
- Static/package verification after the review fixes: Overlay `bun run typecheck`, `bun run check:i18n`, `bun run check:css-tokens`, and the production `bun run build` passed. Root `bun run docs:check` passed with 334 operations across 25 groups; `git diff --check` passed.
- Supplemental real-page acceptance: an isolated production Overlay first used two persisted Mission Sessions. Clicking Mission A and immediately Mission B exercised opener-to-opener supersession; Mission B remained selected with 0 dialogs, 0 `Send failed` matches, and no visible loading residue.
- Exact real-page acceptance: a fresh isolated production Overlay was served through a loopback proxy at `http://127.0.0.1:47834/ui/`. The proxy forwarded the real backend unchanged except that every `GET /session/:id/conversation` response was held for 3,000 ms; this delays the exact `loadConversation` boundary inside `openMissionSession`, independent of model-token timing. The global Composer sent `MISSION_HYDRATE_DELAY_CLICK_20260814` to Mission. Its newly published Work Ledger row was clicked 833 ms after send—more than two seconds before the originating opener's hydration response could be released—thereby deterministically allocating a newer selection epoch while the old opener was pending. After both paths settled, that Mission page remained selected, displayed the local streaming provider's `MISSION_SUBMIT_OK`, had 0 dialogs, 0 `Send failed` matches, and no visible `Loading task`. The screenshot is `specs/artifacts/2026-08-14-mission-submit-selection-supersession.jpg`.
- Final independent read-only review confirmed that the 3,000 ms hydration delay and 833 ms row click deterministically cover the old submit epoch, and found no unresolved code, lifecycle, caller-contract, Conversation-create, documentation, or acceptance-evidence issue.
- No UI automation test was added, modified, or run. The implementation and acceptance record were committed as `db122e31` and pushed to `origin/v0.0.43beta`; the repository push hook also passed the full typecheck, API route inventory, docs check, and secret scan.
