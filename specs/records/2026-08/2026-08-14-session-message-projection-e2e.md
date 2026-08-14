# Public Session message projection and end-to-end repair

## Recall

- User request: pause packaging and release work because ordinary conversation is unusable; reproduce and repair the real end-to-end Session send path before resuming release work.
- Observable failure: the desktop showed `Send failed: tree-writer: message msg_g0VSHBJ9800dq4Pw6vfF missing role/author/channel; backend bridge must preserve persisted origin` after the right-sidebar request `帮我把桌面主题调成亮色`.
- Acceptance: the persisted Message retains its authored identity; the public `POST /session/:sessionID/message` response projects the same canonical `role`, `author`, `channel`, Agent identities, origin source, ordering, and visible Parts contract used by live backend events; a focused positive route test passes; and a fresh real development server plus real browser session can send a prompt, receive the assistant reply, and render both turns without a projection error.
- Hard constraints: no release packaging while this incident is open; no UI automation tests or synthetic browser fixtures; no UI fallback that guesses missing identity; preserve the tree-writer fail-closed contract and the user's unrelated `.gitattributes` / `.codex-tmp/` changes.
- Read evidence: the user's exact failure screenshot; Overlay `promptSessionMessage` and `ingestPersistedConversationMessage`; `tree-writer.requireMessageOrigin`; the task-message bridge; public Session prompt route; current session-prompt identity tests. The repaired real-page run is preserved as [a visual screenshot](../../artifacts/2026-08-14-session-message-projection-e2e.png) and [sanitized console/persistence evidence](../../artifacts/2026-08-14-session-message-projection-e2e.json).
- Repository search: task-scoped sends already call `projectPersistedTaskMessage` before returning `user_message`; standalone/right-sidebar Session sends return the raw persisted assistant Message directly and then immediately pass it to tree-writer. Live SSE uses `enrichMessageEventProperties`, so only the synchronous Session route response lacks the canonical projection.
- Independent agent feedback: the first review found that the retry assertion omitted `resolvedRole` and exact Message/Part ordering, the new ignored spec required explicit staging, and the real-page evidence needed repository locators. The implementation itself had no production regression finding. The three delivery findings were addressed before re-review.

## Analysis

- The failing persisted row is healthy: `role=assistant`, `author=work`, `agent=work`, and it belongs to the right-sidebar Session. The failure is therefore not Message creation or storage corruption.
- `promptSessionMessage` immediately projects the synchronous route response so the completed reply is visible without waiting for replay. `POST /session/:sessionID/message` currently returns `Message.WithParts` from `SessionPrompt` without the bridge-owned `channel`, `agentID`, `sessionAgentID`, `resolvedRole`, and normalized `originSource` fields.
- Tree-writer correctly rejects that incomplete response. Relaxing tree-writer, deriving a fallback in the UI, or skipping immediate ingestion would create a second protocol source and leave route responses inconsistent with live SSE and task-scoped sends.

## Plan

1. Generalize the existing persisted-message bridge so both task-owned and standalone Session route responses use one projection implementation; keep the task function as the existing public task contract.
2. Project the completed public Session response through that bridge before serialization.
3. Strengthen the existing route-level positive test to assert the complete identity/channel/source projection for both first submission and exact retry.
4. Run the focused route test, related bridge/session checks, typecheck, docs/diff checks, and then start a fresh development server on an isolated port/runtime.
5. Use the real page to send a fresh Session message and visually verify the complete user→assistant conversation. Obtain independent read-only review before commit.

## Results

- `projectPersistedSessionMessage` and `projectPersistedTaskMessage` now share one private persisted-message projector. Both apply the existing event bridge to Message info and every Part; task projection continues to pass the Task identity, while standalone/right-sidebar Session projection derives its channel and Agent ownership from the persisted Session.
- `POST /session/:sessionID/message` projects the completed assistant reply before serialization. Its OpenAPI response now declares the bridge-owned `resolvedRole`, `channel`, `agentID`, `sessionAgentID`, `originSource`, and optional `parentSessionID` fields in addition to the existing `orderKey`; regenerated OpenAPI and TypeScript SDK artifacts match the route.
- The focused public Session route suite passes `9/9`. The first-submission assertion now requires the exact assistant/chat/assistant origin tuple, canonical Agent identities, normalized source, Message order key, and visible Part order key; exact retry must return the same assistant and the complete same projection, including `resolvedRole` and every Message/Part `orderKey`. Session conversation history passes `1/1`, and the OpenCorvus package typecheck passes.
- A fresh server ran on isolated port `52125` with an isolated database, copied credential and model catalogs, and project `D:\myhexin-local\opencorvus`. The UI visibly exposed `openai/gpt-5.5`; a real Chat/Work Session sent `会话端到端验收：请只回复 SESSION_E2E_OK，不要使用工具。`, rendered the exact assistant response `SESSION_E2E_OK` after six seconds, returned to `Not running`, restored the composer, and showed no error dialog. The [real-page screenshot](../../artifacts/2026-08-14-session-message-projection-e2e.png) preserves the conversation and restored composer; the [sanitized evidence record](../../artifacts/2026-08-14-session-message-projection-e2e.json) records the zero-error browser console observation and exact persisted Message identities. The route-level focused test proves the canonical synchronous response projection, including origin and ordering fields. The isolated server log did contain an unrelated provider-refresh credential warning, so it is not described as globally clean; the selected `openai/gpt-5.5` request itself completed successfully.
