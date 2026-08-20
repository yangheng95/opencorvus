---
name: automationbench-experiment
description: Run reproducible OpenCorvus harness experiments against AutomationBench, preserve paper-grade evidence for every attempt, invalidate bug-affected runs, and maintain a self-owned leaderboard. Use for AutomationBench runs, reruns, score cataloging, token/performance comparisons, and trajectory evidence; do not use for raw-model benchmarks or WorkBuddy unless the user explicitly expands scope.
---

# Run an AutomationBench experiment

Treat OpenCorvus Base and Advanced as the evaluated multi-Agent harness, not as a model wrapper. Do not import the stock single-model runner's step budget: never cap Agent, model, tool, benchmark API, retry, or concurrent call counts for comparability. Record those quantities as efficiency and cost measurements.

## Freeze the experiment

- Keep benchmark work on the dedicated bench branch. Do not merge benchmark adapters, Skills, scores, specs, or evidence into the release branch.
- Round 1 is AutomationBench `1.0.6`, public `sales.multi_hop_lookup`, exact model `openai/gpt-5.6-luna`, and separate fresh-world Base and Advanced runs. WorkBuddy is out of scope until the user explicitly adds it.
- Before each run, require an isolated runtime containing both the source `auth.json` and `models.json`; verify the exact Provider/model reports `connected`. Never print or copy credential contents into evidence.
- A paper-result run must name the exact OpenCorvus commit and benchmark revision. Prefer a clean worktree; if development state is dirty, retain the attempt as development evidence rather than a final paper result.

## Preserve every attempt

Create a new timestamp-plus-UUID evidence directory before starting a run. Never reuse or overwrite a prior run directory. Preserve success, official zero, Provider failure, infrastructure failure, interruption, and invalidation alike.

Each directory must contain the available raw suite events, OpenCorvus trace, transcript, normalized trajectory data, rendered trajectory, result or failure record, complete token ledger/reconciliation, configuration identities, and a SHA-256 evidence manifest. An interrupted run still gets a failure record and manifest. Regenerate only derived catalogs; never rewrite a sealed per-run manifest.

## Bug rule

If any product, adapter, scorer, evidence, timeout, credential/model projection, or lifecycle bug is discovered during or after a run:

1. Mark every affected run `invalid_bug`. Keep it in the all-attempt evidence catalog, but exclude it from experiment tables, aggregates, rankings, and claims.
2. Stop launching experiment runs. Diagnose and fix the shared root cause first; add focused positive coverage and perform the repository-required independent read-only review.
3. Commit the product fix separately from benchmark work. Merge or cherry-pick only that fix commit into `v0.0.49beta`; do not move benchmark files or evidence there.
4. Bring the repaired release history back into the bench branch, then rerun from a fresh AutomationBench world and new evidence directory. Never relabel an old run as fixed.

An excessive call count, long duration while observable work continues, parallel Agents, repeated work, or a low official score is harness behavior—not a bug and not a reason to cancel. Use only true inactivity detection for a stuck run; do not impose a wall-clock deadline while work advances.

## Score and report

- Invoke AutomationBench's official scorer only after OpenCorvus reaches its natural terminal state.
- Only `completed` runs with official scorer output are leaderboard-eligible. Failed, cancelled, interrupted, operator-steered, dirty-source final candidates, and `invalid_bug` runs remain evidence only.
- Report strict `task_completed_correctly` as the primary score and `partial_credit` as diagnostic. Include input, text output, reasoning, cache read/write, total tokens, model calls, benchmark calls, Sessions, Agents, duration, and exact assertions.
- Write only OpenCorvus rows into the project's own leaderboard. Official private leaderboard rows are context only: a one-public-task run is never ranked or given a numeric delta against a held-out-suite percentage, and an absent Luna row stays explicitly absent.
- Render and visually inspect Base and Advanced trajectories. If labels or lanes are unreadable, fix the renderer and regenerate the derived view without changing raw run evidence.
