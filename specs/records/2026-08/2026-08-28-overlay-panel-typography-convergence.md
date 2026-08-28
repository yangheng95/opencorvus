# Overlay panel typography convergence

## Recall

| Item                       | Evidence and requirement                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| User request               | Fix the Overlay panel components whose typography now looks inconsistent. The final system must have no oversized or outlier font sizes and must use large or small text only sparingly.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Acceptance criteria        | Application chrome and panel components use one bundled proportional family and one bounded size vocabulary: `16px` emphasis, `14px` body/control/navigation, and `12px` caption/technical metadata at `--ui-scale: 1`; code blocks and trace bodies may use the one `13px` reading exception. Emphasis is rare and limited to page/surface/dialog/empty-state headings plus singular primary totals or product marks. Ordinary sections, rows, cards, summaries, descriptions, filters, and controls use body. Captions are limited to compact auxiliary metadata. Interactive Artifact content, editors, terminals, charts, and presentations retain their content-owned typography, while their Overlay host chrome follows this contract. |
| Hard constraints           | Repair the shared token and checker authority instead of adding per-panel overrides. Remove thin component-local font aliases and arithmetic font-size variants. Keep Geist Variable plus Noto Sans SC Variable as the sole proportional family and JetBrains Mono Variable plus Noto Sans SC Variable as the sole monospace family. Do not add, modify, or run User Interface automation. Delete inspected source-string UI tests and do not replace them with another UI test. Validate through the real `/ui` page, screenshots, and human review. Preserve unrelated shared-worktree changes and do not restart or stop user-owned processes.                                                                                             |
| Sources read               | Root `AGENTS.md`; Browser skill; `styles/tokens/design-language.css`; `styles/cascade/base.css`; `styles/cascade/typography.css`; every Overlay CSS font declaration; `index.html`; `main.tsx`; `native-menu.tsx`; `script/check-css-token-usage.ts`; current panel/card architecture; the bundled-font, titlebar, native-menu, and 2026-08-27 message-density records; commits `fec7adafb`, `108bbf587`, and `d89b92cd1`.                                                                                                                                                                                                                                                                                                                    |
| Whole-repository search    | The main and native-menu entries load the bundled families correctly. The CSS graph contains 517 references to eleven `--ui-font-*` size names plus component-local `card`, `settings`, `composer`, `work-row`, `project-runtime`, and `transcript-activity` aliases. Application chrome also contains `8`, `10`, `11`, `11.5`, `13`, `15`, and clamped `18-22px` literals or arithmetic variants. `check-css-token-usage.ts` verifies token existence, namespace ownership, and graph acyclicity but not the allowed typography vocabulary or size semantics.                                                                                                                                                                                |
| Existing test audit        | `packages/overlay/test/design-token-invariants.test.ts` reads CSS source and asserts design presentation strings. It is a prohibited UI/source-string automation test under current repository policy. This task inspected that exact file, so it must be deleted and must not be run. Historical `font-family-assets`, density, and theme-symmetry tests cited by old records are already absent.                                                                                                                                                                                                                                                                                                                                            |
| Real-page baseline         | An isolated current-source backend served the production Vite bundle at `http://127.0.0.1:57828/ui/`. Computed styles prove the proportional family is consistently Geist/Noto. The Scheduled panel renders page title and `Suggestions` at `21px`, introductory prose, filters, suggestion titles, and secondary row text at `17px`, ordinary controls/navigation at `14px`, and descriptions at `12px`. General Settings similarly renders row labels such as `Desktop notifications` at `17px`. Baseline screenshots visually confirm the fragmented hierarchy.                                                                                                                                                                            |
| Git/workspace baseline     | Branch `v0.0.55beta` began at `34ecb65bf`, exactly aligned with `origin/v0.0.55beta`. The shared worktree already contains unrelated backend, SDK, Tauri, File Changes, terminal-removal, `main.tsx`, `index.html`, `activity.css`, i18n, and architecture-debt work. This task must not overwrite or stage those changes. The separate `worktree-overlay-visual-polish` checkout is an old clean `v0.0.54beta` worktree and is not a delivery source for this task.                                                                                                                                                                                                                                                                          |
| Independent agent feedback | None before implementation. Post-implementation read-only review found mechanically caption-sized prose and controls, an over-broad Artifact exception, duplicate-token and `font`-shorthand checker escapes, a locally overridable header composite, compressed sustained-reading leading, stale Panel architecture rules, an over-broad TS keyword scan, and Presentation styles outside their content-owned file boundary. Every valid finding was repaired. Final re-review verified the complete diff, checker, specs, test deletion, build evidence, and screenshots with no unresolved findings.                                                                                                                                       |

