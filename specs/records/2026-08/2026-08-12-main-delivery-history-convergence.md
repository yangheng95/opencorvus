# Main Delivery History Convergence

## Recall

### User request

- Analyze the complete repository change set, split deliverable work into reviewable pushes, and exclude files that are still being edited.
- After the initial non-fast-forward stop, continue the authorized integration from the current upstream rather than overwriting remote history.
- The latest explicit user correction supersedes the earlier exclusion: commit the complete visible repository worktree and merge its history back into the main worktree.

### Acceptance

- Preserve and commit every visible original `main` worktree edit; do not leave the formerly active paths uncommitted.
- Use `origin/main` as the clean integration baseline and migrate only locally unique, reviewed delivery commits.
- Treat patch-equivalent or semantically superseded local commits as already delivered instead of replaying them.
- Keep migrated changes separated by their existing functional commit boundaries.
- Run the focused tests, generated-source checks, type checks, builds, document checks, real-page visual acceptance, final diff review, and an independent read-only review required by each migrated feature.
- Before pushing, fetch again and prove that every outgoing commit belongs to this authorized convergence.
- Push only by fast-forward. Do not create a tag, Release, pull request, force-push, reset, clean, stash, or rewrite the original dirty worktree.

### Hard constraints

- Repository: `D:\myhexin-local\opencorvus`; upstream: `origin/main`.
- The original worktree's formerly active Overlay, transport, website/Mission, specification-index, and equity-research paths are all inside the committed history boundary.
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

At the initial frozen boundary, local `main` was 45 commits behind and 14 commits ahead of `origin/main`. Three local commits had exact patch equivalents upstream. Four more candidate commits had later upstream implementations, follow-up repairs, or already-present index content with the same public contract. The final classification is:

| Local commit | Final classification | Delivery action |
| --- | --- | --- |
| `ad91a7707` | Agent Hosts core paths and specification are identical to upstream `b108d9572` | Skip |
| `04d134d42` | Exact patch equivalent upstream | Skip |
| `e6d61cb41` | Exact patch equivalent upstream | Skip |
| `ab7292cd1` | Exact patch equivalent upstream | Skip |
| `77bff1c07` | Core hosted-install paths are identical to upstream `97793a58a`, whose later lifecycle fixes remain authoritative | Skip |
| `1e552c414` | Its two documentation index entries already exist upstream | Skip |
| `31f1dfcde` | Current copied-diagnostics implementation includes later upstream repairs | Skip |
| `8df05f203` | Clipboard API-key prompt is absent upstream | Migrate as `397a46fc7` |
| `5a2d53771` | Mission Market Squad recommendations are absent upstream | Migrate as `56ad7be40` |
| `5c1028326` | Agent-declared output summary is absent upstream | Migrate as `31b80652b` |
| `7dcc0e10d` | Expert Squad terminology convergence is absent upstream | Migrate as `fb4f727e3` |
| `efc3a8465` | Provider usage natural-cycle dashboard is absent upstream | Migrate as `0163df103` |
| `58883aade` | Secret-safe debug fixture closes the usage delivery | Migrate as `672b18659` |
| `4bff1ef70` | Default-workspace OpenRouter key coverage and i18n checker correction close reviewed findings | Migrate as `5f4b30f71` |

Independent agent feedback before implementation: the usage batch has completed repeated independent review; the final fixed nine-path correction had no P0, P1, P2, or unresolved finding. The whole integrated outgoing range has not yet received its required independent review.

### Full-worktree override classification

After the user explicitly changed the boundary to the complete repository, the original worktree was committed in three reviewable units:

- `ce98df372` captures the Overlay formatting and positive transport cancellation fixture.
- `8a2a9950b` captures the complete visible website/Mission design snapshot, including its binary concept assets and specification indexes. Most of this snapshot is byte-identical to already-published commit `2002f2d114bddbb7e6206a62d53560a20edadbaa`; the few different website shell/spec paths are older than current upstream Iterations 3–5. The commit is retained as historical worktree evidence but must not replace the newer current website tree.
- `7b5052154` adds the previously untracked equity-research report. This is the only newly committed worktree artifact not already represented or superseded upstream, so it is replayed into the final tree as `984996b17`.

