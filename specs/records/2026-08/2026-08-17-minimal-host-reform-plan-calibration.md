# Minimal Host reform plan calibration

Date: 2026-08-17

Authority: this record is the sole formal plan for the minimal-Host reform program. `docs/host-reform-plan.md` is a non-authoritative explanatory roadmap; each implementation slice must create its own dated Recall and replace the affected current-architecture contract in the same delivery.

## Recall

### User request

Calibrate the refactor plan under the user's explicit premise: the current Host has accumulated excessive engineering, invented gates and rules, and should be reduced with the design discipline demonstrated by minimal agent hosts such as pi. Stability is the result of a small, deliberately reasoned Host contract rather than more Host-owned workflow machinery.

### Acceptance criteria

- Make the minimal-Host objective and its non-goals explicit.
- Preserve only boundaries backed by real external authority: causal identity, durable effect idempotency, permission, process/operating-system isolation, and confirmation for irreversible operations.
- Remove projections, status words, capability wrappers, side-band registries, and recovery taxonomies as independent execution authorities.
- Distinguish a Host fault from a user/Provider/domain outcome without letting a Host fault freeze an entire Task or silently choose among conflicting effect facts.
- Mark intermediate repairs as intermediate; do not describe prompt filtering or terminal tool projection as the final minimal architecture.
- Make this record the sole formal implementation plan; keep `docs/host-reform-plan.md` as a non-authoritative explanatory roadmap and demote the generic layered framework document to background material.
- Keep the state audit actionable without replacing a blocking gate with unsafe best-effort execution.

### Hard constraints

- One current implementation and one fact source; no feature-flagged parallel Host architecture, fallback path, or compatibility layer.
- All language-model interactions remain streaming.
- Messages come only from real participants and remain visible; the Host does not synthesize or hide workflow messages.
- Host code may validate data integrity and irreversible-operation authority, but may not route around the model or teach workflow through a state machine.
- Current dirty-worktree changes belong to the existing refactor effort and must not be reverted or overwritten outside the plan documents and indexes in this calibration.
- Formal plans live in `specs/records/2026-08/**`; current architecture changes, when implemented, must converge `specs/current/architecture/**` rather than leave a competing source of truth.

### Sources read

- `AGENTS.md`
- `docs/host-design-critique.md`
- `docs/host-reform-plan.md`
- `docs/state-audit.md`
- `docs/code-smell-remediation-plan.md`
- `docs/framework-architecture-design.md`
- `specs/current/architecture/task-control-plane.md`
- `specs/current/architecture/task-runtime-directory.md`
- `specs/current/architecture/project-memory.md`
- `packages/opencorvus/src/session/loop.ts`
- `packages/opencorvus/src/session/prompt/parts.ts`
- `packages/opencorvus/src/orchestrator/tools.ts`
- `packages/opencorvus/src/orchestrator/agent.ts`
- `packages/opencorvus/src/project/instance.ts`
- `packages/opencorvus/script/run-tests.ts`

### Whole-repository search evidence

- Prompt delivery still uses `pendingDelivery`, `partitionPendingDelivery`, and `attachedReplyTargets`; the former prefix bug is repaired, but the final raw-transcript design is not yet present.
- Terminal conversation execution still projects a reduced Tool table through `projectTerminalConversationTools`; the throwing wrapper was removed, but status-derived capability curation remains.
- Project Instance has materially converged onto an exclusive FIFO entry turn plus serving-handle accounting; this is evidence for keeping the concrete small mechanism rather than introducing a universal Lease abstraction.
- `blocked/integrity_conflict`, its reducer branches, wake surface, tests, and FIFO stop behavior remain widespread and therefore require a horizontal Task/Mission/Session occurrence audit before removal.
- The tracked current Task-control architecture still describes lifecycle projections and effect fences that the reform intends to replace. That mismatch is migration input, not evidence that reform is forbidden; implementation slices must update the current architecture in the same delivery.
- At initial inspection, `docs/host-reform-plan.md`, `docs/host-design-critique.md`, `docs/state-audit.md`, and `docs/framework-architecture-design.md` were untracked. They are staged by this calibration as explanatory documents, while the source changes they describe remain outside this document-only delivery and cannot be claimed as committed implementation evidence.

### Independent agent feedback

The first independent read-only review found eight actionable issues: durable settlement was underspecified for possibly-executed effects; non-operator delivery could appear to gain reopen authority; the critique retained “first write wins/log and continue” language; formal plan authority still sat in `docs`; uncommitted source changes were described as delivered; state-audit constitution references and counts were stale; and Recall lacked verification results. The first correction pass addressed them. The second review found five residual wording/contract issues: `unknown/reconciliation_required` risked becoming a persisted projection, two old authority/reopen statements remained, one stale constitution number remained, two uncommitted-source claims remained, and review status was premature. The second correction pass addressed them. The final independent read-only review reported no unresolved findings and reconfirmed the 82-match/20-file audit count, document checks, staged-diff integrity, authority model, reopen boundary, and durable request/outcome contract.

## Calibrated decision

The active program is deletion-led Host reform, not a repository-wide Clean Architecture rewrite. Its target can be stated as one sentence:

