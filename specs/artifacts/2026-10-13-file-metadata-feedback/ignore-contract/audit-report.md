# File ignored metadata — scoped backend audit

## Recall and authority

Root delegated a one-layer, bounded audit of `File.nodeForPath/isIgnored/list` and then authorized only `packages/opencorvus/src/file/index.ts` plus a new real TCP API positive contract file, after the plan in `specs/records/2026-10/2026-10-13-file-metadata-feedback.md` was completed. No provider, user application, UI automation, staging, commit, unrelated source, or further delegation belongs to this work. Prior physical-publication/HTTP500 evidence remains at `.tmp-codex-file-root-01a133/worktree-receipt-evidence.json`; it has not been replaced with later successes.

## Source and public contract findings

- `relativePathFor` describes public Node identity against `Instance.directory`. `nodeForPath` has exactly three production consumers: create, move and copy. File.list has HTTP and debug CLI consumers. Upload/remove do not use this ignored metadata path. Overlay file-workbench forwards exact receipts; Explorer consumes `ignored` without rewriting the identity.
- Both root-rule loaders originated in baseline `65d0bfc98`: they read worktree `.gitignore`, then worktree `.ignore`, but match directory-relative names. No later decision established this mismatch as intended behavior. 07-panel requires exact Node identity and completed physical-result reconciliation.
- `Instance.worktree` is `next.sandbox`, the actual checkout discovered through Git show-toplevel; `Instance.project.worktree` is the shared repository root. A real detached fixture worktree proves these fields differ correctly and current rules are independently read from each checkout. No new Git discovery/configuration is needed.
- Existing `FileIgnore.match` is watcher glob policy, not the root-rule matcher. Existing `canonicalPath` lowercases Windows paths for permission comparisons; it is unsuitable as an entry coordinate. Node path.relative/join and realpath are the mature coordinate primitives. File permission remains the existing directory/worktree physical admission.
- `Filesystem.exists` converts every access error into false. Root-rule reading uses the existing readText primitive directly and skips only ENOENT. ENOTDIR, EISDIR, EACCES and other read/realpath errors propagate; the broader isMissingPathError predicate is appropriate to other file-entry operations, not a malformed rule-root parent.

## Primary sources

