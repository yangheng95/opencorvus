# Dispatch continuation input repair

## Recall

- User request: diagnose task `tsk_g00VVmTqXe00h3aNc7FS`, distinguish model errors from framework defects, estimate and repair scheduling/communication problems.
- Acceptance: explicit successor input reaches persisted lineage, worker context, selected subjects and workload registration; same Session/workflow identity is retained; exact replay uses its committed input. Direct, collection, coordination and Mission repair paths share the contract. Incorrect identity errors expose exact corrective facts. No host semantic routing or implicit expansion of empty selections.
- Constraints: repository AGENTS.md; read production data only; no user process restart; no UI automation; focused positive tests and real checker; independent read-only review before scoped commit and upstream merge/push. Preserve unrelated `script/video/`.
- Read: task-control-plane architecture, dispatch-agent tool, adapter registry/input schemas, tools lineage admission, dispatch collection persistence, coordination redispatch binding, workload input projection/output/publication, worker Turn projection, focused dispatch/workload tests.
- Searches: all continuation renderer callers, adapter input/subject persistence and DDL bindings, continuation authorities, workload `knownGoalIDs`, coordination response paths and task/Mission recovery driver entry points.
- Independent agent feedback: read-only review found stale `continue` coordination guidance contradicting current tools; replaced it with the actual redispatch contract. Reviewer also requested explicit validation limits and coordination/empty-selection coverage; both added. Final re-review passed with no unresolved valid findings.

## Observations and cause

Read-only SQLite facts show 28 accepted dispatch lineages and 28 settlements (24 terminal_success, 3 coordination, 1 domain_incomplete), 30 root ingresses, two execution epochs and a Mission acceptance resume. Three continuation calls confused lineage Artifact IDs with dispatch IDs and later corrected them. Three message reads failed exact message/causal checks. These do not establish queue loss.

The workload initial call misspelled Goal IDs, then selected `goal_ids: []`. Both accepted successors retained that empty adapter input and empty subjects despite prose requiring the new Goal. `register_workload_brief` for the real Goal returned `Known goals: (none)`. `openLineage` unconditionally copies predecessor input and subject IDs, while the continuation schema has no structured replacement. The output toolkit correctly validates its projected selected set: loosening that check or expanding empty input would mask the cause. The third blocking coordination request remained without a response; the next decision explicitly proceeded to implementation acknowledging the discrepancy. Closing that semantic obligation belongs to orchestrator context/instructions, not a host workflow gate.

## Shared-mechanism audit and scope

- Direct and collection dispatch use the same target-specific tool and lineage admission; collection replay additionally parses a persisted envelope. Both must carry explicit input.
- Prior-dispatch and coordination-action continuations share lineage creation but resolve predecessor identity separately. Preserve their source checks and workflow/Session placement; select successor input after authority resolution.
- Mission repair reopens the Task epoch and adds criterion/checkpoint authority; its existing continuation uses the same admission. The new input does not change criterion responsibility or Task authority.
- Retry/restart replay reads immutable lineage adapter input, not live model prose. Per-project driver reentry and per-dispatch fenced admission remain authoritative; serial and parallel members use their individual exact inputs.
- Task terminal evidence after final failure contains only caller idle/terminal and ingress disposition. No new dispatch was observed there. Cross-project stress/process-loss behavior is not proven by this incident and requires existing focused checks; no global scheduler-health claim.
- No database schema or UI changes intended. No game product changes: the SAVE_CONFLICT defect is separate from this framework repair. Provider credentials will not be copied or used implicitly.

## Implementation plan

1. Add optional complete target-typed `turn.input` to continuation. Omission explicitly inherits previous input; supplied input replaces it for the new immutable Turn (no merge, no old-row mutation). Derive subjects using the existing registry and validate current membership at normal admission.
2. Expose effective successor input in the normal visible continuation context so tools and worker instruction agree. Persist one effective input in lineage for restart/replay.
3. Improve membership and continuation-ID diagnostics using current exact identities, without automatic substitution. Explain coordination closure and explicit subject replacement in the orchestrator prompt; correct misleading workload selected-set terminology.
4. Add focused positive contract/integration coverage for direct/collection parsing, lineage input and workload registration, inheritance, replay and authority preservation. Run relevant real checker where its available modes do not require unauthorized credentials. Record coverage limits honestly.
5. Update current architecture, run documentation/type checks, independent review and any repairs, then commit and merge upstream/push.

