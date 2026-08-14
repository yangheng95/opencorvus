# CS-055 Intent blocker Question settlement

## Recall

- User requirement: fix the path where an Intent Analysis clarification declared `blocker` is rejected or expires without an answer but is promoted to `terminal_success`.
- Acceptance: the real `analyze_intent` adapter must persist its canonical Intent Analysis Artifact, then return one final typed domain-blocked settlement carrying that exact Artifact locator and the exact durable Question occurrence. Only an answered blocker may return `terminal_success` and open the dependent workflow frontier. Non-blocker clarification behavior remains unchanged.
- Hard constraints: no host gate, no second semantic source, no reuse of post-Turn `partial`, no User Interface automation, no shared index changes, no Project/Worktree, Channel, Research, Skill, Software Development Kit (SDK), generated, or Overlay changes; do not commit this batch before independent review.
- Read sources: `AGENTS.md`; `specs/current/architecture/task-control-plane.md`; `specs/records/2026-08/2026-08-12-repository-code-smell-continuous-audit.md` (`CS-055`); `packages/opencorvus/src/question/index.ts`; `packages/opencorvus/src/intent-analysis/{types,artifact}.ts`; `packages/opencorvus/src/orchestrator/analyze-intent-tool.ts`; `packages/opencorvus/src/agent/dispatch-outcome.ts`; `packages/opencorvus/src/engine/{persist,dispatch-settlement,describe}.ts`; existing interaction and workflow settlement tests.
- Repository search: `Question.askAndFormat` is the shared formatter, but only Intent Analysis consumes `priority === "blocker"`. Its current rejected result drops the already-durable request identity, while expiry alone exposes it. `persistIntentAnalysisArtifact` is the only Intent Artifact writer. `recordDispatchSettlement` is the only durable workflow settlement authority, and `describeTask` opens successors only for exact `terminal_success`. Existing production-path coverage answers the Question but does not reject, expire, persist the correlation, or traverse the workflow frontier.
- Independent feedback before implementation: none; the parent explicitly assigned this isolated batch without delegation and requested freezing after first-pass validation for later independent read-only review.

## Analysis

### Observable phenomenon and trigger

When the Intent producer emits at least one clarification whose priority is `blocker`, the adapter opens one real durable Question. If the operator rejects it or its configured deadline expires, `Question.askAndFormat` returns no answers. The adapter persists `clarification_outcome.status` as `rejected` or `expired`, but then unconditionally returns `DispatchOutcome.terminal`. Once that outcome is recorded, the workflow projection marks the Intent node successful and exposes dependent nodes.

### Data and control-flow root cause

The Question subsystem already writes the exact terminal occurrence (`requestID`) before resolving or rejecting the waiter. The formatter preserves that identity only for expiry and drops it for rejection and answer. The Intent adapter therefore cannot form one correlated final settlement. Separately, the dispatch vocabulary has no final domain-blocked variant, so the adapter collapses both answered and unanswered blocker outcomes into terminal success. Inspecting the Intent Artifact from the workflow projector would introduce a second semantic reader and is rejected.

### Why prior abstractions do not cure it

`partial` means a required operation failed after a real terminal worker Turn; rejection and expiry are successful Question lifecycle settlements, so mapping them to `partial` would mix infrastructure and domain semantics. `domain_incomplete` describes a delivered but incomplete domain Artifact and does not identify the external blocker occurrence. Session completion is intentionally separate from domain delivery. The repair therefore belongs in the final dispatch settlement emitted by the producer, not in a host-side gate or an Artifact-reading projection special case.

## Plan

1. Preserve the exact rejected Question ID already carried by `Question.RejectedError` in `Question.askAndFormat`; expiry continues to use `Question.ExpiredError`. Answered results need no blocking identity. The durable Question event remains the sole lifecycle authority.
2. Extend the validated `DispatchOutcome` union with `domain_blocked`, containing the final worker Session, exact Intent Artifact locator, and exact blocking Question ID/status (`rejected` or `expired`). Add one constructor; do not add a compatibility branch.
3. In `analyze_intent`, retain the exact Question ID, persist the current canonical Intent Artifact, and map only rejected/expired blocker outcomes to `domain_blocked`. Answered blockers and requests with no blocker retain terminal success. Persistence failures remain post-Turn `partial`.
4. Keep model-visible dispatch tool documentation aligned with the validated result protocol.
5. Add focused non-UI production-path tests through the real tool executor and durable Question API for answered, rejected, and expired blockers. Record the real dispatch settlement and call `describeTask`: answered opens the dependent node; rejected/expired retain the exact Question/Artifact correlation and keep the frontier closed. Also exercise a non-blocker producer result to prove its current success contract remains unchanged.
6. Expose one controlled canonical Intent writer seam at factory construction. Resolve it exactly once to the production writer by default, with no fallback or parallel writer. Drive a writer failure through the real executor and prove the exact post-Turn `partial` fields and absence of an Intent Artifact.

## Positive verification

- Focused Bun test for Intent blocker settlement.
- Existing interaction recovery test covering the real physical ToolPart binding.
- `packages/opencorvus` TypeScript check, with any unrelated concurrent failure recorded precisely.
- Exact owned-file diff review and forbidden-scope check.
- Freeze the batch and request an independent read-only delivery review; fix all actionable feedback before handoff.

## Current verification

- Focused production-path test: `5` tests / `9` assertions pass. It covers rejected and expired blocker correlation with closed frontier, answered blocker with open dependent frontier, non-blocker success compatibility, and a controlled canonical writer failure returning exact post-Turn `partial` with no Intent Artifact.
- The factory resolves the optional writer exactly once as `persistIntentArtifact ?? persistIntentAnalysisArtifact`; the execute path invokes only that resolved writer, so production has no fallback or second persistence authority.
- Package typecheck was rerun and remains blocked only by the concurrent non-owned `src/memory/project-memory-organizer.ts:294` diagnostic (`signal` is not present on the occurrence type). No CS-055 owned file appears in the diagnostics.
- Independent delivery review initially blocked on the missing post-Turn writer-failure path. After the production-boundary test above was added, the reviewer independently reran all `5` tests / `9` assertions, verified the single resolved writer authority and durable frontier outcomes, and issued final PASS with no remaining finding. The batch may be committed but not pushed with unrelated outgoing history.
