# Expert Squad on-demand installation

## Recall

| Item | Record |
| --- | --- |
| User request | Stop preinstalling every repository-hosted Expert Squad, restore the small default set, and add an “Install more Expert Squads” choice to the Expert Squad picker. The previously withdrawn checklist and automatic remote-search feature must not return. |
| Acceptance criteria | A fresh project exposes only the four embedded defaults (`base`, `advanced`, `research-studio`, and `squad-sdk`) until the operator installs another package; the complete repository-hosted payload remains visible in Squad Market; an Expert Squad picker action opens that existing Market surface; choosing the action never becomes a Squad selection; an exact Market package can be installed and resolved through the production HTTP path. |
| Hard constraints | Preserve all unrelated worktree changes and existing installed package directories. Do not silently uninstall packages that earlier releases provisioned. Keep `prompt_profile.active` as the sole active identity, the generated payload as the sole repository-hosted Market source, and the existing Settings Market as the sole installer UI. Do not add or run UI automation. Use real-page interaction and screenshots for UI acceptance. |
| Sources read | Root `AGENTS.md`; `specs/current/architecture/04-extensions.md`; the pre-`0280ca270` project bootstrap; current `project/bootstrap.ts`, Expert Squad Manager/Registry/built-in sources/runtime paths/routes, default-payload tests, generated payload consumers, Overlay dialog store and control, Expert Squad Market panel, Composer reference picker, Mission creation dialog, shared SelectControl, app composition, i18n, and relevant styles. |
| Whole-repository search | Searches covered `provisionDefaultPayloadPackages`, `releasePayloadPackages`, `payloadPackageSources`, payload provisioning ledger paths/types/tests, all project-bootstrap callers, `expert-squad-install`, `openConfigDialog`, Composer and Mission Expert Squad selector owners, Market install routes, and default/Market architecture records. Before commit `0280ca270`, bootstrap had no payload provisioning stage; the same four embedded packages already owned the default catalog. |
| Independent agent feedback | None before implementation. A separate read-only agent must review the complete implementation and evidence after the first validation pass. |

## Problem and root cause

The visible symptom is that every repository-hosted package appears installed in every newly opened project. The direct trigger is `InstanceBootstrap` calling `provisionDefaultPayloadPackages()` before configuration validation. That Manager operation iterates the complete generated `payloadPackageSources` distribution catalog and materializes every entry under the project’s `.opencorvus/expert-squads/` tree.

The generated payload is the correct source for packages that the application can distribute and display in Market, but it is not a product-default selection. The 2026-08-11 provisioning change conflated these two responsibilities and introduced a runtime ledger to continually reconcile all distribution entries. Earlier behavior already had a complete small default catalog through the four embedded packages, which resolve before any project-owned installation exists. Adding filters or a second default-ID array would retain the mistaken lifecycle and create another catalog-like fact source.

Existing project packages are user-visible bytes and may have been modified after provisioning. Removing the bootstrap writer must therefore leave them untouched. The retired ledger can become inert; it must not be interpreted as authority to remove previously managed packages.

## Single-source design

1. Remove the payload provisioning stage from project bootstrap and delete the payload-specific reconciliation contract, result type, ledger schema/path, and its obsolete interruption/provisioning tests.
2. Keep the four embedded sources as the only automatic defaults. Their existing catalog and Base active-profile contracts remain unchanged.
3. Keep the generated payload and all Market detail/install/update APIs unchanged. The explicit `release-payload` API remains an operator-invoked bulk installation operation; it is not called by bootstrap or the picker.
4. Add one action owned by each editable Expert Squad picker. The action calls `openConfigDialog("expert-squad-install")`, which opens the existing Market. It does not write a Composer mention, Mission Squad ID, active profile, or installation itself.
5. Localize the action and supporting description in English and Chinese. Reuse the existing package-plus icon and shared control styles; do not create another installer or remote-search surface.

## Migration and lifecycle

- Fresh projects receive no project-local payload packages. Their effective catalog still contains the four embedded defaults.
- Projects opened by prior releases keep every existing project/global package byte-for-byte. Without the bootstrap reconciliation call, no previous ledger entry can reinstall, update, or remove a package.
- New repository-hosted packages become Market entries only. Installation, update, uninstall, project/global scope, revision digest, and active-profile behavior remain owned by the existing Manager/Registry/Resolver path.
- The obsolete ledger file may remain on disk as inert historical runtime data. No migration deletes it because deletion is unnecessary and the user did not authorize cleanup of project runtime history.

