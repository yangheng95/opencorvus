# Sparse candlestick visibility repair

## Recall

- User request: the published K-line chart is empty.
- Acceptance:
  - a persisted `candlestick@1` Artifact with valid Open, High, Low, Close and Volume (OHLCV) data becomes visibly charted on its first live render, including when its container first acquires a non-zero size after mount;
  - a one-point daily candle remains recognizably candle-sized instead of being stretched into a large solid block;
  - subsequent container resizes do not reset a user's time-scale interaction;
  - the persisted Artifact schema, publication tool, message ownership, hydration route and other Interactive Artifact renderers remain unchanged;
  - focused package checks, a real-page screenshot and an uninvolved read-only review complete with no unresolved finding.
- Hard constraints: preserve the persisted Artifact as the only renderer-content source; do not mutate the supplied runtime database; do not synthesize messages or chart data; unavailable market data remains unknown; add or run no User Interface (UI) automation; do not restart or close the user's running application; preserve all unrelated working-tree changes.
- Read material: `AGENTS.md`; `specs/current/architecture/02-data.md`; `specs/current/architecture/README.md`; `specs/records/2026-08/2026-08-15-task-root-compaction-and-artifact-causality-convergence.md`; `packages/opencorvus/src/interactive-artifact/{schema,persist}.ts`; `packages/opencorvus/src/tool/publish-interactive-artifact.ts`; `packages/opencorvus/src/server/routes/interactive-artifact.ts`; `packages/overlay/src/components/{CardParts,InteractiveArtifactPart}.tsx`; `packages/overlay/src/components/interactive-artifact/{ArtifactFrame,CandlestickArtifact}.tsx`; `packages/overlay/src/services/interactive-artifact.ts`; Lightweight Charts 5.2.0 local type declarations.
- Whole-repository search:
  - `candlestick@1` has one strict schema, one persistence writer, one read route and one Overlay renderer;
  - `InteractiveArtifactPart` loads the exact message-owned Artifact and dispatches it directly to `CandlestickArtifact`;
  - `CandlestickArtifact` creates its chart from the container's mount-time dimensions, immediately calls `fitContent()`, then resizes the chart through `ResizeObserver` without fitting a deferred first non-zero layout;
  - no other production K-line renderer or compatibility path exists;
  - the current chart-library contract exposes `maxBarSpacing` as the supported upper bound on bar spacing.
- Starting workspace: `git status --short` contained extensive pre-existing changes in Task control, Overlay application plumbing, generated SDK/API material and Evolution Lab files. None touches `CandlestickArtifact.tsx` or this record. This task will stage only its exact files.
- Independent agent feedback: none before implementation. An uninvolved read-only review is mandatory after first verification.

## Observed facts and diagnosis

The supplied debug bundle and a read-only call to the same live Session establish that publication did not persist an empty payload. Tool Part `prt_g0VSZ8aNt00ERwUhY7PD` completed with Artifact `art_g0VSZ8arB00eun4d98Su`; the owned `candlestick@1` payload contains one point at `2026-08-17T00:00:00Z` with open `226.02`, high `227.17`, low `225.03`, close `226.70` and volume `19,733,466`. The persisted raw Message also contains the matching `interactive-artifact` Part. The Session conversation projection contains all seven Messages and the exact Artifact Tool outcome.

The bundle's rendered snapshot is non-atomic and reports only two rendered Messages and zero Tools while the persisted and compiled conversation report seven Messages and five completed Tools. That snapshot contradiction proves only that the capture did not represent the same complete render state; it is not evidence that missing values were zero.

Opening the same Session in a fresh real page loads the Artifact successfully. The candlestick container is ready at approximately `587 x 360` CSS pixels, its canvases are populated and the console has no warning or error. The screenshot shows the one candle, but `fitContent()` expands it to roughly two hundred pixels in width, so it reads as a broad green rectangle rather than a conventional candle. The original first-live-render pixel state is unavailable and remains unknown; the fact that a fresh hydration renders while the user observed an empty chart is consistent with the mount-time sizing race in the renderer but does not retroactively prove the original container width.

The direct control-flow defect is nevertheless concrete: content fitting occurs before the `ResizeObserver` can provide the first usable dimensions, and the resize callback only changes width/height. If the live-inserted container is initially width zero, its only fit is calculated against that unusable viewport and is never repaired when layout becomes visible. Independently, an unconstrained `fitContent()` gives a sparse one-point series excessive bar spacing. Both behaviors originate in the same time-scale viewport owner.

Root-cause confidence is high for the renderer's incomplete first-sized-layout contract and certain for the sparse-bar overexpansion visible in the real screenshot. Persistence, schema validation, route scope, message projection, market-data values and other renderer families are excluded by direct evidence and remain unchanged.

## Canonical repair

1. Give the candlestick time scale a finite `maxBarSpacing`, using the chart library's existing option rather than custom candle drawing or payload rewriting.
2. Defer the initial content fit until the `ResizeObserver` reports the first positive content size, after all series data has already been installed.
3. Mark that initial fit complete inside the same callback. Later resize callbacks update dimensions without fitting again, preserving user navigation.
4. Keep the existing exact payload mapping, volume series, theme observation and cleanup lifecycle.

## Verification plan

- Run the Overlay TypeScript check and production Vite build. Do not run or add UI automation tests.
- Serve the built Overlay through an isolated development-mode OpenCorvus process on a non-user port and open the real `/ui` page.
- Reuse the supplied valid one-point payload through a disposable project/session or a repository-native page fixture only if the isolated process cannot read the original scoped Session; inspect the rendered page and capture a screenshot. Do not mutate the supplied runtime database.
- Confirm visually that a sparse candle is visible and conventionally narrow, the OHLC price range and volume are present, and no console error is emitted.
- Commission an uninvolved read-only agent to inspect the complete task diff, checks, visual evidence, documentation and regression risks. Resolve every valid finding and repeat review after any repair.

## Verification status and blocker

- Overlay `bun run typecheck`: passed.
- Overlay `bun run build:vite`: passed after transforming 7,110 modules; only the existing third-party module-directive and chunk-size warnings were emitted.
- Root `bun run docs:check`: passed with 332 operations and 25 groups.
- Task-scoped `git diff --check`: passed.
- Before the repair, the same persisted Session was opened at `http://127.0.0.1:7878/ui/` in an isolated in-app browser tab. The real page showed a ready `586.5 x 360` candlestick container with seven canvases and no console warnings or errors. Manual screenshot review confirmed one oversized green candle/volume block rather than an empty persisted payload.
- After the production build, the in-app browser's URL policy rejected reload and every subsequent read of that local tab. Its policy explicitly prohibits retrying through indirect execution, raw browser commands or another browser surface. No post-change screenshot was therefore obtained, and the UI acceptance requirement remains unmet rather than being replaced by typecheck or build evidence.
- First independent read-only review found no code, chart-library API, first-size lifecycle, cleanup or user-navigation defect in the change. It identified the missing post-change screenshot as release-blocking, required this record to match the actual one-callback implementation, and noted that this ignored record must be force-staged with its two tracked indexes to avoid a broken link.
- Required unblock: obtain a real screenshot through a URL-policy-permitted browser session that is demonstrably serving this rebuilt Overlay UI. The existing `7878` process froze its index/asset closure before this build, so reloading that process alone cannot prove the new code; using a newly started isolated service or a rebuilt application is required, and restarting the user's process requires explicit authorization. Until then, this repair must not be described as fully visually accepted.
