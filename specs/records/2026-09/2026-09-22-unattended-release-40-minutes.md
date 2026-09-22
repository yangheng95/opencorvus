# Unattended release with a 40-minute budget

## Recall

- User: `30分钟可以扩展到40分钟，但是能保证全自动吗，除了开始修复问题，触发发布后不需要你再参与`. Expand the whole-release limit to 40 minutes and establish that dispatch is the final required operator/agent action. This does not authorize another product version, changing v0.1.11's immutable source, or retrying its expired historical run.
- Start: clean main at 54f0d35a; fetched and merged origin/main with no change. Preserve the user previews on 17881/17882. No UI change, model call, new branch/worktree, secret change or delegated agent.
- Read: AGENTS.md; RELEASE.md and docs/packaging.md; canonical local dispatcher, build/package-overlay/website workflows; release automation and workflow contract tests; native packaged first-run entry, updater settlement and website public probe; the original automatic-release plan and v0.1.11's actual job snapshots. Whole-owner search identifies the 30-minute policy in release-automation.ts, two 31-minute watchdog ceilings and the publication job's 30-minute ceiling. CI service and CodeQL 30-minute timeouts are unrelated and remain outside this change.
- Acceptance: one current 40-minute budget across native release, website child, queueing, retries and final result; watchdog containers outlive that budget; completion/error handling beyond minute 30 and at minute 40 follows the real lifecycle functions. Existing artifact/signature/identity/public-readback checks and final result gates remain intact. Dispatch does not depend on Codex, a local process or manual approval after it returns the run ID. External service failures still produce a failed/cancelled attempt, not guaranteed publication or unlimited automatic repair.
- Verification: focused non-UI lifecycle and workflow tests, actual release/job/environment evidence, docs, typecheck/push hooks. No new release is dispatched solely to test a longer timer; a fresh 40-minute complete native run is not claimed without that evidence.

## Analysis before implementation

v0.1.11's native/website mutations were fully automatic after dispatch. The exact website run succeeded at 02:21:21Z, parent publication finished at 02:21:35Z, and the newly scheduled aggregate result job was cancelled at the original 02:21:38Z deadline. The watcher correctly implements its old limit; raising only a displayed value would leave its two watchdog jobs capped at 31 minutes and publication at 30. Those ceilings and messages must follow the same policy. The earlier implementation solved delegation but left too little whole-run time for its measured cache/post-job and website stages.

Shared control audit covers tag/manual/local release ingress, native reusable jobs, serialized publication/update/website groups, exact child identity, cancellation propagation, same-run reruns and terminal result checks. All use the original run creation time. Product Task/Mission/Session occurrence scheduling and multi-project runtime state do not participate and are excluded. There is no new state store, route, API or fallback. Version/source/run ownership and completed-artifact retention remain unchanged.

There is no required agent step after dispatch: native packaging already runs the exact first-run checker; publication automatically uploads and settles the release/updater, dispatches the website, awaits its exact result and evaluates the final aggregate job. Website activation verifies its signed candidate and public manifest/health, and rolls back a failed public probe automatically. The extra manual public download and screenshot checks in the previous turn were supplemental evidence, not prerequisites. Read-only GitHub environment inspection confirms production currently has only a branch policy, with no required reviewer/wait timer. No environment protection is removed.

## Plan

1. Set the canonical budget to 40 minutes and derive runtime messages from it. Set both watchdog job ceilings to 41 minutes and publication's ceiling to 40; retain shorter per-stage bounds.
2. Add positive boundary/continuation cases using the production lifecycle against the existing local HTTP test server. Couple workflow ceilings to the exported policy in the existing workflow contracts and preserve automatic success/failure propagation checks.
3. Document the unattended handoff and its failure boundary in RELEASE.md. Update this record/indexes, run focused checks, review the final diff, commit and push with normal hooks. Use actual prior run evidence to verify automatic wiring without altering an already published identity.

## Authoritative references

- [GitHub job timeouts](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#jobsjob_idtimeout-minutes): job ceilings are separate from the application-owned whole-release clock.
- [Workflow dispatch events](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#workflow_dispatch): the existing remote dispatch/delegation path is supported; no local agent callback is required.
- [Cancellation behavior](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-cancellation): cancellation is a platform operation, not a guarantee of instantaneous physical process termination.

## Implementation and evidence

- Implemented one 40-minute policy with derived runtime messages, two 41-minute watchdog ceilings and the 40-minute publication job ceiling. Historical 30-minute release records remain truthful. No product version or immutable release identity changed.
- All 27 focused lifecycle/workflow/dispatcher tests passed (231 assertions). Production lifecycle functions exercised through the existing local HTTP server cover website dispatch after minute 30, both native/delegated queued result jobs completing after minute 30, remaining time at minutes 30/39, expiry at minute 40, original-clock reruns, cancellation propagation and explicit failed outcomes. Workflow contracts couple the structural ceilings to the policy. These are contract checks, not a newly executed 40-minute native release.
- Fresh read-only GitHub evidence confirms v0.1.11 parent publication automatically executed Release settlement, update settlement, exact website dispatch and successful await; child 35678767856 finished successfully on the same source/first attempt. Production environment has only the main branch rule, with no reviewer or wait-timer requirement. No external configuration was changed. The prior final parent cancellation remains a historical failed result and was not rerun.
- Documentation and whitespace checks pass. Final scope includes workflow policy/tests, release/changelog documentation and this indexed record. Normal commit/push hooks are the remaining delivery check; another public release is not part of this configuration change.
