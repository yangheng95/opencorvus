# Homepage Harness gallery and README alignment

## Recall

### User request

- Move the public homepage closer to the `OpenCorvus Harness` idea as a memorable product cue without letting the term overtake the existing product story.
- Add a first-viewport gallery that shows the current OpenCorvus user interface and representative interactions using screenshots captured during this task.
- Keep numerous screenshots compact or organized by tabs, preserve the current visual language, and leave a coherent future path for video cases without rendering an empty video section today.
- Update the GitHub README at the same time.

### Acceptance indicators

- The English and Simplified Chinese hero preserve the current Workbench, Expert Squad, Task, and Mission journey while introducing one concise, factual definition of the OpenCorvus Harness.
- A real, keyboard-operable gallery is visible in the first desktop viewport. It uses task-owned screenshots of current-source OpenCorvus surfaces and makes the selected panel and its interaction meaning clear.
- The gallery fits the current paper, ink, cobalt, border, mono-label, and editorial-grid language; it does not become a separate theme or a decorative screenshot wall.
- A future video case can enter through the same tabbed gallery and caption pattern without a second section or current empty placeholder. No video claim or inactive video control is shown before a real case exists.
- Root `README.md` and `README.zh-CN.md` use reciprocal Harness positioning and show the same current product evidence without replacing their repository/runtime documentation role.
- English and Simplified Chinese desktop pages build, render, switch gallery panels, retain the first-viewport hierarchy, and pass human visual review from fresh screenshots.

### Hard constraints

- Preserve the unrelated storage and workspace changes already present in the shared working tree.
- Do not add, modify, update, or run User Interface (UI) automation tests, Document Object Model assertions, snapshots, browser fixtures, screenshot baselines, or pixel-difference checks. UI acceptance uses one-time real-page interaction, screenshots, and human inspection.
- Do not operate, refresh, stop, or reuse a user-owned OpenCorvus process or window. Capture product and website evidence from isolated loopback services owned by this task.
- Keep the existing Astro and public-site style sources as the sole website implementation; do not add a parallel landing route, theme, gallery library, or screenshot data source.
- Keep all Large Language Model (LLM) interactions streaming and do not alter runtime behavior, capability routing, permissions, or the Harness contract as part of this messaging and media task.
- If implementation changes files, complete focused validation, independent read-only review, a scoped Git commit, and the repository's safe push procedure.

### Materials read and searches performed

- Root `AGENTS.md`, repository status, root and web `package.json`, root bilingual READMEs, and the web package README.
- `specs/current/architecture/public-website.md`, the public website iterative-design program, README/homepage alignment record, Agent-host website record, public navigation record, and the root/monthly spec indexes.
- `packages/web/src/components/Lander.astro`, the bilingual `landing.ts` source, `public-site.css`, public layout/header components, current landing assets, and recent landing/README history.
- `packages/opencorvus/src/work/harness.ts`, `capability/harness-projection.ts`, the conversation capability route and assignment references, and the current extension architecture Harness references.
- Whole-repository searches for `Harness`, homepage/gallery/media code, existing screenshots, public routes, UI-test restrictions, local Overlay startup, and historical screenshot acceptance.
- Browser control and local-web/screenshot guidance. No `.openai/hosting.json` exists, so Sites hosting is outside this task.

### Independent agent feedback

- None before implementation. After implementation, an uninvolved read-only reviewer found that inactive hover and selected gallery tabs shared the same cobalt treatment, and reminded delivery to force-add the ignored spec/evidence paths. The hover treatment was separated, the Mission state was recaptured and visually rechecked, and the exact ignored files are included in the scoped staging plan.

## Problem and impact analysis

### Observable phenomenon

- The current hero explains the Workbench-to-Mission concept with a generated concept map and optional animation, while the first real application screenshots appear much later in the Expert Squad and Mission sections.
- A first-time visitor can understand the conceptual journey but cannot immediately see what operating OpenCorvus looks like or how its distinct Code, Work, Mission, and capability surfaces relate.
- The current homepage and READMEs do not name the shared Harness layer even though the runtime already binds each conversation, Mission, scheduler, and worker to an exact context and capability projection.

### Direct trigger

- `Lander.astro` gives the right half of the first viewport exclusively to the concept-flow figure.
- `landing.ts` has no media-gallery or Harness copy model. The root READMEs therefore align to Workbench and Mission language but have no compact name for the visible operating layer between configured context/capabilities and execution evidence.

### Data and control-flow root cause

- Product evidence is modeled as section-specific imported images rather than one hero-level media collection, so the landing page has no current primitive for selecting among several real UI states.
- The runtime's Harness identity is a real but implementation-facing contract: `HarnessContext` covers conversation, Mission, Task scheduler, and Task agent owners; `HarnessProjection` binds exact tool, Skill, Mission Skill, MCP server/tool/prompt/resource references and an owner revision. The public copy has never projected that contract into one restrained user-facing definition.

### Why the old path does not resolve it

- Animating the concept map adds sequence but still does not expose the product surface or interaction model.
- The lower Expert Squad image stack and Mission continuity image prove isolated later sections; moving them upward would omit Code and Work and would weaken their current section-specific narrative.
- Merely changing the tagline to `Agent Harness` would create a slogan without visible evidence and would let architecture terminology displace the user journey.

### Impact surface

