# DeBERTa ABSA CUDA multi-Expert-Squad Mission

Status: first Market-package attempt failed and was stopped; proven package-contract repair in progress before the platform-built-in-only rerun

## Recall

| Item | Requirement or evidence |
| --- | --- |
| User request | Use Mission mode and `gpt-5.6-sol` to finish a long DeBERTa-v3-base ABSA mission. Every numbered item must be owned by a complete Expert Squad: acquire `deberta-v3-base-absa-v1.1`, research or synthesize data and train; record every innovative iteration and its train/test metrics; build an auto-updating training-monitor and inference website; use a fully configured CUDA runtime and never train on CPU; draw the best architecture and design; research related work and write a concise, informative ACL-style short paper of at least four pages; deeply review and correct it; organize the result as a Git repository and push it to GitHub. After the first run exposed a package-contract failure, the operator added: `专家团bug太多了，限定只能用内置的几个专家团完成这个任务`. |
| Corrected acceptance boundary | The root Mission must hold multiple exact Expert Squad revisions and create multiple Mission-owned child Tasks. A single Squad whose internal workflow has several Agents is not a multi-Squad pass. The accepted rerun may hold only the platform built-ins `research-studio`, `base`, and `advanced`; every child Task binds one of those three profiles, and no Project/Market package is available in the fresh rerun Project. Cross-Squad evidence must enter the successor through an exact predecessor completion decision, not copied prose. |
| Model | Every Mission, Task-root, package Orchestrator, and projected worker request uses exact `openai/gpt-5.6-sol`. The configured Provider credential, projected model, and persisted actual request model are verified separately without recording credential bytes. |
| Environment | Isolated Project and runtime under `D:\myhexin-local\demos`; real source Web UI at `http://127.0.0.1:7878/ui/`; NVIDIA RTX 5090 with 32,607 MiB and driver-reported CUDA 13.2; GitHub CLI authenticated as `yangheng95` with repository scope. |
| Timeout | Periodic bounded observation; declare a stall only after 20 minutes with no new durable Message, Tool part, node occurrence, Artifact revision, Git change, GPU process/sample, Task transition, or Mission transition. Training receives no wall-clock shortcut and may continue while durable activity changes. |
| Hard constraints | Use only `research-studio`, `base`, and `advanced`; do not install or select any Market/Project Expert Squad in the rerun. No CPU training or CPU fallback; no fabricated metrics, citations, screenshots, repository state, or completion. All LLM traffic remains streaming. Do not expose Provider or GitHub credentials. Do not mutate or stop user-owned services. Do not add or run UI automation tests. External GitHub repository creation/push is explicitly requested; the public repository name is `yangheng95/deberta-v3-absa-cuda-lab` unless a real collision appears before creation. |
| Sources read | `AGENTS.md`; `benchmark-debug-template/SKILL.md`; `specs/current/architecture/04-extensions.md` Mission-held-Squad and cross-Squad sections; `specs/records/2026-08/2026-08-19-long-horizon-and-evolution-repositioning.md`; `specs/records/2026-08/2026-08-22-website-data-analysis-expert-squad-demo.md`; installed manifests/selectors for Advanced, Base, Scientific Research Design, Data Analysis, Deep Research, Academic Paper Review, Frontend Innovate, and Cloud Platform Architecture. |
| Whole-repository and runtime search | Current architecture freezes a set of visible Expert Squad IDs on Mission creation, while every child Task binds exactly one held profile. Cross-Squad collaboration is implemented only as dependent Mission Tasks with imported completion decisions. `openai/gpt-5.6-sol` is present in the real model chooser. The discarded first Project contained all 115 release-payload packages; the accepted rerun uses a new Project with no Project-installed Expert Squad directory and selects only the three platform built-ins. |
| Independent agent feedback | None before implementation. Initial read-only review found two P2 issues: Cloud's valid Requirements root was not yet protected by the new Resolver assertion, and both indexes described the pending seven-stage Mission as if training/paper/GitHub delivery had completed. Both were accepted and corrected. Follow-up review confirmed both fixes and found one stale assertion count, corrected below. Final read-only confirmation reported no findings. |

## Mission-blocking package repair

### Proven failure chain