## Observed facts, trigger, and root cause

### Observed facts

1. Font asset loading is not the incident: representative Home, Mission Board, Settings, and Scheduled elements all compute to `"Geist Variable", "Noto Sans SC Variable"`.
2. The current global scale exposes `26`, `21`, `18`, `17`, `14`, `13`, `12`, and `11px` proportional or monospace tiers before local arithmetic and literals are considered.
3. Commit `fec7adafb` raised the shared title token from `15px` to `17px` after stating that all 39 consumers represented title semantics. Current call sites contradict that premise: introductory prose, filter buttons, waiting text, progress summaries, auxiliary row text, and settings row labels also consume the token.
4. Commit `d89b92cd1` corrected the most visible message prose from the title tier to the body tier, but did not change panel consumers. It therefore reduced one symptom without repairing the shared typography contract.
5. Surface-local aliases and `calc(alias +/- 0.5px or 1px)` expressions let a component mint a new visual tier without changing the global scale. The current checker intentionally does not validate selector inheritance or font-size roles.

### Direct trigger

The recent global title-token increase made pre-existing semantic misuse visible everywhere at once. A paragraph, filter, card title, panel title, and progress value sharing one token all moved to `17px`, while their neighboring body and metadata remained `14px` and `12px`.

### Root cause

The typography authority mixes two incompatible models:

- global names such as `display`, `heading`, `title`, `control`, `small`, and `tiny` encode nominal sizes;
- component-local aliases and selector-specific arithmetic encode presentation roles again.

There is no enforceable mapping from a real UI role to one bounded size, so a token value change can silently reclassify hundreds of elements. Previous titlebar, native-menu, and message fixes were caller-specific corrections and could not prevent another surface from reintroducing a new tier.

## Architecture decision

### Canonical application typography

At `--ui-scale: 1`, application chrome has exactly four size authorities:

```text
emphasis = 16px  rare page/surface/dialog/empty-state heading or singular primary total/mark
body     = 14px  prose, section, row, card, navigation, control, filter
code     = 13px  code block or trace body needing a code reading size
caption  = 12px  compact timestamp, status, count, path hint, technical metadata
```

The application has no display/hero tier, no `17px+` title tier, and no visible application text below `12px`. Hierarchy inside one size comes from the existing `400 / 500 / 600` weight scale, color, spacing, and containment. `strong`/`b` cannot fall through to the browser's `700` default.

Font size is role-owned, not component-owned. `card`, `settings`, `composer`, `work-row`, `project-runtime`, and `transcript-activity` cannot declare aliases for the canonical sizes or derive a fractional/intermediate size with `calc()`.

Line-height remains separate from size but is similarly bounded:

```text
flat   = 1.0   fixed-height single-line control or compact-label centering
tight  = 1.35  titles, controls, rows, captions
normal = 1.5   compact prose and code blocks
reading = 1.68 transcript and other sustained reading
```

The former `snug` and `relaxed` names are removed. Sustained reading keeps the
previously accepted `1.68` leading under the semantic `reading` role instead
of being compressed as a side effect of the size-scale repair.

### Boundary

The contract applies to both Overlay entry documents, shared primitives, panels, dialogs, popovers, tooltips, menus, cards, and message host chrome. Content-owned renderers may define their own internal typography when scale is part of the Artifact itself: Reveal presentations, Vega/chart content, spreadsheet/document renderers, CodeMirror, xterm, and embedded Model Context Protocol applications. Their surrounding OpenCorvus controls remain in scope.

### Enforcement

The existing `check:css-tokens` checker remains the single static CSS authority and gains positive typography checks:

- the four canonical size tokens and four line-height roles exist exactly once
  in the design-language owner with their exact base values;
- retired size token names and component-local font-size aliases are rejected;
- application styles outside the explicit content-renderer boundary cannot use literal, clamped, fractional, or arithmetic font sizes;
- application `font-size` declarations consume only the four canonical tokens or `inherit`;
- the four canonical line-height tokens are the only application line-height rungs;
- a `font` shorthand that sets size must also set a canonical line-height, so
  the shorthand cannot silently reset leading to the browser keyword `normal`;
- canonical typography roles are declared exactly once by the design-language
  owner, and retired header/component composites cannot be redeclared locally.
- the role and bundled-family authorities exist exactly once in the global
  `:root`; no selector-local or runtime JSX/DOM style write can shadow them;
- theme palette symmetry, motion duration, spacing rhythm, and VS Code Dark
  host independence remain positive checks in this non-UI architecture
  checker after the prohibited source-oriented UI test is removed.

