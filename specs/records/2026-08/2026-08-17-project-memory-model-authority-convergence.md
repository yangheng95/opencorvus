# Project MEMORY.MD model authority convergence

## Recall

- User request: explain why the Project `MEMORY.MD` Organizer reports that `memory` has no configured model even though the model follows project configuration, then “切除双源” (remove the dual source).
- Acceptance criteria:
  - every automatic, manual HTTP, Tool, retry, and restart-recovery Organizer run selects its model from one canonical field and one deterministic owner;
  - `agent.memory.model` is not a second Organizer model authority;
  - the request/event caller cannot change model selection by supplying or omitting a Session identity;
  - the real manual organize route succeeds when the pending FIFO head's owning root Session has a configured `model`, even when the project file has no top-level model;
  - the public configuration schema no longer admits `agent.memory.model`;
  - missing configuration remains an explicit durable unavailable notice rather than an implicit Provider fallback.
- Hard constraints: Project memory remains a fixed hidden, tool-free, streaming-only agent; no fallback, shadow state, UI automation, synthesized messages, or non-streaming model call; preserve unrelated dirty-worktree changes; add focused positive non-UI tests; update current architecture and indexes; independently review the final diff before commit.
- Sources read:
  - `AGENTS.md`;
  - `specs/current/architecture/project-memory.md`;
  - `specs/current/architecture/06-provider.md`;
  - `packages/opencorvus/src/memory/project-memory.ts`;
  - `packages/opencorvus/src/memory/project-memory-organizer.ts`;
  - `packages/opencorvus/src/agent/model.ts`;
  - `packages/opencorvus/src/config/effective.ts`;
  - `packages/opencorvus/src/server/routes/experimental.ts`;
  - `packages/opencorvus/src/tool/memory.ts`;
  - `packages/overlay/src/services/composer-model.ts` and `project-memory.ts`;
  - focused Project-memory tests and the production log for the reported notice.
- Whole-repository search evidence: `ProjectMemoryOrganizer.run` has only the Memory Tool, manual experimental route, and focused test callers; durable organization requests are published from pending capture, Session-config changes, project-config changes, and bootstrap. The request currently carries optional `sessionID`, while the Organizer separately resolves `agent.memory.model` before top-level `model`. The manual route supplies no Session, which reproduces the reported split authority.
- Independent agent feedback: the first post-validation read-only review found that missing Task/root-Session ownership escaped before durable unavailable settlement, and that model resolution and the LLM stream could observe different effective configuration snapshots. The second review confirmed those repairs and found that unavailable FIFO trimming still reused one Project-level failure proof across later owners. All three findings were accepted and repaired; final clean re-review is pending.

## Root cause and impact

Project memory is Project-scoped, but its model was selected from the identity of whichever trigger happened to run it. A user-input event or Tool call could provide a Session and see that root Session's overlay, while the manual route, project-config listener, and bootstrap supplied no Session and saw only project base configuration. Inside either scope, `resolveAgentModel("memory")` added a second field precedence (`agent.memory.model` before `model`). Therefore identical pending evidence could organize successfully or settle unavailable depending on the trigger, and the banner suggested configuring a dedicated hidden-agent model even though Composer already persisted the evidence owner's canonical root-Session `model`.

The durable pending FIFO already contains immutable Task/Session ownership for every occurrence. Its oldest entry is therefore the only deterministic model-selection anchor shared by live dispatch and recovery. Caller Session identity is redundant mutable routing data and must not remain an authority.

## Implementation contract

1. Derive the Organizer model scope solely from the oldest pending occurrence: use its Task when present, otherwise its Session. Resolve only canonical `config.model` from one effective snapshot; never read `agent.memory.model` for this helper.
2. Remove `sessionID` from organization-request events, explicit Organizer `run` inputs, manual route calls, Tool calls, listeners, and availability-generation material. Event identity requests work only; pending evidence owns model provenance.
3. Acquire the durable attempt lease before resolving ownership/configuration. Missing Task, root Session, or model is settled as durable unavailable inside that lease. Read the effective config once after the lease, then pass the same snapshot through helper materialization, model lookup, Provider streaming, and Organizer budgets; a later configuration generation revokes the lease and rejects the stale result.
4. Add positive regression coverage through the real manual HTTP route with a pending Task-bound root Session model and no project-file default, plus cross-Task FIFO ownership, missing-root unavailable settlement, and coherent-snapshot lease revocation contracts.
5. Update current architecture to state the FIFO-head authority and remove request-supplied Session model selection from the contract.
6. Bind an unavailable generation to the exact FIFO-head occurrence, canonical owner, closed reason, and model. After two matching attempts, remove at most that proven head; the next owner begins with a fresh attempt count.

## Validation plan

- Run the focused Project-memory contract tests, including the real manual organize route.
- Run OpenCorvus typecheck and repository documentation check.
- Run `git diff --check`.
- After first-pass validation, request an independent read-only review of the complete task diff, repair every valid finding, and repeat validation/review until clean.

## Validation evidence

- `bun test packages/opencorvus/test/memory/project-memory.test.ts`: 24 passed, 0 failed, 144 assertions. This includes the real manual POST route, cross-Task FIFO-head authority, owner-scoped unavailable FIFO advancement, missing root-Session unavailable settlement, coherent configuration snapshot revocation, streaming replacement, and durable recovery contracts.
- `bun run --cwd packages/opencorvus typecheck`: passed.
- `bun run --cwd packages/sdk/js typecheck`: passed.
- `bun run api:routes-check`: passed, 6 rules across 34 route files.
- `bun run docs:check`: passed, 332 operations in 25 groups.
- `git diff --check`: required before commit after final review.
- Independent review round 1: two valid findings (owner resolution outside unavailable settlement; split configuration snapshots), both repaired with focused contracts.
- Independent review round 2: found one valid cross-owner unavailable FIFO trimming issue; repaired by head/owner/reason-bound generations and one-head-only deletion, with the focused multi-owner progression contract passing.
- Independent review round 3: clean, with no remaining actionable findings. It confirmed stable head/owner-bound unavailable generations, one-head-only trimming, lease/config fencing, single-snapshot streaming, entry-point convergence, schema removal, and generated-contract isolation.
