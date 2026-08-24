# AutomationBench adversarial acceptance and capability repair

## Recall

| Item | Requirement or evidence |
| --- | --- |
| User request | Treat Tester as an adversarial collaborator rather than a consumer of Planner output and repair tool allocation. Use exact model `openai/gpt-5.6-luna`, launch through a real Mission, and hold the Base Expert Squad. The latest correction expands the deterministic public test set from the completed unique cases 1–50 through unique case 600; it does not repeat the first 50 cases. Every direct-Task, Advanced, Sol/Terra and accidental repetition-2 attempt remains excluded. |
| Benchmark definition | AutomationBench `1.0.6` contains exactly 600 unique public tasks. Preserve the frozen public 50-case manifest as cases 1–50, append the other 550 unique tasks deterministically as cases 51–600, use exact model `openai/gpt-5.6-luna`, real `POST /mission/wake` intake, immutable held Base Squad, repetition 1, and one fresh simulated world per case. Run at most ten distinct Base Mission cases concurrently and never repeat a verified case index. |
| Input and output | Input is the unchanged official business request plus the benchmark-only uncapped multi-Agent harness notice delivered through a real Mission wake. Output is the official final simulated world score, immutable run evidence, Mission transcript, exact 0..N child-Task transcript set, Task-bound AgentTrace, Mission and Task Provider usage, relational Mission/Task/Session/scheduler-delivery snapshot, and a ten-second-refresh external HTML dashboard. Mission Sessions are not bound to a Task trace directory; their calls remain independently evidenced by the exact Provider ledger and snapshot. |
| Environment | WSL2 root-owned evaluator, Provider data, control and evidence roots; the Agent sees only its unique-UID project and Unix-socket AutomationBench client. Exact OpenAI credential/model and Exa MCP probes must pass before the first formal run. Secrets remain outside Git, logs, specs and evidence. |
| Timeout | 600 seconds without real Task/message/tool/trace/world activity. There is no wall-clock limit while observable work continues. |
| Previous result | The sealed direct-Task rounds are historical debug evidence only. The first 25 Base direct-Task runs at commit `c36c46c2` scored Strict `3/25 = 12.00%`; a later adversarial Luna direct-Task round reached Base batch 7; the Terra Advanced direct-Task batch launched five cases before the user identified the wrong intake boundary. Those five Terra attempts are explicitly `invalid_bug: wrong_launch_mode_direct_task`. The first Luna Mission adapter batch also remains invalid debug evidence: all five attempts failed because the runner called the Task-only `/session/:id/trace` route for a Mission Session. The repaired r2 root removes that call, retains Mission usage through ledger/snapshot evidence, and never adopts any of these attempts. |
| Independent analysis | Claude Code independently read all 25 valid result/assertion/transcript/trace/database/usage bundles. The strongest discriminator was source coverage: 13 runs omitted at least one required authority and averaged 16.81% Partial, while 12 source-complete runs averaged 71.99% and contained all three Strict passes. Seven runs exhausted discovery and performed zero mutation. Tester false positives were evidenced in cases 4, 6, 15 and 21; case 3 was a self-reported failure despite 100% official score. No infrastructure fault contaminated the 25 accepted scores. |
| Mission Base r2 result | The first valid Mission/Base batch at commit `6dfa0f840f08ddcfd4c9fcfa4f49278371bd36ca` sealed five eligible runs: Strict `1/5 = 20.00%`, mean Partial `52.67%`. Independent verifier output was `attempts=5, eligible=5`; official rubric replay, exact-set manifests, Mission/Task lineage, quiescence, Provider ledger, profile/isolation audits and Skill runtime adherence all matched. Preserve r2 as a valid pre-repair baseline; prompt or harness-performance repair does not retroactively invalidate or authorize rerunning its slots under the same experiment revision. |
| Mission Base r2 cross-review | A fresh Claude Opus forensic review independently re-read every r2 request, assertion, Mission/Task transcript, raw API event, final world, Artifact, trace, Provider row, relational snapshot and manifest, then reran the official scorer. It found that 30 of the 32 failed positive assertions in cases 1–4 corresponded to required mutations that were never attempted. Case 2 rewrote explicit `message(s)` as `message or record`; case 3 read `Stuck_Trial_Action = Create Salesforce task for follow-up` but made zero Salesforce calls; case 4 read `Target Mailbox`, discovered HelpScout update/note contracts, made zero HelpScout mutations, and Tester called the unchanged records a PASS. Case 5 is the control: two Tester FAIL verdicts drove four continuation repairs and reached Strict 1. |
| Hard constraints | Fix prompts, capability projection and the real data flow; do not add a Host workflow gate, hidden assertion injection, case-name branch, fallback, unlimited synonymous search or scorer-aware behavior. The benchmark Skill remains answer-free. Preserve unrelated dirty `squad-sdk` work. Product fixes are committed separately and merged to the current `0.0.52-beta` release source (`v0.0.51beta` until publication, then maintenance branch `v0.0.52beta`); benchmark-only adapter/spec changes remain on `codex/automation-workbuddy-benchmark`. |
| Sources read | `AGENTS.md`; `benchmark-debug-template/SKILL.md`; `skills/automationbench-experiment/SKILL.md`; `2026-08-20-external-agent-benchmark-pilot.md`; current Expert Squad and Skill architecture; Base/Advanced manifests, READMEs and prompt overlays; `SkillMount`, `PromptProfileResolver`, runtime-template and session-runtime contracts; benchmark runner/contract/tests; the sealed Claude Code report. |
| Whole-repository search | The earlier scheduler/source-investigator Skill projection defects are already repaired and covered by real `SkillMount.resolve()` probes. The r2 review exposed the remaining current path: Base Planner was Skill-mountable but lacked `bash`, so it could not use the project-local client to read current authority before planning; Tester described a two-pass review but kept pass one private, so no durable fact prevented later anchoring; `artifact_publish` provenance requires current-physical-Turn `artifact_read`/`artifact_select` refs rather than a publication return or model memory; and Mission's generated Task prose could coexist with the unchanged original block while weakening an assigned effect. Current repair uses those existing facts rather than another Host state machine. |
| Independent delivery review | An uninvolved read-only reviewer found and rechecked the acceptance/tool-surface gaps, then audited the final Luna Mission adapter. The Mission review caught premature inactive scoring, the wrong scheduler drain primitive, Provider-error and unanswered-wake fail-open paths, missing 0..N Task lineage, composite-board incident loss, transcript/interaction/token evidence incompleteness, and a mixed framework/benchmark commit boundary. The repaired chain now waits on the shared physical scheduler-delivery settlement fact, requires the latest Mission wake to have a healthy reply, validates the durable completion receipt, reverse-enumerates the exact Mission-owned Task set, and reconciles independently rebuilt displayable transcripts, interactions, Provider ledger and relational snapshot. The r3 repair review additionally caught an unconditional business ledger in ordinary repository acceptance, missing current-Turn Artifact provenance, a Mission per-child/full-request partition contradiction, incomplete Advanced source refs, and missing real Base Planner Skill projection coverage. Each finding was fixed and re-reviewed. Final Base Planner `bash`/Skill and Artifact reference flows use real resolver/runtime tests; generated revisions contain only Base `2026.08.22.4` and Advanced `2026.08.22.6`; the benchmark mapping is uniquely `mission_intake_v3`. Focused tests, package/benchmark typecheck, docs check, topology and diff check pass; the final reviewer reported no unresolved P0/P1/P2. Product files are the only current `0.0.52-beta` release-source merge-back set (`v0.0.51beta` before publication, `v0.0.52beta` after); runner/contract/dashboard/experiment Skill/spec stay bench-only. |

