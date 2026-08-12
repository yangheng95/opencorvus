# CS-015 — Plugin publication without source mutation

## Recall

- User request: fix `CS-015` (`Plugin publishing mutates the source manifest in place`) as an independent batch; write this plan first, obtain a read-only plan review from `/root/backend_infra_audit`, then implement and run focused non-UI positive verification; obtain a final read-only implementation review from `/root/core_runtime_audit`.
- Acceptance:
  - publication never writes `packages/plugin/package.json` or any other authoring input;
  - one immutable staging tree owns the publish-form manifest and compiled `dist` bytes;
  - packing produces and publishing consumes one exact tarball path;
  - focused verification unpacks the tarball, proves its exact file inventory and digest, and imports every public JavaScript export while the source manifest remains byte-identical;
  - no registry publication or other external irreversible write is performed by verification.
- Hard constraints: do not touch B02 files, the `CS-040`/`CS-076` domains, `packages/transport-protocol`, SDK/generated sources, or shared README/index files; do not add or run UI automation; do not publish; preserve unrelated dirty-worktree changes; use only the two explicitly named review agents and do not delegate further.
- Read sources:
  - repository `AGENTS.md`;
  - `specs/current/architecture/04-extensions.md` for the Plugin public role;
  - `specs/records/2026-08/2026-08-12-repository-code-smell-continuous-audit.md:483-495` for `CS-015` evidence and future acceptance;
  - `packages/plugin/package.json`, `packages/plugin/tsconfig.json`, `packages/plugin/tsconfig.type-tests.json`, and `packages/plugin/script/publish.ts`;
  - `packages/sdk/js/script/publish.ts` and `publish-manifest.ts` only as a nearby staging/tarball comparison; SDK files are excluded from this change.
- Full-repository search:
  - `packages/plugin/script/publish.ts` is the only plugin publication implementation and has no automated workflow caller;
  - public Plugin consumers import the package root and the subpaths `tool`, `files`, `artifact-catalog`, `project-path`, and `task-artifact`;
  - the source manifest exposes those six entry points from `src/*.ts`, while `files` contains only `dist`;
  - current Plugin tests cover runtime/type contracts but not publish packaging.
- Initial observable behavior: after `bun tsc`, the script mutates the imported manifest object, writes it over the authoring `package.json`, runs a combined pack/publish shell command, and restores the original only after success. Pack, npm, network, credential, process, or shell failure leaves the source manifest in release form. The command also publishes a wildcard tarball rather than the exact pack output.
- Root cause: authoring and release manifests share one physical path; there is no immutable publication input tree or exact tarball receipt.
- Existing structure does not cure it: best-effort restoration still has a failure/crash window, and adding `finally` would retain the dual-state source manifest and wildcard artifact selection.
- Affected contract/data/delivery: Plugin export map, declaration/runtime file pairing, npm tarball inventory, manual publisher selection, workspace cleanliness. Runtime Plugin APIs do not require a contract change.
- Independent agent feedback before implementation: none (parallel slots occupied). The requested reviewer was already implementing an unrelated batch and declined concurrent review; the primary agent then explicitly removed this pre-implementation review gate.

## Plan

1. Add a pure Plugin publish-manifest builder that deep-clones the authoring manifest, validates every public export as a `./src/*.ts` target, and maps it to explicit `types` and `import` targets under `./dist`; reject unsupported manifest shapes instead of carrying a fallback.
2. Add a staging helper that creates a caller-selected empty directory, copies only compiled `dist`, writes the transformed `package.json` there, inventories the staged files, and returns a typed receipt. Authoring files remain read-only inputs.
3. Rewrite the manual publish entry point to build, create a unique temporary root, stage the package, pack from that tree to one explicit tarball filename, publish that exact path with the current channel/access, and remove the temporary root in `finally`. Verification will not invoke the npm publish step.
4. Add a focused non-UI positive test that uses a temporary package fixture, stages and packs it, unpacks the tarball, asserts the exact publish file list and SHA-256 digest receipt, imports every public JavaScript export, and verifies the authoring manifest bytes are unchanged.
5. Run the focused test, Plugin typecheck/build, and task-owned diff checks. Request `/root/core_runtime_audit` to review the complete implementation and evidence; fix valid findings and rerun affected checks before committing only task-owned files.

