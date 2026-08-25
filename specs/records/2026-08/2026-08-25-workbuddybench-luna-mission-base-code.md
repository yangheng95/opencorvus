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
| Whole-repository search | OpenCorvus has no WorkBuddy adapter. Existing AutomationBench code proves real Mission intake, exact Skill mounts/loads, isolated runtime, durable transcripts/traces, Provider ledgers, trajectory rendering, evidence catalogs, and no-repeat recovery, but its simulated-world bridge/scorer cannot be reused for repository patches. WorkBuddy exposes Harbor's `BaseInstalledAgent` extension point and official verifier. Its authoring guide supports new installed Agents, while `run.sh` additionally requires one `HARNESS_ADAPTERS` entry; the experiment therefore carries one exact auditable WorkBuddy runner overlay for the OpenCorvus identity without changing Harbor, task data, or verifier logic. |
| Independent Agent feedback | Skill review first found and closed an Orchestrator load-order gap. Adapter review then found unsafe partial terminal settlement, workspace Skill pollution, cancellation evidence loss, process residual risk, fixed-root resume, credential expansion, image-context drift, and weak result cataloging. The repaired adapter uses an external read-only Skill path, durable physical settlement, Host-shielded baseline-delta process cleanup, cancel-time DB/usage sealing, immutable UUID attempt roots, root-private credential mounts, exact image/source receipts, and official-result/evidence catalog validation. A third uninvolved read-only review reported no remaining P0/P1 and authorized dry-run followed by one development chain proof; formal Code80 remains gated on real evidence review. |

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
- Official upstream identity remains pinned and its task/dataset/Harbor/verifier bytes stay unchanged. The runtime checkout carries only the exact recorded OpenCorvus `HARNESS_ADAPTERS` overlay plus untracked experiment configs/adapter module, all re-derived from the benchmark branch and sealed by digest.
- Product Task/Mission/Session/Skill behavior remains unchanged unless the real chain exposes a shared product defect, which is repaired separately on the maintenance branch before retrying an invalid slot.

## Implementation contract

1. Package an immutable OpenCorvus harness payload for Harbor's image-backed read-only split mount. The task image remains harness-free; the adapter links only the pinned payload at runtime.
2. Implement a `BaseInstalledAgent` plugin loaded by WorkBuddy through one recorded `HARNESS_ADAPTERS` overlay on the pinned checkout. It configures an isolated OpenCorvus home, exact Luna Provider/model projection, full-access sandbox permission, `/workspace` project identity, runtime Skill bytes, and exact Skill mounts. No Harbor, dataset, task, verifier, scoring, or retry source is edited.
3. Launch through `POST /mission/wake` with product pillar `code`, exact model, and held Base Squad. Require the selected child Task to bind Base plus `planner-execution-verification`; wait for Mission, child Task occurrences, ingress, scheduler deliveries, Provider activity, and repository Tool effects to settle.
4. Keep model interactions streaming. Do not cap model/Agent/Tool calls for comparability. WorkBuddy/Harbor timeout remains a liveness owner; the adapter emits truthful progress during OpenCorvus execution and evidence sealing so outer supervision cannot kill a live or failure-capturing trial.
5. Return the settled `/workspace` unchanged to Harbor. WorkBuddy's official verifier is the only score authority. The adapter never reads task-local verifier/reference material or invents a parallel score.
6. Seal the full experimental evidence and recompute its audits in catalog/verifier tooling. Formal results require exact source/config/image/Skill identities, clean official source, Skill adherence, Mission/Base binding, official result, and exact manifest.
7. Chain proof: one deterministic Code task, one attempt, isolated development roots, Docker and model preflights, full evidence, and official verification. This attempt is not adopted into the formal aggregate.
8. Formal Code round: all 80 tasks under the official attempt count and Code configuration, with bounded task concurrency recorded separately from unrestricted internal Base activity. Public leaderboard rows remain pinned context rather than an official submission claim.

## Acceptance

1. Official upstream commit is pinned; the runtime checkout diff matches only the recorded harness-adapter overlay and generated experiment configs/module, while task/dataset/Harbor/verifier files remain byte-identical. Dataset count is 80 and archive checksum validation is retained.
2. Runtime Skill validates structurally, contains no task answer/scorer hint, and exact Base mount/load/order audits pass on a real chain proof.
3. Official WorkBuddy dry-run resolves model, harness, dataset, local backend, connection, task selection, context, attempts, timeout, and image mount without mutation or model calls.
4. Docker chain proof reaches a real OpenCorvus Mission/Base terminal, changes only `/workspace`, produces an official verifier result, and seals WorkBuddy plus OpenCorvus evidence and token/trajectory data.
5. Focused tests, relevant typechecks, docs check, diff check, and uninvolved review have no unresolved finding. Every repository change is committed and pushed; no credential or external dataset enters Git.
6. The operator explicitly confirms before the real cost-bearing run.

## Current blocker

The operator authorized the run on 2026-08-25. Docker Desktop Linux server `29.2.0` is now available, official `uv sync` completed against pinned Harbor commit `527d50deb63a5d279e8c20593c18a2cbc7f61f9e`, and no WorkBuddy task or Luna call has started yet.

## Chain-proof implementation round

### Verified trigger and root

