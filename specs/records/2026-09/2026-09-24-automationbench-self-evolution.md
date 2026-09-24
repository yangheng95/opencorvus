# AutomationBench self-evolution: ten-case paired probe

## Recall

- User: “测试专家团自进化，目的是提高效果，测试探针设置到10个case”. Prior user explicitly authorized real Luna sampling. Continue `openai/gpt-5.6-luna` with the same paired credential/model-catalog handoff; never expose credentials.
- Starting source: clean `main`, prior delivery `03194426`; incumbent `builtin/automationbench` version `2026.09.24.2`. Prior six-case completed measurement was strict 2/6, partial 81.51%, with transparent recovery of three operator-cancelled slots. It is not this experiment's baseline.
- Read: repository AGENTS.md; benchmark-debug-template skill; Inspect architecture and implementation (`automationbench/task.py`, `world.py`); previous calibration Recall/report/host/evidence scripts; Evolution Lab README/campaign Skill and role prompts, scorer contract, package tools; Core feedback revision, mutation intent and authorization; existing evolution end-to-end checker.
- Searches: Evolution Lab owns typed campaign stages, immutable revisions and its own metric receipts. Inspect owns fresh official worlds, Task execution and official snapshot scoring. There is no current bridge from Inspect scores/worlds to the full Lab campaign protocol. Core `evolve_expert_squad_from_feedback` already allows a real model to author a constrained immutable candidate. Its own acceptance does not claim measured improvement.
- No delegated root agents. No UI changes or UI automation. Preserve user services and all unrelated edits. All new task files must be committed and pushed after upstream merge and checks.

## Analysis and boundary

Observable baseline quality failures concern outbound content completeness, exclusions, policy eligibility and late irreversible communication. The prior run's official world assertions and real tool events establish these symptoms; they do not establish that another manually written prompt is self-evolution. The missing control is a fixed paired probe applied to a model-authored candidate.

Use the existing production feedback-revision Tool to have Luna author a candidate from the incumbent and real baseline evidence. The root agent supplies evidence and the optimization objective, never writes the candidate prompts. Run the candidate through the same Inspect official checker. This is a measured automatic feedback-revision loop, not acceptance of the complete three-stage Evolution Lab Campaign. No synthetic Lab Artifacts or metric receipts will be created. Full Lab integration is outside this experiment and will remain explicitly unverified.

Touched contracts: experiment artifacts/scripts, ten-case frozen manifest, production revision Tool invocation and immutable candidate materialization. Tools, workflows, grants, dataset, world semantics, scorer, model and host scheduling remain frozen. Candidate safety uses the existing package integrity checker. Existing content digests identify immutable packages/resources; they are not used as a substitute for behavioral acceptance. No production scheduling change is currently justified.

## Frozen experiment

- Probe: exactly ten development cases. Retain the previous six identities and add four seeded draws (seed 2026092410) from finance, sales, operations, HR, excluding all prior calibration/pilot cases. Freeze membership before running. Every arm runs all ten in fresh worlds/projects; do not substitute old scores.
- Primary: strict successes out of 10. Secondary: mean official partial score, Task completion, per-case regressions, duration, actual tools/model requests and reported token usage. Improvement requires strictly more strict successes and nondecreasing mean partial score; report paired wins/ties/losses and small-sample limitations. No guaranteed improvement claim.
- Baseline and candidate use identical model, frozen cases, concurrency 2 and 300-second real inactivity window. Inspect errors/cancellations remain unavailable, never zero or selectively rerun based on score. Independently re-score sealed worlds. Candidate development may see this development probe feedback; this is not held-out generalization.
- Initial budget: 3,000 actual Luna requests across baseline, authoring, candidate and preflight. At 85% review remaining work and normally settle owned Tasks before exhaustion if necessary. Keep all cost/time evidence; no automatic expansion hidden from the record.
- One initial candidate and paired measurement. If evidence identifies a correctable authoring/tool-chain problem, repair its root and resume with all attempts visible. Further optimization must use the same ten-case contract and be separately labelled by revision/iteration.
- Isolated host reuses the previous experiment's host and observation tools; new `.tmp/inspect-evolution-20260924` state. Copy auth.json AND models.json, verify actual exact streamed Luna request before Tasks. Stop only owned services and remove copied credentials on closure.
- Timed heartbeat snapshots, no continuous log tailing. No promotion/installation into the user's active project while improvement is unknown. An improved candidate can be retained as a reviewable artifact; replacing the repository incumbent is a separate recorded decision after evidence review.

## Plan and acceptance

