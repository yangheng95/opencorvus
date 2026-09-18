# Sub-agent live transcript source contract repair

## Recall

- User reports that selecting another sub-agent changes the selected tab while the transcript body stays on the old agent. The supplied task debug bundle identifies Task `tsk_g00VVaLJGt00I4atfXL4`, active on 2026-09-18, with six distinct child Sessions and no process incident. The user explicitly forbids restarting or interrupting OpenCorvus.
- Acceptance: a child Session with an empty but present `originSource` can project a new live message, and selecting other Sessions shows their exact transcripts. The existing running application and task must remain untouched. No UI automation tests may be added or run; actual page interaction, screenshots and manual inspection are required for UI acceptance.
- Sources read: the task debug bundle; the previous sub-agent dock switching record; `SubagentConversationPanel`, `subagent-conversation`, `ConversationCard`, `CardParts`, the exact child-Session HTTP route, the protocol display-stage contract, and the backend message bridge. Whole-repository search for `liveMessageFromInfo`, `observeSubagentConversationLiveEvent`, `originSource`, and the child transcript route found one live projection implementation and its service tests. Independent agent feedback: none yet.
- Observed: the task child-session API returns six distinct transcripts. The browser served by the running server could initially switch between two completed Sessions. As the active `interface-designer` emitted another message, the browser console twice recorded `subagent conversation ses_hJcdnryIFjsxRQ2iwHEl live message msg_g0VVaQ59X00QBfjRrZoT has incomplete identity`; the page then returned to a loading state. A read-only API fetch of that exact persisted message shows `originSource: ""`, with valid session, agent, role, author, channel, timestamp and order key. The persisted conversation view accepts it. The protocol display-stage function also accepts empty `source`; it requires role and channel.
- Direct trigger: projecting a newly arriving message before the persisted transcript refresh has absorbed it invokes `liveMessageFromInfo`. It rejects empty `originSource` as incomplete identity and throws inside Solid's reactive render path.
- Root cause: the live Overlay projection requires a nonempty source while the backend bridge explicitly emits an empty string when no source is supplied. The prior switching fix guarded stale resource values by target key; it did not address a render exception from valid live message metadata. The persisted route, Session ownership, and task scheduler are not implicated by the observed failure.
- Impact: any live child Session message whose source is the valid empty string can interrupt the Side Dock render while it is selected, leaving selected-tab state and rendered body divergent. The affected scope is live child transcript projection; there is no evidence of persisted message loss or agent execution failure. Other source fields remain unknown until further evidence.

## Plan

1. Align live message validation with the persisted view: require `originSource` to be a string, allowing `""`; retain required identity, role, channel and timestamp checks.
2. Add a focused positive service test using a new live message with empty `originSource`; assert its rendered stage and card content.
3. Run the focused service test, Overlay typecheck and build plus documentation check. Validate the actual Side Dock through an isolated served page and manual screenshot review without touching the running OpenCorvus process. Record any limitation if the active live event cannot be reproduced safely in the isolated environment.
4. Obtain independent read-only review of the final diff and verification, resolve findings, then commit and push this task's changes according to the repository workflow.

## Status

`liveMessageFromInfo` now requires `originSource` to be a string while accepting the backend's valid empty string. A focused positive service test projects a newly arriving `frontend-design` message with that exact metadata into the selected Session card.

- The focused Overlay service file passed (14 tests); Overlay typecheck, `docs:check`, `git diff --check` and the production Vite build passed.
- The running backend's exact child-session route returned six different Session transcripts. The isolated pre-fix browser logged the live-message identity exception for the exact persisted message with `originSource: ""`.
- Because the user forbids restarting the active backend/client, post-fix UI verification used a separate Vite development page at `http://127.0.0.1:5173/` connected read-only to the active backend. This is the explicitly needed independent frontend server exception to the normal `/ui` development-mode route. Actual clicks selected `source-investigator` and then `interface-designer`; manual screenshots showed matching selected tabs and transcript bodies, and the isolated page console had no errors. This verifies navigation and rendering with real task data; the focused service test covers the live empty-source event itself.
- No UI automation test, snapshot, browser fixture or screenshot baseline was added or run. The active OpenCorvus process and task were not stopped or restarted.

Independent read-only review found no actionable issue. It confirmed the backend bridge and persisted-view source contract, the preserved identity checks, and the focused live-message projection test. It also confirmed that the visual evidence is described as real tab switching, not as a replay of the exact live event.