- Observable symptom: Scientific Research Design produced all three branch Artifacts plus a final source registry, CUDA experiment contract, and research decision register, but its Task never produced a workflow completion decision. The Integrator ran three times and the Task failed.
- Direct trigger: `expert-squads/builtin/scientific-research-design/expert-squad.jsonc` declares `research-decision-integrator.base_role = architect` even though no workflow node uses the typed `requirements` base role and the Task has no RequirementSet.
- Control/data root cause: `base_role` selects the physical runtime template and dispatch adapter, not a human-readable role label. The Architect adapter therefore correctly attempted Delivery Slice projection and correctly persisted `domain_incomplete / requirement_set_not_read`; the package actually wanted a domain report join through ordinary Artifact publication. Re-dispatching the same Agent cannot create the absent RequirementSet producer, so all three occurrences converge to the same incomplete settlement.
- Why Host relaxation is wrong: a real Architect is only projectable from a completely read and selected RequirementSet. Weakening `classifyArchitectRequirementSetProvenance()` would corrupt Advanced and other legitimate Requirements -> Architect paths and create a second source of acceptance truth.
- Horizontal audit: among 115 Market packages only Scientific Research Design and Cloud Platform Architecture use an Architect Agent. Cloud is valid because its parallel root includes `cloud-workload-requirements-analyst.base_role = requirements`, which creates the typed RequirementSet consumed by `cloud-architecture-decision-owner`. The other eight packages in the same ten-domain parallel-to-join family already use `delegated-worker` for their domain join. Therefore only Scientific Research Design is misprojected.
- Entry/lifecycle coverage: the bad identity is frozen at Task package-revision binding and reused by normal dispatch, same-Session correction redispatch, Mission scheduler wake, Task recovery, and restart recovery. All three real occurrences preserved the same workflow node/session/adapter identity, proving that retry cannot cure it. Direct Task and Mission-created Task entry share the same `PromptProfileResolver` and are affected identically. Project isolation, Provider streaming, Artifact publication, node dependency order, and Mission wake delivery all behaved correctly and are excluded as causes.

### Repair contract and impact

1. Change only `research-decision-integrator.base_role` from `architect` to `delegated-worker`; keep the exact Agent ID, prompt, Skill, workflow node, dependencies, Artifact protocol, and scheduler unchanged.
2. Bump the package revision because published package bytes and digest change. Regenerate the canonical public payload/Market projections through existing generators; do not hand-edit generated facts.
3. Strengthen the existing ten-domain positive package test so the real resolver proves every domain join uses `delegated_worker`, while Cloud remains an explicit Requirements -> Architect exception with its own typed pair.
4. Run the package/resolver/payload tests plus version/topology/docs checks. Then start an isolated fresh-source service and rerun the exact Stage A Mission Task through the real Web UI with `openai/gpt-5.6-sol`; acceptance requires four workflow nodes in dependency order, one terminal domain join, a completion decision bound to the new package revision/digest, and no `architect_contract_graph`, `goal_graph_projection`, `requirement_set_not_read`, or corrective redispatch for that Task.
5. This repair does not authorize deleting the failed run, loosening Architect integrity, adding fallback routing, changing the accepted built-in-only case constraint, or publishing a new binary/website release.

## Impact and execution-chain analysis

- Observable prior failure: the earlier Base example created one `base` Task. Its Planner, Developer, and Tester proved one package-internal multi-Agent workflow, but the root Mission did not coordinate multiple Squads. It is excluded from this benchmark.
- Direct trigger: one new real Web UI Mission submission that explicitly holds all required Squad entities and selects exact `openai/gpt-5.6-sol`.
- Control flow: Composer entity selection -> immutable Mission held-Squad snapshot -> Mission child Task creation -> exact package revision/workflow binding -> package-internal nodes -> completion decision -> successor `artifact_sources` import -> final Mission review and completion.
- Data flow: research decision register -> CUDA baseline repository/model/data snapshot -> iterative experiment and monitoring application -> experiment analysis and architecture figures -> cited ACL manuscript -> independent paper review -> corrected repository/PDF and GitHub publication.
- Shared-risk surface: Task/Mission scheduling, cross-Task Artifact imports, package workflow dependency ordering, Provider streaming, long-running shell/GPU processes, Git checkpoints, external GitHub mutation, and terminal convergence. Any anomaly is audited across all Task/Session occurrences and normal/retry/recovery paths before being called package-local.
- No product-source repair is authorized by merely running the case. If a product defect blocks the benchmark, record the exact root cause first; any repository repair requires focused positive tests, fresh end-to-end rerun, visual review when applicable, and independent review.

