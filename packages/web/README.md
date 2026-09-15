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

The compiled PoC paper is a self-contained static asset at `public/papers/opencorvus-poc.pdf`. Its localized homepage entry is `OcResearchPaper.astro` and is explicitly marked Under Construction. No LaTeX source or source-branch fetch is part of the website build.
