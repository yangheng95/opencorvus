# Light consultation runtime remediation

## Recall

| Item | Record |
| --- | --- |
| User requirement | Continue repairing every issue before release. Real consultation acceptance must cover one-member advice, multiple Planner/Investigator investigations, one minimal clarification, and a short synthesis after parallel work. Collect end-to-end latency and tokens by role, prove correctness, no duplicate dispatch, no operator correction, no greedy scheduler Skill load, and state budgets and failure boundaries. Benchmark code must not be merged. |
| Acceptance | The exact shipped Light package gives the scheduler only its consultation control surface, expresses every independent ready set as one canonical `dispatch_agents` collection, keeps the package Skill on workers rather than eagerly loading it in the scheduler, and completes the four real Luna cases within their recorded latency/token budgets with correct answers, overlapping Provider windows for parallel cases, zero rejected dispatches, zero operator corrections, and zero duplicate workers. |
| Hard constraints | Preserve streaming Provider calls, visible Messages, canonical `dispatch_agent` member execution, immutable Task/package binding, read-only Light workers, explicit operator questions, and the existing collection occurrence/recovery protocol. Add no Host workflow gate, fallback Tool surface, hidden Message, benchmark code, UI automation, or package-specific parallel runtime. Public release versions remain at most three numeric components; immutable Expert Squad revisions retain their current required `YYYY.MM.DD.N` ABI. |
| Sources read | `AGENTS.md`; `specs/current/architecture/01-agents.md`, `04-extensions.md`, and `15-agent-facts-and-turns.md`; the Light and Dynamic package manifests/prompts/Skills; tool-pool, PromptProfileResolver, Session loop/runtime-contract, `dispatch_agents` Tool/contract/recovery, Light package tests, generated payload closure, and the real acceptance evidence described below. |
| Whole-repository search | There are 121 built-in scheduler projections. Dynamic is the only scheduler currently declaring `inherit_base_tools: false`; Light currently inherits the whole scheduler base. PromptProfileResolver nevertheless adds the scheduler Task Artifact Tool set and interactive publication to a non-inheriting scheduler, while Session loop hard-requires those Tools independently of the exact package projection. Dynamic intentionally uses that evidence surface and must list it explicitly when the inheritance contract is corrected. Projected workers retain their existing universal Task Artifact transport in this cut. Only packages that explicitly project `dispatch_agents` receive its collection prompt/runtime; Light currently projects only `dispatch_agent`. The feedback-revision Tool/schema, Evolution Lab candidate-author prompt, Generate Expert Squads authoring Skill, and its portable generated Skill all repeat the same obsolete claim that every scheduler receives the Artifact surface regardless of its manifest, so the model-facing authoring chain is part of the single-source repair. |
| Independent agent feedback | The real-provider acceptance task supplied the frozen evidence bundle and classified the clarification runner exception separately from product behavior. No independent implementation review has occurred yet; a fresh uninvolved read-only review is required after the implementation and focused verification freeze. |

## Frozen real-provider evidence

The source evidence is
`C:\Users\hengu\.codex\benchmarks\light-consulting-34ab15e9-20260830\consulting-acceptance-evidence.json`
(11,722 bytes, parsed successfully). It binds repository/origin commit
`34ab15e9539ffdc5948fc89262ab750a1587d681`, `builtin/light`
`2026.08.29.1`, package digest
`eb951545ac26bccfc48e150326f61e3d8ab8493a76192bc9577e0a6df371408c`,
and the verified actual request model `openai/gpt-5.6-luna`. Credential and model
catalog presence were checked separately; no credential content is part of this
record.

| Case | Result | Duration | Tokens | Dispatch evidence |
| --- | --- | ---: | ---: | --- |
| one-member advice | fail | 121,063 ms | scheduler 313,471; Planner 98,181; Task 411,652 | Correct answer and one worker, but two scheduler Skill calls plus Artifact snapshot/read/select before dispatch; latency and both token budgets exceeded. |
| two Investigators + two Planners | fail | 299,606 ms | scheduler 776,148; workers 321,307; Task 1,097,455 | Correct answer and four unique workers, but four different assistant Turns and non-overlapping Provider windows; two scheduler Skill calls and repeated Artifact pre-read. |
| minimal clarification | product pass | 177,945 ms | scheduler 136,770; Planner 135,869; Task 272,639 | One visible question, one external endpoint reply, one Planner, zero scheduler Skill calls, correct answer. The runner counted only locally submitted replies and raised a harness-accounting exception after the real product flow settled. |
| two-Investigator short synthesis | fail | 145,922 ms | scheduler 396,496; workers 122,420; Task 518,916 | Correct answer and two unique workers, but two assistant Turns, non-overlapping Provider windows, and one rejected call caused by an unrecognized top-level `reason` before model self-repair. |

