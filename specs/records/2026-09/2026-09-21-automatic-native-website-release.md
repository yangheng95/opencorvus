# Automatic native and website release repair

## Recall

User requests: repair automatic native binaries and website publishing; every release must be automatic and complete within 30 minutes. Earlier explicit authorization to publish 0.1.10 and the website remains active. Work only in the sole main checkout D:/myhexin-local/opencorvus; consolidation completed at 2d9e5362. Existing uncommitted archive files are not imported. No new branch/worktree, Provider calls, or user process/VM restart. Preserve exact release/tag/run ownership and secrets, native platform/format completeness, installer and updater verification, website signing/trust/activation/rollback. Independent review before this implementation: none; prior RPM reviews and consolidation reviews are recorded separately. Existing read-only reviewer may review after initial validation; no implementation delegation.

Acceptance: one normal release dispatch/tag path produces all five GUI/CLI platforms, all Linux formats/signatures, public asset and updater manifests, successful website deployment and exact public download readback. Final result includes measured elapsed time from the original release workflow created_at, including retries, queueing and website. Greater than 30 minutes is a failed release, never relabeled successful by restarting a clock. Native Linux x64/arm64 RPM file transaction must pass the actual checker; local fixtures alone do not prove it. Website UI is inspected manually; no UI automated tests.

Read: AGENTS.md, RELEASE.md, docs/packaging.md; existing September RPM/release and CI consolidation records; build.yml, package-overlay.yml, deploy-opencorvus-com.yml, build-overlays.yml entry points; release dispatcher, release identity/mutation topology, website manifest generator, RPM checker/test and exact installed Tauri 2.11.4 upstream bundle.rs. Whole-repository search covered dispatch inputs/events, checker callers, timeout declarations, workflow contracts and release mutation authorities.

## Observed facts and causes

- Original faulty rpm crate 0.16.0 short-write hashing is already repaired on main; real native bundling dropped from 22.5/42.7 minutes to 18.62/15.95 seconds. The subsequent verifier fails after payload digest, real isolated install and system file verification pass.
- Tauri bundle.rs patches the first exact `__TAURI_BUNDLE_TYPE_VAR_UNK` occurrence to `__TAURI_BUNDLE_TYPE_VAR_RPM` for RPM and restores the compile binary afterward. The checker compares the installed binary with the restored file, not the immutable compile snapshot under this exact transformation. Its old rpmbuild fixture has no marker, so it misses the product contract.
- build.yml defaults deploy_website=false and sends repository_dispatch without awaiting its result. Tag/local-command paths do not deploy the website. Thus native success is not combined release success.
- Linux format timeout is 90 minutes. No whole-run 30-minute deadline exists. Per-stage timeouts alone cannot satisfy the requested bound.
- The website publication counter belongs to its own workflow run_number; a reusable-workflow conversion would inherit the caller's counter and can regress the signed publication version. Production environment permits main only. Keep the existing website workflow as the deployment owner and explicitly dispatch it on main with an immutable release source input, then wait on the exact returned run ID.
- Fresh checks: cancelled release run 35572763467 owns private zero-asset draft392761162, source/tag186a7241973dd4ffcb0435ed8b250a1ce30f5aec. It is not publicly released. No other current release was inferred from the tag-by-name endpoint (which returned404 for this draft); direct ID and ref checks establish the facts.
- No product Task/Mission/Session scheduling or persistence change is in scope. The audit concerns all CI release ingress paths, retries, native reusable rows, website delegation, deadlines and final outcome.

## Design and plan

