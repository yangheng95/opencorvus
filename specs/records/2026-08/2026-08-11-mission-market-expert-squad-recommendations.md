# Mission Market Expert Squad Recommendations

## Recall

| Item | Frozen contract |
| --- | --- |
| User request | Add a fuzzy Market Expert Squad search at the Mission User Interface entry. Matching must account for package Skill and prompt material. When an uninstalled specialist squad fits the Mission request, remind the operator and provide both an open-web-page action and a direct-install action. |
| Acceptance | Typing a substantive query in the Mission Expert Squad search searches the canonical bundled Market, ranks selector, Skill, and prompt evidence, and shows bounded uninstalled recommendations in the create dialog. Each recommendation can open its exact public Market page or explicitly install it into the selected project. A successful install refreshes the installed catalog without activating a project profile or silently selecting a squad. |
| Hard constraints | Reuse `ExpertSquadPackageManager.payloadMarketPage()` and `installPayloadPackage()`; do not add a second market, installer, active-profile source, hidden model call, host workflow gate, synthetic message, fallback, or automatic activation. Installation is an explicit trust decision. Do not add, modify, or run User Interface automation tests. Real page interaction and screenshot review are required. Preserve unrelated dirty-worktree changes. |
| Sources read | `AGENTS.md`; `specs/current/architecture/01-agents.md`, `04-extensions.md`, and `07-panel.md`; the 2026-08-11 on-demand-installation record; the 2026-08-10 hosted publish/install/reuse record; `MissionCreateDialog.tsx`, `MissionBoard.tsx`, `main.tsx`, composer catalog services, Expert Squad Market services/routes/Manager/Registry, fuzzy scorer, translations, Mission Board styles, public Market routes, and focused catalog tests. |
| Whole-repository search | Searches covered Mission create entry points, picker query/install callbacks, Expert Squad catalog and Market search/install routes, the canonical fuzzy scorer, public Market paths, native URL opening, Skill and prompt package files, architecture statements, translations, styles, and related tests. No Mission-create User Interface automation test was found. |
| Independent agent feedback | No agent before implementation. The uninvolved post-validation reviewer found stale install completion across project/dialog generations, a hand-maintained installed-catalog shadow instead of canonical rereads, copy that overstated which fields matched, and incomplete busy/loading/submit convergence during project changes. The implementation now rejects stale generations, rereads the complete target-project catalog plus available-only Market, preserves current/new exact IDs through canonical queries, gates submit on the canonical catalog, and gives every search/mutation owner explicit loading cleanup. The reviewer’s second pass reported no findings. |

## Problem depth and impact analysis

### Observable behavior

The Mission create dialog searches only the effective installed Expert Squad catalog. Its trailing “install more” row closes the dialog and opens Settings. A user searching for a specialist squad therefore receives no in-context signal that the bundled Market already contains a better matching squad, and must leave the creation flow to discover it manually.

### Direct trigger and data flow

`MissionCreateDialog` forwards the dedicated squad search box to `searchComposerExpertSquads()`. That function calls `searchExpertSquads()`, which searches the Registry/Resolver effective catalog only. The same explicit query is not connected to `loadExpertSquadMarket()`. Market results and `installExpertSquadMarketPackage()` exist only in the Settings panel.

### Root cause and why the old path does not solve it

The on-demand-installation change intentionally removed automatic provisioning and retained only a navigation action in editable pickers. That safely established explicit installation, but the picker boundary carries neither Market recommendation state nor exact install actions. In addition, Market ranking currently scores manifest identity, labels, descriptions, and selector summary/guidance; it does not inspect the package-owned Skill or Agent prompt content that defines specialist method fit. Opening Settings is therefore a generic escape hatch, not a Mission-fit discovery flow.

### Impact surface

| Surface | Required disposition |
| --- | --- |
| Market ranking | Extend the existing Manager ranking input with bounded package-owned Skill and prompt text. Preserve the current fuzzy algorithm, filters, pagination, cursor identity, and deterministic tie-break. |
| HTTP/OpenAPI/SDK | Reuse existing Market page and install schemas. No new route or public field is needed; regenerated closure should remain unchanged. |
| Overlay services | Reuse `loadExpertSquadMarket()` and `installExpertSquadMarketPackage()`. Add only public-page URL construction and Mission callback orchestration. |
| Mission create UI | Debounce substantive Expert Squad queries, render a bounded recommendation surface, distinguish loading/error/installed state, and keep Create disabled only by its existing requirements. Recommendations must never block Mission creation. |
| Installation semantics | Direct install targets the explicitly selected project scope, does not overwrite, activate `prompt_profile.active`, or select the recommendation. After success, refresh the effective catalog and recommendation state. |
| Public website | Open the exact locale-aware public route shape `/market/<namespace>/<id>/`; the desktop locale selects the English or Simplified Chinese route. The button does not claim a download or installation occurred. |
| Tests | Add a positive backend contract proving a phrase present only in package Skill/prompt material returns the exact Market entry. Do not add or run UI automation tests. |
| Documentation | Update current extension architecture because the prior picker contract prohibited direct installation. Update both spec indexes and record real-page evidence. |
| Delivery | Stage only owned paths/hunks. Regenerate API/SDK checks even though schema changes are excluded. Independent review is mandatory before commit/push. |

