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
- Constraints: no application version changes, release/tag creation, public deployment,
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
| TD-01 | Native build matrix precedes actual draft publication admission; publication inventory is fetched twice per page. Same-run retry is implemented, but admission failures waste all native build work. | Delivered as `7c19c4240debc86f5ecd3947dda85d01fb8fd295`; normal push hook passed and fetched HEAD/upstream were 0/0. |
| TD-02 | Latest two-worker Light consultation takes 106,974 ms, 20 Provider requests and 11 capability searches for two file reads and short synthesis. 209,119 reported tokens include 92,416 cache-read tokens. | Shared known-ref instruction delivered in Cut 2; Cut 3 package-authored refs pass focused validation. Authorized real run stopped at production Provider probe: HTTP 401 token_revoked, before Task creation. Performance improvement remains unverified; valid Provider login is required. |
| TD-03 | Mission close uses mutable module callback bindings from Session and Task bootstrap. | Retain the verified existing composition boundary. All production caller/binder paths audited; live/dead-owner and retention route tests pass. Module mutability is retained maintainability risk, not a reproduced defect warranting another refactor. |
| TD-04 | Migration-heavy repairs were followed by removal of historical migrations and exact current-schema/reset admission. | Historical strategy rework confirmed; current explicit reset contract verified, including untouched stale database/WAL bytes. Obsolete permission-ledger migration promise corrected in Cut 2. Changing upgrade compatibility remains a product decision, not an inferred repair. |
| TD-05 | Website cwd/root dependency workarounds were replaced by the actual bundler source-export condition. | Closed as already repaired by `ed92a5f37`; current source-only compilation, real Node execution and shared runtime reuse passed 3/3. |
| TD-06 | Cross-process Prompt ownership, wait/automation identity, Mission closure and deletion are safety-critical and were repeatedly revised. | Retain audited current owners: immediate transaction/CAS, exact occurrence, finite per-Project queue, indexed Fire frontier and terminal ownership. Current focused matrix passes; no new correctness defect demonstrated in this scope. This is not a proof about every possible schedule or an unbounded full-repository audit. |
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

Cut 1 first-validation checkpoint (historical): the existing publication
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

## Cut 2: truthful exact-reveal instructions and audit dispositions

### Recall and root-cause analysis

The same user goal and exclusions apply. Cut 1 is delivered, not awaiting review.
The current saved Light evidence is bound to `481596ffa`, package
`2026.09.04.3`, and `openai/gpt-5.6-luna`. Its observations show each worker
searching for the method Skill, revealing that Skill, searching for `read`,
then revealing `read`: four searches per worker. The scheduler made three more.
The actual reducer already accepts exact refs directly against the frozen
Catalog/Harness; it does not require a prior search result. In contrast,
`CAPABILITY_SEARCH_DESCRIPTION` says to copy refs from results, and Light's
authored instructions name the method local ref without its complete identity.
The first is a shared instruction defect; the second requires immutable package
content revision and real-model acceptance, not an unmeasured speedup claim.

Selected first repair: describe direct known-ref reveal and grouping of the
currently needed leaves, retaining discovery for unknown refs and every existing
authorization/reconstruction check. Exercise one direct Skill+read reveal in
the existing four-worker production dispatch test, then reconstruct and execute
the real loader and file reader. Provider decisions remain stubbed in that test;
it establishes an executable contract, not consultation latency. Generic search,
receipt replay and Provider-normalized payload-budget tests remain in scope.
No runtime routing, eager activation, new grant, persistence or version change.
The requested package revision/one bounded real-model rerun is a separate user
choice; until answered this cut does not change Light package bytes or call a
real Provider.

### Additional source audit

- TD-03: both module callbacks have exactly one production binder, in Session
  loop and Task API. Direct Mission routes import SessionWake -> SessionPrompt
  -> SessionLoop. The production server imports Project bootstrap -> Task API.
  The only recovery close caller is host recovery; its executable Project owner
  imports and awaits the same bootstrap. Process recovery also imports
  SessionLoop. Close persists one occurrence, takes/revalidates its lifecycle
  lease, propagates caller/deadline cancellation, and commits closed only after
  exact closure/lease, absent durable Prompt owner, settled wakes and child Task
  checks in one immediate transaction. Retain the existing composition boundary;
  no missing-binding bug has been demonstrated. Module mutability is a future
  maintainability risk, not a reason for another state owner or broad refactor.
