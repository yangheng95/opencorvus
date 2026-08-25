---
name: workbuddybench-experiment
description: Run reproducible OpenCorvus Mission/Base experiments against Tencent WorkBuddy Bench, require the runtime Code Skill, preserve official Harbor grading and paper evidence, and exclude bug-affected attempts. Use for WorkBuddy Bench setup, chain proofs, runs, recovery, score cataloging, token comparisons, and trajectories; do not use for AutomationBench or raw-model runs.
---

# Run a WorkBuddy Bench experiment

Evaluate OpenCorvus as the multi-Agent harness. Never replace it with a stock raw-model harness or impose another harness's model, Agent, Tool, retry, or call-count limit.

## Freeze the round

- Keep benchmark adapters, Skills, configs, specs, and results on `codex/automation-workbuddy-benchmark` in `D:\myhexin-local\opencorvus-bench`. Keep the main worktree unchanged.
- Pin the official `Tencent/workbuddy-bench` checkout and checksum-verified dataset outside Git. The initial round is the Code v1.0 subset: 80 tasks, exact model `openai/gpt-5.6-luna`, Mission intake, held Base Expert Squad, and official composite verifier.
- Use an isolated WorkBuddy evidence root, control root, results root, and external ten-second-refresh dashboard. Do not share AutomationBench worlds, candidates, locks, processes, catalogs, or pages.
- First run one development chain-proof task with one attempt. It is not part of the formal aggregate. After the chain proof, require explicit operator confirmation before the real cost-bearing run. The formal job uses the upstream Code configuration, including its declared attempt count, unless the operator records a different experiment.
- Docker sandboxing is an official prerequisite. Do not start or restart Docker Desktop without explicit authorization. Never weaken the official task image, verifier, tests, network policy, or workspace layout to work around an unavailable daemon.

## Require the runtime Skill

- Every formal trial seeds the answer-free project Skill named `workbuddybench-code` and mounts it onto exact Base owners `orchestrator`, `base-planner`, `base-developer`, and `base-tester`. Use the Base `planner-execution-verification` workflow; do not dispatch the non-command Base Researcher for a trial that requires the Skill and repository mutation.
- Before Mission wake, re-read the Skill mount matrix and fail closed unless every required owner is mountable, has the `skill` Tool, and receives the exact mount with no unexpected effective owner.
- Mounting is not loading. From the sealed transcript, require every mounted owner Session that actually emits an assistant Message to contain a completed exact `skill({name:"workbuddybench-code"})` outcome before its first owner-specific material action: Orchestrator workflow selection, dispatch, continuation, or terminal decision; Planner repository/command discovery or plan publication; Developer repository read/edit/command or report publication; Tester repository read/check or acceptance publication. A missing/failed load or action-before-load is runtime non-adherence and cannot be described as a Skill experiment success.
- The Skill contains method and isolation boundaries only. It never includes task identities, hidden tests, scorer behavior, reference patches, issue/commit lookup hints, expected files, or expected answers.

## Preserve official execution

- Run every task in its official Harbor Docker sandbox. Treat `/workspace` as the only mutable task repository. Keep task metadata, verifier files, reference solutions, other trial workspaces, credentials, and benchmark control state outside Agent authority.
- Launch through a real OpenCorvus Mission with product pillar `code`, exact Luna model, and held Base Squad. Score only the resulting workspace through WorkBuddy Bench's official verifier after Mission and every child Task reach physical terminal quiescence.
- Preserve upstream task selection, task image, instruction, timeout, diff capture, and score fields. A low or zero official score is harness performance, not a retry reason.
- Use one isolated OpenCorvus runtime per trial. Provider auth and model catalog remain outside the task workspace and are projected without printing their values. Record the exact WorkBuddy commit, dataset checksums, OpenCorvus commit, model, profile, workflow, runtime Skill digest, container image identities, job manifest, and reproduction command.

## Evidence and recovery

- Every attempt gets a new immutable run directory. Preserve WorkBuddy config/result, official verifier output, patch/diff, Agent Type Interface Format trajectory, OpenCorvus Mission/Task/Session transcript and trace, exact Provider usage ledger, per-Agent token totals, duration, Skill mount/load audit, container lifecycle, source-state receipt, and an exact-file-set SHA-256 manifest.
- Keep the last successful public observation on failure. Never overwrite an attempt. Derived catalogs and dashboards may be regenerated atomically from sealed evidence.
- Never rerun a verified task/attempt slot, including official zero. Reuse verified rows first and clean sealed candidates second. Only an invalid, interrupted, unsealed, or genuinely missing slot may run again.
- On a product, adapter, scorer, Skill, isolation, credential/model, timeout, Docker lifecycle, or evidence bug: retain and mark the attempt `invalid_bug`, stop new trials, diagnose and repair the shared root, add focused positive coverage, obtain an uninvolved read-only review, commit and push, then rerun only missing slots.

## Report

- Code score is reported only with the official Code rubric. Do not average it numerically with Web, Office, Security, or AutomationBench.
- Report score distribution and pass rate together with input/output/reasoning/cache/total tokens, model calls, Sessions, Agents, duration, cost coverage, retry/error classes, and trajectory evidence.
- Public leaderboard rows are context from pinned harness builds. Do not claim an official submission or compare unlike harness, attempt, subset, or judge configurations as one rank.