### Known risks and exclusions

- Long arbitrary Expert Squad queries can add noisy tokens to fuzzy search. The UI sends a bounded trimmed query only after a short debounce and the existing endpoint enforces a 500-character maximum.
- Prompt/Skill content can be large. Ranking precomputes bounded textual fields from embedded package files and does not return or project that content into the UI or runtime prompt.
- A Market match is a discovery suggestion, not an authority or quality verdict. The operator must explicitly install it and still explicitly choose a squad for the Mission.
- Network/public-site availability is not inferred from a successful native-open command. The real-page acceptance records only the observed action and browser result.
- Updating or overwriting an existing installation is excluded. The recommendation query requests `availability=available` and the Manager’s install contract fails closed on conflicting bytes.

## Implementation plan

1. Add one Manager helper that derives fuzzy discovery fields from each embedded Market source: manifest identity/selector fields plus bounded `skills/**/SKILL.md` and `agents/**/system.md` text. Use it inside the existing payload Market page ranking and add a focused positive test.
2. Add Mission Market query/install/open callbacks in `main.tsx` using the existing Market API and native URL opener.
3. Extend `MissionBoard` and `MissionCreateDialog` with bounded recommendation state and actions. Debounce the dedicated Expert Squad query with sequence-based stale-response rejection, render exact Market identity/version/description, and expose “Open web page” plus explicit project installation.
4. After successful installation, invalidate and reload the current composer catalog and rerun the recommendation query. Keep the installed result unselected and project activation unchanged.
5. Add bilingual copy and Mission Board surface styles, update current architecture and both spec indexes, then run formatting, focused backend tests, Overlay typecheck/build, route/API/docs checks, and diff checks.
6. Start an isolated real Overlay page, exercise a specialist Expert Squad query, inspect screenshots before and after installation, and record truthful visual evidence.
7. Delegate an uninvolved read-only agent to review the complete diff, tests, evidence, docs, and regression risk. Fix every valid finding and repeat review when fixes are material.

## Validation ledger

- Focused backend contract: `bun test packages/opencorvus/test/expert-squad/catalog-index.test.ts --test-name-pattern "ranks Market packages from package-owned Skill and prompt evidence"` passed. Both the Skill-only phrase `allocated loss adjustment expense` and prompt-only phrase `apparent backtest success on changed scope` ranked `actuarial-reserving` first.
- Overlay compile/package: final `bun run --cwd packages/overlay typecheck` and `bun run --cwd packages/overlay build:vite` passed after the independent-review fixes. Vite retained its existing large-chunk and third-party `use client` warnings.
- Core checks: the full focused `catalog-index.test.ts` suite passed with 13 tests and 68 expectations; `bun run --cwd packages/opencorvus typecheck`, `bun run docs:check`, and `git diff --check` passed.
- Route inventory: final `bun run api:routes-check` passed all 6 rules across 34 files. An earlier run observed transient generated OpenAPI drift from concurrent provider-usage work; this task changed no route/schema and did not overwrite that work.
- Real page: production Overlay assets were served by an isolated backend on `127.0.0.1:17891` with an isolated `OPENCORVUS_HOME` and project. Searching `allocated loss adjustment expense` kept the query stable, ranked `Actuarial Reserving` first, and exposed the exact identity, description, “Open web page”, and “Install to project” actions in an internally scrollable 720px dialog. Evidence: `specs/artifacts/mission-market-search.png`.
- Real install: “Install to project” installed `builtin/actuarial-reserving` into a fresh isolated project; a canonical catalog/Market reread removed it from available-only recommendations, retained `Advanced` as the selected squad, and exposed `Actuarial Reserving` in the expanded picker without activation or auto-selection. Evidence: `specs/artifacts/mission-market-search.png`, `specs/artifacts/mission-market-installed.png`, and `specs/artifacts/mission-market-installed-picker.png`.
- Stale completion: installation of a second suggestion was started and the dialog was immediately closed. Reopening after the mutation settled showed a reset query, `Advanced` still selected, no stale success/error state, and no prior-generation UI writeback.
- Browser-host limitation: the in-app Browser host has no native external-open capability, so its “Open web page” control was truthfully disabled. The Tauri-bound native-open callback and exact locale-aware URL construction were typechecked, but native external navigation was not executed in this acceptance run.
- Remaining gap: the bundled Market discovery input is bounded but currently covers about 2.31 MB across 105 packages. Debounce and stale-response suppression were exercised, but request cancellation and a formal latency/concurrency budget are outside this change.
- Remaining gap: close/reopen during an in-flight install was exercised on the real page; installation-time switching between two real projects was code-reviewed but not manually executed.
