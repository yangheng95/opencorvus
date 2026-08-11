# Public download page and release synchronization

## Recall

### User request

- Add a download page to the existing OpenCorvus website.
- Automatically present the download for the visitor's operating-system platform.
- Make GitHub Actions releases appear on the website automatically, including automatic version updates.
- Continue from the current website and preserve its visual language; do not create a separate theme or unrelated landing site.

### Acceptance indicators

- English `/download/` and Simplified Chinese `/zh-cn/download/` are real routes inside the existing Astro public site.
- The shared public header exposes one localized Download navigation item and active-page state.
- The page uses the existing paper, ink, cobalt, border, display-font, monospace-index, card, action, header, footer, and focus primitives.
- The page reads one same-origin static release manifest, displays its version and publication date, and recommends the visitor's Windows, macOS, or Linux section without claiming an architecture that the browser cannot reliably identify.
- Desktop installers and command-line archives come from the exact version-tag-bound assets published by the canonical `build.yml` release workflow.
- A successfully published version dispatches the existing `deploy opencorvus.com` workflow and explicitly enters its production deploy condition. Every ordinary website deployment resolves the highest published semantic version, so a later website-only deployment or delayed older release event cannot restore stale release data.
- No page source, package metadata, manually edited version, GitHub API call from the browser, or second runtime endpoint becomes a competing release fact source.

### Hard constraints

- Preserve the current dirty-worktree changes in `packages/web/src/components/Lander.astro`, `PublicSiteFooter.astro`, both homepage MDX files, `landing.ts`, the public website iterative-design record, the existing uncommitted lines in both spec indexes, and all untracked Expert Squad work.
- Do not modify the current homepage download-discovery path in this iteration; the parallel approved homepage program already owns its later removal. The new download page must not depend on that optional local-artifact surface.
- Do not add, change, or run User Interface (UI) automation tests. Real-page screenshots and human visual review are the UI acceptance method.
- Add focused non-UI tests for the manifest transformation and GitHub Actions control-flow contract.
- Do not publish a tag or Release during implementation. The workflow change is validated statically and becomes active only on a future user-authorized release.
- Do not add a client-side GitHub REST call. The browser reads only `/downloads/latest.json` from `opencorvus.com`.
- Do not copy release binaries onto RackNerd. The manifest contains version-tag-bound GitHub Release asset URLs, while the existing website serves the small manifest and the page. The current release workflow can replace assets under an existing tag with `--clobber`; this record does not misstate those URLs as byte-immutable.
- Do not create a parallel stylesheet or visual asset. The implementation uses the existing public-site system and scoped page composition only.

### Repository and workspace baseline

- Repository: `D:\myhexin-local\opencorvus`.
- Remote: `origin=https://github.com/yangheng95/opencorvus.git`.
- Branch: `main`.
- Starting commit: `136ca913eb9c829d5da6337f6ed6291e5c4d5ee3`.
- Existing website: `packages/web`, Astro `7.2.0` with the shared `PublicSiteLayout`, `PublicSiteHeader`, `PublicSiteFooter`, and `public-site.css` sources.
- Existing public release workflow: `.github/workflows/build.yml` packages five desktop and five command-line matrix rows, stages validated release assets, publishes a version-tagged `v<version>` Release, then updates the mutable desktop update channel.
- Existing production workflow: `.github/workflows/deploy-opencorvus-com.yml` builds and signs the static candidate and atomically deploys it to RackNerd.

### Materials read and searches performed

- `AGENTS.md` and the current public website iterative-design program.
- `packages/web/package.json`, `PublicSiteHeader.astro`, `PublicSiteLayout.astro`, `PublicSiteFooter.astro`, `Lander.astro`, `landing.ts`, `public-site.css`, `landing-download.ts`, and `copy-landing-downloads.ts`.
- `.github/workflows/build.yml`, `.github/workflows/deploy-opencorvus-com.yml`, `script/release-asset-contract.ts`, `stage-release-upload-assets.ts`, and `generate-desktop-update-manifest.ts`.
- Historical landing artifact-discovery records and the current public Release naming evidence.
- Whole-repository searches for public routes, download consumers, generated downloads, release URLs, workflow triggers, and workflow contract tests.
- GitHub's current documentation confirms that `repository_dispatch` is an explicit exception that still creates a workflow run when emitted with `GITHUB_TOKEN`, and that creating the repository dispatch requires Contents write permission.

