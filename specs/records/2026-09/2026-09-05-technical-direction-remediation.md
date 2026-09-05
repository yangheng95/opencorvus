# Technical direction audit and remediation

## Recall

- User request: as technical lead, deeply audit the last ten days of repairs,
  enter goal mode, and automatically iterate until all confirmed problems are
  repaired. This follows a technical review, not permission to add features or
  repeat the previous release campaign.
- Baseline: `4feef0369a6919bdb9ba758e847c6faecda0f056` on `v0.0.55beta`,
  initially equal to its tracked upstream. Three pre-existing working paths are
  excluded: `packages/opencorvus/src/session/index.ts` and the two Web content
  files `expert-squad-distribution.generated.ts` and `public-market-zh-01-35.ts`.
- Acceptance: every finding below receives current-source evidence and a
  disposition. Confirmed defects require root-cause repairs, positive focused
  production-path verification, and an uninvolved read-only delivery review.
  A graph metric or a test budget alone does not establish simplicity or
  product efficiency. Preserve proven cross-process execution, exact occurrence
  identity, atomic settlement, and explicit capability authority.
- Constraints: no version changes, release/tag creation, public deployment,
  user database reset, new compatibility promise, UI automation, new worktree,
  or other-owner edits. Reuse installed dependencies and native helpers; do not
  reinstall or rebuild without proving an actual input mismatch. Real Provider
  reruns must have an authorized model and bounded invocation plan. Historical
  passed trees are evidence at their own revision, not current guarantees.
- Read: repository AGENTS; current server readiness and capability-search
  architecture; current schema/Prompt owner/Task wait/closing effects; release
  workflow, publication implementation, tests and RELEASE.md; original razor
  audit and scheduling remediation ledger; 0.0.61 release evidence.
- Searches: all `bindMissionClosing*` consumers (Session loop and Task API
  bootstrap), all publication claim consumers (build workflow and script
  tests), schema drift/startup consumers, current Light prompts and the saved
  final short-consultation result. Historical memory is navigational only.
- Independent agent feedback before implementation: 无. The existing other
  scheduling task is idle. No implementation delegation is started; the
  mandatory independent delivery review follows first validation.

## Audit ledger

| ID | Observation and direction | Current disposition |
| --- | --- | --- |
| TD-01 | Native build matrix precedes actual draft publication admission; publication inventory is fetched twice per page. Same-run retry is implemented, but admission failures waste all native build work. | Cut 1 implementation verified and independently reviewed; commit/push pending. |
| TD-02 | Latest two-worker Light consultation takes 106,974 ms, 20 Provider requests and 11 capability searches for two file reads and short synthesis. 209,119 reported tokens include 92,416 cache-read tokens. | Confirmed cost; root-cause audit of discovery/activation, prompt/catalog payload and role boundaries remains open. Do not declare a regression from token totals alone or replace explicit activation with guessed routing. |
| TD-03 | Mission close uses mutable module callback bindings from Session and Task bootstrap. | Design risk, not yet a reproduced missing-binding defect. Audit all direct, startup, recovery and terminal callers before choosing explicit composition or retaining a justified bootstrap boundary. |
| TD-04 | Migration-heavy repairs were followed by removal of historical migrations and exact current-schema/reset admission. | Historical strategy rework confirmed. Audit current upgrade consequences and explicit prior decisions; do not restore removed migration machinery or change the data retention contract by assumption. |
| TD-05 | Website cwd/root dependency workarounds were replaced by the actual bundler source-export condition. | Historical wrong repairs already removed by `ed92a5f37`; inspect source-only regression coverage, not another implementation. |
| TD-06 | Cross-process Prompt ownership, wait/automation identity, Mission closure and deletion are safety-critical and were repeatedly revised. | Re-audit shared production entry points, transaction/lease boundaries, finite recovery, indexed discovery and terminal ownership. Existing positive runtime evidence is retained; no wholesale rollback. |
| TD-07 | `specs/README.md` still describes 0.0.61 as unpublished although the final release record says published. | Pointer corrected in Cut 1; historical artifacts unchanged. |

## Cut 1: early publication admission using the existing owner

### Root cause and impact

