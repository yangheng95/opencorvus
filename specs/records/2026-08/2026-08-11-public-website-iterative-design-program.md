# Public website iterative design program

## Recall

### User request

- Research common website design philosophies and use the findings to improve the existing OpenCorvus website progressively.
- Treat each iteration as a separately reasoned and scoped change.
- Do not implement an iteration until an independent agent has reviewed and approved its reason and plan.
- Treat bilingual product copy as an explicit optimization goal, including positioning, information order, evidence boundaries, and calls to action.
- Continue iterating until a complete audit finds no actionable website issue, and push each completed iteration as its own reviewed delivery.

### Acceptance indicators

- Every iteration records the observed problem, user impact, relevant design principles, bounded proposal, non-goals, real-page acceptance, and independent-plan-review verdict.
- An iteration changes one dominant design variable at a time so that its visual and product effect can be judged.
- Each implemented iteration receives real bilingual desktop-page review and a separate post-implementation independent review.
- Each approved and validated iteration is committed and pushed before implementation begins on the next iteration.
- The program preserves the current Astro and Starlight architecture, public routes, product facts, download discovery, and deployment contract unless a later approved iteration explicitly changes one of them.

### Hard constraints

- Preserve unrelated work, including `expert-squads/builtin/equity-research/report.md`.
- Do not add, modify, or run User Interface (UI) automation tests. UI acceptance is real-page interaction, screenshots, and human visual review.
- Continue to use the existing public-site stylesheet and Astro components as the website design source; do not create a parallel theme or fallback surface.
- Keep English and Simplified Chinese information architecture reciprocal.
- Use one independent, read-only agent for plan approval before implementation and one independent, read-only agent for the final difference review. Review agents must not edit or delegate.
- Do not publish, deploy, create a release, or modify Domain Name System (DNS) state under this request.

### Repository and workspace baseline

- Repository: `D:\myhexin-local\opencorvus`.
- Remote: `origin=https://github.com/yangheng95/opencorvus.git`.
- Branch and upstream: `main`, `origin/main`.
- Starting commit: `896d857a31f72e7128416303b6f3b0cee7c7a853`.
- Starting tree: `887c3d7f1b537f66985f10bcc4449099f47aceca`.
- Starting status: one unrelated untracked file, `expert-squads/builtin/equity-research/report.md`.
- Website: `packages/web`, Astro `7.2.0` with Starlight `0.41.7`; no `.openai/hosting.json` exists, so the current architecture remains authoritative.

### Materials read and searches performed

- `AGENTS.md`.
- `packages/web/package.json`, `astro.config.mjs`, `src/components/Lander.astro`, `PublicSiteHeader.astro`, `PublicSiteFooter.astro`, `PublicSiteLayout.astro`, `src/content/landing.ts`, `src/styles/public-site.css`, and `src/styles/custom.css`.
- `specs/README.md`, `specs/records/2026-08/README.md`, prior landing records, and `2026-08-10-opencorvus-com-racknerd-hosting.md`.
- Full repository searches for landing components, public-site styles, heading selectors, current tests, public routes, and historical design decisions.
- Commit `435f330c5` (`feat(web): simplify the public product journey`) and its parent difference.
- Live local English landing page at `http://127.0.0.1:4329/`, inspected at a 1280 by 720 desktop viewport through the in-app browser.

### Independent agent feedback

- First and second review verdicts: `REJECTED`.
- Blocking findings:
  - Starlight's normal page-title `h1` is outside `.sl-markdown-content`; scoping every generic documentation selector to that container would change the quickstart title.
  - The unscoped `a[aria-current="page"]` rule also leaks into the public home brand. The existing brand exception cannot be removed while that influence remains unowned.
  - Scoping the generic anchor rule would change site-title, sidebar, right-rail, and pagination links unless every Starlight shell state were separately frozen and accepted.
  - The first proposal omitted the confirmed near-white secondary start-card links and did not justify changing selectors for elements absent from the landing page.