### Independent agent feedback

- First plan-review verdict: `REJECTED`.
- Blocking finding 1: adding a `repository_dispatch` trigger alone would run the workflow but would not satisfy the current `sign-and-deploy` job condition when automatic deployment is disabled. The revised contract below explicitly includes `repository_dispatch` in that production job condition.
- Blocking finding 2: new spec records are ignored by the repository's local `/specs/` rule and repository policy requires both spec indexes to be updated. The revised boundary requires force-adding this exact record, adding one owned link to each index, and using patch-level staging plus cached-difference review so the parallel index lines remain unstaged and intact.
- The first reviewer also requested closure of delayed/stale release ordering. The revised generator consumes the complete eligible versioned Release list and selects the highest valid Semantic Version (SemVer), while a dispatch payload must identify one published member of that list. An older delayed event therefore rebuilds the current highest release instead of downgrading the public page.
- Repeat plan-review verdict: `APPROVED`. The reviewer confirmed that the production condition, highest-SemVer convergence, payload validation, exact spec/index staging, and version-tag-bound URL wording close every prior blocker.

## Observable phenomenon and user impact

- The public website has no dedicated Download route or navigation item.
- `Lander.astro` can render installers only when local `packages/overlay/dist-artifacts` directories exist. The production website workflow checks out source and does not download release artifacts, so its website build normally receives an empty list and cannot expose the current version or platform installers.
- The canonical release Action already publishes all desktop and command-line assets, but the public site has no small, same-origin projection of those version-tag-bound facts.
- Linking only to GitHub Releases makes visitors scan a flat list that mixes desktop installers, command-line archives, updater payloads, signatures, checksums, legal notices, and source archives.
- A client-side GitHub REST request would place the public page behind anonymous API quotas and an external Cross-Origin Resource Sharing contract. It would also make browser behavior, rather than the existing deployment candidate, the source of the visible version.

## Root cause and unified repair boundary

The missing boundary is a release-to-website projection owned by Actions. Native packaging and asset validation already have a single source in `build.yml` and `release-asset-contract.ts`; the website deployment already has a signed, atomic candidate. The repair is to insert one versioned manifest between those existing owners:

1. transform one published GitHub Release JSON document into a strict public download manifest using the existing asset-name contracts;
2. generate the manifest inside every production website build;
3. dispatch that existing production workflow after a Release is made public;
4. render the manifest through one same-origin download page.

This keeps native assets on GitHub, keeps RackNerd deployment atomic, and makes a website-only push converge back to the newest published Release instead of overwriting the page with stale checked-in data.

## Public manifest contract

`script/generate-website-download-manifest.ts` consumes a JSON array of GitHub REST Release responses from `--releases-json` and writes the requested `--out` file. It does no network access itself. Drafts, mutable desktop-update channel tags, and tags outside the canonical `v<semantic-version>` release family are excluded. The selected release is the highest valid SemVer, not the array order or a delayed event's payload.

```ts
type WebsiteDownloadManifest = {
  protocol: "opencorvus/website-downloads@1"
  version: string
  publishedAt: string
  releaseUrl: string
  prerelease: boolean
  assets: Array<{
    id: string
    product: "desktop" | "cli"
    platform: "windows" | "macos" | "linux"
    architecture: "x64" | "arm64"
    format: "EXE" | "MSI" | "DMG" | "AppImage" | "DEB" | "RPM" | "TAR.GZ"
    fileName: string
    bytes: number
    url: string
    compatible: boolean
  }>
}
```

- The selected input tag must be `v<releaseVersionMetadata(version).version>`, the Release must be non-draft, `published_at` must be canonical, and every selected asset must be non-empty with a version-tag-bound `/releases/download/v<version>/` URL.
- Desktop assets are selected only through `overlayBundlePatterns()` for the five canonical native rows. macOS `.app.tar.gz` updater payloads and `.sig` files are not user-facing installers; macOS uses DMG. Windows exposes EXE and MSI. Linux exposes AppImage, DEB, and RPM.
- Command-line assets are selected only through `cliArchiveNames()` for the five canonical rows. Public `baseline` archives are labelled `compatible: true`; this iteration does not rename existing Release assets.
- Each required platform and architecture must have its canonical assets exactly once. Missing, duplicate, empty, mismatched-version, draft, mutable-channel, or unknown contract inputs stop the website deployment.
- Asset ordering is deterministic: desktop before command line; Windows, macOS, Linux; x64 before ARM64; preferred installer format before alternatives.

