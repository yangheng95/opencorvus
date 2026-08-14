# Advanced Requirements Grill-Me Trial

## Recall

### User request

- Mount the existing `grill-me` Skill for the Advanced Expert Squad's Requirements agent as a trial.
- Do not restrict invocation to an explicit trigger or only highly uncertain requests; encourage the Requirements agent to use it.
- Test the resulting behavior end to end and report the observed effect.

### Acceptance metrics

1. The exact Advanced `requirement-engineer` projection resolves `default/skill/grill-me` as an enabled production Skill while unrelated Advanced workers retain their declared projections.
2. The Requirements worker prompt encourages loading and applying the mounted Skill during requirements discovery, while preserving `register_requirement` and `register_decision` as the only durable RequirementSet output.
3. A real Advanced Task with a deliberately underspecified request reaches a visible worker-to-Orchestrator coordination handoff and a real user-question interaction rather than fabricating an answer or silently completing requirements.
4. After an answer, the same worker lineage continues and either asks the next dependency-resolved question or persists a valid RequirementSet once shared understanding is sufficient.
5. A concrete request still follows the same contract without losing explicit acceptance boundaries or foundational decisions.
6. Focused package/projection checks, the real interaction benchmark, documentation checks, and `git diff --check` pass.

### Benchmark contract

- Task definition: observe the behavior and effect of an encouraged `grill-me` Skill through the real Advanced projected worker, coordination, interaction, continuation, and RequirementSet persistence chain. This trial has no unmounted baseline and therefore does not claim causal improvement.
- Inputs:
  - ambiguous case: a short product/change request that leaves a material operator decision unresolved;
  - concrete case: a bounded change request with observable acceptance and non-goals.
- Outputs:
  - ambiguous case: an enabled Skill load followed by a durable single-question coordination/interaction occurrence and continuation on the same dispatch lineage;
  - concrete case: a persisted RequirementSet containing bounded REQ-N acceptance records and foundational decisions.
- Environment: repository source runtime, project-local/global provider configuration already resolved by OpenCorvus, and a benchmark-owned temporary Home, project, and Task scope that the script creates itself. The script rejects directory arguments and never overwrites a caller-selected project. No credentials are copied into this record or command output.
- Timeout: 120 seconds of no output or task-state activity per benchmark process; interaction waits are observed through durable state rather than counted as process inactivity.
- Pass rule: all six acceptance metrics above are evidenced. A static manifest assertion alone is not end-to-end evidence.

### Hard constraints

- Reuse the one platform `grill-me` Skill identity; do not create a package-local copy or second protocol source.
- Grant by the exact projected Advanced worker identity, not by model, provider, base role, or host routing.
- Do not add a Host gate, keyword router, fallback, synthetic question message, or second requirements store.
- Questions must travel through the existing visible worker coordination and Orchestrator `ask_user` interaction path.
- Requirements and decisions still exit through their typed registration tools.
- Preserve all unrelated dirty-worktree changes; task-owned edits are limited to the Advanced package projection/prompt, focused non-UI tests/benchmark, current architecture description, and this record/indexes.

### Materials read

- `AGENTS.md`
- `specs/current/architecture/04-extensions.md`
- `packages/opencorvus/src/skill/builtin/grill-me/SKILL.md` and provenance
- Advanced manifest, README, scheduler prompt, Requirements worker prompt, and package tests
- Requirements runtime core, adapter, stage dispatcher, worker coordination tool, Orchestrator interaction path, Skill mount resolver, and session Skill policy
- `benchmark-debug-template` Skill instructions

### Repository search and root-cause analysis