## Problem and impact analysis

### Observable behavior

Low-scoring runs frequently spend millions of tokens finding endpoints, then narrate an authoritative action field instead of mapping it to an executable mutation and final readback. Tester often reproduces the implementation owner's chosen representation and publishes PASS even when whole side effects, exact values or current authority corrections are absent. In r2, cases 2–4 completed with zero mutations in at least one explicitly required service, while the successful case 5 used the same runner, model, Skill projection and scorer chain.

### Direct triggers

1. The finite authority ledger freezes endpoint-contract candidates, but a keyword-filtered or endpoint-only lookup can still be treated as record-store exhaustion. Case 1 closed guideline discovery without ever enumerating Gmail; case 3 never searched the Salesforce action named by the source field.
2. The same-effect language allows a source field to be re-expressed as another narrative or persisted representation without citing a target-interface contract that proves semantic equivalence. Case 2 treated a Wave memo as a requested message; case 4 treated a Slack finding as the requested routing mutation.
3. Base Planner is mounted with the experimental Skill but lacks the local-command surface needed to read the simulated current authority. It authors acceptance criteria before the action-bearing fields are visible, and no later durable criterion revision makes those discovered obligations independently testable.
4. Base Tester and Advanced Test Engineer already receive adversarial prose, but the pass-one inventory is not a distinct durable evidence step. In r2 cases 2–4, the final report copied the implementation's selected representation and called missing effects satisfied.
5. Mission preserves the original request block, but its generated Deliverables and Acceptance prose can still paraphrase a stricter effect into a weaker one. This occurred in r2 cases 2 and 4, while cases 1, 3 and 5 prove it is not universal.

### Data and control-flow root cause

The authoritative acceptance flow is described as two-pass but is not durably separated. Request/current-authority facts, planning claims, implementation claims and final-state observations still enter one Artifact stream, so the first implementation-shaped representation anchors the verifier. Base capability projection compounds this: Planner has the Skill but not the read-only executable surface required to derive source-grounded criteria. Mission can add a second, weaker semantic representation above the unchanged original block. The repair must make each transition explicit without adding a Host business gate: operator request to semantic-preserving Task contract; raw authority field to endpoint/record/effect/readback ledger; independent acceptance inventory to final-state comparison.

### Why the previous repair was insufficient

The previous prompts added Task-element inventories, finite candidate ledgers and action matrices, but retained plan-first reads and a canonical-plan vocabulary. They described independent verification without enforcing an independent evidence order in the model contract. The benchmark adapter correctly failed closed on unmountable required agents, so it avoided false evidence, but consequently omitted the scheduler and source investigator instead of giving those real owners the capability.

### Impact surface

- Product: Base Planner/Developer/Tester and Orchestrator prompts; Advanced Requirements/Architect/Source/Implementation/Test/Integrity prompts and workflow descriptions; Advanced source-investigator runtime projection; project Skill mount matrix and validation.
- Benchmark-only: AutomationBench Skill wording; exact required mount owners and projection audit; experiment Skill/spec; fresh evidence/dashboard/supervisor paths.
- Generated: Base/Advanced package versions and exact digests only. The unrelated `squad-sdk` source/generated hunk remains untouched.
- No UI implementation is changed; no UI automation test is added or run.

## Implementation contract

1. **Adversarial two-pass acceptance**
   - Base Tester and Advanced Test Engineer first derive and visibly publish a durable independent acceptance inventory from the original request and current raw authorities, before reading Planner/Architect or implementation claims.
   - They then treat every plan, Requirement, Architect spec, implementation report and prior verdict as a claim under test, perform request-to-final-state and final-state-to-authority traceability, and actively seek omitted effects, extra mutations, stale precedence, wrong identities and self-consistent-but-source-wrong calculations.
   - Advanced System Integrity independently challenges the Test inventory and evidence rather than accepting its aggregate verdict.
2. **Discovery semantics**
   - `api_search` is documented as endpoint-contract discovery, never business-data existence evidence; `api_fetch` is the data operation.
   - The finite authority ledger includes email/message/inbox/thread/channel/history carriers. A selected record store is exhausted only after one bounded list/read operation that is not narrowed by the missing business keyword; a filtered zero result proves only that filter. Candidate exhaustion ends discovery only. Authority-dependent unknown values remain unknown, while independent request-defined safe effects continue; no fabricated rule or unsafe mutation is allowed.
   - A request-supplied stable identifier is used directly with the discovered endpoint. Otherwise the owner performs one endpoint-contract discovery followed by one bounded identity/list fetch, not synonymous endpoint searches.
   - Every material authority field closes through one visible effect-ledger row: exact source field/value, required effect, target service/object/record, endpoint contract, intended mutation or notification, final readback, and status. A same-effect substitution is valid only when the cited authority or target-interface contract proves equivalence; narration or implementation convenience is not evidence.
3. **Capability ownership**
   - The projected scheduler becomes a first-class operator Skill-mount owner in the same canonical `SkillMount` matrix and real turn surface.
   - Advanced `source-investigator` becomes a Skill-mountable read/execution worker with an explicit read-only external/repository discovery contract. It may invoke the project client for reads but never mutate business or repository state.
   - The benchmark mounts the method on exact owners: Base Orchestrator/Planner/Developer/Tester; Advanced Orchestrator/Requirements/Architect/Source/Implementation/Test. Integrity consumes preserved evidence and does not receive an unnecessary executable client.
   - Base Planner receives the same local-command surface as the read-only Advanced source owner, but its prompt permits only read/list/get/search operations. It derives dynamic authority fields before freezing acceptance and never mutates business or repository state.
4. **Semantic-preserving Mission delegation**
   - The original operator request remains the sole semantic authority. Mission may add Task ownership, lineage, evidence and dependency context, but its generated Objective, Deliverables, Acceptance or Out-of-scope prose may not weaken, generalize, substitute or omit an explicit requested effect.
   - Exact effects, channels, values, formats and preservation constraints remain verbatim obligations in the child Task even when Mission groups them into one coherent closure.
5. **No Host behavioral gate**
   - Host changes only expose truthful capability/config projection and verify it. Task/tool choice, discovery, mutation and acceptance remain visible model behavior.

## Positive verification and acceptance