- WorkBuddy's external runner requires a model manifest but its `validate_model` preflight only validates the resolved backend identity and credential-variable presence. The OpenCorvus adapter owns the actual model lifecycle, so the manifest records exact Luna while the adapter uses the existing root-private OpenCorvus OAuth `auth.json` plus `models.json`; no raw-model harness or second model path is introduced.
- Harbor instantiates a `BaseInstalledAgent` on the Host and calls `install()` then `run()` against the official task container. The new adapter therefore remains benchmark-only Python code and uses Harbor's stable installed-Agent interface without forking Harbor or the WorkBuddy verifier.
- The official Code dataset declares harness-free task images and does not require a mount for unknown harness names. The OpenCorvus harness nevertheless uses the same native read-only image mount mechanism as the official harnesses so the task image and task data remain unchanged.

### Single data and control flow

1. A pinned Linux OpenCorvus bundle plus the adapter helper and answer-free runtime Skill are built into one scratch split-mount image and mounted read-only at `/opt/opencorvus`.
2. The job bind-mounts only the isolated Provider projection read-only at `/run/secrets/opencorvus-provider`; `install()` prepares required system commands and a private logs/home root without exposing credential values.
3. `run()` copies `auth.json` and `models.json` into the private OpenCorvus home with mode `0600`, projects the mounted answer-free Skill through `OPENCORVUS_CONFIG_CONTENT.skills.paths` outside `/workspace`, starts the mounted OpenCorvus server, and performs the exact `openai/gpt-5.6-luna` Provider preflight. The harness never seeds repository files, so timeout or cancellation cannot place Skill bytes in the official workspace diff.
4. Before Mission wake, the helper refreshes the Base Skill mount matrix, requires mountability plus the `skill` Tool for `orchestrator`, `base-planner`, `base-developer`, and `base-tester`, PATCHes the exact `default/skill/workbuddybench-code` mount for each, re-reads the matrix, and fails closed on any mismatch or unexpected effective owner.
5. The helper wakes one real `productPillar=code` Mission with `expertSquadIDs=[base]`, the unchanged WorkBuddy instruction, and a transparent sandbox/Skill notice. It observes durable Mission/Task/Session/trace activity until natural terminal quiescence, with inactivity renewed only by real durable activity.
6. After settlement, the helper seals the mount matrix, Mission and Task transcripts/boards/traces, Provider usage, exact Skill load-before-action audit, workflow binding, final runtime database, server log, source/config/image identities, and an exact-file SHA-256 manifest under `/logs/agent`.
7. Harbor then captures the final `/workspace` diff and runs the official WorkBuddy composite verifier. The adapter's `populate_context_post_run()` publishes ATIF trajectory and token totals from sealed OpenCorvus evidence; it never assigns or alters the official score.

### Focused acceptance for the first container

- Dry-run resolves one explicit Code task, one attempt, Luna, OpenCorvus harness, Base profile, official verifier, split-mount image, isolated log roots, and no raw-model proxy.
- The real chain proof must show exactly one OpenCorvus server and Mission, Base plus `planner-execution-verification`, a completed exact Skill load before every participating owner's first Tool action, a non-empty final diff when the task requires edits, official verifier output, complete Provider usage, and no credential bytes in sealed text evidence.
- Any adapter, Skill, projection, terminal, isolation, timeout, evidence, or verifier-chain defect marks this development attempt invalid; preserve it, repair the shared root, and rerun only the one missing chain-proof slot.

## Independent adapter review repair

- Runtime Skill discovery now comes exclusively from the read-only harness image through `OPENCORVUS_CONFIG_CONTENT.skills.paths`; no harness file is written under `/workspace`, including cancellation paths.
- Natural terminal requires Mission/Task terminal facts plus no executing Session, unmatched Provider request, unfinished Tool request, unresolved/dead protocol inbox, pending Session control, unresolved automation run, active task delay, or incomplete occurrence descriptor. Full message Parts and trace bytes participate in the activity signature, and a second stable observation confirms quiescence.
- The helper atomically publishes the latest complete observation on every poll. Host cancellation is caught by a shielded `BaseInstalledAgent.run()` finally: a container process baseline identifies every trial-owned process by PID plus start time, all live residuals are settled, SQLite is backed up, Provider usage and credential audits are written, the slot becomes `invalid_bug` when it never settled, and the manifest is resealed.
- Each launch holds one `flock` lease, allocates a UUID attempt root, generates an attempt-specific WorkBuddy jobs directory, and rebuilds a catalog that accepts only fully audited Agent evidence plus an exception-free official Trial result with Agent context and non-empty verifier rewards. Invalid and incomplete attempts stay immutable and score-ineligible.
- WorkBuddy `.env` contains only a non-secret managed-provider sentinel required by its manifest parser. Real OAuth and model catalog bytes remain two exact read-only root-private file mounts used only by OpenCorvus; both in-container and Host catalog scans compare protected secret bytes against textual evidence.
- Harness preparation builds the payload and Dockerfile from one control context, inspects the exact image, hashes the OpenCorvus runtime bundle and every benchmark-only adapter/config/Skill file, and mounts that source receipt into the trial.
- Focused validation is green: Python compile, ten adapter/catalog/settlement/cancellation tests, shell syntax, WorkBuddy harness config loading, docs check, diff check, and a real detached-child cleanup test inside a disposable Docker PID namespace. No WorkBuddy task or Luna call has started at this point.
