# Full-worktree batched delivery

## Recall

- User request: commit and push every current repository change in reviewable batches.
- Acceptance:
  - every dirty file is assigned to exactly one logical commit;
  - code batches have focused positive tests through the repository's official isolated test runner;
  - repository type, route, documentation and secret checks pass;
  - an uninvolved agent reviews the complete final diff and evidence;
  - each batch is pushed without rebase or force, and the final branch equals its upstream.
- Hard constraints: preserve the semantics and authorship boundaries of the existing work; do not mix unrelated changes in one commit; do not run User Interface automation; do not use real Provider credentials; do not create a branch, tag, Release or pull request.
- Materials read:
  - the complete worktree status and diff;
  - `2026-08-15-permission-continuation-recovery-fault-isolation.md`;
  - `2026-08-14-v0.0.44-beta-release.md`;
  - the Project deletion, schema DDL/contract, Permission authority, Session recovery and affected test implementations.
- Repository search:
  - Permission recovery changes form one contract across `PermissionAuthority`, `Instance`, `Session`, `SessionLoop`, their focused test and existing incident record;
  - Project deletion and trigger reconciliation form a separate storage/lifecycle contract, but the worktree initially had no positive test for replacing a stale trigger definition on an existing database;
  - `.gitattributes` only classifies PDF and Office artifacts as binary and is independent from runtime code;
  - the release record only appends already-completed deployment evidence and is independent from all code batches.
  - official Project deletion verification exposed stale Task fixtures with no lifecycle facts and two contextless deletion paths that tried to publish through a nonexistent live Instance; fixtures now write current lifecycle facts, durable Task deletion publication takes explicit Project ownership, and the ephemeral Session deletion projection is delivered only to an already-retained runtime while the durable `session.deleted` Protocol fact remains authoritative.
- Independent agent feedback: none at planning time; final read-only review is mandatory before committing.

## Delivery batches

1. **Permission continuation recovery fault isolation** — retire determinate terminal continuations, isolate transient recovery faults, scope recovery to the admitted Project, keep bootstrap best-effort, and project permission-bearing Tool output from the durable receipt.
2. **Project deletion, publication ownership and schema-trigger convergence** — delete the Task subtree before the Project cascade, let immutable Permission evidence yield to Project deletion, publish deletion boundaries from durable Project authority when no live Instance exists, mechanically reconcile derived trigger definitions on existing current-schema databases, and prove deletion, missing-repository publication and stale-trigger upgrade contracts.
3. **Repository binary attributes** — classify PDF and legacy/current Microsoft Office artifact formats as binary.
4. **Release evidence** — append the completed v0.0.44 website deployment and public verification facts.
5. **Task-root parallel-decision lock convergence** — treat sibling `dispatch_agent` receipts from one assistant Turn as one atomic scheduler decision set, release the FIFO, and project current Task-aggregate lifecycle state plus read-time Session routing identity. This batch was added after the user supplied the frozen Task evidence and explicitly requested the lock root fix.
6. **Delivery record and indexes** — publish this batch map and final verification evidence without folding it into a runtime commit.

## Verification plan

- Official isolated focused suites:
  - `test/permission-continuation-recovery.test.ts`;
  - `test/project-directory-and-worktree-gc.test.ts`;
  - `test/storage/schema-contract.test.ts`.
- Package typecheck and repository `docs:check` before review.
- Independent read-only review of every dirty/staged file, logical grouping, positive tests, specs and residual status; repair and repeat review until no findings remain.
- Before each push: pull/merge upstream, inspect the complete `upstream..HEAD` set, run the checks appropriate to that batch, and push normally.

## Verification evidence

- Permission continuation recovery: 5 passed, 0 failed through the official isolated runner.
- Project directory deletion and Worktree garbage collection: 47 passed, 0 failed through the official isolated runner. The first run exposed obsolete Task fixtures and contextless deletion publication; both root causes were repaired before the green rerun.
- Current schema, stale-trigger reconciliation and structural-drift guarding: 9 passed, 0 failed after independent review required trigger reconciliation to defer until every non-trigger schema object matches and the structural-drift assertion was corrected to avoid depending on schema enumeration order.
- Task-root lock convergence: reducer 10/10, fact persistence 3/3, FIFO reconciliation 3/3, active operator/cancellation 2/2, delegated-worker authority 1/1, process recovery 1/1, cancellation protocol 1/1, Mission duplex 2/2, multi-project ownership 4/4, and Task execution/transport projection 1/1 through the official isolated runner.
- `packages/opencorvus` typecheck: passed.
- Repository `docs:check`: passed (`332` operations, `25` groups).
- Independent review found that trigger reconciliation ran before structural schema validation and could replace the standard reset-required error with a raw SQLite missing-table error. The reconciler now leaves partial/non-current structural schemas untouched for `findSchemaDrift`; final schema review confirmed no unresolved finding.
- The Task-root lock batch received a separate uninvolved read-only review because it was implemented after the original full-worktree review. The first pass found duplicate and occurrence-inexact lifecycle read projection; the shared exact-occurrence Protocol projector, durable-payload check, reused-Session check and worker-missing error contract closed it, and repeat review reported no unresolved finding.

## Delivery result

- `86fbe0bc fix(permission): isolate continuation recovery faults` pushed to `origin/v0.0.44beta`.
- `78888e40 fix(storage): converge project deletion and schema triggers` pushed to `origin/v0.0.44beta`.
- `fcdfe1c3 chore(git): classify binary office artifacts` pushed to `origin/v0.0.44beta`.
- `da2d60f4 docs(release): record v0.0.44 deployment evidence` pushed to `origin/v0.0.44beta`.
- `698bb0bb fix(orchestrator): converge parallel decision ingress` pushed to `origin/v0.0.44beta`.
- Every push first pulled and merged the current upstream, inspected `origin/v0.0.44beta..HEAD`, and passed the repository push hook: full monorepo typecheck, route inventory, docs check and secret scan. No rebase, force push, tag, Release or pull request was used.
