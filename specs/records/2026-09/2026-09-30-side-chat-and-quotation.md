# Side chat and quotation

## Recall

- User request: 调查 Codex 如何实现 side chat，并实现 OpenCorvus 的 side chat 和 quotation 功能。
- Acceptance: desktop main conversation remains selected and running; an independent side conversation inherits completed history as reference, streams answers, supports stop/retry and reopening; selected text can be quoted in either composer, reviewed/removed before sending, and remains visible in the persisted user message.
- Constraints: one agent; preserve unrelated dirty work; existing configuration, transport, Session execution, transcript and visual primitives; no UI automated tests; real `/ui` interaction and screenshots; focused positive backend tests; commit only this task and merge upstream before push. Provider credential use requires the pending explicit authorization.
- Read: AGENTS.md; architecture 03-control, 07-panel; Session fork/index, message identity, prompt schema, LLM composition, effective configuration; session HTTP routes and event snapshots; ChatComposer, Conversation, ChatBubble, RightDock, main, composer-draft, subagent-conversation, HostTransport.
- Searches: repository-wide side-chat/quotation/selected-text/fork definitions and callers. No user side-chat or quote selection implementation exists. Ordinary Session.fork creates a child and clones its transcript atomically. Main conversation/event readers include the entire child tree. Global frontend chat request ownership is single-selection scoped.
- No delegation. Existing unrelated changes were inventoried and saved outside the repository before edits, including shared spec indexes and LLM code.

## Codex evidence

- Official behavior: https://developers.openai.com/blog/mastering-codex-remote-for-engineering and https://learn.chatgpt.com/docs/developer-commands (opened 2026-09-30): `/side [question]`, selection → Ask in side chat, separate transcript, parent can keep working.
- Read-only local implementation inspection: installed OpenAI.Codex 26.917.6896.0, `app.asar/webview/assets/local-conversation-side-chat-e390585abe5b.js`: local fork uses `ephemeral: true`, disables a synthetic fork item, opens a `sidechat:` Right Dock tab, and appends instructions distinguishing inherited reference history from active side-chat requests. Closing discards the temporary chat. No user window/process was manipulated.
- `app-primary-923a2b3e8cd1.js`: selected-text overlay supports Ask in side chat and quotation attachments. This is packaged implementation evidence, not a claim that desktop source is public. Proprietary code is not copied into the repository.

## Analysis and impact

- Observable gap: transcript supports copying but cannot quote or ask separately. Direct trigger: selecting a passage has no action surface.
- Root cause: the composer has only plain draft/attachments and the workspace mounts only the globally selected conversation controller. An ordinary fork is a runtime child, so reusing it unchanged would mix side-chat events into the parent tree and would share inappropriate Task/Mission lineage.
- Old paths were built for agent children and independent primary chats, not this feature; there is no previous side-chat repair to retain.
- Chosen data contract: side chat is an independent assistant root with a typed `sideChat` reference to its source and inherited message boundary. Reuse the atomic fork implementation, copy completed history and effective root overlay; retain exact real messages and remap their identities. Do not copy Task/Mission runtime identity. The parent relation is reference metadata, not execution ownership.
- Execution: existing session prompt, cancellation, message storage and event stream; side-chat prompt guidance is derived from persisted metadata at the shared LLM composition boundary. No alternate model client, non-streaming model call, host tool-choice gate or synthetic user message.
- UI: scoped Right Dock side-chat surface with history disclosure, independent composer/stream/status, explicit creation and local draft ownership. Main conversation header and `/side` open it; selection toolbar offers quotation and side chat. Quotation is visible blockquote text in the user-authored submission, using the existing send path.
- Lifecycle: preserve side-chat audit data and allow reopening; closing a UI tab hides it rather than claiming destructive ephemeral storage. This intentionally follows OpenCorvus durable Session contracts rather than Codex's discard-on-close persistence policy.
- Risks: concurrent parent streaming, connection snapshot/delta ordering, switching projects during async creation, draft removal after failed send, incomplete inherited tool turns, source deletion, malformed metadata. Validate independent roots, bounded completed-history copy, project authority and positive error contracts. No scheduler/queue anomaly has been observed; this feature must not create a new scheduler owner.
- Public contracts: additive side-chat create/list routes and fork purpose, scoped draft quotation data; update generated API docs and surface architecture. UI tests are excluded; encountered UI-only tests must be removed, not run.