1. Focused tests load the real Base/Advanced packages and assert the positive adversarial two-pass contract and read-capable Advanced source owner.
2. A real `SkillMount.matrix()` project test mounts a project Skill on the exact scheduler, resolves the actual scheduler turn surface and observes that Skill enabled there.
3. A real Advanced source-investigator projection test mounts and resolves the project Skill and observes `skill` plus the local-command surface required by the benchmark client.
4. Benchmark contract tests require the expanded exact owner sets and reject missing physical owners.
5. Package revision/digest, generated-artifact, topology, focused benchmark tests, typecheck, docs check and diff check pass without staging unrelated dirty files.
6. An uninvolved read-only agent reports no unresolved P0/P1 findings; any finding is fixed and re-reviewed.
7. Product-only fixes are committed and merged/pushed to the current `0.0.52-beta` release source (`v0.0.51beta` before publication, `v0.0.52beta` after); benchmark-only changes are committed/pushed only on the benchmark branch.
8. A new empty Luna Mission Base r3 evidence root and external dashboard are created. Provider/model/Exa/Skill projection preflights pass, then the same deterministic cases 1–5 launch through `POST /mission/wake` with held Expert Squad `base`. r2 and every direct-Task candidate are never adopted.
9. Every sealed result proves Mission ID/session identity, exact held Base Squad, Mission-authored child Task lineage, all child Task profile bindings, Mission and Task transcript coverage, Task-bound trace coverage, Mission and Task usage coverage, stable Mission/Task quiescence, and Mission completion or truthful natural inactive terminal behavior before scoring.
10. Pilot evidence must show the positive behavioral contracts rather than hidden assertion injection: Case 2 sends amount-bearing Gmail messages; Case 3 sends the four on-track emails and creates three Salesforce Tasks; Case 4 mutates the seven HelpScout records and posts the required notification; Case 5 remains Strict 1. Case 1 must enumerate the reachable message store before declaring guideline authority exhausted.

## Restart identity

- Evidence: `/var/lib/opencorvus-benchmark/evidence-luna-mission-base-v20260822-r3`
- Control: `/var/lib/opencorvus-benchmark/control-luna-mission-base-v20260822-r3`
- Dashboard: `D:\myhexin-local\opencorvus-benchmark-results\luna-mission-base-v20260822-r3\index.html`
- Model: `openai/gpt-5.6-luna`
- Launch mode: Mission wake with immutable held Expert Squad `base`.
- Order: Base Mission batches 1–10.
- The experiment source commit is frozen only after all fixes, generated projections, focused checks, branch separation and independent review complete.

## r3 batch-2 SQLite cleanup incident

### Evidence and root cause

- The first case-8 attempt (`e9c67e68-1e2c-4a1a-bc26-527ac667c89c`) ended after an open Provider stream made no progress for 600 seconds. It remains an infrastructure-failure attempt and is not a score.
- The replacement attempt (`50d4113f-af59-487c-ba2c-a67c022a21f0`) reached natural Mission/Task terminal state, produced the official score, sealed its raw result, and then exited non-zero in cleanup. The batch receipt records `sqlite.close(true)` at `Database.close` throwing `database is locked`; the catalog therefore correctly records `invalid_bug / cleanup_failure`.
- The WSL runner was also using Bun `1.3.9` although the repository freezes `bun@1.3.14`. After installing the exact frozen version, a minimal completed `bun:sqlite` prepared statement still reproduces the same `close(true)` error. This proves the product defect is not repaired by the environment correction alone: on the supported Bun runtime, strict close rejects retained completed prepared statements after the server has already fenced and settled all logical database activity.
- `Server.stop` already closes runtime admission, cancels and joins process-owned execution, drains scheduler/protocol/dispatch work, disposes Instances, and acquires the database effect-settlement gate before returning. `Database.close` then uses the same strict physical-close operation as reset/rebuild. That conflates two contracts: graceful process shutdown after logical settlement versus destructive reset/rebuild that requires immediate physical handle finalization.

### Repair contract

1. Keep reset, reset-files, rebuild, initialization-failure and unavailable-database cleanup on strict SQLite close; those paths may reuse or delete the database in the same process and must surface retained statements.
2. Make `Database.close` the single graceful process-shutdown contract: after the existing lifecycle/effect guards pass, checkpoint the database, retire the Bun SQLite connection with graceful close, clear the owned client state, and allow already-completed retained prepared objects to be finalized by the runtime. Do not catch-and-fallback from strict close.
3. Add a focused positive storage test that retains and executes a real prepared statement, performs `Database.close`, and successfully reopens/queries the same database through the canonical client.
4. Add a benchmark preflight contract that compares `process.versions.bun` with the root `packageManager` Bun version before creating a formal batch, so runtime drift fails before any evidence slot launches.
5. Preserve both affected case-8 attempts as invalid evidence. After product/benchmark commits, merge-back to the current `0.0.52-beta` release source and independent read-only review, rerun only the missing case-8 slot; adopt sealed cases 6/7/9/10, complete batch 2, and then launch batch 3 (cases 11–15).

## r3 batch-3 delayed-wake timeout incident

### Evidence and shared root cause

- Batch 2 replacement completed at repaired source `ffb985fe`, sealed case 8, and adopted cases 6/7/9/10 without rerunning them. Batch 3 then sealed cases 11/12/14/15 but stopped on case 13 (`7216d10f-4ad4-4079-9c80-51c7b7e487fa`).
- Case 13 did not lose a Provider stream. At `2026-08-22T15:46:04.675Z`, the Mission completed a real `wait` Tool call with `duration_ms=1,200,000` and durable Automation `atm_g0VT2bA3900Y6jmbQ0Iz`, due at `2026-08-22T16:06:04.675Z`. The runner failed at `2026-08-22T15:56:07.635Z`: exactly one 600-second inactivity window after the wait was scheduled and about ten minutes before its promised wake.
- `waitForTerminal()` only resets or extends its deadline when `benchmarkActivitySignature()` changes. That signature hashes Messages, Tool state, Task progress, Artifact revisions, Task-bound trace and benchmark event count; it does not read the durable active delay definition or its `next_run`. A deliberately silent wait and a lost Provider stream therefore share the same timeout despite opposite physical meaning.
- The defect is shared across Mission session waits and Task waits. Mission calls `createDelayedSessionWake`; Task-bound Orchestrators call `createTaskWake`. Both use the same active one-shot Automation fact, retry projection, lease and tombstone lifecycle. The repair must read that single durable source rather than parsing Tool prose or adding a benchmark-specific business gate.

### Repair contract

1. Add one read-only Automation Service projection for active delayed wakes addressed to one exact Project and an exact set of Session IDs and Task IDs. It returns definition ID, Project/target identity, `nextRun`, lease boundary, the positive physical state `scheduled` or `leased`, and stable claim identity (`leaseID`, owner occurrence, activation time); it does not execute, consume or reinterpret the wait.
2. The Mission benchmark observation reads that projection for the Mission Session and all owned Task IDs. Its activity signature observes stable create/retry/new-claim/consume transitions without treating rolling lease-expiry renewal as progress. A create-only scheduled-wake observation ledger plus explicit non-prompt Automation definition/tombstone/run/receipt columns in the relational snapshot preserves the deadline and final durable facts under the ordinary exact-set evidence manifest.
3. When every active delayed wake is future and unleased, the earliest promised wake extends the inactivity boundary only through `nextRun + inactivity window`; it does not repeatedly add time from the current clock. Any due or leased wake prevents later future waits from extending the boundary until that earlier fact is claimed, consumed or retried. A leased/due execution, an open Provider stream without a future wake, or silence after the promised wake still receives the ordinary 600-second inactivity diagnosis.
4. Add positive product tests for exact session- and Task-target delayed-wake projection and consumption, plus benchmark contract tests proving a future wake extends to its absolute promise while a leased wake keeps the current boundary.
5. Preserve failed case 13 as `invalid_bug`. After product/benchmark separation, 0.52 merge-back and independent review, rerun only case 13, adopt sealed cases 11/12/14/15, complete batch 3, then continue batch 4.

## r3 batch-5 bounded-trace evidence incident

