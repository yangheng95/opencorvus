# Primary Git marker final independent review

## Recall and current actual qualification

Root requests read-only review after applying instance-git-marker-convergence-plan.md. Read its Recall/exact implementation, current predicate/constructors/InstanceContext consumers, prior Actual04 evidence and selected existing lifecycle/background test source. No source/test/index/Git/checker/service/runtime/Provider/credential/UI or delegation. Root reports original directory checker 05 **3 pass / 56 assertions / 13.04s**, with the original 90-second per-case budget unchanged. That is Root's real store/Hono/bootstrap qualification, not a child execution or full active/restart guarantee.

## Exact implementation consistency

Current needsProjectRefresh (`instance.ts:1009`) reads `Project.isGitRepo(ctx.project.worktree)` for comparison to ctx.git. It separately preserves the original `(ctx.project.id === 'global' || ctx.worktree === '/') && Project.isGitRepo(ctx.directory)` discovery trigger. No new marker, owner, route, gate or timeout is introduced. Current post-preparation comment describes synchronous lifecycle/cache/rollback validation rather than endorsing a permanently mismatched sandbox predicate.

All three current producers agree with the comparison owner: seedProjectDeletionIdentity (`:314`) records primary project.worktree; refreshedContext (`:1046`) records next.project.worktree; applyContext (`:1054`) records the refreshed primary root. InstanceContext declares the boolean (`instance-context.ts:12`), but there is no separate exported Instance.git method or durable Git column. The targeted read/write search in Instance found only those producers and needsProjectRefresh. Other ProjectInstanceContext consumers read directory/project/capability state: Snapshot.track reads current project then independently observes Project.isGitRepo(project.worktree); capability catalog reads current cache context, not this boolean as a sandbox feature flag. No contradictory current git-field consumer was identified.

For actual parent-Git/plain-sandbox fixtures, the stored marker and observation now both refer to the parent's primary root, while the addressed directory/worktree remain the sandbox. This repairs the demonstrated false-vs-true refresh condition at its shared source. It does not claim the sandbox has local .git. A normal non-Git Project's primary root equals its own directory, so local Git creation changes the primary observation and still requests refresh. Existing global/root special discovery remains addressed-directory-specific as planned. Alias/stat/Project generation/maintenance ownership semantics are unchanged.

No current consistency issue was found in this narrow producer/consumer correction. The chosen primary-root contract differs from the earlier optional local-marker candidate; it preserves the already-established constructor semantics and public context role. Do not reintroduce a second sandbox boolean solely to avoid an unexercised case.

## Shared path and occurrence matrix

| Surface | Current source coverage / actual boundary |
| --- | --- |
| Normal Task/Mission/Session/CLI/runtime entry | All use the same contextPreparationRequired/prepareContextInTurn predicate. Root05 qualifies directory list stores and production Hono/bootstrap for registered A/B plus independent C |
| First/known initializer and nested entry | Existing initialized/initRuns caching and same-key entry/lease mechanics unchanged; no failure cleanup shortcut. Dedicated tests remain candidates below |
| Serial/parallel serving and queued preparation | Existing lifecycleQuiet, cache/rollback checks, exclusive turn and serving registration unchanged. Root05 sequential route success does not certify adversarial parallel admission |
| Background/recovery | Same provide/predicate reached through runInstanceBackgroundWork and Task-control/session wake/scheduler recovery; cancellation and physical settlement remain their actual owners. Root05 does not exercise all active recovery work |
| Normal terminal / cancellation / error rollback | State disposal/initRuns reset, retained rollback, serving drains and cleanup logic unchanged. Final disposal/error masking seen in Actual04 is not independently repaired by this predicate change |
| Retry/restart | Same marker is rebuilt from current primary root on construction/refresh; failed initializer marker removal and durable recovery remain existing contracts. No process restart/active leased retry was executed in this review |
| Promotion/tombstone/Project deletion | Seeded deletion identity has matching primary-root marker; explicit refresh and maintenance admission remain unchanged. Real promotion/deletion/fence restart still requires its own qualification |
| Config/peer transition | Config generation/cache invalidation and explicit refresh reuse existing owner; no new independent initializerChanged state. Root05 says nothing about cross-process peer writes |
| Sandbox/multi-Project isolation | Directory cache keys, real registry identity and primary root remain distinct. Actual same-Project A/B and independent C directory checker passing qualifies its observed scope, not every alias/case-sensitive filesystem |

The earlier repeated stages had no lease/caller/request origin, so the exact 259-cycle admission actor was not proven. Successful unchanged-budget rerun plus corrected owner predicate is meaningful root-cause evidence, but should not be relabeled proof of every background branch or original cleanup race. New abnormal scheduling/recovery findings still require horizontal audit under AGENTS.

## Minimal existing positive non-UI checks for Root

Read the following source and test assertions; they use genuine owned fixture/Instance/Database/native lifecycle with deterministic barriers/traces and positive result/error contracts. No component/DOM/browser/screenshot automation was identified in these files, and none was run by this child.

1. `test/project-instance-lock-liveness.test.ts`: concurrent first admissions with a long serving function; new initializer while another lease serves; queued preparation ordering; one actual shared initializer; disjoint/alias Project registrations; nested same-key initializer; concurrent open/dispose/serve; disposal under continuous admissions. This is the smallest existing file for the serial/parallel entry-turn matrix.
2. `test/instance-background-work.test.ts`: diagnostic preservation through actual cancellation and joined cleanup, external owner cancellation, global disposal across Projects, admitted lease validity through cancellation, teardown/admission race, live context and completed-work trace. Its last test's wording mentions “nothing,” but the inspected core verifies affirmative execution/settlement trace; do not use the title as test classification.
3. `test/project-instance-capability-refresh.test.ts`: **non-Git→Git** actual refresh revalidates capability authority before peer lease admission. This directly guards legitimate marker transition rather than asserting refresh disappeared.

Root's exact existing per-file checker command, from packages/opencorvus:

```powershell
bun script/run-tests.ts test/project-instance-lock-liveness.test.ts test/instance-background-work.test.ts test/project-instance-capability-refresh.test.ts
```

Use the mature runner/preload/native fixture lifecycle; do not invoke a broad suite or force-disable preparation. `instance-nested-provide-during-preparation.test.ts` additionally exercises actual bootstrap's nested read, terminal-profile typed degradation and unexpected-error rollback if that specific boundary warrants further qualification. `config-peer-convergence.test.ts` and persistent-instance-publication tests belong to later actual peer/publication matrices, not mandatory broad expansion merely because their names match.

## Unverified delivery limits

Root05 establishes the exact directory-checker contract under unchanged budget. Full active Task/Mission/Session cancellation, process restart/leased recovery, Project promotion/tombstone/fence races, Config peer changes, physical aliases/case-sensitive Windows directories and ordinary Sol/UI remain explicitly unverified by this review. The selected lifecycle files are source-reviewed candidates, not passed receipts. Root alone should record their actual checker outputs and source/service/process cleanup, then update architecture/indices and delivery. No source change is requested by this independent review.
