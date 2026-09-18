# Long-running, complex-task product story

## Recall

- User request: “现在的 github readme 和网站的宣传物料性价比极低，我授权你推翻重做，从用户的痛点出发，长程/复杂/重型任务调度”. The preceding request reconstructed a real tank-game delivery and its two revision loops.
- Acceptance: replace both language READMEs and both homepage locales with a coherent pain-first story; explain coordination across research, implementation, handoff, independent review and repair; show a traceable case; preserve usable download/docs/catalog routes; deliver reusable promotional imagery; visually inspect real desktop pages and interactions; build/check documentation, independently review, commit and push the authorized current branch.
- Constraints: no fabricated speedup, cost savings, parallelism or success statistics; no claim of exact original-game fidelity; a configured model and online runtime are prerequisites. No UI automated tests. No changes to the running user's app or unrelated `script/video/`. No new branch/worktree. Website production deployment is a separate publication boundary.
- Read: root AGENTS, both READMEs, web package/scripts/layout/header/footer/landing/copy/composition components, current public-website architecture, task-control-plane and long-horizon docs, founder-operations history, local tank-game Mission/decision/trace records in the user-supplied project.
- Searches: landing-copy consumers, homepage components and route definitions, build/download manifest contracts, public media, current architecture and monthly history. Public site is existing Astro, not a Sites project; app `/ui` does not host this website, so isolated Astro development mode is appropriate.
- Independent agent feedback: 无（implementation has not started; delivery review follows verification）。

## Diagnosis and impact before editing

- Observable problem: README has over 500 lines, with runtime internals before installation. Homepage stacks an animated terminal, illustrative video, benchmark, long-horizon cards, composition cases, research paper, evolution/comparison and further CTAs. The reader must infer practical value from mechanisms and inventory.
- Trigger: the user explicitly rejects the current value-to-attention ratio and authorizes a full presentation replacement.
- Root cause: information architecture mixes an adoption page, runtime reference and research catalog. Repeated copy and conceptual cases compete with a demonstrated delivery. Earlier first-result edits added sections without removing this competition.
- Data/control flow: local bilingual `landing-copy.ts` feeds `OcLanding`; composition documentation also consumes its compose labels. Keep composition labels once with their documentation consumer when removing homepage-only copy/components. Existing manifest owns release URLs; use it directly, no hand-written installer versions.
- Public contracts: keep `/`, `/zh-cn/`, download, catalog, documentation, locale/theme controls and research PDF reachable. No runtime, scheduling, protocol, provider or API changes are planned. No scheduling anomaly investigation is in scope; a historical test-report discrepancy is an evidence limitation, not a newly diagnosed scheduler defect.
- Evidence: task decision log decomposes REQ-1..19; Mission notes record two repairs; trace names research, requirements, architecture, workload, design, implementation, test and integrity-review roles. A saved Vitest report says 241/242 while the closing narrative says 242/242. Do not advertise a pass count. Diagram shows collaboration, not measured simultaneous execution or speedup.
- Delivery risks: stale anchors after section removal, dead homepage-only modules, theme legibility, diagram density, language overflow, inflated claims, and private identifiers in case material. Preserve credits/license/contribution access. Record only sanitized case excerpts with digests, no credentials or raw prompts/trace payloads.
- Existing tests: searched web test inventory; no homepage UI test file was found. Do not run page assertion scripts as visual acceptance. Existing service/API tests are outside this presentation-only change.

## Implementation plan

1. Establish one bilingual homepage story: stop managing every handoff; long/complex/heavy work, a visible coordination map, pain-to-outcome explanations, real tank-game case with repair loops, practical starting instructions and boundaries.
2. Replace the verbose README introductions with concise positioning, workflow image, evidence-backed case, installation and docs. Keep attribution and licensing.
3. Replace homepage-specific components and dead promotional paths; retain reusable documentation composition and paper assets, release-manifest authority and shared layout.
4. Add sanitized case source/evidence and bilingual reusable diagram/share assets under the established artifact/public-media paths. Update spec indexes and relevant architecture/package notes.
5. Run website check/build, declared docs checks; open isolated localhost pages, inspect screenshots in English/Chinese and themes, exercise diagram, locale, navigation/download disclosures. No UI tests or assertions.
6. Independent read-only review of full diff/evidence; fix valid findings and re-review. Commit, fetch/merge upstream, inspect all outgoing commits, push if authorized-set requirements hold. Do not deploy production implicitly.

