# Agent execution redesign implementation

## Recall

Current checkpoint: the user explicitly approved the proposed Base tool/owner scope. The ordinary direct-owner production/review/repair flow and existing Mission recovery checks now pass locally with scripted streaming Providers. The prior approval block below is historical. Implementation review, generated SDK/package metadata synchronization, final checks and Git main convergence remain in progress; no real business-model benefit is claimed.

- Latest user authorization: “开新worktree做”, following the explicit request to redesign the mechanism for completeness and efficiency. This authorizes implementing the reviewed design in isolation; it does not authorize modifying the frozen live comparison or silently creating new model samples.
- Design: [agent execution redesign](2026-09-30-agent-execution-redesign.md), committed and pushed on main as `21e3386fcd5132e9e4428d70e22c62e3d7dc252a`.
- Authorized worktree: `C:/Users/hengu/.codex/worktrees/agent-execution-redesign/opencorvus`; branch `codex/agent-execution-redesign`, created from that exact commit. Main workspace remains `D:/myhexin-local/opencorvus` and owns the original benchmark. No delegation.
- Setup: managed worktree registered successfully; `bun install --frozen-lockfile` completed with 3,373 packages. No model was called. The foundation preceded the explicitly approved Base grants; the owner prompt/workflow is now implemented as recorded below.
- Preserve AGENTS: single authority, no Host semantic business gate, real visible messages, streaming, exact permissions, no UI automation, positive production-path checks, scope commits and pull/merge/outgoing review before eventual main delivery.
- Completion remains implementation + focused real checks + independent review + main convergence; worktree creation and this plan alone are not implementation completion.

## Verified mechanism and impact

The current Core prompt explicitly forbids the Task Orchestrator from producing any deliverable. It therefore requires a separate complete executor even when the root role could own the same authorized outcome. `PromptProfileResolver.resolveSchedulerCapabilityForContext` already resolves explicit default/package MCP and package Tools for this role under the exact frozen package. This is an existing permission/projection owner, not a reason to add a parallel lead-role registry or an implicit grant.

A single accountable root must not weaken independent review. `tool/read-agent-message.ts` currently accepts only final Messages authenticated by `taskOwnsDispatchFinalMessage`; its causal inventory is bounded to that worker's accepted-input parent. It cannot expose the root's still-active assistant message containing completed business Tool steps before review dispatch. Root assistant Messages may aggregate several Provider steps, so accepting the entire current Message would expose later or same-step sibling output. This is the concrete data-flow dependency to solve before enabling root production.

The existing `dispatch_lineage` already names Task/epoch, exact orchestrator Session/Message/ToolPart, child Session and continuation. `assistantActionFactScopeInTransaction` already resolves the persisted Provider step-start cutoff before an action. Reuse both; do not mint another evidence snapshot authority, copy source output into a producer-authored report, or relax Task ownership.

Current Base and AutomationBench packages require an executor followed by a verifier; Base additionally has source-planning and parallel-research workflows. A revised simple delivery can place production responsibility and its exact existing tools on the package's current scheduler projection, with review as a bounded existing collaborator. Rich specialist workflows may still use real dependencies; the Core must not force a useless intermediate agent. This mapping refines the design's word “owner”: reuse the existing Task decision Session and package scheduler slot rather than adding a second lead binding or changing a Session's identity mid-run.

## Search and ownership inventory

