# Public homepage locale and hero priorities

## Recall

### User request

- Make the website language follow locale changes.
- Repair the uneven first-screen layout.
- Emphasize Security, Control, and Customization as the three primary product values.

### Acceptance indicators

- English and Simplified Chinese remain reciprocal route-level sources: `/` is English and `/zh-cn/` is Simplified Chinese.
- A first homepage visit with a Simplified Chinese browser locale enters `/zh-cn/`; other browser locales remain on `/`.
- An explicit language switch wins over browser preference on later visits and the reciprocal homepage language link remains a real no-JavaScript link.
- The desktop first viewport has one clear copy column and one aligned three-value panel. `Security`, `Control`, and `Customization` (and reciprocal Chinese copy) are visually prominent without overstating the runtime permission contract.
- The existing interactive product gallery remains available immediately after the hero rather than competing with the hero message.
- Real English and Simplified Chinese pages are inspected at a desktop viewport with screenshots; the locale switch is exercised in the real page.

### Hard constraints

- Preserve the Astro static bilingual route architecture and `PublicSiteLayout` as the one public-page shell.
- URL locale is the current-page authority. Browser preference is used only for an uncommitted first visit to the English root homepage; a stored explicit choice has priority.
- Do not add, modify, or run User Interface (UI) automation tests. Acceptance uses the real page, interaction, screenshots, and human visual review.
- Do not introduce a second translation system, compatibility route, server redirect, or duplicate content owner.
- Permission copy must match the real `allow`, `ask`, and `deny` rule model; it must not promise universal per-action approval or absolute security.
- Desktop is the requested acceptance target. Existing responsive rules remain intact, but this task does not expand into a mobile redesign.
- Preserve all unrelated working-tree changes. This task owns only the files listed below.

### Materials read

- `AGENTS.md`.
- `specs/current/architecture/public-website.md`.
- `specs/records/2026-08/2026-08-11-public-website-iterative-design-program.md`.
- `specs/records/2026-08/2026-08-12-public-navigation-and-visitor-count.md`.
- `packages/web/astro.config.mjs`, `package.json`, and `README.md`.
- `packages/web/src/components/Lander.astro`, `PublicSiteLayout.astro`, `PublicSiteHeader.astro`, `PublicSiteFooter.astro`, `Header.astro`, and `Head.astro`.
- `packages/web/src/content/landing.ts`, `public-market.ts`, and the public-site stylesheet.
- The current bilingual homepage routes and all repository references to locale selection, `publicPath`, landing content, and the hero/proof layout.

### Repository and search evidence

- `astro.config.mjs` declares `root` (`en`) and `zh-cn` (`zh-CN`) Starlight locales. Public pages mirror them through `/` and `/zh-cn/**` and already derive reciprocal links with `publicPath`.
- `Lander.astro` selects all homepage content from `landingContent[locale]`, so rendered copy already follows the route locale.
- No public-page code reads browser locale or remembers an explicit public language choice. Therefore a new visitor always receives English at `/` even when `navigator.languages` prefers Simplified Chinese.
- The current hero contains a headline, description, two actions, Harness aside, authority boundary, four tabs, a large image, and an image caption inside one two-column region. Its two columns have different content height and visual weight. The existing three-item proof strip is below the `620px` hero and therefore does not establish the requested values in the first viewport.
- Current proof copy is Workbench / experts / delivery. It does not name Security / Control / Customization.
- There are no task-owned source changes at baseline. Existing changes are in engine/orchestrator/spec files owned by other work and will not be included.

### Independent agent feedback

- None before implementation. The repository requires an independent read-only delivery review after first-pass validation; its findings will be recorded below.

## Analysis

### Observable phenomena

1. Changing the route locale changes homepage strings correctly, but entering the site does not follow browser locale and the explicit switch has no remembered preference.
2. The first viewport presents two unrelated reading structures at once: product positioning on the left and an interactive product gallery on the right. Unequal block heights and the large dark media frame make the composition appear misaligned.
3. The requested product priorities are not visible as named values in the first screen.

### Direct triggers and data/control-flow root causes

- Locale rendering is entirely build-time through the route prop. There is no small client-side preference boundary in the shared public layout to choose a locale before the first root-homepage presentation or retain explicit selection.
- `Lander.astro` puts the gallery inside `.landing-hero`; `.landing-hero` must simultaneously balance long copy and media with a minimum height. CSS alignment cannot remove the underlying content-density mismatch.
- `content.proof` is both semantically secondary and structurally outside the hero. The requested values therefore have neither content ownership nor first-viewport placement.

### Why the existing path did not root-cure the issue

- Reciprocal locale links solve navigation after the user makes a choice, not initial locale negotiation or preference continuity.
- Iterative hero additions kept useful material but accumulated independent blocks inside one layout. Adjusting gaps or image height alone would retain competing hierarchies.
- Prior homepage work emphasized Workbench → Squad → Mission story. It did not make Security / Control / Customization the explicit first decision frame.

### Impact surface and exclusions