1. Freeze ten-case manifest, write experiment index and start paired-authority isolated host; execute full incumbent baseline.
2. Summarize official failures plus actual tool/Task evidence. Submit explicit optimization feedback through a real public Task using Luna and the production feedback-revision Tool; persist original Tool input/output and candidate provenance.
3. Materialize and validate that exact immutable candidate, then run all ten with the same Inspect settings. Re-score both arms independently and compute paired results without selecting attempts.
4. Review concrete changed instructions against evidence and compare quality/cost. Record achieved or unmet improvement, unverified full Lab integration, risks and remaining failures. Focused tests for any code change, document checks, scoped commit, fetch/merge, outgoing-set review and push. Stop owned services, verify credential cleanup and pause heartbeat.

## Progress

- Plan frozen before task-specific file or runtime changes. No model request has been made for this experiment yet.
- Manifest has ten validated official identities; added finance.late_fee_calculation/4030, sales.create_new_opportunity/9, operations.monday_slack_inventory/1210 and hr.probation_review_reminder/5019 to the prior six. This selection is fixed before scores.
- First owned host PID 25716 failed its real streamed credential preflight on 2026-09-24 at 04:07 UTC with `ProviderAuthOAuthExchangeUncertainError`; exact Luna catalog projection succeeded. No Provider model request was emitted and no benchmark Task started. Host stopped and both copied credential/catalog files were verified removed. User was asked to reconnect OpenAI because the source credential expired at 02:27 UTC; do not replay the uncertain refresh.

## Credential handoff defect: analysis before repair

The earlier host copied the complete OAuth credential store and let the production plugin refresh its copied OpenAI entry. Both previous isolated hosts record a consumed refresh from the same source generation to distinct new generations. The original source still has that old generation; successful isolated refresh outputs were removed on shutdown. The present copied generation returned exchange_uncertain. This proves forked refresh ownership and lost refreshed credentials; the remote refresh endpoint's precise rejection is unknown because the production flow intentionally records a generic uncertain result. Do not claim a proven remote error code.

Scope search found the shared `RealProviderAudit`, its six script consumers, native audit plugin, OpenAI `resolveOpenAICodexOAuthCredential`, `Auth` atomic generation updates and shared `ProviderOAuthFlowStore` refresh ownership. Same-data-root production refreshes already serialize and persist generations. This experiment introduced a separate data root with a copied authority, so production Task/Mission scheduling is not the observed failure and will not be changed. Other audit callers retain their existing behavior.

Repair the current Inspect host's copied authority: validate the copied OAuth access expiry before copying/starting; use the shared audit to enforce the expiry for every external request, so an expired copy cannot start its own refresh exchange. Copy only the authorized Provider entry plus the full matching model catalog. The original Provider remains the refresh owner. Preserve a typed `CopiedOAuthCredentialExpiredError`, zero-request audit and cleanup receipt on startup failure. Move credential provisioning inside cleanup protection and ensure cleanup runs even if server disposal fails. This is an access-expiry integrity boundary, not a model tool/workflow gate. Focused positive tests cover valid streamed evidence, exact expiry error and local control access; the real expired-source startup must reproduce the typed error without a benchmark result.

The protocol decision was checked against [RFC 9700 section 4.14.2](https://www.rfc-editor.org/rfc/rfc9700.html#section-4.14.2): rotating refresh responses replace the previous refresh token, and replay can invalidate active authorization. This supports keeping renewal in one authority; it does not establish the remote cause of this particular uncertain exchange.

## Current checkpoint

- Implemented copied-access expiry enforcement and cleanup protection in the existing host/audit; six focused tests pass (17 assertions). Other RealProviderAudit consumers keep their original constructor behavior.
- Real startup with the expired source now exits before credential provisioning with the explicit copied-access expiry error. Its saved audit contains zero model requests and cleanup succeeds. A Bun diagnostic about `--tsconfig-override` directory mismatch was resolved by starting Bun from `packages/opencorvus` without that override. A fresh isolated model-free import of all six production modules passed from that working directory, and the final expired-source startup records the exact error type/code with no Bun diagnostic. Runtime source and data establish the credential blocker independently.
- Baseline scored 0/10 (coverage **zero**, not a 0% capability score); candidate authoring has not started; candidate scored 0/10; improvement is **unmeasured**. No candidate has been installed, promoted or manually authored. Full Evolution Lab Campaign integration remains unverified.
- User input pending: reconnect OpenAI in the original OpenCorvus Provider connection, then provide or expose fresh unexpired authorization. Do not repeat the previous uncertain refresh or switch models. On resume verify fresh authority and start a new evidence subdirectory under the existing experiment, preserving both failed-start receipts.
- Documentation checks passed: `docs:check` (342 operations, 25 groups), architecture index (17 current documents), and `git diff --check`. The ten-case official manifest loader passed. These checks verify preparation and the tooling fix, not model capability or self-evolution.
