# Project memory architecture

Project memory has three explicitly scoped authorities:

1. Session `MEMORY.MD` is a read-only continuation checkpoint produced by successful compaction. Its completed compaction-summary assistant owns the append-only checkpoint Part; the source user Message is never marked or mutated.
2. Project `MEMORY.MD` is a read-only Project context maintained exclusively by the fixed hidden `memory` helper agent.
3. Semantic memory (`note`, `episode`, `fact`, `lesson`, `profile`) is reusable main-agent-managed Project knowledge.

Both named documents use all caps. API and tool responses distinguish them with `scope=session` and `scope=project`; filename case is not a semantic discriminator.

## Pending user-input evidence

Trusted ingress supplies versioned Message-level provenance containing literal input frozen before host materialization. The canonical Session bundle transaction enqueues one host-owned `user_message` occurrence with the Task/conversation name, safe content/attachments, and up to two preceding visible transcript Messages. Direct-user Task creation and validated Question/Permission replies use the same pending contract. Runtime wakes, automatic resolutions, and internal service/tool calls do not.

Pending occurrence IDs are deterministic and replay must match the full canonical payload. Secrets, private-key blocks, inline payloads, and unsafe attachment references are redacted or omitted before persistence. `user_message` is an inbox, not a permanent archive: an accepted Organizer commit atomically consumes its exact ordered prefix. The Session transcript remains authoritative raw history.

## Dedicated Memory Organizer

The `memory` helper is separate from every main task agent, hidden, tool-free, and streaming-only. It receives only the current Project `MEMORY.MD` envelope plus a complete FIFO-prefix of sanitized pending evidence. It autonomously translates user wording into complete meaning, merges duplicates, applies corrections and superseding decisions, retains active goals/constraints/state, and compresses stale context. Host code never groups, scores, summarizes, selects document sections, or rewrites Organizer content.

The helper streams one complete replacement envelope. The host validates only base revision, exact covered occurrence prefix, nonempty safe Markdown, and the effective document token ceiling (hard maximum 10,000). One transaction increments revision, replaces the protected `project_context` envelope, and deletes exactly the covered pending rows. Stale or invalid candidates consume nothing.

The oldest pending FIFO occurrence is the Organizer's only model-provenance owner. Its Task-bound root Session, or its owning root Session when no Task exists, supplies one fenced effective configuration snapshot and its canonical top-level `model`; that same snapshot supplies Provider settings and Organizer budgets for the attempt. The hidden `memory` helper has no independent `agent.memory.model` field. Organization request events carry only Project identity, so automatic dispatch, the manual HTTP action, the `memory.project_organize` Tool, retry, coalescing, and restart recovery cannot select different models for the same pending head. A missing owner, root Session, or canonical `model` is an explicit unavailable settlement and never falls back to Provider history, registry order, environment, or caller identity.

Each pending transaction also publishes a durable organization request. One durable subscriber serializes/coalesces runs and survives scheduling and acknowledgement gaps. Project prompt injection is all-or-nothing: it injects the complete committed document when it fits the configured prompt budget, otherwise omits it and leaves a `memory.project_read` pointer. The former host-ranked semantic-memory auto-injection path is not parallel authority.

## Capacity and availability

When the document cannot incorporate pending meaning within the configured ceiling, the system persists `capacity_reached` and emits a durable user-facing attention event asking the user to organize/review memory. Oversized evidence and model-context incompatibility use the same visible, reconnect-safe notice contract.

FIFO applies only to the pending inbox when the Organizer has independently resolved the same closed missing-model configuration as unavailable on two consecutive serialized attempts and pending count exceeds the configured availability limit. A database-persisted exclusive lease carries a fencing token, expiry, current availability generation, and Project revision into both semantic commit and deletion transactions. A competing runtime cannot overwrite an unexpired lease; expiry permits crash recovery, while configuration changes immediately increment the generation and revoke the lease before another organization request is published. Known failed attempts release only their own lease. The first unavailable attempt only records a visible notice and deletes nothing. FIFO never edits Project `MEMORY.MD` and is never semantic organization. Provider request, authentication, transport, timeout, output, parse, capacity, and evidence-size failures are not closed-unavailable deletion authority.

The one per-Project background driver coalesces a request that arrives during an
active Organizer attempt into the same scheduled slot. When a configuration
change revokes that attempt, the persisted envelope moves to `retry_wait`; the
old model output cannot commit, and the scheduled slot consumes the already
queued request with the new availability generation before it is released. A
stale attempt cannot erase that redrive, leave an `organizing` shadow without a
lease, or discard pending evidence.

The unavailable proof is bound to the exact FIFO-head occurrence, its canonical Task/Session owner, the closed reason, and the configured model. One proof may remove at most that head after the second matching attempt; it cannot delete or advance the retry count for later evidence owned by another Task or Session.

The protected notice is available in Project reads and through the Project-memory Server-Sent Events stream. Overlay startup/project switching hydrates it and renders an actionable banner until the user acknowledges it or an Organizer commit clears it.

Generic semantic-memory search, full-text search, write, update, and delete exclude both protected `user_message` and `project_context` kinds. Project `MEMORY.MD` is exposed through `memory.project_read` and `GET /experimental/project-memory`.
