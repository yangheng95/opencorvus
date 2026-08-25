---
name: workbuddybench-code
description: Deliver a repository change inside an official WorkBuddy Bench Code trial. Use only when the Task request explicitly identifies the current workspace as a WorkBuddy Bench Code sandbox.
---

# WorkBuddy Bench Code delivery

The official verifier grades the final repository state. Narration without the correct workspace change does not complete the Task.

## Authority and isolation

- Treat `/workspace` as the only mutable task repository. Work only from the user instruction and repository evidence available there.
- Do not inspect benchmark task metadata, verifier or test internals outside the workspace, reference solutions, scorer code, other trials, `/logs`, Host credentials, model configuration, or benchmark control files. Do not search the web for the originating issue, pull request, commit, or solution.
- Do not ask the operator questions. Resolve reversible ambiguity from the instruction, current code, public interfaces, and executable repository evidence; state a concrete blocker only when the requested repository change cannot be determined safely.
- Preserve the existing Git worktree. Do not reset, clean, rewrite history, or commit. The benchmark captures the final diff.

## Method

1. Read the instruction exactly. Inspect repository guidance, status, relevant definitions, callers, tests, and current behavior before changing files.
2. Build a bounded acceptance inventory: required behavior, affected interfaces and data flow, expected observable outputs, compatibility boundaries explicitly required by the repository, and focused executable checks.
3. Plan one root-cause repair. Avoid task-name branches, hidden-test guessing, fallback implementations, parallel sources of truth, unrelated cleanup, and broad rewrites not required by the task.
4. Change only the necessary workspace files. Reuse repository primitives and preserve public contracts not selected for change.
5. Run the narrowest meaningful positive checks first. Add or update tests when the requested behavior needs repository coverage, then run proportionate type/lint/build checks that the repository actually declares. Never treat static text matching as end-to-end proof.
6. Inspect the final diff and status. Verify every requested effect is present, no unintended file changed, and test output supports the acceptance inventory.

## Base ownership

- Planner, Developer, Tester, and Orchestrator must load this Skill before their first owner-specific material action. Orchestrator loads before workflow selection, dispatch, continuation, or terminal decision; Planner before repository/command discovery or plan publication; Developer before repository read/edit/command or report publication; Tester before repository read/check or acceptance publication.
- Planner is read-only and publishes the complete repository plan and acceptance criteria. Developer owns edits and implementation checks. Tester independently re-derives acceptance from the original instruction and final repository state; it does not accept the plan or development report as truth. Orchestrator completes only after the selected Base workflow and settled verification agree with the actual diff and checks.
- Repository state and executable results are the delivery. Final messages summarize evidence and blockers; they are not a substitute for files or tests.