## Benchmark definition

### Input and output

Input is the user's six numbered requirements, a fresh Git Project, the installed Expert Squad catalog, exact `openai/gpt-5.6-sol`, the local CUDA GPU, public sources, and explicit authority to create/push the public GitHub repository.

The passing output is one public, reproducible repository containing:

1. Exact model/source identity, license notes, immutable download manifest, dataset provenance or synthesis recipe, train/validation/test splits, and a real CUDA baseline training run.
2. A reproducible CUDA environment lock/config plus at least three comparable experiments (baseline and at least two explicit innovative candidates). Every experiment records configuration, seed, data identity, train/validation/test metrics, duration, GPU identity and peak memory. The selected best model must exceed the baseline on the frozen primary held-out metric; otherwise the Mission must report that the performance goal failed.
3. A runnable auto-updating training-monitor and inference website backed by the real experiment log/checkpoint surface, with a real rendered-page screenshot and an inference smoke test using the selected checkpoint.
4. Architecture/design figures generated from the winning experiment and its actual configuration/metrics, with source data and reproducible figure-generation code.
5. A cited ACL-style short-paper source and rendered PDF of at least four body pages, grounded in the actual experiments and related-work sources.
6. An independent Academic Paper Review artifact and a corrected final manuscript that resolves or explicitly dispositions every material finding.
7. A clean, organized Git history pushed to `https://github.com/yangheng95/deberta-v3-absa-cuda-lab`, with setup, CUDA-only training, monitoring, inference, reproduction, results, paper, license, and limitations documented.

### Required root Mission topology

| Stage | Exact platform built-in | Complete Task outcome | Depends on |
| --- | --- | --- | --- |
| A | `research-studio` | Authoritative model/data/literature research, competing experiment hypotheses, leakage controls, and a reproducible research plan | none |
| B | `base` | Exact model/data acquisition, CUDA environment proof, frozen splits, and baseline run | A completion decision |
| C | `advanced` | Iterative CUDA experiments, best-checkpoint selection, monitoring/inference website, and implementation/visual verification | B completion decision |
| D | `research-studio` | Reproducible experiment comparison, uncertainty/limitations, winning-architecture analysis, and figure source data | C completion decision |
| E | `research-studio` | Related-work synthesis and ACL-style manuscript/PDF grounded in A-D | A, C, and D completion decisions |
| F | `research-studio` | Independent manuscript fact/citation/method/organization review and a corrected final paper | E completion decision |
| G | `base` | Verify the corrected paper and complete repository, create/push the GitHub repository, and publish final handoff | C, D, E, and F completion decisions |

Each stage must use one declared package workflow in full. The Mission may not collapse stages, substitute direct generic Agents, reuse a Task under a different profile, or mark completion from summaries alone.

### Machine-checkable acceptance

- Held-Squad snapshot contains exactly `research-studio`, `base`, and `advanced`; persisted child Tasks include seven rows with profile sequence `research-studio`, `base`, `advanced`, `research-studio`, `research-studio`, `research-studio`, `base`.
- Every Task completion decision contains an exact package revision/digest and non-empty declared workflow graph; all mandatory workflow nodes have real Session occurrences and terminal success in dependency order.
- Successor Task catalogs contain Host-imported predecessor deliverables with immutable import lineage sourced from the named completion decisions.
- Persisted model identity for the Mission, seven Task roots, package Orchestrators, and projected workers is `openai/gpt-5.6-sol`.
- Training evidence contains `torch.cuda.is_available() == true`, device `NVIDIA GeForce RTX 5090`, CUDA tensors/model placement, and no CPU fallback path. GPU samples and experiment logs overlap the training intervals.
- At least three comparable experiment records exist; all metrics are tied to exact configuration/data/checkpoint identities; the selected best held-out primary metric is strictly higher than the baseline.
- Monitoring/inference page is exercised through the real page and visually reviewed; its displayed values agree with durable experiment records.
- Final paper PDF page count is at least four; citations resolve to inspected sources; manuscript claims reconcile with experiment artifacts.
- GitHub repository exists at the expected URL, default branch resolves to the final accepted commit, remote tree matches the local clean worktree, and no credentials, large untracked checkpoints, or private data are pushed.
- Mission reaches canonical completion only after every Task and the final GitHub verification are terminal. Any failed criterion keeps the website-success claim failed.

