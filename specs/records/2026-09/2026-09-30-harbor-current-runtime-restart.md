# Harbor full comparison on the current runtime

## Recall

- Latest user instruction: “按照新版本重启全部实验”, after the current implementation was merged and pushed to main. Execute the previously confirmed complete ten-case Task/Mission × static/evolved comparison (40 fresh episodes) on the new runtime. No further confirmation is required for this scope.
- Starting source: clean main `a0a879ed759f980e6d72c9df7a10b51bb2d8f1a2`, package version 0.1.21. This is a local benchmark build from that commit, not a new public release or an assertion that an existing 0.1.21 download contains this commit.
- Previous formal root `.tmp/harbor-factorial-20260929-protocol` has 40/40 completed trials, no infrastructure exceptions and an actual launcher exit 0. Preserve all historical results and incomplete independent-review work. Never restart old jobs, edit their worlds/scores or count them as this run.
- New root: `.tmp/harbor-factorial-20260930`. Reuse official Harbor 0.23.0 and pinned AutomationBench `4a8e1061254004d9dac807054eed33fad7d1ff14`, the exact original ten cases, S0/E1 packages, model and scoring. No candidate author or package edit.
- Read: root AGENTS, benchmark-debug-template skill, prior comparison Recall/registration, implementation record, Harbor installed Agent/helper/exporter/bundle tools and actual installed Harbor Job/TrialQueue. No delegation.

## Scope and interpretive boundary

This is a new-runtime replication of the complete registered four-arm comparison. Static S0 is `builtin/automationbench` 2026.09.25.14 / package `b4c645f4a90c002e83842c46d56afbb1563ee24f7a9cb215f2488a1d9d379f93`; evolved E1 is the already accepted first production candidate 2026.09.29.1 / `6578b9c1632ac506421c6c67ecaa526eead3df087e58eb30d8b83540c5718388`, Artifact `art_hUAinND12WrH5lg1lDFj` revision 3. Both stay byte-identical to their frozen directories.

These packages retain their declared executor/verifier graph. They exercise current shared runtime/Core, but are not a direct experiment on Base's new single-owner package topology. Cross-run differences include all intervening runtime changes; do not attribute a score/time difference solely to the Base redesign or call it general evolution benefit.

The Base-specific adapter problems observed during preparation (a Mission instruction also passed to Task, and a source-planned default workflow) are outside this chosen AutomationBench-profile path. Do not patch unrelated Base behavior merely to start this matrix. Its separate causal experiment remains a different registration.

## Shared execution and environment analysis

The old outer launcher waits for all four arms of a case before admitting the next case. Measured empty-slot time was 28% for the first five blocks. Installed Harbor `Job._init_trial_configs` already forms task × agent trials and `TrialQueue` immediately refills a free permit. Use one native job with all ten tasks and four Agent configurations; remove the outer block barrier for this fresh run, without modifying Harbor or adding another queue. Preserve case order; the native per-case agent order is TS, TE, MS, ME for this registration (the prior rotating block order remains historical). Retain actual start/end times and do not mistake this harness scheduling improvement for model efficiency.

Build the complete current Linux runtime through the repository's native packaging tool in a new owned Docker builder from a Git archive of the exact starting commit. Preserve the existing `opencorvus-harbor-build` and buildkit containers. The builder has no model credentials; source Git metadata is mounted read-only, package outputs go only to the new run root. Reuse the existing bundle assembler and mounted official transport/Skill files.

Before formal inference: validate the native configuration, all original instruction/clock pairs, exact forty unique slots and S0/E1 identities; run existing focused adapter checks and a real Harbor install-only qualification. Verify the built binary version and source receipt, actual package import/tool projection and isolation. Use the existing paired private auth/models upload and exact streaming `openai/gpt-5.6-luna` connectivity preflight; all preflight calls count in usage. Never print credentials, full Provider requests or encrypted reasoning.

## Frozen protocol and acceptance

- Four arms: TS Task/static, TE Task/evolved, MS Mission/static, ME Mission/evolved. Same ten example identities in the previous `matrix-tasks.json`; each slot runs once in its own official world.
- Parallelism 4, attempts 1, Harbor retries 0. Actual inactivity 300 seconds, polling 2 seconds; no new monetary, call-count or absolute Agent wall-time budget. Keep official supplied clocks exact; missing clocks remain unspecified.
- Task uses the real Task endpoint; Mission creates one initial business Task and repairs that same Task. Model deviations remain observations, not host routing patches or supplied answers.
- Official strict/partial scores remain the sole official outcome. Native completed/failed/accepted/blocked is separately recorded. Infrastructure exceptions remain unscored. Ordinary quality failures continue through the native queue; a demonstrated common invalidating infrastructure fault requires evidence review before more work.
- Completion requires all forty native terminals, official/native results and null reasons, actual job/launcher exit, exact-model/usage/activity/attempt evidence, full historical and new costs with unknown external billing explicit, owned process/container/credential cleanup, paired effects and interaction, acceptance confusion matrices, and independent original-source/tool review. Starting or finishing model execution alone is not full analytical acceptance.
- Observe through a five-minute thread heartbeat after real launch, quiet when unchanged. Never create duplicate launches, poll old PIDs or resume old Opus/Inspect tasks. User questions take priority.

## State

Preparation only. No new real model call or formal slot has started. Runtime build, qualification, immutable registration, scoped commit/push and launch remain pending.

## Preparation evidence and build failure

Thirty existing adapter unittest contracts passed. An initial invocation assumed pytest was installed; it was not, so the repository's unittest cases were run with Python's standard unittest discovery and passed. No dependency or production code was changed for that command error. Native Harbor configuration validates one job, ten tasks, four agents, attempts one and retries zero; all forty slots are unique. The one hundred copied official task/environment/verifier files match the prior frozen inputs exactly. Derived collectors were adapted only to identify slots by native task path instead of the former job block; all forty correctly remain pending.

Builder attempt 1 exited 1 at native payload assembly because the fresh Linux build environment omitted required host ripgrep. Attempt 2 installed it as the repository workflow requires. Compilation and runtime payload assembly then succeeded, but the existing credential-free `check-packaged-first-run.ts` returned HTTP 500 from `/global/work` instead of 201. This is a preparation failure, not an official business score or a proven model issue. The detailed native runtime evidence was inside the automatically removed builder; the original CLI error log remains. Attempt 3 therefore retains its owned builder and copies the exact first-run evidence out on exit before any further diagnosis. No timeout or acceptance check is relaxed.

Current builder: `oc-harbor-runtime-20260930-r3`, waiting handle exec23300; receipts `build-r3-launch.json`, `build-r3-exit.json`, `build-runtime-r3.log`, and `build-output/r3-diagnostics/`. It uses the same a0a879ed source archive and the existing authorized worktree's read-only Git metadata, pinned to that commit. Concurrent main checkpoint 04233433 and unrelated overlay work are preserved; they do not change this frozen build. The builder has no model credentials. Neither a formal Harbor job nor a Provider request has started. Diagnose the exact native error before qualification or launch; do not rerun a builder that is still active.