### Evidence and root cause

- Batch 5 sealed cases 22–25 as scored attempts but stopped on case 21 (`ffd84e09-3afe-4621-8390-db4025b0f474`). Case 21 ran for `4,294,095 ms`, reached a healthy inactive Mission with one naturally failed and physically quiescent child Task, and received the official diagnostic score Strict `0`, Partial `40.00%`. It was correctly excluded because its prompt-composition evidence did not reconcile with the Provider ledger.
- The sealed Task trace contains 98 `llm_request` events. The Provider ledger contains 280 Task-bound Session usage rows: Base Tester has 75 usage rows but only 24 request events, Base Developer 92 versus 27, Orchestrator 106 versus 47, and Base Planner has seven usage rows whose Session is absent from the trace. This is a collection truncation, not a Provider or model failure.
- The product Task trace API intentionally calls `AgentTrace.readTaskEvents()`, whose documented contract reads only the last `READ_TAIL_BYTES = 2 MiB` from the canonical Task `trace.jsonl`. The benchmark runner polled that bounded debug/UI projection and then incorrectly reused it as the complete paper evidence surface. A long multi-occurrence Task can therefore lose early request fingerprints while the independently persisted Provider ledger remains complete.
- The product API is behaving according to its bounded-tail contract. Expanding the ordinary API response would increase every polling read and UI/debug response without solving the evidence-consumer distinction. The bug is benchmark-only: a bounded live projection was treated as a complete sealed ledger.

### Repair contract

1. Keep live activity and quiescence polling on the existing bounded Task trace API. Do not reread an unbounded file every second.
2. After Mission, every child Task, scheduler delivery and detached ingress reach physical quiescence, read each child Task's canonical `trace.jsonl` once from the Host-visible `traceDir` returned by the trusted Task trace route. Require a stable file stat across the read, strict JSONL parsing, exact Task identity on every event, and canonical chronological ordering.
3. Use only that complete post-quiescence trace for prompt-composition reconciliation, trajectory generation, sealed `opencorvus-trace.json`, trace event counts and Session coverage. Preserve Mission usage separately in the Provider ledger as before.
4. Seal a deterministic complete-trace receipt containing the exact Task set, per-Task event counts and event digests. Catalog and final verifier independently rebuild that receipt from `opencorvus-trace.json` and require exact equality for repaired runs. The pre-repair r3 attempts did not contemporaneously seal the ambient AgentTrace event-bound environment, so they must not be described as independently proving complete trace capture. Preserve an earlier eligible score only when its exact run ID is listed in a paper-manifested post-hoc operator environment attestation for the default 512 KiB bound and the physical tail lower-bound audit also passes: every returned event is a finite product trace kind with payload, fits the bound, and the compact JSONL is smaller than `2 MiB - 512 KiB - 1`. The largest attested old valid projection is case 25 at 1,158,300 bytes, below the 1,572,863-byte bound; case 21 is 2,084,766 bytes and remains invalid. Final reporting must label these rows `legacy operator-attested trace environment`, not independent complete-trace evidence.
5. Add focused positive coverage for a canonical trace larger than 2 MiB whose early request event remains present in the complete reader, stable Task identity/digest reconstruction, zero-child Mission's exact empty Task trace receipt, and the real bounded-reader lower-bound legacy proof. Do not change the product trace API or merge this benchmark-only repair to `v0.0.52beta`.
6. Preserve case 21 as permanent `invalid_bug: bounded_task_trace_evidence`. After focused checks and independent read-only review, rerun only case 21, adopt sealed cases 22–25, complete batch 5, and resume batches 6–10.
7. The final uninvolved read-only review reported no remaining P0/P1/P2 after independently checking the complete-reader boundary, tail lower-bound arithmetic, exact attestation contract and run-ID set, per-row evidence grade, Case 21 invalidation, Case 22–25 reuse, and the 63-file paper manifest. Focused tests passed `54/54`; package plus benchmark typecheck, docs check, diff check, catalog regeneration and the development verifier all passed.

## r3 Provider-preflight response-header disclosure

### Evidence and root cause

- After the WSL-to-Windows proxy boundary was repaired, Case 21 preflight reached the exact OpenAI Luna Provider and returned HTTP 429 `usage_limit_reached`. The batch correctly created no Mission and retained the attempt as `blocked_preflight`.
- The child error's diagnostic object contained the Provider response-header map. `ProviderError.parseAPICallError()` redacted response bodies and credential-like text but copied `responseHeaders` verbatim; the exact Provider probe also constructed `APICallError` with that raw map. Bun's stderr rendering therefore exposed `set-cookie` and `x-codex-turn-state` values.
- `run-automationbench-batch.ts` copied the last 2,000 stderr characters verbatim into the create-only batch receipt. The per-run failure record kept only the safe typed message, but the derived batch receipt became secret-bearing paper evidence. Existing source-auth leaf checks cannot discover refreshed cookies or turn-state material that never existed in `auth.json`.
- This is a shared product diagnostic-redaction defect plus a benchmark defense-in-depth defect. The product must sanitize Provider header values at the error boundary; the batch must sanitize any child diagnostic before persistence because third-party errors can bypass the parsed Provider contract.

### Repair contract

1. Add one ProviderError header projection that preserves safe diagnostic names/values while replacing values for authorization, proxy authorization, cookie/set-cookie, token, API key, secret, credential, OAuth, code and state-bearing header names. Extend labelled-text redaction to the same header vocabulary.
2. Apply the projection before constructing product `APICallError` values and again when parsing arbitrary Provider errors. Do not remove safe rate-limit status, request IDs or reset timestamps.
3. Sanitize child stderr and coordinator error messages before truncating or persisting `stderr_tail`. Add focused positive tests that observe redacted cookie/turn-state fields and preserved safe diagnostics.
4. Treat the affected blocked-preflight batch receipt as secret-affected evidence. Rewrite it only through an explicit redaction chain recording prior/new SHA-256 and redacted labels without values; include that receipt in the paper manifest. It remains non-scored and never becomes reusable.
5. Commit the product Provider fix separately and merge/cherry-pick only that commit into `v0.0.52beta`; keep batch code, benchmark tests, Skill/spec and external evidence on the benchmark branch. Do not retry until the exact Luna Provider preflight is available; current Provider response states reset at `2026-08-27 11:31:35 +08:00`.

## r3 batch-9 reopened-Task liveness incident

### Evidence and root cause

- Batch 9 preserved scored runs for cases 43–45 but stopped on cases 41 and 42 after each had exactly 600 seconds without Message, Tool, trace, world, or Provider activity. Neither failure had a Provider error, pending Interaction, running Tool Part, process incident, or active delayed wake.
- Both child Tasks first became inactive through a successful `manage_task` force-majeure decision. Mission then used the canonical acceptance-resume path to open execution epoch 2 with a precise visible repair Message. Case 41 answered that repair authority only with `no_action`. Case 42 performed one focused repair continuation, then answered Mission's explicit finalize request and later blocker-preservation notification with `scheduler_message` plus `no_action`, without another lifecycle decision.
- At failure, all Planner, Developer, and Tester occurrences were terminal; every Tool Part was settled; the Orchestrator Session was idle; and each Task remained active with no durable source for another ingress. `no_action` correctly resolved each current ingress but intentionally creates no Task lifecycle fact or future wake. The prompt nevertheless allowed it as the sole decision for an execution-control ingress whose non-terminal occurrence had no remaining physical progress authority.
- This is a shared Base/Advanced Orchestrator prompt-liveness defect, not an AutomationBench scorer or Provider failure. Host inference or a lifecycle gate would duplicate model-owned workflow judgment and is forbidden. The repair must make the existing visible decision contract unambiguous.
- The failed-batch catch also wrote its create-only receipt after the last catalog refresh, leaving the external dashboard temporarily on an orphan-plan projection. The next formal coordinator refresh reads that receipt and can recover clean sealed siblings; no score or evidence is lost.

