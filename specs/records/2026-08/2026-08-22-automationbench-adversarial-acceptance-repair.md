# AutomationBench adversarial acceptance and capability repair

## Recall

| Item | Requirement or evidence |
| --- | --- |
| User request | Treat Tester as an adversarial collaborator rather than a consumer of Planner output; repair the same failure classes in Base and Advanced, and repair tool allocation. The user later replaced Luna with exact model `openai/gpt-5.6-terra`, then explicitly replaced the Terra Base-first plan with direct Advanced-only execution. The Terra Advanced round must start from empty roots and must not reuse Luna or Base scores. |
| Benchmark definition | AutomationBench `1.0.6`, frozen public 50-case manifest, exact model `openai/gpt-5.6-terra`, and one fresh Advanced world per case. Run five distinct Advanced cases concurrently until Advanced is 50/50, and never repeat a verified slot within this experiment revision. |
| Input and output | Input is the unchanged official business request plus the benchmark-only uncapped multi-Agent harness notice. Output is the official final simulated world score, immutable run evidence, per-call token ledger, Task transcript/trace/database snapshot, and a ten-second-refresh external HTML dashboard. |
| Environment | WSL2 root-owned evaluator, Provider data, control and evidence roots; the Agent sees only its unique-UID project and Unix-socket AutomationBench client. Exact OpenAI credential/model and Exa MCP probes must pass before the first formal run. Secrets remain outside Git, logs, specs and evidence. |
| Timeout | 600 seconds without real Task/message/tool/trace/world activity. There is no wall-clock limit while observable work continues. |
| Previous result | The sealed first 25 Base runs at OpenCorvus commit `c36c46c2` scored Strict `3/25 = 12.00%`, mean Partial `43.29%`, 108,883,974 tokens, 2,111 model calls and 1,545 AutomationBench API attempts. The later Luna adversarial round completed Base batches 1–6 and entered batch 7 before the user replaced the model with Terra; all Luna evidence remains immutable and is excluded from the Terra replacement round. |
| Independent analysis | Claude Code independently read all 25 valid result/assertion/transcript/trace/database/usage bundles. The strongest discriminator was source coverage: 13 runs omitted at least one required authority and averaged 16.81% Partial, while 12 source-complete runs averaged 71.99% and contained all three Strict passes. Seven runs exhausted discovery and performed zero mutation. Tester false positives were evidenced in cases 4, 6, 15 and 21; case 3 was a self-reported failure despite 100% official score. No infrastructure fault contaminated the 25 accepted scores. |
| Hard constraints | Fix prompts, capability projection and the real data flow; do not add a Host workflow gate, hidden assertion injection, case-name branch, fallback, unlimited synonymous search or scorer-aware behavior. The benchmark Skill remains answer-free. Preserve unrelated dirty `squad-sdk` work. Product fixes are committed separately and merged to the current `v0.0.51beta` maintenance line; benchmark-only adapter/spec changes remain on `codex/automation-workbuddy-benchmark`. |
| Sources read | `AGENTS.md`; `benchmark-debug-template/SKILL.md`; `skills/automationbench-experiment/SKILL.md`; `2026-08-20-external-agent-benchmark-pilot.md`; current Expert Squad and Skill architecture; Base/Advanced manifests, READMEs and prompt overlays; `SkillMount`, `PromptProfileResolver`, runtime-template and session-runtime contracts; benchmark runner/contract/tests; the sealed Claude Code report. |
| Whole-repository search | `SkillMount.matrix()` exposes scheduler-only workers and package workers but omits the projected scheduler even though runtime `SkillMount.resolve()` supports it; `PromptProfileResolver.assertPackageSkillMounts()` explicitly rejects `orchestrator` operator mounts. Advanced `source-investigator` uses non-mountable `explore`, so the benchmark runner cannot project its project-local Skill. Existing Tester prose says scope comes from the request, but its execution order still begins by selecting Planner/Architect and implementation artifacts, which permits anchoring and self-referential acceptance. |
| Independent delivery review | An uninvolved read-only reviewer found three P1 gaps in the acceptance repair: stale runnable roots, stale OpenAPI/SDK projection, and an incomplete Source Investigator Tool-surface test; all were fixed and re-reviewed. During the later Terra switch, the reviewer found that catalog/verifier/dashboard still hardcoded Luna and that the batch default still permitted paired execution. The repaired chain now requires one explicit model across batch, trial, catalog, dashboard and verifier; binds plan/result/ledger/catalog scope to that model; filters reusable candidates by model; and permits one execution profile per batch. The final Advanced-only Terra review independently reran the 40-test contract suite, confirmed typecheck and diff-check, and reported no unresolved P0/P1/P2. |

## Problem and impact analysis

### Observable behavior

Low-scoring runs frequently spend millions of tokens finding endpoints, then declare the entire Task blocked without executing request-defined safe mutations. Tester often reproduces the implementation owner's discovery path or arithmetic and publishes PASS even when whole side effects, exact values or current authority corrections are absent.

### Direct triggers

1. `automationbench-api.SKILL.md` says to “stop” when the frozen authority candidates are exhausted and to finish an action matrix “before writing anything”. The model reads discovery closure as Task closure.
2. The Skill does not state the essential semantic split: `api_search` discovers endpoint contracts; `api_fetch` reads business data. A zero endpoint-search result is incorrectly treated as proof that a business record does not exist.
3. Base Tester and Advanced Test Engineer are told to use the original request but first select the implementation-shaped contract and implementation Artifact. Their acceptance inventory can therefore inherit omissions before the promised independent reconstruction begins.
4. The Advanced source-discovery node is an `explore` runtime, whose production contract is not Skill-mountable and cannot invoke the local client. The Orchestrator runtime can load Skills, but the operator mount surface rejects and omits it.

