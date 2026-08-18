# An operator message is the only resume

## Recall

- User request: unattended mode — investigate with subagents, choose an approach on the evidence, and proceed. This slice is `docs/state-audit.md` STA-04, unblocked by STA-01 landing.
- Acceptance:
  - one resume path: an explicit operator message opens the next occurrence for every terminal state, cancelled included;
  - the Retry intent is gone end to end — service function, HTTP route, error type, panel action, Overlay control, board projection, generated SDK/OpenAPI — with no second entry point left;
  - the `taskIntent` durable fact apparatus is deleted, not merely orphaned;
  - deletion still fences a reopen, checked directly rather than inferred;
  - the tracked current architecture is converged in the same delivery;
  - typecheck, focused tests, and regeneration all pass.
- Hard constraints: no feature flag, fallback, or parallel path; no new gate or status word; a Host projection may not authorize; preserve unrelated working-tree changes; no data migration — schema changes take the reset path per the user's standing decision.
- Read material: `specs/records/2026-08/2026-08-17-minimal-host-reform-plan-calibration.md`; `docs/state-audit.md` STA-04/STA-07 and Appendix A/B; `docs/host-reform-plan.md`; `docs/host-design-critique.md`; `specs/current/architecture/task-control-plane.md`; `packages/opencorvus/src/task-api/index.ts`; `packages/opencorvus/src/engine/task-intent-open.ts`; `packages/opencorvus/src/orchestrator/{event,agent,tools,interaction-tools}.ts`; `packages/opencorvus/src/workbench/board.ts`; `packages/overlay/src/{main.tsx,components/App.tsx,services/task.ts}`.
- Whole-repository search: three parallel read-only subagents — a Retry-surface inventory, a governing-document authority review, and market research on resume affordances. Findings in the diagnosis below.
- Starting workspace: the in-flight reform slice plus the three preceding records from this session. Typecheck green before this change.
- Independent agent feedback: the three investigations above; their conclusions overturned the approach this delivery started from.

## Observed facts and diagnosis

The slice began with the intention of *keeping* Retry as the explicit resume for a cancelled Task, on the reasoning that a user's own stop should not be undone by a stray message. Three independent investigations refuted that.

**No governing document says it.** The claim exists in exactly one place — a source comment at the reopen function — and nowhere in `specs/` or `docs/`. What the documents do say is narrower than the comment assumed: the calibration grants the reopen permission "after completion/failure" and names cancellation only as an exception to *continuing the conversation*, never specifying how a cancelled Task runs again. Meanwhile the tracked contract, which the calibration requires to win, treats cancellation as **epoch-scoped**: `terminal_inapplicable` is for "a cancelled, closed, or superseded epoch", `task.execution.reopened(epoch + 1)` carries no cancelled carve-out, and the permanent reopen fence is enumerated only under `task.deleted`. The `docs/` roadmap binds "cancelled/deleted" together as one un-reopenable class, which is the conflict — and the tracked contract is the source of truth.

**The reform's own rule condemns the exception.** `docs/host-design-critique.md` names "a terminal state that needs dedicated Retry/Replan vocabulary to leave" as a defect class and states the rule: every state must ship an ordinary user action that leaves it. Keeping Retry as cancelled's only exit preserves exactly the shape being deleted. The audit is internally inconsistent on this: Appendix B ordains the cancelled exclusion as a reopen rule while STA-04 orders the whole retry entry deleted "leaving no second entry" — together they leave cancelled with no exit at all, which the audit's own four-question test would condemn. STA-04's "no state needs Retry now" premise was justified solely by `blocked` disappearing and was never tested against `cancelled`.

**No product makes the distinction.** Claude Code, Cursor, Devin, and Codex all resume on a new message, and none of their documentation treats a user-initiated stop differently from a natural end. Devin moved deliberately *toward* always-resumable, replacing session expiry with sleep/wake. Cursor's explicit Resume exists for *system*-imposed stops — the tool-call cap, a dropped connection — not for a user's own Stop. Copilot's coding agent has no resume concept at all; every mention starts a new session. Only Google Jules is Pause/Resume-first.

The "stray message" risk was also not real. Non-operator delivery already can never obtain reopen authority, so the only thing that reaches the reopen is the operator's own explicit message — and a person typing into a stopped conversation is asking for it to continue.

Two defects surfaced while inventorying the surface. `requireTask` does not fence deleted Tasks, so the existing reopen already bumped the epoch of a **deleted** Task, with ingress acceptance refusing a moment later — the guard was on the wrong boundary. And `retirePendingTaskRootIngressesForOperatorIntentInTransaction`, which the Retry transaction called to "retire" pending ingresses, **mutates nothing**: it is a pure read whose result the test fixture discarded, so the fixture's call — documented as keeping the creation ingress out of the FIFO head — has always been a no-op.

The supersession bookkeeping Retry carried is redundant for a second reason: Phase 1 made every Provider request read the complete canonical transcript, so a side-band list of "operator messages the Retry transaction retired" reproduces what the transcript already contains.

## Canonical repair

1. Reopen every terminal state on an operator message, cancelled included; replace the cancelled exclusion with a direct `task.deleted` check, which is the boundary the tracked contract actually fences.
2. Delete the Retry entry point whole: `retryTask`, `wakeTaskForIntent`, `POST /task/:taskID/retry`, `TaskControlIntentLifecycleConflictError` and its 409 mapping, the `retry_task` panel action, the Overlay menu item, its cancelled-restart confirm dialog, the service call, and seven i18n keys.
3. Delete the board's `canRetry` control and the `retry` next-step kind — never read by the Overlay, which computed its own enablement — and reuse the existing `message` next-step kind for what the operator should now do.
4. Delete the `taskIntent` fact apparatus with its producer: `TaskIntentSchema` and the event field, `persistTaskRootIntentIngressInTransaction`, the `operator_intent` ingress source kind, the wake-provenance prompt block, the supersession threading through the Tool surface, and `openTaskForOperatorIntentInTransaction`. Drop `operator_intent` from the legacy migration's supported set: its payload no longer parses, so such a database resets rather than being carried.
5. Remove the unused `summary` parameter from `openTaskForContinuationInTransaction`, and the fixture's no-op call.
6. Converge `specs/current/architecture/task-control-plane.md` with the occurrence-continuation rule and regenerate the published API artifacts.

## Verification

- `bun run typecheck` (root, all 10 packages): passed.
- `bun run test test/task-operator-message-resumes.test.ts`: 5 passed — reopens failed, reopens completed, **reopens cancelled** (was: asserted it stayed cancelled), leaves an active Task alone, and a new case leaving a **deleted** Task's epoch alone.
- `bun run test` over the affected suite — integrity 3, liveness 13, fact-store 3, terminal-artifact-closure 10, destructive-control 5, reopen-workspace-recovery 2: 36 passed, 0 failed, both individually and sequenced.
- Migration 7 and mission-resume-provenance 2 passed after their retry fixtures were replaced; the provenance test now asserts the operator wake notice contains no `taskIntent` at all.
- `bun run script/generate.ts` then `bun run docs:check`: passed, **331 ops** in 25 groups — one fewer than before, the removed retry route. `task.retry` and `canRetry` no longer appear in `packages/sdk/openapi.json`.

## Follow-on

`docs/host-reform-plan.md` and `docs/host-design-critique.md` still bind "cancelled/deleted" together as one class that refuses new work. That wording is now wrong for cancelled and should be corrected when those explanatory documents are next revised; they are non-authoritative, so this delivery converged the tracked contract instead.
