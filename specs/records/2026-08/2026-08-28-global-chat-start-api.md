# Global Chat Start API

## Recall

- User requirement: the public API should not appear to support only Task and
  Mission; starting a Chat with its first user message must be a direct,
  discoverable operation.
- Acceptance:
  - one request creates a visible global Chat, persists the first real user
    Message, and starts the Chat agent;
  - the response returns the exact Project directory, Session ID, and Message
    ID needed to subscribe to the canonical Session Server-Sent Events (SSE)
    stream;
  - retrying the same caller-owned request identity converges on the same Chat
    and Message, while a changed payload for that identity returns a typed
    conflict;
  - Provider execution remains streamed and detached; the start response never
    buffers a complete model reply;
  - OpenAPI, generated Software Development Kit (SDK), English and Chinese API
    reference, and focused production-route tests expose the same contract.
- Hard constraints: keep Session/Message/Part as the only conversation fact
  source; do not create a Chat-specific transcript, hidden/synthetic Message,
  Task, Mission, non-streaming Large Language Model (LLM) call, fallback route,
  or User Interface (UI) automation test. Preserve all unrelated dirty-worktree
  changes and do not use real Provider credentials for deterministic tests.
- Read before implementation:
  - `specs/current/architecture/07-panel-reactivity.md` Session stream cutover
    and canonical identity;
  - `specs/current/architecture/18-scheduled-automations.md` global Chat and
    `SessionWake` ownership;
  - `packages/opencorvus/src/server/routes/{global,session,mission}.ts`;
  - `packages/opencorvus/src/chat/{global-chat-service,session}.ts`;
  - `packages/opencorvus/src/session/{wake,index}.ts`;
  - generated OpenAPI/SDK and bilingual API references.
- Full-repository search results:
  - `POST /global/chat` only creates an empty temporary-project Chat;
  - project Chat creation is `POST /coding/chat/session`;
  - all ordinary Chat/Work messages already converge through the canonical
    Session prompt and Session SSE surfaces;
  - the Overlay intentionally performs create then prompt because Ctrl+N also
    needs an empty Chat;
  - global scheduled automation already creates a visible Chat through
    `GlobalConversationService` and starts it through `SessionWake`;
  - `client.chat` currently owns capability settings, while Chat creation is
    nested under `client.global.chat` or `client.coding.chat`.
- Independent agent feedback before implementation: none. The required
  delivery review will be performed after the first complete verification pass.

## Problem depth and impact

### Observable symptom

Task and Mission each expose an intent-bearing high-level start operation, but
Chat exposes only empty-Session creation. A caller must discover that the first
Chat turn is a second, generic `session.prompt` request. The generated SDK
therefore has no obvious `client.global.chat.start()` operation.

### Direct trigger and root cause

`POST /global/chat` validates only an optional model and returns immediately
after `GlobalConversationService.create`. The data model is correct—Chat is a
right-sidebar `assistant` Session—but the public API stops before accepting the
first real participant Message. The missing layer is an application-level
composition of global Chat allocation and the existing durable Session wake.

### Why the old path is insufficient

Documenting the two calls would improve discoverability but would still leave
the caller responsible for the create-to-prompt failure window, retry identity,
and stream attachment coordinates. Adding `/chat/message` would instead create
a parallel Chat message protocol beside `/session/:sessionID/message`. Waiting
inside a composite request for the full assistant answer would hide live
streaming until completion. None of those options fixes the actual public
contract gap.

### Affected definitions and callers

- Global route schema, response, error mapping, and OpenAPI operation ID.
- `GlobalConversationService` creation identity and cross-process retry
  convergence.
- `SessionWake.WakeReason` provenance for an external global Chat start.
- User-upload materialization shared with Mission wake.
- SDK generation, bilingual API reference, focused route/idempotency tests, and
  architecture/spec indexes.
- Existing empty Chat creation, Overlay submission, project Chat creation,
  ordinary Session prompt, Task, Mission, Work, and scheduled automation remain
  behaviorally unchanged.

## Contract

Add `POST /global/chat/start` with operation ID `global.chat.start`.

Request:

```ts
{
  requestID: string
  text: string
  attachments?: UserUploadBytes[]
  model?: `${provider}/${model}`
}
```

`requestID` is caller-owned and stable across transport retries. It derives the
canonical Session, Message, Part/control identities and a payload fingerprint.
Because this operation allocates a new anonymous Project, initial attachments
accept inline base64 bytes only; a project-owned `/attachment/...` reference
cannot exist in that Project before the start request. Later Chat turns retain
the ordinary Session prompt attachment contract.
The response is HTTP 202 after the user Message is durably accepted and its
canonical wake is scheduled; it does not wait for physical owner activation:

```ts
{
  requestID: string
  session: Session.Info
  messageID: string
}
```

The caller then subscribes to
`GET /session/:sessionID/events?directory=<session.directory>`. That stream's
subscribe-before-snapshot cutover supplies the just-created user Message even
when it was committed before the subscription, then carries live assistant
deltas through the same Message/Part lineage.