## Validation and delivery

Implemented explicit successor input in the shared dispatch contract and admission; effective input is visible in the existing continuation Message. Exact IDs and selected-subject errors are actionable without fallback. Historical rows, Session/workflow identity and empty selection semantics remain unchanged.

- `bun run --cwd packages/opencorvus test test/goal-workload-coverage-contract.test.ts`: 33 passed, including direct/collection admission, inherited input, coordination action completion, explicit empty replacement, historical preservation, exact replay and workload publication. Existing tests also cover independent-process publication/settlement and startup reconciliation.
- `bun run --cwd packages/opencorvus test test/dispatch-agents-tool.test.ts`: 6 passed (canonical collection execution and recovery).
- `bun run --cwd packages/opencorvus test test/task-control-sweep-scope.test.ts test/projected-worker-continuation-compatibility.test.ts`: 3 + 2 passed.
- `bun run --cwd packages/opencorvus test test/orchestrator-terminal-coordination-schema.test.ts test/workflow-node-occurrence-authority.test.ts`: 2 + 3 passed.
- Final package typecheck passed; expert-squad typecheck also passed. `docs:check`, `check:architecture-index`, `check:control-state-redundancy` (53 tables), `check:control-lease-owners` (18 owners/22 acquire sites) passed.
- Initial test invocation incorrectly passed `-t` to the repository file-only runner; corrected invocation. New fixture authority errors were fixed to supply the real initial message/coordination Tool provenance, then original acceptance reran successfully.
- User explicitly authorized existing Provider credential/model use for isolated acceptance. Real checker `check:task-control-real` is running with incident model `openai/gpt-5.6-luna`, cumulative cap 96 requests. Credential and model catalog were copied together; preflight proved credential usable, catalog projected, actual model exact, streaming true. Evidence root: `C:/Users/hengu/AppData/Local/Temp/opencorvus-test-run-TEkSzv/runner-43500-j5gTkV/runtime-root/tmp/opencorvus-task-control-uaVHBW`.

Coverage distinction: new selection tests enter actual lineage admission, storage, projection, collector and publication; fixture worker completion replaces Provider execution. Collection selection exercises persisted schema/member admission, while separate collection tests exercise its executor. They are not new-selection model end-to-end evidence. Real checker covers shared task lifecycle/recovery rather than this workload-selection scenario. Mission acceptance-specific replacement and new-selection process-loss tests remain unmeasured; shared code inspection is not claimed as runtime proof. No UI changed or UI automation run.

Independent review passed after the stale coordination instruction fix. `orchestrator-dispatch-guidance.test.ts`: 2 passed; total focused tests before cross-process admission: 51. Real-checker result and Git delivery pending.


## Real-checker follow-up analysis

The first real run consumed 29 streamed requests and completed its first Task, then failed the checker assertion at line 570. The checker picks the first dispatch's child lifecycle, but the actual Base workflow dispatches its verification worker after implementation. Completion legitimately belongs to the verifier lifecycle ingress, even when its evidence also cites implementation. The direct trigger is comparing final parent ingress to the first worker wake. This is checker selection logic, not proven scheduler loss. Repair the existing checker to resolve the completion decision's actual parent ingress, then require that ingress to be sourced by an exact completed worker lifecycle and require the decision to cite that same worker final Message. Preserve message/control identity checks and rerun original real acceptance. No production execution semantics or user processes are changed.


The checker review required retaining the settled/closed condition on the newly selected completion ingress, not merely the first worker ingress; this is now enforced by waiting for that exact ingress to settle. The second real run evidence root is `C:/Users/hengu/AppData/Local/Temp/opencorvus-test-run-hbgCWs/runner-34744-tAy3Bv/runtime-root/tmp/opencorvus-task-control-7aJm5x`. It started before this final wait-condition addition; its final persisted ingress state must therefore be checked separately against that condition before accepting the evidence.


Additional shared-admission regression: `bun run --cwd packages/opencorvus test test/dispatch-occurrence-cross-process-claim.test.ts` passed 5/5 real independent-process cases (stale owner fencing, concurrent collection claimant, same Session winner, expired admission takeover, consumed takeover owner recovery). Total focused tests: 56. Checker follow-up independent review passed after restoring exact completion-wake convergence validation.


## Delivery baseline correction

