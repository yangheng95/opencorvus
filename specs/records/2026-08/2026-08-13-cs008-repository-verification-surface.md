# CS-008 — One repository verification surface

## Recall

- User requirement: continue the accepted `CS-001..078` code-smell remediation to zero, use independent work in parallel where file ownership does not collide, merge current upstream before the final push, and do not stop at planning or partial fixes.
- Accepted finding: `CS-008` records that local `typecheck`, the GitHub Actions workflow named `typecheck`, Turborepo, Astro, and Knip currently describe different repository quality surfaces. A contributor can run a command named as repository-wide verification while omitting the AI runtime compatibility check, the Web package, transport/dead-code workspaces, or known dead-code findings.
- Acceptance target: one root verification command is the only local, pre-push, and GitHub Actions composition authority; every typed workspace participates under one `typecheck` task contract; the root workspace manifest owns repository membership while Knip owns only per-workspace entry/project/plugin semantics and exits clean after accepted dead islands are removed.
- Hard constraints: no parallel workflow-only composition, no Knip ignore that hides a real island, no static absence test, no User Interface (UI) automation, no compatibility alias that preserves two differently scoped verification commands, and no unrelated package cleanup. Focused positive checkers must prove the resolved task graph and successful current command.
- Sources read: root `AGENTS.md`; the `CS-008` register entry and remediation program; root `package.json`; `turbo.json`; `.github/workflows/typecheck.yml`; `.husky/pre-push`; `knip.config.js`; every workspace `package.json`; Overlay Vite multi-entry configuration and native-menu document; current workflow-contract test; current `check:dead-code` output; and `bunx turbo run typecheck --dry=json` output.
- Whole-repository search and observed facts:
  - root `typecheck` runs `check:sdk-imports`, `check:ai-runtime`, then `turbo run typecheck`; pre-push calls that root command;
  - `.github/workflows/typecheck.yml` instead runs `check:sdk-imports` and raw `turbo run typecheck`, so it skips `check:ai-runtime` and is a second composition;
  - `@opencorvus/web` exposes only `check: astro check`, so Turbo's `typecheck` graph omits Web; `@opencorvus-ai/script` has TypeScript sources and a `tsconfig.json` but no `typecheck` script;
  - transport-protocol has a real `typecheck` task and appears in Turbo, but root `check:dead-code` omits it and Web from a second hand-maintained workspace list;
  - Knip discovers workspace membership from root `package.json#workspaces` even when `knip.config.js` omits a workspace block; the config omission therefore does not exclude the package cleanly—it leaves Knip to infer incomplete entry/project semantics. Current focused runs report 18 Web files plus 5 dependencies and 4 transport test files, proving that a vague “add the workspaces” change would remain red or hide delivery entry points;
  - `knip.config.js` does not define Web or transport-protocol entry/project semantics and does not include Overlay's real `src/native-menu.html` Vite entry;
  - Web's current `check` has a `precheck` lifecycle that generates brand and public-market inputs. Renaming only the main script would silently drop this preparation; deployment workflow and Web README also call the old command;
  - `@opencorvus-ai/script` extends `@tsconfig/bun` and needs `typescript`, but declares neither directly, so adding a typecheck command without dependencies would rely on root hoisting;
  - required dead-code validation currently uses `bunx knip@6.27.0`; a cold/frozen environment can require registry resolution even though the checker is meant to be a deterministic required gate;
  - the current real command reports six files, one dependency, and two binaries: five files are the `CS-007` dead islands plus the live native-menu false positive; `@opencorvus-ai/util` is consumed only by Overlay build/test scripts and belongs in development dependencies; `ps` is an intentional operating-system process-inspection binary in two production process owners and needs an explicit external-binary declaration, not a package dependency;
  - no CI or pre-push owner runs the dead-code checker.
- Implementation discovery: once the command-line Knip workspace allowlist was removed, the complete production graph also exposed root delivery scripts and Expert Squad tools as unmodeled root-workspace entries, Overlay's HTML-loaded `native-menu.tsx`, Browser's Windows `taskkill` peer to its existing POSIX `ps` host binary, two root workspace dependencies with no import consumer, and `packages/web/src/i18n/locales.ts` with zero repository consumers. The root graph now models those real entries, keeps both host binaries scoped to `packages/opencorvus`, removes the unused root dependencies and Web file, and records the latter deletion in this task rather than hiding it.
- Current dirty-worktree boundary: an independent Browser MCP task owns Overlay/Browser/Workspace/extension-architecture files. `CS-007` owns the five real Overlay dead islands and path migration. `CS-008` must wait for reviewed `CS-007` deletion before enforcing a green Knip result and must not edit those files itself.
- Independent-agent feedback: none yet for this focused plan. The accepted register itself was independently saturated and reviewed; a new uninvolved focused plan review is required before implementation.