## Verification and delivery

- Implemented bilingual pain-first homepages, concise READMEs, native expandable workflow map,
  manifest-bound download component, a real case and source excerpts, editable bilingual SVGs and a new social card.
- Retired homepage-only shader/video/benchmark/large composition/paper components and the unused
  featured-squad generator projection. Historical referenced media and composition documentation remain available.
- Initial website build passed. `docs:check` passed (339 operations, 25 groups). Focused non-UI
  composition/download-manifest tests passed (3 tests, 90 assertions).
- The first Astro check picked up untracked `tmp/measure.ts`, an obsolete one-off copy counter.
  Scoped `tmp/` out of the web compiler; preserved the local file. Rerun: 80 files, 0 errors,
  0 warnings, 21 pre-existing hints. This is a presentation tooling boundary, not a runtime migration.
- Real browser observation exposed a Node-started Astro error overlay on the existing `bun:sqlite`
  endpoint. Root cause: `dev`/`start` used Astro's Node shebang although the Registry runtime is Bun.
  Changed those existing script entries to `bun --bun astro dev`; the same routes now render and
  the view-count endpoint returns data. No production runtime or user app was restarted.
- The preview manifest was v0.0.53-beta. Anonymous GitHub API access was rate-limited; synced the
  canonical already-published website `/downloads/latest.json` (18 assets, v0.1.2-beta) instead.
  No new release was created or inferred from the in-progress v0.1.3 source version. Production
  deployment retains its existing GitHub-release manifest generator.
- Browser: isolated localhost:4397; actual 1280x720 desktop. Checked Chinese/English, light/dark,
  stage expansion with exclusive collapse, download menu, Escape, case anchor/detail, start anchor,
  and Advanced squad navigation. Corrected the dropdown to open upward after its lower placement
  clipped the first viewport. Saved viewport screenshots under the artifact bundle. Full-page
  stitching in the browser capture duplicated sections, so that defective capture was discarded;
  no image editing or screenshot comparison was used.
- Viewed both SVG diagram renders and generated social PNG. Post-correction Astro check passed (80 files, 0 errors); independent re-review found no unresolved findings. Production publication has not been performed.


### Independent review and correction

The read-only reviewer inspected the full related diff, new files, evidence and eight page screenshots.
One P2 finding: the extracted download control inherited an event-bubbling defect. When architecture
could not be identified, the primary click opened the disclosure but the document outside-click
handler immediately closed it because the primary sits outside the details element. Corrected the
outside boundary to the whole download control. Known-platform menu interactions are rechecked in
the real browser; no unknown-platform browser or simulated UI fixture is claimed.

The review found no other blocking issue. New ignored specs/evidence must be force-added by exact
path. The unrelated v0.1.3 release record and script/video remain excluded. Push to main triggers
website production deployment by deploy-opencorvus-com.yml; that publication needs explicit approval
after the reviewed version is concrete. Only current-branch push is automatic for this task.


### Final review status

- Read-only second review: no unresolved findings; corrected download event boundary accepted.
- Download regression: real menu opening, outside click, Enter and Escape all observed; the new
  dark-theme menu capture is `zh-download-reviewed.png`. No unknown-platform browser claim.
- Canonical `bun run --cwd packages/web dev --host 127.0.0.1 --port 4397` launched successfully
  under Bun (task-owned process); the Registry-backed Advanced page rendered through it.
- Final Astro check: 80 files, 0 errors, 0 warnings, 21 existing hints. Documentation and architecture
  indexes pass. Whitespace check passes. Final website build and runtime packaging passed (119 indexed HTML pages).
- The current branch is `codex/paper-preliminary-results`; main is checked out in another worktree.
  No other worktree, running user app, release or website publication was changed by this task.