| Surface | Evidence / disposition |
| --- | --- |
| Task root | `orchestrator/agent.ts`, `prompt/core/orchestrator-core.txt`, `agent/role-contract.ts`; retain sole Task decision/lifecycle ownership, replace unconditional production prohibition with exact projected-capability ownership |
| Projection | `expert-squad/prompt-profile-resolver.ts`, `agent/tool-pool-data.ts`, SDK `src/expert-squad-manifest-v2.ts`; explicit package grants only; no grants inferred from the word owner |
| Evidence | `tool/read-agent-message.ts`, `agent/artifact-provenance-facts.ts`, `engine/dispatch-lineage*.ts`; use one authenticated reader for worker settlement and dispatch-origin evidence |
| Reader callers | `orchestrator/tools.ts`, `tool/panel.ts`, worker Core Tool, dynamic/light package production-path tests; update the shared contract consistently |
| Handoff | `orchestrator/dispatch-turn-projection.ts`, dispatch adapter input/context; project exact evidence identity from existing lineage into the real dispatch result/input, never synthesize a participant or hide source text |
| Packages | `expert-squads/builtin/automationbench` and `src/expert-squad/builtin/base`; remove replaced redundant producer instructions/topology together, preserve required independent review and specialist resource ownership |
| Mission | `prompt/core/mission-core.txt`, completion and acceptance contracts; consume scoped Task acceptance evidence and new cross-Task gaps, retain exact terminal occurrence and authority |
| Runtime | Existing ingress, physical leases, cancellation, Task completion, SessionWake, effects, restart reconciliation; identity and physical completion contracts remain authoritative |
| Evidence tests | Existing reader contract and dynamic/light package tests are non-UI; relevant positive behavior must exercise actual persisted Messages/Tool requests/outcomes and the production reader |
| Deferred verification | Public API/CLI/Control/Channel, Task/Mission occurrence, normal/terminal/retry/restart, parallel/serial and multi-project acceptance must be checked after the core change; existing benchmark protocol and raw outputs stay frozen |

## Implementation sequence and acceptance

1. Complete exact caller/epoch/step-boundary and permission analysis. Define one source-reference contract for existing settled worker evidence and the root evidence preceding a real dispatch. Validate typed ownership errors, bounded redaction/chunking, earlier-step visibility, and exact output content through the real reader against persisted facts. No production prompt switch before this prerequisite works.
2. Enable accountable root delivery through the existing projection and role. Adapt the simple package delivery topology and prompts, removing replaced executor indirection. Preserve independently authorized review tools and declared acceptance. Do not claim read-only permission enforcement from prose: inspect the actual generic tool permission surface before choosing its implementation.
3. Carry concrete review differences back to the same root/worker lineage and reconcile Mission acceptance around exact Task evidence. Preserve irreversible-effect history, current-object validation, independent original-request comparison and explicit blocking conditions.
4. Run focused positive checker paths, package installation/projection, actual message/dispatch/effect lifecycle and the existing relevant Task-control checker. UI changes are not part of this implementation unless a concrete public contract makes them necessary; never run UI tests.
5. Review scope, source authority, stale-read/parallel-boundary risks and recovery paths. Commit this worktree's changes, merge current upstream, review complete outgoing commits, and converge the authorized branch to main after required checks. Do not mix other workspace changes or release merely because source is pushed.

## Remaining unknowns and risks

- The tagged sources contract, persisted boundary and explicitly approved owner workflow are implemented. Final generated-interface checks and main delivery remain pending.
- Production review needs to distinguish a real independent comparison of shared immutable Tool facts from trusting a worker's summary; repeating every external read is not itself a correctness requirement.
- Exact per-tool read/write permission handling for a generic MCP API fetcher must be established before calling the review projection read-only.
- Context and control-call reductions need real measurement after implementation; original comparison scores do not measure this redesign.
- New business Provider observations require a separate complete registration under the user's preserved constraints. No such run has been launched.

## Evidence contract decision

Use one tagged `sources` collection: `dispatch_result` names a terminal worker Message; `dispatch_origin` names an existing dispatch lineage. Replace the former Message-only reader input and update its callers together. The origin source resolves its Task-bound root Session/assistant/dispatch Tool Part from immutable lineage and the existing persisted Provider step-start boundary. It projects only Tool requests and terminal outcomes strictly before that boundary; same-step siblings and late settlements are outside the source. The source includes historical root reads from the same Task Session before this boundary, explicitly as timed facts rather than current instructions. This permits review after a root continuation without rewriting evidence. Root text is not projected as a settled report. Exact Tool Part membership, not only Message membership, authorizes detailed reads.