The generated path is `packages/web/public/downloads/latest.json`, ignored by Git and created before the Astro build. It is copied into the signed static candidate and served as `/downloads/latest.json`.

## GitHub Actions contract

### Release workflow

- Keep `publish-release` after all packaging and asset publication jobs.
- After `gh release edit ... --draft=false` and mutable update-channel publication succeed, send exactly one repository dispatch:
  - `event_type`: `opencorvus-release-published`;
  - `client_payload.version`: normalized release version without `v`.
- The job already owns `contents: write`, which is the documented permission for the repository-dispatch endpoint.
- A failed dispatch fails the Release workflow's final job rather than silently leaving the public download page stale.

### Production website workflow

- Add `repository_dispatch: types: [opencorvus-release-published]` without changing the existing push, schedule, or manual triggers.
- Extend the existing `sign-and-deploy` condition to include `github.event_name == 'repository_dispatch'`. Release publication is an explicit request to update the public download page; the production environment, signing checks, atomic activation, public probe, and rollback remain unchanged.
- In the build job, before website check/build:
  - fetch the complete published Release list with the job's read-only `GITHUB_TOKEN` and GitHub API pagination;
  - for a repository-dispatch event, validate the payload version and require its exact `v<version>` Release to be a published member of that list;
  - pass the complete list to the pure generator, select the highest SemVer, and write `packages/web/public/downloads/latest.json`;
  - record both the triggering version and selected version. A delayed older dispatch is valid but cannot downgrade the selected manifest.
- The static candidate verification requires the manifest and validates its protocol, version, non-empty asset set, exact tag-bound URLs, and positive byte sizes.
- The post-deployment health probe downloads the same-origin manifest and revalidates those fields. It does not download large binaries.
- Concurrency keeps the existing non-cancelling `opencorvus-com-production` group and opts into `queue: max`. GitHub therefore serializes the signed deployments while retaining pending Release-triggered runs instead of letting a later build-only push or schedule replace them.

## Page and interaction contract

### Routes and shared navigation

- Add `/download/` and `/zh-cn/download/`, backed by one localized `DownloadPage.astro` inside the existing `PublicSiteLayout`.
- Extend the shared layout/header current-page union with `download` and add `Download` / `下载` before Docs. Keep brand, language, Mission/market/publish/trust destinations, footer, skip link, canonical metadata, and active-page semantics unchanged.

### Localized content

- Page title: `Download OpenCorvus · OpenCorvus` / `下载 OpenCorvus · OpenCorvus`.
- Description: `Download the latest OpenCorvus desktop app or command-line interface for Windows, macOS, and Linux.` / `下载适用于 Windows、macOS 与 Linux 的最新版 OpenCorvus 桌面端或命令行工具。`.
- Hero eyebrow: `Download` / `下载`.
- Hero heading: `OpenCorvus for your workspace.` / `把 OpenCorvus 安装到你的工作区。`.
- Hero lead: `Choose the desktop app or command-line interface. Published packages and the version below come directly from the verified release workflow.` / `选择桌面端或命令行工具。下方安装包与版本直接来自已验证的发布工作流。`.
- Recommended-panel labels: `Recommended for this device`, `Choose a macOS architecture`, `Latest published version`, `Release notes`, and precise reciprocal Chinese copy.
- Sections: `Desktop app` / `桌面端`; `Command-line interface` / `命令行工具`; `Verify your download` / `验证下载`; each includes concise source, architecture, and checksum guidance without duplicating installation documentation.

### Platform recommendation