- TD-04: `storage/db.ts` probes existing schema read-only before writable open,
  rechecks its complete shape before configuration, and requires explicit reset
  on drift. `02-data.md` and `task-control-plane.md` explicitly select this
  pre-release contract. No automatic data deletion or upgrade compatibility is
  added. One current document is wrong: `security-permission.md` still promises
  startup conversion of the old cascading permission ledger. Replace that
  obsolete promise with the current reset boundary; retain current ledger
  ownership and retention semantics. Historical migration engineering was
  discarded work, not a justification to reintroduce it now.
- TD-05: source-only package compilation and real Node execution passed 3/3,
  12 assertions in `test/package-tool-files-capability.test.ts` on current source.
  The bundler's existing `source` condition is the correct owner. No dependency
  install, website cwd workaround or root dependency is needed. An initial
  invocation used a nonexistent test path, exited with no matches, and is not
  counted as evidence; the exact file above was subsequently run successfully.
- TD-06: current recovery/readiness explicitly distinguishes global listener
  readiness from concurrent Project recovery; per-Project Mission queues are
  bounded. This audit retains the production Task/Session/Mission occurrence
  owners and rechecks schema/retention/live-owner/dead-owner tests rather than
  deriving safety from a zero-cycle graph. Further conclusions await their
  actual terminal results and focused source review.

Independent delivery review returned FINAL PASS (P0-P3 zero) on the complete
five-path tree `0b9f05322b1bea67e2e8bca62c0ccfe4baa937b0`. It independently
passed the Light/package-budget pair (7/7, 215 assertions) and verified the
authority, default-input, bootstrap/schema and evidence boundaries. This final
record-only update adds that result; commit/push follows after its read-only
check. The three unrelated working paths remain out. TD-02 real efficiency is
still open and is not covered by this delivery verdict.

### Cut 2 first-validation evidence

- Four changed/related capability files: 9/9 tests, 229 assertions. The first run
  exposed a test-harness input mismatch: direct invocation bypassed Provider
  schema default materialization, but its manual completion passed the original
  object without `limit`/`deactivate_refs`. Supplying those existing defaults in
  the test's exact input restored canonical equality. Production validation and
  immutable completion checks were not relaxed. The complete four-file rerun,
  not that failing intermediate run, supplies the result above.
- Schema contract + Mission durable activity + real cross-process reconciliation:
  25/25, 116 assertions. This includes stale WAL byte preservation, strict
  current-schema transfer, fresh archive, delete retention/replay, exact operator
  request join, close takeover and settling a live streamed peer Prompt.
- Task wait OS-process race + all Session Prompt cross-process owner cases:
  6/6, 44 assertions. The real wait Tool survives lost owner, expiry and exact
  wake takeover while the sibling Project proceeds; live/queued/standby/dead
  Prompt owner paths retain their canonical request/terminal identities.
- Five selected Automation tests: 5/5, 26 assertions (22 unrelated cases filtered).
  Fixed set-query page, indexed 64-row due selection against 96 due definitions,
  257 future definitions and retained history, distinct manual/scheduled identity,
  target retry and multi-Project partial retry all pass. Source confirms due
  discovery reads the physical Fire frontier, then only that page's definitions
  and current summaries; claim revalidates revision/Fire/lease atomically after
  capacity admission. Full history remains an explicit history API concern.
- Root typecheck: 8/8 tasks, seven cache hits; only the changed OpenCorvus task
  rechecked. Documentation 339/25; architecture index 16 current documents.
  No installation, native helper rebuild, user process interruption, Provider
  invocation, app/Squad version change or schema mutation was performed.
- Updating the permanent search description changes its normalized definition
  digest. Existing occurrence-drift/reconstruction rules remain authoritative;
  this cut does not hot-rebind an already-frozen input or introduce compatibility.

## Cut 3: authorized Light known-ref guidance and one measured consultation

### Recall and selected repair

The user explicitly confirmed the previously requested exception: update only
Light's immutable content revision and run one bounded `openai/gpt-5.6-luna`
two-worker consultation. Application version remains `0.0.61-beta`; no release,
UI automation, other-owner changes, data reset or additional model suite.
Cut 2 is delivered as `152001585cd44f733333cb4f21a98cb7168388ed` with a normal
push and fetched 0/0. The old awaiting-authorization statements describe that
cut's historical boundary; this confirmation now permits the work below.

Root cause is the observed discovery/reveal split recorded under TD-02. The
package must provide complete locator identities, not assume the model can infer
their source/owner from a local name. Add exact Skill and read refs to each
worker's authored prompt. A worker with an assigned repository file reveals
both in one call, loads the method and reads its assigned evidence; other tasks
reveal only the method and discover whichever source capability is actually
needed. Give the scheduler exact dispatch/report-read/completion refs; reveal
dispatch for the current frontier and group reader/completion at closure.
No eagerly projected leaf, runtime decision gate, new owner or persistence.

