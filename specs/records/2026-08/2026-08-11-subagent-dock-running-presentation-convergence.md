# Sub-agent dock and generating-tail presentation repair

Status: implemented, acceptance verified, and independently reviewed with no unresolved findings.

## Recall

| Item | Record |
| --- | --- |
| User request | Repair the scheduler leaking into the right-side sub-agent dock and investigate why `Thinking` and the animated Chinese generating label are mixed. After the initial investigation, the user clarified the intended contract: preserve `Thinking` and remove the pulsing `正在生成` presentation. Do not trade one broken path for another. |
| Acceptance | The right-side sub-agent dock exposes only canonical delegated child-agent executions; the orchestrator remains available to the shared agent activity projection but cannot enter the dock selector or transcript request path. The existing localized `Thinking` pending presentation remains. No running text tail or empty bubble renders `正在生成`, and the dedicated animated generating-status style is removed without disabling the separate Tool activity animation that shares its keyframes. |
| Hard constraints | Preserve the backend `agentView` as the complete execution projection. Reuse the existing sub-agent classification authority; do not add name matching, a second stage list, a backend exclusion, fallback, or compatibility path. Preserve the pending `Thinking` presentation. Do not add, modify, or run User Interface automation tests. Use real-page interaction and screenshots for visual acceptance. Preserve all unrelated worktree changes. |
| Sources read | `AGENTS.md`; `specs/current/architecture/task-control-plane.md`; `2026-08-11-scheduler-systemic-fault-audit-and-repair.md`; `2026-08-11-scheduler-liveness-and-control-convergence.md`; Overlay agent store, conversation projection, sub-agent presentation, dock panel, card/bubble/text renderers, locale files, message styles, and sub-agent transcript service; backend conversation view, lifecycle projection, orchestrator Session creation, and transport display-stage contract. |
| Whole-repository search | Searched `SubagentConversationPanel`, `isSubagentActivityRecord`, `conversationAgentRecordsForSource`, `agentView`, `topLevelExecutionIDs`, `chat.thinking`, `正在生成`, `msg-streaming-status`, `msg-terminal-activity-wave`, pending placeholders, `running`, and all directly related tests and call sites. The only current sub-agent classifier is `isSubagentActivityRecord`; the dock is the only discovered sub-agent surface that reads the complete shared record set without it. `Thinking` has one live pending-card renderer plus one dormant placeholder helper. The unwanted generating presentation has two render sites sharing one CSS class; its keyframes are also the current Tool activity-wave primitive and therefore cannot be deleted with the label class. |
| Independent agent feedback | No review before implementation. After the first verification pass, a fresh uninvolved read-only agent reviewed the complete scoped diff, screenshot, specification, checks, projection boundary, request authority, retained `Thinking`, and shared Tool animation. It reported no unresolved findings and independently reran Overlay typecheck, repository docs check, and `git diff --check` successfully. |

## Depth analysis

### Observable failures

- Opening any delegated-agent progress card reveals a dock-level selector populated from the complete conversation-agent store, so the task orchestrator can appear beside real delegated workers.
- An empty pending agent card renders localized `Thinking`, while an empty running bubble or a running text tail renders the hard-coded Chinese `正在生成` with a traveling-wave animation. English locale therefore mixes English and Chinese, and completed partial text gains a redundant animated status tail.

### Direct triggers

- `SubagentConversationPanel.records` calls `conversationAgentRecordsForSource` without applying `isSubagentActivityRecord`. Its selector, selected-record lookup, request key, transcript status, count, and menu all inherit the over-broad set.
- `ChatBubbleEmptyTurnState` and `StreamingMarkdownPart` independently emit the same hard-coded Chinese generating label under `running`; `.msg-streaming-status` supplies the dedicated animated styling. `ConversationCard` separately owns the intended pending `Thinking` presentation.

### Data and control-flow root cause

The backend deliberately projects every non-user/non-system execution into one `agentView`; this includes the orchestrator because the shared activity rail and conversation projection need it. The Overlay hydrates that complete view into one store. Sub-agent surfaces are responsible for consuming the narrower projection defined by `isSubagentActivityRecord`, which requires a parent Session and excludes the `orchestrator` stage. The main conversation progress grid, agent rail navigation, and Task directory shortcut already use this authority. The dock bypasses it, turning a complete shared read model into an invalid sub-agent selector.

Lifecycle projection maps both `streaming` and `retry` to the single Overlay status `running`. The UI then attaches two different presentations to that state. The user-confirmed product contract is not to rename or merge them: `Thinking` remains the empty pending-agent presentation, while the redundant hard-coded generating label must not be rendered after partial text or as an alternate empty-bubble status.

The dedicated `.msg-streaming-status` selector is used only by those two generating labels. Its `msg-terminal-activity-wave` keyframes are also referenced by current running and pending Tool titles/details. Removing the whole animation primitive would silently regress Tool activity, so the repair removes the generating render sites and their now-unused selector while retaining the shared keyframes.

### Why the old paths do not solve the problem

