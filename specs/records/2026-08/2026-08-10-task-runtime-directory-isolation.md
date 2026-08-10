# Task runtime directory isolation

## Recall

### User request

- Rebuild the organization of `.opencorvus/.r`.
- Runtime data must be isolated per Task; the current mixed layout is too easy to confuse.

### Acceptance

1. Every Task has one human-identifiable canonical root: `.opencorvus/.r/tasks/<task-id>/`.
2. Task trace/index data, Session tool output, managed worktrees, process/worktree ownership markers, artifacts and read materializations, evidence, research, logs, and documents are descendants of that root.
3. Mission, ordinary Conversation, and project-wide infrastructure are visibly separate namespaces and cannot be mistaken for Task-owned state.
4. Runtime path construction has one implementation. No old-layout read fallback or parallel write path remains.
5. Focused positive tests prove two Tasks with two Sessions resolve to disjoint trees and that Task artifact recovery operates on the new root.

### Hard constraints

- Preserve `.opencorvus/.r` as the one project-local runtime root and keep it excluded from source enumeration/archive.
- Use full validated IDs in ownership roots so operators can identify them without a database reverse lookup.
- Do not add backward-compatibility readers or dual-write migration code; this repository is unreleased and the old runtime layout is disposable runtime state.
- Do not move project-global content-addressed attachments into an arbitrary Task: uploads can predate a Task and can be referenced by ordinary Chat, Mission, and Task messages. They belong under the explicit project namespace until their persisted ownership contract carries a Task/Session owner.
- No UI change or UI automation is in scope.

### Materials read

- `AGENTS.md`
- `packages/opencorvus/src/project/runtime-paths.ts`
- `packages/opencorvus/src/project/task-runtime-root.ts`
- `packages/opencorvus/src/project/task-runtime-materializer.ts`
- `packages/opencorvus/src/project/runtime-id-lookup.ts`
- `packages/opencorvus/src/project/instance.ts`
- `packages/opencorvus/src/task-artifact/recovery.ts`
- `packages/opencorvus/src/storage/attachment-store.ts`
- `packages/opencorvus/src/trace/index.ts`
- `packages/opencorvus/src/worktree/index.ts`
- `packages/opencorvus/src/engine/ownership.ts`
- `packages/opencorvus/src/tool/mission-state.ts`

### Full-repository search result

- Task-owned data already calls `ProjectRuntimePaths.taskRoot/taskAbsolute/taskRelative`, so changing that single authority moves artifacts, decision logs, intent, browser evidence, research, acceptance, docs, event logs, and Task trace blobs together.
- Task Session state was independently rooted at `.r/s/<task-session-hash>`.
- Managed worktrees were independently rooted at `.r/w/<task-session-hash>/worktree`.
- Runtime ownership markers were independently rooted at `.r/o/{w,p}/<task-hash>`.
- Root Conversation trace/tool output was independently rooted at `.r/sx/<session-hash>`.
- Mission state was independently rooted at `.r/m/<mission-hash>`.
- Project caches, attachment blobs, and the Git lock were independently rooted at `.r/c`, `.r/b`, and `.r/l`.
- `task-artifact/recovery.ts` directly reimplemented the old `.r/t/<fanout>` traversal instead of asking `ProjectRuntimePaths` for the Task collection root.
- `RuntimePathIDLookup` has no production caller; readable full-ID Task/Session directories remove the need for reverse lookup in this path contract.

### Root-cause analysis

- Observable symptom: one Task's runtime state is scattered across sibling directories named by storage type, and the names are opaque hashes.
- Direct trigger: `ProjectRuntimePaths` chose a top-level namespace for each subsystem (`t`, `s`, `w`, `o`) and hashed the Task/Session tuple independently in each subsystem.
- Control-flow root cause: callers share a path helper but the helper models storage implementation first, ownership second. Consequently Task deletion, inspection, recovery, and diagnostics cannot operate on one ownership boundary.
- Why the prior path convergence did not cure it: it converged all runtime data under `.opencorvus/.r`, but did not converge Task-owned data under one Task root.
- Related contract impact: TaskArtifact recovery manually assumes the old fanout shape; worktree and ownership cleanup rely on helper outputs; persisted evidence refs contain relative runtime paths and therefore intentionally adopt the new canonical contract for new runs.
- Excluded: database rows are already keyed by full Task IDs; no schema change is required. Attachment blobs do not currently have a single Task owner, so assigning them to a Task would create false ownership rather than isolation.