### Data and control-flow root cause

The authoritative acceptance flow is not explicitly two-pass. Request/current-authority facts, planning claims, implementation claims and final-state observations enter one reasoning stream, so the first implementation-shaped representation anchors the verifier. Capability projection compounds this: the scheduler decides whether a discovery blocker is genuine without the benchmark method, and Advanced's designated source investigator cannot inspect the simulated sources.

### Why the previous repair was insufficient

The previous prompts added Task-element inventories, finite candidate ledgers and action matrices, but retained plan-first reads and a canonical-plan vocabulary. They described independent verification without enforcing an independent evidence order in the model contract. The benchmark adapter correctly failed closed on unmountable required agents, so it avoided false evidence, but consequently omitted the scheduler and source investigator instead of giving those real owners the capability.

### Impact surface

- Product: Base Planner/Developer/Tester and Orchestrator prompts; Advanced Requirements/Architect/Source/Implementation/Test/Integrity prompts and workflow descriptions; Advanced source-investigator runtime projection; project Skill mount matrix and validation.
- Benchmark-only: AutomationBench Skill wording; exact required mount owners and projection audit; experiment Skill/spec; fresh evidence/dashboard/supervisor paths.
- Generated: Base/Advanced package versions and exact digests only. The unrelated `squad-sdk` source/generated hunk remains untouched.
- No UI implementation is changed; no UI automation test is added or run.

## Implementation contract

1. **Adversarial two-pass acceptance**
   - Base Tester and Advanced Test Engineer first derive an independent acceptance inventory from the original request and current raw authorities, before reading Planner/Architect or implementation claims.
   - They then treat every plan, Requirement, Architect spec, implementation report and prior verdict as a claim under test, perform request-to-final-state and final-state-to-authority traceability, and actively seek omitted effects, extra mutations, stale precedence, wrong identities and self-consistent-but-source-wrong calculations.
   - Advanced System Integrity independently challenges the Test inventory and evidence rather than accepting its aggregate verdict.
2. **Discovery semantics**
   - `api_search` is documented as endpoint-contract discovery, never business-data existence evidence; `api_fetch` is the data operation.
   - The finite authority ledger includes email/message/inbox/thread/channel/history carriers. Candidate exhaustion ends discovery only. Authority-dependent unknown values remain unknown, while independent request-defined safe effects continue; no fabricated rule or unsafe mutation is allowed.
   - A request-supplied stable identifier is used directly with the discovered endpoint. Otherwise the owner performs one endpoint-contract discovery followed by one bounded identity/list fetch, not synonymous endpoint searches.
3. **Capability ownership**
   - The projected scheduler becomes a first-class operator Skill-mount owner in the same canonical `SkillMount` matrix and real turn surface.
   - Advanced `source-investigator` becomes a Skill-mountable read/execution worker with an explicit read-only external/repository discovery contract. It may invoke the project client for reads but never mutate business or repository state.
   - The benchmark mounts the method on exact owners: Base Orchestrator/Planner/Developer/Tester; Advanced Orchestrator/Requirements/Architect/Source/Implementation/Test. Integrity consumes preserved evidence and does not receive an unnecessary executable client.
4. **No Host behavioral gate**
   - Host changes only expose truthful capability/config projection and verify it. Task/tool choice, discovery, mutation and acceptance remain visible model behavior.

## Positive verification and acceptance

1. Focused tests load the real Base/Advanced packages and assert the positive adversarial two-pass contract and read-capable Advanced source owner.
2. A real `SkillMount.matrix()` project test mounts a project Skill on the exact scheduler, resolves the actual scheduler turn surface and observes that Skill enabled there.
3. A real Advanced source-investigator projection test mounts and resolves the project Skill and observes `skill` plus the local-command surface required by the benchmark client.
4. Benchmark contract tests require the expanded exact owner sets and reject missing physical owners.
5. Package revision/digest, generated-artifact, topology, focused benchmark tests, typecheck, docs check and diff check pass without staging unrelated dirty files.
6. An uninvolved read-only agent reports no unresolved P0/P1 findings; any finding is fixed and re-reviewed.
7. Product-only fixes are committed and merged/pushed to `v0.0.51beta`; benchmark-only changes are committed/pushed only on the benchmark branch.
8. A new empty Terra Advanced evidence root and new external dashboard are created. Provider/model/Exa/Skill projection preflights pass, then Advanced batch 1 launches exactly cases 1–5 with `openai/gpt-5.6-terra`. Old Luna and Base valid/invalid attempts are never adopted into the new experiment.

## Restart identity

- Evidence: `/var/lib/opencorvus-benchmark/evidence-terra-advanced-v20260822`
- Control: `/var/lib/opencorvus-benchmark/control-terra-advanced-v20260822`
- Dashboard: `D:\myhexin-local\opencorvus-benchmark-results\terra-advanced-v20260822\index.html`
- Model: `openai/gpt-5.6-terra`
- Order: Advanced-only batches 1–10.
- The experiment source commit is frozen only after all fixes, generated projections, focused checks, branch separation and independent review complete.
