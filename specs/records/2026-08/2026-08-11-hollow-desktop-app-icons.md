# Hollow Desktop Application Icons

## Recall

- User request: make the application logo hollow on every platform; the initial wording noted that Windows currently presents a white background.
- User correction on 2026-08-12: a white background or white-filled interior is not a cutout. The deliverable must contain real transparent alpha outside the outline and inside the bird silhouette; any white seen on Windows must come from the operating-system surface beneath the icon, not white pixels baked into the asset.
- Acceptance indicators:
  - the macOS `icon.icns`, Windows `icon.ico`, Linux/runtime PNG family, and Windows Store square-logo family all show the same hollow OpenCorvus bird silhouette;
  - the bird interior and canvas outside the blue outline are transparent rather than white-filled at 32, 44, 128, and 1024 pixels;
  - Windows ICO and Windows square-logo assets preserve that alpha cutout, so a white Windows surface can show through without becoming part of the icon artwork;
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

The generator has only a filled-logo rasterization step, so every platform necessarily receives the filled mark. The replacement belongs in that one generator: derive a binary silhouette mask from the canonical SVG, produce a bounded outline band around the silhouette, color the band with the canonical dark blue, preserve transparent alpha on both sides of the band, and then let Tauri generate every platform container and size from that single hollow master.

This keeps one geometry source and one generation path. It deliberately leaves the in-product brand artwork and web favicon family outside the desktop packaging contract.

### Impact, exclusions, and risk

- Definitions and call sites: only the icon generator and its generated `src-tauri/icons` outputs change; `tauri.conf.json` and Rust runtime icon loaders continue to consume the same filenames.
- Platform assets: macOS ICNS, Windows ICO and Store logos, and Linux/runtime PNGs change together.
- Transparency: the master must retain alpha. The corner and bird interior must be transparent; only the blue outline and its antialiased edge may carry opacity. A white Windows tile or shell surface is presentation underneath the icon, not raster content.
- Small-size risk: a mathematically thin contour can disappear after downsampling. The outline width must be selected at 1024 pixels and accepted visually at the smallest generated 30/32/44-pixel outputs.
- Shape risk: treating each colored region independently would create noisy internal outlines and duplicate brand geometry. The generator therefore outlines the union silhouette only.
- Excluded: website favicons, social-share images, and in-app light/dark logos are not OS platform application icons and remain unchanged.
- Cross-package consumer repair: the public website Header is decoupled from the generated runtime PNG and reads the canonical light SVG directly, preserving the existing filled bird presentation while desktop containers become hollow.

## Implementation plan

1. Extend `generate-app-icons.ts` with one deterministic hollow-silhouette renderer based on the canonical light SVG alpha channel.
2. Generate a dark-blue ring mask with a transparent interior/background and feed that 1024-pixel master to the existing Tauri CLI path.
3. Regenerate the complete desktop icon family, retaining the configured filenames and removing mobile-only outputs as before.
4. Validate dimensions, transparent corner/interior alpha, and non-empty opaque outline pixels through a focused non-UI artifact checker.
5. Visually inspect the 1024, 128, 44, 32, ICO, and ICNS representations; adjust outline width only from rendered evidence.
6. Run package typecheck, icon regeneration idempotence/diff checks, Tauri configuration/build-relevant checks, document checks, and `git diff --check`.
7. Obtain mandatory independent read-only review, repair all valid findings, rerun affected checks, then commit and perform the upstream push safety audit.

## Verification record

The 2026-08-11 white-backed implementation was rejected by the user's 2026-08-12 correction because every pixel was opaque; visually white negative space did not constitute an alpha cutout. The following evidence supersedes that acceptance record:

- `renderHollowDesktopIcon` now writes its RGBA outline buffer directly and does not flatten it onto white. Transparent pixels remain on both sides of the blue contour.
- `bun run icons:generate` from `packages/overlay`: regenerated the complete 17-file desktop family and removed mobile-only outputs through the existing managed temporary-directory lifecycle.
- Human visual inspection covered the 512-pixel `icon.png`, 32-pixel PNG, and 50-pixel `StoreLogo.png` at original resolution. The viewer's transparency surface is visible outside the mark and through the bird body, while the blue contour remains smooth and recognizable at the small sizes.
- `bun run script/run-unit-tests.ts test/app-icon-generation.test.ts`: passed 2 positive tests with 152 assertions. The tests validate alpha-bearing master output, transparent corner and center samples, sufficient transparent and visible-outline pixels, all 15 generated PNGs, all 6 Windows ICO frames, all 8 modern PNG-backed macOS ICNS frames, and canonical ICNS chunk ordering.
- A repeated SHA-256 before/after regeneration audit passed with byte-identical hashes across all 17 desktop assets.
- `bun run typecheck` from `packages/overlay`: passed.
- `cargo check --manifest-path packages/overlay/src-tauri/Cargo.toml`: passed the real Tauri host compilation in the `dev` profile.
- `bun run docs:check`: passed with 330 operations in 25 groups.
- `git diff --check`: passed.
- The website Header remains isolated from generated runtime icons through its canonical filled SVG import; no web UI file changed in the correction.
- Independent read-only re-review inspected the generator, all 15 PNG assets, all 6 Windows ICO frames, all 8 modern macOS ICNS PNG frames, legacy ICNS masks, small-size visuals, tests, runtime/package consumers, specification, and final task diff, and reported **no unresolved findings**.