- Resolution: the revised proposal below leaves all documentation rules unchanged and establishes an explicit landing-root isolation boundary in the public website's existing style sources. It also adds the known link failure, Starlight shell non-regression evidence, and explicit exclusions.
- The second review accepted the public-root direction but required the remaining stale implementation sentence to be removed, exact implicit bold values to become executable contracts, and every changed visual region to be named in the screenshot plan. Those corrections are incorporated below.
- Third review verdict: `APPROVED`. The reviewer confirmed that the public-root boundary, exact typographic contracts, exclusions, cascade requirements, bilingual screenshot groups, and documentation non-regression evidence are sufficient for implementation.
- Non-blocking review guidance: keep every new override inside `.public-landing`, do not alter standalone `body.public-site-body` pages, and record before/after computed values plus screenshot paths for the post-implementation reviewer.

## Research synthesis: common website design philosophies

The program uses philosophies as decision rules, not visual fashion labels.

1. **User-need and service-first design.** Start with what a visitor is trying to accomplish, reduce the page to that irreducible journey, and measure the service outcome rather than the amount of interface. The Government Digital Service principles explicitly combine user needs, doing less, making complexity simple, designing for everyone, and repeated iteration.
   - Source: <https://www.gov.uk/guidance/government-design-principles>
2. **Progressive disclosure.** Show the minimum information needed for the current decision, then provide an obvious path to deeper detail. IBM describes this as an ordered journey that reveals detail without turning discovery into a scavenger hunt.
   - Source: <https://www.ibm.com/docs/en/technical-content?topic=practices-progressive-disclosure>
3. **Perceptual hierarchy and consistent composition.** Scale, proportion, contrast, rhythm, repetition, and whitespace should make the reading order self-evident. Carbon treats these as the planned composition of a reusable grid rather than isolated decoration.
   - Source: <https://carbondesignsystem.com/elements/2x-grid/usage/>
4. **Inclusive legibility and operability.** Text and controls must remain distinguishable, reflowable, keyboard-visible, and usable across user settings. Web Content Accessibility Guidelines (WCAG) 2.2 provides the measurable contract for contrast, text resizing, reflow, focus, and target size.
   - Source: <https://www.w3.org/TR/WCAG22/>
5. **Evidence-led iteration.** Start small, observe the real surface, make one coherent change, and repeat from new evidence. This reduces the chance that a large aesthetic rewrite hides whether the product journey improved.
   - Source: <https://www.gov.uk/guidance/government-design-principles>

## Program decision rules

- A visitor must be able to answer, in order: what OpenCorvus does, why its approach is credible, which path fits the work, and what action to take next.
- Every screen region gets one dominant purpose and one visual focal point.
- Visual novelty is subordinate to comprehension, trust, accessibility, and product evidence.
- Existing product screenshots and runtime facts remain evidence, not background decoration.
- Later iterations begin from fresh screenshots and fresh repository status. Their scopes are not pre-approved by this record.

## Iteration protocol

1. Capture the current English and Simplified Chinese desktop surface and record observable defects.
2. Select one dominant theme and explain why it has higher leverage than adjacent themes.
3. Freeze a bounded proposal, explicit non-goals, affected sources, risks, and real-page acceptance.
4. Ask an independent agent to review the record, relevant source, and evidence. The verdict must be `APPROVED` before source implementation begins.
5. Implement only the approved boundary.
6. Run focused non-UI checks, then inspect the real English and Simplified Chinese pages with screenshots and human visual review.
7. Ask an independent agent that did not implement the change to review the complete difference, evidence, and risks. Resolve valid findings and repeat review when the resolution changes the implementation.
8. Commit and push only the iteration-owned files after the repository safety checks pass.

## Candidate sequence, not pre-approved implementation

- Iteration 1: restore typographic hierarchy and isolate the public website from documentation-theme leakage.
- Iteration 2: optimize the bilingual first-viewport positioning, supporting copy, evidence boundaries, and calls to action against the primary visitor decision.
- Iteration 3: progressively disclose product depth across landing, Expert Squad market, trust, and documentation paths.
- Iteration 4: strengthen proof, product imagery, and credibility without increasing claim density.
- Iteration 5: audit responsive behavior, accessibility, and performance as one coherent delivery-quality layer.

Only Iteration 1 is specified below. Each later iteration requires fresh evidence and its own independent approval.

## Iteration 1: visible hierarchy and theme ownership

### Observable phenomenon