> The Host transports and persists real participant facts, enforces only external and irreversible boundaries, and otherwise lets the model and tools conduct the work in the visible conversation.

The following distinctions prevent minimalism from becoming ambiguity:

1. A projection may describe work and choose presentation, but it is not independent authorization. Before an irreversible effect, the Host verifies the underlying causal facts, permission, epoch/occurrence identity, and idempotency key directly.
2. A Host fault is local to the exact operation or occurrence. It settles once, is visible and diagnostic, does not consume semantic retry budget, and does not invent a durable user Task state. Ambiguous effect facts fail closed for that effect; the Host never selects an arbitrary winner and proceeds. Every external effect must have one durable request before execution. If its outcome is absent, that request/outcome gap uniquely projects `unknown/reconciliation_required`; no unknown status or outcome row is persisted. At most one authoritative exact outcome may later be appended. Logs and process events cannot substitute for those facts.
3. Completion and failure are historical facts and presentation. Continuing the conversation is always possible unless the user explicitly cancelled or deleted it. Only an explicit user/operator ingress can create a new execution occurrence after completion/failure. Scheduler delivery, agent coordination, recovery, and late outcomes must carry and match an existing occurrence and can never obtain reopen authority.
4. Raw transcript is the endpoint. `pendingDelivery` is a bounded transition repair and must not be declared the final architecture while read-time partitioning and attached-target side state remain.
5. Concrete mechanisms stay separate when their invariants differ. Durable effect fencing, per-Project FIFO admission, process lifetime accounting, and ordinary in-memory single-flight are not merged merely because all have previously been called leases or locks.

## Implementation plan

| Slice | Required change | Exit evidence |
|---|---|---|
| Conversation visibility | Remove reply-target and status-based read-time curation. Every Provider request reads the complete canonical transcript at that instant, except cursor-owned compaction. | Positive prompt projection contract plus real streaming replay for mid-turn operator, scheduler, and coordination arrivals. |
| Occurrence continuation | Treat completed/failed as historical occurrence facts. An explicit user/operator ingress atomically opens new work; remove terminal-only Tool tables and handlers. Non-operator delivery can only continue a matching existing occurrence. | Completed and failed Tasks accept operator continuation through the ordinary ingress and Tool registry; stale scheduler/coordination delivery receives a durable stale/superseded settlement. |
| Project Instance admission | Keep concrete per-Project FIFO lifecycle admission and serving-handle accounting; remove mode upgrades and do not replace them with a universal Lease. | Concurrent open/dispose/serve, teardown fairness, detached re-entry, restart, and multi-Project isolation evidence. |
| Host-fault settlement | Settle a deterministic pre-effect Host fault once for its exact operation. For an external effect, require one durable request before execution; a missing outcome projects unknown/reconciliation-required without another status row, and at most one authoritative exact outcome may be appended. | One request and zero-or-one authoritative outcome per effect identity, no semantic retry storm, no duplicate external effect, and sibling Task/Project progress. |
| Tool authority | Remove WeakMap authority and hand-curated capability matrices. The unique Tool registry plus real installation, environment, permission, and irreversible confirmation facts project availability. | Adding one Tool changes one registration fact; ordinary, continued, Mission, and recovery paths receive the same environment-derived projection. |
| State/gate sweep | Apply the four-question test to every state, gate, fence, and retry category across Task, Mission, Session occurrence, terminal/recovery paths, concurrency, and Project isolation. | Every retained blocker identifies its source fact, irreversible/user boundary, natural exit, and exact occurrence; all others are deleted with focused positive contracts. |

Every slice has one current implementation: no feature flag, fallback, compatibility reader, or parallel architecture. The slice record must include whole-repository call-site search, current-contract replacement, focused positive tests, a real checker, and independent read-only review.

## Planned document changes

1. Rewrite the Host constitution around minimal positive responsibilities and the external-boundary test.
2. Replace “Task two-state enforcement” with occurrence-based continuation: terminal facts remain history; only an explicit user/operator message opens new work without a terminal-conversation capability regime.
3. Split every phase into target, landed intermediate, remaining deletion, and acceptance evidence.
4. Calibrate integrity-conflict removal to local fail-closed settlement rather than best-effort fact selection.
5. Mark the five-layer framework document as a non-authoritative exploration and remove it from the execution chain.
6. Mark the broad code-smell program as an inventory that cannot override the minimal-Host plan in Host scope.

## Verification

- `bun run docs:check` — passed: 332 operations in 25 groups.
- `git diff --cached --check` — passed.
- Prettier check for the four new explanatory documents, this record, and both indexes — passed. The pre-existing broad code-smell plan was not mechanically reformatted beyond the calibrated lines.
- Focused searches confirmed that feature flags, allowlisted failures, arbitrary conflict winners, universal Lease unification, and `docs` plan authority are rejected rather than recommended.
- The state-terminal search was reproduced as 82 matches across 20 files in the current worktree; the audit appendix now uses that exact scope and total.
- First independent read-only review — eight findings addressed in the first correction pass.
- Second independent read-only review — five residual findings addressed in the second correction pass.
- Final independent read-only review — no unresolved findings.
