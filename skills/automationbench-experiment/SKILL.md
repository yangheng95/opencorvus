---
name: automationbench-experiment
description: Run reproducible OpenCorvus harness experiments against AutomationBench, preserve paper-grade evidence for every attempt, invalidate bug-affected runs, and maintain a self-owned leaderboard. Use for AutomationBench runs, reruns, score cataloging, token/performance comparisons, and trajectory evidence; do not use for raw-model benchmarks or WorkBuddy unless the user explicitly expands scope.
---

# Run an AutomationBench experiment

Treat OpenCorvus Base and Advanced as the evaluated multi-Agent harness, not as a model wrapper. Do not import the stock single-model runner's step budget: never cap Agent, model, tool, benchmark API, retry, or concurrent call counts for comparability. Record those quantities as efficiency and cost measurements.

## Freeze the experiment

- Keep benchmark work on the dedicated bench branch. Do not merge benchmark adapters, Skills, scores, specs, or evidence into the release branch.
- Round 1 is AutomationBench `1.0.6`, a committed deterministic set of 50 public cases, exact model `openai/gpt-5.6-luna`, and paired fresh-world Base and Advanced runs for every case. WorkBuddy is out of scope until the user explicitly adds it.
- Schedule cases in deterministic batches of at most five. Each batch uses two crossover waves: odd case indexes run Base first and even indexes run Advanced first, then the opposite profile, so exactly 25 cases expose each profile to first-run conditions. Base and Advanced for the same case never overlap. Give each trial its own process, UID, home, Unix tool socket, OpenCorvus runtime, AutomationBench world, project, and evidence directory. Finish and seal the batch before starting the next one.
- Before each run, require an isolated runtime containing both the source `auth.json` and `models.json`; verify the exact Provider/model reports `connected`. Never print or copy credential contents into evidence.
- Formal runs use WSL2 as an operational benchmark boundary, not as a hostile multi-tenant security proof. Keep evaluator, scorer, Provider data, control, and evidence roots owned by root with mode `0700`; run Agent Bash under the case UID with a private HOME, mount namespace, Windows mounts removed, and a UID-scoped Unix tool socket. The preflight must show that credentials/evaluator data are not readable and that the trial can use its own project/socket. Do not add stronger sandbox machinery unless an observed benchmark leak requires it.
- Fail closed unless the bridge proves the exact AutomationBench distribution version, installed package-tree hash, and official task-contract hash. Map out only the stock single-model turn-budget sentence; preserve the business contract and record the mapped request hash.
- The experimental Skill counts as enabled only when the Host's own mount matrix says so. Seeding `.opencorvus/skill/` does not project a Skill onto an Expert Squad's agents: a projected agent sees its manifest grants plus explicit operator mounts and nothing else. Before creating the Task, mount the Skill on every projected agent the matrix reports as `skill_mountable` and `skill_tool_available`, re-read the matrix, and fail closed unless the Skill is `effective` and `enabled` for each of them. Seal that matrix as run evidence and recompute the audit in the checker; a self-declared `skill.enabled` is not a measurement. The scheduler is outside the mount matrix by construction and is never counted as covered. Agents on a runtime template that projects no `skill` Tool — `explore`, for instance — are recorded as unmountable rather than silently counted.
- Project tools may contain only the trial's Unix socket path. Keep the scorer admin token host-only through an anonymous stdin pipe, never project files, process arguments, environment variables, prompts, or transcripts. Invalidate a run if its transcript touches protected evaluator paths, admin routes, scorer symbols, or dataset internals.
- A paper-result run must name the exact OpenCorvus commit and benchmark revision. Prefer a clean worktree; if development state is dirty, retain the attempt as development evidence rather than a final paper result.

## Preserve every attempt

Create a new timestamp-plus-UUID evidence directory before starting a run. Never reuse or overwrite a prior run directory. Preserve success, official zero, Provider failure, infrastructure failure, interruption, and invalidation alike.

