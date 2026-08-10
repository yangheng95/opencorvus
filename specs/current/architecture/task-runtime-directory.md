# Task runtime directory architecture

## Ownership rule

`.opencorvus/.r` is the project-local runtime root. Ownership, rather than storage type, determines its first path segment.

Every Task owns exactly one readable directory:

```text
.opencorvus/.r/tasks/<full-task-id>/
```

All runtime files whose lifecycle is controlled by that Task must be descendants of this directory. A Task Session is the next ownership boundary:

```text
.opencorvus/.r/tasks/<full-task-id>/sessions/<full-session-id>/
```

Its tool output, managed Git worktree, and ownership markers live there. The canonical event body is Task-wide and lives at `trace.jsonl` directly under the Task root; `trace/` holds its index and bounded payload blobs, while the project index maps Session IDs back to the owning Task. Task-wide artifacts (including immutable read materializations), evidence, research, documents, intent, logs, and acceptance state remain direct or named descendants of the Task root.

## Non-Task namespaces

- `missions/<mission-id>/` contains only Mission-owned durable coordination notes.
- `conversations/<session-id>/` contains ordinary non-Task Conversation runtime output.
- `project/` contains project-wide attachments, caches, indexes, locks, and unscoped worktrees.
- `acceptance/no-task/` contains explicitly taskless acceptance scratch.

A project-wide resource must not be assigned to an arbitrary Task. In particular, the current attachment persistence contract is project-addressed and may be written before a Task exists, so attachments remain under `project/attachments/`. Moving them under Tasks requires a prior persisted ownership-contract change.

## Path authority

`ProjectRuntimePaths` is the sole path constructor. Callers must not reproduce collection names or Task/Session nesting. Full validated IDs are used in ownership roots so diagnostics and manual inspection do not require reverse database lookup.

The former type-first roots (`t`, `s`, `sx`, `b`, `m`, `w`, `o`, `c`, `l`, `a`) are invalid runtime layouts. Project initialization fails closed when any are present; there is no fallback reader or dual writer.

## Lifecycle consequences

- Task inspection and deletion can operate on one physical ownership root.
- TaskArtifact recovery enumerates `tasks/` and removes only the unreachable Task's `artifacts/` subtree, preserving other forensic Task state.
- Managed worktree discovery recognizes both Task Session worktrees and explicitly unscoped project worktrees.
- Ownership recovery recursively scans Task roots but only accepts the dedicated `.ownership.json` marker suffix, so Artifact JSON cannot be misclassified as lifecycle state.