`build.yml` prepare probes the tag but never executes the draft owner path.
Only `publish-release-assets`, after both native matrices, claims the tag and
draft. Runs 59 and 60 therefore completed native outputs before a publication
failure. Separately, `readPublicationOwner` executes a headers-only GET followed
by another GET for the same inventory page. This doubles discovery traffic and
checks status and data from separate responses. The problem affects initial
manual/tag release runs and repeated draft admission, not application scheduling
or user data. It cannot be repaired by changing runtime code or adding packages.

### Selected implementation

1. Move the existing exact tag claim and draft claim into prepare, after version,
   source and frozen dependency validation. Both native jobs already depend on
   prepare. Keep the early read-only tag probe for fast source conflict errors.
2. The upload job verifies the same tag and draft owner again immediately before
   upload. Public settlement remains after complete artifacts. No new writer,
   registry, publication mode, fallback endpoint or version rule is introduced.
3. Inventory uses one ordinary `gh api` request per bounded page. The CLI error
   exit and parsed array come from the same request; keep canonical uniqueness,
   owner/source, prerelease and draft checks and bounded post-create rereads.
4. Update the existing workflow contract and publication tests to assert early
   admission, exact request sequences, cross-page duplicate rejection, typed
   malformed/API errors, same-run resume and public settlement. Exercise the
   production publication reducer with the scripted API boundary; this is not
   a real GitHub publication acceptance claim.
5. Update RELEASE.md and the stale specs pointer. Preserve current versions and
   every unrelated working file. First validation uses existing Bun and cache.

### Tradeoffs and boundaries

An authorized future release run now reserves its exact tag and empty draft
before native compilation. A subsequent build failure leaves that reservation
for the same workflow run to resume; a new run cannot adopt another run's draft.
This is the existing owner contract applied earlier, not automatic publication.
Late network failures still require retry; early admission cannot guarantee
future service availability. Local verification does not dispatch a workflow or
consume real publication authority.

### Verification and delivery

- `bun test ./script/verify-release-identity.test.ts ./script/github-actions-workflow-contract.test.ts`
- Related release mutation checker tests, version check and documentation check.
- Positive exact CLI-entry coverage where feasible without credentials, plus
  independent read-only review of the complete scoped diff and evidence.
- Stage only this cut, calculate the reviewed tree, commit, fetch/merge upstream,
  inspect the complete outgoing set and push through the normal hook.

GitHub documents draft visibility through the release inventory and a maximum
page size of 100. GitHub CLI `api` returns the JSON body by default; `--silent`
suppresses it and `--include` adds response headers. Sources checked 2026-09-05:
[release API](https://docs.github.com/en/rest/releases/releases#list-releases),
[CLI API command](https://cli.github.com/manual/gh_api).

## Progress

Cut 1 implementation is ready for independent review. The existing publication
and workflow contracts pass 34/34 tests with 135 assertions. The seven release
mutation topology tests pass with eight assertions against the pre-stage index;
the candidate's exact-tree checker is still required after staging.
Documentation passes at 339 operations/25 groups, version alignment stays at
0.0.61-beta, and working diff check is clean. An initial command named a
nonexistent `check-release-mutation-topology.test.ts`; Bun ran the two existing
files only. The corrected `release-mutation-topology.test.ts` was then run
explicitly; its seven tests are counted separately. No install, native build,
Provider request or release action was run.
Other ledger rows remain open unless explicitly disposed with evidence above.

The uninvolved reviewer audited the complete eight-path cut and independently
passed all three focused files (41 tests, 143 assertions). Its only finding was
P3: body-only `gh api` reports `(HTTP 503)` in stderr, but the old status parser
and new fixture used an `HTTP/2.0 503` header line. The one status parser now
handles both actual CLI output forms and the fixture uses real stderr syntax.
The reviewer reproduced the failure and correction using real `gh` against an
in-memory localhost 503 endpoint with placeholder credentials, then returned
FINAL PASS with P0-P3 zero. Main verification repeated the same localhost CLI
boundary and the full 41-test/143-assertion set. This validates real CLI error
handling, not a live GitHub release. Exact-tree mutation topology retains five
writers; no additional release authority or runtime production edit is present.