All four answers were correct. Operator correction count and actual duplicate
worker count were zero. The aggregate product result is nevertheless `NOT PASS`:
only one of four product paths met the complete acceptance contract, and neither
parallel case was physically parallel.

## Root analysis

### Observable behavior and direct triggers

The Light scheduler receives roughly twenty Tools and about 115k tokens of Tool
schema on a context-cold request. `inherit_base_tools: true` expands to the full
Orchestrator scheduler pool. PromptProfileResolver then adds Task Artifact
discovery/snapshot and interactive publication even when a projection does not
inherit its base. Because `artifact_snapshot` is present, prompt composition adds
an instruction to snapshot/read/select current-project files before dispatch.
The Light scheduler prompt separately says to load `light/shared/method`, and its
manifest grants that Skill to the scheduler. Those inputs directly explain the
observed scheduler Skill and Artifact calls and repeat their non-compressible Tool
schema cost at every Provider step.

Light also lacks the canonical collection Tool. Its prompt asks the model to emit
multiple separate `dispatch_agent` calls in one assistant response. The Host can
run those calls concurrently, and the legacy test proves only that four manually
constructed direct Tool promises can overlap. The real model instead emitted one
call per assistant Turn in both parallel cases. The current positive test
therefore bypasses the exact model-visible surface whose behavior it claims to
accept.

The rejected short-synthesis call is adjacent evidence of the same oversized and
ambiguous surface. The core already defines one nested target-discriminated
dispatch input and says `reason` belongs only inside adapters that expose it. The
model nevertheless invented a top-level field. The schema rejected it correctly;
adding an alias or compatibility reader would create a second contract and is not
the repair.

### Control/data-flow root and why the old path did not solve it

Scheduler Tool ownership is split between the package projection and two
platform-side implicit expansions. A scheduler manifest with
`inherit_base_tools: false` still does not describe its actual Tool surface
because PromptProfileResolver silently adds scheduler Artifact Tools, and
Session loop treats that hidden addition as universally required. The scheduler
projection is therefore not the single source of truth for either capability or
Provider schema budget. Worker Artifact transport is a separate current
architecture contract and is not changed by this cut.

Parallelism is similarly split between a prompt convention and the canonical
runtime. `dispatch_agents` already persists one visible collection occurrence,
aligns its declared team and exact member requests, checkpoints each member, runs
canonical `dispatch_agent` members through `Promise.all`, and resumes the same
outer occurrence after interruption. Light bypasses that primitive and relies on
the model to author multiple sibling Tool parts at once. More prompt prose cannot
make that assumption durable.

The Skill is installed and valid but scheduler activation is unnecessary. The
Light worker prompts and Skill carry the advisory method for the identities that
perform the work. Granting and commanding the scheduler to load the same Skill
duplicates static coordination guidance already present in its package prompt.

## Single-source design

1. **Exact scheduler Tool projection.** For a scheduler,
   `inherit_base_tools: false` means the resolved built-in Tool set is exactly the
   manifest's explicit list. Scheduler Task Artifact and interactive publication
   Tools are ordinary explicit/inherited capabilities, not an unconditional
   hidden tail. Session loop derives required scheduler Artifact Tool IDs from
   the resolved runtime contract instead of imposing the global catalog. Dynamic
   lists its intentionally retained Artifact surface explicitly, preserving its
   effective behavior. Projected-worker Artifact transport is unchanged.
2. **One Light frontier primitive.** Light projects `dispatch_agents` and removes
   direct `dispatch_agent` from the model-visible scheduler surface. A one-member
   consultation is a valid one-member collection; independent multi-member work
   is one aligned collection. Member execution, lineage, recovery, result and
   capacity remain the existing canonical implementation.
