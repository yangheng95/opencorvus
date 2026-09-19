# Sub-agent dock stability and visual hierarchy

## Recall

- User: “右侧子agent面板的dock还是很丑”, supplied a screenshot, then reported “而且子agent消息一直屏闪”. Address both the crowded navigation and flashing transcript.
- Acceptance: stable live child transcript, clear selection and compact navigation, readable transcript, real desktop-page interaction and screenshots, independent read-only review, scoped commit and upstream push.
- Constraints: preserve all real messages, exact Session identity, streaming, one transcript authority and current scroll owner. No User Interface (UI) automation tests, fixtures or screenshot assertions. Preserve the user's running desktop/backend. Unrelated untracked `script/video/` is outside scope.
- Read: `07-panel.md`, task-control-plane live-delivery contract, September 18 visual-refresh and session-switch records; SubagentConversationPanel, ConversationCard, ChatBubble, CardParts, TextPart/model, subagent-conversation service, shared Tabs styles and Solid's installed Show implementation.
- Whole-repository search: ConversationCard has two production callers: main virtualized Conversation and selected child transcript. The dock creates a fresh CardNode projection for each live transcript/status update; the main conversation normally passes a stable store proxy. CardParts uses position-stable Index collections; TextPart keeps completed Markdown blocks in its controller. The only renderAsBubble branch is ConversationCard's ordinaryCard function.
- Independent agent feedback: final read-only review found no actionable code issue; reviewer verified the full diff, installed Solid implementation, descendant rendering, CSS cascade, observer/frame cleanup and documentation. The reviewer did not independently inspect final screenshots; visual evidence below belongs to the primary agent.

## Analysis and scope

The screenshot has two equally prominent tab rows, oversized child labels/avatars, clipped leading navigation and a large transcript inset. The previous visual refresh retained the 50px selector, 240px tab limit and underline treatment of the outer dock, so hierarchy remained weak.

The flashing has a concrete reactive trigger: ConversationCard's Show fallback invokes ordinaryCard(), whose ordinary JavaScript conditional reads the whole reactive props.node. Solid's Show evaluates fallback inside its rendering memo. Each new dock projection invalidates that memo, creates a fresh ChatBubble and reinitializes all descendant Markdown and disclosures. Main Conversation uses the same component, although its stable store identity makes this less frequent. Prior fixes guarded asynchronous Session identity and scroll writes, not this component lifetime.

Repair the shared branch with a non-keyed Show whose boolean condition changes only when the render kind changes; continue delivering node changes through reactive props. Do not add shadow state, suppress updates, change refresh frequency or mask flashing with animation.

Refresh/control-flow audit: initial load and coalesced refresh use the same exact source/Session/directory target; target change aborts requests and resets live projection; displayedConversation requires the current targetKey. Task (including Mission-created Task) and standalone Session sources converge on this renderer. Running/idle/terminal statuses all update the same card. Retry and page reload rebuild the initial resource normally. Concurrent agents and projects are filtered by selected source and exact Session. No backend scheduling, occurrence or recovery anomaly has been established; persisted state and backend changes are outside this rendering repair. The running-to-completed live path was observed in the real Mission-created Task; standalone Session, retry and project isolation have code/service-contract evidence rather than new live end-to-end evidence.

## Plan

1. Stabilize shared ConversationCard branch ownership with the existing non-keyed Show primitive.
2. Reduce child-selector height, label width and avatar emphasis; use a contained selected treatment distinct from the outer dock underline. Tighten transcript insets and identity spacing with existing theme tokens. Keep tab keyboard behavior, exact names/tooltips, all-agents menu and full messages.
3. Verify on an isolated current-source frontend connected to the running backend. The embedded `/ui` was inspected first; it serves the installed binary's bundle and cannot serve changed source without altering the user's running instance. This requires a standalone development frontend for this acceptance. No model request or credential transfer is needed.
4. Run Overlay typecheck, CSS token and documentation checks plus relevant non-UI service contracts. Inspect actual screenshots, child switching, disclosures and live activity; report any unavailable live acceptance explicitly.
5. Independent read-only review, address findings, commit, fetch/merge upstream, inspect outgoing commits and push.

## Verification

Initial screenshot review on the real task found that shrinking the dock clips
the selected tab: existing reveal logic responds only to Session selection,
not strip geometry. The implementation now observes the strip's size and
schedules the same bounded horizontal reveal through the existing animation
frame primitive. It does not write transcript scroll position or react to
agent activity. This correction is within navigation acceptance; recheck
both widths and switching after the change.

Overlay typecheck, CSS-token check, docs check and 18 non-UI transcript/session
contract tests passed. Final production build and renderer-public-surface
check passed after the resize correction (build: 1m 55s). Existing bundle-size
and third-party module-directive warnings remain informational.
Initial test invocation used bare paths and Bun additionally discovered a
matching ignored temporary project with missing dependencies. Re-running
the same intended files using explicit `./test/…` paths from the Overlay
package passed all 18 tests. No UI test was executed.

### Real page and screenshot evidence

The primary agent inspected the installed `http://localhost:7878/ui/`, then
used an isolated `http://127.0.0.1:5174/` current-source page against the same
backend. In the real 航空母舰批发交易网站 task, the selected
implementation-engineer transcript visibly grew from activity duration
17m 37s through 18m and 21m 49s, then reached completed status. Actual new
tool results, commentary and the final reply appeared. Captured 1280×720
dark-theme screenshots were manually reviewed in the tool transcript.
The selected card stayed visible in those observations; no whole-card flash
was seen. These are sampled visual observations, not frame-by-frame proof.

Actual interaction switched to test-engineer and back, opened All agents (9),
expanded the real `apply_patch` result for `M styles.css`, and waited for
its content to resolve. The final accessibility state retained the expanded
disclosure while subsequent live output and completion arrived. The browser
reported no error logs. The minimum-width screenshot exposed the selection
clipping described above; after correction, a new screenshot showed the
whole selected test-engineer tab. Wider mode restored the full current
implementation-engineer label with compact neighboring tabs. No synthetic
messages, browser fixture, model request, credential transfer, UI assertion
or automated visual baseline was used.

Independent read-only review found no actionable issue. No unrelated
`script/video/` files are included. The user's installed desktop and backend
were not restarted or updated; they retain their loaded bundle until a
separately authorized application update/reload.
