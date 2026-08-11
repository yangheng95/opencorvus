# Main Delivery History Convergence

## Recall

### User request

- Analyze the complete repository change set, split deliverable work into reviewable pushes, and exclude files that are still being edited.
- After the initial non-fast-forward stop, continue the authorized integration from the current upstream rather than overwriting remote history.

### Acceptance

- Preserve the original dirty `main` worktree and every active edit in it.
- Use `origin/main` as the clean integration baseline and migrate only locally unique, reviewed delivery commits.
- Treat patch-equivalent or semantically superseded local commits as already delivered instead of replaying them.
- Keep migrated changes separated by their existing functional commit boundaries.
- Run the focused tests, generated-source checks, type checks, builds, document checks, real-page visual acceptance, final diff review, and an independent read-only review required by each migrated feature.
- Before pushing, fetch again and prove that every outgoing commit belongs to this authorized convergence.
- Push only by fast-forward. Do not create a tag, Release, pull request, force-push, reset, clean, stash, or rewrite the original dirty worktree.

### Hard constraints

- Repository: `D:\myhexin-local\opencorvus`; upstream: `origin/main`.
- Original dirty worktree remains the owner of active edits, including the Overlay entry point, transport contract work, website/Mission work, mixed specification indexes, and the equity-research report.
- Integration worktree: `D:\myhexin-local\opencorvus-delivery-20260812`; branch: `codex/main-delivery-20260812`.
- Integration baseline: `b435416c11ee23395432b54bdbcce1f1a470723f`.
- The integration branch is temporary delivery plumbing. The pushed `main` ref is the only remote delivery source.
- User Interface (UI) acceptance uses a real page, screenshots, and human review. Existing or new UI automation is not run.

### Sources read

- Repository-wide `AGENTS.md` execution, testing, UI, documentation, Git, and independent-review contracts.
- Current branch/upstream identity, worktree inventory, status, `origin/main..main`, `main..origin/main`, `git cherry`, per-commit path sets, and range comparisons against current upstream.
- Feature records and architecture files carried by the candidate usage, Clipboard, Mission, conversation-output, and Expert Squad commits.
- Independent usage-dashboard review feedback through the final no-finding pass.

### Whole-repository search and classification

At the initial frozen boundary, local `main` was 45 commits behind and 14 commits ahead of `origin/main`. Three local commits had exact patch equivalents upstream. Three more candidate commits had later upstream implementations or follow-up repairs with the same public contract. The remaining candidate commits form the provisional migration set below; this table must be finalized against the clean upstream tree before migration.

| Local commit | Provisional classification | Delivery action |
| --- | --- | --- |
| `ad91a7707` | Agent Hosts website contract has a later upstream implementation | Prove semantic coverage, then skip |
| `04d134d42` | Exact patch equivalent upstream | Skip |
| `e6d61cb41` | Exact patch equivalent upstream | Skip |
| `ab7292cd1` | Exact patch equivalent upstream | Skip |
| `77bff1c07` | Hosted Squad on-demand installation has a later upstream implementation | Prove semantic coverage, then skip |
| `1e552c414` | Documentation-index-only convergence record | Keep only if current upstream lacks its referenced delivery truth |
| `31f1dfcde` | Copied-diagnostics contract has later upstream fixes | Prove semantic coverage, then skip |
| `8df05f203` | Clipboard API-key prompt | Migrate if absent upstream |
| `5a2d53771` | Mission Market Squad recommendations | Migrate if absent upstream |
| `5c1028326` | Agent-declared output summary | Migrate if absent upstream |
| `7dcc0e10d` | Expert Squad terminology convergence | Migrate if absent upstream |
| `efc3a8465` | Provider usage natural-cycle dashboard | Migrate if absent upstream |
| `58883aade` | Secret-safe debug fixture closure for the usage delivery | Migrate with the usage batch if applicable |
| `4bff1ef70` | Default-workspace OpenRouter key coverage and i18n checker correction | Migrate after the usage dashboard |

Independent agent feedback before implementation: the usage batch has completed repeated independent review; the final fixed nine-path correction had no P0, P1, P2, or unresolved finding. The whole integrated outgoing range has not yet received its required independent review.

## Problem-depth analysis

### Observable condition

The original shared `main` worktree contains active uncommitted edits while its branch has independently created local delivery commits and the remote has advanced by a larger concurrent series. A direct push is rejected as non-fast-forward, and a blanket merge in the dirty worktree would mix active files with the delivery boundary.

### Direct trigger

Multiple authorized tasks committed and pushed from concurrent worktrees against the same repository during the delivery window. Local and remote histories therefore diverged even though some changes are patch-equivalent or semantically related.

### Root cause and control flow

The delivery source was not frozen before concurrent remote pushes. Git compares commit ancestry, not feature semantics: exact-equivalent commits with different parents still appear ahead locally, while later remote refinements can supersede only part of an earlier local patch. Replaying all 14 commits would duplicate fixes and could regress newer upstream architecture; merging the dirty branch would also make uncommitted user work part of conflict resolution.

### Why the old path is insufficient

A normal push cannot fast-forward the remote. Force-push would discard authorized remote work. A bulk merge, rebase, or cherry-pick without semantic classification would turn patch identity into a false delivery signal and would obscure which feature introduced any conflict or regression.

### Impact and risk boundary

- Original active edits could be overwritten or accidentally committed.
- Newer remote Mission, Overlay diagnostics, Agent Hosts, and hosted-Squad behavior could be regressed by replaying superseded commits.
- API/OpenAPI changes could leave generated Software Development Kit (SDK) files stale.
- UI conflicts could compile while producing an incorrect real page.
- A push from the wrong boundary could publish unrelated commits.

The repair boundary is therefore a clean worktree at current upstream, semantic commit classification, ordered functional cherry-picks, generated closure, focused and real-page acceptance, independent review, and one final fast-forward push.

## Implementation plan

1. Freeze the original dirty worktree and establish the clean upstream integration identity.
2. Verify exact and semantic upstream coverage for every candidate commit; record skip/migrate evidence.
3. Cherry-pick only absent behavior in original chronological and dependency order, resolving conflicts in favor of current architecture plus the intended feature contract.
4. Rebuild generated SDK outputs where public routes or schemas changed.
5. Run each feature's focused non-UI checks, repository checkers, type checks, builds, and real UI visual acceptance.
6. Ask an uninvolved agent to review the fixed outgoing range read-only; repair every valid finding and repeat until none remain.
7. Fetch again, inspect `origin/main..HEAD`, require fast-forward ancestry, push `HEAD:main`, and verify the remote commit.

## Verification record

This section is intentionally incomplete until the integration boundary is fixed. Commands, counts, screenshots, independent-review result, outgoing commit list, and remote verification will be recorded before the final delivery commit.