- With the operating system's dark color preference active, the public landing page still correctly renders its paper-colored background, but its four section headings and several card headings render near-white.
- Browser evidence for `.section-heading` shows `color: rgb(242, 237, 237)`, `font-size: 22px`, `font-weight: 500`, and `line-height: 21.12px`. The intended public-site rule is `font-size: clamp(44px, 4.1vw, 66px)`, `font-weight: 730`, and `line-height: 0.96`.
- At the first two scroll positions, the modes and Expert Squads section titles are effectively absent from the reading hierarchy. Mode names and capability names also lose their intended emphasis.
- The primary start card is readable because it sits on cobalt, but the two paper-colored source and release cards also compute to `rgb(242, 237, 237)` through the global anchor rule and are effectively unreadable. Their nested `strong` text is reduced to weight `500`.
- The public home brand is also matched by the documentation rule `a[aria-current="page"]`; an existing landing exception currently suppresses its left border and document-surface background.

### Direct trigger and control-flow root cause

- `Lander.astro` is injected by Starlight's splash `Hero`, so the public landing page and documentation theme coexist in the same document.
- `src/styles/custom.css` declares unscoped, `!important` element rules for anchors, `a[aria-current="page"]`, `h1` through `h4`, `strong`, `ul`, and `ol`.
- In dark system preference those rules resolve `--color-text-strong` to near-white and override the public site's intentionally light, fixed brand surface.
- `src/styles/public-site.css` is the public design source, but its typographic declarations cannot win against the unscoped documentation `!important` rules.

### Why the current path did not root-cure the issue

- The landing page currently compensates only for the hero `h1` and brand link with narrowly targeted `!important` overrides in `Lander.astro`.
- The simplified journey introduced new `h2`, `h3`, and `strong` content under the same leaking theme boundary, so the compensation does not cover the current page.
- Rewriting the documentation selectors would risk changing Starlight's page title and shell. The root repair is one explicit `.public-landing` isolation boundary in the existing public design source, with the scattered landing exceptions migrated into that boundary.

### Impact surface

- Definitions inspected: `packages/web/src/styles/custom.css`. It remains unchanged in the revised plan so Starlight documentation and shell presentation cannot drift.
- Definitions changed: the existing public design sources `packages/web/src/styles/public-site.css` and `packages/web/src/components/Lander.astro`.
- Call/render path: Starlight splash route -> `Hero.astro` -> `Lander.astro` -> public website components and `public-site.css`.
- Public contract: no route, locale, link, content, schema, download, or deployment behavior changes.
- Documentation: heading, link, list, and strong typography must remain visually unchanged inside `.sl-markdown-content`.
- Tests: no UI automation will be added, changed, or run. Existing package checks may validate compilation but cannot count as visual acceptance.
- Data and persistence: not applicable.
- Delivery: source, specification, visual evidence, commit, and normal upstream push only. Deployment remains outside scope.

### Revised implementation boundary proposed for third review

1. Leave `custom.css` unchanged. Its current computed presentation remains authoritative for the documentation page title, Markdown content, site title, header, sidebar, right rail/table of contents, pagination, and social links.
2. Establish one explicit `.public-landing` isolation boundary in `public-site.css`, the existing public design source:
   - public landing links default to public ink, while primary actions and the primary start card retain white foregrounds;
   - the home brand and public navigation's `aria-current` states explicitly retain their public border, background, color, and weight semantics instead of inheriting documentation-current-page chrome;
   - declarations for `a[aria-current="page"]` border, background, and font weight use scoped specificity plus `!important` where required to cross the documentation rule's importance;
   - public landing `strong` text is frozen at bold `700`, the public/HTML semantic emphasis that the documentation `500 !important` currently suppresses.
3. Make the already-declared component typography in `Lander.astro` effective at the public boundary for the hero `h1`, `.section-heading`, mode `h3`, and capability `h3`:
   - hero `h1`: existing `clamp(60px, 5.4vw, 78px)`, weight `760`, line height `0.9`, and existing letter spacing;
   - `.section-heading`: existing `clamp(44px, 4.1vw, 66px)`, weight `730`, line height `0.96`, and existing letter spacing;
   - mode `h3`: existing `42px` size and `1` line height, with exact bold weight `700` replacing the suppressed browser/public semantic default;
   - capability `h3`: existing `16px` size and inherited public `1.6` line height, with exact bold weight `700` replacing the suppressed browser/public semantic default;
   - all restored heading foregrounds use public ink.
   The `.public-landing` declarations that compete with a documentation `!important` declaration must themselves use sufficient scoped specificity and `!important`; other public declarations remain unchanged. This restores the existing type scale and makes implicit semantic boldness explicit rather than inventing a new scale.