- Observable starting state: Advanced's scheduler already grants `default/skill/grill-me`; `requirement-engineer` has an empty `default_skill_refs` array.
- Direct trigger: production Skills are resolved only from the exact scheduler/worker manifest grant plus operator overrides, so inventory presence and the scheduler grant do not make the Skill available to the Requirements worker.
- Data/control-flow root cause: `PromptProfileResolver` projects worker grants, `SkillMount` resolves the exact turn surface, the session prompt advertises only that mounted surface, and the `skill` tool loads its instructions. The Requirements worker can return a durable `request_orchestrator_decision`; the Orchestrator owns the real `ask_user` interaction and continuation dispatch.
- Why the old path cannot satisfy the trial: the scheduler can use the Skill for its own planning, but Skill grants do not inherit across identities. No model- or runtime-template-level mount exists by design.
- Impact surface: Advanced manifest revision/digest, embedded package bytes, Requirement Engineer prompt, package/projection tests, current architecture wording, and real Task interaction behavior. Other squads, primary Chat/Work, provider selection, and other Advanced workers are outside the change.
- Known risk: the upstream protocol asks one question at a time and waits for confirmation, so encouraging it can add multiple Task wakes even for otherwise concrete work. The benchmark must measure this behavior rather than hiding it.
- Existing unrelated work: the starting worktree contains extensive permission, runtime, web, deployment, and documentation changes. None is authority for this trial and none may be staged with it.

### Independent agent feedback

- None before implementation. The required post-implementation independent read-only review will be recorded below.

## Implementation decision

- Add `default/skill/grill-me` to Advanced `requirement-engineer.default_skill_refs` and bump the immutable package revision.
- Add a Requirements-worker overlay instruction that encourages loading the mounted Skill, uses repository/tool facts instead of asking factual questions, routes each unresolved operator decision through the durable coordination path, and returns to typed requirement/decision registration after shared understanding.
- Do not modify the global Skill text for this trial, because doing so would change every existing mount rather than only Advanced Requirements behavior.

## Verification ledger

- Focused package and exact worker-surface contract:
  - command: `bun test --preload ../../test-preload.ts --timeout=0 test/expert-squad/advanced-package.test.ts test/expert-squad/shipped-package-completeness.test.ts` from `packages/opencorvus`;
  - result: `3 pass, 0 fail`; the exact Advanced Requirement Engineer resolves the package delivery method and enabled platform `grill-me` Skill.
- Real Server/Task benchmark:
  - command: `OPENCORVUS_HOME=<isolated-home> OPENCORVUS_TASK_PROCESS_MODE=native OPENCORVUS_GRILL_BENCHMARK_MODEL=deepseek/deepseek-chat bun packages/opencorvus/script/advanced-requirements-grill-e2e.ts`;
  - environment: a fresh Home and a benchmark-owned TypeScript/Bun project containing one existing config surface, terminal-log renderer, and focused `bun:test` baseline;
  - result: strict checker exit `0` after 567.6 seconds with continuous durable activity and the final result event; benchmark-owned root `C:\Users\hengu\AppData\Local\Temp\opencorvus-advanced-grill-eF4sbY` remains available for inspection;
  - ambiguous Task `tsk_g00VS3NDOn00lxa6o9Yc`: Requirement Engineer Session `ses_-fe600bc57b13ffffffffffffoEvtClRYrhCNDe` completed `skill(name=grill-me)` before `request_orchestrator_decision`, handed one delivery-scope decision to the Orchestrator with an in-app-only recommendation, received the real answered interaction, and continued on that exact Session to completed `register_requirement` and `register_decision` calls plus a persisted RequirementSet (two continuation requirements and two decisions);
  - concrete Task `tsk_g00VS3NzP800ZaKGCyDu`: Requirement Engineer Session `ses_-fe600bc2a0d0ffffffffffffs6zSVlM97Gi0oF` completed `skill(name=grill-me)` before its typed registrations, created zero user interactions, and persisted six bounded requirements; the checker normalizes the real provider artifact and proves all explicit semantics remain: default false, consecutive exact info-level-and-text runs only, warning/error individuality/order/run breaks, `×N` only for `N>=2`, the single config surface with no environment alias or compatibility path, Bun + TypeScript + `bun:test`, and all three non-goals (persistence, protocol events, UI layout).