### Repair and acceptance contract

1. In the shared Orchestrator core, state that `no_action` never closes or suspends a non-terminal Task. It may be the sole decision only for conversation-only status/diagnosis or when exact durable evidence names another physical progress authority such as a running worker, active scheduled wait, pending Interaction, or already accepted successor ingress.
2. A Mission acceptance resume always opens a non-terminal repair occurrence. Its current ingress cannot be settled by `no_action` alone: the Orchestrator must dispatch the responsible existing lineage, or make an evidence-backed complete/fail lifecycle decision. A scheduler request to finalize requires the correlated reply and the same lifecycle closure when no future progress authority remains.
3. Add positive prompt/provenance tests for the general liveness invariant and exact Mission acceptance-resume instruction. Do not add a Host behavioral gate, scorer-aware branch, case-name condition, synthetic wake, fallback, or hidden assertion.
4. Preserve cases 41 and 42 as invalid infrastructure attempts. After product commit separation, merge-back to `v0.0.52beta`, focused checks, and independent read-only review, rerun only cases 41 and 42; reuse clean sealed cases 43–45, complete Batch 9, then run Batch 10.

## GPT-5.6 Sol Mission/Base comparison round

### Recall

- The user cancelled the proposed additional 250 Luna trials before any supervisor or case started. Do not create or resume those Luna repetition roots.
- Run the same frozen AutomationBench `1.0.6` public 50-case manifest once with exact model `openai/gpt-5.6-sol`, real Mission intake, and the held Base Expert Squad. Advanced remains out of scope.
- Use repetition 1 because model identity makes these 50 slots distinct from the completed Luna matrix. Preserve Luna r3 unchanged and do not adopt any Luna attempt.
- Sol evidence is `/var/lib/opencorvus-benchmark/evidence-sol-mission-base-v20260823-r1`; control is `/var/lib/opencorvus-benchmark/control-sol-mission-base-v20260823-r1`; dashboard is `D:\myhexin-local\opencorvus-benchmark-results\sol-mission-base-v20260823-r1\index.html`.
- Run deterministic Base batches 1 through 10 with the existing audited five-case coordinator. Every valid strict-zero result counts; only invalid/bug or missing slots may be rerun. Preserve complete attempt evidence and update the external dashboard after every settled trial.

### Acceptance

1. Before launch, verify the benchmark worktree is clean and the WSL runner's exact detached commit equals pushed `origin/codex/automation-workbuddy-benchmark`, the exact Sol model is projected by the isolated `auth.json` plus `models.json`, Exa configuration is present, and the proxy boundary is reachable without printing credential values.
2. Use a dedicated Sol/Base supervisor source. It must pass only `--model openai/gpt-5.6-sol --profiles base` and the Sol-specific evidence/control/dashboard roots.
3. An uninvolved read-only reviewer confirms there is no Luna, Terra, or Advanced launch path and no result-root collision.
4. Start batch 1 only after the benchmark-only supervisor commit is pushed and the WSL runner is updated to that exact commit. Confirm five distinct Base cases have live leases or preserved terminal evidence and the Sol dashboard updates.

## Sol case-5 action-log/readback convergence incident

### Recall

| Item | Requirement or evidence |
| --- | --- |
| User request | Terminate the abnormal `marketing.campaign_handoff` Task, repair the root cause, and retry only that missing Sol Mission/Base slot. |
| Observable behavior | Four batch-1 cases sealed normally. Case 5 remained active for more than 75 minutes while producing durable activity. It accumulated at least 85 Developer, 59 Tester, and 75 Orchestrator Provider calls, 14 dispatches, six distinct `base/test-report` Artifacts, and repeated exact Drive mutations/readbacks. |
| Direct trigger | The Developer exercised the declared Drive parent/update/copy/delete contracts. Tester required canonical GET/List state to reflect each nominally successful mutation, observed unchanged parents and still-readable deleted objects, and repeatedly classified the result as repairable until every alternative was exhausted. |
| Deep root cause | AutomationBench `1.0.6` Drive mutations are action-log operations. `google_drive_files_update()` records `move_file`; GET/List apply only rename and never project `addParents`. `google_drive_files_delete()` records `delete_file`; GET/List never remove those objects. The benchmark-specific Skill and Base acceptance loop treated this simulator as a read-after-write-consistent SaaS, making successful action evidence impossible to accept and causing repair-generated byproducts. |
| Amplifiers | The generic Orchestrator requires repair plus fresh Tester evidence until a blocker is irreducible. Continuations were correctly incremental, but still rechecked unaffected surfaces and published six test reports despite the one-canonical-report contract. Reusing the same physical Sessions grew average Developer-call tokens from 43,145 in the first ten calls to 207,842 in the last ten; Tester grew from 38,858 to 164,882. No call cap existed by design and is not the repair surface. |
| Termination evidence | Exact runner PID 437 and active lease run `6f747739-be98-459e-aede-3bd130bc83ff` were resolved read-only, then the runner received SIGTERM. Its active lease cleared and a create-only `failure.json` was preserved. This attempt is invalid bug evidence and is not a score. |
| Hard constraints | Do not expose assertions, scorer internals, case names, expected answers, or hidden world data to Agents. Do not add a Host gate, retry limit, call cap, fallback, endpoint hardcode, or model-specific branch. Preserve the official simulator and scorer. Repair the answer-free environment semantics in the projected AutomationBench Skill and the visible convergence instructions. |
| Sources read | AutomationBench experiment Skill; benchmark debug template; Base Planner/Developer/Tester/Orchestrator prompts and package contract; dispatch continuation Tool contract; current runtime Message/Part/Provider/Artifact/dispatch lineage; AutomationBench `1.0.6` public API schema and generic Drive implementation. |
| Whole-repository search | The continuation Tool already carries exact incremental guidance and evidence locators, so missing continuation transport is disproved. Base/Advanced both delegate environment method to projected Skills. The benchmark Skill already says one response-contract recheck followed by stop, but it does not state that official API-mode mutations may be scored action-log facts whose GET/List projections remain unchanged. |
| Independent agent feedback | Unavailable in this side conversation because sub-agent interaction is explicitly prohibited. This limitation must be reported; local focused tests, typecheck, docs check, exact diff review, and a fresh-world case-5 retry remain required. |

### Repair contract

