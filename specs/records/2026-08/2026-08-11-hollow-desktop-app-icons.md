# Transparent-Background Platform Icons and Website Favicon

## Recall

- Original request: “把所有平台的logo都扣成空心的，至少windows是白底的”.
- Final user clarification on 2026-08-12: “最开始的图片icon，只裁外边，别给我扣成空心的”. The intended operation is background removal, not a hollow bird: preserve the original filled, multicolor OpenCorvus bird exactly and make only the canvas outside the bird transparent.
- Additive request: use this same filled transparent-background bird as the website title favicon; the public website currently appears to have no favicon.
- Acceptance indicators:
  - macOS ICNS, Windows ICO and Store assets, Linux/runtime PNGs all retain the original dark-blue, blue, accent-blue, and white-eye artwork;
  - only pixels outside the original bird are transparent; the bird body remains filled;
  - all 15 standalone PNGs, all 6 Windows ICO frames, and all 8 modern PNG-backed macOS ICNS frames preserve the same filled artwork and transparent exterior;
  - the website serves one real `favicon.svg` derived mechanically from the canonical brand SVG, and every website page family emits a favicon link;
  - no obsolete white-backed or hollow rendering path remains.
- Hard constraints:
  - `packages/overlay/src/opencorvus-logo-light.svg` remains the only editable geometry/color source;
  - generated desktop assets and website favicon must be deterministic;
  - do not add or run UI automation; website acceptance uses a real local page, browser inspection, and a screenshot/manual check;
  - preserve concurrent worktree changes and exclude unrelated specification-index edits from this task's commit;
  - obtain an independent read-only review after verification.
- Materials and repository searches:
  - `packages/overlay/script/generate-app-icons.ts` is the sole desktop icon generator and feeds Tauri's PNG, ICO, ICNS, and AppX/Store outputs;
  - `tauri.conf.json` and the Rust runtime continue to consume the same generated filenames;
  - the hollow distance-transform renderer and its outline constants are only called by the generator and its focused test, so they can be deleted without a compatibility layer;
  - `packages/web/public/favicon*.{svg,ico,png}` and `apple-touch-icon*.png` are 39–48-byte plain-text pointers to a removed `packages/ui/src/assets/favicon` path, not valid image files;
  - Starlight references the broken `favicon-v3` family, while `PublicSiteLayout.astro` and both standalone architecture pages emit no favicon link;
  - the public website Header already imports the canonical filled SVG and remains visually unchanged.
- Independent agent feedback before this final clarification: prior reviews validated the now-rejected hollow implementations. A new independent review is required for the filled transparent-background contract.

## Analysis

### Observable behavior and direct triggers

The first implementation flattened the canonical filled bird onto white. Two later interpretations converted the bird itself into a blue contour, first on white and then with alpha. Both changed the bird artwork instead of removing only its outside background. The current distance band also fills narrow body regions, which is why the result still looked solid in places while no longer matching the original icon.

The website favicon failure is separate but related: configured favicon URLs resolve to files whose contents are merely stale relative path strings. Custom public and architecture page heads do not reference any favicon at all.

### Root cause and single replacement contract

The canonical SVG already contains the exact filled multicolor bird and has no background rectangle. The correct desktop master is therefore a direct alpha-preserving rasterization of that SVG; no mask, distance transform, outline color, fill replacement, or white flatten is needed.

The website favicon must be generated from that same canonical SVG into one real public `favicon.svg`. All website page families reference that single artifact. Obsolete broken favicon variants are deleted so there is one current fact source and one URL.

### Impact and risk

- Desktop asset filenames and all packaging/runtime consumers stay unchanged.
- The bird's white eye is intentionally retained because it belongs to the original artwork; only the exterior becomes transparent.
- Small frame risk is color/shape loss during downsampling. Tests compare each generated frame against a direct canonical raster at the same size and require filled-bird coverage plus brand-color agreement.
- Website changes affect document head output only; Header/body branding and layout remain outside the change.
- Browser cache can hide favicon changes, so acceptance must inspect the emitted `<link rel="icon">`, its fetched response type/content, and the visible tab on an isolated local server.

## Implementation plan

1. Replace the hollow renderer with direct filled SVG rasterization that preserves alpha.
2. Regenerate and visually inspect the complete 17-file desktop icon family.
3. Replace hollow-specific tests with positive original-artwork, filled-interior, transparent-exterior, color-fidelity, and all-frame contracts.
4. Add a deterministic website brand-asset generator, emit one real `favicon.svg`, delete broken variants, and connect all page families to it.
5. Run focused tests, icon/favicon idempotence, overlay typecheck, Rust host check, web check/build, docs check, and diff checks.
6. Start an isolated real website, inspect favicon link/fetch/tab presentation, then obtain independent read-only review.
7. Commit only task files and audit the complete upstream push set.

## Verification record

First-pass verification for the clarified filled transparent-background contract:

- The hollow distance-transform implementation, outline radius, and monochrome outline color were deleted. `renderTransparentDesktopIcon` directly rasterizes the canonical filled SVG with alpha and no flattening or mask transformation.
- `bun run icons:generate` regenerated the complete 17-file desktop family. Human inspection of `icon.png`, 128px, 32px, and `StoreLogo.png` at original resolution confirmed the original filled dark-blue/base-alt/accent bird and white eye, with only the exterior transparent.
- `bun test --timeout 60000 ./test/app-icon-generation.test.ts`: passed 2 positive tests with 257 assertions. The tests verify exact master brand colors, filled-bird coverage, transparent exterior, canonical color agreement, separate positive coverage for the base, base-alt, accent, and white-eye regions at every applicable size, all 15 PNGs, all 6 Windows ICO frames, all 8 modern PNG-backed macOS ICNS frames, and canonical ICNS chunk ordering.
- A repeated SHA-256 regeneration audit passed with byte-identical hashes across all 17 desktop assets.
- `cargo check --manifest-path packages/overlay/src-tauri/Cargo.toml`: passed the real Tauri host compilation.
- `packages/web/script/generate-brand-assets.ts` copies the canonical SVG bytes into the single public `favicon.svg`; the focused Bun artifact test passed and SHA-256 hashes are exactly equal. Repeated generation is byte-identical.
- Seven obsolete favicon/Apple-touch variants containing stale path text were deleted. Repository search found no remaining `favicon-v3`, `favicon-96x96`, `apple-touch-icon`, `favicon.ico`, hollow-renderer, or outline-constant reference.
- Real-page browser acceptance used an isolated Astro development server at `http://127.0.0.1:4329/`. The public homepage, `/start/install/` documentation page, and `/architecture-explorer/` each emitted one `image/svg+xml` icon link to `/favicon.svg`; directly opening that resource in the browser displayed the original filled multicolor bird. The homepage screenshot also confirmed unchanged Header/body presentation. The tab and isolated servers were closed after acceptance.
- `bun run docs:check`: passed with 331 operations in 25 groups. `git diff --check`: passed.
- Two broad checks are currently blocked by unrelated concurrent work: overlay typecheck reports five missing usage-statistic exports in existing settings/service files, while web check/build reports registry typing/import errors in concurrent registry files. The favicon-focused test, real dev-page path, and Tauri host compile pass; none of the reported broad-check errors references a task file.
- Independent read-only review found that the initial aggregate color-distance contract could allow a monochrome dark-blue regression. The contract was tightened to verify each canonical color region independently (with a small-sample rule for heavily downsampled frames), and the strengthened 257-assertion suite passed. Final independent re-review reported no unresolved findings.
