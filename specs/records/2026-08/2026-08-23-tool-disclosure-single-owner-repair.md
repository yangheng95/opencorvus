# Tool disclosure single-owner repair

Status: complete; implementation, real-page acceptance, and independent review passed

## Recall

### User request

Repair Expert Squad member Tool calls that appear clickable but do not visibly open.

### Acceptance criteria

- One click on a collapsed Tool row changes that same row to expanded and immediately reveals its input, output, error, structured result, or attachment body when present.
- The expanded row does not reveal a second collapsed copy of itself and does not require a second click.
- The shared main-conversation and selected child-Session transcript paths retain chronological Tool placement, adjacent Tool identity, Patch placement, keyboard disclosure semantics, and operator-owned expansion state.
- The selected child-Session dock remains readable at its narrow production width and follows the existing scroll-owner contract.
- Overlay type checking, production build, documentation checking, real-page interaction, screenshots, and manual visual review pass. No UI automation test is added, changed, or run.
- An uninvolved agent independently reviews the complete change and evidence; every valid finding is repaired and reverified.

### Hard constraints

- Preserve one Tool renderer and one disclosure-state owner per visible Tool call. Do not add a compatibility path, parallel state, fallback renderer, synthetic Message, or hidden output.
- Persisted Message Parts and the child-Session transcript route remain the data authority. The Tool failure wire shape is unchanged; its existing schema and renderer move to the shared transport package so Core and Overlay consume one contract.
- Preserve existing operator-owned card/disclosure state and the shared `setupAutoScroll` owner.
- UI acceptance uses the real `/ui/` page and manual screenshots only. Existing UI automation in searched paths is not run; no new UI automation is created.
- Preserve unrelated untracked `packages/opencorvus/script/benchmark/` and ``.

### Material read and search evidence

- Read `SubagentConversationPanel`, `Conversation`, `ConversationCard`, `ChatBubble`, `CardParts`, `Card`, `CardHeader`, `InlineToolPart`, `tool-card-node`, `message-part`, `conversation-ui`, `card-tree`, `dom-utils`, `subagent-conversation`, and the current Overlay live-delivery architecture in `task-control-plane.md`.
- Read the canonical `ToolStatePending`, `ToolStateRunning`, `ToolStateCompleted`, `ToolStateError`, `ToolFailureCause`, Processor input-start transition, Core failure renderer, and transport package contract/tests after independent review identified missing terminal/running bodies.
- Searched every definition/caller of `collapseWorkDetails`, `ExecutionDisclosureRun`, `ExecutionEventRun`, `toolToCardNode`, `renderNestedCard`, `conversationDisclosureExpanded`, `cardExpanded`, and `setupAutoScroll.contentChanged`.
- Git blame places both the outer execution disclosure and ordinary Tool default-collapse policy in the original `65d0bfc9` import. No later repair converged the two owners.
- Real page: on the running `v0.0.51beta` `/ui/` surface, clicking the selected `system-integrity-reviewer` Tool row changed its outer `aria-expanded` from `false` to `true` and inserted a `.msg-work-details__body`; the inserted Tool was still a separate `Card` governed by ordinary Tool default-collapse.
- The later rerun transcript proved the persisted Tool payload is present and renderable. No backend error or missing click handler was observed.
- `setupAutoScroll` already observes the scroll container's direct content box sizes, so disclosure-height changes use the existing follow owner. Adding a second scroll signal is excluded.

### Whole-repository impact search

- Production main conversation: `Conversation -> ConversationCard -> ChatBubble -> CardParts(collapseWorkDetails)`.
- Production selected child Session: `SubagentConversationPanel -> ConversationCard -> ChatBubble -> CardParts(collapseWorkDetails)`.
- Nested Agent/message bodies and generic Cards call the same `CardParts` path.
- Non-collapsed body rendering still needs `toolToCardNode` for contexts that intentionally expose the full Tool card directly.
- Server routes, wire payloads, persistence, Task/Mission scheduling, Provider calls, Tool execution, recovery, and Project isolation are not involved.
- The existing Core-owned `ToolFailureCause` wire schema and renderer move without shape changes to the shared transport package so Core and Overlay consume one authority. No SDK or configuration contract changes.

### Independent agent feedback

None before implementation. The first uninvolved read-only review found three valid completeness gaps: completed metadata/input-only Tools could still expand empty; canonical failures live in `state.failure` and require the complete shared renderer; and running Tools replace pending `raw` with `state.input`. All three findings were accepted and repaired before final verification. The reviewer also caught and required removal of unrelated concurrent spec-index changes from the commit. Final re-review found no unresolved issues.

## Analysis

### Observable phenomenon

In the Expert Squad member dock, a Tool row accepts pointer or keyboard activation and shows focus, but the operator sees no Tool body. The screenshot captures the last row focused at the bottom of the narrow transcript.

### Direct trigger

`ExecutionDisclosureRun` toggles an outer `expandedDisclosures` entry. Its body calls `ExecutionEventRun`, which routes the same Tool Part through `toolToCardNode` into `Card`. `Card` then reads a different `expandedCards` entry, and `defaultExpandedForNode` returns `false` for every ordinary Tool.

### Data/control-flow root cause

One visible Tool invocation has two independent presentation owners:

1. the execution-run disclosure owns whether the event is mounted;
2. the nested Tool Card owns whether the mounted event body is visible.

