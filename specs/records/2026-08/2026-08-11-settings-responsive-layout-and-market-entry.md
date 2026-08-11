# Settings responsive layout and Squad Market entry

## Recall

| Item | Record |
| --- | --- |
| User request | Rework the settings layout against the supplied screenshot: every settings page must adapt its content width to the available resolution; the Installed Agent Squads master-detail layout must stop collapsing into narrow, disconnected columns; Squad Market must show only concise information and open the website. |
| Acceptance criteria | Every settings tab uses the available content-region width rather than an 880-pixel fixed column; ordinary settings remain readable at the existing 1280×720 desktop viewport; Installed Agent Squads presents one aligned master-detail grid at wide desktop widths and stacks coherently when the content region is narrow; Squad Market shows a concise website entry and preserves the exact hosted-install handoff confirmation; the website action targets the canonical public `/market/` page; fresh real-page screenshots are inspected at multiple desktop resolutions. |
| Hard constraints | Preserve unrelated worktree changes. Do not add, update, or run User Interface automation tests. Use the real Vite page, browser interaction, screenshots, and manual visual review. Keep package installation, digest verification, project/global scope, and active-Squad authority on their existing services; the website entry must not become a second installed-state owner. Update the current architecture and documentation indexes, run focused type/build/doc checks, then obtain an independent read-only review. |
| Sources read | Root `AGENTS.md`; browser-control skill and local-web verification guidance; supplied 2048×1238 reference screenshot; `specs/current/architecture/04-extensions.md`; `2026-08-11-expert-squad-on-demand-installation.md`; settings dialog host, shared settings layout primitives and stylesheet; Expert Squad panel, install-handoff service, public-site configuration and market routes; Overlay package scripts and root documentation checker. |
| Whole-repository search | Searches covered all settings shell/content/sidebar width owners, `--settings-content-width`, `.config-tab-panel`, Expert Squad master-detail selectors, every `expert-squad-install` route/render owner, Market loaders/detail/install operations, hosted handoff ownership, public `/market/` routes, external-link patterns, related locale keys, and recent history of the touched settings files. The fixed 880-pixel content variable is shared by the page heading and every settings tab. The embedded Market browser and Installed Agent Squads are currently two render branches of the same component. The canonical public site is `https://opencorvus.com`, with localized Market routes rooted at `/market/`. |
| Independent agent feedback | None before implementation. The required independent agent will review the completed diff and real-page evidence after the first successful validation pass. |

## Problem depth and impact

### Observable symptom

At the supplied wide desktop resolution, the settings navigation consumes a stable left rail while the right content remains capped at 880 scaled pixels. Installed Agent Squads then divides that already-capped column into `0.8fr / 1.45fr`, leaving a narrow list, a narrow detail card, and large unused space around them. The selected detail appears spatially detached from its list.

### Direct trigger

`#configDialog .dialog-form` declares `--settings-content-width: 880px`, and both `.config-page-title` and `.config-tab-panel` apply it as `max-width`. The Expert Squad grid can only distribute that fixed width. Large resolutions therefore increase outer whitespace instead of useful content width.

### Data and control-flow root cause

The settings shell owns a single responsive scroll region, but its children use a fixed article-width contract intended for prose-like forms. The same contract was later reused by data-heavy master-detail surfaces. This conflates readable line length with application workspace width. Per-page overrides would preserve competing layout sources, so the repair belongs to the shared settings content contract, with component-local breakpoints only for genuinely different composition states.

The current Squad Market branch also owns an in-app search/filter/list/detail/install browser while the public website now owns the canonical discoverable catalog. Keeping both produces two presentation surfaces for the same Market inventory. The desktop still must own exact handoff verification and installation because those operations require the local application and explicit installation scope.

### Why the old path did not solve it

The previous layout repair adjusted the Expert Squad grid fractions and row density inside the fixed 880-pixel column. It improved local proportions but could not reclaim resolution-dependent space. Likewise, the prior on-demand installation change correctly routed pickers into the desktop Market, but predates the public website becoming the desired Market browsing surface.

### Affected surfaces

- Shared settings shell: content width, padding, title alignment, all tab panels, and narrow-resolution behavior.
- Installed Agent Squads: filters, master list, selected detail, tabs, long labels, empty/error states, and scrolling.
- Squad Market: concise public entry, external navigation, exact hosted-install handoff, success/error feedback, and bilingual copy.
- Documentation: current extension architecture plus root/month indexes.

Backend Market routes, Manager/Registry/Resolver contracts, public-site catalog generation, package bytes, non-settings workbench layout, mobile/tablet delivery, and unrelated existing worktree changes are explicitly out of scope.

## Implementation plan