4. Remove only the `Lander.astro` hero-heading and brand exceptions after the same semantics have moved to the shared public boundary and live computed-style evidence proves them redundant. Retain layout, Starlight splash integration, and video rules.
5. Explicitly exclude unrelated generic rules:
   - the global `body` rule remains because the landing root already owns its paper background, ink foreground, font family, and `16px` base size; its independent public tokens do not read the documentation dark-theme text variables;
   - `h4`, `ul`, and `ol` have no targets in the current landing component, so moving their documentation rules would expand the change without fixing an observed public defect;
   - heading-link rules have no current landing target and remain unchanged.
6. Do not change public copy, section order, content width, color tokens, media, calls to action, market behavior, documentation presentation, or mobile breakpoints in this iteration.

### Risks and mitigations

- **Documentation or shell drift:** because `custom.css` remains byte-for-byte unchanged, inspect the real quickstart PageTitle, Markdown heading/link/strong/list, site title, sidebar, table of contents, social links, and any visible pagination before and after to prove that the public isolation did not escape its root.
- **Public link regression:** inspect the brand, public navigation current state, language switch, primary/secondary actions, primary and secondary start cards, and footer on the real page in both locales.
- **Incomplete leakage boundary:** inspect computed hero `h1`, `.section-heading`, mode `h3`, capability `h3`, proof-strip `strong`, start-card anchors, and start-card `strong` values after the repair rather than judging only one screenshot.
- **Broad aesthetic creep:** reject spacing, copy, media, color, navigation, and responsiveness changes from this iteration.

### Iteration 1 acceptance

- Independent plan reviewer verdict is `APPROVED` before source edits.
- English and Simplified Chinese landing pages visibly restore the intended h1/h2/h3 hierarchy on the paper background under dark system preference.
- Computed section headings use public-site color and intended size/weight/line-height; mode and capability headings use their intended public values.
- The source and release start cards compute to public ink on paper with the public emphasis weight; the primary start card remains white on cobalt.
- The home brand has no documentation left border or document-surface background; public navigation current-state underline semantics remain intact.
- The real quickstart page retains its PageTitle, Markdown heading, link, strong, list, site-title, sidebar, right-rail/table-of-contents, social-link, and visible pagination presentation.
- Header actions, language switch, and footer links remain readable and usable; page structure, content, links, downloads, and media remain unchanged.
- `bun run --cwd packages/web check`, `bun run --cwd packages/web build`, and repository documentation checks pass.
- Real-page screenshots and manual visual review cover:
  - English and Simplified Chinese landing top regions containing the brand, hero, actions, and proof strip;
  - both locales' modes and Expert Squads regions;
  - both locales' start/footer regions containing the primary card, paper secondary cards, and footer links;
  - the quickstart top region containing site title, PageTitle, body heading, sidebar, right-side table of contents, and social links;
  - the quickstart bottom region containing visible pagination and footer.
- A post-implementation independent reviewer reports no unresolved findings.

## Decision log

- Iteration 1 is selected before conversion, content, responsive, or performance refinements because a missing reading hierarchy makes later comparisons unreliable. Restoring the intended design authority is the smallest change that produces a trustworthy baseline for all subsequent iterations.
- After Iteration 1 approval, the user clarified that copy optimization is also a program goal. It is assigned to Iteration 2 so bilingual positioning and calls to action receive their own evidence, bounded proposal, and independent approval instead of being mixed into the already-approved style-ownership repair.

## Iteration 1 implementation and visual evidence

### Implemented boundary

- `packages/web/src/styles/custom.css` is unchanged.
- `packages/web/src/styles/public-site.css` now owns the `.public-landing` link, current-page brand/navigation, and semantic-emphasis boundary.
- Existing public hero and section-heading rules now have sufficient priority to express their declared weights and type scale inside the Starlight splash shell.
- `packages/web/src/components/Lander.astro` freezes the approved mode and capability heading values and removes the superseded hero/brand exceptions.

### Computed-style evidence under dark system preference

