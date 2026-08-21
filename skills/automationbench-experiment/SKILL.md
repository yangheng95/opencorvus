---
name: automationbench-experiment
description: Run reproducible OpenCorvus harness experiments against AutomationBench, preserve paper-grade evidence for every attempt, invalidate bug-affected runs, and maintain a self-owned leaderboard. Use for AutomationBench runs, reruns, score cataloging, token/performance comparisons, and trajectory evidence; do not use for raw-model benchmarks or WorkBuddy unless the user explicitly expands scope.
---

# Run an AutomationBench experiment

Treat OpenCorvus Base and Advanced as the evaluated multi-Agent harness, not as a model wrapper. Do not import the stock single-model runner's step budget: never cap Agent, model, tool, benchmark API, retry, or concurrent call counts for comparability. Record those quantities as efficiency and cost measurements.

## Freeze the experiment

- Keep benchmark work on the dedicated bench branch. Do not merge benchmark adapters, Skills, scores, specs, or evidence into the release branch.
- Keep that branch in the dedicated `D:\myhexin-local\opencorvus-bench` worktree. Do not switch the main `opencorvus` worktree onto the benchmark branch.
- Round 1 is AutomationBench `1.0.6`, a committed deterministic set of 50 public cases, exact model `openai/gpt-5.6-luna`, and fresh-world Base then repaired Advanced runs for every case. Finish and verify all 50 Base trials before launching any further Advanced trial. Superseded Advanced exploratory rows remain invalid debug evidence. WorkBuddy is out of scope until the user explicitly adds it.
- Phase A schedules deterministic five-case Base-only batches. Start five Base trials together, seal the batch, and continue until Base is 50/50. Phase B then schedules Advanced-only batches over the same frozen cases. No more than five distinct cases are active. Give each trial its own process, UID, home, Unix tool socket, OpenCorvus runtime, AutomationBench world, project, and evidence directory.
- Before each run, require an isolated runtime containing both the source `auth.json` and `models.json`; verify the exact Provider/model reports `connected`. Never print or copy credential contents into evidence.
- Formal runs use WSL2 as an operational benchmark boundary, not as a hostile multi-tenant security proof. Keep evaluator, scorer, Provider data, control, and evidence roots owned by root with mode `0700`; run Agent Bash under the case UID with a private HOME, mount namespace, Windows mounts removed, and a UID-scoped Unix tool socket. The preflight must show that credentials/evaluator data are not readable and that the trial can use its own project/socket. Do not add stronger sandbox machinery unless an observed benchmark leak requires it.
- Fail closed unless the bridge proves the exact AutomationBench distribution version, installed package-tree hash, and official task-contract hash. Map out only the stock single-model turn-budget sentence; preserve the business contract and record the mapped request hash.
- The experimental Skill condition requires both projection evidence and a separately reported runtime-adherence outcome. Seeding `.opencorvus/skill/` does not project a Skill onto an Expert Squad's agents, and mounting it does not prove a sub-Agent loaded it: a projected agent sees its manifest grants plus explicit operator mounts and nothing else. Physical assignment is role-specific, not “every mountable Agent”: Base mounts `base-planner` for method-only planning and mounts `base-developer` plus `base-tester` for executable operations/readback; Advanced mounts only `implementation-engineer` and `test-engineer`. Before creating the Task, verify those exact owners are Skill-mountable and expose the `skill` Tool, mount only them, re-read the matrix, and fail closed on a missing/disabled required mount or any unexpected effective mount. Seal the required-owner list and matrix as run evidence and recompute the same audit in the checker; a self-declared `skill.enabled` is not a measurement. From the sealed transcript, measure for every mounted Agent Session that actually produces an assistant Message whether it shows a completed exact `skill({name:"automationbench-api"})` load, and whether every Bash command that really invokes `python3 automationbench_tool.py ...` follows that load in the same Agent Session. Search-only calls, failed loads, another Session, descriptions, documentation searches, or prose mentions do not count. The same transcript audit must account for every Agent that actually ran as mounted or as a declared non-owner/unmountable Agent. An uncovered Agent, missing Session identity, or receipt mismatch invalidates evidence; natural missing loads, client-before-load calls, and unmounted client use remain scored harness/model behavior with `runtime_adherence_passed=false` and never authorize a rerun. The scheduler is outside the mount matrix by construction. An `explore` Agent never receives a shell/client allocation; an Advanced Integrity Agent audits the settled executable Test evidence rather than pretending to call a client its runtime lacks.
- Project tools may contain only the trial's Unix socket path. Keep the scorer admin token host-only through an anonymous stdin pipe, never project files, process arguments, environment variables, prompts, or transcripts. Invalidate a run if its transcript touches protected evaluator paths, admin routes, scorer symbols, or dataset internals.
- A paper-result run must name the exact OpenCorvus commit and benchmark revision. Prefer a clean worktree; if development state is dirty, retain the attempt as development evidence rather than a final paper result.