This is read-only and accepts historical Task evidence after an epoch advances; it grants no execution authority. Cross-Task lookup still fails. Parallel dispatches in one Provider step share the same preceding boundary, and a later settlement cannot change that source's eligible facts. Millisecond-equal outcome timestamps are conservatively excluded because current tables have no cross-table monotonic settlement sequence. This limitation must be exposed and tested, not silently interpreted as absence. No new database schema, synthetic Message, or evidence snapshot store is introduced.

## Shared execution path decision

The Session loop already supports both Registry leaves and role-specific runtime leaves under one exact harness projection, including permission intent, live metadata, stream persistence, cancellation and restart. Root `bash` instead uses `orchestrator/runtime-repair-tools.ts`, a second shell owner with its own timeout/output handling. Root `read` and capture also wrap the existing Tools separately. Replace these custom leaf factories with the existing Registry leaves: the scheduler's single projectable-tool declaration identifies ordinary execution tools; `schedulerRuntimeToolIDs` returns only genuinely role-specific/extension leaves, and both initial Task admission and permission restart use that same function. Existing harness validation already checks the union of Registry and runtime leaves, so no new Tool adapter or runtime contract is needed. Delete the replaced repair implementation. Do not broaden the active package's grants implicitly; packages must explicitly grant each new execution capability.

## Approval review boundary

Automatic approval review rejected applying the Base grants + owner prompt/workflow change: it considers assigning shell/file-write/network tools to the Task root a high-impact permission expansion requiring explicit authorization of that scope. No part of that rejected command ran; the Core and Base manifest remain unchanged. The exact proposed grants and ordinary workflow change are available in the unapplied `.tmp/task-owner-permission-proposal.patch` in this worktree. The proposed root tools are bash, glob, search_code, edit, write, apply_patch, webfetch, websearch, external_code_search, todo, browser_preview, browser_preview_capture, plus the same existing browser/method capability set used by Developer/Tester. Independent Tester remains mandatory; operator permission handling and fixed package/Task binding remain in force. The proposal does not authorize any live benchmark, credential use or release. Continue evidence-reader/shared-path checks while this approval is pending.

## Foundation checks

The unified reader migration passed the existing production-reader, real package loading/dispatch and failed-Task Mission paths: 10 checks / 247 assertions before the new origin case. The persisted origin case then passed with 13 assertions, including exact prior Tool output, same-step siblings, late/equal-time outcomes and cross-Task typed rejection. SDK source exports were compiled locally because a new worktree initially has no generated `dist`; the repository isolated test runner also built its native process supervisor. No credentials or business Provider were used.

An initial shared-Registry check exposed an outdated fixture that hand-built the deleted root read wrapper; the fixture now uses the same schedulerRuntimeToolIDs resolver as production and directly executes the Registry read against a real test-project file. Final results and broader control recovery checks will be recorded after they settle. Source type checking passed before this final test update. The live Provider Task-control checker requires explicit credential/model registration and has not been run; these backend checks must not be presented as measured business or performance success.

## Foundation checkpoint before the blocked owner switch

Implemented only in the authorized worktree:

- One tagged-source evidence reader for worker finals and root facts preceding a real dispatch, including exact Part membership and conservative late/equal-time settlement exclusion. Actual dispatch input exposes its existing origin identity.
- Shared Registry execution for already-granted root tools, with initial admission and permission restart using the same owned-tool resolver. Removed the duplicate repair shell/read/capture implementation. Package grants and Core production prohibition remain unchanged.
- Migrated Panel, SDK/OpenAPI and real reader callers to the source contract; no compatibility reader is retained.