- Strict-checker follow-up against fresh root `C:\Users\hengu\AppData\Local\Temp\opencorvus-advanced-grill-XkI14n`:
  - ambiguous Task `tsk_g00VS3WGiM00J49258UR` persisted one answered interaction and a same-Session continuation RequirementSet after the final registration completed;
  - concrete Task `tsk_g00VS3X2Q1004lILc2hv` persisted five requirements and fourteen decisions from Session `ses_-fe600ba1d0b1ffffffffffffVnGu36DtYu9v2H`; its durable ToolParts prove `skill(name=grill-me)` completed before every typed registration, the RequirementSet was created after the last registration completed, no interaction was created for that Task, and the artifact explicitly retains focused non-UI coverage for false-preserves-current-output and true-only-the-specified-compaction;
  - the checker reached its post-observation cancellation path, then the outer command timed out while shared runtime cancellation/Server disposal was still converging. Cleanup is now bounded to ten seconds for queue hooks, cancellation, and Server stop, so teardown cannot hide a completed observation again. This follow-up is persisted observation evidence, not a second recorded exit-0 run.
- Benchmark failures repaired before the passing run:
  - direct Task creation lacked production Server occurrence ownership, so the checker now starts the real Server and uses HTTP Task/interaction/cancellation routes;
  - an outer `Instance.provide` interfered with the independent Task instance, so observation now uses real board/transcript/interaction routes only;
  - an empty fixture made Source Investigator and Requirements correctly ask for the missing repository/stack, so the checker now seeds an explicit existing application baseline and fully specifies the concrete case;
  - the first interaction selector was too broad, so it now binds the pending interaction to an `agent_coordination_action` whose exact target is `requirement-engineer`.
- Current dirty-worktree prerequisite found during real startup: the parallel permission refactor had converted Skill capability policy to `allow | deny` while two Skill inventory defaults still returned `ask`. The parallel working tree supplied the required `deny` correction before the real benchmark rerun; those overlapping permission-refactor files are not part of this trial's commit authority.
- A later parallel runtime cutover caused `register_requirement` string results to bypass standard ToolResult normalization while `register_decision` still succeeded. The strict checker rejected that run rather than accepting another agent's interaction. A minimal normalization hunk restored the pre-cutover execution contract solely for the isolated exit-0 run and the fresh follow-up above, and was then precisely removed; this trial does not stage or commit the parallel runtime file. Therefore the exit-0 run proves `HEAD + trial patch` under the isolated pre-cutover ToolResult contract, not repeatability against the current shared cutover. The runtime owner must land and review that prerequisite independently before rerunning the benchmark as a current-tree final gate.
- The benchmark entry point bundles successfully (`954 modules`, Bun target). Full package `tsc --noEmit` remains blocked by two concurrent shared-tree errors in `src/question/index.ts` (`publication` is undefined at lines 382 and 420); neither references a trial-owned file. The focused test compiles and runs the changed package/projection path.
- `git diff --check`: pass.

## Independent review

- The first post-verification read-only review found four valid checker/spec issues: caller-directory overwrite risk, cross-Session evidence joins, incomplete concrete semantic/zero-interaction assertions, and unsupported causal wording without a baseline.
- It also confirmed that the exact worker grant, prompt encouragement, coordination-to-interaction path, and typed RequirementSet output preserve the architecture: there is no Host gate, model inheritance, or second requirements source.
- The benchmark was revised to own its temporary Home/project, bind Skill/handoff/continuation/typed registrations and the later RequirementSet to one Requirement Engineer Session with completion ordering and exact registration counts, assert every explicit concrete boundary plus zero interactions, and describe only observed behavior.
- The second review found two remaining checker gaps: the Skill had to precede both typed Tool families and RequirementSet creation had to follow the last same-Session registration; it also required the focused non-UI false/true acceptance text to be checked explicitly. Those contracts are now enforced. A final independent read-only review follows the repaired checker and evidence record.
- The reviewer confirmed that `skill/manager.ts` and `skill/mounts.ts` belong to the parallel permission cutover and must not enter this trial commit; the two shared spec indexes must likewise stage only this trial's entry.
