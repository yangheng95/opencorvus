# Open pull request triage

## Recall

| Item | Recorded requirement or evidence |
| --- | --- |
| User request | Handle the open pull requests at `https://github.com/yangheng95/opencorvus/pulls`. |
| Acceptance | Every open pull request receives an evidence-backed disposition: merge only when its current-base change is coherent and focused verification passes; otherwise close with the concrete supersession or contract reason. Re-read the remote list after all mutations. |
| Hard constraints | Preserve every unrelated dirty or concurrently committed file on `arch-debt-remediation`; do not switch, stash, reset, clean, rebase, force-push, bypass hooks, create another branch/worktree, publish a Release, or use UI automation. Do not treat Dependabot's metadata check as product verification. |
| Repository identity | `D:/myhexin-local/opencorvus`, remote `https://github.com/yangheng95/opencorvus.git`, current branch `arch-debt-remediation` at `faed42893`, upstream divergence `0/0` after fetch. `origin/main` was `454b357ba` at triage start. |
| Materials read | Root `AGENTS.md`; `package.json`; affected package manifests and lockfile diffs; `.github/dependabot.yml`; affected workflows; current `specs/README.md` and monthly index; current GitHub PR metadata, checks, failed logs, branch ancestry, npm registry package metadata, and relevant upstream release notes embedded in the PR bodies. |
| Full-repository search | Searched every affected dependency outside `bun.lock`, all workflow references, root overrides/catalog entries, platform-binary version families, and Provider call sites. No source import of `@actions/artifact` exists. |
| Independent agent feedback before implementation | None. The mandatory post-change independent read-only review will be recorded below. |

## Problem depth and impact

### Observable state

GitHub exposed 13 open pull requests on 2026-08-25: release PR #19 plus Dependabot PRs #1, #3, #4, #5, #6, #7, #10, and #13 through #17. GitHub labelled all but #7 and #19 clean, but the clean Dependabot PRs exposed only the bot metadata check rather than the repository's product checks. The current `main` tip independently has failing unit, generated-artifact, and typecheck workflows, so a red aggregate check cannot be attributed to a dependency change without focused comparison.

### Direct triggers and root causes

- #19 targets `v0.0.46beta` from `v0.0.47beta`. Its head `8c76928b4` is already an ancestor of `origin/main`; merging it would add no capability and would reopen an obsolete release branch relation.
- #15, #16, and #17 individually move AI SDK Provider packages to the Provider v4 / Provider Utils v5 family, while the canonical `ai@6.0.172` runtime depends on Provider v3 / Provider Utils v4. These are coordinated `ai@7` migrations, not independent package bumps.
- #14 moves only the Windows embedded Node binary from 22.23.1 to 26.7.0 while the other four platform binaries remain at 22.23.1. That breaks the cross-platform runtime-version family and changes the packaged runtime contract only on Windows.
- #4 moves only the Linux ARM64 musl Parcel watcher binary to 2.6.0 while `@parcel/watcher@2.5.1` and every other explicit platform binary remain at 2.5.1. The parent package itself declares the 2.5.1 binary, so the PR creates duplicate versions instead of upgrading the watcher family.
- #1 changes direct Babel declarations to 8.0.1 while the root override still forces 7.29.7 and the preset/types remain on Babel 7. It therefore does not produce one Babel 8 runtime and cannot be accepted as a migration.
- #3 upgrades an ESM-only major of `@actions/artifact`, but repository search found no source consumer of the direct dependency. Updating an unused declaration does not establish a positive runtime contract; dependency removal is a separate cleanup decision.
- #5 and #7 update GitHub Actions runtimes. Hosted-runner evidence reports runner 2.336.0, above dependency-review-action v5's 2.327.1 minimum; checkout v7 completed successfully in #7's failed runs. The recorded #7 failures occurred later in unrelated repository tests and in dependency review because the public repository did not enable Dependency Graph. However, the repository's positive workflow contract still requires exact `actions/checkout@v6` identities and #7 does not update that contract, so the proposed diff is incomplete even though the action itself can start.
- #6 and #10 are same-major runtime library updates. The embedded Node family is 22.23.1, satisfying yargs 18.1.0's Node requirement. AJV 8.20.0 keeps the AJV 8 API used by the repository.
- #13 is a UI parser dependency. Repository policy requires a real File Editor page and screenshot tied to HTML syntax rendering before merge; static or automated UI checks are not acceptable.

### Why the old path is insufficient

Dependabot mergeability, compatibility badges, and its single green metadata check do not exercise OpenCorvus Provider interfaces, packaged runtime parity, File Editor rendering, CLI parsing, JSON Schema validation, or workflow execution. Conversely, pre-existing failures on `main` and #7 cannot be used to reject a change when logs prove the changed checkout step succeeded and the failures originated later in unrelated tests.

### Affected contracts and risks

The scope includes package and lockfile single-source consistency, `ai` and Provider interface compatibility, the embedded cross-platform Node runtime, Parcel native-binary selection, CLI argument parsing, JSON Schema validation, Overlay File Editor rendering, and GitHub-hosted runner compatibility. No route, storage schema, generated SDK, Provider credential, release, tag, or deployment contract is changed by this triage itself.

## Disposition and outcome