1. Replace the fixed settings content maximum with a fluid full-width contract inside bounded responsive padding. Keep one shared owner so every settings page adapts consistently.
2. Give the Expert Squad master-detail grid explicit wide/narrow compositions based on the real content width: a bounded master column plus flexible detail at wide widths, then one stacked flow when the content area cannot sustain both.
3. Split Squad Market presentation from Installed Agent Squads. The Market panel will show concise bilingual copy and one canonical `https://opencorvus.com/market/` action. It will render the existing exact-handoff confirmation only when the website returns a verified handoff.
4. Remove the embedded Market browser from the current UI path without changing backend routes or installed-package management on the Installed page.
5. Inspect the real page at the existing 1280×720 viewport and at a wide desktop viewport comparable to the reference. Iterate from fresh screenshots, then run Overlay typecheck/build, documentation check, diff checks, and independent read-only review.

## Evidence ledger

- Before change, the real 1280×720 Vite page reports `.config-content` width 932px and `.config-tab-panel` width 828.94px; the current page is already constrained by padding at this width.
- The supplied 2048×1238 screenshot shows the failure mode at wide resolution: the fixed-width master-detail grid remains centered while most of the content region is unused.
- After change, the real 2048×1238 Installed Agent Squads page reports a 1451.33px tab panel and a `425.84px / 1005.49px` master-detail grid. The corresponding screenshot is [`installed-wide-2048x1238.png`](../../artifacts/2026-08-11-settings-responsive-layout/installed-wide-2048x1238.png).
- At 1280×900, the same real page reports one 828.94px grid column; the list and detail share the same x-coordinate and width, demonstrating the content-container breakpoint rather than squeezed side-by-side columns. See [`installed-medium-1280x900.png`](../../artifacts/2026-08-11-settings-responsive-layout/installed-medium-1280x900.png).
- The real General page at 2048×1238 reports both title and tab-panel widths of 1451.33px, confirming that the shared settings contract—not an Expert Squad-only override—owns the adaptive width. See [`general-wide-2048x1238.png`](../../artifacts/2026-08-11-settings-responsive-layout/general-wide-2048x1238.png).
- The real Market page contains one concise entry surface. Its action resolves to `https://opencorvus.com/market/` with `target="_blank"`; activating it opened that exact public page in a new browser tab. See [`market-medium-1280x900.png`](../../artifacts/2026-08-11-settings-responsive-layout/market-medium-1280x900.png).
- Manual screenshot review found no clipped text, detached detail panel, or horizontal overflow in the inspected 2048×1238, 1280×900, and 879×1216 desktop views. The Market action moves below the copy in the narrow content state.
- `bun run typecheck` in `packages/overlay`: passed (`tsc --noEmit`).
- `bun run build:vite` in `packages/overlay`: passed; Vite completed 7101 transformed modules with only the repository's existing third-party `use client` and chunk-size warnings.
- `bun run docs:check` at the repository root: passed (`329 ops, 25 groups`).
- Scoped Prettier check and `git diff --check`: passed.
- No User Interface automation tests were added, modified, or run.
- First independent read-only review found one P1 issue: the new Market route was correct, but `ExpertSquadPanel` still retained an unreachable `page="install"` branch with a second embedded Market, local import controls, and duplicate hosted-handoff implementation. The repair made `ExpertSquadPanel` Installed-only, deleted the full old Market User Interface and its install/update/uninstall/import actions, removed dedicated state, effects, imports, styles, and locale copy, and updated the catalog-recovery copy to direct users to the web Market. Installed-package update detection continues to use the existing read-only Market inventory projection.
- After that repair, Overlay typecheck and production build passed again. The final real 2048×1238 page reports the same `425.84px / 1005.49px` grid and confirms that `.expert-squad-market-browser` is absent from the live Document Object Model (DOM).
- Second independent read-only review confirmed the P1 double implementation was closed, then found one P2 regression in the cleanup: Installed update detection kept only the first 20 Market index entries and ignored the operation/current target ID. The repair restored detail-only exact reads for the requested operation target, current selection, and effective active Squad, merges those results with the first index page, and does not restore any Market browsing User Interface.
- Follow-up review traced the P2 through two asynchronous edge cases. First, directory and Market loads could race before the current/effective ID existed; an index-ready reactive exact-detail read now covers initial load and later selection changes. Second, an older detail read could arrive after a newer Market refresh; every Market refresh now invalidates prior detail sequences before writing its own exact target/current/effective projection.
- Final verification passed after those repairs: repository typecheck succeeded for all 8 participating packages, Overlay production build succeeded, `docs:check` succeeded with the concurrent repository state (`330 ops, 25 groups`), scoped Prettier and `git diff --check` succeeded, and the final independent read-only review reported **no unresolved findings**.
