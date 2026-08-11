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
- Each completed iteration must be committed and pushed so the existing `deploy-opencorvus-com.yml` path updates `opencorvus.com`; do not create a release or tag, manually dispatch a duplicate deployment, or modify Domain Name System (DNS) state.

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

Iterations 1 and 2 are specified below. Every later iteration still requires fresh evidence and its own independent approval before implementation.

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

## Iteration 1 production delivery

- Commit: `1b6df2f9d93d8e593334911dcbed2522ff5c6e88` (`fix(web): isolate public landing typography`).
- Push: `main` and `origin/main` both resolve to that exact commit.
- Production workflow: [`deploy opencorvus.com` run 31461439739](https://github.com/yangheng95/opencorvus/actions/runs/31461439739), triggered by the commit's `packages/web/**` push path, completed successfully. The Ubuntu, Windows, and macOS canonical archive jobs, static build and verification job, signing job, and RackNerd atomic deployment all passed.
- Live verification used cache-busted English and Simplified Chinese routes after the Action completed. Both returned the new headline and the restored computed styles. English and Chinese hero headings computed to public ink, `69.12px`, weight `760`, and `62.208px` line height at the inspected desktop viewport; section headings computed to public ink, `52.48px`, weight `730`, and `50.3808px` line height. The brand retained a transparent background and no left border. Both live pages reported no browser console errors.

## Iteration 2: first-viewport positioning and bilingual copy

### Fresh evidence and research

- Production baseline screenshots:
  - English: [`2026-08-11-public-website-iteration-2-baseline-en-top.png`](../../artifacts/2026-08-11-public-website-iteration-2-baseline-en-top.png)
  - Simplified Chinese: [`2026-08-11-public-website-iteration-2-baseline-zh-top.png`](../../artifacts/2026-08-11-public-website-iteration-2-baseline-zh-top.png)
- The World Wide Web Consortium (W3C) Web Accessibility Initiative recommends easy-to-understand words, short sentences, short text blocks, unambiguous content, and visible separation so users can understand a page's message and purpose: <https://www.w3.org/WAI/WCAG2/supplemental/objectives/o3-clear-content/>.
- W3C's writing guidance says page titles and headings should put the unique, relevant information first, link text should be meaningful, and content should be clear and concise: <https://www.w3.org/WAI/tips/writing/>.
- Nielsen Norman Group's web-writing guidance says visitors scan instead of reading every word; headings should be meaningful rather than clever, the conclusion should come first, and deeper material should be split behind relevant links: <https://www.nngroup.com/articles/be-succinct-writing-for-the-web/>.
- Repository truth confirms that OpenCorvus is MIT-licensed open source; Task owns the business lifecycle; real worktree, tool, file, decision, Artifact, reviewer, and execution evidence are durable parts of the current architecture; Expert Squads are visible packaged capability projections rather than an anonymous Agent pool.

### Observable phenomenon and user impact

- The repaired hierarchy now makes the hero headline the strongest object, but the headline `Bring one outcome. Leave with a review-ready result.` and Chinese `带来一个目标，带走一份可审查的交付。` do not identify the product category, operating surface, or Agent relationship. The same promise could describe consulting, project management, or document review.
- The eyebrow `Open Agent Harness` / `开放式 Agent Harness` makes an unfamiliar implementation category the first label. The visitor must understand `Harness` or read the full description before learning that OpenCorvus is an open-source workspace where Agents use real tools and leave reviewable evidence.
- The English supporting sentence is a 26-word multi-clause mechanism list. At the inspected viewport it occupies about `90px` of height; the authority boundary adds another roughly `80px`. Important meaning is split across both paragraphs and repeats `work`, `evidence`, `mission`, and `review` concepts without a concise category statement.
- The current primary link says `Explore Expert Squads`, while the destination is a browsable catalog. `Browse Expert Squads` is a more literal destination label. The secondary action `Read the quickstart` describes content consumption rather than the next action.
- Public copy ownership is split: most hero strings live in `landingContent`, but the authority boundary is a separate locale conditional inside `Lander.astro`; public footer positioning is another local object; homepage metadata descriptions still repeat the `Agent Harness` category. This makes future bilingual changes easy to leave inconsistent.

### Trigger, root cause, and why the prior path does not solve it

- The direct trigger is the content sequence rendered by `Lander.astro`: category eyebrow → metaphorical result headline → mechanism paragraph → two actions → authority paragraph. The visual hierarchy is now correct, so its first and largest words expose the information-order problem rather than hiding it.
- The root cause is positioning by internal category and desired tone instead of the visitor's first decision. `Agent Harness`, `outcome`, and `review-ready` are meaningful only after the visitor already understands the product. The copy asks users to infer the concrete workspace and evidence model from abstract terms.
- Iteration 1 deliberately did not change copy. Its style repair was necessary to make this diagnosis reliable, but typography cannot make an ambiguous headline specific.
- Replacing only the headline would leave the eyebrow, authority sentence, metadata, and footer telling different product stories. Adding more explanatory text would violate the research direction and increase first-viewport load. The bounded repair must simplify and align the existing copy surfaces.

### Definitions, consumers, contracts, and exclusions

- `packages/web/src/content/landing.ts` is the localized landing-content owner consumed only by `Lander.astro` for the English and Simplified Chinese home routes.
- `Lander.astro` owns layout and destination links. The current inline `hero-boundary` locale conditional is the only first-viewport copy outside `landingContent`; moving it into `landingContent.hero.boundary` removes that split source without changing rendering or routes.
- `packages/web/src/content/docs/index.mdx` and `zh-cn/index.mdx` own homepage metadata descriptions. Their `hero.tagline` values already describe real workspaces, right-sized Expert Squads, and visible evidence accurately and remain unchanged.
- `PublicSiteFooter.astro` owns its contextual footer statement. It should use the same category and product nouns while remaining a shorter footer sentence, not duplicate the hero verbatim.
- `app.head.titleSuffix` is shared by every documentation page, not just the home route. Changing it would broaden this iteration across all document titles, so it is explicitly excluded.
- Social preview art, navigation labels, lower landing sections, media, page structure, layout, typography, colors, routes, link destinations, download discovery, Expert Squad data, documentation body copy, and responsive breakpoints are excluded.
- No User Interface automation test, source-text assertion, snapshot, or screenshot baseline is added or run. Acceptance remains real-page inspection, screenshots, and human review.

### Proposed exact copy contract

The first proposed headline was rejected before implementation because its two English clauses were each wider than the live hero column, while the Chinese headline carried the same three-line risk. The revised headline below was calibrated against the live `1280 × 720` page: the hero column is `607.35px`; the current rendered English lines are about `584.27px` and `568.89px`; and the production font stack, `69.12px` size, and `-5.184px` letter spacing estimate the revised English clauses at about `539px` and `498px`. The revised Chinese clauses estimate to about `468px` and `517px`, compared with the current first line's measured `575.42px`. This preserves material margin on both lines without a CSS change; the post-implementation real page remains the final authority.

| Surface | English | Simplified Chinese |
| --- | --- | --- |
| Hero eyebrow | `Open-source workspace for Agents` | `面向 Agent 的开源工作区` |
| Hero headline | `Give Agents a workspace. Keep results reviewable.` | `给 Agent 工作区，让交付可审查。` |
| Hero description | `Within each Task, OpenCorvus keeps the goal, participating Agents, tools, files, decisions, and evidence together—from first instruction to final acceptance.` | `在每个任务中，OpenCorvus 把目标、参与的 Agent、工具、文件、决策与证据放在一起，从首次指令到最终验收始终保留。` |
| Primary action | `Browse Expert Squads` | `浏览专家团` |
| Secondary action | `Open the quickstart` | `打开快速开始` |
| Authority boundary | `You set the scope and approve changes to external systems. OpenCorvus keeps the work and its evidence visible.` | `你设定任务范围，并批准对外部系统的改动；OpenCorvus 让工作过程与证据始终可见。` |
| Homepage description | `An open-source workspace that keeps Agent work, Expert Squads, and reviewable evidence together.` | `把 Agent 工作、专家团协作与可审查证据放在一起的开源工作区。` |
| Footer statement | `An open-source workspace for Agent work, Expert Squads, and reviewable evidence.` | `面向 Agent 工作、专家团协作与可审查证据的开源工作区。` |

Capitalization intentionally treats `Agent` and `Expert Squad` as OpenCorvus product nouns in both locales. `Open-source` is supported by the repository's MIT license and public GitHub remote. `External changes` is plainer than the implementation phrase `external writes` while preserving the same user-authority boundary.

### Bounded implementation plan

1. Add `boundary` to both localized `landingContent.hero` objects and render `content.hero.boundary` from the existing paragraph in `Lander.astro`; delete the inline locale conditional so hero copy has one localized owner.
2. Replace only the approved hero eyebrow, headline, description, action labels, and boundary strings in `landing.ts`.
3. Replace only the homepage metadata descriptions in the two index MDX files; keep title, template, tagline, and all body composition unchanged.
4. Replace only the localized footer statements in `PublicSiteFooter.astro`; keep footer links, labels, markup, and navigation unchanged.
5. Do not change CSS to force the copy to fit. If the exact copy produces unacceptable wrapping, revise the copy contract and obtain renewed independent approval rather than masking it with layout changes.

### Risks and acceptance

- **Headline wrapping:** both headlines must remain fully visible without collision, clipping, or pushing the action group below the desktop first viewport. Prefer two balanced lines; three lines are a rejection at the current 1280 by 720 evidence viewport.
- **Bilingual reciprocity:** both locales must communicate the same category, real-workspace promise, reviewability, concrete content model, user authority, and destinations without literal word-for-word awkwardness.
- **Claim inflation:** no claim may imply autonomous authorization, automatic acceptance, guaranteed quality, permanent uptime, or that every task requires an Expert Squad.
- **Destination semantics:** action labels must remain accurate for the existing `/market/` and `/start/quickstart/` links; keyboard focus and link behavior remain unchanged.
- **Visual continuity:** the video, brand, navigation, proof strip, heading hierarchy, colors, and spacing remain unchanged. Real English and Simplified Chinese screenshots cover the entire first viewport after implementation.
- `bun run --cwd packages/web check`, `bun run --cwd packages/web build`, `bun run docs:check`, targeted Prettier, and `git diff --check` must pass.
- An independent read-only plan reviewer must report `APPROVED` before source edits. After implementation and real-page inspection, a different independent read-only reviewer must report no unresolved findings.
- The iteration is complete only after an iteration-owned commit is pushed, the exact push triggers `deploy-opencorvus-com.yml`, the Action succeeds, and cache-busted live English and Simplified Chinese routes visibly contain the approved copy with no browser console errors.

### Iteration 2 plan-review verdict

- First review: `REJECTED`. The reviewer blocked the original headline because it was likely to wrap to three lines, found that `approve external changes` and `确认…改动` did not preserve the same authorization boundary, and found the original English description unnatural and missing the Chinese copy's single-Task container semantics.
- Revision: shortened and width-calibrated both headlines, made `approve` / `批准` explicit in both locales, and made the Task container and participating-Agent relationship reciprocal.
- Earlier repeat review: `APPROVED`, but superseded by the fresh independent review below. The earlier reviewer confirmed width and reciprocity but did not compare the proposed authority sentence with the current default permission contract or bind the visual candidate to an isolated Git tree.

### Fresh workspace and exact-candidate boundary

- Final public parent identity after the synchronized Download page, deploy-probe coverage, responsive Download repair, Windows Mission-recovery batch, and eighth ten-domain Expert Squad batch landed: public `main` at `be35aeec38c7d70cb1289316f1dde5a12c8782bc`. The shared worktree remains dirty with separate parallel work; therefore delivery uses a detached independent clone at the exact public parent instead of the shared index. Commits after `480c0ab90` change the Download integration test and record, `DownloadPage.astro`, runtime/overlay Mission-recovery sources and tests, Expert Squad packages/generated market data and their records. None overlaps the seventeen Iteration 2 paths.
- The formerly staged seventh Expert Squad expansion is part of older history. A new parallel eighth-batch task owns its staged expert packages, generated payload/market data, tests, and record/index changes, while an unrelated `expert-squads/builtin/equity-research/report.md` remains untracked. All are explicitly excluded from Iteration 2. The Download page and deploy-probe commits are now part of the parent and remain intact; the Iteration 2 patch adds Mission to the already Download-aware Header/Layout instead of removing that route.
- Iteration 2 owns only `packages/web/src/assets/lander/opencorvus-concept-map.png`, `packages/web/src/assets/lander/opencorvus-concept-flow-en.gif`, `packages/web/src/assets/lander/opencorvus-concept-flow-zh.gif`, `packages/web/src/assets/lander/client-agent-workspace.png` (deletion after poster removal), `packages/web/public/media/opencorvus-client-demo.webm` (deletion after replacement), `packages/web/qa/build-client-demo.mjs` (deletion with its sole output), `packages/web/src/components/Lander.astro`, `packages/web/src/components/MissionPage.astro`, `packages/web/src/components/PublicSiteHeader.astro`, `packages/web/src/components/PublicSiteFooter.astro`, `packages/web/src/components/PublicSiteLayout.astro`, `packages/web/src/content/docs/index.mdx`, `packages/web/src/content/docs/zh-cn/index.mdx`, `packages/web/src/content/landing.ts`, `packages/web/src/pages/mission/index.astro`, `packages/web/src/pages/zh-cn/mission/index.astro`, and this program record.
- Local validation and screenshots from the shared worktree are diagnostic only because generated public-market inputs include the other staged expansion. The acceptance candidate must instead be created as an immutable export of the parent commit plus only the Iteration 2 owned-file patch. The export receives its own temporary Git index so repository-aware generators see exactly the candidate files, and it may reuse the existing dependency directory read-only. Check, build, real-page screenshots, independent review, commit, push, Action, and production verification must all resolve to this same owned tree.

### Fresh independent review and user visual finding

- Fresh independent review: `REJECTED`.
- The proposed authority sentence implied that every external-system change receives explicit user approval, while the current permission contract allows the configured rule to be `allow`, `ask`, or `deny` and defaults to `allow`. The copy must describe user-owned permission rules rather than universal per-action approval.
- The proposed Chinese headline omitted `一个` in a way that sounded compressed, `打开快速开始` was an unnatural destination label, and only the Chinese description promised that data would `始终保留`. The bilingual contract must be rewritten around reciprocal workspace, connection, and reviewability semantics without a unilateral retention promise.
- The fresh status showed that the shared-worktree build was not the exact candidate tree. The isolated candidate boundary above is required before delivery.
- During real-page inspection, the user reported that the hero video was visually squeezed. Browser evidence confirmed the `2880 × 1620` source was rendered into a `557.44 × 470` box with `object-fit: cover`. The source is `16:9`, while the rendered box is about `1.19:1`; about one third of the horizontal composition is cropped. The fixed `470px` height is the direct trigger.

### Revised copy and media contract

The earlier proposed copy table is superseded by this revision.

| Surface | English | Simplified Chinese |
| --- | --- | --- |
| Hero eyebrow | `Open-source workspace for Agents` | `面向 Agent 的开源工作区` |
| Hero headline | `Agents work in a real workspace. Results stay reviewable.` | `Agent 在真实工作区工作，结果可审查。` |
| Hero description | `Within each Task, OpenCorvus keeps the goal, participating Agents, tools, files, decisions, and evidence connected—from first instruction through final acceptance.` | `在每个任务中，OpenCorvus 把目标、参与的 Agent、工具、文件、决策与证据关联在一起，贯穿首次指令到最终验收。` |
| Primary action | `Browse Expert Squads` | `浏览专家团` |
| Secondary action | `Open the quickstart` | `查看快速开始` |
| Authority boundary | `You set the scope and the permission rules for external changes. OpenCorvus keeps the work and its evidence visible.` | `你设定任务范围和外部改动的权限规则；OpenCorvus 让工作过程与证据保持可见。` |
| Homepage description | `An open-source workspace that keeps Agent work, Expert Squads, and reviewable evidence together.` | `把 Agent 工作、专家团协作与可审查证据放在一起的开源工作区。` |
| Footer statement | `An open-source workspace for Agent work, Expert Squads, and reviewable evidence.` | `面向 Agent 工作、专家团协作与可审查证据的开源工作区。` |

The revised headlines describe the same observable relationship without unnatural imperative compression. `Connected` / `关联在一起` describes the Task projection without promising indefinite retention. `Permission rules` / `权限规则` accurately covers `allow`, `ask`, and `deny` while preserving user authority. The Chinese quickstart label is a natural document-navigation action.

This video-ratio repair was the approved fallback before the user requested a comic replacement. It is retained only as diagnosis evidence and is superseded by the final comic contract below; the implementation removes the video instead of restyling it.

### Revised implementation and acceptance delta

1. Obtain fresh independent `APPROVED` on this revised copy, permission boundary, media correction, and exact-candidate process before changing the source again.
2. Apply the revised strings through the same localized owners and keep the authority boundary in `landingContent.hero.boundary`.
3. In the existing global landing-video rule, replace the fixed height and cover crop with intrinsic `16:9` presentation. Do not touch the separately staged market-result CSS hunks.
4. Export `HEAD` plus only the owned-file patch to an isolated candidate directory, create a local temporary Git index there, reuse dependencies without changing them, and run the required checks and build against that exact candidate.
5. Serve the candidate on an isolated loopback port and visually inspect English and Simplified Chinese at `1280 × 720`. Both headlines must use at most two lines; no copy, action, or comic panel may clip or collide; the comic must render at `16:9` without cropping; and the page must have no horizontal overflow or browser console errors.
6. A new independent delivery reviewer must inspect the exact candidate patch, screenshots, metrics, validation output, and workspace boundary. Resolve every valid finding and repeat review if source changes.
7. Commit only the owned files with an exact path-limited commit, confirm the other staged work remains outside the commit, push `main`, wait for the exact `deploy-opencorvus-com.yml` run, and repeat cache-busted live English and Simplified Chinese visual verification.

### Revised plan-review verdict

- Superseded before review by the user's full-story correction below. Implementation and delivery remain blocked until the complete corrected plan receives `APPROVED`.

### User story correction

The user supplied the intended complete narrative after seeing the candidate page:

> 定制自己的 Workdeck + 可配置专家团 + 基于专家团合作的长程任务 + Join us / Contribute your experts / build a community for everyone.

This is a product-story correction, not another line-edit request. It supersedes the earlier hero-only framing and changes the homepage sequence, action hierarchy, and closing destination. The video-ratio and truthful-permission findings remain blockers inside the corrected plan.

### Repository truth for the corrected story

- The user clarified that `Workdeck` was provisional and asked for a more professional name. The selected public term is **Agent Workbench** / **Agent 工作台**. `Workbench` conventionally communicates a configured surface that brings tools and work together, while `Workspace` already identifies a concrete working directory in the product and `Mission` owns long-running organization. Agent Workbench is a public product-story noun, not a new Runtime, Mission, Task, Session, or database authority. Source code and architecture retain their existing canonical object names.
- The current product allows workspace, Skills, tools, Model Context Protocol access, models, and permission rules to shape execution. Permission rules are configurable as `allow`, `ask`, or `deny`; copy must not imply mandatory approval for every external change.
- An Expert Squad is a versioned, inspectable package of Agent roles, instructions, Skills, tools, Model Context Protocol access, selector guidance, and any declared workflow. Installation and activation remain explicit.
- One Task owns one fixed Expert Squad revision and any selected workflow for its lifecycle. Roles can hand off exact typed Artifacts and evidence. A Mission coordinates several Tasks when an outcome needs different Squads or explicit dependencies. This is the factual basis for the long-horizon story.
- The existing `/publish/` author path lets contributors build, validate, freeze, and contribute Expert Squad packages through the public source repository. Third-party self-service Registry listing is not open. The community call must link to this truthful author path and GitHub Discussions, not promise immediate self-service publication.

### Corrected information architecture

The existing page order `generic work modes → Expert Squads → runtime surfaces → install/source/releases` does not tell the requested story. Replace it with one four-part progression while reusing the existing sections and visual system:

1. **Customize your Agent Workbench** — define the workspace, tools and capabilities, permission rules, and visible control surface.
2. **Configure your Expert Squad** — choose or build a package by task fit, named roles, workflow, and exact revision.
3. **Run long-horizon work** — show one fixed Squad carrying a Task through role handoffs, Artifacts, evidence, and review; explain that Mission connects several Tasks when needed.
4. **Join the community** — set up an Agent Workbench, contribute an Expert Squad through the current source-authoring path, or join GitHub Discussions.

The hero introduces the whole progression. Its primary action begins the Agent Workbench path at quickstart; its secondary action explores the Expert Squad catalog. The final section no longer prioritizes release downloads because that breaks the requested community ending. Releases remain reachable from the quickstart, documentation, source repository, and footer-adjacent navigation elsewhere on the site.

### Corrected bilingual copy contract

| Surface | English | Simplified Chinese |
| --- | --- | --- |
| Homepage description | `Customize your Agent Workbench, configure Expert Squads, and carry long-horizon work from first instruction to reviewable delivery.` | `定制你的 Agent 工作台，配置专家团，让长程任务从首次指令走到可审查交付。` |
| Hero eyebrow | `Open-source Agent Workbench for long-horizon work` | `面向长程任务的开源 Agent 工作台` |
| Hero headline | `Build your Workbench. Run Missions.` | `定制你的工作台，运行 Mission。` |
| Hero description | `Connect a real workspace, choose tools and permission rules, configure an Expert Squad, and keep its collaboration, files, decisions, and evidence connected through one Task.` | `连接真实工作区，选择工具与权限规则，配置专家团，并让协作、文件、决策与证据贯穿同一个任务。` |
| Hero primary action | `Set up your Workbench` | `开始定制工作台` |
| Hero secondary action | `Explore Expert Squads` | `探索专家团` |
| Hero authority boundary | `You choose what connects, which Squad runs, and the permission rules. OpenCorvus keeps the Task and its evidence visible.` | `由你决定连接什么、启用哪个专家团以及权限规则；OpenCorvus 让任务与证据保持可见。` |
| Video caption | `One Workbench, one long-running Task, one visible evidence trail.` | `一个工作台、一项长程任务、一条可见证据链。` |
| Proof 1 | `Your Agent Workbench` — `Workspace, tools, capabilities, and permission rules shaped around your work.` | `你的 Agent 工作台` — `围绕你的工作组织工作区、工具、能力与权限规则。` |
| Proof 2 | `Configurable experts` — `Choose or build an inspectable Expert Squad instead of accepting an anonymous Agent pool.` | `可配置专家团` — `选择或构建可检查的专家团，而不是接受匿名 Agent 池。` |
| Proof 3 | `Long-horizon delivery` — `Keep the team, handoffs, Artifacts, and evidence connected from instruction to acceptance.` | `长程交付` — `让团队、交接、产物与证据从指令到验收始终关联。` |
| Footer statement | `Customize your Agent Workbench, configure Expert Squads, and help grow an open community for long-horizon Agent work.` | `定制 Agent 工作台、配置专家团，与社区一起拓展 Agent 长程工作的可能。` |

The corrected hero headline is intentionally shorter than the already measured two-line production headline. At the same `607.35px` column, `69.12px` font size, and `-5.184px` letter spacing, the two English clauses `Build your Workbench.` and `Run Missions.` are each materially shorter than the existing measured lines of about `584.27px` and `568.89px`. The Chinese clause pair is also shorter than the existing two-line Chinese headline. This is a conservative two-line contract; the exact candidate page remains the final authority and must reject any unexpected third line rather than adjust typography.

#### Section 01: Customize your Agent Workbench

- Eyebrow: `01 · Make it yours` / `01 · 定制你的工作方式`
- Title: `Shape an Agent Workbench around the way you work.` / `围绕你的工作方式，定制 Agent 工作台。`
- Lead: `Your Agent Workbench brings the working directory, capabilities, permission rules, and review surface into one visible setup. It describes the surface you configure, not a second runtime object.` / `Agent 工作台把工作目录、能力、权限规则与审查界面组织在一套可见配置中。它描述的是你定制的工作界面，而不是第二套运行时对象。`
- Cards:
  - Use `Ground the work` / `让工作落地`; name `Connect real work` / `连接真实工作`; description `Bring repositories, files, terminals, and connected systems into the same visible working context.` / `把代码仓库、文件、终端与已连接系统带进同一个可见工作环境。`; output `A real working context` / `一个真实工作环境`.
  - Use `Fit the capability set` / `匹配所需能力`; name `Choose capabilities` / `选择能力`; description `Select the Skills, tools, models, and connected services the work actually needs.` / `选择任务真正需要的 Skills、工具、模型与已连接服务。`; output `Only the capabilities you chose` / `只使用你选择的能力`.
  - Use `Keep authority explicit` / `明确保留权限`; name `Set the rules` / `设定规则`; description `Configure allow, ask, or deny behavior and keep the review surface visible.` / `配置允许、询问或拒绝规则，并让审查界面保持可见。`; output `Inspectable rules and review` / `可检查的规则与审查`.

#### Section 02: Configure your Expert Squad

- Eyebrow: `02 · Configure your experts` / `02 · 配置你的专家团`
- Title: `Choose or build the Expert Squad that fits the work.` / `选择或构建真正适合任务的专家团。`
- Lead: `Each Expert Squad is a configurable, inspectable package: roles, workflow, Skills, tools, selection guidance, version, and digest travel together.` / `每个专家团都是可配置、可检查的能力包：角色、工作流、Skills、工具、选择说明、版本与摘要一起交付。`
- Capability rows:
  - `Start from task fit` / `从任务适配开始` — `Choose by the outcome, inputs, and limits the team declares.` / `根据团队声明的目标、输入与边界来选择。`
  - `Shape roles and workflow` / `配置角色与工作流` — `Give each specialist visible responsibility and connect their handoffs.` / `为每位专家分配可见责任，并明确彼此的交接关系。`
  - `Freeze an exact revision` / `冻结精确版本` — `Keep roles, capabilities, workflow, version, and digest bound together.` / `把角色、能力、工作流、版本与摘要绑定在同一精确版本中。`
- Actions: `Explore Expert Squads` / `探索专家团`; `Build your Expert Squad` / `构建你的专家团`.
- Header author-path label: `Contribute Experts` / `贡献专家团`, still linking to `/publish/`.

#### Section 03: Run the long arc

- Eyebrow: `03 · Run the long arc` / `03 · 推进长程任务`
- Title: `Let one Expert Squad carry a Task from first instruction to reviewed delivery.` / `让一个专家团把任务从首次指令推进到经过复核的交付。`
- Lead: `A Task keeps one exact Expert Squad and its workflow fixed through the lifecycle. Named roles hand off typed Artifacts and evidence; when an outcome needs several Tasks or Squads, a Mission connects their dependencies without erasing ownership.` / `一个任务在整个生命周期中固定使用同一精确版本的专家团及其工作流。具名角色通过带类型的产物与证据完成交接；当一个结果需要多个任务或专家团时，Mission 连接它们的依赖，同时保留清晰责任。`
- Facts:
  - `One fixed team per Task` / `每个任务固定一支团队` — `A Task resolves one exact Expert Squad revision at creation and cannot silently switch it mid-run.` / `任务创建时解析一个精确版本的专家团，运行中不能静默切换。`
  - `Typed handoffs` / `带类型的交接` — `Named roles pass exact Artifact references and evidence instead of relying on summaries alone.` / `具名角色传递精确的 Artifact 引用与证据，而不是只依赖文字总结。`
  - `Mission-scale coordination` / `Mission 级协同` — `When an outcome needs several Tasks or Squads, Mission records dependencies and preserves each Task's owner.` / `当一个结果需要多个任务或专家团时，Mission 记录依赖并保留每个任务的责任归属。`

#### Section 04: Join the community

- Eyebrow: `04 · Join us` / `04 · 加入我们`
- Title: `Contribute your experts. Expand what everyone can accomplish.` / `贡献你的专家能力，让每个人都能完成更多。`
- Lead: `Package specialist knowledge as an inspectable Expert Squad, validate it with the open SDK, and contribute it through the source repository. Self-service listing is not open yet; community review remains part of publication.` / `把专业知识封装成可检查的专家团，用开放 SDK 完成验证，再通过源码仓库贡献。自助上架尚未开放，社区审查仍是发布路径的一部分。`
- Cards:
  - Quickstart card: label `Set up your Workbench` / `开始定制工作台`; title `Install, connect a workspace, and shape your first Agent setup.` / `安装 OpenCorvus、连接工作区，并完成第一套 Agent 配置。`; note `OpenCorvus quickstart →` / `OpenCorvus 快速开始 →`.
  - Author card: label `Contribute an Expert Squad` / `贡献一个专家团`; title `Package, validate, and contribute specialist knowledge through the open source path.` / `通过开源路径封装、验证并贡献专业能力。`; note `Expert Squad author path →` / `专家团作者路径 →`.
  - Discussion card: label `Join the discussion` / `加入讨论`; title `Share use cases, review proposals, and help shape the community.` / `分享使用场景、审查提案，并一起建设社区。`; note `GitHub Discussions →` in both locales.

### Corrected implementation boundary

1. Rename only the homepage-local content groups from `modes`, `continuity`, and `start` to `workbench`, `mission`, and `community`; update the matching `Lander.astro` consumers and heading IDs. This removes old-story naming rather than leaving parallel content owners.
2. Reverse the hero action destinations so the primary Agent Workbench action links to quickstart and the secondary Expert Squad action links to the market.
3. Remove homepage-only release download discovery and release/source cards from `Lander.astro`; replace the last cards with the exact community destinations above. Do not delete the download library or change release/documentation pages.
4. Replace the video with the approved concept comic and remove the video, poster, and sole-purpose generator exactly as specified in the final comic contract. `packages/web/src/styles/public-site.css` remains outside this iteration.
5. Add the Mission navigation item and current-page state, and change the shared author-path label to `Contribute Experts` / `贡献专家团`; keep all existing destinations and language behavior intact.
6. Add the reciprocal Mission routes and one localized `MissionPage.astro`, then align homepage metadata and footer positioning with the four-part story. Do not change global documentation title suffixes or non-homepage documentation body copy.
7. The exact-candidate, real-page, independent delivery-review, commit, push, Action, and live-production contracts above remain mandatory. At `1280 × 720`, the hero headline must use no more than two lines in both locales, the comic must preserve `16:9`, and the complete first viewport must remain unclipped with no horizontal overflow.

### Complete corrected plan-review verdict

- Superseded by the dedicated Mission-page addition below. No source implementation, commit, or push is authorized by the process until the full Agent-Workbench-to-community narrative and Mission page are `APPROVED` together.

### Dedicated Mission navigation and page

The user requires a dedicated top-level tab that explains what Mission is, how it works, and why it can sustain long-horizon work. A homepage section alone is insufficient because Mission is a core product concept with its own durable-object, authority, lifecycle, evidence, and recovery boundaries.

#### Navigation and route contract

- Add a top-level `Mission` item to `PublicSiteHeader.astro` for both locales, placed before Expert Squads so the primary public sequence becomes `Mission → Expert Squads → Contribute Experts → Trust → Docs`.
- Add reciprocal static routes `/mission/` and `/zh-cn/mission/`, backed by one localized `MissionPage.astro` and the existing `PublicSiteLayout.astro`.
- Extend the shared layout/header `current` union with `mission`; use `aria-current="page"` on the active Mission route. Keep the brand home link, language switch, skip link, footer, metadata, canonical URL, and all existing routes unchanged.

#### Mission page copy and content contract

- English title / description: `How Missions run long-horizon work · OpenCorvus` / `How OpenCorvus coordinates fixed-squad Tasks, typed handoffs, evidence, and recovery across a long-horizon outcome.`
- Chinese title / description: `Mission 如何运行长程任务 · OpenCorvus` / `了解 OpenCorvus 如何用固定专家团的 Task、带类型交接、证据与恢复机制协调长程目标。`
- Hero eyebrow: `Mission` in both locales.
- Hero heading: `Turn one long-horizon outcome into a chain of owned, reviewable Tasks.` / `把一个长程目标拆成责任清晰、可审查的任务链。`
- Hero lead: `Mission coordinates the outcome; it is not a larger Agent. Each child Task owns one exact Expert Squad and workflow, while dependencies, messages, Artifacts, evidence, and lifecycle decisions remain visible.` / `Mission 协调结果，但它不是一个更大的 Agent。每个子任务固定拥有一个精确版本的专家团与工作流，任务依赖、消息、产物、证据和生命周期决策都保持可见。`

The body contains four semantic sections with the following frozen localized fields.

1. **What Mission owns**
   - Eyebrow: `What Mission owns` / `Mission 负责什么`.
   - Heading: `Coordination stays separate from execution.` / `协调与执行保持分离。`
   - Lead: `Mission owns the outcome and the dependency graph. The work, capability projection, and evidence remain with their real owners.` / `Mission 负责目标与依赖图；具体工作、能力投影与证据仍归属于各自真实责任方。`
   - Cards:
     - `Mission` — `Outcome and dependencies` / `目标与依赖`; `Coordinates the outcome across child Tasks and records their dependency graph.` / `跨子任务协调目标，并记录它们的依赖图。`
     - `Task` — `One owned delivery` / `一项有明确归属的交付`; `Owns one project-scoped delivery, one fixed Expert Squad revision, any selected workflow, its Sessions, and lifecycle decisions.` / `负责一项项目范围内的交付、一个固定专家团版本、已选工作流、相关 Session 与生命周期决策。`
     - `Expert Squad` — `Roles and capability projection` / `角色与能力投影`; `Supplies named Agents, instructions, Skills, tools, MCP access, selection guidance, and any declared workflow.` / `提供具名 Agent、指令、Skills、工具、MCP 访问、选择说明与已声明工作流。`
     - `Artifacts and evidence` — `Exact, reviewable handoffs` / `精确、可审查的交接`; `Typed Artifacts carry provenance and exact references; host observations record file and command facts independently of Agent summaries.` / `带类型的 Artifact 携带来源与精确引用；Host observation 独立于 Agent 总结记录文件与命令事实。`
2. **How a Mission moves**
   - Eyebrow: `How it works` / `如何运行`.
   - Heading: `A Mission advances through owned Tasks, not one endless Agent turn.` / `Mission 通过责任明确的任务推进，而不是依赖一个无限延长的 Agent 回合。`
   - Lead: `Every transition preserves the Task boundary, selected capability identity, and evidence used for the next decision.` / `每次流转都保留任务边界、已选能力身份，以及下一次决策所依据的证据。`
   - Ordered stages:
     1. `Define the outcome` / `定义目标` — `Record the requested outcome, boundaries, and acceptance conditions.` / `记录所需结果、任务边界与验收条件。`
     2. `Split owned Tasks` / `拆分责任明确的任务` — `Create separate Tasks only where a delivery can be independently owned, accepted, retried, or depended on.` / `只有当交付可以独立负责、验收、重试或被依赖时，才拆成独立任务。`
     3. `Hold Squad identities` / `持有专家团身份` — `At launch, Mission records the Expert Squad IDs it may use; later installs do not silently widen that set.` / `Mission 启动时记录可使用的专家团 ID；之后新安装的能力不会静默扩大这一集合。`
     4. `Freeze each Task revision` / `冻结每个任务的版本` — `When a child Task is created, one allowed Squad ID resolves to one exact package revision and any selected workflow for that Task.` / `创建子任务时，一个获准的专家团 ID 会为该任务解析并固定到一个精确能力包版本及已选工作流。`
     5. `Run Task-local collaboration` / `运行任务内协作` — `Named roles stream messages and tool work, then hand off typed Artifact references and visible evidence.` / `具名角色流式产生消息与工具工作，再交接带类型的 Artifact 引用与可见证据。`
     6. `Read evidence and decide` / `读取证据并决策` — `Mission reads terminal child outputs and uses explicit acceptance, retry, replan, or dependent-Task paths.` / `Mission 读取已终止子任务的输出，并通过显式验收、重试、重规划或依赖任务路径继续。`
3. **Why it can run long**
   - Eyebrow: `Why it can run long` / `为什么能做长程任务`.
   - Heading: `Long-horizon work comes from durable boundaries and evidence.` / `长程能力来自持久边界与证据。`
   - Lead: `These mechanisms preserve continuity across many Sessions and Tasks; they do not promise guaranteed autonomy or quality.` / `这些机制让多个 Session 与任务保持连续，但不承诺必然自治或必然高质量。`
   - Reasons:
     - `Durable organization` / `持久组织` — `Mission and Task state persist, while versioned goal and acceptance contracts preserve what is being delivered and judged.` / `Mission 与 Task 状态持久保存，版本化目标与验收契约保留正在交付和判断的内容。`
     - `Fixed Task authority` / `固定任务权限` — `One exact Expert Squad revision and any selected workflow remain fixed for the Task lifecycle.` / `一个精确版本的专家团及已选工作流在任务生命周期内保持固定。`
     - `Evidence-carrying handoffs` / `带证据的交接` — `Typed Artifact references, provenance, complete reads, and host observations let later work inspect the exact basis for a decision.` / `带类型的 Artifact 引用、来源、完整读取与 Host observation 让后续工作检查决策的精确依据。`
     - `Explicit recovery` / `显式恢复` — `Retry and replan preserve accepted inputs and execution history instead of hiding failure behind an automatic replay.` / `重试与重规划保留已接受输入和执行历史，而不是用自动重放掩盖失败。`
4. **The real boundary**
   - Eyebrow: `The real boundary` / `真实边界`.
   - Heading: `Long-running does not mean unlimited or unattended forever.` / `长程运行不等于无限执行或永久无人值守。`
   - Body: `Unattended work runs only while the local or hosted OpenCorvus runtime is online. Output quality depends on selected models, reachable sources, installed capabilities, and available evidence. Permission rules still govern external effects. A Task cannot silently switch Expert Squads mid-lifecycle, and Mission coordination never erases Task or Agent ownership.` / `无人值守工作只会在本地或托管 OpenCorvus 运行时在线期间继续。输出质量取决于所选模型、可访问来源、已安装能力与可用证据。外部影响仍受权限规则约束。任务不能在生命周期中静默切换专家团，Mission 协调也不会抹去 Task 或 Agent 的责任归属。`

The page ends with `Read the Mission and Task reference` / `阅读 Mission 与 Task 参考` linking to `/reference/mission-task/`, and `Explore Expert Squads` / `探索专家团` linking to `/market/`. It adds no interactive state, automation, diagram library, or duplicate runtime documentation.

#### Mission page visual and accessibility contract

- Reuse the public site's existing paper, ink, cobalt, monospace indices, border, grid, action, and utility-section primitives so Mission is recognizably part of the same site.
- Use native headings, an ordered list for the six-step flow, and card groups whose visible titles remain meaningful without color. Do not use color as the only state indicator.
- At `1280 × 720`, the hero heading and lead must be fully visible without horizontal overflow. Full-page English and Chinese screenshots must show the four-section rhythm, legible line lengths, and a final boundary/CTA region without clipping.
- Keyboard navigation must reach Mission in the shared header and both final actions with visible focus inherited from the public-site system. Browser console errors must remain empty.

### Final combined plan-review verdict

- Superseded by the comic-replacement addition below. The independent review must cover the complete combined plan and final image-generation brief.

### Comic replacement addition

The user requires an original comic that explains the OpenCorvus concept chain and replaces the existing hero video:

`platform → Skills / MCP / tools → Agent → Expert Squad → Mission with several Task-owned Squads → long-horizon work → community`.

This supersedes the earlier video-ratio repair. The root cause evidence remains useful, but the final page must not render the old video, poster, controls, or caption.

#### Image generation brief

- Use the built-in image-generation path under the repository-required `imagegen` skill. This is a new project-bound raster asset, not an edit of the current poster.
- Use case: `illustration-story`.
- Asset type: OpenCorvus public-homepage hero concept comic.
- Produce one wide `16:9` editorial technical comic with seven clearly separated panels in a `4 + 3` grid so it remains legible inside the existing desktop hero media column.
- Narrative beats, in exact order:
  1. an open platform foundation and visible workspace;
  2. modular Skill, MCP, and tool capability blocks connecting into the platform;
  3. one Agent using those capabilities on real files and a terminal;
  4. several named specialist Agents forming one coordinated Expert Squad;
  5. a Mission coordinating multiple dependency-linked Tasks, each visibly retaining its own fixed Squad identity;
  6. a long timeline of planning, execution, handoffs, verification, recovery, and evidence leading to a reviewable delivery;
  7. an open community contributing new expert capability packages back into the shared catalog.
- Style: original editorial graphic-novel illustration with crisp geometric panels, bold black ink, warm off-white paper, cobalt-blue primary accents, restrained clay-orange secondary accents, subtle halftone texture, and the same high-contrast utilitarian character as the current public site. It must feel like a serious systems explainer, not a superhero or children's comic.
- Composition: strong left-to-right / top-to-bottom flow, recurring visual motifs for exact handoffs and visible evidence, large simple silhouettes, generous internal whitespace, no tiny UI screenshots, and no decorative background outside the panels.
- Embedded text: panel numbers `01` through `07` only. Do not generate prose, logos, brand names, watermarks, pseudo-code, unreadable interface text, speech bubbles, or captions inside the bitmap. Localized HTML supplies the exact narrative caption.
- Avoid: humanoid robot clichés, photorealism, glossy 3D, neon cyberpunk, generic cloud-network imagery, anonymous swarms, magical autonomy, guaranteed-success symbols, distorted hands, and any implication that one Task switches Squads mid-run.

#### Web integration contract

- Save the selected final image as `packages/web/src/assets/lander/opencorvus-concept-comic.png`; never leave the project reference under the image tool's default generated-image directory.
- Replace the `<video>` element with Astro's optimized `<Image>` component. Keep the existing bordered figure and cobalt shadow, but remove video-only source construction, controls, preload, poster, and global fixed-height/object-fit rules.
- Give the image localized alternative text that describes the full seven-step relationship, not `comic` or `illustration` alone.
- Localized figure caption:
  - English: `Platform → Skills, MCP, and tools → Agent → Expert Squad → Mission → long-horizon work → open community.`
  - Chinese: `平台 → Skills、MCP 与工具 → Agent → 专家团 → Mission → 长程任务 → 开放社区。`
- Delete the now-unreferenced `packages/web/public/media/opencorvus-client-demo.webm` in the same commit so the static site does not continue shipping an unused 11.47 MB asset. A complete repository reference search proves that `packages/web/qa/build-client-demo.mjs` exists only to generate that WebM and that `packages/web/src/assets/lander/client-agent-workspace.png` exists only as the removed video poster; delete both dead assets with the replacement rather than retain a second obsolete media path.
- At `1280 × 720`, the complete comic must preserve `16:9`, remain fully visible without crop or distortion, and have panels large enough to distinguish the seven beats. The hero copy/actions/boundary must not collide with the figure, and there must be no horizontal overflow.
- Full-page English and Chinese visual review must confirm that the comic's flow agrees with the homepage story and dedicated Mission page. Alternative text and caption must be reciprocal. Static check/build success cannot substitute for image inspection.

### Final plan-review gate

- The seven-panel static comic was approved, but the user rejected its visual comprehension after the first generated result and replaced the medium with an animated GIF. That material change supersedes this approval only for the hero concept asset and integration. Agent Workbench naming, homepage information architecture, Mission page, exact-candidate isolation, bilingual copy, dead-media cleanup, accessibility, and the delivery contract remain approved and unchanged.

### Animated GIF correction

The rejected first image was a dense, detailed seven-panel comic. At hero-column scale, the people, arrows, and capability badges collapsed into one busy scene and did not explain the concept relationship. A second image-edit call was terminated without output after the user replaced the request. Neither generated image is copied into or referenced by the repository.

#### Clear animation model

- Generate one new wide `16:9` static concept map with seven large, simple stations in an exact `4 + 3` grid. It is the single visual source for both locales and the reduced-motion fallback.
- Each station uses one large symbol and one relationship only: platform foundation; capability blocks; one Agent; one Expert Squad; Mission with several dependency-linked Tasks and a distinct fixed Squad per Task; long-horizon evidence timeline; open community contribution loop.
- The master bitmap contains only the exact numbers `01` through `07`. It contains no people-heavy scenes, prose, UI screenshots, pseudo-code, logos, watermarks, or micro-detail.
- Build two localized GIFs from that same master with deterministic local image processing. Each GIF cycles through seven keyframes. Every frame enlarges exactly one source station into the left `55%` of a `960 × 540` canvas and places its frozen heading and explanation in a high-contrast right-hand caption column; this preserves one concept per frame instead of shrinking seven simultaneous scenes. No model is asked to maintain character or layout consistency across seven independent generations.
- The animation uses discrete instructional frames rather than decorative motion: each stage holds long enough to read, the final community frame holds longer before the sequence repeats, and there are no flashes, rapid transitions, parallax, or continuous movement.

#### Frozen animation captions

| Step | English heading | English explanation | Chinese heading | Chinese explanation |
| --- | --- | --- | --- | --- |
| 01 | `Open platform` | `One visible place for real work.` | `开放平台` | `让真实工作集中在一个可见界面。` |
| 02 | `Skills, MCP, and tools` | `Connect only the capabilities the work needs.` | `Skills、MCP 与工具` | `只连接任务真正需要的能力。` |
| 03 | `Agent` | `One Agent uses those capabilities in context.` | `Agent` | `一个 Agent 在真实上下文中使用这些能力。` |
| 04 | `Expert Squad` | `Named specialists coordinate through explicit handoffs.` | `专家团` | `具名专家通过明确交接协同工作。` |
| 05 | `Mission` | `Mission links Tasks; each Task keeps one fixed Squad.` | `Mission` | `Mission 连接多个任务；每个任务固定一支专家团。` |
| 06 | `Long-horizon work` | `State, Artifacts, evidence, and recovery carry work forward.` | `长程任务` | `状态、Artifact、证据与恢复机制让工作持续推进。` |
| 07 | `Open community` | `Contribute expert packages everyone can inspect and reuse.` | `开放社区` | `贡献人人都能检查和复用的专家能力包。` |

#### Generation and local animation contract

- Use the built-in `imagegen` path once for the new master concept map. Copy the selected result to `packages/web/src/assets/lander/opencorvus-concept-map.png` before integration.
- Use a checked-in-independent local script under the task's scratch directory, not the repository, to create the two GIFs from the exact master. The script may crop and enlarge an existing station, add the frozen caption column, and apply palette optimization; it must not redraw or reinterpret the seven concepts.
- Freeze generation to Pillow `12.3.0`. The script must verify and then use `C:\Windows\Fonts\msyhbd.ttc` for headings (`SHA-256 4508821b3dffe01f0ef5e5326a3e60df705a44633858811f67b6982dce3f6ee6`) and `C:\Windows\Fonts\msyh.ttc` for body copy (`SHA-256 d79c55e68b1131eea0cc1c47be4f572d964f28c682e143db2ad09c1e4cb07a3f`). A font or Pillow mismatch must fail generation rather than silently changing layout.
- Use the existing site's warm paper, black ink, cobalt, and clay palette. At `960 × 540`, headings render at no less than `40px`, explanations at no less than `25px`, and body text wraps inside the caption column without clipping.
- Freeze each GIF at `960 × 540`, exactly seven frames, and exactly `12,000ms` per loop: frames `01`–`06` hold for `1,500ms` each and frame `07` holds for `3,000ms`. Palette optimization may reduce the palette from `128` to `96` or `64` colors if needed, but may not change dimensions, frame count, duration, text size, or source crops. Each localized GIF must be at most `3,145,728` bytes; the static master must be at most `2,097,152` bytes. Record final dimensions, frame count, durations, byte size, palette choice, and SHA-256.
- Generated result: Pillow `12.3.0` verified both frozen font hashes. The static `960 × 540` PNG is `594,548` bytes with SHA-256 `5f43ae2afa99cb43ce1d7e7a9f666bd556f739b7ddd5dc221dfae9a1db2edd0b`. The English GIF is `892,773` bytes with SHA-256 `265ca74de1a0fb373eb3601ba6ff5479e60768bf4cb37304e8cb82d0e3c7de64`; after real-page review repaired mixed ASCII/CJK wrapping, the Chinese GIF is `887,084` bytes with SHA-256 `5482c7c0b8461925f73e268f1f426f4ff889ceee6b03eda37dbf54efd6827bb6`. Both GIFs use `128` colors, `960 × 540`, seven frames, the exact `[1500, 1500, 1500, 1500, 1500, 1500, 3000]ms` durations, and a `12,000ms` loop.

#### Web, accessibility, and visual contract

- Replace the video with a shared static master and a visible, localized animation control. Initial HTML renders only the static master. A real `<button type="button" aria-pressed="false">` says `Play concept animation` / `播放概念动画`; activation requests and displays only the current locale's GIF, sets `aria-pressed="true"`, and changes the visible label to `Stop animation` / `停止动画`. Stopping immediately restores the static master and original label. English markup never emits the Chinese GIF URL and Chinese markup never emits the English GIF URL.
- The GIF URL exists only in the current locale figure's `data-animation-src`; it is absent from initial `src` and `srcset`, so neither GIF is requested before explicit activation. The other locale's GIF URL is absent from the document. This prevents autoplay and keeps the animation pausable without relying on CSS visibility.
- `prefers-reduced-motion: reduce` keeps the same static initial state and never starts motion automatically. A user may still make the explicit choice to play and stop the discrete instructional animation; the visible control remains available throughout. The localized figure caption and alternative text state the complete sequence even when animation is not played.
- English alternative text: `Animated OpenCorvus concept flow from the open platform through Skills, MCP, tools, one Agent, an Expert Squad, a Mission of fixed-squad Tasks, long-horizon work, and community contributions.`
- Chinese alternative text: `OpenCorvus 动画概念流程：从开放平台、Skills、MCP 与工具，到 Agent、专家团、由固定专家团任务组成的 Mission、长程任务和社区贡献。`
- Localized visible figure caption remains `Platform → Skills, MCP, and tools → Agent → Expert Squad → Mission → long-horizon work → open community.` / `平台 → Skills、MCP 与工具 → Agent → 专家团 → Mission → 长程任务 → 开放社区。`
- The old WebM, poster, and sole-purpose generator remain deleted as previously approved.
- Real-page review at `1280 × 720` must confirm through the page's resource timing entries that initial load requests the static master and no `.gif`, activate the control, watch one complete loop in each locale, stop it, and verify the static master returns. It must confirm every caption is readable and localized, step `05` visibly preserves one fixed Squad per Task, the opposite-locale URL is absent, and there is no hero collision, crop, distortion, horizontal overflow, console error, or excessive first-load delay. Reduced-motion emulation must visibly keep the static master until the user explicitly activates the same control.

### Animated GIF plan-review gate

- `APPROVED` by the fresh independent read-only `iteration2_final_plan_gate` reviewer after the GIF delta froze explicit play/stop control, initial no-GIF loading, locale isolation, deterministic Pillow/font hashes, exact dimensions/frame timing, hard byte budgets, and real-page resource/visual acceptance. All previously approved non-image requirements remain mandatory.

### Iteration 2 implementation and exact-candidate acceptance

- The final implementation candidate is a detached independent clone of public parent `be35aeec38c7d70cb1289316f1dde5a12c8782bc` at `D:\myhexin-local\opencorvus-iteration2-0ae-candidate`, containing only the seventeen owned modified, added, and deleted paths listed above. The directory name records an earlier convergence point and is not version truth; `git show` identifies the exact parent above. Concurrent uncommitted work and the previously untracked equity report are absent, while the Download page, its responsive repair, Windows Mission recovery, and eighth Expert Squad batch are present as parent content. A first clone under `C:` proved unsuitable because Astro resolved same-repository dependencies through `D:` junctions into a cross-volume non-`file:` URL; same-volume candidates reused the exact dependency bytes without changing them.
- Exact-candidate validation passed: local Prettier `3.6.2` check on the TypeScript, MDX, and program record; `git diff --check`; `bun run --cwd packages/web check` with `0 errors`, `0 warnings`, and one pre-existing `dedupe-lead.cjs` unused-variable hint; `bun run docs:check` with `329 ops` in `25 groups`; and `bun run --cwd packages/web build` with `313` static pages. The page-count increase comes from the parent eighth Expert Squad batch. Existing Starlight override and tolerated-transform warnings remain non-blocking and unchanged.
- A Python static server served the exact candidate's built `dist` on `http://127.0.0.1:4345`, with the request log retained at `C:\Users\hengu\Documents\Codex\2026-08-11\opencorvus-agent-push-github-action-opencorvus\work\final-release-http-4345.stderr.log`. Initial English and Chinese requests fetched the static concept PNG and no GIF. Only after the visible play control was activated did the server log the matching `opencorvus-concept-flow-en...gif` or `opencorvus-concept-flow-zh...gif`. English markup contained no Chinese GIF URL, Chinese markup contained no English GIF URL, and stopping restored the static master and `aria-pressed="false"` in both locales.
- Real-page visual acceptance at `1280 × 720` measured a `1265px` document width in both locales, so neither homepage nor Mission route overflowed horizontally. The homepage title rendered as exactly two explicit visual lines with one complete accessible label in each locale. The English and Chinese static concept map, English frame `05`, Chinese frames `05`, `06`, and `07`, both Mission hero regions, and both final boundary/CTA regions were inspected. Frame `05` visibly retained a different fixed Squad badge on each Task. All four exact-candidate console error logs were empty.
- The first exact-candidate Chinese frame `05` review found the final CJK phrase clipped because the deterministic wrapper treated mixed ASCII/CJK copy as one long token. The scratch generator was repaired to keep ASCII words intact while allowing Chinese characters to wrap, the GIF was regenerated, the corrected size/hash above was recorded, and frames `05`–`07` were re-inspected without clipping. This repair changed only the generated Chinese GIF and this record.
- Nineteen final-parent visual evidence images are retained under `C:\Users\hengu\Documents\Codex\2026-08-11\opencorvus-agent-push-github-action-opencorvus\work\iteration2-release-evidence`. Images `01` through `18` are the complete post-replay capture from the final served `dist`; they cover the full Workbench → Expert Squad → long-horizon Mission → community story in both homepages, both localized GIF frame-05 and stopped states, and both localized Mission hero/end regions. Image `19` is an additional English first-viewport proof captured immediately after replaying the website commit onto parent `be35aeec`. At `1280 × 720`, both homepage and Mission routes report `scrollWidth=1265`, no console errors, correct reciprocal locale links, and Mission `aria-current="page"`. Independent delivery review, exact path-limited push, Action completion, and production verification remain pending.

### Iteration 2 production delivery

- Independent delivery review returned `APPROVED` after the full post-commit evidence set was recaptured and its timeline corrected. Commit `2002f2d114bddbb7e6206a62d53560a20edadbaa` was then pushed by normal fast-forward to public `main`.
- GitHub Actions run `31472183519` completed successfully for the exact commit. The workflow passed the static release build, Linux/macOS/Windows canonical archive verification, signed bundle assembly, and the RackNerd immutable-release deployment with atomic `current` switch.
- Production `https://opencorvus.com/`, `/zh-cn/`, `/mission/`, and `/zh-cn/mission/` were then inspected at `1280 × 720` with the commit query marker. Both homepages rendered the correct story, static concept map, Download and Mission navigation, and no console errors. The English GIF loaded only after activation and stopping restored the static map. Both Mission routes preserved localized metadata, reciprocal language links, `aria-current="page"`, `scrollWidth=1265`, and empty console error logs.

## Iteration 3 proposal: responsive and accessible public-site contract

### Read-only production findings

- Production mobile inspection used a real `390 × 844` browser viewport after Iteration 2 deployment. The English homepage reported `innerWidth=390`, `scrollWidth=1100`, `scrollHeight=14186`, `.public-landing { min-width: 1100px }`, a zero-width first heading at the left edge of the fixed canvas, and the concept figure beginning at `x=434.8`. The screenshot was effectively a blank paper strip with horizontal scrolling.
- The dedicated Mission route reported `scrollWidth=1126`; every header link began outside the viewport, and the hero heading began at `x=436.4`. The public Market, Publish, and Trust roots reported `scrollWidth=1402`, `1126`, and `1126` respectively. Representative English and Chinese Expert Squad detail routes both reported `scrollWidth=1262`. The responsive Download route reported `scrollWidth=375` and rendered correctly. Both Architecture Explorer locales also reported `scrollWidth=375` and remain a non-regression surface rather than an implementation target.
- Source inspection found the common cause: `body.public-site-body` and the scoped landing root enforce `min-width: 1100px`; the landing also hides overflow; `--content` has no narrow-screen definition; the shared header, footer, hero, utility, market, detail, chain, and card grids have only desktop columns; and the only complete narrow-screen shell rules live as Download-page-local `:global(...)` overrides. The Download repair therefore fixes one route while the common public shell and every other routed public page remain inaccessible on phones and narrow windows.
- The existing semantic baseline is otherwise sound: the public shell has a skip link, labeled primary/footer navigation, visible `:focus-visible`, localized `lang`, heading-linked sections, named buttons, localized GIF alternative text, explicit `aria-pressed`, and Mission metadata/current-page state. Iteration 3 must preserve these semantics and repair layout ownership rather than introduce a new navigation system.

### Approved-scope candidate

No implementation begins until a fresh independent reviewer approves this section.

1. **Move only the responsive shell and generic primitives to shared ownership.** In `packages/web/src/styles/public-site.css`, add the public-site narrow contract at `max-width: 1099px`: remove the body minimum width; set `--content` to `calc(100vw - 32px)`; keep every public main/header/footer within that width; lay the header out as brand plus language switch on row one and a wrapping site navigation on row two; stack the footer; reduce public section spacing and fluid display sizes; allow long words, hashes, paths, and URLs to wrap. Shared generic utility/detail primitives—including utility intro, detail hero/grid/tabs/dialogs, public buttons, state grids, boundary panels, and workflow rows—remain owned here. Route-specific homepage, Mission, Market selection guide, Publish, Trust, and Download grids do not move into this file. Keep the simple visible link set—no hamburger, dialog, hidden menu, or new client-side state.
2. **Remove the route-local shell fork.** Delete only DownloadPage's duplicate global body/header/navigation/footer narrow rules after the same behavior exists in the shared stylesheet. Retain its page-specific responsive release cards, platform grids, CLI, verification, and download-error rules. Real-page comparison must prove `/download/` and `/zh-cn/download/` remain unchanged in behavior.
3. **Make the homepage story responsive and give phones a readable GIF form.** In `Lander.astro`, keep all homepage-specific responsive rules with the scoped component styles: remove the landing minimum width/overflow trap; let explicit title lines wrap; use one-column hero, proof, Workbench, Expert Squad, long-horizon, and community layouts; stack CTA buttons at the narrowest width; and remove the translated second screenshot offset. Preserve the existing `960 × 540` desktop PNG/GIF bytes. Add one locale-neutral portrait mobile static map and localized English/Chinese portrait mobile GIFs, each presenting one large stage per frame with large embedded type designed to remain at least `16px` equivalent at a `358px` rendered width. A single `<picture>` selects the mobile static source at `max-width: 720px`; explicit Play changes that source to the matching locale-only mobile GIF, and Stop restores it. Nothing auto-plays, the whole frame remains visible without an inner horizontal scroller, reduced-motion remains static, and the accessible label still explains all seven stages. Workbench → Expert Squad → Mission → community remains the DOM and reading order.
4. **Keep Mission, Market, Publish, Trust, and Download route grids with their components.** Add Mission owner/reason/workflow narrow rules only to `MissionPage.astro`; Market selection guide/workspace narrow rules only to `MarketplacePage.astro`; publication chains/boundary narrow rules only to `PublishPage.astro`; trust chains/boundary narrow rules only to `TrustPage.astro`; and retain Download-specific release/platform/CLI/verification/error narrow rules only in `DownloadPage.astro`. Shared utility intros, state grids, boundary primitives, detail structures, and action groups remain in `public-site.css`. Collapse each phone layout to one readable column, using a two-column intermediate layout only where `768px` has enough room. Preserve numbered order, section associations, current-page state, and all factual copy.
5. **Make Market and Expert Squad detail views responsive.** Collapse the Market intro/selection guide/workspace and results to intrinsic-width columns; wrap filters; keep result identity, purpose, revision, and action in source order; allow the search/control row and hashes to shrink or wrap. Keep Squad-detail responsive ownership in the existing shared detail primitives in `public-site.css`: make the hero, revision facts, tabs, agent roster, workflow rows, walkthrough grids, dialogs, scope options, and actions fit the viewport. A tab list may scroll inside its own bounded region only if the document itself never overflows, focus remains visible, and every tab remains keyboard reachable.
6. **Preserve exclusions.** Do not change product positioning, Mission/Expert Squad facts, generated market data, GIF/PNG bytes, documentation/Starlight layout, Architecture Explorer layout, Download manifest behavior, or runtime code. Do not add a framework dependency, mobile-only duplicate markup, carousel, or auto-playing media.

The Iteration 3 implementation is frozen to exactly these owned paths; exact-candidate validation and delivery review must reject any additional path:

- `packages/web/src/styles/public-site.css`
- `packages/web/src/components/Lander.astro`
- `packages/web/src/components/MissionPage.astro`
- `packages/web/src/components/MarketplacePage.astro`
- `packages/web/src/components/PublishPage.astro`
- `packages/web/src/components/TrustPage.astro`
- `packages/web/src/components/DownloadPage.astro`
- `packages/web/src/assets/lander/opencorvus-concept-mobile.png`
- `packages/web/src/assets/lander/opencorvus-concept-flow-mobile-en.gif`
- `packages/web/src/assets/lander/opencorvus-concept-flow-mobile-zh.gif`
- `specs/records/2026-08/2026-08-11-public-website-iterative-design-program.md`

The exclusion on GIF/PNG bytes applies to the three Iteration 2 desktop assets. The three new mobile assets above are the only permitted asset additions; their dimensions, frame counts, durations, sizes, and SHA-256 hashes must be recorded after deterministic generation.

### Iteration 3 acceptance gate

- Run `git diff --check`, the local formatting check, `bun run --cwd packages/web check`, `bun run docs:check`, and `bun run --cwd packages/web build` from an exact latest-public-main candidate containing only approved paths.
- Use real rendered pages at `390 × 844`, `768 × 1024`, and `1280 × 720`. For English and Simplified Chinese, measure `/`, `/mission/`, `/market/`, `/publish/`, `/trust/`, `/download/`, and one representative `/market/builtin/base/` detail route. Every route must satisfy `document.documentElement.scrollWidth <= window.innerWidth`, have no clipped heading/action/card, and keep its primary reading order. Recheck both Architecture Explorer locales at `390 × 844` as unchanged responsive controls.
- Capture mobile visual evidence for every routed surface in both locales, plus tablet and desktop non-regression evidence for the homepage, Market, Mission, and Download. Homepage evidence must include the static concept map, activated GIF, stopped state, Workbench, Squad, Mission, and community sections without crop or distortion.
- Keyboard-review both locales: the first `Tab` exposes the skip link; subsequent focus is visible on brand, all navigation/language links, primary actions, GIF control, Market filters/search/results, detail tabs, copy controls, and dialog actions; no focused control is off-canvas or hidden. At `max-width: 1099px`, every button-like control—not only primary CTAs—must expose at least a `44 × 44px` hit target. Real-page measurement must cover the language switch, every header navigation link, GIF Play/Stop, Market filters, detail tabs, detail copy control, and dialog actions in both locales.
- Recheck localized metadata, reciprocal language links, `aria-current`, image alternative text, GIF `aria-pressed`, static-first resource loading, explicit stop restoration, and `prefers-reduced-motion`. Console error logs must be empty on every inspected root. An independent non-implementing agent must approve the frozen plan before edits and approve the final diff plus visual evidence before commit and push.

### Iteration 3 implementation and pre-convergence acceptance

- The fresh independent `iteration2_final_plan_gate` reviewer first rejected the draft because a scaled desktop GIF would remain unreadable, shared-versus-route responsive ownership was ambiguous, and the `44px` requirement did not cover every button-like control. The revised plan froze dedicated portrait mobile assets, exact ownership, and complete touch-target coverage; the same reviewer then returned `APPROVED` before implementation.
- The implementation is confined to the eleven approved paths above. Shared narrow-screen shell, utility, detail, action, dialog, wrapping, and focus primitives now live in `public-site.css`; Download's duplicate shell fork was removed while its route-specific grids remain local. Homepage, Mission, Market, Publish, and Trust keep their route-specific responsive rules in their existing components. The Starlight splash skip link is suppressed only on public hero pages so the public `#main-content` skip link is the unique first visible focus target.
- The mobile static asset is `720 × 1280`, `397,643` bytes, SHA-256 `24a7e8f9ca220d51b13505d375a0dedf1dee627005f6825b7762e3168ac89a3f`. The English mobile GIF is `720 × 1280`, seven frames, `514,766` bytes, SHA-256 `c6d98ba85c6b6b7f53c2c8cbc5cd4e8f83e7e42879305582e70b1cc652ec15ac`. The Chinese mobile GIF is `720 × 1280`, seven frames, `516,624` bytes, SHA-256 `c446ea4b575638bc0761dd0925a41363b29fae97b562e7ef5255926dc968c660`. Both GIFs preserve the exact `[1500, 1500, 1500, 1500, 1500, 1500, 3000]ms` frame durations. A narrow `<picture>` source supplies only the mobile static asset initially; Play and Stop swap the matching mobile source and image without changing the desktop assets.
- Pre-convergence validation passed on the source candidate: Prettier `3.6.2` checked the shared CSS and this record; `git diff --check` passed; `bun run --cwd packages/web check` reported `0 errors`, `0 warnings`, and one existing `dedupe-lead.cjs` hint; `bun run docs:check` reported `329 ops` in `25 groups`; and `bun run --cwd packages/web build` produced `313` pages. Existing Starlight override and tolerated-transform warnings remain non-blocking and unchanged.
- The exact built `dist` was served on `http://127.0.0.1:4346`. A real browser matrix covered both locales across `/`, `/mission/`, `/market/`, `/publish/`, `/trust/`, `/download/`, and `/market/builtin/base/` at `390 × 844`, `768 × 1024`, and `1280 × 720`: all `42/42` combinations passed with empty console logs and no horizontal overflow. Effective document widths were `375px`, `753px`, and `1265px` respectively. Final-candidate screenshots `50` through `91` under the Iteration 3 evidence directory capture every route, locale, and viewport combination; additional files capture both mobile static/playing GIF states and the detail dialog.
- Mobile real-page measurement found the unique visible skip link first in DOM focus order at `46px` high, every header navigation and language link at least `44px` high, both homepage actions at `50px`, and the GIF Play/Stop control at `44px`. Market search measured `46px` and all filters `44px`; detail action, boundary, copy, and every tab measured `44px`; both open-dialog actions measured `44px`. Opening the responsibility dialog moves focus to Close, and closing returns focus to the exact opener. The browser action channel did not deliver a synthetic initial `Tab` to the page body, so the unique first-focus structure and visible focus styling are recorded for independent delivery review rather than overstated as a synthetic keypress result.
- English and Chinese mobile Play requests loaded only the matching `opencorvus-concept-flow-mobile-*.gif`, set `aria-pressed=true`, and changed to the localized Stop label. Both initial states loaded the shared mobile PNG. Representative mobile, tablet, and desktop captures were visually inspected: mobile GIF type is readable without squeezing or crop; Mission, Market, and detail headings/actions stay inside the canvas; tablet grids collapse cleanly; and desktop composition remains unchanged.
- Public `main` advanced during implementation because of parallel Download work. Therefore this section intentionally records a pre-convergence candidate only: the eleven-path change must be replayed onto the final public parent, rebuilt, recaptured where required, and independently delivery-reviewed before any commit or push.

### Iteration 3 convergence addendum: Agent Hosts responsive coverage

The exact latest-public parent `d8e1da31662a4492364f23acf76493482ef0aa57` adds a bilingual `Use with Agents` / `Agent 接入` public route after the responsive plan was frozen. The eleven-path patch applies without a file conflict and preserves its new header link, GitHub link, page metadata, and content. However, exact-parent real-page acceptance at `390 × 844` found `scrollWidth=556` in English and `483` in Chinese while the other `46/48` route/locale/viewport combinations passed. Visual and DOM inspection traced the overflow to this new page's desktop-only four-, three-, and two-column component grids and preformatted commands; the page has only a `max-width:1320px` adjustment and no phone contract.

No responsive delivery may proceed with this newly exposed public-route defect. Before implementation, an independent reviewer must approve this minimal addendum:

1. Add `packages/web/src/components/AgentHostsPage.astro` as the twelfth and only new owned path. Do not change its facts, copy, DOM order, commands, links, metadata, or desktop design.
2. Keep shared shell behavior in `public-site.css`; add only Agent Hosts component-scoped responsive rules. At `max-width:1099px`, collapse the intro, source setup, boundary, docs, and generic-host layouts to intrinsic columns; reduce readiness, host, surface, and capability grids only as space requires; make every grid child `min-width:0`; remove sticky boundary positioning; and keep long commands inside their own `pre` horizontal scroller rather than overflowing the document.
3. At `max-width:720px`, use one column for readiness, host, surface, and capability groups; reduce component-local padding and display sizes; remove desktop-only minimum paragraph/card heights; and stack all actions. Preserve the visible section and numbered source order.
4. Rebuild on exact parent `d8e1da3`, then repeat the complete `48`-combination matrix covering eight public routes in both locales at `390 × 844`, `768 × 1024`, and `1280 × 720`. Require `scrollWidth <= innerWidth`, empty console logs, correct current-page state, no clipped heading/code/action, internal command scrolling only, and phone button-like controls of at least `44 × 44px`. Capture both Agent Hosts locales at all three sizes and complete-page phone section evidence before final independent delivery review.

This addendum changes the frozen owned-path count from eleven to twelve. It does not reopen the approved homepage/GIF, Mission, Market, Publish, Trust, Download, shared-shell, runtime, documentation, or product-copy boundaries.

#### Addendum plan-review correction

The independent reviewer rejected the first addendum because `overflow-x:auto` alone leaves a long command region unreachable for keyboard horizontal scrolling when its `<pre>` is not focusable. The revised addendum therefore adds this mandatory accessibility contract without widening the owned paths:

- Add `tabindex="0"` to each Agent Hosts command `<pre>` that can produce horizontal overflow at a supported narrow viewport. Give every such region a concise locale-specific accessible name that identifies its adjacent purpose: source preparation commands, OpenClaw install commands, Hermes install commands, Hermes PowerShell install commands, one-off Session command, and durable server command. These labels are accessibility metadata only; visible commands and copy remain unchanged.
- Add a component-scoped visible `pre:focus-visible` treatment consistent with the site's cobalt/white focus system. The code region must keep its own bounded horizontal scrollbar, and focus must never cause the document canvas to widen or jump off-screen.
- In both locales at `390 × 844`, keyboard acceptance must enter every focusable overflowing command region in source order, use horizontal navigation to expose the command's end, and then leave it for the next focus target. Record initial and final `scrollLeft`, `scrollWidth`, `clientWidth`, active accessible name, visible focus geometry, and the invariant `documentElement.scrollWidth <= innerWidth`. Mouse/touch scrolling and text selection must remain available.

All other ownership, responsive, factual, visual, bilingual, and three-viewport requirements above remain unchanged. This corrected addendum requires a fresh explicit independent verdict before implementation.

### Iteration 3 exact-final acceptance

- The corrected Agent Hosts addendum received independent `APPROVED` before implementation. The exact candidate is `D:\myhexin-local\opencorvus-iteration3-d8e-candidate` on public parent `d8e1da31662a4492364f23acf76493482ef0aa57`; the twelve changed/added paths are exactly the eleven original owned paths plus `packages/web/src/components/AgentHostsPage.astro`. The parent-added Agent Hosts route, GitHub navigation link, metadata, facts, visible copy, commands, and desktop composition remain intact.
- Exact-final validation passed after the last `44px` control correction: `git diff --check`; Prettier `3.6.2` on shared CSS and this record; `bun run --cwd packages/web check` across `61` files with `0 errors`, `0 warnings`, and the existing `dedupe-lead.cjs` hint; `bun run docs:check` with `329 ops` in `25 groups`; and `bun run --cwd packages/web build` with `315` static pages. The two-page increase from the pre-convergence candidate is the parent's bilingual Agent Hosts route. Existing Starlight override and tolerated-transform warnings remain unchanged.
- The exact final `dist` is served at `http://127.0.0.1:4347`. Final browser evidence under `C:\Users\hengu\Documents\Codex\2026-08-11\opencorvus-agent-push-github-action-opencorvus\work\iteration3-final-evidence-d8e` contains a freshly overwritten `01`–`48` matrix for eight public routes, both locales, and `390 × 844`, `768 × 1024`, and `1280 × 720`. All `48/48` combinations pass with empty console logs, correct current-page state, and no document overflow; effective document widths are `375px`, `753px`, and `1265px` respectively. Files `49`–`60` capture command focus/internal scrolling and every Agent Hosts phone section in both locales; files `61`–`66` capture both localized mobile GIF static, playing, and stopped states.
- Agent Hosts mobile widths fell from the discovered English `556px` and Chinese `483px` to `375px`. Its desktop grids collapse in source order, command regions retain their own scrollbar, and tablet/desktop captures preserve the intended hierarchy. All six potentially overflowing `<pre>` regions in each locale expose `tabindex=0`, a purpose-specific localized accessible name, visible cobalt focus, `overflow-x:auto`, and a `306px` client width while their command contents measure `421px` to `802px`. Browser focus placed the active element on the named `<pre>`; horizontal input moved the source command from `scrollLeft=0` to `115.2` without changing document width. The browser's synthetic key dispatcher did not move native scroll position with ArrowRight/End, so this input was issued through the same focused region's horizontal browser control; native keyboard reachability is supplied by the explicit tabindex and independently delivery-reviewed structure rather than overstated as a synthetic-key result.
- Agent Hosts phone touch measurement found no undersized button-like target after the final correction. Header/language/action links and its PowerShell `<summary>` are at least `44px`; the summary measured exactly `44px`. Both locales' complete host, operating-surface, boundary, and continuation sections were inspected as separate viewport captures without clipping or reordered content.
- A clean request log at `C:\Users\hengu\Documents\Codex\2026-08-11\opencorvus-agent-push-github-action-opencorvus\work\iteration3-exact-http-4348.stderr.log` proves initial English and Chinese homepage loads requested only the mobile static PNG and no GIF. Explicit Chinese Play then requested only the Chinese mobile GIF; explicit English Play requested only the English mobile GIF. In-browser acceptance also verified locale-isolated markup, localized labels, `aria-pressed=true` while playing, Stop restoration to the static mobile PNG and `aria-pressed=false`, `scrollWidth=375`, and empty console logs.
- Independent final delivery review, exact path-limited commit/push, GitHub Actions success, and production `opencorvus.com` mobile/desktop verification remain mandatory before this iteration is delivered.

## Iteration 4: complete Chinese market copy and bilingual accessibility metadata

### Recall

#### User request and delivery state

- Continue auditing and improving the OpenCorvus public website across visuals, information architecture, English and Simplified Chinese copy, usability, and accessibility until a complete audit finds no actionable issue.
- Every iteration requires independent plan approval before implementation, real-page visual acceptance after implementation, an independent delivery review, a normal push, a successful GitHub Actions deployment, and production verification on `opencorvus.com`.
- The user explicitly corrected the process after Iteration 3: do not stop at local changes; update the website after every completed iteration.
- Iteration 3 is delivered as commit `999eb4cc34607c7f5ddf8c8457b69099cb921893`. GitHub Actions run `31481085222` completed successfully and production mobile/desktop verification confirmed the responsive site and locale-specific concept GIF are live. The separate security workflow failure is an unrelated pre-existing deliberate token-shaped test fixture in `packages/overlay/test/session-debug.test.ts`; it is outside this website iteration and is not treated as deployment failure.

#### Fresh baseline and materials read

- Candidate worktree: `D:\myhexin-local\opencorvus-iteration3-d8e-candidate`.
- Branch/upstream: `main` / `origin/main`; local `HEAD` and fetched `origin/main` both resolve to `999eb4cc34607c7f5ddf8c8457b69099cb921893`; worktree status was clean before this plan.
- Read `AGENTS.md`, this program record, `PublicSiteLayout.astro`, `PublicSiteHeader.astro`, `Lander.astro`, `MarketplacePage.astro`, `SquadDetailPage.astro`, `WorkflowTopology.astro`, `public-market.ts`, generated public-market facts, both Architecture Explorer route pages, relevant shared styles, and the public route definitions.
- Searched all definitions and render sites for localized market descriptions, selector summaries, Agent descriptions, workflow/node descriptions, landmarks, canonical/alternate metadata, dialog focus, and brand accessible names.
- Real production inspection covered English and Simplified Chinese home, Mission, Agent Hosts, Market, Base detail, Publish, Trust, Download, and Architecture Explorer at desktop and phone sizes. A semantic sweep also checked document language, landmark counts, heading counts, duplicate IDs, image alternatives, current-page state, and horizontal overflow.

#### Observed phenomena and root causes

1. The Simplified Chinese Expert Squad market has complete Chinese shell copy but only five of 99 catalog records override `description` and `selectorSummary`; the other 94 reuse canonical English as `zh-cn`. Chinese search therefore cannot find ordinary records from a Chinese use-case phrase. Base detail also publishes an English meta/OG description and English hero summary under `html lang=zh-CN`; nested Agent/workflow/node prose is English without an English language boundary. Root cause: `public-market.ts` aliases canonical English into the Chinese projection when an optional five-entry override is absent, and every Market/detail renderer consumes that projection as if it were localized.
2. On phone-size Base detail, opening the responsibility walkthrough places focus on the bottom Close button outside the viewport. The script tries to focus the dialog title, but the `h2` is not programmatically focusable, so native dialog autofocus chooses the later button.
3. The Starlight splash page owns an outer `main`, while `Lander.astro` emits a second nested `main`. The skip-link target is correct, but landmark navigation exposes an invalid nested main structure.
4. Homepage Starlight metadata already publishes reciprocal `en`, `zh-CN`, and `x-default` alternates. Mission, Agent Hosts, Market, all 99 Squad details, Publish, Trust, and Download use `PublicSiteLayout` and publish no `hreflang`. Architecture Explorer is also a standalone bilingual route but bypasses that layout and likewise has no alternates.
5. `PublicSiteHeader.astro` fixes the brand accessible name to `OpenCorvus home`, so that English name overrides the visible brand text even on Simplified Chinese pages.

#### Independent agent feedback

- The independent read-only audit reported the five findings above as one P1, three P2 items, and one P3 item. It found no new overflow, touch-target, Agent Hosts command-scroll, canonical, language-switch, or responsive regression elsewhere.
- The first frozen Iteration 4 plan was `REJECTED` because its shared-layout `hreflang` change omitted the separately rendered English and Simplified Chinese Architecture Explorer pages.
- The corrected plan explicitly adds both Architecture Explorer route files, their absolute reciprocal alternates, and their real-page acceptance to the owned boundary. The independent plan gate then returned `APPROVED` before implementation.

### Frozen implementation boundary

1. Add one complete Simplified Chinese display-copy authority keyed by exact Squad identity and nested Agent/workflow/node IDs. It must cover 99/99 records and every visible human-language `label`, `description`, and `selectorSummary`, while preserving canonical English facts, identities, revisions, digests, base roles, dependency IDs, and other technical tokens. Split the large static authority into three mechanically merged source shards; they remain one logical source and may not fall back to English.
2. Validate that translation identities exactly equal generated identities and that each record's Agent, workflow, and node keys exactly equal the generated nested keys. Missing, extra, or empty localized values are build-time errors. `public-market-facts.generated.ts` remains unchanged. English pages continue to use canonical facts; Simplified Chinese cards, search index, detail metadata, hero, roster, workflow, and node content use the complete Chinese display projection. Retained English technical tokens receive an explicit `lang="en"` boundary where natural-language pronunciation otherwise changes.
3. Make the responsibility walkthrough title programmatically focusable with `tabindex="-1"`, focus it after `showModal()` without scrolling, keep the dialog at its top, and preserve close/Escape/backdrop behavior plus focus return to the exact opener. Native modal behavior remains the only focus-containment implementation.
4. Replace only Lander's nested inner `main` with a neutral container that retains `id="main-content"` and the existing class. Starlight's outer main remains the homepage's single main landmark and the skip link keeps the same target.
5. In `PublicSiteLayout.astro`, derive absolute reciprocal English, Simplified Chinese, and English `x-default` alternate URLs from the canonical current page and the existing exact language-switch path. Publish all three in every standalone layout page without changing canonical URLs. Add the same absolute three-link contract directly to both Architecture Explorer page heads because those routes do not use the shared layout.
6. Localize the public brand accessible name to `OpenCorvus home` / `OpenCorvus 首页` in `PublicSiteHeader.astro` without changing visible brand text or navigation.
7. Do not change generated market facts, Expert Squad runtime/package content, download verification, route paths, product positioning, public visual tokens, page order, the concept assets, Starlight documentation, or Architecture Explorer layout. Do not add, modify, or run UI automation tests.

### Owned paths

- `packages/web/src/content/public-market-zh-types.ts`
- `packages/web/src/content/public-market-zh-01-35.ts`
- `packages/web/src/content/public-market-zh-36-67.ts`
- `packages/web/src/content/public-market-zh-68-99.ts`
- `packages/web/src/content/public-market.ts`
- `packages/web/src/components/MarketplacePage.astro`
- `packages/web/src/components/SquadDetailPage.astro`
- `packages/web/src/components/WorkflowTopology.astro`
- `packages/web/src/components/Lander.astro`
- `packages/web/src/components/PublicSiteLayout.astro`
- `packages/web/src/components/PublicSiteHeader.astro`
- `packages/web/src/pages/architecture-explorer.astro`
- `packages/web/src/pages/zh-cn/architecture-explorer.astro`
- `specs/records/2026-08/2026-08-11-public-website-iterative-design-program.md`

### Acceptance

- Translation validation reports exactly 99 translated identities and exact nested key equality for every Agent, workflow, and node. Built static Chinese Market/detail HTML contains no canonical English natural-language fallback in localized fields, and Chinese queries match the localized search corpus.
- `git diff --check`, focused Prettier, `bun run --cwd packages/web check`, `bun run docs:check`, and `bun run --cwd packages/web build` pass. No UI automation test is added, modified, or run.
- Static-output inspection covers one main landmark per homepage, the localized brand accessible name, reciprocal absolute canonical/alternate pairs for all seven standalone base-route pairs and 99 detail-route pairs, and complete localized Market/detail metadata.
- Real browser review covers English and Simplified Chinese across home, Mission, Agent Hosts, Market, Base detail, Publish, Trust, Download, and Architecture Explorer at `390 x 844`, `768 x 1024`, and `1280 x 720`; require no document overflow, empty console errors, intact current-page/language-switch state, and no visual regression.
- Real Simplified Chinese Market acceptance includes Chinese searches for representative domain terms and visual review of multiple catalog records. Detail acceptance covers hero, expanded topology, every tab, both dialogs, and localized meta/OG text.
- Walkthrough focus acceptance in both locales and phone/desktop sizes requires `scrollTop=0`, the title as `document.activeElement`, its focus geometry inside the visible dialog, native Tab containment, Escape close, and focus returned to the opener.
- A non-implementing agent independently reviews the complete diff, translation/key evidence, checks, screenshots, and interactive acceptance. All valid findings are fixed and re-reviewed before a scoped commit. Before push, fetched `origin/main` must still be the candidate parent and `upstream..HEAD` must contain only the reviewed Iteration 4 commit. After normal push, wait for the exact-commit deployment Action to succeed and repeat key production checks on `https://opencorvus.com`.

### Iteration 4 implementation and pre-delivery acceptance

- The approved implementation adds one runtime-validated Simplified Chinese display projection in three static shards. Importing `public-market.ts` verifies exact identity, Agent, workflow, and node key equality plus non-empty Chinese natural-language descriptions. The final projection covers `99` records, `491` Agents, `113` workflows, `547` nodes, and `1,349` localized prose fields; every prose field contains Chinese and none falls back to the canonical English natural-language value.
- Translation implementation was split across three non-overlapping agent-owned shards. A second terminology pass on records 1–35 corrected mechanical mistranslations of dated evidence, ownership/join semantics, Base roles, equity thesis language, experiment arms and scorers, operating envelopes, release authority, human disposition, censoring, legal hold, maladaptation, and visual acceptance. Product and contract tokens remain exact while surrounding language is Chinese. `public-market-facts.generated.ts` remains byte-for-byte outside the change.
- Market cards and search now use localized labels, descriptions, and selector summaries. Detail title/meta/OG/hero, roster, workflow headings/descriptions, and node descriptions use the same projection. Canonical identity, revision, digest, base role, `depends_on`, and related technical values remain stable and receive English language boundaries where applicable.
- The walkthrough title is now programmatically focusable; opening the modal places focus on the title at `scrollTop=0`. The homepage inner landmark is now a neutral `#main-content` container under Starlight's one outer `main`. Shared standalone pages and both Architecture Explorer pages publish absolute reciprocal `en`, `zh-CN`, and English `x-default` alternates. The Simplified Chinese brand accessible name is `OpenCorvus 首页`.
- Validation passed: focused Prettier `3.6.2`; `git diff --check`; `bun run --cwd packages/web check` across `65` files with `0 errors`, `0 warnings`, and the existing `dedupe-lead.cjs` hint; `bun run docs:check` with `329 ops` in `25 groups`; and `bun run --cwd packages/web build` with `315` static pages. Existing Starlight override and tolerated-transform warnings remain unchanged.
- Static-output inspection found `0` errors across all seven standalone bilingual route pairs and all 99 Squad-detail pairs: every page publishes all three exact alternate links. Both home locales contain exactly one `main`; the Simplified Chinese brand label is localized; Base's Simplified Chinese meta description contains Chinese.
- Real browser evidence under `work/iteration4-final-evidence` covers English and Simplified Chinese across home, Mission, Agent Hosts, Market, Base detail, Publish, Trust, Download, and Architecture Explorer at `390 x 844`, `768 x 1024`, and `1280 x 720`. All `54/54` combinations have one `h1`, one `main`, three alternates, zero document overflow, and zero console logs. Files `01`–`54` are the viewport matrix.
- Real mobile typing verified that `学术论文`, `财务运营`, and `专利格局` each filter the Chinese Market to the correct single localized record; files `55`–`57` capture those states. Base's localized Agent/workflow tab exposes the six Chinese role names and all three Chinese workflow names; file `60` captures the real tab state.
- Opening the responsibility walkthrough at `390 x 844` leaves the dialog at `scrollTop=0` and focuses `#demo-dialog-title` between `y=75` and `108` inside the visible dialog; file `58` captures the cobalt focus ring. The desktop English equivalent focuses the same title between `y=105` and `144`; file `59` captures it. Native modal containment rejected an attempted outside focus, and clicking Close returned focus to the exact opener. The in-app browser's synthetic `Tab` and `Escape` dispatch did not deliver a key transition, so those two physical-key assertions are not overstated; the native `<dialog>` plus existing cancel/close handlers remain available for independent source and real-page review.
- Independent delivery review, exact-parent convergence, a scoped commit, normal push, exact-commit deployment success, and production verification remain pending.

### Iteration 4 first delivery-review corrections

- The first independent delivery review returned `REJECTED`. It confirmed the translation-key validator, unchanged canonical facts, one-main landmark, localized brand label, reciprocal alternates, Chinese search, localized detail projection, and native dialog focus/containment/close-return behavior. It rejected delivery because the candidate parent had fallen behind public `main`, the first evidence set predated the final source bytes, several translated domain terms were mechanical or inconsistent, and retained Latin technical terms lacked explicit rendered language boundaries.
- The three translation shards were corrected independently within the frozen path boundary. Stable built-in Squad names `Advanced` and `Base` remain unchanged. `Equity Research` is consistently rendered as “股票研究,” `Commercial Legal` as “商事法务,” and Evolution Lab consistently uses “演进.” Media Rights Clearance now uses “媒体版权与授权核查,” “权属链,” “授权书条款,” and “权利主张方.” Satellite domain copy now uses “卫星任务” rather than the OpenCorvus product concept `Mission`; Viral Content uses the natural “传播型内容 / 病毒式传播概念 / 传播活动” terminology. The original factual, legal, runtime, promotion, publication, and authority boundaries remain unchanged.
- Simplified Chinese market renderers now segment retained Latin technical runs and emit explicit `lang="en"` spans in cards, detail prose, Agent descriptions, workflow prose, and node descriptions. Canonical technical values already carried their existing English language boundaries. This is presentation metadata only and does not alter generated facts or localized search strings.
- The original `01`–`60` evidence set was superseded because it predated these corrections. Corrected-source validation passes `git diff --check`, repository-local Prettier `3.6.2` on the TypeScript shards, projection, and this record without network access, `bun run --cwd packages/web check` with `0 errors`, `0 warnings`, and the existing single hint, `bun run docs:check` with `329 ops` in `25 groups`, and `bun run --cwd packages/web build` with `315` pages.
- Fetched `origin/main` advanced from Iteration 3 commit `999eb4cc34607c7f5ddf8c8457b69099cb921893` to `9652cff4da8e45e547b4a85a5e4c93570cf1a10e`. Its changed paths do not overlap the fourteen Iteration 4 owned paths, but no old-parent candidate is deliverable. The scoped Iteration 4 commit must be safely replayed onto the latest fetched public parent, rebuilt, recaptured, and independently re-reviewed before push. Any further remote advance repeats the same fetch, overlap check, safe replay, and exact-candidate proof cycle.

### Iteration 4 second delivery-review corrections

- The second independent content/evidence review also returned `REJECTED`; it did not count the stale parent as a finding. It found a final group of mechanical terms in Climate Risk Adaptation, Deep Research, and Digital Forensics, plus ambiguous and unreadable visual evidence. The implementation, generated-fact boundary, validation counts, first-review terminology corrections, language boundaries, static alternate links, responsive layouts, and dialog focus behavior were independently reconfirmed.
- Climate Risk Adaptation now consistently uses “暴露、脆弱性与后果.” Deep Research now uses “深度来源发掘,” “高质量报告,” “引文审查员,” “落实独立审查意见,” “界定问题,” “带引文的草稿,” and “发布独立的引文与综合审查结果.” Digital Forensics consistently retains the contract token `Artifact`, uses “事件时间线,” and describes four evidence starting points converging on a qualified reviewer without the literal “evidence roots” phrasing. These edits remain in shard A and preserve the canonical action, evidence, authority, publication, and review semantics.
- Corrected browser evidence is isolated in `work/iteration4-corrected-evidence`; it contains exactly 63 uniquely numbered PNG files and no duplicate number. Files `01`–`54` are the full bilingual nine-route, three-viewport matrix, all passing one `h1`, one `main`, three alternates, no document overflow, and empty console logs. Files `55`–`57` visibly place the entered Chinese query, “1 个团队” result count, and the single matching localized card in the same mobile frame. Files `58`–`59` show bilingual dialog-title focus. File `60` shows all six localized Base Agent rows in one desktop frame; files `61`–`63` visibly cover all three localized Base workflow contracts and their node chains.
- After the final wording edits, repository-local Prettier, `bun run --cwd packages/web check`, `bun run --cwd packages/web build`, and `git diff --check` pass again. This still constitutes old-parent precursor evidence only; independent precursor approval and exact-parent replay/rebuild/recapture/review remain mandatory.

### Iteration 4 exact-parent convergence addendum: ten new market records

#### Recall and new root cause

- Independent precursor review returned `APPROVED`, after which the single fourteen-path commit was safely rebased without conflict onto fetched public parent `7a2ec14d798e29be6db00a950a99bf1fb9fa249a`. The parent's changed paths do not overlap the fourteen owned paths.
- Exact-parent `check` still passed, but exact-parent build correctly failed the complete-localization key gate. Upstream commit `37d630f` added ten new generated Expert Squad records after the 99-record translation authority was frozen: Bridge Structural Integrity Assurance, Clinical Genomics Variant Evidence Review, Corporate Governance Entity Secretariat, Corporate Treasury Liquidity Operations, Dam Safety Surveillance Assurance, Digital Accessibility Assurance, Marine Vessel Survey Maintenance Assurance, Medical Device Human Factors Usability Assurance, Student Financial Aid Administration, and Transfusion Medicine Blood Component Assurance.
- The generated catalog now contains 109 records, 541 Agents, 123 workflows, and 597 nodes. The existing translation authority still contains the original 99 records, so bypassing or weakening the validator would reintroduce the exact English fallback defect this iteration fixes. The root cause is legitimate public-parent feature growth, not a validator or rebase defect.

#### Frozen convergence implementation

1. Keep the same fourteen owned paths. Add the ten exact identity entries to the existing three static translation shards according to their alphabetical catalog region; do not add a fourth shard or modify generated facts.
2. Cover every new record label, description, selector summary, Agent label/description, workflow label/description, and node description. Preserve the exact generated identity and nested IDs, order, domain facts, evidence boundaries, human/qualified-review authority, and non-operational limitations. Retained standards and technical tokens keep explicit English language boundaries through the existing renderer.
3. The exact-key and non-empty-CJK validator must now pass 109 records, 541 Agents, 123 workflows, 597 nodes, and 1,479 localized description/summary prose fields. English continues to use canonical generated facts; no route, runtime package, capability, revision, digest, or generated field changes.
4. Re-run repository-local Prettier, `bun run --cwd packages/web check`, `bun run docs:check`, `bun run --cwd packages/web build`, and `git diff --check` on the exact parent. Re-run the complete bilingual nine-route, three-viewport matrix in a fresh uniquely named evidence directory.
5. For each of the ten new Simplified Chinese records, verify the localized Market search phrase and unique result, localized detail metadata/hero/Agent/workflow/node content, three reciprocal alternates, one `h1`, one `main`, no document overflow, and empty console logs. Capture readable visual evidence covering all ten new records rather than relying only on key counts.
6. This addendum requires fresh independent plan approval before translating the ten records. After implementation and exact-parent visual acceptance, the same independent non-implementing delivery reviewer must issue an exact-final verdict before the commit is amended or pushed.

#### Exact-parent convergence implementation and acceptance

- The convergence addendum received independent `APPROVED` before implementation. The ten parent-added records were added to the existing alphabetical translation shards without changing generated facts, routes, runtime packages, or the fourteen-path ownership boundary. The complete localized projection now covers exactly `109` records, `541` Agents, `123` workflows, `597` nodes, and `1,479` description/selector-summary prose fields; exact record and nested key comparison reports no missing, extra, empty, or non-Chinese localized value.
- All ten records retain their generated evidence and authority boundaries while using domain-specific Simplified Chinese: bridge structural integrity, clinical genomics, corporate governance, corporate treasury, dam safety, digital accessibility, marine vessel survey and maintenance, medical-device human factors, student financial aid, and transfusion medicine. Stable identity, role, revision, digest, workflow/node IDs, and technical tokens remain unchanged. `public-market-facts.generated.ts` remains outside the diff.
- Exact-parent validation passes repository-local Prettier `3.6.2`, `git diff --check`, `bun run --cwd packages/web check` across `66` files with `0 errors`, `0 warnings`, and the existing single hint, `bun run docs:check` with `329 ops` in `25 groups`, and `bun run --cwd packages/web build` with `335` static pages. Existing Starlight override and tolerated-transform warnings remain unchanged.
- Fresh exact-parent browser evidence is isolated under `work/iteration4-exact-final-7a2ec14` and contains exactly `93` uniquely numbered PNG files. Files `01`–`54` repeat the complete English/Simplified Chinese nine-route matrix at `390 × 844`, `768 × 1024`, and `1280 × 720`; all `54/54` combinations have one `h1`, one `main`, three reciprocal alternates, no document overflow, and empty console logs. Files `55`–`63` preserve readable Chinese search, dialog-focus, Base Agent, and all-three-workflow evidence.
- Files `64`–`73` show a Chinese query, `1 个团队`, and the unique localized result for every new record. Files `74`–`83` show each new Chinese mobile detail hero; every page has Chinese metadata, five localized Agents, one localized workflow, five localized nodes, one `h1`, one `main`, three alternates, no overflow, and an empty console. Files `84`–`93` show each record's five localized Agent rows and localized workflow heading together in a desktop viewport. Representative bridge and transfusion-medicine captures were visually inspected for readable hierarchy, intact actions, complete role descriptions, and visible workflow handoff copy.
- The final review candidate is one scoped Iteration 4 commit on exact public parent `112e26d52d05aa66c45c7d9c2fd84c92d51b2ab6`; that parent changes only the separate v0.0.40-beta release record and does not overlap the fourteen owned paths. Independent exact-final delivery approval, a final public-parent fetch, normal push, exact-commit GitHub Actions success, and production verification remain mandatory.
