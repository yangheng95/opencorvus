# Right Dock lifecycle and virtual-bottom convergence

Date: 2026-08-27

## Recall

### User request and continuation state

- Preserve Right Dock tab metadata, but mount only the currently visible panel.
  Switching tabs, closing the Dock, and closing a tab must dispose the one
  mounted panel exactly once so hidden panels cannot keep polling or handling
  Server-Sent Events (SSE).
- Preserve the completed child-Agent identity repair: native assistant Sessions
  use the exact agent projected from persisted input Messages; descriptor and
  Right Dock identities must agree.
- Preserve the completed Message validation repair: `originSource` is required
  to be a string, and the contract-valid empty string is accepted.
- Finish the long-card and Session-reopen repair. Dynamic `virtua` row height
  must converge before the followed transcript is considered at bottom; a
  retired Virtualizer may release only its own handle; the last virtual row and
  the outer Conversation scroll owner must be anchored in the same measurement
  frame.
- Rebuild an isolated native application and obtain one final manually reviewed
  screenshot. Do not manipulate the user's official OpenCorvus process/window.
- After the first independent review found an invalid empty Tabs selection, the
  user stopped Computer Use and explicitly required static repair only. The
  final Tabs/body-gate revision must therefore be accepted through code,
  dependency-source, type/build, and independent-review evidence without a new
  native interaction claim.

### Acceptance criteria

- When the Right Dock is closed, no panel body component is mounted. When it is
  open, exactly the selected tab body is mounted; the tab list and per-tab
  metadata remain available without retaining hidden component instances.
- A tab switch and tab close unmount the prior component once and mount the new
  selected component once. Browser, child-Agent, file, screenshot, requirements,
  goal, explorer, and review panels share this lifecycle instead of adding
  panel-specific activity gates.
- Persisted Message identity and `originSource` validation continue to pass
  their focused positive contracts. No generic-assistant fallback or
  empty-string rejection is reintroduced.
- Replacing the visible Card Tree cannot let a retired Virtualizer clear the
  current handle. Follow mode anchors the final virtual item and writes the
  outer `#chatScroll` bottom synchronously from the same measured-layout
  callback; operator-paused history remains untouched.
- Overlay TypeScript, production Vite build, renderer-surface check,
  internationalization, focused non-UI identity/transport contracts, and
  documentation checks pass. No User Interface (UI) automation test is added,
  modified, or run.
- The pre-final isolated native Tauri/WebView run opens a real persisted
  conversation and manually verifies the long final row and reopened Session.
  After the user's static-only instruction, the final selection/body-gate
  revision is accepted through source, dependency, type/build, and independent
  review evidence without another native interaction claim.
- A previously uninvolved Agent performs the required final read-only review.

### Hard constraints

- Preserve all unrelated staged, unstaged, deleted, and untracked work in the
  shared `v0.0.55beta` checkout. In particular, current architecture-debt and
  message-panel activity/type-density tasks own overlapping dirty paths.
- Do not create a branch/worktree, reset, clean, stash, rebase, force-push,
  bypass hooks, or broaden staging.
- Do not stop, restart, refresh, focus, or manipulate the user's official
  application. The completed earlier native acceptance used an isolated
  application identifier, runtime root, listener, and persisted-data copy/read
  boundary; after the user's static-only instruction, do not perform further
  computer interaction.
- Persisted Message/Part and lifecycle facts remain the only content authority.
  The scroll repair is presentation ownership, not a second transcript state.
- Do not add a timing fallback, polling loop, MutationObserver, fixed-height
  guess, second scroll container, hidden component cache, or duplicate cleanup
  owner.

### Sources read

- `AGENTS.md`
- `specs/current/architecture/07-panel.md`
- `specs/current/architecture/07-panel-reactivity.md`
- `specs/records/2026-08/2026-08-02-subagent-dock-bottom-follow-root-repair.md`
- `packages/overlay/src/main.tsx`
- `packages/overlay/src/components/RightDock.tsx`
- `packages/overlay/src/components/Conversation.tsx`
- `packages/overlay/src/components/SubagentConversationPanel.tsx`
- `packages/overlay/src/utils/dom-utils.ts`
- `packages/opencorvus/src/conversation/view.ts`
- `packages/overlay/node_modules/virtua/lib/solid/Virtualizer.d.ts`

### Whole-repository search results