- One small inline module detects only `windows`, `macos`, or `linux` from `navigator.userAgentData?.platform`, `navigator.platform`, and `navigator.userAgent`.
- Mobile and unrecognized environments enter an explicit unknown state and are asked to choose a desktop platform; Android is not treated as desktop Linux and iOS is not treated as macOS.
- Windows and Linux may choose an architecture only when the browser exposes a reliable ARM64 token; otherwise use x64 for Windows and show platform-local choices for Linux.
- A Windows ARM64 report falls back to the actually published Windows x64 installer instead of producing an empty recommendation; the page does not claim that the binary is native ARM64.
- macOS does not infer Apple Silicon from `MacIntel`. If architecture is not explicit, the hero recommendation links to the macOS card and asks the visitor to choose Apple Silicon or Intel. This satisfies platform detection without sending an unreliable binary.
- Page HTML includes all platform headings and loading/error status before JavaScript. After fetching the same-origin manifest, the script populates exact links, sizes, formats, version, date, and release notes destination.
- If the manifest is unavailable or invalid, the page presents one explicit unavailable state and a GitHub Releases support link. It does not invent a version or silently substitute an older manifest.

## Visual contract

- The page uses `PublicSiteLayout`, `PublicSiteHeader`, `PublicSiteFooter`, and `public-site.css` variables; it creates no alternative tokens, font imports, raster hero, gradient, glass effect, icon system, or generic software-download theme.
- Composition follows the current public site: paper field, generous max-width, cobalt primary action, ink borders, compact uppercase monospace labels, display heading, and asymmetric utilitarian grids.
- The first desktop viewport contains the shared header, hero copy, current version status, and one bordered recommendation panel. The next region uses three bordered platform cards with the same line weight and spacing rhythm as current work-mode/start cards.
- Buttons are native links, keyboard focus uses the shared public-site rule, state never depends on color alone, and file labels remain meaningful at 200% zoom.
- No new image generation is needed; consistency comes from the existing system rather than a decorative asset.

## Implementation boundary

### New files

- `script/generate-website-download-manifest.ts`
- `script/website-download-manifest.test.ts`
- `packages/web/src/components/DownloadPage.astro`
- `packages/web/src/pages/download/index.astro`
- `packages/web/src/pages/zh-cn/download/index.astro`

### Existing files changed

- `.gitignore`: ignore only `packages/web/public/downloads/latest.json`.
- `.github/workflows/build.yml`: dispatch after the published Release and update the existing workflow contract test.
- `.github/workflows/deploy-opencorvus-com.yml`: add the trigger, generate and verify the manifest, and extend existing non-UI workflow integration checks only where their current contract owns the changed steps.
- `packages/web/src/components/PublicSiteHeader.astro` and `PublicSiteLayout.astro`: add the localized route and current-page union.
- `script/github-actions-workflow-contract.test.ts`: positive contract for the dispatch and deployment trigger/generation ordering.
- `specs/README.md` and `specs/records/2026-08/README.md`: add one link for this record without altering or staging the parallel eighth-batch index additions.
- This record is force-added by exact path because the repository-local ignore rule excludes new `specs/` files while retaining already tracked records.

### Explicit non-goals

- No homepage redesign, copy edit, media replacement, Mission-page implementation, responsive-wide audit, release asset rename, updater change, package rebuild, Release creation, tag creation, DNS change, or manual production deployment.
- No client-side GitHub API, service worker, database, server runtime, analytics, package manager change, new component framework, or copied binaries.
- No User Interface automation tests or source-text UI assertions.

## Verification and acceptance

1. Focused non-UI manifest test creates one complete current-format GitHub Release object and verifies the exact deterministic manifest, version-tag-bound URLs, installer formats, compatible CLI markers, and error contract. It also proves that a delayed lower-version dispatch input cannot displace the highest published SemVer.
2. Existing release asset, staging, desktop update manifest, and workflow contract tests pass.
3. `bun run --cwd packages/web check`, `bun run --cwd packages/web build`, `bun run docs:check`, targeted Prettier, and `git diff --check` pass. The build uses a locally generated current manifest from the real public `v0.0.38-beta` Release response; it does not run UI automation.
4. Start an isolated real Astro page. At a `1280 × 720` desktop viewport, inspect English and Chinese download hero/recommendation regions and full platform/package regions with screenshots. Verify the current site header/footer, type, colors, line weights, spacing, focus, version, links, and no horizontal overflow.
5. Interact with the real page by switching the test browser's reported operating-system platform through browser tooling only for manual acceptance, not a stored test. Confirm Windows, macOS, and Linux each foreground the correct section; macOS without reliable architecture asks for a choice.
6. Request at least one small same-origin manifest and one real version-tag-bound download URL with headers only; confirm the displayed version and URL tag agree. Do not download large installers during acceptance.
7. A read-only independent delivery reviewer checks the complete difference, tests, workflow ordering, dirty-worktree preservation, screenshots, and claims. Resolve every valid finding and repeat review if source changes.
8. Commit only task-owned paths. Use patch-level staging for the two already-modified indexes and inspect `git diff --cached` to prove the eighth-batch lines and every other parallel edit are absent. Force-add only this exact ignored record. Before the repository-required push, inspect `origin/main..HEAD`; do not include the parallel uncommitted website program or Expert Squad files. A normal push may update the website source, but no release or repository dispatch is manually triggered in this task.