3. **Bounded scheduler surface.** Light explicitly projects only the Tools needed
   to read the Task/worker Messages, exchange an owning-Mission scheduler message,
   ask one visible question, record no-action or completion, and submit a
   collection. It receives no Artifact mutation, package evolution, shell,
   browser, Skill, or direct-dispatch Tool.
4. **Skill ownership.** Both Light workers retain the package Skill and load it
   for their bounded advisory/investigation work. The scheduler prompt contains
   its complete coordination contract and no longer loads or receives the Skill.
   Installation remains separate from activation.
5. **Current generated closure.** Bump the Light package revision through the
   required internal `YYYY.MM.DD.N` ABI. Because the same corrected projection
   contract is model-facing in Evolution Lab's candidate-author prompt and the
   Generate Expert Squads authoring Skill, bump both packages' immutable revisions
   as well. Regenerate the tracked OpenCorvus payload, revision ledger, and portable
   authoring template from their source packages, and do not touch the benchmark
   worktree or the excluded web generated-content paths. These internal immutable
   package revisions do not change the three-component public release boundary.

## Impact and exclusions

| Surface | Required result |
| --- | --- |
| Light manifest/prompt/Skill | Scheduler uses the collection Tool and exact bounded control surface; workers retain the one package Skill and read-only capabilities. |
| PromptProfileResolver | Resolved scheduler Tool IDs follow explicit inheritance semantics with no hidden unconditional Artifact tail; worker resolution is unchanged. |
| Feedback revision guidance | Model-facing revision instructions distinguish universal projected-worker Artifact transport from the scheduler's exact inherited and explicit Tool surface, so revisions do not recreate the removed hidden scheduler grant. |
| Session runtime | Required scheduler Artifact Tools are the subset actually present in the immutable projected contract; the existing universal worker Artifact requirement remains. Restart validation continues to compare the exact frozen projection. |
| Dynamic | Its non-inheriting scheduler lists the current Artifact surface explicitly and retains its current effective Tool set. Base and Advanced worker projections are outside this scheduler-only change. |
| Dynamic real-provider acceptance | Its generated-package preflight binds the current immutable revision and the exact explicit scheduler Tool list, so the existing real streaming E2E cannot accept a stale payload or reject the regenerated current payload before execution. |
| Dispatch runtime | No change to collection/member occurrence, admission, recovery, lineage, capacity or Provider streaming semantics. |
| Public Expert Squad payload | Regenerated from source; no hand edit and no web distribution regeneration in this cut. |
| Benchmark harness | Evidence input only. The harness accounting defect is not merged with production Light repair, and benchmark code remains outside the branch. |
| Mission/Wait ledger | No production overlap with the active Mission close/recovery owner or later Wait/Automation reducer work. |

## Positive verification

1. Resolve the current Light package and assert the exact scheduler Tool IDs,
   worker Tool IDs, worker Skill grants, scheduler prompt contract and exact
   internal package revision.
2. Replace the manual `Promise.all(dispatch_agent)` Light test path with one real
   persisted `dispatch_agents` Tool occurrence containing two Planner and two
   Investigator members. Prove four distinct Sessions and lineages start before
   release and settle through the one collection result.
3. Add a provider-schema budget contract that measures the exact resolved Light
   scheduler and worker Tool payloads and asserts bounded positive maxima tied to
   the shipped projection.
4. Run focused Light, collection occurrence/recovery, Dynamic projection and
   runtime-contract tests; validate the Dynamic real-provider preflight against
   the regenerated manifest; run OpenCorvus typecheck, payload sync, docs,
   architecture and exact module topology checks.
5. Freeze the complete candidate and obtain a fresh uninvolved read-only review.
   Repair every valid finding and repeat until P0-P3 are zero.
6. After the reviewed commit is on the branch, rerun the same four real Luna
   cases from that exact SHA. The final evidence must show four correct answers,
   every case within its recorded latency and token budgets, overlapping Provider
   windows for both parallel cases, one canonical collection per ready frontier,
   zero rejected dispatch attempts, zero scheduler Skill loads, zero operator
   corrections and zero duplicate workers. A harness-accounting exception may be
   recorded separately only if the persisted product interaction and endpoint
   reply prove the exact successful flow.

## First-green candidate evidence