The existing `POST /global/chat` remains the only empty global Chat creation
operation because the product has a real empty-Chat workflow. It is not a
fallback for `global.chat.start`, and `global.chat.start` does not implement its
own conversation store or model loop.

## Idempotency and failure convergence

- Derive the Chat Session ID, user Message ID, and control ID from the stable
  request identity with `Identifier.deterministic`.
- Persist `{version, requestID, fingerprint, messageID}` in the Session's
  creation metadata in the same insert that first publishes the Chat.
- Reuse an existing exact Session only when it is a global right-sidebar Chat
  and its identity fingerprint matches. Return a typed conflict for the same
  request identity with a different body.
- If the Session exists but the Message does not, inject the Message and start
  its wake. If the Message exists, validate its exact API-wake provenance and
  resume/rejoin the persisted wake occurrence.
- A concurrent loser rereads the winning Session/Message after a unique-identity
  conflict and converges through the same validation path. Any temporary
  Project allocated by a losing creation is removed through the existing
  recoverable creation cleanup.
- A process failure after Session creation, after Message commit, or after loop
  activation is recoverable from those durable identities; no queue entry or
  in-memory controller is business truth.

## Shared wake audit

The change adds one provenance variant to the shared wake mechanism, so the
horizontal audit covers every production entry:

- Task root ingress remains owned by `EngineService` and is not routed through
  the new Chat start.
- Mission operator/recovery wakes retain `mission.*` reasons and Mission public
  Session authority.
- Scheduled automation and scheduler messages retain their exact fire/event
  identities, leases, retry/restart recovery, and completion receipts.
- Conversation handoff retains caller Session/Message lineage.
- Global Chat start uses an exact request-derived Session occurrence and cannot
  target Task, Mission, projected worker, or another Project's Session.
- Normal completion, terminal error, abort, restart resume, concurrent duplicate
  submission, serial submissions, and multiple Projects all remain projected
  from durable Session/Message facts. The new route returns acceptance, not a
  fabricated terminal result.

## Verification

- `bun test --timeout=0 test/server/global-chat-start.test.ts`: 3 passed,
  including HTTP 202, inline attachment persistence, live assistant Part events
  through the real Session SSE route, exact replay after Project promotion,
  typed foreign-Message/request conflicts, and declared MIME validation.
- `bun test --timeout=0 test/global-chat-start-process.test.ts`: 1 passed with
  27 assertions. Two independent Bun processes share one database and one real
  local streaming Provider; exact concurrent starts converge, conflicting
  payloads split into 202/409, and recovery crosses both Session-only and
  production Message-commit/loop-activation process-exit boundaries. The latter
  cut uses the real `startGlobalChat -> SessionWake` path and exits immediately
  before the production loop calls `SessionPrompt.loop`.
- `bun run build` in `packages/sdk/js`: generated OpenAPI client passed.
- `bun run typecheck` in both `packages/opencorvus` and `packages/sdk/js`:
  passed.
- Root `bun run docs:api`, `bun run api:routes-check`, `bun run docs:check`,
  `bun run check:architecture-index`, `bun run check:sdk-imports`, and
  `git diff --check`: passed.
- No UI automation or visual acceptance is required because this task changes
  no UI source or product layout.

## Independent delivery review

- First review found five valid gaps: the route test observed only an SSE
  snapshot, foreign deterministic Message ownership was not rejected, Project
  promotion broke exact replay, empty attachment MIME escaped as a server
  error, and cross-process/crash convergence lacked a real checker. All five
  were corrected and their focused checks rerun.
- Second review found that the initial Message-only crash fixture synthesized a
  partial row instead of crossing a production cut. It now exits from the real
  Session wake immediately before loop activation, and the full process checker
  passes again.
- Final review found no unresolved issue after the shared prerequisite landed
  independently as `34ecb65bf` (cross-process Session prompt ownership) and
  `75757d958` (exact managed-parent occurrence). On that committed `HEAD`, the
  route test passed 3/3, and the process checker passed with 27 assertions,
  including one physical Provider request for the same-payload two-process
  race. Both package typechecks and the route, docs, architecture, SDK import,
  and diff checks passed. The independent reviewer confirmed that no
  uncommitted prompt-owner behavior contributes to the result.

## Risks and exclusions

- Real Provider quality and credentials are excluded; deterministic streaming
  proves the runtime/API contract without claiming live-provider acceptance.
- Existing Chat continuation remains `session.prompt`; this task does not add a
  global lookup API for arbitrary existing Chats.
- Empty Chat creation remains intentionally separate and is not deprecated.
- Initial URL references are excluded because their owning Project cannot be
  known before this one-call allocation; inline attachment bytes are
  materialized into the newly created Project before the wake starts.
- Attachment byte payloads are never written to specs, logs, or identity
  metadata; only their request fingerprint is stored.