[ignore maintainer README](https://github.com/kaelzhang/node-ignore#pathname-conventions) and the installed 7.0.5 README/source require a normalized pathname relative to the rule directory; the library performs no filesystem discovery. Its directory distinction comes from a trailing separator. Invalid dot/outside/absolute inputs throw. Keep its current default case policy and `.ignores` semantics; do not enable allowRelativePaths or replace it with checkIgnore.

[Git gitignore manual](https://git-scm.com/docs/gitignore) assigns each rule to its containing directory; anchored paths and directory-only patterns depend on that origin and entry kind. The current product combines only the worktree root's `.gitignore/.ignore`; it is not a full nested/global Git-ignore implementation. Git's normal symbolic-link notes cannot substitute for actual Windows junction behavior.

## Raw before matrix

All projects were created by memoryProject beneath the current managed test-process fixtures namespace. Each temporary seed and physical owner was checked before API work. Each TCP server stopped normally and the normal repository runner disposed its fixtures. These are investigations, not repair acceptance.

| Actual case | Before fact | Evidence |
| --- | --- | --- |
| FIRST normal root | `/root-only.md` true; anchored child rule does not match root name | ignore-domain-evidence-before-01.json |
| FIRST child scope | anchored child, dirs, `.ignore` extra falsely false; root-only and leading-space bracket names falsely true | same matrix |
| Scoped create/copy/move | 200 exact published bytes but wrong ignored=false for three root-anchored true entries | same matrix |
| Scoped dot aliases `.`, `./`, `missing/..`, `dirs/..` | same 200 listing and wrong flags, normalized public paths retained | same matrix |
| Child scope lists parent worktree | 500 RangeError on directory-relative `..` | same matrix; previous publication audit |
| Root itself junction | directory/worktree both retain alias root, correct normal-root flags | same matrix |
| Child scope reached through outside ancestor junction | directory retains alias path; worktree is physical Git root; listing200 retains wrong flags | same matrix |
| Ordinary scope explicitly lists outside ancestor alias reentry | permission admits actual worktree entity; listing500 on lexical `..` | same matrix |
| Two independent root/child Projects | distinct actual Project IDs; each root uses its own root rules, child fields each wrong in their own domain | same matrix |
| Internal alias-child | actual GET200, logical alias filename ignored=true | ignore-anchor-link-evidence.json |
| Internal back-link leaves then reenters root | actual GET200/ignored=true; continuous physical anchor alone yields `sub/note.md` and false, proving that algorithm alone changes identity | ignore-anchor-link-evidence.json |
| Terminal Windows junction | move stat gives directory/ignored=true; list Dirent gives file/ignored=false. These existing type/hint boundaries are retained in this batch | domain and anchor matrices |
| Actual Git junction classification | valid hostGit check-ignore argv query matches `/moved-terminal/`; normal file symlink does not match this directory-only rule | ignore-anchor-link-evidence.json |
| Directory entity physically outside worktree | a valid `.git` pointer/core.worktree yields Bscope directory + A worktree; list incorrectly applies A `/report.md` to B file; B copy200 has exact bytes; listing actual A root500 | ignore-outside-root-evidence.json |
| Actual linked checkout | Instance.worktree=linked checkout, project.worktree=main; main-only and linked-only flags correctly use each checkout | ignore-linked-worktree-evidence.json |

The first Git diagnostic incorrectly combined `-z` with argv paths and returned128; raw results remain in before01. Correct no-z argv probes use existing hostGit (its stdin is ignored), finish0, and establish the recorded Git behavior. Errors in the first domain matrix are cumulative request diagnostics, not claims that later200 requests failed; every row retains its actual status and complete response.

## Recommended single coordinate and matcher

Use one private factory for a listing directory / receipt parent. It reads the current worktree root rules once per call, in existing order, and constructs one matcher. Do not add cross-request caching.

The coordinate is `string | null`, distinct from public Node.path:

1. If the full entry is lexically within Instance.worktree, its original logical worktree-relative pathname wins. Internal junctions, including outward/back-in traversal, and terminal symlink names remain intact.
2. Only for a lexical outside domain, realpath the parent chain upward. Keep its outermost continuous ancestor still physically within the worktree; stop at the first known outside parent. Coordinate = that physical anchor's worktree offset + the original logical suffix from anchor to entry. Resolve ancestors, never the terminal entry. Reuse the one anchor across a listing's rows.
3. If this lexical outside entry's parent chain has no admitted worktree ancestor, current directory permission can still validly admit it. Its coordinate is explicitly not-applicable/null: this unique root's rules do not apply to that other physical directory. Return ignored=false from that proven domain fact, not from errors or an alternate directory rule set.

An empty root offset is valid and produces ordinary nonempty entry coordinates. The worktree container itself has no subordinate entry coordinate; root approved its explicit neutral ignored=false boundary, and a real parent-directory-authority/root-container test now validates it. Unknown rule reads/realpath errors still propagate through the existing HTTP500 error mapper. Non-Git scopes retain their explicit false contract.

The factory accepts each consumer's current directory hint; this batch does not revise the independent junction Node.type discrepancy. Public name/path/absolute fields, filesystem permission, root-source guard, publication, revision and Git text baselines are unchanged.

## Executed read-only commands

Every command prepended the private Bun1.4 directory to PATH and used its absolute exe at `D:/myhexin-local/opencorvus/.tmp-product-iteration/sse-compression-305/bun140/bun-windows-x64/bun.exe`.

- `run --cwd packages/opencorvus test ../../.tmp-codex-file-ignore-01a133/ignore-domain-audit.test.ts`: exit0, one investigation test, 10.59s; before01 raw archive retained.
- Same runner for `ignore-anchor-link-audit.test.ts`: exit0, one investigation test, 7.92s.
- Same runner for `ignore-outside-root-audit.test.ts`: exit0, one investigation test, 5.75s.
- Same runner for `ignore-linked-worktree-audit.test.ts`: exit0, one investigation test, 6.93s.

No POSIX machine or genuine EACCES/device I/O failure was exercised. This preceding matrix remains read-only investigation evidence.

## Authorized implementation progress

The root spec was reread before source modification. Pre-source diff was empty and saved at product-before.diff. The first new-test write tool call had a JavaScript escaping SyntaxError and created no file; it was corrected before running the actual test, not treated as a product failure.

The new file-ignore-coordinate-contract.test.ts ran through the normal Bun1.4 package runner against old product source: 4pass/8fail, 47 assertions, 33.09s, exit1; contract-before.log retains exact outputs including physical publication bytes. All eight failures correspond to explicitly incorrect coordinates/domain/root-container metadata. There were no miswritten product expectations in this run.

Source then replaced both loaders with private createIgnoreMatcher. It uses pure Filesystem.contains for logical and already-realpath physical containment; Windows namespace syntax is normalized without folding output names. It keeps the original rule order, terminal directory hints, Node identity and existing filesystem admission. List constructs one factory and anchor for its whole result; nodeForPath uses the same factory. No cross-request cache is introduced.

The first actual after run passed all12 tests/76 assertions, 40.53s, exit0 (contract-after-1.log), covering accurate root/scoped metadata, parent publication receipts and Unicode/CRLF bytes, both alias domains/back-link, independent and linked Projects, realtime root rule edits, root container, explicit not-applicable domain and a real EISDIR rule-read HTTP500. New-test Prettier check and scoped diff whitespace check exited0. The first typecheck and adjacent root/Git tests exited0, but preceded the independent-review amendment below and are not substituted for final-source qualification.

Independent review found that classifying only the batch parent did not fully implement the planned full-entry logical priority. A natural owned root contains checkout-alias junction pointing to that root; using the alias as scope retains directory/worktree=alias. Listing its physical parent yields an entry exactly equal to the logical worktree container. Parent-only anchor projection incorrectly matched its basename. The rule must be `/checkout-alias` without a terminal slash to discriminate this coordinate error while preserving the existing file Dirent hint.

The new13th actual TCP test ran before amendment:12pass/1fail,79 assertions,36.68s,exit1 (contract-junction-before.log). Its raw64th log line retains the exact alias scope, response200 and Node.path empty/type file/ignored true. Root approved a minimal coordinateFor amendment: first classify normalized fullPath against logical worktree and use its relative identity (empty container neutral); only remaining entries use anchor/null. It does not alter rules, permission, public types or ancestor algorithm.

Final13-test actual TCP qualification passed13/13,79 assertions,40.93s,exit0 (contract-final.log). The amended junction-root case returns200 with exact original empty Node.path/file hint and ignored=false. Final backend typecheck exited0 (typecheck-final.log). Final adjacent18 root tests/294 assertions plus8 Git read tests/57 assertions passed through the normal runner, exit0 (contract-regression-final.log); all39 current-source backend cases/430 assertions passed. Final new-test Prettier check and scoped diff check also exited0. Product-final.diff contains only45 additions/24 deletions in File/index.ts; the only other tracked scope is the new contract file. Nothing was staged or committed by this agent. Root owns real desktop after-state, spec/architecture and Git delivery.
