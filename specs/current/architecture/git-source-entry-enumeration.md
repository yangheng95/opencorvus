# Git source entry enumeration

`packages/opencorvus/src/util/git-source-paths.ts` owns the current selection of
Git source entries. It uses the caller's existing supervised Git runner and
repository configuration; Engine Git keeps its isolated index, work-tree and
ignore environment. `GitOptions.input` forwards the existing Process byte stream
for NUL-delimited standard input.

The index provides tracked paths, including paths whose working files have been
deleted. Git's `ls-files --others --exclude-standard --directory -z` supplies
untracked boundaries. Real ordinary directories are expanded with `lstat` and
`readdir`; Git's verbose, non-matching, NUL `check-ignore --no-index --stdin`
protocol supplies the authoritative rule for each child. Candidates from all
ordinary directories at the same depth share one streamed ignore query. Negated rules retain
the child. Empty ordinary directories produce no source entries. A nested Git
repository remains one boundary entry for the parent enumeration.

Terminal symlinks and Windows junctions are entries themselves. Their target
directories are not expanded by source enumeration. An indexed descendant whose
intermediate ancestor is now a link returns `GitSourceEnumerationError` with
`linked_ancestor`, the indexed path and its link identity. Malformed Git records,
Git failures, changed directory identity and unsupported entry types have the
same typed error boundary with their own reason. Ordinary filesystem errors
remain observable. The result is a sorted, unique tracked/untracked/combined
projection derived afresh for each invocation. The ancestor validation set is
local to that invocation and stores no cross-request state.

VCS information combines tracked porcelain status with this complete untracked
entry count. A terminal link counts once. The public numeric fields and client
deadline remain unchanged. VCS untracked comparisons and File status read link
target bytes instead of target files; a non-UTF-8 link target is binary in VCS
comparison. A nested repository boundary has zero parent text statistics.

Engine Git checkpoint enumeration and Execution Capsule source snapshots share
this selection and retain their existing raw-link blob and stable snapshot
contracts. Task and Mission project archives share the same selection and runtime
filter, export ordinary files, and report the actual exported file count from
the single ZIP writer in both manifests and return values.

Native Git writes and the normal Worktree/garbage-collection dirty checks retain
their own existing contracts. Source-read acceptance does not qualify native
`git add --all` for a cyclic junction graph or claim full model execution,
Mission scheduling, retries or restart recovery. Those capabilities require
their own actual occurrence evidence.

See [the investigation and acceptance record](../../records/2026-10/2026-10-14-project-metadata-latency.md).