## Root cause and why prior paths do not cure it

The repository has no single callable verification authority. Root scripts, a workflow, Turborepo task discovery, package-specific script naming, Knip workspace selection, and pre-push each independently compose a plausible subset. Their names imply equivalence, but no consumer delegates to one exact root receipt. Adding another workflow step would only create a third list. Adding Knip ignores for the native-menu entry or live external binaries would make the optional command quieter without making its model true. Leaving Web's `check` name intact would preserve the task-graph omission even if CI called the root command.

The repair therefore has two linked boundaries. The execution boundary is one root `typecheck` composition consumed verbatim by local users, pre-push, and the typecheck workflow. The discovery boundary uses root `package.json#workspaces` as the sole membership authority and `knip.config.js` as the sole entry/project/plugin semantics authority, without a duplicated command-line workspace list. Package manifests continue to own how a package typechecks; they do not independently choose whether the repository invokes them.

## Target design

### 1. One root verification composition

Keep `bun run typecheck` as the public repository verification command and make it the only composition owner, in this exact order:

1. `check:sdk-imports` validates the generated Software Development Kit (SDK) import boundary;
2. `check:ai-runtime` validates the AI runtime dependency contract;
3. `turbo run typecheck` executes every workspace's uniform typed task;
4. `check:dead-code` validates the complete production dependency/entry graph after `CS-007` removes its accepted islands.

The GitHub Actions typecheck job invokes `bun run typecheck` once after its existing generated SDK/OpenAPI/docs drift checks. It deletes its separate SDK-import and raw-Turbo composition steps. Pre-push already invokes the root command and remains a consumer, not a second list. `typecheck:fresh` continues to clean caches and delegate to the same root command. No `verify` alias with different membership is added.

### 2. Uniform typed workspace contract

- Add `typecheck: "astro check"` to `@opencorvus/web` and move only the deterministic typecheck prerequisite to `pretypecheck: "bun run brand:assets"`; remove both `check` and `precheck` rather than retaining aliases. The checked-in `src/content/expert-squad-distribution.generated.ts` is the typed website input, so `astro check` neither needs nor owns the 115-package signed archive/publication generator. `market:data` remains the single publication/build preparation owner under `prebuild`, `predev`, `prestart`, registry tests and explicit delivery commands; it is not duplicated by a typecheck-only generator. Migrate every real typecheck caller, including `.github/workflows/deploy-opencorvus-com.yml` and `packages/web/README.md`, to `typecheck` in the same change.
- Add `typecheck: "tsc --noEmit"` to `@opencorvus-ai/script`, whose existing `tsconfig.json` and TypeScript sources already define the typed boundary. Declare `typescript: "catalog:"` and `@tsconfig/bun: "catalog:"` directly in that package's development dependencies and update the lockfile canonically; do not rely on root hoisting.
- Preserve the existing `typecheck` scripts for channel-config, channel-runtime, OpenCorvus, Overlay, Plugin, SDK, transport-protocol, and Util.
- Turbo continues to derive membership from package manifests. No extra package-name registry is introduced.

The positive graph contract is the output of the locally installed Turbo binary through `bun run turbo -- run typecheck --dry=json` (Turbo is already a root development dependency): its task packages must equal the root workspace packages that expose the uniform `typecheck` contract, including Web, Script, and transport-protocol. The focused checker derives expected membership from root workspaces/package manifests rather than embedding a second package list.

### 3. One actionable Knip graph

- Add exact `knip: "6.27.0"` to root development dependencies through Bun and update `bun.lock`; `check:dead-code` invokes the installed Knip binary as `bun run knip -- --config knip.config.js --no-progress --production --include files,dependencies,unlisted,binaries`, never `bunx` network resolution. The frozen install is allowed to download exact lockfile dependencies and must leave manifests and `bun.lock` byte-identical; only the subsequent checker phase, after dependencies are installed and network is disabled with an empty isolated Bun download cache, must perform no package resolution or download and must likewise leave manifests and lock byte-identical.
- `check:dead-code` calls Knip with its config and include policy only; remove every command-line `--workspace` selector. Root `package.json#workspaces` remains the only membership authority; `knip.config.js` owns only how each discovered workspace maps its real entries/projects/plugins.
- Add Web semantics explicitly:
  - runtime/config entries: `astro.config.mjs!`, `config.mjs!`, `src/content.config.ts!`, and `src/pages/**/*.{astro,ts}!`;
  - delivery script entries: `script/generate-brand-assets.ts!`, `script/generate-public-market.ts!`, `script/generate-expert-squad-distribution.ts!`, `script/copy-landing-downloads.ts!`, `script/package-website-runtime.ts!`, `script/prepare-website-registry.ts!`, and `script/website-registry-control.ts!`, matching actual manifest/workflow consumers;
  - production project: `astro.config.mjs!`, `config.mjs!`, `src/**/*.{astro,ts,tsx,js}!`, and `script/**/*.ts!`; every explicit project pattern carries Knip's production `!` marker so `--production` still inspects newly added unreachable Web source and delivery scripts. Explicitly exclude `test/**`, `qa/**`, generated `dist/**`, and temporary runtime output. QA and test programs remain under their dedicated commands and are not misclassified as public production roots.