The pre-merge Light candidate is based on local Mission commit
`a8d8617d819359e3b991c4dd54493bcd3b58e191`; the fetched upstream search-native
capability commits are intentionally not yet merged because six of their paths
overlap this still-uncommitted Light closure. The exact Light, Dynamic, Evolution
Lab, feedback-revision, generated-payload, revision-stamping, portable-template,
Squad SDK and projected terminal contracts pass 37/37 tests with 251 assertions
across ten files. OpenCorvus package typecheck exits successfully. A fresh render
of every built-in package matches the tracked generated payload, and the current
revision ledger binds Dynamic `2026.08.30.3`, Light `2026.08.30.1`, Evolution Lab
`2026.08.30.1` and Squad SDK `2026.08.30.1` to their current content digests.

This evidence is sufficient only to freeze and review the independent Light
commit. After that commit removes the six dirty-path merge hazards, the fetched
upstream must be merged without rebasing; the complete merged outgoing set must
be revalidated before push. Real Luna consultation acceptance remains a
post-push requirement bound to the exact pushed SHA.

## Post-merge outgoing evidence

The Light candidate received independent FINAL PASS with P0-P3 all zero and was
committed as `97092b9d36f14c6f7fade8d64014a8096aff636b`. It was then merged without
rebasing with fetched search-native parent
`139fff2f90240fbcb04ae32a3f22eb03f17ba399`; the resulting integration commit is
`183f112fe41b47b79af85258a0a0bd14db9d42bc`. The automatic merge retained both
the occurrence-bound capability catalog and Provider Tool-name ownership from
upstream and Light's exact seven-Tool scheduler contract, bounded worker Provider
Tool payloads and immutable projected Tool restart checks.

One current positive Market-detail test still named Evolution Lab's historical
`2026.08.19.1` internal revision. The merged runtime and package payload correctly
reported the shipped `2026.08.30.1` revision, so the stale expected value was
updated to the current immutable package contract; no production fallback or
version alias was added.

Because the shared worktree preserves three unrelated unstaged files, all
outgoing code validation ran from a materialized exact-index snapshot whose
tracked blobs match the merge candidate. Root typecheck passed all eight package
tasks. The ten-file Light/Dynamic/generated closure passed 37/37 tests and 257
assertions after providing the snapshot's Git index to the payload generator.
The search-native merge matrix established 113 passing tests in its combined run;
every environment-timeout or stale-baseline occurrence was then rerun in
isolation: SessionLoop Tool authority 8/8, the affected capability-catalog
occurrence, Market catalog index 14/14, Session execution occurrence 2/2 and
payload sync 2/2 all passed. Documentation, routes, architecture and package
topology passed at 338 operations/25 groups, 6 rules/34 files, 15 indexed current
documents and 10 packages. Control leases passed at 17 owners/19 sites,
control-state redundancy at 45 tables/7 allowed fact classes, release mutation
topology at five authorities, public package publication and public version
`0.0.58-beta` were aligned, and exact-index module topology passed at 1077
modules/5333 runtime edges/zero retained cycles/four clean imports.

This closes the deterministic post-merge gate only. Push hook evidence and a new
uninvolved post-merge read-only review are still required before the branch can be
pushed. The four real Luna consultation cases remain a post-push acceptance gate
and cannot be inferred from deterministic tests.

## Typed capability-reference integration plan

After the first post-merge review passed, fetched upstream advanced to
`ee6b5f5b0b0917da2f40455775f7da129cfb9ce9` with the Expert Squad manifest v2
typed capability-reference migration. The migration conflicts with this cut in
the package manifests, generated closure and resolver tests, and its current
materializer appends the platform `scheduler-transport` set to every scheduler.
That unconditional transport grant recreates the hidden Artifact Tool tail that
the real Light consultation evidence required this cut to remove. Selecting one
side of the textual conflicts would therefore either discard the typed authority
model or regress the accepted Light runtime contract.

The integration uses one typed grant source:

1. Worker Artifact and interactive-publication transport remains the existing
   platform-owned universal worker transport.
2. Scheduler transport is no longer appended by the materializer. A scheduler
   that needs it declares the typed platform `scheduler-transport` capability-set
   ref in its manifest projection. The materializer accepts only the exact
   scheduler base and scheduler transport platform sets for a scheduler; there is
   no fallback, exclusion list or hidden post-projection append.
3. Every migrated package whose prior effective scheduler contract included the
   transport receives the explicit typed set. Light declares neither base,
   scheduler transport nor scheduler Skill and retains exactly its seven current
   control/coordination Tools. Dynamic explicitly declares scheduler transport
   alongside its bounded control and package Skill refs.
