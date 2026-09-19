# OpenCorvus Web Docs

This package contains the public OpenCorvus documentation site built with Astro and Starlight.

## Commands

Run commands from the repository root:

```bash
bun run --cwd packages/web dev
bun run --cwd packages/web build
bun run --cwd packages/web check
```

## Content

- Product documentation lives in `packages/web/src/content/docs/**`.
- Editorial articles live in `packages/web/src/content/blog/{root,zh-cn}/**.md`.
- API reference pages are generated from live OpenAPI route metadata by `packages/opencorvus/script/docs/render-api-md.ts`.
- Shared site configuration lives in `packages/web/config.mjs`.

Do not recreate the retired `docs/product/**` tree; public product docs use this package as the single source.

The compiled PoC paper is a self-contained static asset at `public/papers/opencorvus-poc.pdf`. Its localized blog research entry uses `OcResearchPaper.astro` and is explicitly marked as work in progress. No LaTeX source or source-branch fetch is part of the website build.

## Product story

The English and Chinese homepages share `src/content/landing-copy.ts` and `OcLanding.astro`.
The original hero/terminal and long-horizon cards retain
their visual system. A concise start section and blog links complete the homepage.
Detailed composition, benchmark, evolution, research, integration and FAQ material lives in
the categorized bilingual blog. Download targets come from the release manifest through
`OcLanding.astro`; its outside-click boundary and viewport-aware menu placement are retained.
Blog and documentation composition examples share copy and the same catalog projection.

The `blog` build-time content collection owns article metadata and Markdown bodies. Each locale
uses a distinct entry ID; `key` connects counterpart routes without using Astro's globally unique
`slug` override. `OcBlogIndex` groups posts by cases, mechanisms, research and practice; `OcBlogArticle`
renders readable prose, an optional heading directory and existing complex visual components.
New articles need a corresponding entry in both languages. Blog pages are statically generated;
they do not read the dynamic Registry or require a content-management service.

`OcMissionCase` owns its disclosure interaction. The benchmark result bar is statically visible,
so articles do not depend on the homepage reveal observer. `brand:assets` copies the canonical
`assets/agent-teams-workflow.png` to the website media directory for the migrated harness article.

`src/lib/execution-graph.ts` owns the role nodes, directed handoff edges and correction loops shared
by the homepage and `script/coordination-artwork.ts`, with labels in `execution-copy.ts`.
The latter renders bilingual workflow SVGs through `brand:assets`. The social preview retains
the original logo and gradient design. The graphs are illustrations, not product
screenshots. The case's game screenshot is retained original evidence. See
[the evidence bundle](../../specs/artifacts/2026-09-19-task-coordination/README.md).

The development entry runs Astro under Bun, because the on-demand Registry and view-count routes
import `bun:sqlite`. Node can build the static site but cannot serve those development routes.
`tmp/` is excluded from Astro typechecking; tracked source/scripts and tests remain in scope.

The homepage case gallery replaces the video and standalone case graph. `src/content/case-gallery.ts` supplies localized task inputs, models and artifact links; `src/lib/case-gallery-graph.ts` renders requirement dependencies and reuses the tank collaboration graph. Historical video files are archival assets.
