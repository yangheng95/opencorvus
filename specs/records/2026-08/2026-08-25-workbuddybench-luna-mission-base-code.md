# WorkBuddy Bench Luna Mission/Base Code Experiment

## Recall

| Item | Requirement or evidence |
| --- | --- |
| User request | Continue with WorkBuddy Bench using exact `openai/gpt-5.6-luna` and Base. The correction is explicit: use a Skill and do not run the harness naked. |
| Benchmark scope | Official Tencent WorkBuddy Bench Code v1.0 subset, 80 unique repository-level tasks. Start with one development chain proof, then run the complete Code set after explicit confirmation. Web, Office, and Security remain separate experiments because their graders and capabilities differ. |
| Harness boundary | OpenCorvus is the evaluated harness: real Mission intake, held Base Expert Squad, `planner-execution-verification`, isolated runtime per trial, official Harbor Docker task sandbox, and official WorkBuddy composite verifier. A WorkBuddy stock CodeBuddy/Claude raw-model run is not an OpenCorvus result. |
| Runtime Skill | Seed answer-free project Skill `workbuddybench-code`; mount exact owners `orchestrator`, `base-planner`, `base-developer`, and `base-tester`; fail closed on mount mismatch; and seal transcript evidence that each owner Session that actually ran completed the exact Skill load before its first owner-specific material action, including Orchestrator workflow selection or dispatch. |
| Inputs and outputs | Input is the unchanged WorkBuddy task instruction plus the harness-identification notice. Output is the workspace diff/artifact graded by the official verifier, together with WorkBuddy config/result, verifier evidence, Agent Type Interface Format trajectory, OpenCorvus Mission/Task/Session evidence, tokens/costs, Skill audit, container receipt, and exact manifest. |
| Timeout | Use the upstream task timeout and multiplier. Detect runner failure by actual execution inactivity, not a wall-clock cap while repository, model, Tool, trace, or verifier activity advances. |
| No-repeat rule | A verified formal task/attempt slot, including official zero, is immutable and never rerun. Bug attempts remain evidence and are excluded until the shared root is fixed; only missing slots resume. |
| Isolation | Official task archives are checksum-verified and read-only. `/workspace` is the only mutable Agent repository. Dataset metadata, verifier/reference material, credentials, benchmark control state, other trials, and AutomationBench evidence remain outside Agent authority. |
| Branch and roots | Adapter, experiment Skill, spec, and result tooling remain on `codex/automation-workbuddy-benchmark` in `D:\myhexin-local\opencorvus-bench`. Official source/dataset live under `/var/lib/opencorvus-benchmark/source/workbuddy-bench`; WorkBuddy evidence/control/results/dashboard use new dedicated identities. |
| Current external evidence | Official repository pinned at `625b2233093ae4f23e76be28c1f341d41cc70373`; Code archive downloaded through the official script, SHA-256 verified, and extracted as 80 tasks. WSL provides the pinned `uv` and Python 3.12. Docker Desktop client exists but its Linux daemon is not running, so no task or model call has started. |
| Sources read | Repository `AGENTS.md`; `benchmark-debug-template`; `skill-creator`; AutomationBench experiment/runtime Skills for mount-evidence precedent; Base package manifest/method; official WorkBuddy README, `wbbench-run-setup` Skill and phase references, live model/job/harness/bench templates, Code dataset metadata, harness-authoring guide, official GitHub repository, public leaderboard, and paper. |
| Whole-repository search | OpenCorvus has no WorkBuddy adapter. Existing AutomationBench code proves real Mission intake, exact Skill mounts/loads, isolated runtime, durable transcripts/traces, Provider ledgers, trajectory rendering, evidence catalogs, and no-repeat recovery, but its simulated-world bridge/scorer cannot be reused for repository patches. WorkBuddy exposes Harbor's `BaseInstalledAgent` extension point and official verifier; an OpenCorvus adapter must plug into that interface without modifying task data or forking Harbor. |
| Independent Agent feedback | An uninvolved read-only reviewer found one ordering gap: Orchestrator could dispatch before loading the runtime Skill. Both Skills and this spec now require a completed exact load before workflow selection or dispatch and before each other owner's first material action. The reviewer rechecked the repair and reported no remaining P0/P1/P2. The later adapter and real chain-proof evidence still require their own uninvolved review. |

## Problem and impact analysis

### Observable need

