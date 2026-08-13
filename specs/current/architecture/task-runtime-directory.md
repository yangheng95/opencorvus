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

Ordinary directory resolution is observational. If more than one durable
`project` row names the same physical worktree, `Project.fromDirectory`
returns `ProjectDuplicateWorktreeIdentityError` before writing a marker or a
domain row. Lookup never chooses a winner and never migrates data.

Historical duplicate rows are repaired only by the explicit
`opencorvus db converge-project-identities <worktree> <canonical-project-id>
--force` authority. That operation disposes live Instances, validates one
reviewed canonical occurrence, and atomically rewrites the statically
enumerated domain tables that own a `project_id` column. It merges sandbox and
Project metadata ownership, deletes duplicate Project rows, and returns an
exact per-table receipt. Compound-key, directory-authority, embedded identity,
or immutable Artifact conflicts fail the transaction; runtime schema discovery
never expands the mutation surface.

The repair process must hold the exact cross-process Runtime Server ownership
for the database. Mutable foreign-key owners use explicit domain mappings;
append-only permission evidence, durable publication outbox rows, immutable
Task process bindings, and an attachment-store authority owned by a duplicate
Project are preservation conflicts, never rewritten in place.

## Lifecycle consequences

- Task inspection and deletion can operate on one physical ownership root.
- TaskArtifact recovery enumerates `tasks/` and removes only the unreachable Task's `artifacts/` subtree, preserving other forensic Task state.
- Managed worktree discovery recognizes both Task Session worktrees and explicitly unscoped project worktrees.
- Worktree ownership observation traverses only `tasks/<task>/sessions/<session>/ownership/worktrees`; it never enters Artifact, trace, or materialization subtrees. The `tasks/` root may be confirmed absent, but a previously listed nested authority that disappears or becomes unreadable makes the snapshot unobservable.
- A destructive ownerless proof requires a complete snapshot. Invalid marker JSON or schema, an unreadable marker, an uncertain path identity, and filesystem errors other than confirmed `ENOENT` preserve the directory and return a typed ownership-observation failure. Public failures expose only stable operation, code, scope, and message; internal paths and causes remain diagnostic data.
- Marker identity is strict: canonical Task and Session IDs in the path and payload must agree, `cwd` is absolute, `ownerPid` is positive, `createdAt` is finite and non-negative, and `kind` is `worktree`. Dedicated `.ownership.json` files are the only marker inputs.
- Process observation is three-state. `ESRCH` proves a dead process, `EPERM` proves a live process, and every other probe failure is unobservable. A dead process still owns the Worktree while its Task is active; only a missing or terminal Task makes that exact marker releasable.
- Exact Session, Task, or directory release may remove already observed matching markers while preserving unrelated invalid or unobservable authority in its structured receipt. It never rescans or converts partial observation into ownerlessness.
- The final deletion gate compares target, primary Worktree, Git registry entries, active execution bindings, and Project sandbox bindings through the same strict physical identity. Durable sandbox membership remains ownership even when its directory is unavailable. An ordinary proof cannot ignore it; the existing explicit removal occurrence may authorize releasing that exact sandbox binding, and no discovery/observation path may do so.
- Project discovery may add the exact sandbox resolved for the current request, but it never filters, rewrites, or removes an existing durable sandbox registration from reachability observations. Confirmed physical absence and observation failure both preserve membership; only explicit sandbox release mutates ownership downward.
- Garbage collection reconciles ownership per Project before applying candidates. Reconciliation uncertainty preserves every candidate for that Project, and every candidate settles as an exact removal or preservation receipt rather than a counter-only result.