4. Because manifest bytes and typed grant ownership change, the current revision
   stamping transaction must advance every affected immutable package identity
   and then regenerate the tracked payload, revision ledger, portable template,
   SDK/OpenAPI closure and all exact package expectations. Historical versions are
   not rewritten and no v1 compatibility projection is retained.
5. Positive tests must resolve the production typed grants and final Provider
   surfaces: Light stays at seven scheduler Tools with bounded Planner and
   Investigator payloads; representative transported schedulers resolve the
   explicit scheduler transport; every worker retains universal transport;
   generated payload/revisions match a fresh render. The full typed-capability
   suite, Light/Dynamic/Squad SDK closure, typecheck and architecture/topology
   checkers must pass before a new frozen-tree independent review.

## Typed capability-reference candidate evidence

The second-upstream integration was materialized as one prospective merge result
over local parent `114ad71d7be17f3afce33f9ef9669b8294f40c75` and upstream
parent `ee6b5f5b0b0917da2f40455775f7da129cfb9ce9`; it has not been represented as
a single-parent squash. The implementation-only index tree before this
evidence-record update was
`505c41d3f97b097fc2525d4fb043007b3934dc36`. All validation ran from an
isolated checkout of that exact index rather than from the shared worktree, so
the three excluded working paths were neither loaded nor staged.

The first 55-file OpenCorvus candidate run found 122 stale positive package
revision expectations after the required immutable revision transaction; the
runtime install, projection and parallel-flow cases around them continued to
pass. The expectations were synchronized to the generated revision ledger, not
to guessed global increments: Advanced is `2026.08.30.3`, Base and the migrated
transported packages are at their generated `2026.08.30.2` revisions, while
Light remains `2026.08.30.1`, Dynamic `2026.08.30.3` and Squad SDK
`2026.08.30.4`. The affected 24-file rerun then passed 154/154 tests with 2,599
assertions, and the complete 55-file matrix passed 303/303 with 4,656
assertions. The SDK suite passed 190/190 with 1,002 assertions.

Root typecheck passed all eight package tasks from the exact candidate. Routes,
documentation, architecture index and package topology passed at 6 rules/34
files, 338 operations/25 groups, 15 current documents and 10 packages. Control
lease and state checks passed at 17 owners/19 acquire sites and 45 tables/7
allowed fact classes. Release mutation topology retained five authorities;
public package publication order and the three-component public version
`0.0.58-beta` passed. Built-in topology covered 121 manifests and 133 workflows.
Exact candidate module topology passed at 1,078 modules, 5,335 runtime edges,
zero retained strongly connected components and four clean imports.

A fresh revision render reported 121 packages and zero new stamps. Fresh
portable-template, generated payload and SDK/OpenAPI transactions left the
isolated checkout byte-clean. The public-package checker initially could not
resolve the SDK package's already-installed private `@hey-api/openapi-ts`
dependency because the isolated checkout had mounted only top-level package
dependency directories; mounting the SDK's existing package-local dependency
directory repaired the validation environment, and the unchanged checker then
passed. No product source or dependency version changed for that toolchain
repair.

This is not delivery evidence yet. A fresh uninvolved agent must review the new
frozen index, complete diff, tests, generated closure and this record with no
unresolved P0-P3 findings. The reviewed result must then be committed with both
parents above, revalidated against any newer upstream, passed through the full
push hook, and pushed before the real four-case Luna acceptance can begin.

## 2026-09-04 current-source real acceptance — Recall and plan

The user requires every reported issue to be closed before release, including
the original four real Light consultation cases and budgets, with benchmark code
kept outside the delivery branch. On September 4 the user approved the next
public release identity `0.0.59-beta`; existing 56/57/58 tags must remain intact.
The typed-ref/Light implementation above has since been delivered. Current HEAD
is `dbc867f10637a3af894e03a02101168984744a4e`; its parent
`7a2fc56f8473462fb870b8116bac8d843296c2e5` has identical runtime source and a
verified cached isolated archive. The four real cases still have only their
pre-correction `34ab15e9` results, so the prior candidate wording is historical,
not proof that the current release acceptance has passed.