The official framework currently supports CodeBuddy Code and Claude Code harnesses only. Pointing its model YAML at Luna would benchmark one of those raw harnesses, not OpenCorvus Mission/Base. Conversely, running OpenCorvus directly outside Harbor would lose the official task image, diff capture, verifier, and comparable result schema.

### Root cause and missing data flow

The missing component is one WorkBuddy-installed-Agent adapter that starts OpenCorvus inside each official Harbor task sandbox, projects Luna plus the held Base Squad and runtime Skill, wakes a real Mission against `/workspace`, waits for physical quiescence, and returns control to Harbor without replacing the official verifier. The adapter also must export OpenCorvus transcript/trace/usage evidence into the trial logs that Harbor preserves.

The official setup Skill and the runtime Skill are distinct. `wbbench-run-setup` configures datasets, environment, model, credentials, job, launch, and reporting. It is not mounted into OpenCorvus child Agents. `workbuddybench-code` is the answer-free runtime method, but a seeded file alone does not prove projection or loading; exact mount-matrix and transcript audits are required.

### Impact surface

- New benchmark-only WorkBuddy adapter and split-mount packaging under `packages/opencorvus/script/benchmark/workbuddy/`.
- New operator experiment Skill and answer-free runtime Skill.
- WorkBuddy model/harness/job configs outside the product, with secrets only in ignored `.env` or root-private provider data.
- Focused non-UI tests for manifest mapping, exact Skill owners, runtime-load ordering, Mission result projection, no-repeat cataloging, and evidence manifests.
- Official external checkout remains clean; task/dataset files and Harbor/verifier code are not modified.
- Product Task/Mission/Session/Skill behavior remains unchanged unless the real chain exposes a shared product defect, which is repaired separately on the maintenance branch before retrying an invalid slot.

## Implementation contract

1. Package an immutable OpenCorvus harness payload for Harbor's image-backed read-only split mount. The task image remains harness-free; the adapter links only the pinned payload at runtime.
2. Implement a `BaseInstalledAgent` plugin loaded by WorkBuddy without editing the pinned official checkout. It configures an isolated OpenCorvus home, exact Luna Provider/model projection, full-access sandbox permission, `/workspace` project identity, runtime Skill bytes, and exact Skill mounts.
3. Launch through `POST /mission/wake` with product pillar `code`, exact model, and held Base Squad. Require the selected child Task to bind Base plus `planner-execution-verification`; wait for Mission, child Task occurrences, ingress, scheduler deliveries, Provider activity, and repository Tool effects to settle.
4. Keep model interactions streaming. Do not cap model/Agent/Tool calls for comparability. WorkBuddy/Harbor timeout remains a liveness owner; the adapter emits truthful progress during OpenCorvus execution and evidence sealing so outer supervision cannot kill a live or failure-capturing trial.
5. Return the settled `/workspace` unchanged to Harbor. WorkBuddy's official verifier is the only score authority. The adapter never reads task-local verifier/reference material or invents a parallel score.
6. Seal the full experimental evidence and recompute its audits in catalog/verifier tooling. Formal results require exact source/config/image/Skill identities, clean official source, Skill adherence, Mission/Base binding, official result, and exact manifest.
7. Chain proof: one deterministic Code task, one attempt, isolated development roots, Docker and model preflights, full evidence, and official verification. This attempt is not adopted into the formal aggregate.
8. Formal Code round: all 80 tasks under the official attempt count and Code configuration, with bounded task concurrency recorded separately from unrestricted internal Base activity. Public leaderboard rows remain pinned context rather than an official submission claim.

## Acceptance

1. Official source is clean at the pinned commit; dataset count is 80 and archive checksum validation is retained.
2. Runtime Skill validates structurally, contains no task answer/scorer hint, and exact Base mount/load/order audits pass on a real chain proof.
3. Official WorkBuddy dry-run resolves model, harness, dataset, local backend, connection, task selection, context, attempts, timeout, and image mount without mutation or model calls.
4. Docker chain proof reaches a real OpenCorvus Mission/Base terminal, changes only `/workspace`, produces an official verifier result, and seals WorkBuddy plus OpenCorvus evidence and token/trajectory data.
5. Focused tests, relevant typechecks, docs check, diff check, and uninvolved review have no unresolved finding. Every repository change is committed and pushed; no credential or external dataset enters Git.
6. The operator explicitly confirms before the real cost-bearing run.

## Current blocker

Docker Desktop's Linux daemon is unavailable from Windows and WSL. Phase 0 is complete, but official Phase 1 and any dry-run mount preflight or real task require the daemon. Do not start the application without operator authorization.