Each directory must contain the available raw suite events, terminal board, Task create/binding receipt, OpenCorvus trace, transcript, normalized trajectory data, rendered trajectory, result or failure record, exact per-call Provider token ledger plus transcript reconciliation, the verified Skill mount matrix, a redacted relational snapshot of the isolated runtime's Task/Session/occurrence/usage rows, configuration identities, cleanup state, and an exact-file-set SHA-256 evidence manifest. The isolated runtime is deleted at the end of every trial, so any question that needs a join — which Agent occurrence produced an Artifact, and what that occurrence cost — is unanswerable later unless the snapshot was sealed before cleanup. An interrupted run still gets a failure record and manifest. An explicit natural `manage_task(fail_task)` without a structured `infrastructure_failure` is harness performance and must be scored from the final world (normally strict zero), not discarded. Regenerate only derived catalogs; never rewrite a sealed per-run manifest except for an explicit secret-redaction chain that retains prior manifest hashes and receipts.

Before a batch starts, write its planned case/profile/repetition identities and a create-only run-start receipt for each trial. Enforce an evidence-root lease limiting active trials to five and a case lease preventing Base and Advanced for the same case from overlapping. Catalog orphan start receipts and signal-terminated attempts instead of silently omitting them.

## Bug rule

If any product, adapter, scorer, evidence, timeout, credential/model projection, or lifecycle bug is discovered during or after a run:

1. Mark every affected run `invalid_bug`. Keep it in the all-attempt evidence catalog, but exclude it from experiment tables, aggregates, rankings, and claims.
2. Stop launching experiment runs. Diagnose and fix the shared root cause first; add focused positive coverage and perform the repository-required independent read-only review.
3. Commit the product fix separately from benchmark work. Merge or cherry-pick only that fix commit into `v0.0.49beta`; do not move benchmark files or evidence there.
4. Bring the repaired release history back into the bench branch, then rerun from a fresh AutomationBench world and new evidence directory. Never relabel an old run as fixed.

An excessive call count, long duration while observable work continues, parallel Agents, repeated work, or a low official score is harness behavior—not a bug and not a reason to cancel. Use only true inactivity detection for a stuck run; do not impose a wall-clock deadline while work advances.

## Execute

Run one deterministic batch (five cases, then the opposite-profile wave) with the committed coordinator:

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
  --control-root /var/lib/opencorvus-benchmark/control
```

After a batch, regenerate the catalog with `catalog-automationbench-evidence.ts`. Before reporting, run `verify-automationbench-evidence.ts` with the same root/source/Python/shell arguments; add `--mode final` only after all 100 Base/Advanced trials exist.

## Score and report

- Invoke AutomationBench's official scorer only after OpenCorvus reaches its natural terminal state.
- Do not add Host business gates for benchmark-specific notions of sufficient evidence or fresh verification. After a Task becomes terminal, the benchmark runner waits until every recorded execution occurrence is terminal and detached ingress delivery settles, then re-reads the board, transcript, trace, and Provider ledger before scoring and sealing. An explicit natural `fail_task` counts only when that tool call actually completed; a rejected historical call is not terminal authority.
- The bridge must atomically seal the world, score it, and record attempted/succeeded/failed API counts in one terminal critical section. Independently verify the initial-to-final world hash chain, replay deterministic stateless tools, reload the sealed final world, and rerun the official rubric; require exact strict, partial, assertions, final-world hash, deterministic output hashes, and call-count agreement.
- Only natural terminal runs—`completed`, or an explicit `fail_task` with no structured infrastructure failure—with official scorer output, clean source, exact profile binding, passed evaluator-isolation audit, recomputable Provider ledger, and verified exact-set manifest are leaderboard-eligible. Cancelled, interrupted, infrastructure-affected, operator-steered, dirty-source final candidates, and `invalid_bug` runs remain evidence only.
- Report strict `task_completed_correctly` as the primary score and `partial_credit` as diagnostic. Include input, text output, reasoning, cache read/write, total tokens, model calls, benchmark calls, Sessions, Agents, duration, and exact assertions. Report the per-Agent token split from the ledger's own Session/Agent attribution rather than inferring it from transcript timestamps, which cannot separate concurrent workers.
- Write only OpenCorvus rows into the project's own leaderboard and rank Base versus Advanced on the paired 50-case public matrix. Official private leaderboard rows are a separate context table only: never compute a cross-dataset rank, slot, band, position, or numeric delta, and keep an absent Luna row explicitly absent.
- Render and visually inspect Base and Advanced trajectories. If labels or lanes are unreadable, fix the renderer and regenerate the derived view without changing raw run evidence.