## Execution plan

1. Create a fresh isolated Git Project with a concise mission brief and ignore rules for local model/checkpoint caches. Do not install any Project Expert Squad; verify that `.opencorvus/expert-squads` is absent before submission.
2. Verify exact Provider/model projection with one real streaming probe, verify CUDA/PyTorch can be configured without CPU training, and verify the target GitHub repository name is unused.
3. In the real Web UI, select Mission mode, `openai/gpt-5.6-sol`, and only `@squad("research-studio")`, `@squad("base")`, and `@squad("advanced")`; submit the complete visible request once.
4. Observe at bounded intervals. Preserve Mission/Task/Session/workflow/Artifact/model/GPU/Git facts; answer only genuine operator authority questions within the user's stated scope.
5. After terminal convergence, inspect the rendered monitoring UI and paper, verify all local and GitHub artifacts, and record exact identifiers, timings, hashes, metrics, screenshots, and any failures here.
6. Run documentation/diff checks, obtain an uninvolved read-only review, fix all valid findings, repeat review when needed, commit only this task's records/evidence, merge upstream without rebase, inspect outgoing commits, and push.

## Execution record

### Discarded first attempt: Market packages were not accepted

- Project: `D:\myhexin-local\demos\website-multi-squad-absa-20260822`; initial commit `36b824d8326cb014dc5816bec68c88869716a31b`.
- Mission `f592a36ef81cfa65` held six Squads and used exact `openai/gpt-5.6-sol`. Stage A Task `tsk_g00VT2aXQe00S6xqas4g` bound project package `scientific-research-design@2026.08.13.1`, digest `d0d85e4c00cb476304d169cf60772061c4109af1cb23d23d063df0e74d05750e`, and the full four-node `research-design-decision-register` graph.
- The three parallel research branches succeeded and published evidence landscape revision 86, rigor/ethics gates revision 82, and hypothesis register revision 83. The dependent Integrator ran only after all three terminal events and published source registry revision 99, CUDA execution contract revision 100, and final research register revision 101.
- The Task still failed correctly. `research-decision-integrator` projects `base_role=architect`; its Host adapter requires a fully read RequirementSet, but this package workflow has no RequirementSet producer. Three Integrator occurrences therefore settled as `domain_incomplete` with `requirement_set_not_read` and empty ContractGraph instead of a workflow completion decision. The Task became failed at `1787414532915`; the root Mission did not create Stage B.
- After the operator limited the case to platform built-ins, the root Mission was stopped through the real UI and left `Not running`. Its artifacts and failure remain as evidence only; none may be imported into the accepted rerun.

### Platform-built-in-only rerun

Pending.

### Mission package-contract repair implementation and fresh E2E

#### Source repair

- `expert-squads/builtin/scientific-research-design/expert-squad.jsonc` now projects `research-decision-integrator` through `delegated-worker` rather than the Delivery Slice `architect` runtime. The package revision is `2026.08.23.1`; no Agent ID, prompt, Skill, workflow node, dependency, scheduler, or Artifact protocol changed.
- The canonical bundled payload was regenerated through `packages/opencorvus/script/generate-expert-squad-payload.ts`; the repaired payload digest is `69cffc172500ce8fe3df5429fa700c9b2d7c82baf55ed4b94795e6459b89f587`.
- `domain-expansion-packages.test.ts` now records each ten-domain package's exact version and join base role, and proves through the real `PromptProfileResolver` that Scientific Research Design plus the other ordinary domain joins resolve `delegated_worker`, while Cloud retains its valid `architect` adapter after a typed Requirements root.
- The public Market generator updated the catalog SHA-256 from `3e55fdd2...` to `179b8b3c...`; the package count remains 119 total / 4 embedded / 115 Market importable and the catalog byte count remains 76,653.
- `CHANGELOG.md` records the user-visible fix under `未发布`. Host `ArchitectStage` and its RequirementSet integrity contract are unchanged.

#### Focused validation