| Target | Before | After |
| --- | --- | --- |
| Hero `h1` | public ink, weight `500` | public ink, weight `760` |
| Section heading | near-white, `22px`, weight `500`, line height `21.12px` | public ink, `52.48px` at the 1280px viewport, weight `730`, line height `50.3808px` |
| Mode `h3` | near-white, `18px`, weight `500` | public ink, `42px`, weight `700`, line height `42px` |
| Capability `h3` | near-white, `18px`, weight `500` | public ink, `16px`, weight `700`, line height `25.6px` |
| Proof/start-card `strong` | weight `500` | weight `700` |
| Paper start cards | near-white on paper | public ink on paper |
| Footer links | near-white on paper | public ink on paper |
| Home brand | weight `600` with documentation current-page rule matched | weight `760`, transparent background, no left border |

### Real-page screenshots and manual review

- English top: [`2026-08-11-public-website-iteration-1-en-top.png`](../../artifacts/2026-08-11-public-website-iteration-1-en-top.png)
- English work modes: [`2026-08-11-public-website-iteration-1-en-modes-squads.png`](../../artifacts/2026-08-11-public-website-iteration-1-en-modes-squads.png)
- English Expert Squads and capabilities: [`2026-08-11-public-website-iteration-1-en-squads.png`](../../artifacts/2026-08-11-public-website-iteration-1-en-squads.png)
- English start and footer: [`2026-08-11-public-website-iteration-1-en-start-footer.png`](../../artifacts/2026-08-11-public-website-iteration-1-en-start-footer.png)
- Simplified Chinese top: [`2026-08-11-public-website-iteration-1-zh-top.png`](../../artifacts/2026-08-11-public-website-iteration-1-zh-top.png)
- Simplified Chinese work modes: [`2026-08-11-public-website-iteration-1-zh-modes-squads.png`](../../artifacts/2026-08-11-public-website-iteration-1-zh-modes-squads.png)
- Simplified Chinese Expert Squads and capabilities: [`2026-08-11-public-website-iteration-1-zh-squads.png`](../../artifacts/2026-08-11-public-website-iteration-1-zh-squads.png)
- Simplified Chinese start and footer: [`2026-08-11-public-website-iteration-1-zh-start-footer.png`](../../artifacts/2026-08-11-public-website-iteration-1-zh-start-footer.png)
- Quickstart top shell and content: [`2026-08-11-public-website-iteration-1-docs-top.png`](../../artifacts/2026-08-11-public-website-iteration-1-docs-top.png)
- Quickstart bottom content and footer: [`2026-08-11-public-website-iteration-1-docs-bottom.png`](../../artifacts/2026-08-11-public-website-iteration-1-docs-bottom.png)

Manual review confirms that both landing locales regain a clear heading-to-body-to-action hierarchy; the three work-mode names, Expert Squad titles and capability names, paper start cards, and footer links are legible; primary actions retain white-on-cobalt emphasis; and the public brand/current-state treatment remains coherent. Work modes and Expert Squads are recorded as separate screenshots in each locale so the capability region remains readable at the real desktop viewport. The quickstart PageTitle, body heading, site title, sidebar, right-side table of contents, social links, bottom next-content link, and footer remain visually unchanged. The current quickstart route renders no separate pagination component (`paginationCount=0`); the bottom evidence records the available `Next: Architecture` content link and footer rather than inferring a missing component.

### Post-implementation independent review

- First delivery-review verdict: `REJECTED`.
- The reviewer found that the two original work-mode screenshots did not actually show the Expert Squads capability region, so the visual record did not satisfy the approved coverage even though computed styles were present.
- Remediation: retain those screenshots as work-mode evidence and add separate real-page English and Simplified Chinese Expert Squads screenshots that visibly contain the section title, capability names and descriptions, and adjacent product imagery. The program and root visual index now describe all ten screenshots precisely.
- Repeat delivery-review verdict: `APPROVED` with no unresolved findings. The reviewer confirmed that both added Expert Squads screenshots visibly contain the section title, all three capability names and descriptions, and adjacent product imagery; the ten-image index now closes the only first-review gap.

### Remaining gates

- `bun run --cwd packages/web check`: passed with zero errors and zero warnings; the existing unused `startBlock` hint in `qa/dedupe-lead.cjs` remains outside this change.
- `bun run --cwd packages/web build`: passed and generated all 269 pages. Existing component-override, top-level-await target, and missing `Entry docs` warnings remain unchanged and did not stop the build.
- `bun run docs:check`: passed (`329` operations across `25` groups).
- `git diff --check` for the touched tracked files: passed.
- `bunx prettier --check` for this program record: passed.
- Repeat post-implementation independent read-only review: passed with no unresolved findings.
