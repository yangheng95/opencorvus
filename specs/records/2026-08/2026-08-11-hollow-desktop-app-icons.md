# Hollow Desktop Application Icons

## Recall

- User request: make the application logo hollow on every platform; Windows must at least retain a white background.
- Acceptance indicators:
  - the macOS `icon.icns`, Windows `icon.ico`, Linux/runtime PNG family, and Windows Store square-logo family all show the same hollow OpenCorvus bird silhouette;
  - the bird interior is visibly white rather than a solid blue fill at 32, 44, 128, and 1024 pixels;
  - Windows ICO and Windows square-logo pixels have a fully opaque white background;
  - the generated family remains the exact set referenced by `tauri.conf.json` and the runtime window/tray icon path;
  - the regular light/dark brand logos rendered inside the application remain unchanged.
- Hard constraints:
  - preserve `packages/overlay/src/opencorvus-logo-light.svg` as the single geometry source; do not introduce a manually duplicated bird path;
  - keep icon generation deterministic and use the repository's existing Tauri and Sharp toolchain;
  - do not add or run User Interface (UI) automation tests; visually inspect the real generated image artifacts;
  - preserve unrelated dirty-worktree changes and stage only this task;
  - obtain an independent read-only delivery review after initial verification and repair every valid finding before commit.
- Materials read:
  - repository `AGENTS.md` instructions;
  - `specs/current/architecture/README.md`; no current architecture document defines a desktop application-icon contract;
  - `packages/overlay/script/generate-app-icons.ts`, `packages/overlay/package.json`, `packages/overlay/src-tauri/tauri.conf.json`, the runtime window/tray icon loading path in `src-tauri/src/main.rs`, the light/dark SVG brand assets, and every current generated desktop icon;
  - repository history for the icon generator and generated family;
  - official Tauri application-icon documentation, which identifies ICNS as the macOS artifact, ICO as the Windows artifact, PNG as the Linux artifact, and `Square*Logo.png` / `StoreLogo.png` as AppX or Microsoft Store assets.
- Repository-wide searches:
  - `generate-app-icons.ts` is the only generator and currently flattens the filled light brand logo onto white before one Tauri CLI generation pass;
  - `tauri.conf.json` bundles `32x32.png`, `128x128.png`, `128x128@2x.png`, `icon.icns`, and `icon.ico`;
  - `src-tauri/src/main.rs` embeds `icon.png` for runtime window and tray projection;
  - `packages/web/src/components/PublicSiteHeader.astro` also imported the generated runtime PNG even though the public website is not a desktop packaging surface; it must use the stable SVG brand source instead so application-icon generation cannot mutate the website Header;
  - there is no separate macOS, Windows, or Linux source logo and no prior hollow-icon implementation;
  - web favicons and in-app light/dark brand logos are separate presentation surfaces and are excluded because the user asked for platform application logos.
- Independent agent feedback before implementation: none. The mandatory independent delivery review will occur after implementation and first-pass verification.

## Analysis

### Observable behavior

All current desktop assets show a solid, multi-blue OpenCorvus bird on a fully opaque white square. The smallest PNG and Windows Store assets preserve the same filled composition, while the macOS ICNS, Windows ICO, Linux PNG, runtime window icon, and tray icon all originate from those pixels.

### Direct trigger and data/control flow

`bun run icons:generate` renders `opencorvus-logo-light.svg` through Sharp, flattens the image onto white, writes a temporary 1024-pixel PNG, and passes it to `tauri icon`. Tauri generates the complete icon family in `src-tauri/icons`; packaging and runtime code then consume different members of that same family.

### Root cause and replacement contract

The generator has only a filled-logo rasterization step, so every platform necessarily receives the filled mark. The replacement belongs in that one generator: derive a binary silhouette mask from the canonical SVG, produce a bounded outline band around the silhouette, color the band with the canonical dark blue, flatten it over opaque white, and then let Tauri generate every platform container and size from that single hollow master.

This keeps one geometry source and one generation path. It deliberately leaves the in-product brand artwork and web favicon family outside the desktop packaging contract.

### Impact, exclusions, and risk

- Definitions and call sites: only the icon generator and its generated `src-tauri/icons` outputs change; `tauri.conf.json` and Rust runtime icon loaders continue to consume the same filenames.
- Platform assets: macOS ICNS, Windows ICO and Store logos, and Linux/runtime PNGs change together.
- Background: the master remains fully opaque white, which directly guarantees the Windows requirement and preserves the existing background behavior on macOS and Linux.
- Small-size risk: a mathematically thin contour can disappear after downsampling. The outline width must be selected at 1024 pixels and accepted visually at the smallest generated 30/32/44-pixel outputs.
- Shape risk: treating each colored region independently would create noisy internal outlines and duplicate brand geometry. The generator therefore outlines the union silhouette only.
- Excluded: website favicons, social-share images, and in-app light/dark logos are not OS platform application icons and remain unchanged.
- Cross-package consumer repair: the public website Header is decoupled from the generated runtime PNG and reads the canonical light SVG directly, preserving the existing filled bird presentation while desktop containers become hollow.

