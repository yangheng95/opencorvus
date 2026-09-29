# Agent execution redesign implementation

## Recall

- Latest user authorization: “开新worktree做”, following the explicit request to redesign the mechanism for completeness and efficiency. This authorizes implementing the reviewed design in isolation; it does not authorize modifying the frozen live comparison or silently creating new model samples.
- Design: [agent execution redesign](2026-09-30-agent-execution-redesign.md), committed and pushed on main as `21e3386fcd5132e9e4428d70e22c62e3d7dc252a`.
- Authorized worktree: `C:/Users/hengu/.codex/worktrees/agent-execution-redesign/opencorvus`; branch `codex/agent-execution-redesign`, created from that exact commit. Main workspace remains `D:/myhexin-local/opencorvus` and owns the original benchmark. No delegation.
- Setup: managed worktree registered successfully; `bun install --frozen-lockfile` completed with 3,373 packages. No model was called. Production changes below are limited to shared evidence and already-granted Tool execution; the proposed Base grants and owner prompt/workflow remain unapplied pending approval.
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

- The tagged sources contract and persisted boundary implementation below are implemented and checked; the full owner workflow remains approval-blocked.
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
