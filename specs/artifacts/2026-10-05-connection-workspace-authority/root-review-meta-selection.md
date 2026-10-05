# Metadata selection and accepted VCS mutation review

## Recall and boundaries

Root requested a read-only review of services/meta.ts, every production loadMeta/switchVcsBranch/commitVcsChanges/pushVcsBranch caller and the existing focused service tests. Settings reported that reloadProjectScope's outer selection predicate does not protect loadMeta's inner store writes. Root also requires preserving an already accepted Version Control System (VCS) write when only its later metadata refresh fails. No source/test/build/runtime/UI/credential/model/Git action occurs in this review. Four existing owned services stay held.

Read the full meta service, relevant board/project-directory/settings ownership definitions, config/init and TaskDirBar callers, diagnostics' existing post-commit primitive, three meta service test files and the metadata case in connection-projection-authority. No UI test was found or run. Original B work proved API endpoint ownership, while the new selection-only ABA and accepted-write refresh paths below are code-qualified findings, not a new actual Git mutation or visual reproduction. Existing Task/Mission/Session execution or scheduler state is not changed by this metadata projection proposal.

## Complete production boundary

| Definition/entry | Production callers and role |
| --- | --- |
| loadMeta(directory?, authority?) | config.reloadProjectScope line521, inside parallel config/extensions/meta/tasks projection; init.loadInitialData line158; TaskDirBar runtime-panel effect line1249 and explicit Refresh line1347; meta's switch/commit/push post-write continuations |
| switchVcsBranch(branch,directory?,authority?) → Promise<void> | TaskDirBar.selectBranch line902; after return it calls syncBranches and presents errors through branchError |
| commitVcsChanges(message,directory,authority?) → Promise<VcsCommitResult> | TaskDirBar.commitChanges line625; return contains accepted commit/info, clears edited commit message and shows commit success, then optionally calls pushVcsBranch |
| pushVcsBranch(directory,authority?) → Promise<void> | TaskDirBar.commitChanges line632 and pushChanges line657; success notice follows, generic git_action_failed catch otherwise |
| retireMetaProjection(clear?) | connection-projection.retireConnectionProjections; increments the original metaRequest and clears busy/error, optionally path/vcs/scope |

Line references are the reviewed current source, not frozen API contracts. All actual API calls already receive one captured authority. Branch generation uses the existing stream and is not a new write/retry queue. TaskDirBar already captures selectEpoch for presentation, but those caller checks happen after awaiting these helpers and cannot undo the helpers' internal store mutation.

## Cause 1: selection-only ABA and busy settlement

loadMeta currently captures directoryEpoch and metaRequest, then owns success/error/finally only while API authority, request number, directoryEpoch and active directory text still match. A Task/Session selection uses board.selectEpoch and may change activeProjectDirectory through selectedSource without changing directoryEpoch. A→B→A under the same API and same final directory, with no replacement meta load, therefore satisfies the old predicate and permits the first A response to publish into the later selection occurrence. The outer reloadProjectScope check cannot prevent this inner setPath/setVcs.

Adding selectEpoch only to the full predicate would prevent that write but expose the existing cleanup gap: finally would leave vcsLoading true when the old request retires and no successor meta request owns it. Existing source-reset paths can clear it, and an open runtime panel normally starts a replacement request, but neither eliminates the no-replacement case. The only production true writer is loadMeta; init/workspace/retire paths clear it.

Minimal contract: capture existing board.selectEpoch at loadMeta entry and include it in the full result/error predicate. Keep metaRequest as the sole request owner. At entry, an explicit directory that is no longer active must not install vcsDirectory/loading or retire a newer request; return the existing void projection outcome before incrementing metaRequest. In finally, release **only busy** when request===metaRequest, even when the selection/API/directory predicate retired. Do not clear new-owner errors/data there. A successor load or retireMetaProjection increments metaRequest, so old finally cannot clear its busy state. This is eventual settlement of that operation; it does not invent an immediate reactive cleanup guarantee while its HTTP request remains unresolved. Existing selection retirement sites remain their current owners; no service-global effect/root, secondary counter or cache is needed.

Normal success still publishes exact path/VCS and false busy. A current ordinary GET error still publishes vcs:null/vcsError and throws the original error. A retired result/error publishes neither data nor error, and its old request may settle its own busy flag only. Parallel project selections, same-directory different Session/Task occurrences, empty directory, explicit retry and API renewal all use the same rule. Durable execution occurrence, automatic retry and restart recovery are outside these client read semantics.

## Cause 2: accepted write versus projection failure

switchVcsBranch/commitVcsChanges/pushVcsBranch await their POST and then await loadMeta. When POST succeeded but either metadata GET fails, the helper rejects. Commit loses its known commit/info return, TaskDirBar shows git_action_failed, preserves the old message and does not reach requested pushAfterCommit. Branch selection reports failure and skips syncBranches even though the branch was already switched; push similarly reports generic failure after an accepted push.

