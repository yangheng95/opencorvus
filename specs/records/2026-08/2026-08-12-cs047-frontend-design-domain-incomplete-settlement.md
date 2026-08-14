# CS-047 — Frontend Design domain-incomplete dispatch settlement

## Recall

- User request: independently fix `CS-047` (`Frontend Design partial output settles as workflow success`); first trace producer → Artifact → `DispatchOutcome` → workflow frontier → consumers and write this plan, then implement the root fix and focused non-UI positive tests. Do not wait for a plan review. Stop after first verification and wait for an independent read-only delivery review; do not commit.
- Acceptance:
  - a Frontend Design Turn without its required structured snapshot persists exactly one partial Frontend Design Artifact;
  - the adapter returns one explicit typed non-success domain-incomplete settlement carrying that exact Artifact locator;
  - the settlement is not the existing `partial` kind, whose only meaning remains failure of a required post-Turn operation;
  - workflow projection retains the partial evidence but does not mark the node successful or open dependent frontier nodes;
  - a complete structured Frontend Design result still persists the complete Artifact, returns `terminal_success`, and opens its dependent frontier;
  - no Host gate teaches the large language model (LLM) which tool or workflow step to choose, and no second reader infers settlement from the domain Artifact payload.
- Hard constraints: only Frontend Design, the shared internal dispatch-outcome settlement schema/constructor required by its Orchestrator adapter, the exact Orchestrator adapter, focused non-UI tests, and this spec are in scope. Do not touch B02, Plugin, Model Context Protocol (MCP), installation, channel, Software Development Kit (SDK)/generated, Overlay/User Interface (UI), shared README/index files, or UI automation. Do not delegate or commit.
- Read sources:
  - repository `AGENTS.md`;
  - `specs/current/architecture/task-control-plane.md:21` for separation of Session lifecycle and domain delivery;
  - `specs/current/architecture/04-extensions.md:23-41` for the dispatch adapter/runtime flow;
  - `specs/records/2026-08/2026-08-12-repository-code-smell-continuous-audit.md:931-942` for `CS-047` evidence and acceptance;
  - `packages/opencorvus/src/frontend-design/agent.ts`, `partial-artifact.ts`, `artifact.ts`, and `output-tools.ts`;
  - `packages/opencorvus/src/orchestrator/frontend-design-tool.ts` and `dispatch-agent-tool.ts`;
  - `packages/opencorvus/src/agent/dispatch-outcome.ts`;
  - `packages/opencorvus/src/engine/dispatch-settlement.ts` and `describe.ts`;
  - existing dispatch/workflow tests, especially `dispatch-occurrence-recovery-authority.test.ts` and `workflow-node-occurrence-authority.test.ts`.
- Full-repository search:
  - `FrontendDesignAgent.analyze` is the sole producer of the explicit `{ outcome: "partial" }` result; it derives that branch when `snapshotCurrent()` has no current complete structured snapshot and preserves missing actions, semantic error, current collector facts, visual specs, Session, and final Message identities.
  - `recordPartialFrontendDesignFacts` is the sole partial Frontend Design Artifact writer and delegates to the single `recordFrontendDesignArtifact` authority. The Orchestrator Frontend Design adapter is its sole caller.
  - the adapter currently persists that partial Artifact and immediately calls `DispatchOutcome.terminal`, converting it to `terminal_success`.
  - `recordDispatchSettlement` persists every non-accepted parsed adapter outcome as the exact dispatch settlement. `describeTask` derives node success and frontier only from settlement kind `terminal_success`; it does not inspect Frontend Design Artifact payloads.
  - existing `DispatchOutcome.partial` is explicitly limited to a real terminal worker Turn whose required post-Turn operation failed. Frontend Design uses it separately when Artifact persistence itself throws. Reusing it for a successfully persisted but incomplete domain result would create two incompatible meanings.
  - current consumers compare `kind` to `terminal_success` or `infrastructure_failure`; the shared schema admits another final non-success kind without changing transport, SDK, generated sources, Task status, or Artifact schemas.
- Observable trigger and impact: a Frontend Design Turn finishes without a current structured snapshot. Durable payload says `status: "partial"`, but its dispatch settlement says `terminal_success`; any workflow node depending on this Frontend Design node is projected into `frontier_node_ids` and may start without required design evidence.
- Data/control-flow root cause: the adapter equates successful persistence with successful domain delivery. The domain producer and Artifact preserve incompleteness, but the adapter discards it at the only settlement boundary consumed by workflow projection.
- Why prior abstractions do not cure it: `terminal_success` intentionally carries no domain Artifact locator, and the existing `partial` kind is a post-Turn operation-failure receipt. Artifact Catalog visibility preserves evidence but does not control frontier; consulting its payload from `describeTask` would create a second settlement authority.
- Definitions/callers/contracts/data/test/documentation/delivery risk:
  - definition change: one new final `domain_incomplete` branch and constructor in the internal dispatch outcome schema;
  - caller change: only the Frontend Design partial branch selects it and carries the exact locator returned after persistence;
  - consumer behavior: dispatch settlement already accepts every final schema member, and frontier already fails closed for every kind other than `terminal_success`;
  - data: the existing Frontend Design partial Artifact remains the sole domain evidence; no Artifact schema or event change;
  - public/API/SDK/generated: excluded because this is the internal dispatch tool result/settlement contract, not an HTTP or generated transport schema;
  - delivery risk: detached dispatch completion still reconciles visible lifecycle delivery, but workflow success remains false because it reads the durable settlement.
