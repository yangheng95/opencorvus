# CS-037 — Overlay projection prerequisite protocol

## Recall

- User requirement: continue the repository code-smell remediation until the accepted backlog is empty; work directly and parallelize independent batches; repair root causes without moving defects between layers; merge the latest remote state before the final push.
- Acceptance target: out-of-order or removal message events whose Session, Message, or Part projection is missing must produce one structured prerequisite outcome, schedule one selected-Task recovery, and after recovery expose the expected card/Part without depending on English error text.
- Hard constraints: one current protocol, no prose fallback or compatibility branch, no UI automation, focused positive production-path test, independent read-only delivery review, exact task-owned commit, and no changes to the unrelated dirty `workspace.ts`.
- Read sources: repository `AGENTS.md`; `CS-037` in the continuous audit; the current architecture index (which has no separate Overlay projection document); Overlay `services/tree-writer.ts`, `services/events.ts`, `services/sse.ts`, `services/selected-task-recovery.ts`; board/card-tree stores and existing non-UI Overlay tests.
- Repository search: only Tree Writer prerequisite helpers create the six prose variants, only `events.ts` parses those prefixes, and the real selected-Task SSE entry calls `handleEventStreamEvent` after `routeSSEEvent`. No existing test covers the typed recovery boundary.
- Independent-agent feedback: none for this batch before implementation; two other agents are independently implementing non-overlapping CS-021 and CS-075 batches.

## Problem and control flow

`requireSessionProjection`, `requirePartProjection`, and `requireMessageCardProjection` currently throw plain `Error` values whose English message embeds both event kind and missing entity. `routeSSEEvent` catches the error and reparses six exact prefixes. The display string is therefore a hidden cross-module control protocol: wrapping or rewording it turns a recoverable ordering condition into an unhandled exception and leaves the selected conversation projection incomplete.

The backend event and transcript remain durable; only the renderer projection prerequisite is absent. Recovery is therefore correct, but the decision must be owned by a structured Tree Writer outcome rather than duplicated prose knowledge in Events.

## Design

1. Tree Writer exports one `ProjectionPrerequisiteError` with a stable discriminant plus exact `eventType`, `missingEntity`, `missingID`, and optional `sessionID`. The human-readable message is diagnostic only.
2. All three prerequisite helpers throw that type. Events recognizes only its stable type/discriminant and deletes every English `startsWith` branch in the same change. Malformed events and unrelated invariant errors continue to throw.
3. No second precheck or fallback is added. The existing cheap selected-Task/session precheck remains for the separate “root Session identity not yet loaded” case; Tree Writer owns graph-specific Session/Message/Part prerequisites.
4. A focused non-UI test drives the real `routeSSEEvent` path with missing Session, Message, and Part occurrences, records one exact recovery dispatch per event, hydrates a valid Message/Part during recovery, and asserts the resulting card/Part and sequence. It also changes the diagnostic message and proves classification is unchanged.

## Impact and exclusions

- Internal Overlay contract only; no backend route, OpenAPI, generated SDK, persistent data, or UI component changes.
- The wider Tree Writer ownership problem remains CS-020; Conversation visibility remains CS-038.
- No DOM, component, screenshot, Playwright, snapshot, or source-text test is added or run.

## Delivery state

- Implementation: complete. Tree Writer emits one structured prerequisite error for missing Session, Message, or Part projection; Events consumes only its stable discriminant and no longer parses prose.
- Verification: focused service-level production-path test `2/2`, `13` assertions; the Session, Message, and Part cases each traverse `routeSSEEvent`, schedule exactly one recovery, restore the target card/Part, and preserve the live sequence. Overlay typecheck and task-owned diff check pass. No UI automation was run.
- Independent delivery review: first review found that only the Part case crossed the production route. After expanding the real route matrix to Session, Message, and Part, the same reviewer completed a second read-only review with no remaining actionable finding.
- Commit/push: pending.
