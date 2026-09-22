# GitHub Actions retention cleanup

## Recall

- User requested expired Actions cleanup, then explicitly selected: delete completed non-release runs older than 30 days, preserve release records and the latest success/failure for every workflow. Subsequent request: `过期的workflows也删除`.
- Start clean at 22aac022. Preserve current 0.1.12 release run 35695292039 and all pending/running runs. Do not cancel superseded active CI. No artifact-wide purge, release/tag deletion, new retention automation, credentials export or user-process changes.
- Read RELEASE.md, current build/deploy/debug/reusable/test workflows and historical deletion commit 166c0c37; searched retired workflow callers; inspected remote default-branch files, workflow registrations and all 4037 run records. No delegation.
- Freeze cutoff at 2026-08-23T06:37:36Z (30 days before the audit). Both created_at and terminal updated_at must precede this cutoff. Preserve latest completed success and each failure-class conclusion (failure, timed_out, startup_failure, action_required) by stable workflow ID, not display name.

## Analysis and execution plan

GitHub artifact expiry is not workflow-run expiry. The 226 expired artifact metadata rows are not a deletion scope and their recorded sizes do not measure reclaimable storage. The run inventory is unfiltered/paginated to avoid the 1000-result filtered search limit; IDs are deduplicated before selection.

Native release/build packaging and website deployment paths are protected, as are release events and version-tag branches. Exact allowlisted non-release paths are CI, CodeQL, the retired build-check/typecheck/generate/security files and GitHub-managed dependency jobs. Keep 21 latest success/failure-class records. The reviewed candidate ID snapshot and per-ID receipts are retained locally under `.scratch/actions-cleanup-20260922-*`. Re-read each candidate before DELETE; require matching workflow ID/path/attempt, completed state, old creation/update times and preservation predicates. Bound writes to at most one per second and stop on API rejection rather than broadening scope.

Commit 166c0c37 deleted build-check, typecheck, generate and security YAML files and consolidated their checks into CI. Remote main confirms their absence; generate/security registrations already have state deleted. Build-check/typecheck remain active historical registrations, so disable these two IDs through the supported API. Current build, debug package, reusable package, website, CI, CodeQL and GitHub-managed dependency workflows remain. The documented workflow API has disable/enable, not a standalone delete-registration endpoint; protected history will not be erased to hide an obsolete sidebar entry.

After remote cleanup, verify every successful deletion is absent from a fresh inventory, every protected snapshot record remains, and both obsolete registrations are disabled. Record exact counts/limits, run docs/index checks, and commit/push this scoped operational record with normal hooks.

## References

- [GitHub workflow API](https://docs.github.com/en/rest/actions/workflows#disable-a-workflow)
- [GitHub workflow-run deletion API](https://docs.github.com/en/rest/actions/workflow-runs#delete-a-workflow-run)

## Outcome

- Deleted all 624 reviewed candidates, with zero failed requests, skipped changes or unprocessed IDs. Counts: CI/test 142, typecheck 142, CodeQL 95, generated-artifacts 93, security 93, build-check 56 and Dependabot Updates 3. No independent artifact, Release, tag, cache or branch deletion was performed.
- Fresh completed-run inventory before the frozen cutoff has 559 records. Set comparison confirms every deleted ID is absent and every old non-candidate snapshot ID remains. All 21 protected latest success/failure-class records and four then-unfinished runs remain accessible (25 total); run lifecycle changes during cleanup were not mistaken for deletion.
- Remote workflow 334450725 (build check) and 329569775 (typecheck) now report disabled_manually. Their YAML sources remain absent from main. Workflow 329569771 (generated-artifacts) and 329569773 (security) already reported deleted. Protected historical records remain; complete disappearance of obsolete historical entries is not claimed and their recent/latest histories were not purged to force it.
- During preservation verification, release run [35695292039](https://github.com/yangheng95/opencorvus/actions/runs/35695292039) was observed completed/failure. Windows CLI archive validation failed at 06:42:34Z with `Work Artifact PPTX inspection exceeded 30000ms`, involving presentation-inspector-process.ts. The cleanup's first deletion receipt was created at 06:43:10Z, after that failure. The pipeline's result/deadline jobs propagated failure; this was not a 40-minute timeout. No release retry, cancellation, repair or owner mutation was performed. The deeper inspector/process-admission cause remains uninvestigated in this cleanup task.
- Documentation and architecture-index checks passed before mutation; rerun with the completed record before committing. The operational plan, per-ID receipts, protected-record reads and set-comparison result are retained in `.scratch/actions-cleanup-20260922-*`.
