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