## Implementation surface

| Surface | Change |
| --- | --- |
| `project/bootstrap.ts` | Remove the automatic payload reconciliation stage and Manager dependency. |
| `expert-squad/manager.ts`, `project/runtime-paths.ts` | Remove only the now-dead default-provisioning result, ledger, and reconciliation operation; preserve general replacement recovery and explicit Market/bulk install paths. |
| focused non-UI tests | Replace “95 packages are preinstalled” acceptance with fresh embedded-default catalog plus exact Market install and Resolver evidence. Preserve generic package-replacement journal coverage in an appropriately named Manager test. |
| Overlay picker components and app composition | Add one install-more action and route it to the canonical Market dialog. |
| i18n and minimal styles | Add bilingual action copy and visually align the action with existing rich picker rows. |
| current architecture | Separate embedded defaults from repository-hosted Market availability and record the inert-ledger migration boundary. |

## Verification

1. `bun test test/expert-squad/package-replacement-interruption-recovery.test.ts test/expert-squad/package-replacement-recovery.test.ts` in `packages/opencorvus` passed with `4 pass / 0 fail / 14 expect`. The cross-process probe interrupts `importDirectory` both before and after replacement publication, then enters recovery through normal `ExpertSquadRegistry.discoverAvailable()` discovery. It proves operator-owned partial target bytes are preserved, Manager-owned partial staging/discard bytes are removed, the before revision can be restored, and an exact after revision can be committed. The focused same-process tests retain the committed-receipt and tampered-journal contracts.
2. `bun test test/expert-squad/legacy-payload-migration-production-route-e2e.test.ts` passed with `1 pass / 0 fail / 3 expect`. Its isolated child process installs one project-scoped and one global-scoped package, adds operator bytes, writes the retired provisioning ledger, and then starts the real `Server.App()`. The first `/expert-squad/catalog` bootstrap preserves both installation scopes, both package digests, both complete package-tree byte digests, and the exact ledger bytes while retaining Base as active.
3. `bun test test/expert-squad/on-demand-payload-production-route-e2e.test.ts` passed with `1 pass / 0 fail / 1 expect`. Its real child-process `Server.App()` probe made 12 HTTP requests and proved a fresh isolated project exposes exactly the four embedded defaults, reports all 95 payload packages in Market with no project installation scopes, installs `one-person-company-operating-system` through `market/detail -> install-payload`, resolves the installed immutable revision with exact scheduler/worker Skill projection, and rechecks after installation that Base and its production Skill grant remain active.
4. `bun run typecheck` passed in both `packages/opencorvus` and `packages/overlay`; `bun run docs:check` passed with `docs:check ok (329 ops, 25 groups)`; the 20 staged owned text blobs other than shared `main.tsx` passed Prettier 3.6.2, and the three task-owned `main.tsx` hunks are unchanged by Prettier. The current HEAD version of that shared file already has five unrelated full-file formatting differences, so this task does not stage them. Relevant `git diff --check` passed. No UI automation was added, modified, or run.
5. `bun run build:vite` in `packages/overlay` completed a real production build with 7,100 transformed modules. A transient local `node_modules` break was repaired through the locked Bun install using a reachable registry before the original build acceptance was rerun; no source or lockfile workaround was introduced.
6. An isolated real Overlay server at port 4337 was opened with an isolated `OPENCORVUS_HOME` and project. Manual browser interaction proved the Composer picker contains only `Advanced`, `Base`, `Research Studio`, `Generate Agent Squads`, plus the install-more action; the action opens the canonical Market with `95 available` and an active project scope. The Mission creation picker exposes the same four defaults plus the action, and its action reaches the same 95-entry Market without changing the selected Squad. The current-build screenshots are [Composer install-more picker](../../artifacts/2026-08-11-expert-squad-on-demand-installation/01-install-more-picker.jpg), [Squad Market with 95 available](../../artifacts/2026-08-11-expert-squad-on-demand-installation/02-squad-market-95-available.jpg), and [Mission install-more picker](../../artifacts/2026-08-11-expert-squad-on-demand-installation/03-mission-install-more-picker.jpg). Manual inspection found no clipping, ambiguous selection state, unreadable contrast, or competing installer surface.
7. The first separate read-only review found three evidence gaps: legacy-ledger migration safety, real cross-process generic replacement recovery, and a post-install active-projection check. The tests above close all three; the completed staged tree receives a second independent read-only review before commit.