The checker proves source-contract closure only. Real-page screenshots and computed-style sampling remain the acceptance evidence for rendered hierarchy.

## Horizontal impact audit

| Surface                                                               | Required outcome                                                                                                                                                      |
| --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Home, titlebar, left rail, Work Ledger                                | No oversized Home hero or Projects heading; wordmark, navigation, rows, status, and metadata use the bounded roles.                                                   |
| Mission Board and mailbox                                             | Surface title uses emphasis; toolbar/body/empty-state explanation use body; secondary status metadata uses caption.                                                   |
| Settings and Scheduled                                                | Page title uses emphasis; sections, row titles, filters, prose, and actions use body; only true metadata uses caption.                                                |
| Provider, Skill, Expert Squad, MCP, usage, archive, automation panels | Existing local aliases are removed and the same role mapping applies regardless of panel owner.                                                                       |
| Conversation and structured cards                                     | Message prose stays body; Agent/card/Tool headings stay body with weight; transcript activity stays body; timing/status metadata uses caption; code uses code.        |
| Dialogs, menus, popovers, tooltips, native menu                       | Dialog headings use emphasis; all interactive labels use body; explanatory metadata uses caption; the independent native-menu entry consumes the same tokens.         |
| Themes and locale                                                     | Dark, light, and VS Code Dark share the exact same typography. Chinese and Latin continue using the bundled composed family. Theme and locale cannot redefine size.   |
| UI scale and desktop viewport                                         | User-controlled `--ui-scale` scales the four roles uniformly. Acceptance is at scale `1.0` and desktop layout; this repair does not add responsive/mobile typography. |
| Interactive Artifact content                                          | Content-owned typography is excluded; only host chrome is normalized.                                                                                                 |

## Implementation plan

1. Replace the eleven size tokens with `emphasis`, `body`, `code`, and `caption`; replace presentation-named line-height rungs with `flat`, `tight`, `normal`, and the sustained-reading `reading` role; map header/title primitives onto the role contract.
2. Mechanically replace canonical aliases across application CSS, then remove component-local font-size aliases and their arithmetic derivatives. Review every literal font size and classify it as application chrome or excluded content.
3. Normalize browser-default strong weight inside the application document.
4. Extend `check-css-token-usage.ts` with the positive typography contract and delete the inspected prohibited `design-token-invariants.test.ts`.
5. Add the implemented contract to current architecture and index it; update this record and both spec indexes.
6. Run allowed verification only: CSS-token checker, Overlay typecheck, i18n check, production Vite build, architecture/document checks, Prettier/diff checks. Do not run Overlay tests.
7. Reload the isolated real `/ui`, inspect Home, Mission Board, General Settings, Scheduled, one resource panel, menus/tooltips, and a Conversation surface at desktop size. Capture screenshots and sample computed styles to prove that visible application text stays within `12/14/16px` plus `13px` monospace.
8. After the first complete validation pass, request one uninvolved read-only agent to review the complete diff, current architecture, test deletion, checker evidence, and screenshots. Repair all valid findings, repeat validation and review until no finding remains.
9. Commit only task-owned paths. Fetch and merge upstream, audit the complete outgoing set, and push only when every outgoing commit is authorized, validated, and reviewed.

## Progress

- [x] Incident reproduction, commit attribution, full font declaration search, current architecture read, and real-page baseline complete.
- [x] Architecture and acceptance plan recorded before implementation.
- [x] Canonical scale, consumers, checker, and prohibited-test removal complete.
- [x] Allowed static/build validation complete: CSS token contract, Overlay typecheck, i18n, production Vite build, renderer public surface, architecture index, documentation check, Prettier, and diff checks pass.
- [x] Real-page screenshot and computed-style acceptance complete. At scale `1.0`, the populated Mission creation dialog renders only `14px` (21) and `16px` (2); its Expert Squad descriptions are explicit `14px/21px` text instead of the browser-default `11.67px` `<small>` outlier. The Usage panel renders `12px` (33), `14px` (28), and `16px` (12); every sampled `12px` item is compact metric/status/date/table metadata in this data-dense surface. Both surfaces have no text below `12px` or above `16px`, and all sampled application text uses the bundled Geist/Noto family. Human review of the [Mission dialog screenshot](../../artifacts/2026-08-28-overlay-typography-mission.png) and [Usage screenshot](../../artifacts/2026-08-28-overlay-typography-usage.png) found a consistent hierarchy with body text dominant for prose and controls and no oversized or undersized application chrome.
- [x] Independent read-only review complete with no unresolved findings.
- [x] Scoped commits and delivery audit complete.