## Preserve every attempt

Create a new timestamp-plus-UUID evidence directory before starting a run. Never reuse or overwrite a prior run directory. Preserve success, official zero, Provider failure, infrastructure failure, interruption, and invalidation alike.

Each directory must contain the available raw suite events, terminal board, Task create/binding receipt, OpenCorvus trace, transcript, normalized trajectory data, rendered trajectory, result or failure record, exact per-call Provider token ledger plus transcript reconciliation, the verified Skill mount matrix, a redacted relational snapshot of the isolated runtime's Task/Session/occurrence/usage rows, configuration identities, cleanup state, and an exact-file-set SHA-256 evidence manifest. The isolated runtime is deleted at the end of every trial, so any question that needs a join — which Agent occurrence produced an Artifact, and what that occurrence cost — is unanswerable later unless the snapshot was sealed before cleanup. An interrupted run still gets a failure record and manifest. An explicit natural `manage_task(fail_task)` without a structured `infrastructure_failure` is harness performance and must be scored from the final world (normally strict zero), not discarded. Regenerate only derived catalogs; never rewrite a sealed per-run manifest except for an explicit secret-redaction chain that retains prior manifest hashes and receipts.

Keep the last successful public board/transcript/trace/interactions observation during execution polling. A later failed or inactivity-stopped attempt must seal those partial artifacts and its recomputed Skill runtime-adherence receipt before cleanup; if no observation ever succeeded, seal typed `unavailable` rather than inferring non-adherence. Redact exact protected source-secret leaves from partial failure artifacts, keep the write create-only, and include every file in the ordinary evidence manifest. This preservation does not change timeout or score eligibility.

Before a batch starts, write its planned case/profile/repetition identities and a create-only run-start receipt for each trial. Enforce an evidence-root lease limiting active trials to five and a case lease preventing Base and Advanced for the same case from overlapping. Catalog orphan start receipts and signal-terminated attempts instead of silently omitting them.

Never rerun a profile/case/repetition slot that is already verified in the leaderboard, including a valid official strict-zero result. Build every recovery plan from the union of verified leaderboard rows and sealed failed-batch candidates, with the verified row authoritative for its slot. Only an invalid, unsealed, interrupted, or genuinely missing slot may launch a fresh attempt.

Write the operator view to the external standalone HTML path passed through `--dashboard`. Rewrite it atomically after every settled trial and after the batch catalog is sealed, so an ordinary browser refresh shows current verified, pending, and running Base/Advanced rows. Keep the page outside Git and evidence roots, do not expose secrets or protected paths, and do not create a Codex visualization artifact for this experiment.

## Bug rule

If any product, adapter, scorer, evidence, timeout, credential/model projection, or lifecycle bug is discovered during or after a run:

1. Mark every affected run `invalid_bug`. Keep it in the all-attempt evidence catalog, but exclude it from experiment tables, aggregates, rankings, and claims.
2. Stop launching experiment runs. Diagnose and fix the shared root cause first; add focused positive coverage and perform the repository-required independent read-only review.
3. Commit the framework fix separately from benchmark work. Merge or cherry-pick only that fix commit into `v0.0.50beta`; do not move benchmark files, dashboard code, Skill, spec, or evidence there.
4. Bring the repaired release history back into the bench branch, then rerun from a fresh AutomationBench world and new evidence directory. Never relabel an old run as fixed.