1. In the answer-free `automationbench-api` Skill, define the official API-mode observation boundary: an exact discovered mutation request and its declared successful response are durable simulated-world action evidence. A GET/List endpoint may project seeded/query records without replaying every mutation action. One exact readback is still required when exposed, but unchanged readback after confirming method, path identity, params/body placement and response contract ends that representation; it never authorizes synonyms, replacement objects, repeated deletion, or cleanup intended only to force real-SaaS consistency.
2. Developer records the action receipt plus the single readback discrepancy and stops that effect row as `acted-on-with-nonprojecting-readback`; it must not manufacture a surrogate or retry the same successful mutation.
3. Tester evaluates the action receipt under the projected Skill's simulator contract, separately reports the non-projecting readback, and does not convert it into a repair obligation when the exact declared mutation contract succeeded. On continuation, recheck only affected failed/unresolved criteria and preserve immutable passed evidence without repeating unrelated authority reads.
4. Orchestrator treats this environment-defined evidence method as closure, not as a discoverable repair. It must not continue Developer merely to force GET/List to mirror an action-log mutation. No Host business gate is added.
5. Mark run `6f747739-be98-459e-aede-3bd130bc83ff` invalid for this prompt-contract bug. Keep its complete failure/trajectory/database evidence, exclude it from Sol aggregates, then rerun only case 5 from a fresh world after the benchmark-only commit is reviewed, pushed, and projected into the WSL runner.

### Positive acceptance

1. Focused prompt/Skill tests observe the generic action-receipt/non-projecting-readback contract, one-readback stop rule, no surrogate/retry language, affected-criteria-only continuation, and no case/scorer/assertion vocabulary.
2. Package benchmark typecheck, docs check, diff check, and the existing external-agent contract suite pass.
3. The replacement case 5 loads the repaired Skill on Base Planner, Developer, Tester, and Orchestrator; no exact successful mutation endpoint is repeated solely because GET/List did not project it.
4. The replacement seals a natural official score. Model-natural success or failure counts; only infrastructure/prompt bugs permit another rerun.

## Luna Mission/Advanced completion round

### Recall

| Item | Requirement or evidence |
| --- | --- |
| User request | Continue and finish every Luna AutomationBench case, with a watcher that checks every 30 minutes and repairs genuine blockers. |
| Starting state | Luna Mission/Base r3 is already complete: dashboard `luna-mission-base-v20260822-r3` reports `verified 50`, `pending 0`, with 59 indexed attempts. Preserve that matrix and never submit another Base case. No Luna Advanced evidence/control root exists and no Luna benchmark process is running. |
| Remaining benchmark | AutomationBench `1.0.6`, frozen public 50-case manifest, exact model `openai/gpt-5.6-luna`, real Mission intake, immutable held Advanced Expert Squad, repetition 1, five distinct cases per batch, batches 1–10. |
| New isolation boundary | Runner `run-luna-mission-advanced-50.sh`; evidence `/var/lib/opencorvus-benchmark/evidence-luna-mission-advanced-v20260824-r1`; control `/var/lib/opencorvus-benchmark/control-luna-mission-advanced-v20260824-r1`; dashboard `D:\myhexin-local\opencorvus-benchmark-results\luna-mission-advanced-v20260824-r1\index.html`. Base and Advanced never share a supervisor script, root, lock, receipt or dashboard. |
| Timeout and retry | The runner uses 600 seconds without real Message/Tool/Provider/trace/world activity, not a wall-clock cap. Natural model failure is an official score and is not rerun. Invalid/bug and missing slots retain complete evidence and may be rerun only after root-cause repair. Verified and reusable sealed candidates are never repeated. |
| Watcher | A current-thread heartbeat wakes every 30 minutes, reads this Recall and the latest incident section, performs read-only liveness/catalog/database/trace checks first, refreshes the dashboard, resumes only a missing batch, and fixes evidenced framework or benchmark blockers before retrying only missing slots. Healthy work is never restarted. |
| Branch boundary | Benchmark runner/spec/dashboard changes remain only on `codex/automation-workbuddy-benchmark`. Any shared product/framework fix is separately reviewed, committed and merged into current maintenance branch `v0.0.53beta`, then synchronized back to the benchmark branch. No release, tag, website or binary publication is authorized by this round. |

### Acceptance

1. The dedicated Advanced supervisor contains only Luna, Mission, `advanced`, repetition 1, the new Advanced roots and the existing audited five-case coordinator. It has no Base, Sol or Terra execution path.
2. Before launch, the bench worktree and WSL runner must be at the same pushed benchmark commit; isolated `auth.json` plus `models.json`, Exa environment, proxy reachability, exact Luna Provider preflight, Advanced Skill/profile projection and fresh-root isolation must pass without printing credential values.
3. Every batch reuses sealed eligible Advanced slots, runs only missing case indices, writes create-only plans/receipts and per-run evidence, and refreshes the external dashboard after settled trials.
4. The watcher distinguishes healthy activity, durable wait, Provider/Exa rate limit or authentication, no-activity timeout, and scheduler/terminal convergence defects using process, catalog, receipt, durable database and trace evidence. Page age or title alone is never a stuck signal.
5. Completion requires the existing Base `50/50` plus Advanced `verified 50/50`, final catalog/verifier success, no active leases/processes, complete evidence, and an independent read-only review of any implemented repair.

## Luna Advanced supervisor prelaunch identity incident

### Evidence and root cause

- No Advanced case was launched. Preflight found the WSL runner Git metadata temporarily unreadable from Linux while the supervisor's `test "$(git ...)"` expressions could still compare two empty substitutions and return success. The source-fence syntax was fail-open even though the runner repository later became readable again.
- The first independent review found that `batch_is_complete` trusted only `batch_index` plus completed/passed audit state. Catalog batches link their immutable plan but do not inline its model, launch mode or profile, so a foreign completed plan accidentally placed in the new root could suppress the real Advanced batch until final verification.
- The first positive script test read only the first occurrence of each flag. A later second coordinator invocation could therefore escape the intended exact single-invocation topology while the test remained green.
- WSL can reach the configured gateway proxy on `172.26.64.1:17892`; Windows loopback reachability is not the benchmark path. Provider/model/Exa configuration is root-private and must be checked inside WSL without printing values.

### Repair contract

1. Capture Git status, HEAD and pushed benchmark-branch HEAD in separate assignments under `set -e`; only then compare clean/exact values. Any Git command failure aborts before root creation or case launch.
2. New batch plans use schema v2 and record repetition 1. A completed catalog batch is reusable only when its referenced immutable plan also binds schema v2, the same batch index, exact Luna model, Mission launch mode, sole `advanced` profile, repetition 1 and five-case rolling schedule. Shared audit and final verification accept only numeric historical schema v1 with its original absent repetition field, or numeric schema v2 with numeric repetition 1; every missing, coerced, malformed or future schema maps to the explicit `batch_plan_schema` error.
3. The positive supervisor test parses the complete coordinator and final-verifier invocations, requires one of each, and compares their projected argument maps and root variables to the exact Advanced experiment contract.
4. Rerun shell syntax, focused benchmark tests, benchmark typecheck and independent review. Push the bench commit and update the WSL runner to that exact commit before any Provider preflight or formal case.

## Luna Mission/Base unique-case extension to 600

### Recall

