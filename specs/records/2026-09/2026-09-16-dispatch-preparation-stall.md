# Dispatch preparation stall

## Recall

- User reports Task tsk_g00VVMOEt900Ce9lAA5k stalled on the installed v0.1.0-beta runtime. This turn performs a read-only diagnosis of the real occurrence and defines the required repair scope; the implementation plan below is not completed. Do not restart the user's application or change the live Task without authorization.
- Acceptance: exact visible Tool identity survives the real SessionLoop-to-adapter boundary; preparation failure has a durable, observable recovery disposition; direct/collection, initial/continuation, process recovery, terminal and cross-project paths preserve their existing authority. Focused positive tests and independent read-only review are required. Installation/restart is a separate final action.
- Read: AGENTS.md, task-control-plane architecture, SessionLoop projected execution, dispatch adapter context, analyze-intent adapter, dispatch lineage/settlement, ingress evidence/reducer and abandoned-dispatch recovery. Full shared-path audit is ongoing before implementation.
- Search: the live Tool request names dispatch_agent, but its adapter error validates against analyze_intent. The projected SessionLoop execution wrapper supplies invocationIdentity without visibleToolName; the parser defaults to the consumer name. Collection and recovered coordination callers already explicitly carry the visible name. Only analyze-intent directly calls the Task Tool validator through execution.toolOptions; other adapters and all production constructors still require audit.
- Evidence: read-only SQLite URI mode=ro and query_only, exact Tool request/result/lineage/Protocol records; GET /global/health reports healthy and0.1.0-beta. No live mutations or Provider calls performed. Worktree has only pre-existing untracked script/video/.
- Independent feedback: none at plan creation; mandatory review follows implementation and validation. Prior release first-run HTTP checks covered conversation creation, not this real projected dispatch boundary.

## Observed incident and current diagnosis

-05:57:57Z: Task opened in epoch1 and ingress accepted.
-05:58:00Z: Orchestrator assistant began its control occurrence.
-05:58:41Z: dispatch_agent request and write-ahead lineage persisted for request-interpreter/analyze_intent. Tool result is infrastructure_failure: persisted Tool Part does not match visible tool=analyze_intent. No child Session exists for the lineage. No dispatch settlement or infrastructure Artifact exists for this Task.
- The outer Tool outcome is completed, while its semantic result is infrastructure_failure. The root ingress is resolved and the Orchestrator is idle; Task remains active. A completed Tool transport receipt is not proof that its worker was accepted or completed.
- The current abandoned-dispatch reconciler deliberately covers descriptor-backed workers only. A pre-descriptor lineage relies on dispatch admission/takeover. Whether this exact failure is retained/replayed by the single-command source, collection source, restart and terminal paths must be audited; it cannot yet be classified as only one adapter or Squad.
- Current database query found one matching visible-name error and one lineage whose child Session is absent. This bounds observed local occurrences, not the product-wide impact. Other installations and unobserved failures are unknown.

## Plan

1. Complete read-only audit of visible identity producers/consumers and pre-descriptor failure reduction/recovery across all production entries, occurrence types, concurrency and project boundaries. Keep runtime logs/DB content local; publish only bounded non-secret evidence.
2. Fix the originating shared identity boundary and the actual missing recovery/observability contract using existing primitives; do not weaken identity checks, invent messages, force Task state or add fallback identities.
3. Add positive regression tests entering real projected execution and persisted dispatch/ingress checkers. Exercise serial/collection and pre/post-acceptance failure/restart paths without UI automation or live credentials.
4. Run focused tests, types/docs and independent read-only review; fix all valid findings. Commit/push scoped changes and integrate the authorized branch into main. Prepare any necessary rebuild before requesting permission for a precise live-app restart/recovery action.


## Read-only findings

- High-confidence direct trigger: SessionLoop.wrapProjectedTool writes the real Tool request using its visible name but omits visibleToolName from the downstream opencorvus invocation metadata. analyze-intent-tool calls requireTaskOrchestratorToolExecutionContext with its internal adapter name; requireOrchestratorToolExecutionContext therefore substitutes analyze_intent, which conflicts with the persisted dispatch_agent Tool. The exact database result records infrastructure_failure/analyze_intent_adapter with this mismatch.
- The lineage art_g0VVMOQQY00QX3rCpl8c names child ses_hQftr0pWSwERCWja57TM, which is absent. Its dispatch_admission lease was activated1789538321750 and released/expired1789538321777; there is no live admission owner for that occurrence. The Tool result committed at1789538321780, outer completed outcome at1789538321784, and ingress disposition at1789538321947.
- The stalled reduction is also explained by code: ingress evidence counts inspect_dispatch_outcome as a decision without examining the result; the SessionLoop retained-decision reader similarly accepts completed dispatch Tool Parts. The abandoned-dispatch scanner intentionally excludes descriptor-less admissions. These facts explain why the initial ingress is resolved although no worker exists; they do not establish a complete repair of every shared recovery path.
- Collection dispatch explicitly passes visibleToolName=dispatch_agents; recovered coordination also carries the persisted name. This difference explains why tests of collection or other adapters can pass while the real single analyze-intent route fails. The broad impact cannot be reduced to only Advanced: the shared projected wrapper and pre-descriptor failure handling are involved. Other adapters, continuation, restart and cross-project repair invariants remain implementation-audit obligations.
- The live service health response is healthy=true/version0.1.0-beta. The current local DB has one matching identity error and one absent-child lineage. No model-timeout, CPU deadlock, user cancellation or successful worker execution is evidenced for this Task. Lack of a task.error or process incident does not mean the dispatch succeeded.
- Diagnosis is established; no production code fix, live Task recovery, application restart, rebuild or release was performed in this turn. Required repair and runtime recovery verification remain open. Do not treat the prior release's creation/restart smoke checks as coverage of this dispatch defect.
- Independent read-only review confirmed the code causal chain and both indexes, with no unsupported scope claim; it did not independently requery the live database. docs:check passed. This is a diagnosis record only, not repair completion.