An excessive call count, long duration while observable work continues, parallel Agents, repeated work, or a low official score is harness behavior—not a bug and not a reason to cancel. Use only true inactivity detection for a stuck run; do not impose a wall-clock deadline while work advances.

## Execute

Run one deterministic five-case Base-only batch with the committed coordinator. Use a ten-minute inactivity window so a legitimate long streaming model call is not mistaken for a stuck trial:

```bash
apt-get update && apt-get install -y ripgrep nodejs
bun install --frozen-lockfile
bun run --cwd packages/sdk/js build
# The SDK build refreshes this generated tracked source while producing ignored dist/.
# Restore only this proven generated file so result source-state evidence stays clean.
git restore -- packages/sdk/js/src/route-policy.ts
test -z "$(git status --porcelain)"

bun packages/opencorvus/script/benchmark/external-agent/run-automationbench-batch.ts \
  --batch-index 1 \
  --python /var/lib/opencorvus-benchmark/evaluator-venv/bin/python \
  --source-data /var/lib/opencorvus-benchmark/provider-data \
  --restricted-shell /var/lib/opencorvus-benchmark/restricted-agent-shell \
  --output /var/lib/opencorvus-benchmark/evidence \
  --control-root /var/lib/opencorvus-benchmark/control \
  --profiles base \
  --dashboard /mnt/d/myhexin-local/opencorvus-benchmark-results/index.html \
  --inactivity-ms 600000
```

During Phase A, regenerate and verify with `--profiles base`; use final mode after Base reaches 50/50. Only after that phase is sealed may Phase B launch batches with `--profiles advanced`. Use `--profiles base,advanced` only for the final combined catalog/verifier after both 50-trial phases are complete.

## Score and report

- Invoke AutomationBench's official scorer only after OpenCorvus reaches its natural terminal state.
- Do not add Host business gates for benchmark-specific notions of sufficient evidence or fresh verification. After a Task becomes terminal, the benchmark runner waits until every recorded execution occurrence is terminal and detached ingress delivery settles, then re-reads the board, transcript, trace, and Provider ledger before scoring and sealing. An explicit natural `fail_task` counts only when that tool call actually completed; a rejected historical call is not terminal authority.
- The bridge must atomically seal the world, score it, and record attempted/succeeded/failed API counts in one terminal critical section. Independently verify the initial-to-final world hash chain, replay deterministic stateless tools, reload the sealed final world, and rerun the official rubric; require exact strict, partial, assertions, final-world hash, deterministic output hashes, and call-count agreement.
- Only natural terminal runs—`completed`, or an explicit `fail_task` with no structured infrastructure failure—with official scorer output, clean source, exact profile binding, passed evaluator-isolation audit, recomputable Provider ledger, and verified exact-set manifest are leaderboard-eligible. Cancelled, interrupted, infrastructure-affected, operator-steered, dirty-source final candidates, and `invalid_bug` runs remain evidence only.
- Report strict `task_completed_correctly` as the primary score and `partial_credit` as diagnostic. Include input, text output, reasoning, cache read/write, total tokens, model calls, benchmark calls, Sessions, Agents, duration, and exact assertions. Report the per-Agent token split from the ledger's own Session/Agent attribution rather than inferring it from transcript timestamps, which cannot separate concurrent workers.
- Write only OpenCorvus rows into the project's own leaderboard and compare Base with repaired Advanced across the paired frozen 50-case public matrix. Superseded Advanced rows remain invalid debug evidence. Official private leaderboard rows are a separate context table only: never compute a cross-dataset rank, slot, band, position, or numeric delta, and keep an absent Luna row explicitly absent.
- Render and visually inspect Base and repaired Advanced trajectories. Keep superseded Advanced trajectories as debug evidence only. If labels or lanes are unreadable, fix the renderer and regenerate the derived view without changing raw run evidence.