| Item | Requirement or evidence |
| --- | --- |
| User correction | “续完600个case” means extend the test set to unique AutomationBench cases 1–600. Cases 1–50 are already complete and immutable; start at case 51. It never meant 50 cases × 12 repetitions. |
| Starting state | The original Base r3 root has 59 attempts and 50 eligible repetition-1 results for exact cases 1–50. The accidental repetition-2 cases 1–5 were stopped as soon as the correction arrived; their active leases are empty, their evidence is retained as `invalid_bug: wrong_test_set_repetition`, and they never count or authorize a rerun. |
| Dataset fact | AutomationBench `1.0.6` exposes exactly 600 public tasks: six domains × 100 tasks. The committed 50-case balanced selection is a subset. The extended manifest must byte-preserve the old 50 identities/order/indices, append every remaining unique identity exactly once as 51–600, and assign batches 1–120 in groups of five. |
| Runtime boundary | Same model/intake/profile and same external dashboard. The existing 50-case manifest remains the authority for old evidence; a committed 600-case extension manifest is the authority for new cases. Catalog and final verifier reconcile both manifest digests while using the 600-case identity/order as the aggregate matrix. New execution starts only at batch 11 (cases 51–55) and continues through batch 120. |
| Branding | The same dashboard must retain visibly different top/bottom OpenCorvus brand regions with repository wordmarks, `https://opencorvus.com`, author `yangheng95`, and `https://github.com/yangheng95/opencorvus`. |
| Independent agent feedback | An uninvolved read-only reviewer found and verified fixes for a same-root case-set artifact collision, a fail-open wrong-experiment batch exclusion, and a dual-manifest digest that was not partitioned at the case-50 boundary. The final chain uses separate immutable 50/600 manifest artifacts, exact case-index authority, and a five-run incident-shaped exclusion contract. After 58/58 focused tests, shell/diff checks and a real 64-attempt development verifier pass with 50 eligible, the reviewer reported no unresolved P0/P1/P2. |

### Problem and impact analysis

- **Observable error:** the first continuation launched case indices 1–5 with `repetition: 2`. This was a wrong experiment definition, not a model failure.
- **Direct trigger:** “600 cases” was interpreted as 50 × 12 repetitions despite the generator already exposing `--count` and the installed dataset containing 600 distinct public tasks.
- **Root cause:** the frozen manifest, coordinator, runner, catalog, verifier and dashboard hardcode 50 cases/10 batches. Increasing a shell loop cannot extend the dataset because old evidence is cryptographically bound to the original 50-case manifest.
- **Why a naive replacement fails:** replacing the manifest would invalidate the first 50 evidence digests and could reorder them. The extension must preserve the old manifest as a valid historical authority, add a second 600-case manifest, and reconcile each run against the manifest digest it actually sealed.
- **Impact surface:** benchmark-only manifest generator/artifact, runner/coordinator bounds, catalog/verifier dual-manifest evidence mapping, dashboard target/count display, dedicated Base continuation supervisor, focused non-UI contract tests and this spec. Product/framework code and release branches are excluded.

### Acceptance

1. Generated 600-case manifest contains 600 unique `(domain, task, example_id, task_contract_sha256)` identities, cases 1–50 exactly equal the committed old manifest, and cases 51–600 cover every remaining installed public task once.
2. Coordinator/runner accept a positive batch index only when the selected manifest contains exactly five cases for it. The continuation supervisor loops batches 11–120 only, passes repetition 1 and the 600-case manifest, reuses the same Base lock/root/dashboard, and has no Advanced/Sol/Terra/direct-Task path.
3. Catalog/verifier accept old results only against the old 50-manifest digest and new results only against the 600-manifest digest, while final coverage is exact case indices 1–600 at repetition 1 with completed receipts for batches 1–120.
4. Dry catalog/verifier proves the original 50 eligible results remain unchanged before case 51 launches. The first live batch plan must contain only cases 51–55 and five distinct tasks.
5. Dashboard reports verified coverage against 600, displays actual case indices without a repetition-series fiction, retains aggregate strict/partial/token/model-call metrics and both branded regions, and passes real-page screenshot inspection. No UI automation test is created or run.

## Unique-case batch 11 restricted UID incident

### Evidence and root cause

- The first correct batch-11 plan is exact: repetition 1, Base, unique cases 51–55 and the 600-case manifest. All five trials stopped at `agent_shell_isolation` before any model work with `Restricted Agent shell probe failed: restricted-agent-shell received an invalid trial identity`.
- Runner identity is `60000 + case_index`; cases 51–55 therefore use UIDs 60051–60055. The restricted shell retained the original 50-case regex and admitted only 60000–60050. Runner, catalog and verifier already derive the UID from the actual case index; the shell was the sole stale bound.
- The five attempts retain their full preflight evidence and are `invalid_bug: restricted_shell_case_range`; they do not count. Only cases 51–55 may be retried after the reviewed shell fix.
- The first post-fix catalog preflight then failed closed before leases because historical cases 1–50 sealed the original shell digest while catalog compared every run to the new shell digest. All 53 existing result records use the same original digest. The case-set boundary already proves those rows belong to the immutable 50-case round, so shell provenance must follow that same boundary rather than rewriting or discarding old evidence.

### Repair and acceptance

1. The restricted shell accepts only decimal UIDs 60001–60600, the exact range for unique public cases 1–600, while preserving the private benchmark home-path check.
2. Focused positive tests exercise boundary UIDs through the real shell probe contract; shell syntax, benchmark typecheck and independent review pass.
3. Restart only batch 11. Its plan remains cases 51–55, and all five trials must pass `agent_shell_isolation` and acquire leases before the batch is considered live.
4. Catalog and verifier bind cases 1–50 to their single sealed historical shell digest and cases 51–600 to the current installed/source shell digest. A focused contract test covers the case-50/51 crossover; a development catalog/verifier must preserve the original 50 eligible rows before restart.

## Luna Base 10-case execution concurrency

### Recall and implementation boundary

- The operator raised only the execution concurrency from five to ten. Existing case identities, five-case manifest batches, repetition 1, Base/Mission/model selection, scoring, receipts and sealed candidates remain unchanged.
- Starting after completed batch 11, the supervisor runs two adjacent five-case coordinators concurrently. Each coordinator retains its own plan, authorization and receipt, so batches 12/13 cover exact unique cases 56–65 without inventing a new manifest or rerunning cases 1–55.
- Coordinator authorization and lifecycle locks are batch-scoped. Evidence catalog replay remains globally serialized at the shared root so concurrent coordinators cannot overwrite catalog/leaderboard/paper artifacts. The active lease ledger remains the aggregate concurrency fact and may contain at most ten distinct cases.
- The first live pair exposed that serialization without lock retries rejects the second coordinator with `ELOCKED`. The catalog lock now waits in bounded one-second retries while the owning replay keeps its lease fresh; this preserves one writer without collapsing execution back to five.

### Acceptance

1. A focused supervisor contract proves two adjacent batches are launched concurrently and the maximum is ten distinct cases.
2. Two live batch plans retain `trial_concurrency: 5`, exact repetition/model/profile and non-overlapping five-case sets; their aggregate active leases contain cases 56–65 only.
3. Catalog refreshes never overlap, completed batch receipts stay independent, and any invalid case is retried only in its own missing slot.

## Luna Base single-coordinator 10-case correction

### Evidence and root cause

