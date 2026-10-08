#118 independent current source review

## Recall and exact review scope

Root admitted and implemented four files under [the118 Recall](../tool-input-status-plan-118.md).117 originals are immutable; current source must separate pending argument receipt from actual running Tool state without hiding drafts, introducing state/schema/gates, or claiming upstream nonsemantic-input repair. This review only writes this file. No source/test/index/Git operation, UI/browser, build/typecheck, model, service or process execution was performed.

Compared each complete current file against Root's exact preimages using line comparison, then read current surrounding consumers/status/layout code. Actual changes: CardParts splits pending/running counters and their spans; tool.ts adds exactly one pending→existingreceiving_input branch; each current en-US/zh-CN file adds one count-bearing group_receiving_input entry. No other source difference was found against those four preimages. Existing errors/completed/data-active/Button/chronology/state keys and CSS are retained.

## Result: no new source blocker found

- CardParts204–211 derives both counts from the same existing tools memo/current ToolDisplayModel.status. activeCount is their sum, not another state owner. pending remains visible as receiving arguments; running remains actual running. current group labels236–241 no longer depend on props.streaming. Therefore a genuine running Tool still reads running when parent streamingfalse, while data-active still follows the original streaming && activeCount decoration. No claim of physical execution is derived from parent streaming or a pending draft.
- toolStatusLabel519–526 has explicit pending branch. completed/running/error retain their old meanings; unknown retains checks.pending. describeToolCall only supplies statusLabel for a normalized known state, so the new branch does not reinterpret unknown as argument receipt. Existing describeCurrentToolPart pending/running activity selection and Subagent event.status projection remain unchanged.
- errorCount remains independent; mixed preparation/running/error counts all remain visible. Completion icon remains conditional on no active/error count. It stays off for known pending or running, regardless streaming. Unknown/non-Tool/Patch aggregate completion behavior is pre-existing and unchanged: those were already excluded from activeCount/errorCount. This slice does not establish a new unknown-part completion contract or actual unknown-status fault.
- Reactivity is retained: count accessors call the current tools memo and t() at render; no copied initial parts/status, signal/store/cache/generation or async owner was added. The outer section, disclosure Button/key/cardExpanded, latest chronological identity, expanded Index/current parts, payload/result/error/Source placement remain unchanged. Adding/removing two internal status spans is actual state presentation, not a transcript/Card remount or new Markdown renderer.
- Both locales use the same count key/placeholder, with `{{count}} receiving arguments` and `{{count}} 个正在接收参数`. Expanded exact pending label reuses existing `tool.receiving_input`; there is no second translation owner. Current generic unknown and running labels retain their earlier contract.

## All caller impact

The sole group_running production consumer is current ExecutionEventRun. Direct CardParts callers are ChatBubble81/152/236 and Card227. Main Conversation, SubagentConversationPanel and SideChat's SideMessage each use the existing ConversationCard/ChatBubble/Card path; nested cards use the same parts component. Thus the correction reaches all those real transcript presentations without role/Tool-name routing.

Expanded multi-event headers atCardParts287 consume existing ToolDisplayModel.statusLabel, so exact pending now consistently says receiving arguments there. Expanded InlineToolPart544–546 already distinguishes receiving_input/awaiting_result and is unchanged. describeCurrentToolPart remains a generic activity selector; subagent-presentation184 reads its status rather than this textual statusLabel, so agent lifecycle meaning is not changed. Task/Mission/Session lifecycle, permission, dispatch, pending live transport/nonpersistence, terminal draft retirement and history data have no edits.

## Layout/accessibility/actual qualification limits

Existing messages.css2253 status is inline-flex/aligned with token gap and flex:none. Separate spans use that existing gap; the Tool disclosure Button remains max-width100%, min-width0, with ellipsized Tool name/detail and a nonshrinking marker. That is source-consistent but **not** narrow visual acceptance. Simultaneous English/Chinese preparation+running+errors consume more nonshrinking width and can reduce or exceed the available title region, especially in the previously observed280px child dock. Root must inspect real current screenshots rather than treat types/build or this review as geometry proof; no preemptive new CSS/wrapper is recommended from source alone.

Existing Button aria-label/title still derive chronological Tool summary; no focus or click/Enter/Space callback was replaced. These new status spans are visible content, but their exact accessible-tree exposure and mixed-count native behavior remain actual-page checks. No new role/live announcement or accessible-name string assembly was introduced. Stable disclosure/focus under deltas, Sources expansion/Tooltip/links and current Markdown-block identity require Root's real before/after observation.

Root's117 `dispatch_agent 1 running` was a contemporaneous live observation without saved PNG. root-failed-cached-ui.png is offline after draft retirement and is not pending-before evidence. Fresh118 must capture true pending→validated request/running→terminal facts and pixels; any unobserved transient/mixed/SideChat case remains unknown. A later successful run cannot retroactively qualify117 or repair its useful-content starvation. This child did not run a model, manufacture a draft, invoke a parser or perform UI automation.

## Freeze/release boundary

Source review supports the admitted semantic correction, with no newly proved source blocker. Configured types/build/docs/locale parity are Root-owned and not inferred here. Genuine Sources/reply functional acceptance, realphase-bound screenshots, narrow mixed-status geometry and full native/physical/pair closure remain Root's next evidence. No additional implementation is requested by this review.