Current-source analysis: `builtin/light` is manifest v2/revision `2026.08.30.1`
with seven explicit scheduler Tools, including `dispatch_agents`. The canonical
collection returns typed per-member outcomes and immutable outer progress;
there are no separate visible child `dispatch_agent` Tool Parts to count.
`POST /task` now returns accepted identity and requests background reconciliation,
so a question does not intentionally block the create response. Interactions
are projected as pending/answered with an exact durable response. Provider
capacity is acquired inside the SDK fetch boundary, after the broader Provider
activity request, so activity intervals alone cannot prove physical overlap.
Provider usage events carry exact Session/Agent ownership and are the accounting
source; counting transcript snapshots alone can miss repeated Provider steps.

The old external runner was read in full. It still asserts the v1 manifest,
counts removed child Tool Parts, and compares an early interaction snapshot with
a local replied-ID set; it also aborts before writing useful aggregate evidence
on budget/trajectory failures. Reusing it unchanged would test an obsolete
contract. The repair is external-only, not a second production mechanism:

1. Preserve all four original scenario requests, expected facts, workers, model
   `openai/gpt-5.6-luna`, and latency/Task/scheduler token budgets. Reuse the
   exact-source archive and installed dependency/native caches; no dependency
   install, build, formal runtime mutation or UI automation.
2. Verify the generated current manifest and installed package digest. Read the
   one real collection input/result using current schemas, then bind every
   accepted Session to immutable lineage and WorkerTurnDescriptor, canonical
   final reply and exact completion evidence. Check the entire Task transcript
   for failed Tools, repeated frontiers, duplicate workers and operator steering.
3. Answer the one expected clarification through the real interaction endpoint;
   reread its durable answered response and use that for accounting. Keep this
   separate from the unchanged operator question and worker ordering criteria.
4. Observe real streaming HTTP calls after production capacity admission using
   ambient Session identity, without logging headers, credentials or body text.
   Preserve streaming/backpressure/cancellation. Report physical intervals and
   maximum concurrency; every parallel-case worker must overlap a peer. Bind
   requested model and complete Provider outcomes independently of this observer.
5. Use canonical Provider usage rows for role totals (including cache-read),
   retain timing and all observations even on a failed criterion, and wait for
   Task/assistant/Provider settlement before success or cleanup. Cases settle
   independently; do not repeat completed cases just because another case fails.
6. Verify the external runner's types and focused production package contracts,
   then obtain an uninvolved read-only review before real calls. Run the cases
   with timed progress checks; any product failure triggers the repository's
   shared-mechanism audit before a production fix and its required review/push.

Relevant current definitions/callers inspected: Light manifest and scheduler
prompt; dispatch-agents Tool/contracts; Task create/reconciliation and interaction
routes/reducers; Session context and Provider SDK capacity/fetch wrapper;
Provider activity/usage schemas; existing Dynamic checker/contracts and complete
old Light runner. No independent feedback on this new runner cut yet. No public
API, schema, package revision or production implementation change is proposed
unless the real evidence demonstrates a current defect.

Initial current package verification passed manifest/install projection (2 cases)
but the four-worker dispatch case stopped while mapping an absent `outcome` to
`receipt.kind`. Its unchecked cast hides the collection's typed member failure.
Before classifying production versus stale test setup, strengthen that test to
assert the exact completed member/accepted outcome contract, exposing the actual
typed failure. No production change is justified by the TypeError alone.

The typed results identify a stale fixture: its manually persisted Orchestrator
assistant has no `activationID`, so all four lineage commits correctly reject
the missing exact Task-root creator occurrence. The shared lineage fixture
intentionally does not rewrite an already-present Tool request. Keep that guard
and bind this test's assistant to the real acquired creation-ingress activation,
using the existing Task-root lease primitive as other current cross-process
fixtures do. This is a test setup correction, not a Light scheduling workaround.

The complete current Light package file now passes 3/3 tests and 49 assertions,
including the four-member real sibling-Session dispatch. No production source
was changed. Current search-native discovery necessarily permits the existing
platform `capability_search` before dispatch (and `question` only in the one
clarification case); this does not authorize scheduler Skill/artifact pre-reads
or change any original request, worker count, duration or token budget.