- Add transport-protocol semantics as `entry: ["src/index.ts!"]`, `project: ["src/**/*.ts!"]`, and explicit `ignore: ["test/**"]`; its four test files are verification consumers, not production entries.
- Add Overlay `src/native-menu.html!` as the real Vite multi-entry document. Do not ignore `native-menu.tsx` or its imports.
- Retain `CS-007`'s five proven island deletions as the fix for those file findings; do not suppress them here.
- Move Overlay's `@opencorvus-ai/util` from production dependencies to development dependencies because repository search shows only build/test script consumers. This keeps the dependency declared at its actual lifecycle boundary rather than adding a Knip exception.
- Add `ps` only to `packages/opencorvus`'s workspace-scoped `ignoreBinaries`, because the two production process owners live there and intentionally execute that host operating-system binary. Do not create a root-wide exception.

After these changes, one real `bun run check:dead-code` must finish successfully over every discovered production workspace. A focused Knip debug/JSON receipt must positively show Web pages/config/scripts, transport `src/index.ts`, and Overlay `src/native-menu.html` entering the graph, and must match root workspace membership; exit code alone is insufficient because ignores or omitted entries can also appear green. Knip remains a required member of the root verification command; it is no longer an optional permanently-red diagnostic.

Moving Overlay's `@opencorvus-ai/util` to development dependencies is justified by a separate repository import inventory plus successful execution of the real `generate-app-icons` and unit-runner tool paths that consume it. Production-mode Knip intentionally excludes development dependencies and is not claimed as the sole proof of that lifecycle classification.

## Complete affected surface

- Root composition/dependency authority: `package.json`, `bun.lock`, `turbo.json` only if the uniform task needs explicit configuration (currently it does not), `.husky/pre-push` as a verified unchanged consumer.
- CI: `.github/workflows/typecheck.yml` and the existing non-UI workflow contract test.
- Package task contracts: `packages/web/package.json`, `packages/web/README.md`, `packages/script/package.json`.
- Dead-code graph: `knip.config.js`, root `check:dead-code`, Overlay dependency classification, and `CS-007`'s separately owned dead-island deletions.
- Newly exposed dead surface: delete `packages/web/src/i18n/locales.ts`, whose exports have no repository consumer; no replacement contract is required.
- Documentation: this record, both spec indexes, and any current contributor/check documentation found to name the old `check` command or raw workflow composition. No public API, database, OpenAPI, generated SDK, runtime protocol, or UI behavior changes.
- Delivery: focused graph/checker tests, actual root verification, docs check, task-owned diff check, and uninvolved read-only review.

## Positive verification