The user corrected the delivery source to `main`. Initial session checkout was `codex/paper-preliminary-results` at `3cfe9cb6` (local 0.1.9 build), not the released main tip. No repair commit or push had occurred. The existing clean main checkout `D:/myhexin-local/opencorvus-release-0.0.54` was fast-forwarded to `origin/main` `3c9d16a4`; the scoped patch was transferred, preserving main's accepted-worker recovery and attachment continuation fixes. Conflicts were resolved by retaining upstream recovery instructions plus the new complete-input semantics; README indices retain upstream release records. The original checkout's task patch was reversed exactly from its saved diff; only preexisting untracked `script/video/` remains there.

The second old-baseline real run passed seed-ingress (31 requests) but was deliberately stopped during cancellation after the baseline correction; it is not a completed main acceptance result. Driver credential cleanup passed. The main checkout needed `bun install --frozen-lockfile` for missing rimraf, then `bunx tsc --build packages/sdk/js/tsconfig.json --force` to regenerate stale SDK distribution exports. The first main checker attempt failed before any model request on that stale export; cleanup passed. Tests, typecheck and the original real checker are rerunning on main with the rebuilt local toolchain. No version bump, desktop restart, release or historical incident retry is authorized by this repair.


## Runner contract follow-up

Main review found the remaining production blocker in `agent/runner.ts`: it compared successor Delivery Slice subjects with the predecessor descriptor and rejected changed selections before streaming. Earlier admission tests bypassed this through fixture completion. Workflow, node, Session, source dispatch and Task authority remain immutable; subject selection is now explicitly per Turn and is validated by lineage admission/descriptor commit. Remove only the obsolete predecessor-subject equality and add a direct controlled-stream workload continuation through the actual runner, retaining separate collection delegated-stream and workload-admission coverage, including failed preparation recovery and current input visibility. Keep the existing identity checks and attachment authority intact.


The actual runner regression now uses the Advanced workload adapter under the production Orchestrator/dispatch pipeline and a controlled streaming Provider. It changes empty selection to one current Goal, injects a descriptor preparation failure, then resumes the latest accepted worker authority and verifies the current input in the visible Message/Provider prompt, exact descriptor subjects and database re-open. The direct workload case passed. The Advanced package does not project dispatch_agents, so an attempted Advanced collection scenario was invalid and removed; existing Light collection streamed execution and workload collection admission tests remain the respective contract evidence. Old inherited-continuation expected text was updated to include the now-visible effective input. Full streamed-file rerun pending.

On main, workload 33, collection 6, sweep 3, compatibility 2, coordination schema 2, occurrence 3, guidance 2 and cross-process admission 5 passed (56). Final package typecheck, docs (342 operations), architecture index, redundancy and lease-owner checks passed. Main real-checker root: `C:/Users/hengu/AppData/Local/Temp/opencorvus-test-run-ADDqUs/runner-10908-renxU7/runtime-root/tmp/opencorvus-task-control-pvHxNZ`; seed-ingress passed with 37 requests, remaining phases pending. This run's first phase started before the runner subject-equality removal; later phases load the updated source. It exercises inherited-input lifecycle/recovery, not the new explicit workload selection; the new controlled-stream regression is the selection proof.


## Final validation on main

- Delivery base: `origin/main` `3c9d16a4`; all implementation work is in the existing main checkout. Old checkout contains only the user's preexisting untracked video directory.
- Focused tests: 72 passed (56 admission/coverage/coordination/recovery tests listed above plus 16 actual streamed dispatch/runner tests). The full streamed file passes with the final runner correction and updated visible-input assertions.
- Real `check:task-control-real`: passed, 45 actual streamed model requests, complete accounting, 96-request cap. Phases: seed-ingress 37 requests, seed-cancellation 8, verify 0; all passed. Provider model `gpt-5.6-luna` and catalog/credential preflight matched; credential cleanup passed. Evidence: main-run `driver-result.json`, phase audits, `provider-preflight.json`, `task-control-checkpoint.json` and `source.patch` under the root above.
- Source timing limitation remains explicit: first real phase exercised inherited-input lifecycle before the runner subject check removal; changed-selection proof is the final controlled-stream runner test. This is not a real-model replay of the user's historical game or a full Mission changed-selection benchmark.
- Independent review: stale coordination command, actual runner subject fence, and completion-checker ingress convergence findings all fixed and reviewed again. Final review found no unresolved code issue. The requested direct-versus-collection coverage wording has been corrected.
- Package typecheck and documentation/architecture/control checks passed. Final Git checks and automatic upstream merge/push are the remaining delivery actions.