Verified 91 distinct backend checks / 758 assertions: reader/package dispatch 10/255; role routine authority 19/42; Registry file read/snapshot/permission and Skill outcomes 8/98; Tool control/epoch/cancellation/operating-system process-cut recovery 36/117; streamed dispatch/continuation/settlement through the production Session loop with a scripted local Provider 18/246. The initially obsolete fixture failure is preserved in `.tmp-root-tools-check.log`; its corrected rerun passed in `.tmp-registry-root-check.log`. The streamed checks are in `.tmp-streamed-evidence-check.log`, origin checks in `.tmp-origin-check.log`. These are execution/data-flow checks, not a real business-model benchmark or UI acceptance.

Official SDK build and final source typecheck passed. `docs:check` passed (342 operations / 25 groups), `check:architecture-index` passed (17 current documents), and `git diff --check` passed. Existing independent review and production grants are unchanged. No real Provider, new benchmark, credential copy, user-process restart or release was performed by this implementation.

Still required: explicit approval of `.tmp/task-owner-permission-proposal.patch`; accountable-owner Core/package implementation; complete effect/permission and entry/recovery review for that topology; focused delivery checks and a separately preregistered real business/performance comparison; final main convergence. The current checkpoint stays isolated on the authorized feature branch pending the rejected permission change. Do not describe the redesign as completed, merge an unfinished owner switch, or resume a paused benchmark goal/automation.

## Explicit permission received

The user answered “授权上述范围，继续实现” to the exact Base root-tool/owner-workflow proposal. The earlier automatic-review block is resolved for that specified scope. Applied the reviewed Core/manifest proposal after confirming target files were unchanged; Git required ignore-space-change for Windows checkout line endings. Base now uses direct production with one independent Tester node for its ordinary workflow. Richer existing specialist workflows retain their real declared dependencies. No benchmark root, credential policy or release is changed by this authorization.

## Root-owned acceptance repair impact

`MissionAcceptanceCriterionResponsibilitySchema` currently admits only initialization, workflow-node and direct-worker responsibility. Once the root produces, assigning its mistake to an invented producer node would falsify ownership. Add `task_owner` to the same existing ledger responsibility union; the ledger's Task and exact reviewed terminal occurrence already identify this owner. No second binding/store or Host business judgment is needed. Existing immutable responsibility, evidence roles, epoch, selected package/workflow and completion checkpoint checks stay in force. A root-owned gap invalidates the selected workflow's assurances conservatively; the root may perform its repair and dispatch an actual declared reviewer to record the existing checkpoint. Before the first dispatch a root-owned gap can bind the real review workflow without pretending it was an initialization failure. Audit sites: acceptance-gap schema/rendering, acceptance-ledger responsibility validation/affected-node closure/dispatch evidence consumption, Orchestrator initial repair binding and prompts, generated public SDK/OpenAPI, Mission recovery and acceptance-delta checks. Specialized producer responsibilities continue to use exact node/lineage identities.

## Actual root admission failure and shared owner fix

The new streamed direct-owner checker reached Task creation but zero model calls. Its persisted `requireTask(...).error` reported runtime-projection Tool IDs mismatch: Browser MCP identities were expected as root runtime Tools while the harness correctly classified them as MCP. The former schedulerRuntimeToolIDs included every package/MCP extension, although SessionRuntimeContract validates runtime-projection/default-tool-registry ownership separately from typed package/MCP owners. Workers already resolve those extension leaves through the shared exact Catalog materializer. Keep that owner boundary: root runtime factories own only root-specific built-ins and default-host wrappers; package/MCP leaves keep their existing exact Catalog execution path. Also compare runtime-projection identities against builtInToolIDs, since default-host wrappers have their own owner. This same resolver feeds initial root admission and permission reconstruction; worker validation retains the same typed ownership rules. The failure is mechanical before inference, not model behavior. The local streamed checker is the regression path.

## Owner-flow checks