1. Run a focused repository-verification checker that reads root workspace declarations and package manifests, invokes Turbo dry-run JSON, and asserts an exact one-to-one mapping between typed workspace manifests and scheduled `typecheck` tasks. Assert Web, Script, and transport-protocol through their real package identities and commands.
2. In a fresh temporary checkout/copy containing no generated Web runtime/publication outputs beyond tracked source, run `bun install --frozen-lockfile` and `bun run --cwd packages/web typecheck`. Assert `pretypecheck` publishes the favicon from the canonical tracked logo, Astro consumes the tracked typed distribution module and succeeds without building signed ZIP/catalog/registry outputs, and exact tracked generated artifacts remain byte-identical/clean afterwards. The fixture must not use the current dirty worktree as its cleanliness authority.
3. Parse the real typecheck and deployment workflows through the existing workflow contract test and assert the typecheck workflow invokes root `bun run typecheck` after generated artifact/docs checks while Web deployment invokes `bun run --cwd packages/web typecheck`. These are positive mappings to canonical commands, not source-absence tests.
4. Run Knip with its debug/JSON reporter after reviewed `CS-007` deletion and assert the receipt's discovered workspace set equals root manifest membership and the named native-menu/Web/transport entries are present. Then run `bun run check:dead-code`; it must return success with the workspace-scoped `ps` contract. Separately run the real Overlay icon-generation/unit-tool consumers to prove Util's development lifecycle.
5. In an isolated environment, first allow network access and run `bun install --frozen-lockfile` from the exact committed lockfile; assert the install leaves `package.json` and `bun.lock` byte-identical. Then retain that installed `node_modules`, disable network access, point Bun at a new empty isolated download cache (never the user's global cache), and run `bun run check:dead-code`. Assert the checker succeeds without package resolution or downloads and again leaves every manifest and `bun.lock` byte-identical. The frozen install proves lockfile reproducibility; the separate offline checker phase proves the required command uses the already installed, pinned Knip binary rather than `bunx` or registry fallback.
6. Run `bun run typecheck` and prove the canonical composition returns success, including the AI runtime check, complete Turbo graph, and Knip receipt. Run `typecheck:fresh` only if cache behavior is implicated; it must delegate to the same command.
7. Run the existing SDK/OpenAPI/docs drift checks that the workflow keeps adjacent to, but outside, typed verification. They are separate generated-artifact contracts, not another typecheck composition.
8. Run task-owned `git diff --check`, update the plan's Verification log, then obtain an uninvolved read-only review. Repair every valid finding and repeat until PASS before committing.

## Sequencing and risk

- `CS-007` is a hard predecessor for enabling a green required dead-code check. Land its reviewed deletion first; this task must not hide those findings or delete the islands a second time.
- Overlay/Browser currently has unrelated dirty work. Do not move the Util dependency or Knip native-menu entry until that owner is clean and the exact manifest/config hunks can be isolated.
- Browser's parallel production change added Windows `taskkill`; CS-008 changes no Browser source and only records that binary beside `ps` in the same package-scoped Knip host-binary declaration.
- Adding the exact Knip development dependency intentionally updates `bun.lock` once. All subsequent required checks use the installed binary under frozen installation and must not change the lock or fetch a transient version.
- CI duration increases because the canonical command now includes AI compatibility and dead-code checks. That is intentional coverage, but measured execution time and network-free behavior must be recorded; if `bunx` requires network, provision the pinned Knip dev dependency rather than creating a CI-only fallback.
- Do not add a generated workspace manifest, package-name allowlist, workflow matrix, or Knip workspace selector as another source. Membership remains root workspaces/package manifests for both Turbo and Knip; `knip.config.js` owns static dependency entry/project/plugin semantics only.

## Verification log

- `bun run ./script/check-repository-verification.ts` succeeded and emitted protocol `opencorvus/repository-verification-graph@2` with ten typed workspaces plus the real Knip-resolved Overlay native-menu, transport root, and Web config/page/delivery entry receipt; its exact manifest-owned commands included Web `astro check`, Script `tsc --noEmit`, and transport-protocol `tsc --noEmit`.
- `bun test --timeout 30000 script/repository-verification-contract.test.ts script/github-actions-workflow-contract.test.ts` passed 9/9 focused positive contracts (70 assertions), including a live Knip debug graph observation rather than a static config-only assertion.
- `bun run --cwd packages/script typecheck` passed. Overlay's real Util consumers also passed through `bun run --cwd packages/overlay icons:generate` with no tracked icon diff and `bun run --cwd packages/overlay test:unit test/api-error.test.ts` with 8/8 non-UI unit contracts.
- `bun install --frozen-lockfile --no-progress` passed with byte-identical `package.json` and `bun.lock` SHA-256 receipts before and after. With installed dependencies retained, an empty temporary `BUN_INSTALL_CACHE_DIR` and an unreachable loopback registry, `bun run check:dead-code` executed the pinned local Knip binary and reported only the five `CS-007` predecessor files; it performed no dependency resolution and the temporary cache was removed.
- After the separately owned `CS-007` dead-island deletion, `bun run check:dead-code` succeeds across the complete production graph with zero file, dependency, binary or unlisted findings; no ignore was added for those islands.
- Initial `pretypecheck` incorrectly reused the delivery-only `market:data` publisher. Independent review measured the canonical market projection at seconds but its 115 sequential signed ZIP publications at at least fifteen minutes, making repository typecheck non-terminating in normal verification time. The contract now keeps the tracked typed distribution module as Astro's input and limits `pretypecheck` to deterministic brand generation. `bun run --cwd packages/web typecheck` completed in 171.1 seconds with Astro reporting 0 errors and 0 warnings (19 informational hints) and without generating the signed archive/catalog publication set.
- `bun run docs:check` passed with 336 operations in 25 groups. No UI automation was run.

## Delivery state

- Recall, current command/task/CI/Knip data flow, root cause, target single authority, affected surface, positive verification, and sequencing are complete.
- Focused independent plan review passed after four revision rounds.
- CS-008 production changes and focused verification are complete. Final repository-wide `bun run typecheck` still depends on the current parallel CS-004/Browser typecheck surface settling, but the CS-008-owned Web, Script, Turbo graph, Knip graph, offline binary, workflow and dependency-lifecycle contracts are green and ready for independent rereview.
- Commit, final upstream merge, and push are deliberately left to the parent delivery owner; this implementation agent did not stage, commit, merge, or push.