## Implementation and validation plan

1. Extend the canonical fork primitive with an independent side-chat purpose and completed-history boundary; add typed identity/guidance and source-scoped create/list APIs.
2. Add scoped quotation draft/chip and selection actions; reuse visible Markdown and send contract.
3. Mount a side-chat Right Dock panel using existing transport, transcript projection, Markdown/card and input primitives; independent stop and reconnect.
4. Run focused positive Session/API tests, overlay/backend typechecks, i18n, build, docs checks. Start isolated development server, interact with `/ui`, inspect screenshots, and verify actual model streaming if authorized.
5. Record results/limitations, stage only this task, commit, fetch/merge upstream, inspect pending commits and push.

## Progress

- Investigation and implementation are complete for local acceptance. Additive routes, atomic independent fork, shared prompt composition, quotation drafts and selection toolbar, and the Right Dock panel are implemented. Model-backed acceptance is still unverified as detailed below.
- User steering: UI design is part of acceptance; avoid a bare functional prototype. First desktop screenshot review found duplicate headings and an unexpanded translation placeholder. Refine hierarchy, spacing, quotation treatment, distinct icons, suggested follow-ups, and state feedback; verify again on the real page.
- Focused backend route checks passed for assistant, Task-root and Mission source identities plus cross-project rejection (4 tests / 32 assertions). Existing atomic-fork checks passed (3 tests). Quotation/draft checks passed (7 tests). The first Mission fixture attempt omitted its canonical identity and was corrected to use `ensureMissionSession`; no production invariant was weakened.
- Model credentials have not been authorized. The local visual workspace contains explicitly labelled acceptance sample messages, written through canonical Session persistence. These are presentation inputs, not evidence of model-generated answers or Provider end-to-end success.
- Independent frontend stream ownership uses the same Session event snapshot/parser/delta projection as the subagent transcript and the canonical Session status endpoint/lifecycle events. No scheduler, queue or Task/Mission wake owner is added. Parent and side Session trees are independently checked through real routes.

## Verification

- Real development server `/ui` on isolated port 4199; [visual evidence](../../artifacts/2026-09-30-side-chat/README.md). Manually checked 1440 × 960, dark/light and Chinese/English. Selection → Quote, selection → side chat, Chinese draft editing, independent main/side draft persistence, reference history disclosure, closing/reopening, removal and `/side [question]` all exercised through the real page.
- `bun run test -- test/server/side-chat.test.ts`: 4 passed; includes actual shared LLM system composition for the new Session.
- `bun run test -- test/session/fork-atomic-transcript.test.ts`: 3 passed.
- `bun run test -- test/verification-discipline.test.ts`: 24 passed.
- `bun run test:unit -- test/quotation.test.ts test/composer-draft.test.ts`: 8 passed, including serialized quotation provenance and stable request identity across retries.
- `bun run test:unit -- test/side-chat-transport.test.ts`: 2 passed. These are local HostTransport contract tests, not actual Provider or UI end-to-end evidence.
- Backend and Overlay typechecks passed. Overlay production build passed (existing chunk-size and third-party directive warnings). i18n, CSS tokens, renderer public surface, API routes, docs and architecture indexes passed.
- Remaining external acceptance: actual model-generated streaming answers, real model cancellation and concurrent model execution were not exercised because credential use was not authorized. No credentials or model account data were copied into the isolated runtime.
- Pending questions and permissions reuse InteractionCard and canonical reply endpoints. A supplementary same-process, active-scope local Question harness rendered a real pending card; keyboard selection + Answer produced HTTP 200 and resolved the real `Question.ask` promise with `[["context"]]`. Detached verifier attempts lacked the production request lifetime and were discarded; production runtime ownership was not changed.
- Side-chat UI and quotation acceptance is complete for the local scope above. Model-backed acceptance remains explicitly unverified. Git delivery is recorded in the final task response.