## Implementation plan

1. Extend `generate-app-icons.ts` with one deterministic hollow-silhouette renderer based on the canonical light SVG alpha channel.
2. Generate a dark-blue ring mask with a white interior/background and feed that 1024-pixel master to the existing Tauri CLI path.
3. Regenerate the complete desktop icon family, retaining the configured filenames and removing mobile-only outputs as before.
4. Validate dimensions, opacity, center whiteness, and non-empty outline pixels through a focused non-UI artifact checker.
5. Visually inspect the 1024, 128, 44, 32, ICO, and ICNS representations; adjust outline width only from rendered evidence.
6. Run package typecheck, icon regeneration idempotence/diff checks, Tauri configuration/build-relevant checks, document checks, and `git diff --check`.
7. Obtain mandatory independent read-only review, repair all valid findings, rerun affected checks, then commit and perform the upstream push safety audit.

## Verification record

First-pass implementation verification:

- `bun run icons:generate` from `packages/overlay`: generated the complete 17-file desktop family and removed mobile-only outputs through the existing managed temporary-directory lifecycle.
- The first rendered artifact inspection exposed that treating Sharp's alpha morphology as a conventional bright-mask dilation produced an empty/white result. Direct mask statistics proved the library operation polarity and channel expansion; that version was rejected before acceptance.
- A second morphology-based result produced a hollow bird but squared feather ends at 1024 pixels. The implementation was replaced with a two-pass squared Euclidean distance transform, producing a smooth, constant-width outline rather than accepting the visibly inferior raster.
- Human visual inspection covered the 512-pixel `icon.png`, `128x128.png`, `32x32.png`, `Square44x44Logo.png`, `Square30x30Logo.png`, and `StoreLogo.png`. The hollow bird remains legible at the smallest assets, with rounded wing/feather/head/tail contours, a white interior, and a white background.
- Embedded PNG frames were parsed directly from the Windows ICO and macOS ICNS containers. The 16-pixel Windows frame and largest 256-pixel ICO frame were visually inspected as white-backed, hollow, and legible; the 1024-pixel `ic10` ICNS frame carries the same composition at master fidelity.
- `bun run script/run-unit-tests.ts test/app-icon-generation.test.ts`: passed 2 positive tests with 326 assertions. The tests render the canonical SVG through the hollow generator and verify dimensions, exact master colors, white center/background, outline pixel population, all 15 generated PNGs, all 6 Windows ICO frames, all 8 modern PNG-backed macOS ICNS frames, full opacity, and canonical ICNS chunk ordering.
- `bun run typecheck` from `packages/overlay`: passed.
- `cargo check --manifest-path packages/overlay/src-tauri/Cargo.toml`: passed the real Tauri host compilation in the `dev` profile.
- `bun run docs:check`: passed with 330 operations in 25 groups.
- `git diff --check`: passed.
- A SHA-256 before/after regeneration audit initially found that Tauri emitted identical ICNS chunks in nondeterministic order. The generator now canonicalizes the complete ICNS container by chunk type after Tauri generation; the repeated audit then passed with byte-identical hashes across all 17 desktop assets.
- Independent review found that `PublicSiteHeader.astro` was an undeclared cross-package consumer of the generated runtime PNG. It now imports the unchanged canonical filled SVG instead; a dedicated wrapper preserves the previous 34-pixel white image field, 5-pixel cobalt padding, 1-pixel border, and adjacent `OpenCorvus` label while preventing desktop icon regeneration from altering the website.
- Browser-skill real-page acceptance against an isolated `http://127.0.0.1:4327/` Astro development server: the desktop public homepage Header was captured and inspected after the repair. The mark remains the filled blue bird on white, inside its cobalt padding and border, with unchanged navigation alignment. Read-only computed evidence confirmed a 34 × 34 image, white image background, 5-pixel padding, cobalt wrapper background, and border. The isolated server and preview tab were closed after acceptance.
- `bun run check` from `packages/web`: passed all 62 checked files with 0 errors, 0 warnings, and one unrelated existing unused-variable hint in `qa/dedupe-lead.cjs`.
- `bun run build` from `packages/web`: passed the static production build with 335 pages, optimized the canonical SVG Header asset, and retained existing third-party Starlight/toolbeam/top-level-await warnings only.

Independent read-only review found two valid delivery issues: the public website Header's undeclared dependency on the runtime PNG and stale verification counts/dimensions. Both were repaired and the affected UI, tests, checks, build, and evidence were rerun. The second independent read-only review rechecked all 17 assets, every modern ICO/ICNS frame, runtime and packaging consumers, Windows opacity/background, smallest-size readability, ICNS canonicalization, web isolation and real-page evidence, tests, specs, indexes, and the final worktree diff, and reported **no unresolved findings**.