Static workflow checks, a real current-manifest build, and real local page review can validate this implementation. Because this task does not create a Release or manually dispatch production, the first future authorized Release remains the required end-to-end evidence that GitHub dispatch, production environment protection, signing credentials, RackNerd activation, and the live version converge together. Until that run succeeds, delivery reports must describe the external automatic-update chain as implemented and statically validated, not live-release proven.

## Implementation and acceptance evidence

- Implemented the two localized routes, shared-header active state, release-manifest generator, focused generator tests, Release-to-deployment dispatch, production manifest generation/verification, and post-deployment public-manifest probe described above.
- Generated a local manifest from the authenticated public `v0.0.38-beta` Release response. It contains 18 exact user-facing assets: 10 desktop installers and 8 command-line archives, all with positive byte sizes and version-tag-bound URLs.
- Focused non-UI verification: 14 tests passed with 123 expectations across the new manifest contract, workflow contract, release-asset contract, staging contract, and desktop-update manifest contract.
- Repository verification: `bun run --cwd packages/web check` completed with 0 errors and 0 warnings; `bun run --cwd packages/web build`, `bun run docs:check`, targeted Prettier, and `git diff --check` passed. The existing Astro/Starlight deprecation notices and one `qa/dedupe-lead.cjs` unused-variable hint remain unrelated and non-blocking.
- Real-page review used the existing Astro development server, not a standalone prototype and not a UI automation test. English and Chinese routes loaded the same-origin manifest, displayed `v0.0.38-beta`, rendered every expected platform asset, preserved the shared header/footer, and recommended the Windows EXE on the current Windows browser. The browser reported a 1440-pixel desktop viewport with `scrollWidth == clientWidth`; the requested temporary 1280-pixel override was not honored by the in-app browser backend, so no 1280-pixel acceptance claim is made.
- Visual comparison against the current homepage confirmed the same paper field, public header, narrow display heading, monospace labels, cobalt actions, black line weights, asymmetrical grid rhythm, verification band, and footer. Evidence: `specs/artifacts/2026-08-11-public-download-page-en-top.png`, `specs/artifacts/2026-08-11-public-download-page-en-bottom.png`, `specs/artifacts/2026-08-11-public-download-page-zh-cn.png`, and `specs/artifacts/2026-08-11-public-download-page-zh-cn-bottom.png`.
- Header-only network acceptance returned `200 application/json` for `/downloads/latest.json` and a `302` GitHub Release redirect for `OpenCorvus_0.0.38-beta_x64-setup.exe`; no installer bytes were downloaded.
- The current browser exposed Windows only. macOS/Linux foregrounding was therefore validated through the deterministic client branch and complete rendered platform groups, not by claiming an unavailable user-agent override. The future live Release remains the required end-to-end evidence for the external dispatch/deployment chain.
- First delivery-review verdict: `REJECTED` for pending-run replacement, mobile/unknown platform guessing, mixed-index delivery risk, and incomplete bottom-of-page visual evidence. The implementation added `queue: max`, explicit unknown/mobile and architecture fallback branches, an independently inspected 18-path delivery index, and four top/bottom screenshots. Repeat delivery-review verdict: `APPROVED` with no remaining blocker.

## Plan-review gate

- Status: `APPROVED` after one rejection, revision, and repeat independent review.
- Source implementation is authorized within the exact boundary above.
- No source implementation is authorized by this record until an independent read-only reviewer returns `APPROVED` with no blocking finding.