- The two-coordinator implementation started both batch processes, but each process independently performed a full evidence-catalog replay before publishing its five case leases. The shared catalog lock therefore exposed one five-case group as `running` and the other as `queued` for several minutes. Two coordinator processes were observable even though the operator requested one execution coordinator with ten concurrent case slots.
- The direct trigger was retaining the one-batch CLI shape and composing concurrency in the shell supervisor. The real data model already permits ten globally unique active leases; only the coordinator's plan/authorization/receipt context was singular.
- The correction must preserve the existing five-case manifest batch identities and independent receipts because cases 1–65 are already sealed against them. It changes only the execution owner: one coordinator accepts one or two ascending missing batch indices, refreshes the catalog once, creates each existing five-case plan/authorization, launches the combined five or ten unique slots together, refreshes the catalog once after all slots settle, and writes each receipt independently. The two indices need not be consecutive after a partial retry; their case sets must remain disjoint.
- Already running batches 12/13 are not restarted. Their valid results remain eligible. The corrected single-coordinator path begins with the next missing pair after the current pair settles.

### Acceptance

1. The continuation supervisor launches exactly one `run-automationbench-batch.ts` process per pair and passes two ascending missing batch indices to that process; a final odd batch remains a valid one-batch invocation.
2. One coordinator performs one preflight catalog refresh, owns two batch-scoped locks and authorizations, and launches ten non-overlapping cases through ten child trial processes. No second batch coordinator or catalog waiter exists.
3. Both five-case plans keep schema version 2, `trial_concurrency: 5`, exact batch identity and independent receipts, while the shared active lease ledger reaches at most ten unique cases and the dashboard renders their real `running`/terminal state without a synthetic queued group.
4. Focused positive tests, benchmark typecheck, real catalog/verifier acceptance, and an uninvolved read-only review pass before the new supervisor is used.

## Luna Base partial-batch sealed-candidate recovery

### Evidence and root cause

- The first single-coordinator recovery plan correctly reused four sealed candidates from failed batch 12, but reused none from failed batch 13 and therefore reran cases 61/63/65. Catalog evidence showed those three old runs were individually raw-eligible and present in `sealing_run_ids`; the batch audit had exactly one reason, `launched_trial:base:62`, because case 62 failed at the coordinator inactivity boundary before producing a run id.
- `reusableBatchCandidateRunIDs()` only admitted post-hoc `eligible_trial_raw_invalid:*` reasons. It could preserve clean siblings when a launched sibling later became invalid, but not when a sibling never produced a run identity. The broad `launched_trial:*` reason did not distinguish an explicitly unstarted coordinator failure from plan/run identity corruption, so admitting it wholesale would be unsafe.
- The audit now emits a typed `launched_trial_unstarted:*` reason only for a receipt row with no run id, `run_status: coordinator_failed`, and `exit_code: -1`. Candidate recovery accepts that typed reason together with existing post-hoc raw-invalid reasons, while all structural, identity, interval, concurrency, or generic launched-trial reasons still fail closed.
- The accidental recovery reruns for cases 61/63/65 remain preserved as bug attempts. Current missing cases 57/62/64 continue without restart; the repair affects future recovery/catalog selection and does not authorize another rerun of an already sealed slot.

### Acceptance

1. A failed five-case receipt with one explicitly unstarted coordinator row retains the other four valid `sealing_run_ids` as reusable candidates.
2. A generic launched-trial identity mismatch, concurrency violation, structural error, or untyped missing run still yields no reusable candidate.
3. Focused tests, benchmark typecheck, catalog/verifier checks and uninvolved review pass before the next group starts.

## Luna Base recovery candidate collision

### Evidence and root cause

- After sealed-candidate recovery was repaired, the already-running recovery coordinator reached its post-trial catalog with both an old reusable sealed run and an accidental new raw-eligible run for case 61. `waveCandidateByCase()` rebuilt candidates by concatenating every reusable run with every current-batch raw-eligible attempt, then threw `Multiple eligible candidates exist for base case 61`.
- The plan had already selected its adoption set in `preexisting_eligible`, but result reconciliation ignored that immutable selection and recomputed a broader candidate set. The immediate disposition update removed the three known duplicate bug attempts, but data cleanup alone did not repair this control-flow defect.
- The coordinator must capture each profile's exact preexisting case-to-run map before writing plans. Launch skips those cases, plan evidence records those exact run ids, and post-trial reconciliation adopts only those selected preexisting runs. Current-batch candidates are considered only for cases with no selected preexisting run. Multiple current candidates for an unadopted case still fail closed.

### Acceptance

1. Given one selected preexisting run and one current raw-eligible duplicate for the same case, reconciliation returns the selected preexisting run without throwing or referencing the duplicate.
2. Given two current raw-eligible runs for an unadopted case, reconciliation still throws the typed multiple-candidate error.
3. Plan `preexisting_eligible`, launch skipping and receipt eligible claims derive from the same captured map; no second candidate source or fallback is introduced.
4. Focused tests, benchmark typecheck, catalog/verifier checks and uninvolved review pass before the repaired runner is activated.

## Luna Base stalled Provider stream recovery budget

### Evidence and shared root cause

- Batches 14/15 sealed eight cases but cases 68 and 74 failed after 600 seconds without observable activity. Both had `pending interactions=0`; neither was a model-declared `fail_task`. Case 68's orchestrator emitted final closure text after all three workflow nodes had durable `terminal_success` settlements, but the final Provider turn had no `step-finish` or usage-ledger row. Case 74's Tester emitted `step-start` and reasoning but no terminal stream event or usage row. The later `Server.stop graceful runtime shutdown`, process-recovery, dispatch-agent and orchestrator-stream artifacts were produced by the benchmark timeout shutdown and are consequences, not causes.
- All production Chat/Task/Mission/Session turns share `SessionProcessor` and `withLLMActivity`. Semantic idle is already typed, abortable and retryable, but `DefaultLLMActivityPolicy.maxRetries.default=5` applied to the long-duration `idle` and `first_byte` classes. With a 180-second semantic idle and 300-second first-byte threshold, a stalled retry chain can exceed the external 600-second no-activity contract before the activity owner emits its terminal failure. The initial proposal retained the 300-second first-byte threshold with one retry; independent review rejected it because two waits plus backoff still exceed 600 seconds.
- This is a shared Session stream-liveness defect, not a workflow- or case-local issue. Normal semantic chunks continue to refresh liveness without a call-count or wall-clock budget. Only an already stalled Provider attempt is affected: `idle` remains 180 seconds, `first_byte` becomes 90 seconds, and each receives one recovery retry. Even the conservative two-attempt path that consumes both first-byte and idle windows plus the first retry backoff remains below 600 seconds. Rate-limit and other explicitly retryable transport classes retain their existing policy.
- The two attempts remain `invalid_bug: provider_stream_recovery_exceeded_execution_inactivity`. After the product fix is merged to `v0.0.53beta` and synced back to the benchmark branch, only cases 68 and 74 may be retried; the eight sealed siblings remain reusable.

### Acceptance

1. Default LLM activity policy uses a 90-second first-byte threshold, explicitly grants one retry to `idle` and `first_byte`, retains the existing rate-limit budget, and does not change normal semantic heartbeat, total deadline, tool pause or external abort behavior.
2. A focused positive activity test proves a stalled first attempt can recover on the single retry; a second stalled attempt terminates with the typed class rather than scheduling a third attempt, and the conservative default two-attempt first-byte-plus-idle budget is strictly below 600 seconds.
3. Session processor retry tests, LLM activity tests, typecheck and the benchmark catalog/verifier pass; uninvolved review finds no unresolved issue.
4. The product-only commit is merged and pushed to `v0.0.53beta`, then synced into the benchmark branch before retrying only cases 68 and 74.
