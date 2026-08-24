# Website version-bound download repair

Status: implementation and validation completed; remote delivery pending a clean outgoing branch boundary

## Recall

| Item | Requirement or evidence |
| --- | --- |
| User request | Fix the public website behavior that presents the current `0.0.53-beta` release while the user remains on the previously installed `0.0.47-beta` application. |
| Acceptance | On Windows, the landing-page primary action resolves to the current manifest's Windows x64 EXE even when high-entropy User-Agent Client Hints are unavailable; the control visibly names the manifest version and exact installer choice; unknown or ambiguous platforms open the explicit download menu instead of presenting a Release-page link as a direct download; the real local page is visually reviewed and its link target is inspected. |
| Hard constraints | The generated GitHub Release manifest remains the only version/download authority; do not introduce a second latest-version value or fallback asset; do not add, modify, retain, or run UI automation tests in the touched path; preserve unrelated video, benchmark, spec, and abnormal-name worktree changes. |
| Sources read | `AGENTS.md`; `specs/current/architecture/public-website.md`; the `v0.0.53-beta` release record; `packages/web/src/lib/landing-downloads.ts`; `packages/web/src/components/OcLanding.astro`; `script/generate-website-download-manifest.ts`; website deployment and release workflows; the live `/downloads/latest.json`; local Windows uninstall registration, shortcuts, installed executable metadata, and Downloads directory. |
| Repository search | The live manifest and every website asset URL are bound to `v0.0.53-beta`. The installed application and both shortcuts still resolve to the NSIS installation at `C:\Users\hengu\AppData\Local\OpenCorvus`, version `0.0.47-beta`. The landing primary link becomes an exact asset only after high-entropy platform-and-architecture detection; otherwise it retains the Release page while still reading “Download”. Windows currently publishes one architecture, x64, with EXE ordered before MSI. |
| Starting state | Branch `v0.0.52beta` contains unrelated outgoing video commits and the worktree contains unrelated modified/untracked video, benchmark, spec-index, and abnormal-name paths. Only the files named by this repair may enter its commit. |
| Independent review | None before implementation. After first validation, a previously uninvolved read-only agent found one P1: the bound primary action named Windows/x64/version but not EXE versus MSI. The primary now also exposes EXE and the exact file name. A second read-only review found no unresolved P0/P1/P2/P3 issue. |

## Root-cause and impact analysis

- Observable symptom: the page shows the newest release, but the user can finish the interaction without obtaining or launching that release and continues to see `0.0.47-beta` locally.
- Direct trigger: `detect()` returns `null` whenever `navigator.userAgentData.getHighEntropyValues` is unavailable or does not disclose architecture. The primary anchor then remains the GitHub Release page rather than one manifest asset, although its label still promises a download.
- Data flow: the deployment generates one version-bound manifest from published GitHub Release assets; Astro renders that manifest; client detection selects the first exact platform/architecture asset; Windows EXE precedes MSI. The broken branch occurs only between rendered assets and the primary client action.
- Root cause: the page treats exact architecture detection as mandatory even when the manifest itself proves that a detected platform has only one published architecture. It also does not distinguish an unresolved selection action from a resolved direct download.
- Why existing paths did not prevent it: release checks verify canonical versioned URLs and asset completeness, but they do not turn unavailable browser hints into a truthful user interaction. File names are present in the manifest but omitted from the visible primary/menu contract.
- Affected contract: landing download interaction and copy only. Release generation, immutable asset URLs, desktop updater metadata, Registry, CLI packages, and non-Windows multi-architecture selection are explicitly excluded.
- Risks: prematurely choosing x64 on a platform with multiple architectures, selecting MSI before EXE, or making the no-JavaScript fallback unusable. The implementation therefore derives a fallback only when rendered assets prove one architecture, preserves manifest ordering, and leaves the server-rendered Release URL intact for no-JavaScript readers.

## Plan

1. Make the rendered download links expose their manifest-owned platform, architecture, file name, and version, and show the version in both the initial primary action and every menu choice.
2. Resolve coarse platform information from User-Agent Client Hints, `navigator.platform`, or `navigator.userAgent`; when architecture is absent, select only if all rendered assets for that platform share one architecture.
3. Mark the primary action as direct only after binding it to the selected manifest asset. Otherwise intercept the JavaScript-enabled action and open the explicit menu; retain the Release page as the no-JavaScript fallback.
4. Run focused static/type/build checks that do not exercise UI automation, then start the real development site and inspect/click/screenshot the landing control manually.
5. Obtain independent read-only review, resolve every valid finding, rerun affected verification, commit only scoped files, and assess the outgoing branch boundary before any push.

## Completion record

The landing control now renders manifest-owned version, format, and file-name facts for every asset. Client detection uses high-entropy architecture when available; otherwise it derives only a coarse platform and auto-selects when the rendered manifest proves that platform has exactly one architecture. Windows therefore binds the first x64 asset, the EXE, while macOS/Linux stay explicit when architecture is unknown. Until a manifest asset is bound, the JavaScript-enabled primary action opens the explicit menu; the server-rendered Release link remains available without JavaScript.

Focused verification passed after generating the ignored local manifest with the same production generator and exact dispatched `0.0.53-beta` release: `bun run docs:check`; `bun run --cwd packages/web check` with 0 errors; and `bun run --cwd packages/web build`, including the static site, canonical installer copy, server bundle, and Registry control executable. Prettier could not infer an Astro parser in the repository's current toolchain, so no formatting-success claim is made for that command.

The real existing development server at `http://127.0.0.1:4325/zh-cn/` was reloaded and inspected in an isolated in-app browser. Its primary action reported `下载 Windows · x64 · EXE · 0.0.53-beta`; `href` targeted the immutable `v0.0.53-beta` EXE; and `download` plus `title` both named `OpenCorvus_0.0.53-beta_x64-setup.exe`. The expanded menu visibly showed the same version and exact file names across every platform. Two screenshots were manually reviewed after animation settlement; layout, scrolling, selected-asset highlight, and label width were acceptable. Browser error/warning logs were empty. No UI automation test was added, modified, retained for this repair, or run.

The first independent review found the missing EXE-versus-MSI label described above. After repair and complete revalidation, the second independent review reported no unresolved P0/P1/P2/P3 finding. The task changes are ready for a scoped commit. Automatic push/deployment cannot safely include the current branch's pre-existing unrelated outgoing video commits; that remote boundary remains pending rather than mixing them into this website repair.