- Definitions and call sites: the change touches the shared public layout preference script, the public header switch metadata, landing localized content, landing markup/styles, and documentation indexes for this new record.
- Public routes, Market data, Registry, docs translation content, navigation destinations, footer, gallery behavior, runtime contracts, deployment packaging, and server APIs are unchanged.
- The Starlight documentation locale control remains Starlight-owned. The new preference behavior is scoped to pages rendered through `PublicSiteLayout`.
- Browser language detection recognizes primary `zh` tags as Simplified Chinese for the supported two-locale site. All non-`zh` browser locales select English.

## Implementation plan

1. Add one inline public-layout locale preference script. On `/zh-cn/**`, record `zh-cn`. On English public routes other than the root homepage, record `root`. On the English root homepage, redirect to the reciprocal Chinese root only when stored preference is `zh-cn`, or when no explicit preference exists and `navigator.languages` contains a `zh` primary tag. Mark the language link with the target locale and store that explicit selection before normal navigation.
2. Keep the existing real `href`, and add reciprocal `hreflang` / `lang` metadata so no-JavaScript navigation and assistive semantics remain complete.
3. Replace `landingContent.proof` with reciprocal Security / Control / Customization facts grounded in current product contracts.
4. Restructure only the homepage hero: retain copy and calls to action in the left column; put the three values in one aligned right-side panel; place the authority sentence across the hero bottom. Move the unchanged interactive gallery into its own immediately following section headed by the existing Harness content.
5. Adjust only landing-scoped CSS for the new composition. Preserve existing shared public-page and responsive sources.
6. Run focused format/type/build/document checks without UI tests. Serve the actual project development mode, inspect and screenshot both desktop locale routes, exercise both language-switch directions, and confirm console cleanliness and no horizontal overflow.
7. Commission an independent agent that did not implement the change to read the complete owned diff, checks, screenshots, locale behavior, documentation, and regression risks. Resolve all valid findings and repeat review if implementation changes.
8. Commit only task-owned files. Pull and merge the upstream current branch, inspect the complete pending push set, rerun necessary checks, and push as required by repository policy.

## Owned files

- `packages/web/src/components/Lander.astro`
- `packages/web/src/components/PublicSiteHeader.astro`
- `packages/web/src/components/PublicSiteLayout.astro`
- `packages/web/src/content/landing.ts`
- `specs/records/2026-08/2026-08-13-public-home-locale-and-hero-priorities.md`
- The minimal new index entries in `specs/README.md` and `specs/records/2026-08/README.md`, preserving concurrent content.

## Validation record

- `bun run --cwd packages/web astro check`: passed with `0 errors`, `0 warnings`, and 19 pre-existing hints in Registry/test utility sources.
- `bun run --cwd packages/web astro build`: passed. The existing Starlight top-level-await target and component-override warnings remained non-fatal.
- `bun run docs:check`: passed (`338 ops`, `25 groups`).
- `git diff --check`: passed.
- The normal `bun run --cwd packages/web check` precheck entered the existing Market distribution generator and did not finish within the local acceptance window. Two task-owned generator processes were stopped; direct `astro check` then exercised the changed Astro/TypeScript sources successfully. No generated Market file changed.
- Astro development mode did not become ready within its built-in 30-second startup deadline on this Windows workspace. Acceptance therefore used the same source tree's successful production build served by the bundled Astro/Node runtime at `http://127.0.0.1:4338/`, not a standalone Vite surface.
- In-app Browser review at an explicit `1440 × 900` desktop viewport:
  - English `/`: `lang=en`, values `Security / Control / Customization`, hero bottom `776.56px`, viewport width `1440px`, document width `1425px`, reciprocal href `/zh-cn/`, and no console errors.
  - Simplified Chinese `/zh-cn/`: `lang=zh-CN`, values `安全 / 控制 / 定制`, hero bottom `718.06px`, viewport width `1440px`, document width `1425px`, reciprocal href `/`, and no console errors.
  - Human visual review confirmed one balanced copy column, one aligned three-row value panel, a full-width authority strip, no clipping/collision/horizontal overflow, and the relocated Harness gallery immediately below the first-screen hierarchy.
  - Real link interaction changed English to Simplified Chinese. Real reciprocal interaction changed back to English, and reloading `/` retained the explicit English selection instead of applying browser preference again.
- During review, browser-language selection was tightened from “any Chinese language in the list” to “the first supported `en` or `zh` preference wins.” The final check/build/page review above is after that correction.

## Independent delivery review

- First verdict: `REJECTED`.
- Valid blocking finding: both documentation indexes linked this record, but the repository-wide `/specs/` ignore rule meant the new file was not yet in the Git delivery set. A fresh checkout would therefore contain two broken index links and lose the task's Recall, analysis, and acceptance evidence.
- Resolution: explicitly add this record to the task's path-limited Git delivery set. No website source change was required; the reviewer found no other blocker in locale priority, explicit switching, redirect termination, storage-failure degradation, no-JavaScript links, bilingual reciprocity, accessibility semantics, first-screen structure, or product-value copy.
- Repeat review verdict: `APPROVED`. The reviewer confirmed the record is staged as a new tracked file, both index links resolve to it, the first review and resolution are recorded, the staged patch passes `git diff --cached --check`, and no findings remain.
