# AutomationBench adversarial acceptance and capability repair

## Recall

| Item | Requirement or evidence |
| --- | --- |
| User request | Treat Tester as an adversarial collaborator rather than a consumer of Planner output and repair tool allocation. The latest correction supersedes the direct-Task Terra plan: use exact model `openai/gpt-5.6-luna`, launch through a real Mission, hold the Base Expert Squad, and finish Base first. Every direct-Task attempt is the wrong harness boundary and remains excluded. |
| Benchmark definition | AutomationBench `1.0.6`, frozen public 50-case manifest, exact model `openai/gpt-5.6-luna`, real `POST /mission/wake` intake, immutable held Base Squad, and one fresh simulated world per case. Run five distinct Base Mission cases concurrently until Base is 50/50, and never repeat a verified slot within this experiment revision. |
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