- Filtering only the main progress grid already exists and cannot constrain the independently populated dock selector.
- Excluding the orchestrator in the backend would repair the dock by breaking the complete shared agent activity projection and would move presentation policy into the data source.
- Matching `agentID === "orchestrator"` in the panel would duplicate the canonical stage classifier and drift for future host roles.
- Translating or renaming `正在生成` would preserve the redundant animated tail the user asked to remove.
- Replacing `Thinking` with a phase-neutral running label would discard the explicitly retained pending presentation.
- Deleting `msg-terminal-activity-wave` with `.msg-streaming-status` would remove the independent Tool running animation and create the exact cross-surface regression this repair must avoid.

### Impact surface

- **Definitions:** canonical sub-agent classification; localized pending `Thinking`; generating-tail renderer and styling; shared Tool activity-wave keyframes.
- **Consumers:** main progress grid, dock selector/menu/transcript request, agent rail navigation, Task directory shortcut, empty pending agent card, empty running bubble, running text part, and running/pending Tool labels.
- **Public contracts and data:** no backend schema, route, Session lineage, persisted Message, Server-Sent Events, or lifecycle change is required.
- **Tests:** the touched component paths have no existing User Interface automation tests. The sub-agent transcript service unit test is non-visual and remains unchanged; it does not cover the dock selector.
- **Documentation:** this record and both `specs` indexes describe the complete-agent versus sub-agent projection boundary and the retained-thinking/removed-generating presentation contract.
- **Risk:** an already-selected orchestrator ID can remain in the runtime signal after hot replacement; filtering the selected-record lookup makes it non-requestable and the panel correctly falls back to no selection. Removing the empty-bubble generating label can leave a nested running bubble body empty, but its identity and status chrome remain visible; top-level empty agents continue through the dedicated `Thinking` presentation. Tool activity motion remains intact through the retained keyframes.

## Implementation plan

1. Make the dock derive its complete selector and request authority from `conversationAgentRecordsForSource(...).filter(isSubagentActivityRecord)`. Reuse the existing predicate without adding another classifier.
2. Preserve `ConversationCard` and `chat.thinking`. Remove the hard-coded generating label from empty running bubbles and streaming text tails.
3. Remove the now-unreferenced `.msg-streaming-status` styling, but retain `msg-terminal-activity-wave` because running and pending Tool labels still consume it.
4. Run Overlay typecheck, Vite build, repository docs check, focused source/diff checks, and inspect the final status/diff. Do not run UI tests.
5. Start an isolated real page, inspect the sub-agent dock, retained `Thinking`, and absence of a generating tail, save screenshots under `specs/artifacts/`, and manually review them.
6. Ask an uninvolved agent to review the complete diff, evidence, documentation, and regression risks read-only. Resolve every valid finding and repeat review if code changes.
7. Commit only this task. Push only when the configured upstream and complete `upstream..HEAD` set satisfy repository safety rules.

## Acceptance evidence

- `packages/overlay`: `bun run typecheck` completed with exit code 0.
- `packages/overlay`: `bun run build:vite` completed with exit code 0 after processing 7,100 modules. The only output was the existing third-party `use client` and chunk-size warnings.
- Repository root: `bun run docs:check` reported `docs:check ok (329 ops, 25 groups)`.
- Repository root: `git diff --check` completed with exit code 0.
- Focused source search confirms there is no `chat.running` key and no `.msg-streaming-status` reference. The only remaining `正在生成` source text belongs to the unrelated commit-message workflow (`正在生成提交信息…`). `chat.thinking` remains in both locales and `ConversationCard`, and `msg-terminal-activity-wave` remains declared and referenced by Tool activity.
- No User Interface automation test was added, changed, or run.
- A backend and current `dist-vite` were started on isolated port `5180` with an isolated OpenCorvus data directory. The user-running backend on port `7878` was not touched, refreshed, restarted, or stopped.
- The isolated fixture projected a Chat execution, an orchestrator execution, and a delegated assistant execution through the real conversation/task routes. In the live page's accessible tree, the shared `Agent activity` rail contained `assistant · Running` and `orchestrator · Running`, while `Sub-agent progress` contained only assistant entries. Opening the full assistant conversation produced a `Squad agents` dock with only assistant tabs and assistant transcript content; the orchestrator had no dock selector entry and therefore no transcript request path.
- Manual review of [01-en-dock-filter-and-no-generating-tail.png](../../artifacts/2026-08-11-subagent-dock-running-presentation-convergence/01-en-dock-filter-and-no-generating-tail.png) confirms that the right dock contains only the delegated assistant, the populated streaming text has no generating-status tail, and no hard-coded Chinese running label leaks into the English page.
- A second isolated empty child execution correctly exercised the separate sub-agent progress empty state (`Waiting for activity…`). It was deliberately not treated as evidence for the message-level `Thinking` renderer: those are distinct states. The retained `Thinking` contract is instead evidenced by the unchanged `ConversationCard` renderer and unchanged `chat.thinking` locale keys; the repair does not rewrite or share this path.
- The mandatory independent read-only review found no unresolved issues. It confirmed that one filtered record set governs dock tabs, menus, selection, and request keys; the complete shared projection remains intact; both generating render sites and their selector are gone; and Tool activity still owns the retained wave keyframes.
