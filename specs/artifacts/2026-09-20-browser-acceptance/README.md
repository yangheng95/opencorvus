# Browser MCP interaction and screenshot delivery evidence

Manual review on 2026-09-20, against a read-only served copy of the case's built game.
The Browser Model Context Protocol (MCP) server was compiled from the current source
and launched with an isolated Chrome profile, 1440 × 1000 viewport. No user browser,
running OpenCorvus case or game source was modified.

Observed actions: navigate to the local `/ui`, click the start control, click the
zone-entry control, then press Escape. Screenshots were displayed and inspected
after each action. The fishing controls and paused state were visibly distinct.
The static review server had a favicon 404; it was not counted as a functional pass.

All four resulting PNGs then passed through the real Preview persistence,
TaskArtifact publication, `materializeBrowserPreviewCaptureResult` and AttachmentStore
readback owners with an active per-directory watcher. Task ingress was an isolated
backend fixture, not a new LLM-driven Mission. Every attachment readback equaled its
source bytes. The fixture was removed after retaining the returned bytes below;
its recorded attachment URLs and Engine locators are historical receipts, not live links.

- [Home](01-home.png)
- [Zone selection](02-playing.png)
- [Fishing](03-fishing.png)
- [Paused](04-paused.png)
- [Exact publication/readback metadata](publication-review.json)

This proves real browser interactions and the repaired screenshot byte-delivery
path. It does not claim full game PRD acceptance, region-comparison visual parity,
or autonomous end-to-end Mission completion.