1. Replace the RPM comparator with the exact first-marker transformation of the immutable compiled input. Preserve system payload/install verification; retire the ambiguous restored-binary input. Add real marker-bearing rpmbuild coverage plus positive/error transformation contracts. Prove the contract against retained actual x64 RPM/input and fresh hosted native x64/arm64 checks.
2. Add one release orchestration/deadline module. GitHub API version2026-03-10 workflow_dispatch returns workflow_run_id and URLs, enabling exact child identity without listing/name inference. Remove the obsolete repository_dispatch path and optional website switch; every native publication (including an already-current updater retry) dispatches the existing main-only website owner and waits for its exact conclusion. Keep website run_number signing authority unchanged.
3. Use original run created_at for a shared 30-minute budget. Parent and delegated website use the same release run ID. Before publication/deployment check the budget; a dedicated deadline watcher observes an explicit terminal result job, cancels its own run on expiry, and does not reset time on rerun. Add terminal result jobs so incomplete matrices or failed/skipped mandatory publication cannot yield a green release. Remove the 90-minute format allowance. Preserve independent successful artifacts inside the same exact run.
4. Strengthen the existing website public probe to compare the deployed download manifest with the built candidate, while retaining signed catalog binding and rollback. Keep the current daily/bootstrap entry paths. Test live orchestration logic with a local API server and workflow contracts; these are contract tests, not hosted release acceptance.
5. Run focused tests, workflow validation, docs, and independent read-only review; address findings and push with normal hooks. Preserve/reconcile only the previously owned private zero-asset failed release reservation before the authorized fresh 0.1.10 release. Observe actual native+website completion and report the measured complete-run result. If the 30-minute limit fails, retain that failed attempt and fix its measured cause rather than claiming a later isolated step meets the limit.

## External authoritative references

- [GitHub workflow dispatch API](https://docs.github.com/en/rest/actions/workflows#create-a-workflow-dispatch-event): 2026-03-10 response provides the dispatched run ID.
- [Reusable workflow context](https://docs.github.com/en/actions/reference/workflows-and-actions/reusing-workflow-configurations#github-context): github context is associated with the caller.
- [Workflow run API](https://docs.github.com/en/rest/actions/workflow-runs): created_at, exact run status, jobs and cancellation endpoints.

The user's explicit 30-minute whole-release red line overrides the benchmark skill's default preference for activity-only timeouts; both progress diagnostics and the absolute release budget remain explicit.

## Initial implementation evidence

- Retained real x64 RPM from run35572114548 was independently extracted with Windows libarchive. All five contained file digests and compressed/raw CPIO digests verify. The installed 216,814,960-byte executable equals the exact transformed immutable input: expected/actual SHA-256 `384cab62e652358db74b1fc70fc83a892d2762752420b6335b8921634389c8e0`, marker offset205212045. Original compile digest is `a85e5f37b5b875ed78be661cd550a36744420ddef2b0e3bd8ecefe4589f96b75`. This is actual retained-product identity evidence, not a new Linux installation claim.
- Two marker/error Python contracts pass. Initial 53 focused lifecycle/workflow/identity/dispatcher/asset checks and two website manifest checks pass; targeted strict TypeScript checks pass after making the existing 404 identity branch's narrowing explicit without changing its error semantics.
- Official actionlint1.7.12 reports only three pre-existing unsupported `concurrency.queue` keys. GitHub's current documented `queue: max` contract and earlier successful production runs establish those keys; keep their queued-publication semantics. The validator limitation is retained explicitly rather than deleting the production queue policy.

## Pre-publication review

Independent read-only review by review_continuation accepted the full implementation and evidence with no actionable findings. It confirmed shared original deadlines, exact child run receipts, independent website signing authority, first-marker RPM identity, and preserved rollback. It explicitly leaves fresh hosted native checks, API dispatch, public deployment and measured timing for actual acceptance. GitHub cancellation latency is not an instantaneous physical stop guarantee.

Focused acceptance: 57 tests / 350 assertions across release automation, workflow contracts, release dispatcher, release identity, asset contracts and website manifest pass; targeted strict TypeScript and both Python marker contracts pass. Version alignment (0.1.10), release mutation topology and architecture index pass. Generator and normal push-hook checks are pending completion below.

Generator completed successfully with zero generated-file differences. Repository typecheck and docs:check (342 operations / 25 groups) pass. The full clean-worktree generated-artifact check is run after the scoped commit; normal pre-push checks remain enabled.