There is also a concrete cross-selection projection trigger: commit and push check only API authority before loadMeta(oldDirectory). If the user selected another Project while POST ran, loadMeta writes vcsDirectory=oldDirectory/loading=true before its full predicate; it then cannot settle busy because its directory differs. Branch checks directory text, but a same-directory selection ABA still passes. The caller's own epoch predicate protects its notice, not this inner loadMeta entry.

## Recommended smallest accepted-fact contract

Capture the existing selection epoch and original directory at each mutation's logical entry. Keep the API POST outside any projection-only catch. An original POST failure, or typed API authority error with its actual response receipt, propagates unchanged. No replay, compensation or mutation against a successor backend is introduced.

After a fulfilled POST, refresh only while the original API, entry selectEpoch and active directory still match. Reuse one small private helper for these three proven duplicate post-commit refresh paths. Its ordinary current refresh failure is **handled as metadata failure**, not silently discarded: loadMeta already publishes the canonical vcsError consumed by TaskDirBar's visible scoped role=alert at lines1489–1492, while the helper records the accepted action plus refresh failure through existing AppLog/diagnostics. It must retain that visible error and original cause; do not clear it, manufacture a successful metadata snapshot or convert the accepted operation to generic write failure. Return the original commit result, or existing void success for branch/push, after this observed refresh settlement. The existing success notice and original compound commit→push can then proceed; an actual push failure remains an actual separate operation failure. If a later successful read clears an earlier refresh error, that is a new real projection result.

This recommendation relies on the existing scoped metadata alert as the user-visible error authority, rather than a new error store, new return union or mutation wrapper. The current synchronous runPostCommitUiEffect cannot directly catch an async Promise rejection, so passing async loadMeta to it would be incorrect. Do not broaden it casually. Root should verify that the accepted-success notice plus metadata alert is visible in the actual runtime panel; if it needs different placement, root must explicitly own that UI adjustment. Service tests must demonstrate the accepted return **and** exact retained current error state, rather than merely asserting the Promise resolved.

## Existing tests and proposed positive qualification

meta-project-scope has selected-Session scope, latest-request ordering and current error contracts. meta-vcs-actions has two stream-schema cases plus successful commit and push metadata refresh. meta-vcs-branches has exact branch list, malformed-row error and successful branch switch/refresh. connection-projection-authority covers an old API response after a new API's metadata request. None currently establishes same-API selection ABA with no replacement, owner-specific retired busy cleanup or accepted POST followed by failed GET. All are pure service/HostTransport tests; none is real Git/HTTP/UI acceptance.

Add only focused positive service cases after root implementation approval:

1. Deferred metadata, selectEpoch A→B→A without another load, then resolve: exact later view facts preserved and original busy settles false.
2. An old request retires while a successor owns a pending load: successor vcsDirectory/loading remain exact; resolving successor yields its exact VCS/error-free state. Repeat old error settlement to qualify the same owner rule.
3. Explicit out-of-scope metadata call preserves the current owner's complete projection state; current failed load still rejects its original error and exposes scoped vcsError/false busy.
4. Each mutation returns its original accepted result/void when a controlled later metadata request fails, with exact current vcsError and diagnostic cause. Commit result retains its commit/info identity; original POST error still returns that error contract.
5. Accepted mutation after selectEpoch retirement returns its original accepted outcome and preserves the successor Project/Session projection; same-directory ABA is included. API retirement continues returning original ApiAuthorityChangedError/receipt from the actual API primitive.
6. Current successful branch/commit/push refresh contracts and compound sequencing remain intact. No timeout sleep or absence-based mock assertion is a substitute for explicit resulting state/receipt.

Real destructive branch/commit/push acceptance is not authorized by this read-only review and cannot be claimed from those tests. Root may separately qualify a disposable owned Git fixture and actual runtime-panel success/error presentation; any network push requires its own approved destination. No Provider-backed commit-message request is necessary for the minimal service contract.

## Implementation authorization Recall

Root read the whole review and approved only services/meta.ts, the three existing pure meta service tests and, if necessary, the existing authority case. Config and TaskDirBar stay frozen. The exact approved contract is entry scope check before request/busy mutation, original selectEpoch in result/error ownership, metaRequest-only busy settlement, and one private accepted-mutation refresh helper preserving original API errors/receipts and accepted result/void while retaining current vcsError plus AppLog cause/accepted fact. No live VCS write, Provider/model call, runtime/page/build/Git or delegation is authorized. Root owns the eventual canonical build and actual alert presentation review.

Before editing, current meta.ts and all four potentially affected test files were copied without replacement to `.tmp-product-iteration/meta-selection-before/`. The whole current meta source was read, including existing authority, retirement and stream-close receipt contributions; functional confirms this implementation has sole meta ownership. Root is supplying the complete existing source diff for independent review because this child is not authorized to run Git. Any supporting test/type failure must be retained with its correction, and a passing service contract must not be labeled real Git/UI acceptance.