The direct-owner production-path checker passed (1 check / 14 assertions): root writes a deliberately incomplete file, a real separate Tester reads root Tool facts and the current file, root repairs it, and the same Tester Session continues and verifies the corrected value. The actual Task reaches completed with one completion decision; both dispatch lineages belong to Tester. The local scripted Provider determines decisions, so this demonstrates execution and evidence transport, not real-model semantic reliability or speedup.

Existing delegated Mission recovery is now tested with an explicitly authored two-member test package rather than silently expecting Base's removed ordinary producer node. It passed (1 / 34): preserved prior effects, exact stale-continuation rejection, same-Task recovery and new independent review. Acceptance-delta checks passed (18 / 43), including the new task_owner responsibility across initial review binding and later ledger transitions. Base/Advanced package projection checks passed (6 / 179); obsolete assertions about replaced Base prompt wording were removed, and existing shared read_agent_message grants are reflected in role expectations. New ordinary Base and legitimate specialized delegation remain distinct real contracts, not a compatibility workflow.

The actual root admission error was resolved by retaining MCP/package Catalog ownership instead of pretending extension leaves are root runtime factories. After this fix root production, review and repair executed; a subsequent checker mistake used kind instead of the real EvidenceLocator source field and was corrected in the checker. No production validation was relaxed for that mistake.

## Tool inventory bound under a single root Message

A root assistant Message can aggregate many Provider steps. The former detailed evidence page bounded Message count (16) but not Tool Parts within one Message, so direct owner evidence could produce an arbitrarily large metadata page. Bound detailed inventory by 16 actual Tool Parts instead, with an exact source/Message/Part continuation cursor. Keep the compact index's existing character bound and exact evidence chunk reader. Final-report Tool metadata also returns a bounded prefix with an explicit completeness flag; raw narrative remains its existing visible report contract. This fixes a data-size property of the new root path, not an asserted explanation of historical benchmark time.

## Bounded evidence review

Root Messages can contain many Provider steps, so paging only sixteen Messages was not a size bound. The existing reader now pages sixteen exact Tool Parts per source using a Message/Part cursor, retaining exact causal membership for chunk reads from earlier pages. A persisted root Message with 34 eligible Parts is recovered completely across pages by the real reader. Its compact index remains separately bounded. The final participant narrative retains its existing contract. Both Registry editing families (write/edit and apply_patch) passed the direct-owner review/repair checker: 2 checks / 28 assertions. The failed-Task/origin reader check passed 1 / 17; shared Tool control, permission continuation and operating-system process-cut recovery passed 36 / 117. No test adds real Provider observations.

## Final local contract review

The existing public Mission extension checker now covers both task_initialization and task_owner responsibility through real read/resume/extension/reconciler paths, completed and cancelled boundaries, stale revision rejection and recovery of an already applied input: 4 checks / 100 assertions passed. Exact MCP schema drift after reveal remains rejected by the existing production checker (1 / 5). Permission reconstruction now reuses activeProjectedSchedulerToolIDs instead of maintaining a second membership list. The current SDK/OpenAPI build, source typecheck, API docs and architecture index passed.

Source scope: Base ordinary delivery is replaced; richer declared specialist workflows remain explicit package contracts. Existing Task and Mission entrypoints converge on the same Orchestrator/Session execution owner; no new scheduler, lifecycle state, database migration, retries or permission bypass were introduced. Legacy frozen benchmark packages/inputs and all closed runs remain unchanged. The existing deep cancellation-promise issue is not claimed fixed by these changes. A scripted local model proves transport, identity, effects, continuation and terminal contracts, not semantic correctness or measured time/cost improvement. Real-business and performance evaluation remain separately registered follow-up work; no new model sample is authorized by this source delivery.

Git integration is now pending against concurrent upstream commits 385b1d5d, d8d980dc, cb11bf7d and 3d77ee1c. These include shared Session and generated interfaces; merge them in the isolated worktree, regenerate from the combined source if needed, then rerun the affected local paths before main convergence. Preserve the original workspace and its other changes.
