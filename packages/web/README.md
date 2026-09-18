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
- API reference pages are generated from live OpenAPI route metadata by `packages/opencorvus/script/docs/render-api-md.ts`.
- Shared site configuration lives in `packages/web/config.mjs`.

Do not recreate the retired `docs/product/**` tree; public product docs use this package as the single source.

The compiled PoC paper is a self-contained static asset at `public/papers/opencorvus-poc.pdf`. Its localized homepage research link is in `OcLanding.astro` and is explicitly marked as work in progress. No LaTeX source or source-branch fetch is part of the website build.

## Product story

The English and Chinese homepages share `src/content/landing-copy.ts` and `OcLanding.astro`.
The story leads with coordination pain, a stage-disclosure diagram, the evidence-bounded tank-game
case and a short setup path. Download targets still come from the release manifest through
`OcDownload.astro`. Documentation composition examples retain their own shared catalog projection.

`script/coordination-artwork.ts` uses the homepage copy to render bilingual workflow SVGs and the
social preview through the existing `brand:assets` command. These are illustrations, not product
screenshots. The case's game screenshot is retained original evidence. See
[the evidence bundle](../../specs/artifacts/2026-09-19-task-coordination/README.md).

The development entry runs Astro under Bun, because the on-demand Registry and view-count routes
import `bun:sqlite`. Node can build the static site but cannot serve those development routes.
`tmp/` is excluded from Astro typechecking; tracked source/scripts and tests remain in scope.
