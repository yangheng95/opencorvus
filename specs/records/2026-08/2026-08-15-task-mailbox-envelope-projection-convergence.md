# Task mailbox envelope projection convergence

## Recall

- User request: continue the scheduler root repair with newly supplied read-only evidence that an architect completed but a durable `mailbox.message` repeatedly crashed Task preparation and Server-Sent Events (SSE) replay because envelope identities had been removed from payload.
- Acceptance:
  - durable Protocol payload keeps Task and Session identity only in its canonical envelope columns;
  - one shared read-time mailbox projector reconstructs and validates the full public event properties from envelope plus durable body;
  - Task Orchestrator description, Mailbox list, idempotent mailbox replay, notification resolution, Task event SSE replay and acknowledgement state all consume that same projection;
  - the already persisted current-shape event is readable without database mutation or compatibility fallback;
  - malformed or contradictory envelope/body identity fails closed at the shared projector;
  - focused positive tests execute the real writer, raw durable read, Protocol EventView, route serializers, scheduler mailbox read, replay and acknowledgement paths;
  - no user process is restarted and no reported production database is modified.
- Hard constraints: preserve `protocol_event` envelope as the sole identity authority; do not restore `taskID`, `sessionID`, `interactionID` or `orderKey` to durable payload; do not add a legacy reader, dual schema, payload mutation, route-specific repair or exception-swallowing fallback; unavailable production data remains unknown, never zero; no User Interface automation tests are added, changed or run.
- Read material: user-supplied incident reconstruction; `packages/opencorvus/src/engine/protocol.ts`; `packages/opencorvus/src/engine/mailbox.ts`; `packages/opencorvus/src/engine/model.ts`; `packages/opencorvus/src/bus/bus-event.ts`; `packages/opencorvus/src/protocol/store.ts`; `packages/opencorvus/src/protocol/protocol.sql.ts`; Task/Session route serializers; Orchestrator description; current Task-control architecture and existing lifecycle EventView projection.
- Repository search:
  - `EngineProtocol.eventInput` validates full Bus properties, transfers Task/Session/Interaction/order identity to envelope columns, then deletes those keys from the durable body;
  - the database check `protocol_event_payload_envelope_shape` enforces that current schema;
  - `listRecentTaskMailboxMessages`, Mailbox item projection and mailbox idempotent replay parsed the raw body with `MailboxAgentMessagePayload`, which requires both deleted identities;
  - `mailboxState` repeated the same defect for `mailbox.acknowledged`, whose full schema requires the envelope-owned Task identity;
  - `ProtocolStore.eventView` already owns read-time derived lifecycle routing but did not rehydrate mailbox properties, so every dynamic notification resolver in Task list, Task SSE and Session SSE received the incomplete body;
  - `describeTask` reads recent mailbox messages while preparing the Orchestrator prompt, coupling the same deterministic parse failure to retries and reopened Task epochs;
  - no other direct raw Protocol payload parser found by the bounded search uses these mailbox schemas; other payload readers use domain-specific durable schemas.
- Existing uncommitted work: the same authorized Task already contains the `no_action` convergence implementation and diagnostic projection changes described by `2026-08-15-task-root-no-action-convergence.md`; all remain in scope and uncommitted.
- Independent agent feedback: the preceding independent no-action review did not inspect this newly supplied mailbox incident. The completed combined delivery must receive a fresh uninvolved read-only review covering both fixes, with another review after any repair.

## Facts, inference and unknowns

Observed evidence supplied by the user records architect `idle`, terminal `completed` and terminal-success dispatch settlement at 2026-08-15 19:22:57 Asia/Shanghai. Event `pev_g0VSMbBLr00cZivsoEvj` has Task/Session envelope identity and lacks those fields in payload, matching current writer and database schema. The same Zod parse failure occurred at Task preparation in epochs 1 and 2 and was logged 187 times. The later debug bundle rendered `active` plus architect `streaming`, contradicting persisted epoch-2 Task failure and architect terminal facts. The sidecar was unreachable at the later inspection and exited at 11:32:05Z.

The direct trigger is reading the current-schema durable mailbox body through a full ingress-property schema. The root cause is duplicated representation contracts: writing correctly uses envelope-owned identity, while mailbox and notification consumers incorrectly treat the body as the original ingress object. The repeated SSE reconnect loop and stale UI projection are strongly supported consequences; the model's internal reason for individual actions and the exact screenshot-time process state remain unknown.

The empty architect graph and pending coordination outcome are separate semantic/Tool-authority findings. They are not required to explain the deterministic mailbox parse loop and are not silently classified as fixed by this change.

## Canonical repair

Create one mailbox protocol projection module with:

- strict full public property schemas;
- strict durable body schemas formed by omitting envelope-owned identity;
- `projectMailboxAgentMessagePayload(event)`;
- `projectMailboxAcknowledgementPayload(event)`.

Each projector derives Task identity from the Task aggregate (or explicit Task correlation for non-Task aggregates), derives Session identity from the envelope, parses the durable body strictly and returns the full property object. Missing envelope identity, identity of the wrong identifier kind, body identity duplication or malformed content fails at this one boundary.

`ProtocolStore.eventView` applies the projector before any subscriber, route or notification resolver sees the event. Direct database mailbox consumers reuse the same function. Durable rows remain unchanged, so already persisted current-schema events recover immediately after code deployment without a data migration.

## Verification

A focused production-path contract creates a real Task/root/architect Session, records one mailbox message, and proves:

1. raw `protocol_event.payload` contains only the mailbox body;
2. envelope owns Task/Session identities;
3. exact invocation replay returns the same event;
4. `ProtocolStore` EventView restores the full properties;
5. scheduler recent-mailbox read returns the same identities and body;
6. Task SSE and Task-list serializers resolve the dynamic notification without error;
7. a real acknowledgement persists without Task identity in its body, projects Task identity from the envelope and updates the Mailbox read view.

Run this contract through the repository isolated runner, then run related Protocol, Task-control and package type checks. A real Provider is not required to prove this deterministic storage/read contract; the existing real Task-control checker remains required for the combined no-action lifecycle behavior when credentials and exact model projection are authorized.

## Completion record

Implemented one shared strict mailbox envelope projector and routed raw mailbox reads, idempotent replay, Mailbox state/list/delete, Protocol EventView, dynamic notifications and SSE serializers through it. Durable payload shape and existing rows remain unchanged. The first independent delivery review found one remaining duplicated acknowledgement schema; `Event.MailboxAcknowledged` now reuses the same shared schema. The second read-only review found no unresolved P0-P2 issue.

The official isolated mailbox production-path contract passed 1/1 and is included in the combined 8/8 focused result. Related Protocol projection tests passed 3/3, full workspace typecheck passed, the generated bilingual API reference and `docs:check` passed with 333 operations in 25 groups, and `git diff --check` passed. No user process, production database or credential was read or mutated during implementation or validation.
