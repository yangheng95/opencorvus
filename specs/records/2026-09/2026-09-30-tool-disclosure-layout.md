# Tool disclosure layout correction

## Recall

- User: 布局非常不协调；去掉聚合的 “tool call” 外层，用最近一次工具调用作为 toggle bar 名字。The supplied screenshot shows repeated anonymous tool counts and excessive vertical gaps.
- Acceptance: one compact disclosure per chronological execution run, labelled with the latest actual tool name and argument/result summary; one click reveals complete chronological results directly; sources and narrative stay in order. Inspect actual desktop `/ui` screenshots, including single/multiple calls and a narrow side panel.
- Constraints: single agent; no UI automated tests; preserve unrelated Harbor spec-index edits; use existing Session, transcript, tool-body, disclosure state and design tokens; no model/credential use required for this presentation correction; scoped commit and upstream merge/push.
- Read: AGENTS.md; architecture 07-panel; side-chat/quotation record; 2026-09-29 conversation-delivery repair record; CardParts, InlineToolPart, ChatBubble, SourceParts; tool, message-part and card-message-run utilities; messages/chat-bubble/inspector styles; package scripts.
- Searches: repository definitions/callers for ExecutionEventRun, ExecutionToolDisclosure, describeCurrentToolPart, executionDisclosureKey, tool count translations and execution CSS; no UI automated tests found in the encountered overlay test paths. No delegation.

## Analysis

- Trigger: CardParts places ExecutionToolDisclosure inside ExecutionEventRun; the outer header substitutes “1 tool call”/count for the actual tool identity. Expanding requires another click for each real result.
- Layout root cause: the extra `msg-execution-group` wrapper bypasses existing direct `msg-work-details` compact spacing, so card-message margins combine with the conversation flex gap and group margins. Quotation's additional text wrapper also invalidates direct text adjacency selectors.
- The previous delivery repair restored aggregation with a count-labelled wrapper but retained individual disclosures. Correct the shared renderer rather than add a side-chat-specific path. The latest chronological tool supplies identity even when an older call is still running; aggregate pending/error facts remain visible separately.
- Scope: shared CardParts covers main, side and child conversations. Keep canonical part ordering, message/source boundaries, one stable disclosure identity, body renderer, lazy result hydration and independent payload raw/copy controls. No API, persistence, runtime lifecycle, scheduler or provider changes; these concerns are not implicated.
- Risk: losing an earlier error behind a completed latest tool, large tool names/commands in narrow panels, duplicate tool headers for one call, discarded expansion state on append, and quotation wrappers leaving extra paragraph margins. Address these in the component/styles and manual page review.

## Plan

1. Replace the nested group/per-tool toggles with the existing work-details disclosure, latest tool identity and direct result bodies with static headers only for multiple entries. Remove obsolete group CSS and unused single-call translation.
2. Restore compact transcript spacing with quotation-aware selectors and restrained separation of expanded results; preserve shared typography and keyboard disclosure behavior.
3. Build/typecheck/check styles and translations/docs. Start an isolated development server and manually inspect representative persisted presentation data, disclose/collapse results, and review dark/light main and side-panel screenshots. These are visual acceptance inputs, not generated model evidence.
4. Record outcomes, commit only this correction, fetch/merge upstream, review pending commits and push.

## Verification

- First manual screenshot confirms the single disclosure and direct four-result expansion. It also exposes that tool summaries previously resolve every file against the selected Task directory, which is empty in standalone chats. Use the actual selected Session directory for chat/side-chat summaries and the Task directory for Task summaries. The acceptance sample's mixed slash path spelling is normalized in the sample inputs so it matches actual persisted Windows directory identity; no path utility/API contract is changed.
- Obsolete nested `.card` presentation rules and their private style variables are removed: the sole expanded execution body now renders InlineToolPart directly, so these selectors have no matching renderer.
- Final [desktop/side-panel evidence](../../artifacts/2026-09-30-tool-disclosure/README.md): inspected dark/light collapsed layouts, a four-call expansion, single-call direct output, Enter collapse, and narrow side-chat reference history at 1440 × 960. All interactions used the actual development server `/ui` and canonical persisted local sample data. No UI automated tests, credentials or model calls were used. This task changes presentation only; it makes no new claim about Provider/runtime concurrency acceptance.
- Overlay `typecheck`, `check:i18n` (1,969 keys), `check:css-tokens`, `build:vite` and root `docs:check` passed. The final production build completed in 61 seconds, with existing third-party directive/chunk-size warnings.
- Parallel delivery commit `04233433` incorporated the shared root/monthly index edits during this work. Its unrelated files are left untouched; this task stages only its UI change, architecture note, new record and visual evidence.