The external observer's positive contracts passed 4/4 with 13 assertions:
exact streamed bytes/model/Session ownership, backpressure, propagated reader
cancellation, upstream failure classification, and measured overlap/concurrency.
This is harness verification only, not real Provider or Light acceptance. The
runner uses persisted interaction resolution time for ordering and requires
assistant plus Provider-outcome settlement before ending the case. Its code and
temporary fixture projects remain outside the delivery branch.

An explicit test-file typecheck (tests are excluded by the package's normal
configuration) exposed four stale Light fixture contracts: removed `taskIngress`
and package-import `replace` fields, an unnormalised capability-search Tool in
the schema budget estimate, and an unchecked release callback. Correct these to
current activation identity, current import input, the actual AI Tool schema,
and an explicit initialized callback. The imported lineage fixture also typed
assistant-only fields as the common union storage projection; retain its exact
persisted data and use the actual Assistant type before storage. These are
test-only corrections; do not change production Message storage or admission.

Independent review of the initial two-file candidate found no main-repository
issue and two external harness findings: evidence I/O could bypass cleanup, and
accepted receipts alone could omit extra persisted workers. The external runner
now executes every cleanup step despite evidence failure and compares the full
Task-owned Session/lineage population with accepted identities. Six external
positive tests (18 assertions) pass; real calls remain pending fresh review.

Fresh independent read-only review returned FINAL PASS, P0-P3=0, on staged tree
`8c0881685847cba847864d814b64e63a894112a8` and the frozen external runner closure.
The reviewer independently reran Light 3/3 (49 assertions) and external observer/
contracts 6/6 (18 assertions). The main agent additionally verified dispatch
recovery 1/1 (4 assertions), explicit current test-file TypeScript 0 diagnostics,
external four-root TypeScript 0 diagnostics, docs 339/25, and diff checks. This
closes acceptance preparation, not the four real cases. Production source and
package revision remain unchanged; existing Mission real acceptance is retained.

### Current four-case evidence and next correction Recall

The preparation commit `740514cf60df71e0f2ce99c9cb881aa239802666` was normally
pushed after the complete hook (root typecheck 8/8, seven cache hits; routes
6/34, docs 339/25, lease 18/22, architecture 16, package topology 10, release
authorities 5, exact module topology 1103/5537/four clean imports, secret scan
zero). Fetch verified zero ahead/behind. No dependency installation or native
compilation occurred. Runtime source remains the exact archived `7a2fc56f8`.

All four original real Luna cases ran once, serially, to natural completion
between 15:27 and 15:37 UTC on September 4. Full evidence, immutable runner
hashes, credential/catalog preflight, per-case logs and diagnostic summary are
outside Git at
`D:\myhexin-local\.codex-benchmarks\light-consulting-7a2fc56f8-20260904-current`.
The raw runner reports NOT PASS. Do not rerun these completed slots or relabel
them PASS. Canonical usage includes cache-read and, where present, a separately
reported Memory helper row.

| Case | Settled duration | Task tokens | Orchestrator tokens | Physical worker maximum concurrency |
| --- | ---: | ---: | ---: | ---: |
| Single advice | 114,046 ms | 186,936 | 107,658 | 1 |
| Four-member investigation | 227,922 ms | 849,577 | 564,509 | 4 |
| Minimal clarification | 86,009 ms | 148,927 | 139,424 | 1 |
| Two-investigator synthesis | 130,077 ms | 318,333 | 170,343 | 2 |

Each parallel worker physically overlapped a peer, every scenario has one
successful collection with the expected 1/4/1/2 accepted and observed worker
Sessions, and scheduler Skill calls/operator steering are zero. These concrete
improvements retain the prior implementation evidence, but do not erase the
following failures. Four-member Task and Orchestrator token budgets fail; all
other time/token budgets pass. Runtime cleanup reported no failure and removed
both temporary credential/catalog files from every retained evidence root.

1. Single, four-member and two-investigator cases contain failed production
   Skill calls. The exact current catalog distinguishes capability local ref
   `light/shared/method` from behavior/Skill name `light-advisory-method`.
   Completed search receipts correctly activate the former but publish a loader
   declaring no available Skills. `SessionLoop.resolveTools()` incorrectly maps
   active refs and a fresh reveal candidate with `.requested_ref.local_ref`;
   `SkillMount.resolve()` filters against `grant.skill.name`. Thus even the
   correct `light-advisory-method` input fails. This is shared reference/name
   conversion, not a missing install or a Light-only permission failure.
   Conversation/Work and native Mission share these maps; existing default-Skill
   tests use identical local ref/name and cannot expose it. Reconstructed
   occurrences fold the same refs and retain the defect. Another boundary is
   the cached loader path during selection of an additional Skill: a currently
   materialized loader must not suppress exact new Skill materialization.
