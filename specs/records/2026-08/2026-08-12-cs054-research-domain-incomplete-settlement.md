# CS-054 — Research domain-incomplete dispatch settlement

## Recall

### Requirement and acceptance

- Fix `CS-054`: Deep Research and Frontend Research explicitly return `outcome: "incomplete"`, persist a partial Research Artifact, and must settle one final domain-incomplete non-success instead of `terminal_success`.
- Both Research modes use one settlement mapper. The exact persisted partial Artifact locator accompanies domain incompleteness; the existing `partial` kind remains exclusively a failed required post-Turn operation.
- Workflow projection retains the partial evidence but does not mark the Research node successful or open its successor. A complete Research result still persists its canonical Artifact, settles `terminal_success`, and opens its successor.
- This is an honest projection of the producer's typed result, not a Host gate instructing the large language model (LLM) to call a tool or choose a workflow.

### Hard boundary

- Task-owned code is limited to Research producers/stage persistence, the already-existing dispatch-outcome contract as strictly required, one focused non-User Interface (UI) test, and this isolated record.
- Do not modify Project/Worktree, Channel, Frontend Design, Skill, Software Development Kit (SDK)/generated, Overlay/UI, shared README/index files, or run UI automation.
- Do not delegate, commit, publish, add compatibility outcomes, or add an Artifact payload reader to workflow projection.

### Read material and repository search

- Read `AGENTS.md`, `specs/current/architecture/task-control-plane.md`, `CS-054` in the continuous audit, Research producer/output schema, Deep/Frontend stage dispatchers, Research persistence helper, Engine persistence, dispatch settlement, workflow projection, production tool registration, and current Research tests.
- `runResearchSession()` owns the typed producer union. A failed `snapshotDraft()` returns `outcome: "incomplete"`, the exact Session/final Message, missing fields, and a partial draft; it does not manufacture lifecycle success.
- Both `deep-research-stage.ts` and `frontend-research-stage.ts` branch on that explicit result and call `persistTaskResearchPartial()` through `persistResearchArtifactBestEffort()`.
- `persistTaskResearchPartial()` writes one Engine Artifact with `status: "partial"`, missing fields, draft, provenance, and the same Session/final Message. It returns the exact Artifact ID.
- `persistResearchArtifactBestEffort()` currently discards that ID and unconditionally returns `DispatchOutcome.terminal()` after any successful write. The helper's catch correctly distinguishes deterministic contract failure (`infrastructure_failure`) from other post-Turn persistence failure (`partial`), so those meanings must not change.
- Durable dispatch settlement accepts the existing `domain_incomplete` final outcome. `describeTask()` opens a workflow successor only for exact `terminal_success` and never reads the domain Artifact, so no schema migration, public API, SDK, generated file, or consumer change is required.
- Production `tools.ts` constructs one Deep and one Frontend dispatcher. No other caller uses the persistence helper.

### Root cause and impact

The shared persistence helper conflates a successfully committed Artifact with successful domain delivery. It is the only point where both Research modes lose the producer's explicit complete/incomplete status and the returned Artifact identity. Consequently an incomplete Research prerequisite becomes durable `terminal_success`; downstream nodes can start against known-missing evidence, and the durable partial payload disagrees with workflow status.

The current abstractions do not cure this because the error is not a failed write. The catch path never runs, and workflow projection intentionally trusts only the typed settlement. Making workflow inspect the partial payload would create a second settlement authority.

### Definitions, callers, contracts, data, tests, and delivery risk

- Definition: retain the existing internal `domain_incomplete` outcome; add no parallel kind.
- Callers: both Research stages must declare whether their persisted result is complete or domain-incomplete to the one shared persistence/settlement helper.
- Data: the canonical Research Artifact remains the only domain evidence. Convert its returned ID to an exact Engine Artifact locator immediately after persistence.
- Consumers: durable settlement and workflow frontier already fail closed for every non-`terminal_success` kind.
- Tests: exercise both production stage dispatcher branches with controlled typed producer results and real canonical persistence; persist their returned outcomes and inspect the real workflow projection. Exercise one complete production branch to prove successor opening remains intact.
- Delivery: no UI, HTTP, SDK, generated, migration, external publication, or shared-index impact.
- Independent pre-implementation feedback: none; the parent authorized direct implementation and prohibited delegation.

## Plan

1. Make the shared Research persistence boundary consume a typed `complete | incomplete` delivery fact and the Artifact ID returned by its canonical writer.
2. Use one private mapper: complete maps to `terminal_success`; incomplete maps to `domain_incomplete` carrying the exact persisted locator. Preserve deterministic contract and post-Turn persistence failure paths unchanged.
3. Pass the explicit producer branch from both Deep and Frontend stage dispatchers. Add narrowly controlled producer injection to their existing factories only for production-path tests; production defaults remain the real agents.
4. Add focused tests proving Deep and Frontend incomplete production branches persist one partial Artifact, settle domain-incomplete, and keep successors closed; prove complete Research persists its canonical Artifact, settles terminal-success, and opens its successor.
5. Run focused tests, package typecheck, exact task diff check, and scope review; then freeze for independent read-only delivery review.

## Verification

- The shared `persistResearchArtifactBestEffort()` now consumes one explicit `complete | incomplete` delivery fact and the canonical writer's Artifact ID. Complete maps to `terminal_success`; incomplete maps to the existing `domain_incomplete` with the exact Engine Artifact locator. Its deterministic contract-failure and post-Turn `partial` paths are unchanged.
- Deep and Frontend stage dispatchers both pass the same explicit delivery fact and use the same mapper. Their optional test runner seam defaults directly to the real Research agent; production registration supplies no replacement.
- `bun test --timeout=0 test/research-domain-incomplete-settlement.test.ts`: passed, 4 tests / 4 assertions.
- The production-stage tests use real Deep/Frontend dispatcher branches and canonical Engine persistence. Both incomplete modes persist one exact partial Artifact, return its exact domain-incomplete locator, write a durable dispatch settlement, and keep the real workflow consumer frontier closed. Complete Deep Research persists the canonical ResearchBrief and opens the consumer frontier.
- `bun run typecheck`: attempted; blocked only by the concurrent non-task file `src/memory/project-memory-organizer.ts:290` (`signal` is absent from the occurrence type). No CS-054 task-owned path appears in the diagnostic.
- Exact task-owned `git diff --check`: passed.
- Independent delivery review: PASS. The reviewer independently traced both production stages, the shared mapper, canonical Artifact writers, exact locator construction, durable settlement, `describeTask` frontier projection, Frontend resource cleanup, and failure semantics; no actionable issue remained. The reviewer reran the focused test successfully (`4` tests / `4` assertions) and confirmed the exact owned diff check.
- UI automation and external publication were not run. This isolated batch is ready for its exact-file commit; push remains explicitly deferred by the parent instruction.