The manifest remains the capability authority. Prompt refs are validated
locators, not grants. Existing install/projection and four-worker execution
tests will parse the authored refs and prove they match the frozen executable
catalog, survive receipt replay and reach real Skill/file reads. Generate the
Light revision and embedded payload through the existing generators, verify
that only Light changes, and retain the current loader-name/source-grounding
and one-frontier/one-batch-final-read contracts. Independent feedback before
this implementation: none; Cut 2's read-only reviewer established that direct
reveal already preserves authority. A fresh delivery review follows validation.

### Bounded measurement and reuse

Reuse the external v3 runner and its verified dependency-link mechanism in a
new source-tree archive; benchmark code/results remain outside Git. Historical
source/result archives are immutable. Cache input review found only workspace
release-version fields changed since the reusable archive: dependency ranges,
resolved lock packages and SDK source are unchanged. Verify this structurally
before linking dependencies; bind workspace imports to the candidate archive,
not the dirty checkout. Reuse a source-fingerprinted native helper. Never install
or rebuild merely because workspace version labels changed.

Run only the original `parallel_short_synthesis` request and evidence files.
Keep its 180-second/400,000-total/180,000-orchestrator acceptance ceilings for
comparability, but require direct known-ref activation, actual file grounding,
one two-member dispatch with physical Provider overlap, one batch report read,
correct exact synthesis, and the existing error/interaction/population checks.
Add an external harness physical-call ceiling of 20 and a 180-second model
execution deadline; reject further requests at exhaustion and let the owned
runtime settle/clean up. Inspect results even if the old loose ceilings pass:
report request/search counts, elapsed time and role/cache-separated tokens
against the saved 20-request/11-search/106,974-ms result. One observation can
verify the path and measured improvement, not a statistical latency guarantee.

The isolated OAuth shape/expiry and exact Luna catalog have been separately
checked without printing credential values; the production Provider probe must
also pass before the one Task. Preserve failed evidence and do not automatically
consume another real-model case if this one fails. Any failure is audited and
repaired within scope, with another paid acceptance requiring a new decision.

The preserved runner's `ok` field is only its original automated contract, not
the Cut 3 verdict. After the single case, the main agent and independent reviewer
must inspect the saved raw transcript for direct known-ref activation, successful
reads of both assigned files and their returned values, one two-member dispatch,
one batch of exact terminal report IDs, physical cross-Session Provider overlap,
and the exact completion answer. Report each result explicitly. No second paid
case is implied by a failed manual criterion.

Before measurement: package/reveal/generated tests passed 19/19 (248 assertions),
package typecheck exited 0, docs passed 339/25, and the external observer/answer
contract tests passed 9/9 (30 assertions). Preparation reused 236 dependency links
with workspace imports bound to the candidate source; no install or native build.
The revision generator also detected pre-existing Dynamic revision-record drift;
its incidental Dynamic stamp was removed from this change. Only Light revision
`2026.09.05.1` and its generated payload are included. Dynamic's existing mismatch
is outside the specifically authorized revision change and is not called fixed.

### Actual execution and remaining boundary

At 2026-09-05 07:23 UTC, the single launch reached the production Provider test.
It returned HTTP 401 with `token_revoked` / invalidated OAuth token. The credential
shape and local expiry had passed, and both Provider and exact Luna model were
projected; those checks cannot establish remote token validity. Exactly one
physical connection-probe request failed before Task creation. No Task-model
request or worker was started, and no latency/token improvement is measured.
Do not label this a Light correctness failure or a successful consultation.

Evidence is preserved outside Git in
`D:/myhexin-local/.codex-benchmarks/light-consulting-a9fd55182-td02-20260905/`
(`preflight.json`, `suite.json`, `parallel_short_synthesis.json` and log).
Product source was frozen tree `a9fd55182255c7a442607341c2a606459523b5b6`,
archive SHA-256 `bfadca006d50521c0874529311bfe286f4799cff71e616d9ed91a53e1aad13ae`.
The final runner hash is
`61737519ff33d68320cbb0aab34c939e09cb7e175933e1d28fde5d7cca4c5666`;
its four explicit typecheck roots passed after parsing persisted members with
the existing production member schema. The independent startup review passed
with zero findings, independently running Light 4/4 (189 assertions) and external
contracts 9/9 (30 assertions). Final review must distinguish the verified package
change from the still-blocked real-model acceptance. No automatic retry, account
reset, new login flow or additional paid case was attempted.
