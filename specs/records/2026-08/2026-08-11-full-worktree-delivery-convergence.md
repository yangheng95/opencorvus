# Full Worktree Delivery Convergence

## Recall

| Item | Record |
| --- | --- |
| User request | Organize and push every non-temporary change in the repository. |
| Acceptance | Every intended source, test, generated projection, and indexed specification change is classified, validated, independently reviewed, committed in reviewable groups, and pushed to the configured upstream; temporary runtime output remains outside Git. |
| Hard constraints | Preserve exact repository identity and normal push ancestry; do not reset, clean, stash, force-push, bypass hooks, create a branch, tag, Release, or package artifacts. Do not run User Interface automation. Inspect `upstream..HEAD` immediately before push. |
| Repository identity | `D:/myhexin-local/opencorvus`, branch `main`, upstream `origin/main`, GitHub repository `yangheng95/opencorvus`; initial `HEAD` and `origin/main` were both `d05710d754f9d396466cd26701c730aab074fa01`. |
| Version truth | OpenCorvus and JavaScript SDK package versions are `0.0.38-beta`; the web package version is `0.1.0`. No version bump or release was requested. |
| Initial worktree | Thirty tracked source/spec changes plus four visible untracked files. Three additional ignored specification records are referenced by the modified indexes and therefore belong to the source closure. |
| Relevant material read | `AGENTS.md`; current Git status, worktrees, remotes, upstream and recent history; the Compact Task Identifier, Squad SDK authoring, continuous ten-domain, and RackNerd/public-site records; Task control-plane architecture; affected code, tests, generated projections, and public-site diffs. |
| Repository search | The compact identifier keeps exact `tsk_` authority; the authoring method has one canonical Skill plus embedded and portable projections; public-site changes are recorded with real Browser/screenshots/console evidence; `expert-squads/builtin/equity-research/report.md` is not a package source and conflicts with the package contract that writes runtime reports beneath `artifacts/equity-research/report.md`. |
| Independent Agent feedback | The first final read-only review found two valid blockers: stale post-format generation/build evidence and a Compact Task ID sequence overflow that encoded a later timestamp. The generator now fails explicitly when the complete 3,844-ID timestamp window is exhausted; current-index generation, checks, build, hashes, and evidence were refreshed. A second read-only review is required before commit. |

## Classification

### Non-temporary delivery groups

1. Compact Task identifiers: the canonical generator, focused positive test, and its ignored-but-indexed design record.
2. Squad SDK authoring quality: canonical package prompts and Skill, the new source-backed method, definition contract, embedded and portable projections, generator, focused tests, and its ignored-but-indexed design record.
3. Public product journey: root, Market, author, detail, Trust, shared navigation/styles/content/download behavior, obsolete Mission-flow component removal, generated public facts, and the expanded RackNerd/public-site record with existing real rendered evidence.
4. Specification closure: the continuous ten-domain record already cited by both indexes, this convergence record, and both updated specification indexes.

### Temporary exclusion

- `expert-squads/builtin/equity-research/report.md` is a one-off Microsoft research deliverable at an invalid package-root path. It is not referenced by the package manifest, belongs under a runtime project's `artifacts/` tree, and remains untracked and excluded from the outgoing commits.

## Validation and delivery sequence

1. Inspect every diff and untracked/ignored candidate; verify generated-source equality and public fact closure.
2. Run focused identifier, Squad SDK, portable-template, web, documentation, formatting/diff, and package type checks. Do not run UI automation.
3. Stage only the classified non-temporary boundary, including the ignored specification records with explicit paths; inspect the complete cached file list and diff.
4. Obtain an independent read-only Agent review. Resolve every valid finding and repeat review if the staged boundary changes materially.
5. Commit coherent groups, fetch the upstream, inspect the complete `origin/main..HEAD` range, and push normally only when every outgoing commit belongs to this authorized delivery.
6. Verify local/remote ref equality and report any excluded temporary file or unverified acceptance explicitly.

## Evidence log

- Initial local/upstream divergence: `0 0`.
- Initial visible tracked diff: 1,010 insertions, 2,722 deletions across 30 files; `git diff --check` passed.
- The public-site record already contains current real-page screenshots, interaction checks, and origin-console evidence for the exact worktree implementation. This convergence does not add or run a User Interface test.
- Index-based regeneration added the required `public-market-facts.generated.ts` Squad SDK version/digest update. The portable authoring template regenerated with no unstaged byte drift; the static distribution regenerated to the staged catalog digest.
- Focused positive tests: compact Task identifiers `2 / 0 / 7`; complete Squad SDK package `5 / 0 / 37`; repository Squad and portable-template calibration `51 / 0 / 353`.
- JavaScript SDK build, JavaScript SDK typecheck, OpenCorvus typecheck, Web Astro check, 121-page Web build, documentation check (`329` operations in `25` groups), and release-version alignment (`0.0.38-beta`) all passed.
- The Web check retained one pre-existing `qa/dedupe-lead.cjs` unused-variable hint. Astro/Starlight emitted the recorded override, deprecation, and tolerated top-level-await warnings; they did not fail the static build.
- The first independent review's Task timestamp finding was fixed at the root contract: every ID in the complete 3,844-entry Task-local sequence window now recovers the exact supplied timestamp, and exhaustion fails explicitly instead of inventing a later millisecond. The focused test and OpenCorvus typecheck passed after this change.
- The final current-index Web check and 121-page build passed. Generated metadata, `.generated`, and copied `dist` all bind catalog `df6d7466efa8108500d484642cf3c258b3d734127400130313d1761a36523699`.
- Final canonical/portable SHA-256 equality: authoring Skill `91190C001C5017739B7585FB1031E6A2B6FA1260194EB013000707A924D52055`, quality method `D2E522A459B3433683876FAA9A926CCADBD8FCC03C50571221B56C0F8D4B4467`, definition contract `36AEDC5CCD48CDC8759FF4A1DD541B6E344248EF17E9161142856E070DB198CD`.
- The final staged boundary contains 38 files and passes `git diff --cached --check`. The only visible unstaged path is the excluded untracked runtime report.
