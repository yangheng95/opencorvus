# Git source entry enumeration

`packages/opencorvus/src/util/git-source-paths.ts` owns the current selection of
Git source entries. It uses the caller's existing supervised Git runner and
repository configuration; Engine Git keeps its isolated index, work-tree and
ignore environment. `GitOptions.input` forwards the existing Process byte stream
for NUL-delimited standard input.

The shared `gitSourceIndexEntries` stage projection provides tracked paths, modes,
object identities and conflict stages, including deleted working entries.
Git's `ls-files --others --exclude-standard --directory -z` supplies
untracked boundaries. Real ordinary directories are expanded with `lstat` and
`readdir`; Git's verbose, non-matching, NUL `check-ignore --no-index --stdin`
protocol supplies the authoritative rule for each child. Candidates from all
ordinary directories at the same depth share one streamed ignore query. Negated rules retain
the child. Git's `./` aggregate is an internal current-directory traversal prefix.
Indexed files or links replaced by real ordinary directories enter the same walker,
because Git does not report those new children as untracked directory boundaries.
Empty ordinary directories produce no source entries. A nested Git repository and
an indexed 160000 gitlink, including an uninitialized submodule directory, remain
terminal entries for the parent enumeration.

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
entry count. `gitSourceLinkDiffs` compares actual index/ref blobs with raw link
target bytes; `normalizeGitSourceLinkStatus` retains index status, conflict stages
and rename pairs while correcting the working-entry status. VCS diff and File
status use the same comparison. An unchanged link has a clean working entry; a
target edit, deletion or real type change has its actual status and patch. A
terminal link counts once. Non-UTF-8 link targets are binary. Nested repository
boundaries have zero parent text statistics. Public numeric fields and the client
deadline remain unchanged. Worktree merge/recovery and GC dirty probes use the
same finite `gitSourceStatus` projection.

`stageGitSourceEntries` owns ordinary application source staging for VCS commit,
Snapshot, Build observation pins, primary Worktree recovery and GitHub CLI commits.
It seeds a temporary preparation index from the caller's actual index and retains
the caller's Git directory, work-tree, excludes, file attributes and clean filters.
Ordinary files, deletions and initialized nested repositories use literal NUL
pathspecs. Already tracked ordinary entries use Git's `add --update`; newly
enumerated entries use `add --all`. A later ignore rule does not remove the
authority of a tracked path, while new entries retain Git's current ignore
admission. This distinction also applies to Build's private HEAD-seeded index.
Real links use raw target blobs and mode120000 index-info records.
Replaced tracked ordinary directories remove the former terminal from the
prepared index and stage only the enumerated children. Uninitialized gitlinks
retain their existing parent commit identities. Regular directories are never
recursive add pathspecs.

`gitSourceEntryArgs` centrally applies per-process `core.symlinks=true` to source
staging and working-entry comparisons, so a physical regular file is not treated
as a symlink placeholder. It changes neither repository configuration nor branch
checkout/restore policy. Terminal junctions still require the raw comparison
because Git for Windows identifies their reparse tag as a directory.

The extracted `git-index-lock` primitive is shared with Engine Git checkpoint
publication and recovery. It compares exact predecessor index bytes, writes and
syncs the prepared index through an exclusively owned canonical lock, and installs
that lock atomically. Lock identity uses exact BigInt filesystem facts and captures
final timestamps after handle closure. Cleanup verifies ownership; a competing
index or lock is an observable error. The preparation index is a transaction
artifact, never a second authoritative index.

Engine Git checkpoint enumeration and Execution Capsule source snapshots share
this selection and retain their existing raw-link blob and stable snapshot
contracts. Task and Mission project archives share the same selection and runtime
filter, export ordinary files, and report the actual exported file count from
the single ZIP writer in both manifests and return values.

VCS commit-message generation remains streaming. Its error event has the required
code `model_not_configured` or `generation_failed`. The strict model resolver's
existing MissingModelConfigError exposes the stable configuration prerequisite;
other generation failures retain the safe public summary and original diagnostics.
The frontend preserves the code as VcsCommitMessageError and renders the current
language's actionable message. Manual commit input uses the same commit path.

These entry contracts do not qualify external native `git add --all`, full model
execution, Mission scheduling, or branch checkout/restore of Windows junctions.
Those capabilities retain their own current contracts and occurrence evidence.

See [the investigation and acceptance record](../../records/2026-10/2026-10-14-project-metadata-latency.md).