- From `packages/opencorvus`: domain expansion, generated payload integration, and Architect settlement tests: **17 passed / 0 failed / 278 assertions**. This includes a positive valid Architect projection that opens its successor frontier and the current typed conflict/partial contracts.
- From `packages/web`: **74 passed / 0 failed / 839 assertions**, including byte-stable static Expert Squad publication and generated Registry facts.
- Root `bun run typecheck`: 8/8 packages successful.
- Root `bun run docs:check`: 331 operations / 25 groups; pass.
- Root `bun run version:check`: release family remains aligned at `0.0.52-beta`.
- `git diff --check`: pass.

#### Isolated current-source acceptance

- Fresh project: `D:\myhexin-local\demos\scientific-mission-fix-20260823`, initial commit `9f719155109f5ef296ebacc6cbfc855eea3b0c37`.
- Fresh runtime root and database: `D:\myhexin-local\demos\.opencorvus-scientific-fix-20260823`; current-source service `http://127.0.0.1:7881/ui/`. The exact OpenAI credential authority and `models.json` projection were copied separately without retaining credential bytes in logs or this record.
- Formal one-package payload install returned `operation=installed`, exact version `2026.08.23.1`, digest `69cffc172500ce8fe3df5429fa700c9b2d7c82baf55ed4b94795e6459b89f587`.
- Real Web UI submission visibly selected `@mission("general")`, `@squad("scientific-research-design")`, Mission mode, and exact `openai/gpt-5.6-sol`.
- Mission `b13faa14b233ad2e`; Mission Session `ses_-zUWxHLQpzztdnIl7yzq`; final board lane `completed` at `1787416535310`.
- Task `tsk_g00VT2jAFw00TfiK6zDX`; title `产出 ABSA 研究决策登记册`; package binding Artifact `art_g0VT2jANP00YX3IPo6gD`; Task completed at `1787416277266`.

| Workflow node | Session creation | Terminal event |
| --- | ---: | ---: |
| Hypothesis Alternatives | `1787415517551` | `1787415893203` |
| Rigor and Ethics | `1787415517570` | `1787415767869` |
| Evidence Landscape | `1787415517588` | `1787415792408` |
| Research Decision Integrator | `1787415939059` | `1787416177123` |

The Integrator started 45,856 ms after the latest predecessor terminal event. Its Session kind, base role, and dispatch adapter are all `delegated-worker` / `delegated_worker`. It had exactly one dispatch lineage and one `terminal_success` settlement; no correction redispatch occurred.

The complete Task catalog contains zero `requirement_set`, `architect_contract_graph`, `goal_graph_projection`, `agent_coordination_request`, `agent_coordination_response`, or `agent_coordination_action` Artifacts. No `requirement_set_not_read` text or `architect_projection` settlement exists in the Task.

Accepted deliverables:

| Artifact | Catalog revision | SHA-256 |
| --- | ---: | --- |
| Evidence landscape `art_hgFtP7avSFf16JuHY6K2` | 7 | `483d405b8b29f66bb331d6b994113b3bc6f41bfa16d0a223c86b6f21768acf21` |
| Hypothesis register `art_hkomL4Ar5QWwKqyCK8E2` | 10 | `3ce1733fc2c5425fe251c3f1e3c36795d1596d9e199a211e89d48d20b08ead0d` |
| Rigor/ethics gates `art_hKP51TGE4mbuIBeEk4IL` | 6 | `91eea8c96e116da32023a87902df6f6ee69839cf6f196f1d4ad4f32534ab0efc` |
| Final research decision register `art_hPv5wv9tzzUs8iI0tUk4` | 13 | `f6c7c9dbbfbe914f75ec76f7d8ae1ca295d3dba39b4befe1bca8939c060f8ea0` |
| Task completion decision `art_g0VT2mXjS00oiHgN5wSm` | 15 | `3c58907e522de1822fdd46552dd93428b7cfe5dc02a31603e3de9b9f94b39f00` |

The completion decision binds the exact four-node `research-design-decision-register` graph and repaired package revision/digest, declares the four domain outputs as deliverables, and names the final register as the terminal workflow Artifact. The real Mission read all 15 catalog entries, published its acceptance overview, and completed naturally.

Visual evidence: `specs/artifacts/2026-08-23-scientific-mission-fix-completed.png`. Manual review confirmed the real page visibly reports Mission completion, exact package identity, delegated-worker acceptance, topology/order proof, durable Artifact IDs/hashes, and the remaining future-training approval gates.