The first click therefore mounts a second collapsed Tool header instead of the payload. At the bottom of a narrow scroll viewport, the new header can land below the current viewport or visually replace the first row, so the successful first state transition is indistinguishable from no action. A second click on the nested header is required.

Final production-page replay exposed a second presentation-owner defect on the same surface: the main conversation retained the temporary disclosure state, while a selected child transcript undergoing live hydration could return the clicked Tool row to `aria-expanded=false`. Tool expansion therefore now uses the existing Task-scoped `expandedCards` authority, keyed by the stable execution Part order key, instead of the reset-only `expandedDisclosures` map.

### Why the old path did not cure it

- The outer disclosure was introduced to compact chronological Tool/Patch runs.
- The nested Card was retained to reuse Tool chrome and `InlineToolPart`.
- The global Tool policy independently default-collapses raw Tool details.
- CSS deliberately makes the nested collapsed Card look like a lightweight transcript Tool row, concealing the duplicated layer instead of exposing it.
- Live transcript refresh, persisted Part completeness, and scroll following cannot remove the second state owner.

### Known, inferred, and excluded

- Known: the outer click handler executes and changes `aria-expanded`.
- Known: the mounted Tool Card defaults collapsed under a separate state key.
- Known: the issue affects the shared renderer, not only one Expert Squad or historical transcript.
- Inferred: the narrow dock and bottom placement make the duplicated row easiest to misread as an inert click.
- Excluded: missing Tool output, backend route failure, corrupt historical data, pointer-event interception, disabled Button state, or a Task/Mission scheduling defect.

## Implementation plan

1. Make each Tool Part its own chronological execution disclosure with the existing stable Part order key and bind it to the Task-scoped `expandedCards` authority.
2. Let that disclosure render the canonical `InlineToolPart` body directly when expanded, removing the nested Tool Card and its second expansion owner from this path.
3. Keep Patch events chronological and directly rendered without inventing a Tool disclosure.
4. Retain generic/non-collapsed Tool Card rendering for the contexts that intentionally use it.
5. Make the single `InlineToolPart` body total over pending, running, completed, and error states: preserve specialized/raw/output/error/attachment renderers first, then show non-empty structured metadata or exact input when no other body exists.
6. Move the existing Tool failure schema and renderer to `@opencorvus-ai/transport-protocol`, re-export it from Core, and let Overlay parse/render the complete canonical cause.
7. Run focused positive transport tests, relevant type checks, Overlay production build, docs check, and `git diff --check`; then use the real `/ui/` page to click representative Artifact and shell Tool calls in the child dock, inspect focus/expanded state, capture screenshots, and manually review.
8. Commission an uninvolved read-only agent review, repair valid findings, reverify, commit, merge upstream, verify the exact outgoing commit set, and push.

## Verification record

- `bun test packages/transport-protocol/test/contract.test.ts`: passed. The repository's current test discovery also found the pre-existing copied gallery contract, for 47 passed tests, 0 failed, and 2271 expectations across the two discovered files. The new positive contract parses and renders complete `kind/name/originSite/message/data` failure truth.
- `bun run --cwd packages/transport-protocol typecheck`: passed.
- `bun run --cwd packages/overlay typecheck`: passed after the initial repair and after every review-driven repair.
- `bun run --cwd packages/opencorvus typecheck`: passed after moving the shared Tool failure authority.
- `bun run docs:check`: passed with 331 operations across 25 groups.
- `bun run --cwd packages/overlay build:vite`: passed on the final source. Existing third-party `use client`, static/dynamic import, and large-chunk warnings remain informational.
- `git diff --check`: passed.
- No UI automation test was added, changed, or run.
- Real-page acceptance used the already-running production `/ui/` at `http://127.0.0.1:7884/ui/`, the real persisted DeBERTa Mission, and the selected `system-integrity-reviewer` child Session. No user process/window was restarted or stopped.
- On the final production build, a stable completed `artifact_search` row in the selected `system-integrity-reviewer` child Session changed from `aria-expanded=false` to `true` on its first click. The same disclosure immediately contained `.msg-work-details__body`, a 23,346-character canonical Output payload, and zero nested `.card` elements. After another two seconds of transcript hydration it remained `expanded=true`, with the same body, Output, and zero nested Cards.
- Manual screenshot inspection at the production right-dock width showed the Tool row followed immediately by its `Output` payload, with no repeated collapsed Tool header. Adjacent Tool rows stayed in chronological order. The final built shared renderer was also rechecked in the completed Task's main conversation: one click produced `expanded=true`, `body=true`, `nested=0`, and a 21,002-character Output payload.
- Final screenshot evidence: [`2026-08-24-tool-disclosure-child-dock.png`](../../artifacts/2026-08-24-tool-disclosure-child-dock.png) shows the selected Expert Squad member's single expanded `artifact_search` row followed directly by `Output` at the production right-dock width. [`2026-08-24-tool-disclosure-single-owner.png`](../../artifacts/2026-08-24-tool-disclosure-single-owner.png) independently shows the same single-owner rendering in the main conversation.
- The running demonstration later emitted pre-existing `subagent conversation ... live message ... has incomplete identity` console errors while new Mission work continued and switched visible member occurrences. That separate live-message identity fault was observed before the final repair and is not used as acceptance evidence for this disclosure change.
- First independent review findings: three valid body-completeness/authority findings described in Recall and one staged-diff isolation issue; all repaired. Final independent re-review found no unresolved issues.