- Definitions and content: `packages/web/src/content/landing.ts` and both root READMEs.
- Rendering and interaction: `packages/web/src/components/Lander.astro` and the existing public-site style cascade.
- Evidence: new current-source screenshots imported by the landing page and referenced by the READMEs, plus final bilingual homepage acceptance screenshots in `specs/artifacts/`.
- Documentation: this record and the root/monthly spec indexes.
- Excluded after search: runtime Harness schemas/prompts, Overlay product behavior, public routes/navigation, Registry/database serving, download/release logic, and UI automation tests.

## Bounded implementation plan

1. Start an isolated current-source OpenCorvus backend and Overlay on unused loopback ports with a disposable home and project. Use the real page to capture a compact set of materially different Code, Work, Mission, and capability/Expert Squad states; inspect each image before accepting it.
2. Replace the hero concept-only figure with one reusable bilingual product-media gallery. Its tabs select one current screenshot and explanatory caption, expose native tab semantics and keyboard selection, and use the existing cobalt/ink/paper vocabulary. Keep one ordered gallery and caption pattern that can accept a real video case later; do not render any absent video item or placeholder today.
3. Add one small `OpenCorvus Harness` marker and one plain-language definition near the hero evidence boundary. Keep the existing title, primary calls to action, Workbench positioning, lower section order, and conceptual journey intact.
4. Update both root READMEs with reciprocal Harness positioning and a compact product-surface image group sourced from the exact gallery assets. Preserve installation, API, Agent host, platform, limitation, acknowledgement, and license material.
5. Run focused formatting, web type/check/build, documentation, and difference checks. Start an isolated real website, switch every gallery tab in English and Simplified Chinese, capture key desktop screenshots, open those screenshots at full resolution, and repair visual defects found by human inspection.
6. Ask an uninvolved agent to review the entire diff, screenshot provenance and legibility, interaction evidence, bilingual parity, verification results, documentation, and regression risks read-only. Resolve every valid finding and repeat affected acceptance and review until none remain.
7. Stage only task-owned paths, create one scoped commit, inspect the complete upstream-to-HEAD set, push normally if safe, and record exact delivery evidence.

## Non-goals

- No rebrand that makes `Harness` the hero title or replaces Agent Workbench, Expert Squad, Task, or Mission.
- No runtime Harness, permission, capability, provider, model, Task, Mission, Overlay, API, Registry, hosting, deployment, release, or navigation change.
- No autoplay carousel, remote media dependency, decorative device mockup, current video placeholder, synthetic product screenshot, or claim that a screenshot proves backend completion.
- No mobile-first expansion beyond ensuring the existing responsive collapse remains usable; desktop first-viewport acceptance is the requested delivery target.

## Implementation and verification

- Captured four distinct current-source product states from a task-owned OpenCorvus backend and Overlay on isolated loopback ports: Work, Code, Mission composer, and Expert Squad Market. Each source image is a 1280×720 PNG stored under `packages/web/src/assets/lander/harness-gallery/`; two weaker duplicate candidates were discarded before integration.
- Replaced the hero concept animation with a four-tab bilingual gallery. The implementation uses native `tablist`, `tab`, and `tabpanel` relationships, keeps one selected tab in the keyboard sequence, and supports click, Left/Right arrow, Home, and End selection without adding a gallery dependency or parallel state source.
- Added one subordinate Harness definition between the primary actions and the existing authority boundary. The hero title, Workbench call to action, Expert Squad journey, Mission story, lower section order, and product vocabulary remain primary.
- Added reciprocal Harness definitions and a compact two-image product evidence table to `README.md` and `README.zh-CN.md`, both sourced from the same checked-in gallery images used by the website.
- Focused static verification passed: `bun run --cwd packages/web check` completed with zero errors and zero warnings (19 existing hints), `bun run --cwd packages/web build` completed and packaged the website runtime, `bun run docs:check` reported `docs:check ok (338 ops, 25 groups)`, and `git diff --check` passed. An initial build runner ended at its 60-second wrapper limit and broke its output pipe; the same build was rerun with a 240-second limit and completed successfully.
- Real-page acceptance used the freshly built static site at `http://127.0.0.1:4338/` with a 1440×900 viewport. All four English tabs and all four Simplified Chinese tabs were selected; ArrowRight advanced Code to Mission, and native selected/focus state followed the active tab. Fresh screenshots were opened and visually inspected at `specs/artifacts/2026-08-13-homepage-harness-gallery-en.png`, `specs/artifacts/2026-08-13-homepage-harness-gallery-en-mission.png`, and `specs/artifacts/2026-08-13-homepage-harness-gallery-zh-cn.png`.
- Human visual review confirmed that the complete title, description, primary actions, restrained Harness marker, authority boundary, gallery tabs, current screenshot, and explanatory caption remain legible in the first desktop viewport in both locales. The cobalt selection, ink gallery frame, paper background, mono labels, squared borders, and editorial grid remain consistent with the existing public-site language. No video placeholder or unsupported video claim is rendered.
- Independent post-implementation review found two actionable items: distinguish inactive hover from selected tabs, and force-add the ignored spec/evidence paths. The hover now uses a quieter ink-blue while selected retains cobalt; the English Mission state was recaptured after the fix. A final read-only re-review confirmed the visual finding closed, the evidence record accurate, and no new unresolved findings. The exact ignored files are force-added during scoped staging.