| Boundary | Result and disposition |
| --- | --- |
| Dock bodies | `main.tsx` still renders every panel through `TabPanel forceMount`; `active()` gates reduce some work but do not end component-owned observers, subscriptions, resources, or requests. Replace the shared mounting model, not each panel's internals. |
| Tab metadata | `RightDock` already receives `RightDockTab[]` and derives labels/overflow from metadata. Panel bodies are not required for tab-strip persistence. |
| Identity | `conversation/view.ts` already derives the participant from persisted Message `info.agentID` and reconciles generic native assistant ledger identity through `conversationLedgerAgentID`. Preserve this path and its strict mismatch failures. |
| Empty source | `stageFromMessageInfo` and Overlay Tree Writer validate `typeof originSource === "string"`; they do not reject `""`. Preserve the positive empty-string contract. |
| Virtualizer handle | `virtua` calls `ref(handle?)`; the current callback assigns the shared variable directly. During Card Tree generation replacement, a retired instance can therefore deliver `undefined` after the new instance published its handle. The callback needs per-instance ownership. |
| Dynamic height | `VirtualWindowShell` observes the virtual root and reports measured content through an animation-frame scheduler. The outer auto-scroll controller schedules another bottom write, so a final-row remeasure and outer bottom write can be coalesced across different frames. The measured callback must synchronously anchor both owners while follow mode is armed. |
| Shared scheduling audit | Main Conversation and child-Agent Dock share `setupAutoScroll`; the reported half-card/reopen defect is in the main `virtua` owner, while the child Dock has a non-virtual transcript. Mission, Task, and standalone Session all render through the same Conversation component, so one repair covers every production entry. History prepend uses explicit `preserve` intent and must remain excluded from bottom anchoring. |
| UI tests | No UI automation will be created or run. Existing non-UI projection/identity contracts may be run; visual acceptance is a real native page plus manual screenshot review. |

### Independent Agent feedback

- None before implementation. Post-validation read-only review is mandatory and
  will be recorded with findings and resolution.

## Problem depth and impact

### Observable behavior

- Hidden Dock panels continue background work and amplify main-thread load.
- A long final card can render only its earlier measured extent while follow
  mode remains armed, leaving visible content below the viewport.
- Reopening/replacing a conversation can leave the viewport in the middle even
  though the new tree intends to start at the bottom.

### Direct triggers

1. `forceMount` keeps every `TabPanel` descendant alive regardless of Dock/tab
   visibility.
2. `Virtualizer.ref` writes a shared handle without distinguishing the instance
   publishing `undefined` during cleanup.
3. The virtual row measurement callback and outer bottom writer are owned by
   separately coalesced animation-frame schedules.

### Data and control-flow root cause

Dock metadata ownership and Dock body lifecycle are coupled even though only
metadata is needed for tabs. Conversation bottom ownership is split between
`virtua`'s measured virtual extent and `#chatScroll`; each is locally valid but
their asynchronous publication order has no atomic convergence point. Tree
replacement adds an instance-generation race to that split ownership.

### Why earlier paths did not cure it

- Per-panel `active()` checks are advisory and cannot guarantee disposal of all
  component-owned work.
- `setupAutoScroll` correctly handles direct content resizing, but it cannot
  make `virtua` publish the final row's corrected extent before its own queued
  outer write.
- Recreating the Virtualizer on Card Tree epoch replacement fixes stale row
  cache, but direct shared-ref assignment lets old cleanup invalidate the new
  instance.
- Additional correction frames observed the eventual height but still allowed
  the final outer write to be coalesced before that height became authoritative.

## Decision

1. Keep the Right Dock tab collection as metadata and render one panel-body
   branch only when the Dock is open and that tab is selected. Component
   teardown remains Solid's single lifecycle owner.
2. Give each Virtualizer render instance a captured handle. Only the instance
   whose handle equals the shared active handle may clear it.
3. Route measured virtual-root convergence through one callback that, while
   follow mode is armed, anchors the exact last index and immediately writes
   the outer scroll owner to its now-current bottom. Preserve the ordinary
   `contentChanged()` path for non-bottom/preserved history.
4. Verify the existing exact identity and empty-source contracts alongside the
   lifecycle/scroll change; do not duplicate their already-current production
   implementations.
5. When the selected Dock tab closes, advance the canonical selection to the
   adjacent remaining Dock tab before publishing the retained collection. A
   missing canonical Dock selection maps to a reserved metadata identity, never
   to an arbitrary retained body.

## Native acceptance evidence

- Built a fresh isolated Tauri application titled `OpenCorvus Dock Final QA
  20260827` with application identifier
  `ai.opencorvus.overlay.dock-final-qa-20260827`, an isolated runtime root,
  Vite listener `127.0.0.1:47931`, backend listener `127.0.0.1:47893`, and a
  copied persisted-data boundary. The official application/window was not
  focused, refreshed, stopped, or reused.
- The first real interaction exposed one additional lifecycle defect: newly
  mounted fixed panels still began with hard-coded `data-open="false"` and
  `data-active="false"`, so their selected body was hidden before the older DOM
  synchronization effect could observe it. Fixed panels now derive both values
  directly from the canonical selected panel/tab state.
- Manually inspected the native `1197 x 751` window after opening
  `source-investigator`. The Dock header and transcript both showed the exact
  persisted child identity and canonical messages; the sibling
  `claim-verifier` tab remained metadata until selected. Closing the Dock and
  reopening the same progress card restored the same exact child transcript.
- Switched from the long persisted Task to another Task and back. After the
  canonical load completed, the final ORCHESTRATOR card was fully visible above
  the Composer at the native scroll bottom. The viewport did not remain at the
  old middle position and the card was not clipped to its stale virtual height.