The original worktree is clean after these commits. The final history merge will use the already-integrated current tree as its content result while recording the original `main` tip as a parent. That makes every full-worktree commit part of public history without reintroducing duplicate or superseded implementations, and lets the original `main` worktree fast-forward to the delivered merge.

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

### Integration resolutions

- The Clipboard prompt keeps the current upstream Overlay entry point and adds only the current Tauri clipboard bridge and prompt flow; it does not restore the removed tray-attention path.
- Mission creation retains the current project-scoped installed-Squad loader and adds the bounded Market query/install surface. Installation never selects or activates a Squad automatically, so the public website remains the only full Market browser.
- Expert Squad terminology was applied on top of the current website-only Market architecture. A final tracked residual scan found one later upstream Chinese public-Market block with the old product term; that block was corrected and the canonical Market distribution was regenerated.
- The current upstream schema already contains the event stream and bus retry migrations. The provider-usage migration now starts from upstream fingerprint `84af4e18...` and produces `e893d236...`, so the migration planner has one linear source per step rather than two migrations starting from `10db...`.
- The current transport cancellation contract requires `cancellationStatus`; the touched positive fixture now supplies `"none"`.
- SDK and public Market generated sources were regenerated from the integrated tree, not copied from a candidate commit.

### Non-UI verification

- Overlay Clipboard/host/i18n focused tests: 8 passed, 0 failed, 26 assertions.
- Transport contract and visible composer references: 19 passed, 0 failed, 1,121 assertions.
- Catalog index, Squad SDK, declared-output summary, usage, and schema migration group: 49 passed, 0 failed, 218 assertions; the schema migration subset is 8 passed with 51 assertions.
- Overlay `tsc --noEmit`, OpenCorvus `tsc --noEmit`, SDK `tsc --noEmit`, and Rust `cargo check` passed. Rust used the already-built stamped Windows payload only as the required `build.rs` embed input; the Rust sources and lockfile came from this clean worktree.
- `bun run check:i18n` passed for 2 locales and 1,809 top-level keys.
- SDK build completed with no uncommitted generated difference. `api:routes-check` passed 6 rules across 34 files. `docs:check` passed 331 operations across 25 groups.
- Web Astro check completed with 0 errors and 0 warnings plus one existing unrelated unused-variable hint. Overlay Vite built 7,104 modules; only existing dependency directive and chunk-size warnings remained.
- `cargo fmt --check`, public Market generation, tracked old-term residual audit, and `git diff --check` passed.
- A frozen-install attempt in the clean worktree encountered repeated `ConnectionClosed` dependency downloads. Verification used package-local dependency junctions to the existing immutable dependency store while overriding changed workspace packages to this clean worktree; no tracked dependency metadata changed.

### Real-page visual verification

- An isolated server from this integration worktree served the freshly built Overlay at `127.0.0.1:17891` with an isolated `OPENCORVUS_HOME`. The in-app browser was connected to that exact server and reported `Online · Port 17891`.
- The Usage page was rendered and manually inspected at desktop size. Month and year natural-period selection, `Asia/Shanghai`, measured Token/cost cards, official-source reconciliation, activity, provider, and model sections were present; the year selection rendered `Jan 1, 2026 – Dec 31, 2026`.
- The Expert Squad settings and public-Market handoff were rendered and manually inspected. The page explicitly states that local installation does not activate a Squad automatically.
- The browser host cannot provide the native `workspace.pickDir` command, so a fresh project could not be registered through that host to repeat the Mission picker interaction. The committed Mission Market screenshots remain the direct visual evidence for search and installed-picker states; this run does not claim a new native-picker acceptance.
- Live provider credentials, provider-issued billing traffic, and native Clipboard reads were not exercised in this isolated run.

### Outgoing and review state

Commit `6320823a2` adds the integrated transport fixture, regenerated Market closure, residual terminology correction, and the first evidence record. The later full-worktree override adds the equity report to the final tree and retains the three original-worktree commits through a content-preserving history merge. After that merge, the complete `origin/main..HEAD` graph and final tree will be frozen for a new uninvolved independent read-only review. The review result, final re-fetch, fast-forward proof, push result, and original-worktree synchronization are delivery-time evidence and are reported by the task rather than predeclared here.