## Positive verification outputs

- Staging receipt contains the exact normalized file list and a 64-character lowercase SHA-256 content digest.
- Unpacked tarball contains exactly `package/package.json` plus the staged `dist` files (npm-generated metadata is admitted only if demonstrated and explicitly normalized by the test).
- Every manifest export resolves to a declaration file and an importable JavaScript module in the unpacked package.
- Source `package.json` bytes before and after staging/packing are identical.
- Publication command accepts the exact tarball path returned by the local pack step; no wildcard lookup exists.
- UI automation: not applicable and not run.

## Implementation verification

- `bun test --timeout=0 test/publish-package.test.ts` from `packages/plugin`: passed, 2 tests / 8 assertions. The test built the Plugin, staged and packed a local tarball, unpacked it, matched the exact staged file list and content digest, loaded all six public JavaScript exports with their installed dependencies, found every declaration target, and matched the source manifest bytes before and after.
- `bun run typecheck` from `packages/plugin`: passed for runtime and type-contract configurations.
- `bun run build` from `packages/plugin`: passed.
- `git diff --check` on the four task-owned paths: passed.
- External publication: not run.
- UI automation: not run.
- Independent implementation review: the first read-only review found two `P2` defects in the staging source and public-package verification. Both findings were repaired as recorded below; the final independent re-review by `/root/backend_infra_audit` returned PASS with no unresolved `P0`-`P3` finding. The batch remains unpublished and uncommitted pending exact multi-batch delivery assembly.

## Independent implementation review findings

- `P2`: the first implementation ran `tsc` against the authoring package's ignored `dist` directory and then copied that directory into staging. Because TypeScript does not remove outputs for renamed or deleted sources, a historical `.js`/`.d.ts` pair could enter the staged inventory and digest while the self-derived inventory assertion still passed. The corrected boundary must compile directly into an empty staging `dist`; source `dist` is not a publication input. Positive verification must put a historical residual in the source fixture and prove the exact tarball inventory is derived only from current source entries.
- `P2`: the first import verification converted each manifest target to an absolute `file:` URL. That bypassed package-name/subpath export resolution and did not ask TypeScript to resolve the published declarations. The corrected verification must install the unpacked package under an independent consumer's `node_modules/@opencorvus-ai/plugin`, import all six public package specifiers through Bun, and typecheck a consumer importing the same six specifiers.

## Review-finding remediation verification

- The staging helper now creates the staging package first and invokes the workspace's pinned TypeScript compiler with `rootDir=<source>/src` and `outDir=<new staging>/dist`. It no longer reads or copies source `dist`; the manual publisher uses this helper as its only build/staging authority.
- The focused fixture copies current authoring sources into an isolated package, places `historical-entry.js` and `historical-entry.d.ts` in that fixture's source `dist`, and derives the expected staged/tarball inventory from the current source entries. Both historical files are excluded by the positive exact-inventory assertion.
- The unpacked tarball is installed under an independent consumer's `node_modules/@opencorvus-ai/plugin`. All six public package specifiers are imported by Bun from that consumer, and a TypeScript consumer imports types from the same six specifiers using bundler package resolution.
- `bun test --timeout=0 test/publish-package.test.ts`: passed, 2 tests / 8 assertions.
- `bun run typecheck`: passed for runtime and type-contract configurations.
- `bun run build`: passed.
- Task-owned `git diff --check`: passed; no publication/test scratch directories remain.
- Independent remediation review: PASS. The reviewer verified direct compilation into a new staging `dist`, exclusion of historical source-`dist` residue, exact staged/unpacked inventory and digests, all six real package-specifier imports plus TypeScript resolution, byte-identical source manifest, one exact tarball path, and unconditional scratch cleanup. No commit or publication has been performed.