- The isolated copied-data backend reported an unrelated Expert Squad catalog
  package-snapshot error because that immutable package snapshot was not copied;
  Task/Session conversation hydrate and live routes used by this acceptance
  remained healthy. No catalog behavior is claimed by this validation.
- These screenshots predate the final independent-review repair that separated
  the legal retained Tabs selection from the Dock body mount gate. Computer Use
  was then stopped and the user required static-only completion, so this record
  does not claim a post-repair native screenshot.

## Static lifecycle evidence

- Current Kobalte Tabs source sets `disallowEmptySelection: true`; the Dock no
  longer passes `value=""` when closed. It retains the canonical selected tab,
  or a valid reserved metadata key when no Dock tab exists.
- Kobalte Content mounts through `Show` only when `forceMount` is true or that
  Content is selected (`@kobalte/core/dist/chunk/4XGMYOCT.js`). OpenCorvus no
  longer supplies `forceMount` to any Dock `TabPanel`.
- A separate outer Solid `Show` keyed by `rightDockOpen` owns the complete Dock
  body subtree. Closing the Dock therefore disposes every panel body without
  passing an illegal empty selection into Kobalte or rewriting retained tab
  metadata.
- Pending fixed-Browser navigation is an identity-bearing object. A mount
  microtask consumes it only when both the current controller owner and the
  exact pending object still match. A newer request clears or replaces the old
  object, and a controller retired before the microtask leaves the request for
  the next valid owner.

## Focused verification evidence

- `bun run typecheck` from `packages/overlay`: passed.
- `bun run check:i18n` from the exact clean closure: passed with 2 locales and 1856
  top-level keys.
- `bun run build` from the exact clean closure: production Vite build passed after
  transforming 7118 modules; renderer public-surface check passed with one
  assignment and one declared global. Existing third-party `use client`, chunk
  size, and static/dynamic file-workbench import warnings remained warnings.
- `bun run docs:check` from the repository root: passed with 337 operations and
  25 groups.
- `git diff --check`: passed.
- `bun test packages/opencorvus/test/conversation-projector-ownership.test.ts
  packages/overlay/test/tree-writer-incremental-projection.test.ts`: 4 passed,
  0 failed. The Overlay fixture emitted the pre-existing missing
  `chat.role.orchestrator` diagnostic while all contract assertions passed.

## Independent review findings and resolution

- The first read-only review found that closing/emptying the Dock by passing an
  illegal empty Kobalte Tabs value could preserve a hidden body. The Dock now
  retains a non-empty metadata selection while a separate Solid `Show` owns the
  open/closed body lifetime.
- The first review also found a stale Browser-navigation microtask race. Pending
  navigation now carries object identity and is consumed only by the exact live
  controller owner.
- The second read-only review found that removing the selected Dock tab could
  make the canonical selection fall back to Conversation while Kobalte mounted
  the first retained Dock body. The canonical owner now chooses the adjacent
  remaining Dock tab, and `RightDock` uses a reserved metadata identity when no
  canonical Dock selection exists.
- `specs/current/architecture/07-panel.md` is an ignored, untracked pre-existing
  workspace artifact absent from `HEAD`; it is not added or rewritten by this
  task because doing so would claim unrelated 69 KB content. The versioned
  architecture contract changed by this task is
  `specs/current/architecture/07-panel-reactivity.md`, which records selected-only
  mounting and owner-fenced Browser navigation.
- The shared Git index already contained another task's staged deletions. This
  task constructed and reviewed its seven-file implementation commit from an
  isolated temporary index, then updated only those committed index entries,
  preserving every existing staged entry and overlapping unstaged edit.
- The third read-only review re-read the repaired source and exact clean closure
  and reported `no unresolved findings` across lifecycle, selection, pending
  navigation, virtual scrolling, identity, documentation, and staging safety.

## Implementation and verification sequence

1. Wait for overlapping active tasks to finish their writes, then re-read the
   exact dirty diff for every owned path.
2. Implement the single mounted Dock body and per-instance Virtualizer handle
   ownership plus same-frame measured bottom convergence.
3. Run focused non-UI contracts, typecheck, production build, renderer surface,
   i18n, docs, and `git diff --check`.
4. Preserve the earlier isolated native evidence, then obey the user's
   static-only instruction for every post-review repair; do not perform another
   computer interaction or claim a post-final screenshot.
5. Obtain an independent read-only review, resolve every valid finding, rerun
   affected acceptance, commit only owned paths, merge upstream, inspect the
   outgoing commit set, and push.

## Status

- [x] Recall, current-source mismatch, shared impact, and decision recorded.
- [x] Overlapping dirty-path owners completed or exact non-overlap established.
- [x] Dock lifecycle implementation completed.
- [x] Virtual bottom convergence implementation completed.
- [x] Non-UI checks completed.
- [ ] Post-final-repair native screenshot acceptance not run because the user
  explicitly required static repair without Computer Use; pre-repair native
  evidence and this boundary are recorded above.
- [x] Independent review completed with no unresolved findings.
- [x] Exact-path delivery closure created; remote equality is verified in the
  handoff evidence rather than recorded as mutable architecture state.