| PR | Final disposition | Evidence or result |
| --- | --- | --- |
| #19 | Closed as absorbed | Head remained an ancestor of `main`; the closure comment records the obsolete release relation. |
| #15, #16, #17 | Closed; defer to one coordinated `ai@7` migration | Canonical `ai@6.0.172` and the proposed Provider dependency families remain incompatible. |
| #14 | Closed | The five embedded Node platform packages must remain one version family. |
| #4 | Closed | The parent watcher and explicit platform binaries must remain one version family. |
| #1 | Closed | The root override and remaining Babel packages still select Babel 7. |
| #3 | Closed | No repository source consumer exists, and the proposed version is an ESM-only major. |
| #5 | Closed because its changed action lacks real checker evidence | The existing workflow checker does not assert the dependency-review-action version, and #5 had no security/dependency-review run proving v5 on a real runner. |
| #7 | Closed as incomplete | The PR changed nine workflows to checkout v7 but left the positive workflow contract pinned to checkout v6. |
| #6 | Merged as `fda955515` | Focused CLI smoke, package typecheck, and the combined candidate verification passed. |
| #10 | Merged as `eed5da231` | The focused AJV-backed positive contract and package typecheck passed. |
| #13 | Merged as `e2981140f` | The real isolated `/ui` served from the built candidate rendered HTML correctly in the independently reviewed File Editor screenshot. |

After each merge, fetch the new `main`, re-read remaining mergeability, and do not merge through a newly introduced conflict. After all mutations, verify the remote open-PR set, merged/closed states, current `main` ancestry, and the unchanged unrelated working-tree paths.

## Verification record

The candidate tree was synthesized from `origin/main@454b357ba` plus #5, #6, and #10 without changing the active branch or creating a second worktree. After a frozen install, the JavaScript SDK build repaired the candidate-only generated dependency required by package tests. The candidate then passed:

- `bun test script/github-actions-workflow-contract.test.ts`: 7 passed, 0 failed, 72 assertions.
- `bun packages/opencorvus/src/index.ts --help`: exit 0 with the current command and option surface rendered.
- `bun run --cwd packages/opencorvus typecheck`: exit 0.
- `bun test packages/opencorvus/test/expert-squad/eighth-domain-expansion-packages.test.ts`: 12 passed, 0 failed, 255 assertions after compiling the same candidate process-supervisor source to a short Windows path; the first long-path linker failure was tooling-path-specific rather than an AJV failure.

#13 was then applied only to the isolated candidate tree. Its frozen install, `bun run --cwd packages/overlay typecheck`, and `bun run --cwd packages/overlay build:vite` passed. A real `serve` process on `http://127.0.0.1:18913/ui/` loaded the candidate Overlay, the Files panel traversed `packages/overlay/dist-vite/index.html`, and the File Editor visibly rendered the HTML/JavaScript source with line numbers and syntax highlighting. Manual screenshot review found no blank surface, missing source, or editor crash. The durable screenshot is [`pr13-file-editor-html.png`](../../artifacts/pr-triage/pr13-file-editor-html.png). No UI automation test was added, changed, or run. The isolated server was stopped and port 18913 was verified free.

The first independent read-only review found that #5's candidate evidence did not exercise dependency-review-action v5 in a real GitHub runner and that #13's screenshot was not yet durable for independent visual review. Both findings were accepted: #5 changed from merge to close, and the screenshot above was persisted. The second independent review reported no findings, verified the screenshot at 1920 x 900 and SHA-256 `346072949BB74927BFB320906C8003AB059CD7B4A67F22865EE7814465938885`, and confirmed the revised dispositions.

## Remote audit

Ten PRs were closed with their specific evidence in the closure comment: #1, #3, #4, #5, #7, #14, #15, #16, #17, and #19. Three PRs were merged in order after refreshing `main` and re-reading mergeability: #6 as `fda955515`, #10 as `eed5da231`, and #13 as `e2981140f`. The first parent of every merge is the preceding `main` tip, and the triage base `454b357ba` remains an ancestor of final `main`.

The final GitHub query returned an empty open-PR set, and per-PR queries reported exactly three `MERGED` and ten `CLOSED` states. All workflows triggered by final `main@e2981140f` reached a terminal state:

- [`build check`](https://github.com/yangheng95/opencorvus/actions/runs/32873245382), [`security`](https://github.com/yangheng95/opencorvus/actions/runs/32873245351), [`codeql`](https://github.com/yangheng95/opencorvus/actions/runs/32873245596), and [`deploy opencorvus.com`](https://github.com/yangheng95/opencorvus/actions/runs/32873245356) succeeded. The deploy workflow passed its database-backed release verification, Linux/macOS/Windows canonical archive checks, signing, and atomic RackNerd switch.
- [`generated-artifacts`](https://github.com/yangheng95/opencorvus/actions/runs/32873245378) and [`typecheck`](https://github.com/yangheng95/opencorvus/actions/runs/32873245344) failed on the same pre-existing `packages/sdk/js/src/route-policy.ts` generated-artifact drift as the verified pre-triage `main@454b357ba` baseline.
- [`unit test`](https://github.com/yangheng95/opencorvus/actions/runs/32873245248) remained red. The Linux and Windows failures exactly reproduced the baseline failures; the macOS failure moved within the already-red suite to two Evolution Artifact exact-evidence cases. The Overlay and channel-runtime unit jobs passed. Because #6, #10, and #13 change only yargs, AJV, and CodeMirror HTML dependency declarations/lock entries, and their focused positive paths passed, this evidence does not attribute the existing aggregate red state to the merged dependency updates. It also does not claim that the repository-wide suite is green.

The final independent read-only review reported no findings. It re-verified the corrected isolated-build wording, all 13 remote dispositions, the merge first-parent chain, final workflow outcomes and baseline attribution, the screenshot and digest, and the passing documentation checks. Its remaining-risk boundary is the repository-wide red CI state described above; the available evidence does not attribute that state to the three merged dependency updates.
