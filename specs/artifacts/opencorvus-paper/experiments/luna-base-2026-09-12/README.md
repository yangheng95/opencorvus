# Luna versus Luna + Base reproduction

Protocol: [dated record](../../../../records/2026-09/2026-09-12-luna-base-reproduction.md). Current operations: [runtime readiness and execution record](../../../../records/2026-09/2026-09-12-benchmark-runtime-readiness.md).

## Local results page

Open [the frozen 100-case comparison](http://localhost:8769/ui) on the experiment machine. Both model-execution arms were stopped at the user's request after the frozen `51b780ee715aba2d80e30eaf5a89bae1ed62f3cb` run exposed more infrastructure defects under `/var/lib/opencorvus-benchmark/reproduction-20260913-luna-base-100`; the read-only viewer remains available. [The launch receipt](current-source-full-100-launch.json) preserves the original plan and preflight, and [the freeze receipt](current-source-benchmark-freeze.json) records the exact stopped process boundary. No aggregate from this interrupted cohort is publishable.

[The selected-manifest audit](current-source-full-100-manifest-audit.json) confirms a catalog defect: the old checker binds cases 1–50 to a different 50-case manifest even when the run and plan agree on this selected 100-case manifest. After the coordinator stopped, the reviewed catalog was applied to its evidence root without a model request. Port 8769 now exposes 13 valid Base scores while keeping case 3 invalid, case 13 failed, cases 16–17 awaiting settlement and case 18 interrupted.

[The restricted-shell selection receipt](current-source-restricted-shell-selection.json) records the reviewed implementation boundary for the 100-case run: the coordinator accepts both frozen root-owned wrappers and selects the base wrapper for cases 1–50 and the extended wrapper for cases 51–100. Both installed wrappers passed real UID-bound isolation probes. The dual-path checker configuration passed the complete catalog/verifier against an isolated copy of the currently sealed case 1–6 evidence; this copy contains no case 51+ result, so the extended half is proven by the same selector contract and real wrapper probe rather than a model execution. This implementation has not been used for a model run.

[The batch-settlement audit](current-source-batch-settlement-audit.json) separates full slot settlement from per-run score eligibility. Its latest isolated copy covers 15 terminal Base attempts: 13 enter the leaderboard, case 3 remains invalid, and case 13 remains a measured infrastructure failure. All three immutable failed receipts derive `settled_from_failed_receipt`; no receipt or run is rewritten. The interim strict rate is 2/100 and partial mean is 0.083947 on the fixed final denominator, while coverage remains 15/100. The retained 8769 viewer has been checked against this corrected projection.

The stop audit found that the Base coordinator could pass admission, wait for authorization, receive SIGTERM, and still spawn a later case. A shared irreversible admission gate now rechecks immediately before process creation. Native execution also has a repository-owned batch coordinator and graceful single-run signal sealing; the ad hoc Python loop is retired from future formal runs. Current verification is zero-model only: 15 preserved Base terminals yield 13 eligible scores, one real invalid and one infrastructure failure under the corrected catalog/verifier, while failure cost remains measured. No execution resumes without a new explicit user instruction.

[The Base quality and cost root-cause audit](current-source-base-quality-root-cause.json) attributes all 696 official API events in the 13 scored Base cases to real Developer or Tester Tool intervals. The paired sample has a modest partial-score increase, but costs 6.36 times the elapsed time and 5.93 times the model interactions. The dominant amplification comes from mandatory generic report publication and rediscovery plus six repeated Developer/Tester repair loops; Tester performed only four business mutations, so widespread Tester state corruption is excluded. The accompanying immutable analyzer records 108 exact repeated API operations and leaves the sealed evidence unchanged.

Native case 2 ended unscored after a socket reset before a Provider response. [The continuation receipt](current-source-full-100-native-resume.json) records the historical ad hoc continuation of cases 3–100; that supervisor is now stopped after case 58 was interrupted. Cases 1 and 2 remain unchanged. Future formal execution uses the repository-owned native batch coordinator and signal-sealing single runner. The baseline still has zero Provider-request retries, and the original socket closure's cause remains unknown.

The [Skill loader installation receipt](current-source-skill-runtime-installation.json) records the complete installation update after independent review: Linux checks passed 14 tests and 239 assertions. The fix restores authorized scheduler Skill loading and preserves current Message/Session capability narrowing during reveal and reconstruction. It does not establish a business-score improvement or broad redundant-call reduction. The new viewer was inspected through the real page and an inline screenshot; previous viewers were left running.

## Completed diagnostic pilot

[The pilot viewer](http://localhost:8768/ui) retains the first-five executions under `/var/lib/opencorvus-benchmark/reproduction-20260913-current-source`, at execution revision `134d34336cdb19c90d96ac49640c0746556a3f0f`. Both arms have ended. The viewer retains Base's original invalid classifications; it does not replace them with the subsequent diagnostic audit. [Complete first-five diagnostic report](current-source-first-five-diagnostic.md) separates independently replayed business scores, current completion/condition audits, original eligibility and measured costs. [Pilot launch receipt](current-source-benchmark-launch.json) records source/bundle/manifest identity and parameters. Viewers expose only selected summary fields and do not serve raw files, prompts, logs or credentials.

The [full score and cost audit](current-source-first-five-score-cost-audit.json) verifies all 110 sealed Base files and five separate official checker replays. Diagnostic strict completion is 2/5, mean partial credit 0.820261; the already audited native arm is 1/5 and 0.749899. [Execution conditions](current-source-first-five-condition-audit.json) and [current runtime evidence checks](current-source-first-five-runtime-audits.json) pass for all five. The distinct explicit `skill`-Tool adherence metric remains 0/5 and is retained, with its direct-file-read limitation. Session Provider requests fell from 540 to 499 (7.59%); Task Tool calls from 737 to 414 (43.83%); standalone publishing selections from 48 to zero. Broad redundant-call reduction is not yet established.

After the coordinator exited and all leases cleared, the [runtime update](current-source-post-batch-runtime-update.json) moved the same installation to the complete reviewed 00ccc5e0 revision. Its real streamed recovery/checker integration (4 checks, 21 assertions) and 25 Python condition checks passed on Linux. Existing viewer files and processes are unchanged. No additional model call or batch was started.

[Current-source native first-five audit](current-source-native-first-five-audit.json): all five results passed a separate invocation of the official replay checker and exact case/model/source checks. Strict completion is 1/5; mean partial credit is 0.749899. There are 83 response steps and 169 tool calls, with a mean elapsed time of 121.727 seconds per case. These five exposed tasks do not establish a 100-case result or a paired advantage. Base's diagnostic scores and execution-condition audit are now complete as linked above; its original eligibility remains 0/5 and the requested broad redundant-call reduction remains unverified.

[Mission completion audit correction](current-source-completion-audit-correction.json): the first two Base executions reached real Task/Mission completion and quiescence, but the migrated benchmark checker still expected the removed `panel` wrapper. On the same captured public observations it missed the current `panel_complete_mission` receipts. The correction uses the production input/receipt schemas and the latest user occurrence; all existing identity checks remain. Four focused checks, including the full streamed Mission recovery through actual public routes into this checker, passed. This is completion-evidence verification, not a business-score pass. The installation remained at 134d until all five executions ended; the subsequent complete update is recorded above. Original evidence remains unchanged.

[First-four execution-condition audit](current-source-first-four-condition-audit.json): all four sealed Base cases contain the declared executor and independent verifier, with the verifier following the final executor occurrence. An inverted timestamp comparison had rejected the current production order of lineage → user input → worker descriptor. The corrected auditor also reads real `dispatch_agents` members with their exact outer Tool identity and member index/count, binds continuation receipts to the same lineage/final, and validates finite timestamp values. Twenty-five focused Python checks pass, and the real sealed first-four audit reports 4/4 conditions satisfied. Original `invalid` statuses and recorded metrics are retained; this is neither official score eligibility nor a full-five aggregate.

The historical viewers at [port 8765](http://localhost:8765/ui), [port 8766](http://localhost:8766/ui) and [port 8767](http://localhost:8767/ui) retain their original roots. The pilot viewer was launched with the following command; its files did not change during the subsequent installation updates and no viewer or page was restarted:

```bash
/var/lib/opencorvus-benchmark/evaluator-venv/bin/python -B \
  /var/lib/opencorvus-benchmark/opencorvus-runner/script/benchmark/reproduction_dashboard.py \
  --native-root /var/lib/opencorvus-benchmark/reproduction-20260913-current-source/native \
  --base-root /var/lib/opencorvus-benchmark/reproduction-20260913-current-source/base \
  --manifest /var/lib/opencorvus-benchmark/opencorvus-runner/specs/artifacts/opencorvus-paper/experiments/luna-base-2026-09-12/case-manifest.json \
  --port 8768
```

The viewer's backend projection tests run with `python -B -m unittest discover -s script/benchmark -p test_reproduction_dashboard.py`. Visual acceptance uses actual browser interaction and screenshots; no UI automation tests are used.

## Scheduler correction

The initial Base batch exposed a scheduler send deadlock: a Tool awaited the recipient drain, while the recipient could be waiting for that sender's Tool to finish. The failed attempt remains in its original evidence directory. The correction makes the durable enqueue receipt the send boundary for requests, replies and notifications; delivery and recovery stay with the existing inbox/drain owner.

[`scheduler-send-enqueue-receipt.patch`](scheduler-send-enqueue-receipt.patch) records the same correction and a positive busy-recipient regression test against frozen runtime `17bc3f63fc2ed0e2d4953e50811ee106882fd8fe`. The current paper branch carries its production correction directly in `src/protocol/scheduler-message.ts` and the Task materializer. The patch is a reproducible historical runtime delta, not a second production implementation. Apply it only to the exact clean frozen revision, after its active trials have ended. Corrected-runtime validation and experiment identity are recorded in the [protocol](../../../../records/2026-09/2026-09-12-luna-base-reproduction.md#base调度发送阻塞修复方案); old and corrected runtime results must be distinguished.

## Outcome-first correction and cost baseline

The [runtime correction](../../../../records/2026-09/2026-09-12-outcome-first-runtime-correction.md) changes the shared goal/delegation guidance, Base's ordinary workflow to executor → independent verifier, report transport, and the historical environment Skill's responsibility. These are jointly changed conditions; a retest cannot isolate the causal contribution of any one change.

`scheduler-fix-first-five-score-audit.json` independently checks all five e03f sealed cases, task/source identities, and the official replay checker: strict 1/5, partial scores 0, 0.5, 1, 0, and 0.81818; durations 33.00, 19.95, 21.53, 17.06, and 38.83 minutes. Internal acceptance and score validity do not imply business success.

`publication-overhead-baseline-first-five.json` measures 48 standalone publishing-session selections, 540 Provider requests, and 737 Tool calls from sealed inputs. `publication-overhead-baseline-first-two.json` preserves the preregistered initial two-case baseline of 17 removable selections; the corrected measurement produces the same 17. The metric keeps selections used by any other consumer, including failed consumers, and counts unused publishing-session selections. It measures a specific transport overhead, not all redundancy or overall speedup. Retests must report total calls, score, and elapsed time alongside this metric.

`outcome-first-runtime.patch` is the 268,627-byte historical-runtime delta against clean e03f; SHA-256 `fffaa66226690460734bc1bd6ccdafcc4d3e13cbb0140812b8b220f8a77185f1`. `outcome-first-runtime-receipt.json` records clean commit `3f9cb474b577f6e313492ed48b5b4bbf1bfa4f1f` and its tree. Apply it after the earlier scheduler correction, never during an active trial. New evidence is under `/var/lib/opencorvus-benchmark/reproduction-20260912-outcome-first/base`; the e03f evidence remains intact. Both Base and SquadSDK are version 2026.09.12.2.

```text
python -B -m unittest discover -s script/benchmark -p test_measure_publication_overhead.py
python -B script/benchmark/measure_publication_overhead.py --root <sealed-base-root> --cases 1,2,3,4,5 --runtime-commit <exact-commit> --output <new-measurement.json>
```

## Frozen sample

`case-manifest.json` contains the first 100 identities from the existing 600-case manifest, in its original order. SHA-256: `43ca54925db11d7dc6d9c5b80bbd32aed9b6c93ea92a2d1b8225a0858036ff42`. Before the first new case, the retained official dataset-index digest was added to the metadata; membership and order are unchanged.

| Domain | Tasks |
| --- | ---: |
| Marketing | 15 |
| Finance | 13 |
| Support | 15 |
| Sales | 20 |
| Operations | 21 |
| Human resources | 16 |

Both conditions use these exact identities. This is a historically exposed reproduction set, not an unseen test set. Selection did not filter by outcome. Task contracts and official package identity are checked before execution.

## Historical score recovery

`historical-score-audit.json` and `historical-score-cases.jsonl` are fresh read-only verification results for the local r3 evidence directory. All 102 catalog candidates passed sealed-file hashes, recorded run/model/profile identity, the official task contract, and the retained replay checker. The checked candidates span 15 OpenCorvus source revisions.

Of those candidates, 95 were members of the original completed-batch leaderboard; their 27 strict passes were recomputed. This 27/95 snapshot is distinct from the previously reported operator-confirmed 34/100 aggregate. The audit does not recover the missing identity of that exact historical aggregate, validate all runtime eligibility conditions, or create a native Luna baseline. Stateful tool effects are checked through the retained hash chain and final-world scoring, not by replaying each mutation.

`native-world-check.json` records an actual official `simple`-domain transport/scoring check with zero model calls. Its strict zero is an expected diagnostic result because the check only exercises base64 encoding and API search. Simple cases are excluded from the scored 100-case experiment.

## Historical initial execution checkpoint

After the user reauthenticated and authorized execution, `provider-preflight.json` recorded a real streaming connection to exact `openai/gpt-5.6-luna`. That initial native case completed: `native-case-001-receipt.json` records strict/partial score 1, official replay pass, 23 response steps, 46 tool calls and 133,417 ms. Every recorded request uses `gpt-5.6-luna`, with explicit medium reasoning. The receipt hashes all 11 raw evidence files and records credential-scan acceptance. This was a single-case chain validation, distinct from the current-source first-five cohort above. At that historical checkpoint, Base's first batch was still running with two concurrent slots; this paragraph does not describe the current execution status.

## Reproduce the historical preparation checks

The existing AutomationBench Python environment must match the pinned package-tree digest in the manifest. Materialize `automationbench_bridge.py` and `verify_automationbench_replay.py` from historical harness commit `17bc3f63fc2ed0e2d4953e50811ee106882fd8fe` into an explicit local directory. The audit receipt records the actual checker/bridge byte hashes; the first local export used PowerShell UTF-8 text output.

From repository root, with a fresh output directory:

```text
python -m unittest discover -s script/benchmark -p test_recover_automationbench.py
bun test ./script/benchmark/native-run-contract.test.ts
python script/benchmark/recover-automationbench.py --root <original-evidence-root> --harness <checker-directory> --harness-revision 17bc3f63fc2ed0e2d4953e50811ee106882fd8fe --output <new-audit-directory>
python script/benchmark/check-native-automationbench-world.py --harness <checker-directory> --output <new-check-directory>
bun build script/benchmark/run-native-automationbench.ts --target bun --packages external --outfile <scratch-output.js>
bun run docs:check
```

The native model runner's initial real path has passed the official checker on one case. The first-case evidence is undergoing independent review before expansion. Base launch and both arms' final receipts, actual settings and inference budgets must be verified before publishing a paired aggregate. The historical Base protocol uses its original 50-case manifest/shell for cases 1–50 and the extended manifest/shell for 51–100; both preserve the same case identities as the native 100-case manifest. The primary reasoning setting is medium; organization-specific helper settings and the native 50-step versus Base uncapped budget remain explicit differences.

## Runtime readiness correction

[stream-progress-observer.patch](stream-progress-observer.patch) and its [receipt](stream-progress-observer-receipt.json) freeze the owned Session activity observation correction at `470d129d`, relative to `3f9cb474`. The observer consumes the existing semantic monitor; polling and lease renewal do not renew the inactivity window. Zero-model processor integration and independent review passed. New benchmark admission remains paused: actual two-role condition verification is incomplete, and the original failed Provider stream cannot be reconstructed from retained evidence. See the [readiness record](../../../../records/2026-09/2026-09-12-benchmark-runtime-readiness.md).


[base-workflow-subject-clarification.patch](base-workflow-subject-clarification.patch) records the Base 2026.09.12.3 prompt clarification against runner 470d129d: use the declared Developer workflow node followed by independent Tester. Package projection checks passed; model adherence is still unverified and new benchmark admission remains paused. The public direct binding contract is unchanged.


## Outcome-first evidence revalidation

[Execution condition audit](outcome-first-execution-condition-audit.json) retains all five cases: only cases 2 and 4 satisfy the declared executor/verifier condition. Cases 1 and 5 used direct dispatch; case 3 failed. This is a condition-compliance metric with a fixed denominator, not a replacement score or a reason to discard failed cases. [Official score audit](outcome-first-score-audit.json) and [per-case results](outcome-first-score-cases.jsonl) independently recompute all four sealed scores: partial 0.8, 0.5, 0.631578947368421, 1.0 for cases 1, 2, 4, 5; case 5 is the only strict pass. The score utility retains its historical audit label; all four source revisions in this invocation are 3f9cb474 and no model was invoked.

Reproduce condition verification with `python script/benchmark/audit_execution_condition.py --root <outcome-first/base> --manifest <case-manifest.json> --cases 1,2,3,4,5 --runtime-commit 3f9cb474b577f6e313492ed48b5b4bbf1bfa4f1f --workflow execution-verification --executor base-developer --verifier base-tester --output <new-report.json>`. Official replay uses `recover-automationbench.py --root <outcome-first/base> --manifest <case-manifest.json> --harness <checker-directory> --harness-revision 84a0919412616bbd76213ee1715a7e8b8a54f5ac --output <new-audit-directory>`. Both commands preserve original evidence.

The controlled first-five diagnostic at [localhost:8767/ui](http://localhost:8767/ui), source84a09194/Base.3, batch3ab2a1e3-a714-4dad-90bc-e3547468d7f5, has ended. Cases 1, 2, 4 and 5 are invalid; case 3 remains a sealed candidate rather than an audited completed batch. Old 8765/8766 viewers retain their prior roots.

## Current-source recovery verification

The active implementation is now maintained in `packages/opencorvus/script/benchmark/external-agent` on this paper branch, importing the same checkout's production runtime. The old runner lacked the current dispatch replay protocol. Do not apply further selective runtime backports or launch the old readiness script. Both execution entry points now require an explicit `--case-set`; use this directory's fixed 100-case `case-manifest.json`. The retained 50-case file is a historical prefix reference used by the evidence catalog, not the selected experiment. Every new batch binds its runtime commit, harness digest and selected manifest digest; reuse only matches that exact identity.

From `packages/opencorvus`, the focused zero-model command is:

```text
bun test --timeout 120000 test/mission-streamed-recovery.test.ts test/session/processor-producer-boundary.test.ts test/benchmark/runtime-source-identity.test.ts test/storage/schema-contract.test.ts test/orchestrator-streamed-dispatch-settlement.test.ts test/session/processor-llm-activity-retry.test.ts
```

The 25 checks / 120 assertions passed. The single Mission scenario enters real streaming SDK execution, commits an operation, injects a socket error, preserves the unsafe-retry guard, opens the Mission acceptance gap, continues the same Developer Session, first starts an independent Tester, reads its real report and completes Task/Mission acceptance. Its runtime snapshot and ordinary isolated teardown also pass. Separate producer/consumer and cancellation checks cover execution before observation and cancellation during step preparation. This proves deterministic runtime recovery, not external Provider availability or an improvement in the official scores. The source migration also uses the shared finalized SQLite reader so snapshot connections release their statements before cleanup.

The real AutomationBench 1.0.6 bridge and official scorer replay passed without a model request. The condition auditor's 18 checks passed using the canonical initial lineage, each input occurrence and terminal settlement; it no longer requires the removed node-occurrence table. The old static report was visually inspected and omitted from the migrated runner because it hardcoded a 50-case display and historical public comparisons. The existing `script/benchmark/reproduction_dashboard.py` remains the comparison viewer. TLS origin, new controlled Provider execution, the requested call reduction and the 100-case comparison remain unverified.

[Installation and verification receipt](current-source-installation.json): implementation commit `b463c413437a0cdbf042885dc7c928344501cc46` is pushed and installed at `/var/lib/opencorvus-benchmark/opencorvus-runner`. The clean, inactive old installation is retained at `/var/lib/opencorvus-benchmark/retired/opencorvus-runner-84a09194`; existing evidence roots and viewers are unchanged. A fresh clone needs `bun install --frozen-lockfile` followed by the SDK's standard `bun run --cwd packages/sdk/js build`; the clean Linux checkout passed eight zero-model recovery/claim checks, including the complete Mission chain in 22.3 seconds, and the real official bridge/scorer replay. The new installation remained Git-clean after building and checking. No new model benchmark was launched.