2. The four-member scheduler first supplied null `acceptance_gap_id` and
   `criterion_ids` beside each `dispatch`. The emitted frozen schema declares
   these only inside a continuation Turn; production correctly rejected the
   wrong nesting. Its next collection succeeded. Do not weaken that validator
   or silently discard unknown fields. Audit collection schema/guidance and the
   ten `read_agent_message` calls before proposing a narrow prompt/schema fix
   for the measured cost; the source of all overhead is not yet established.
3. Minimal clarification has one durable answered question (`regulated`), one
   completed planner, no Tool failure, and the exact requested facts in the
   visible completed delivery Message `msg_htvpTwkvQOuNGb7GWufE`. Its closure
   summary paraphrases those facts, so the old runner's summary-only string
   assertion is a false answer failure. Preserve the original expected facts,
   but bind answer verification to the current authoritative visible delivery
   and its completion evidence, not an internal summary's spelling. This
   correction requires separate positive tests/review; it is not permission to
   waive the three production Skill failures or the four-member cost failure.

Next implementation scope, after this analysis: resolve exact Skill behavior
names from the already frozen occurrence descriptor, reuse the existing exact
descriptor lookup, and use that one mapping in initial activation and receipt
reconstruction for production and Mission Skill families. No new alias lookup,
live catalog fallback, grant, shadow activation table, migration writer, model
special case or change to Skill frontmatter identity. Preserve permission,
platform, required-Tool and Task/Project ownership checks. Exercise the real
Light worker SessionLoop search/reveal/load path with differing ref/name and
reconstruction, plus native Skill-family coverage and explicit unknown-ref
errors. Keep valid immutable receipts authoritative and test stale/corrupt
binding behavior rather than rewriting historical receipts. Public loader
input remains exact Skill `name`; package prompts must distinguish catalog ref
from that returned executable name. Only measured, independently reviewed
corrections will justify a new exact-source real acceptance run.

Read/search scope: current extensions Skill contract, search-native runtime
contract, frozen descriptor/behavior and reveal-owner, SessionLoop materializer
and finalizer, SkillMount, Conversation capability, Mission Skill runtime,
Light prompts/frontmatter, full current collection schema/execution, Provider
schema/input normalization, original and current raw evidence. No new independent
implementation feedback yet; the previous review covered the preparation cut.
UI, public routes, formal credential/database stores and the three preserved
working paths are outside this correction. Release `0.0.59-beta` and website
publication remain pending real acceptance, not cancelled.

### Exact Skill behavior correction

The deterministic Light worker test reproduced the real empty-compatible-Skill
failure before the runtime change. The correction reuses the occurrence's exact
descriptor lookup for both Skill families and both fresh/reconstructed active
sets, and rematerializes a selected Skill even when its loader already exists.
No grant, frontmatter identity, receipt, migration or runtime ownership changed.

Current focused evidence: Light plus native Work Skill expansion/reconstruction
4/4 (69 assertions); reveal owner/receipt/catalog/Processor matrix 31/31
(91 assertions), including real cross-process reveal settlement; affected native
Mission Skill/state/current-occurrence matrix 3/3 (14 assertions). Direct Tool
test calls settle their actual returned output through the existing Processor
completion primitive before another reveal, preserving the active-Tool fence.
The new Mission test exposed two existing test-only TypeScript annotations:
snapshot files omitted their actual `bytes` property and a partial stream stub
needed an explicit `unknown` boundary. Their fixture types now describe the
existing runtime output; their affected positive tests pass. Package typecheck
and docs 339/25 pass. The explicit four-test-root typecheck reports zero
diagnostics. Fresh independent read-only review of tree
`6e5023ef6a692d1029b8fc1ffda4d8f733a9c75c` returned FINAL PASS, P0-P3=0;
the reviewer independently passed 10/10 tests, 91 assertions. Only this evidence
paragraph was updated after review. The real case failures, prompt
ref/name ambiguity, four-member cost correction, and external answer-checker
correction remain open; this runtime cut alone is not release acceptance.