- Independent feedback before implementation: none; the parent explicitly authorized immediate implementation without a plan-review wait.

## Plan

1. Add one final `domain_incomplete` dispatch outcome with terminal Session/Message identity, a normalized domain identifier, and one exact Engine Artifact locator. Keep `partial` unchanged as the sole post-Turn operation-failure outcome.
2. Make the partial Frontend Design writer return the exact locator of the Artifact it just persisted. Add one adapter-local outcome mapper used by both partial and complete branches so there is exactly one status-to-settlement mapping: partial → `domain_incomplete`, complete → `terminal_success`.
3. Add a focused non-UI integration test around the real partial writer, adapter outcome mapper, durable dispatch settlement, and workflow projection. Prove the partial Artifact is durable and exactly referenced, its dependent frontier remains closed, and a separate complete settlement opens the expected successor.
4. Run the focused test, package typecheck, task-owned diff check, and scope/status review. Do not run UI automation or commit. Freeze and request an independent read-only delivery review.

## Positive verification targets

- The persisted partial Artifact has `status: "partial"`, exact missing actions/findings, and a locator identical to `domain_incomplete.domain_artifact`.
- The durable dispatch settlement outcome kind is `domain_incomplete`; the Frontend Design node and its dependent both remain non-success and the dependent is absent from `frontier_node_ids`.
- A complete Frontend Design outcome produces `terminal_success`; the same workflow projection places the undispatched dependent in `frontier_node_ids`.
- A post-Turn Artifact persistence failure still returns the existing `partial` kind and never fabricates a domain locator.
- No UI automation or external write is performed.

## Implementation verification

- Added final `domain_incomplete` to the internal dispatch outcome protocol. It requires terminal Session/final Message identities, a normalized domain identifier, and the exact Engine Artifact locator. Existing `partial` remains unchanged and continues to require `failed_operation` for post-Turn operation failure.
- `recordPartialFrontendDesignFacts` now returns the exact locator of the single Frontend Design Artifact it persisted. `frontendDesignDispatchOutcome` is the only Frontend Design status-to-settlement mapper: partial selects `domain_incomplete`; complete selects `terminal_success`.
- The `dispatch_agent` result description enumerates `domain_incomplete` and its exact durable incomplete Artifact/closed-successor meaning; this is protocol documentation, not a Host routing gate.
- Current focused verification and review corrections are recorded below. UI automation and external writes were not run; no commit exists yet.

## Independent-review correction

- The first delivery review found that the focused test called the writer and outcome mapper directly, so it did not prove the production `createFrontendDesignTool().frontend_design.execute` branch or its post-Turn `catch` contract.
- The factory now accepts controlled analyzer and Artifact-writer dependencies while retaining `FrontendDesignAgent.analyze`, `recordPartialFrontendDesignFacts`, and `recordFrontendDesignArtifact` as its only production defaults. The focused test drives the real AI Software Development Kit tool executor through both a domain-partial analysis and a partial-Artifact persistence failure.
- `bun test --timeout=0 test/frontend-design-domain-incomplete-settlement.test.ts`: passed, 3 tests / 6 assertions. The production executor persists exactly one partial Artifact, returns its exact locator in `domain_incomplete`, records the durable settlement, and its real `describeTask` consumer keeps the design node non-successful with a closed successor frontier. The same production executor's complete branch uses the canonical complete writer, returns `terminal_success`, and opens the implementation frontier. A partial-Artifact writer failure returns the existing post-Turn `partial` outcome.
- The follow-up `bun run typecheck` reached an unrelated concurrent-worktree error at `src/memory/project-memory-organizer.ts:290` (`signal` is absent from that event type). No CS-047 file appears in the diagnostic. Focused tests and task-owned `git diff --check` remain the bounded acceptance evidence pending independent re-review.
- Independent final re-reviews by `/root/backend_infra_audit` and `/root/surface_tooling_audit`: PASS with no remaining `P0`-`P3` finding. Both reviewers verified the real partial/complete/persistence-failure executor chains, exact locator, canonical complete writer, frontier projections, and absence of a Host gate or second production authority.
