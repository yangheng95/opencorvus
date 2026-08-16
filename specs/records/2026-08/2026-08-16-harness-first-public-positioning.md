# Harness-first public positioning for the landing page and READMEs

## Recall

- User request: rebuild the public webpage so its headline claim is an open-source multi-agent harness platform, with every other section serving that theme, and synchronize both READMEs. Badges were required in the README, the content had to read as mature, and comparable products had to be investigated before any edit.
- Follow-up constraint: the shipped harness must read as working out of the box while still supporting custom construction.
- Competitive read: `agent harness` is an established 2026 category term for the runtime that turns a model into an agent. Anthropic applies it to the Claude Agent SDK; Microsoft Agent Framework shipped an explicit Agent Harness layer; `best-of-Agent-Harnesses` ranks the category on autonomy, durable execution, permissions, MCP, memory, and multi-agent axes. n8n was taken as the model for the dual promise, contrasting prebuilt nodes against `Code when you need it, UI when you don't`. OpenHands, CrewAI, Dify, and Microsoft Agent Framework were read for badge blocks and README section order.
- Read evidence: `packages/web/src/components/Lander.astro`, `packages/web/src/content/landing.ts`, `packages/opencorvus/src/tool/global-tools.ts`, `packages/opencorvus/src/provider/models-bootstrap.json`, `packages/channel-runtime/src/registry.ts`, `packages/web/src/content/expert-squad-distribution.generated.ts`, and `packages/opencorvus/src/config/config.ts`.
- Prior naming: the repository already treated the term as internal vocabulary in `packages/opencorvus/src/work/harness.ts`, and the landing already carried a `The OpenCorvus Harness` sub-section below the fold.

## Plan

1. Replace the `Agent Workbench` headline claim with the harness category claim in both locales, keeping Workbench, Expert Squad, Task, and Mission as named layers rather than renaming any product noun.
2. Prove the claim with one `ships working / replace via` layer table covering eleven harness layers, placed directly under the hero.
3. Derive every advertised count from a verified repository fact, and bind the squad count to the existing generated distribution constant instead of a literal.
4. Mirror the same structure into both READMEs behind a verified badge block.
5. Keep the existing editorial design language, the public navigation contract, and the documented page inventory unchanged.

## Verified public counts

| Claim | Authority |
| --- | --- |
| 42 built-in tools | `loadBuiltInGlobalTools` frozen return array in `packages/opencorvus/src/tool/global-tools.ts` |
| 87 providers, 2,579 models | `packages/opencorvus/src/provider/models-bootstrap.json` |
| 119 Expert Squads, 4 embedded, 115 importable | `generatedExpertSquadDistribution` |
| 13 chat channels | `packages/channel-runtime/src/registry.ts` |
| 5 primary agent roles | `PrimaryAssistantID` in `packages/opencorvus/src/agent/primary-assistant-registry.ts` |

An earlier draft advertised `69 tools` from a `src/tool/*.ts` file count. That number counts adapters, identifier catalogs, and result helpers that are not registered tools, and it was corrected to the registry count of `42` in every locale and both READMEs before validation.

The squad count is not a literal in any copy string. `packages/web/src/content/landing.ts` imports `generatedExpertSquadDistribution` and interpolates `total`, `embeddedAlreadyAvailable`, and `bundledMarketImportable`, matching the existing `TrustPage.astro` pattern, so regenerating the distribution cannot leave stale marketing copy behind.

## Completion record

- `landing.ts` replaced the `proof` and `workbench` keys with `runtime` and `layers`, keyed identically across `root` and `zh-cn`. The hero claim is now `Works out of the box. / Yours to rebuild.` under the eyebrow `Open-source multi-agent harness platform`.
- `Lander.astro` renders the hero credibility numbers, a new eleven-row semantic `<table>` with `scope="col"` and `scope="row"` headers inside an `overflow-x` wrapper, then the existing gallery, squads, mission, and community bands. The removed `work-mode-grid` rules and their dead `proof-strip` media-query references were deleted rather than left behind.
- The hero secondary action now points at the source repository; `Expert Squads` remains reachable from the navigation and its own band, so the documented navigation priority in `specs/current/architecture/public-website.md` is unchanged.
- Both READMEs lead with the previously unused `assets/readme-head.png` brand banner, a two-row badge block, the category definition, a `What runs on first launch` table, the `layer by layer` table, and a `Make it yours` configuration table covering `model`, `tools`, `mcp`, `permission`, `agent`, `expert_squads`, `instructions`, plus the SDK, plugin, MCP, and Agent Client Protocol extension paths.
- Badge selection is evidence-based. Every badge was resolved against `shields.io` before inclusion: release resolves `v0.0.44-beta.1` only with `include_prereleases`, `license` resolves `MIT`, and `typecheck` and `codeql` both resolve `passing` on `main`. The `test` workflow is red on `main` from the known pre-existing worktree-ownership failure and was excluded rather than displayed red; no npm badge exists because no package is published; no stars or discussions badge was added because the repository has 10 stars and `has_discussions` is `false`.
- `bun run --cwd packages/web check` reported `0 errors` across 82 files. The rendered page was verified in a browser at 1440 x 900: the layer table renders 11 rows with correct header scope, `document.body.scrollWidth` equals `clientWidth` so nothing overflows horizontally, the hero numbers render `87 / 119 / 13`, and both `/` and `/zh-cn/` resolve with locale-correct titles. The only console error is the pre-existing `/api/site/v1/visitors` 500, which requires the production registry database absent in local development.
- Every relative link and image path in both READMEs was resolved against the working tree; none are missing.

## Known follow-ups

- `body.public-site-body` and `.public-landing` both set `min-width: 1100px`, so the public site remains desktop-only by construction while every benchmarked comparable is mobile-first. Changing it affects all public pages and was left out of this change.
- The landing community card and `config.mjs` both link to GitHub Discussions, but `has_discussions` is `false` on the repository, so that destination currently does not exist. Either enable Discussions or repoint the link.
- The GitHub repository has no description, homepage, or topics set, so the harness positioning is absent from the repository sidebar and from GitHub search.