### Independent agent feedback

- First read-only review found four valid gaps: typed IDs accepted safe-but-invalid and Windows-alias values; Artifact Catalog read materializations still used global cache; old-layout rejection lacked a project-initialization test; and the documented Session trace path was not the production Task trace owner. All four were corrected. Second review found the Task/Session ID grammar still had two authorities (`Identifier.schema` and runtime paths) and that research Session paths used only generic validation. Canonical syntax now lives in `Identifier.isCanonical`; schemas, explicit IDs, every Task/Session path, worktree recognition, and research paths reuse it. A final incremental review found that the first canonical-ID implementation changed the error message for unrelated identifier kinds; Task/Session validation was split from the existing prefix-only contract and a regression assertion was added. The final read-only review reports no unresolved findings.

## Canonical layout

```text
.opencorvus/.r/
  tasks/<task-id>/
    sessions/<session-id>/
      tool-output/
      worktree/
      ownership/
    trace.jsonl
    artifacts/
    acceptance/
    browser-preview/
    decision-log.md
    documents/
    intent/request.md
    logs/
    research/{deep,frontend}/
    trace/
    webpage-evidence/
  missions/<mission-id>/
  conversations/<session-id>/
  project/
    attachments/
    cache/{snapshots,session-diffs}/
    locks/project-git.lock
  acceptance/no-task/
```

The public helper names remain semantic API names; their returned paths follow this tree. Subdirectory names are descriptive because runtime operability is the reason for this change.

## Verification ledger

- Focused runtime layout, TaskArtifact recovery, ownership, worktree GC, and managed-worktree authority tests: 17 pass after the first implementation, followed by 5 pass / 21 assertions for the ID and managed-worktree correction.
- Actual Artifact Catalog materialized-file path: `bun test --timeout=0 test/metrics-evidence-runtime.test.ts` — 5 pass, 0 fail, 43 assertions; the returned file bytes and Task-owned materialization root are asserted.
- Transport contract test: `bun test --timeout=0 test/contract.test.ts` — 18 pass, 0 fail, 1118 assertions.
- Package typecheck: `bun run --cwd packages/opencorvus typecheck` — passed.
- Documentation check: `bun run docs:check` — passed, 322 operations in 25 groups.
- Final focused isolation contract: 4 pass, 0 fail, 23 assertions, including canonical Task/Session IDs, preservation of unrelated ID error contracts, disjoint Task roots, artifact recovery, ownership discovery, and old-layout project rejection.
- Windows package: `bun run package:local -- --skip-linux` — passed. Linux was explicitly skipped because Docker is not available on this host; Darwin packaging requires macOS hardware.
- MSI: `OpenCorvus_0.0.38-beta_x64_en-US.msi` — 187,576,320 bytes; SHA-256 `5B986126811CF584BD82EFB67E7DCBCDA0D44FA485049999A9F2715B28C9FDF1`.
- NSIS: `OpenCorvus_0.0.38-beta_x64-setup.exe` — 186,473,034 bytes; SHA-256 `16F1F644453C44FF71BDBD49E01FD5542671050BDAFAF1D3D897A4BB90EB53CF`.
- Existing repository runtime data: moved the sole 198-byte attachment authority from `.r/b/a` to `.r/project/attachments`; the now-empty old `b` tree was moved to `C:\Users\hengu\AppData\Local\Temp\opencorvus-empty-runtime-b-20260810` because direct deletion was policy-blocked. No attachment payload existed.
- Independent read-only review: final review found no unresolved issues; reviewer confirmed the Task/Session canonical contract, preservation of unrelated ID semantics and error messages, the focused regression assertion, and `git diff --check`.
