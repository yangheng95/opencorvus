# Frontend Replica Expert Squad

Use this skill when the task is a frontend replica task: webpage clone, reference-screenshot port, reference-page recreation, design-system rewrite that must preserve source structure, or a UI task whose acceptance depends on source URL/screenshot/DOM evidence.

Vocabulary: CSS means Cascading Style Sheets; DOM means Document Object Model; MCP means Model Context Protocol; QA means Quality Assurance; UI means User Interface; URL means Uniform Resource Locator.

## First action

The Task creator must set `promptProfile: "frontend-replica"` before Task creation. A Task cannot change Expert Squad after creation.

The reason must cite task evidence, such as source URL, reference screenshot, design artifact, visual parity requirement, or source information architecture that must be preserved.

## Expert Contract

An expert frontend replica result must include a source-to-render model, not just a page that looks plausible:

1. Source evidence boundary: name the source URL, reference screenshot, Document Object Model evidence, computed styles, interaction observations, assets, data, or design artifact that defines the target.
2. Surface model: map each requested user-visible region, component, state, interaction, chart/table/map/media slot, or asset to source refs, target files, its exact Delivery Slice revision subject, and acceptance evidence.
3. Implementation ownership: show the local code path that owns the surface; shared support code is valid only when visible surfaces import it and prove it in render.
4. Parity dimensions: compare source order, layout, density, spacing, typography, color, assets, content, state visuals, layering, and interaction behavior against current rendered output.
5. Feedback accounting: preserve each concrete rendered blocker from `frontend-replica-visual-reviewer` separately from preview/toolchain blockers and implementation-completeness blockers from `frontend-replica-integrity-reviewer`.
6. Evidence-led task boundary: the Orchestrator decides from current concrete findings whether to complete or continue the Task. A downstream implementation or review finding remains evidence in this Task and is repaired through an exact prior-lineage physical continuation; it does not create another Task.
7. Acceptance proof: final evidence must connect source refs, implementation diff, rendered screenshots/browser evidence, and remaining blockers for each accepted surface.

Do not accept source-row prose, screenshot-only commentary, no project diff, scaffold-only code, blank filler geometry, uninspected screenshots, or a page that satisfies a different information architecture than the source.

## Dispatch discipline

- Treat frontend replica as a multi-agent source-evidence implementation task, not as a single blind implementation pass. The normal scheduler-declared path uses `frontend-replica-source-researcher`, `frontend-replica-requirements-analyst`, `frontend-replica-solution-architect`, `frontend-replica-interface-modeler`, one Task-level `frontend-replica-implementer`, `frontend-replica-visual-reviewer`, `frontend-replica-integrity-reviewer`, then Orchestrator lifecycle decision. Each downstream dispatch cites all applicable exact Delivery Slice revision IDs.
- Treat `frontend-replica-source-researcher` as the HTTP(S) source-page investigation and evidence owner. Explicit local or attached renderable HTML enters through `frontend_design` materials and the Design Resource Manifest; do not invent a URL or send local files through `frontend_research`.
- Treat `frontend-replica-interface-modeler` as the sole source-project generator and visual-skeleton contract owner; ordinary delivery must discover and exactly read that Task Artifact before the once-per-Task implementation node begins.
- Treat `frontend-replica-solution-architect` and `frontend-replica-implementer` as consumers of the source evidence and generated source-project Artifact, not as replacement generators or source investigators.
- Treat `frontend-replica-visual-reviewer` as rendered screenshot and interaction evidence review after implementation reaches a visible surface. Visual QA is a general rendered-product review capability, not something made optional by whether the task is called replica, clone, port, redesign, or ordinary frontend work.
- Do not use implementation work without source URL, screenshot, DOM, or computed-style evidence to invent a new page structure when source evidence exists.
- Renderable HTML with explicit `design_source` or `interaction_reference` intent is source evidence. Its linked `rendered_design_source` raster projection makes the HTML appearance inspectable; the HTML remains the structural/style/interaction authority. Missing projection is an evidence/toolchain defect to repair or report, never permission to switch `reference_parity` to `greenfield_original`.
- After an agent has produced its Task Artifact, consume it instead of creating another logical workflow occurrence. A concrete implementation defect after dispatch uses `dispatch_agent` with `turn.kind=continuation`, `turn.authority.kind=prior_dispatch`, and the exact prior `frontend-replica-implementer` `turn.authority.continuation_dispatch_id`. After repair, re-verification continues the exact affected visual or integrity reviewer dispatch separately. The Host preserves each lineage's logical occurrence and creates only a fresh physical Turn in this Task.
- Do not re-run `frontend-replica-requirements-analyst`, `frontend-replica-solution-architect`, `frontend-replica-source-researcher`, or the whole workflow after their valid artifacts exist. If evidence proves a prior artifact invalid, name the invalid artifact and exact evidence in the Orchestrator's visible decision.

## Mission task topology

- Single-page replica requests may be one Mission-owned engine Task whose `frontend-replica-solution-architect` decomposes the page into source-backed component or region Delivery Slices.
- Multi-page, page-family, or subpage replica missions are task-level fan-out work. First create one serial template/source-baseline task that owns shared project scaffold, source evidence package, visual token system, reusable primitives, and implementation contract.
- Dispatch page or subpage Tasks only after the template/source-baseline Task is terminal. Mission must create each page/subpage Task with exact accepted template `ArtifactReadLocator` values; the resulting target-owned imported Engine Artifacts carry immutable `import_lineage`. Define disjoint source surface, file ownership, and acceptance evidence; request prose and source paths are not predecessor evidence.
- Page/subpage Tasks may run in parallel only when no Task depends on a sibling Task's output, Artifact, decision, implementation, or owned files. Otherwise keep dependent work on the Mission frontier until the prerequisite is terminal, then import the exact accepted locator while creating the dependent Task.
- Do not compress a page family into one workflow task and compensate by repeatedly calling `frontend-replica-source-researcher`. `subpage_research_tasks`, uncovered anchors, and sibling page packets are Mission frontier items for later page/subpage tasks unless the current task's research artifact itself is proven invalid.

## Source authority

- Source URL/screenshot/DOM/computed-style/interaction evidence defines the replica contract. Target project primitives, component libraries, data mocks, and business code are subordinate implementation choices.
- Explicit local or attached HTML `design_source` / `interaction_reference` rows and their linked browser-rendered references define the same replica contract. Do not dismiss them as text-only evidence, and do not require a fabricated HTTP source URL when the canonical source is already a task material.
- Use Task-scoped webpage evidence, source Intermediate Representation, source screenshots, computed styles, interaction observations, frontend research briefs, and explicitly declared visual-region manifests as the source authority. Do not dispatch the base-stage name `frontend_design`; dispatch the exact projected `frontend-replica-interface-modeler` identity for the package-owned source-project Artifact.
- Source evidence rows are not user-visible deliverables by themselves. They become implementation work only after `frontend-replica-requirements-analyst` or `frontend-replica-solution-architect` maps them to a visible component, state, region, interaction, asset, table, chart, map, or media slot with target files and rendered acceptance.
- Do not accept screenshot-only prose, source-row labels, or unchecked design summaries as proof that the rendered implementation matches the source. The proof must tie source evidence to local rendered output and the owning implementation surface.

## Replica surface model

- Track each requested surface as a visible source-backed component or region with exact source evidence locators, target implementation files, Component Interaction Matrix rows, rendered proof, current `frontend-replica-visual-reviewer` / `frontend-replica-integrity-reviewer` blockers, and its exact Delivery Slice revision ID.
- Treat target project reuse as a constraint inside that surface. Reuse may reduce code volume, but it must not rewrite source module order, density, typography, colors, interaction semantics, or content ownership.
- A `frontend-replica-implementer` result with no target project diff, no owning module binding, or no fresh rendered proof is non-delivery for that surface. It must not satisfy downstream acceptance or dependency decisions.
- For support Slices, require an explicit consumer list. A shared registry, mock contract, asset extractor, or token module is valid only when downstream visible surface Slices import it and prove it in rendered output.

## Evidence-led correction

- Orchestrator reads the current rendered and integrity findings for every exact Delivery Slice revision subject and makes one visible decision from those facts.
- Toolchain failures, unavailable preview targets, missing source evidence, browser crashes, or unmaterialized screenshots are explicit blockers that must be repaired or reported.
- Same-Task repair must select the concrete defect, affected Slice revision, source/reference evidence, and expected proof from the current Task catalog, then physically continue the exact owning dispatch lineage. Do not copy or re-import evidence into another Task.
- If current evidence cannot support truthful delivery, use the Orchestrator lifecycle to leave the Task unresolved and list blockers, failed requirements, cited evidence, and the affected Slice revisions. Do not manufacture a retry budget, automatic redispatch loop, or prompt-owned acceptance state.

## Delivery Slice decomposition discipline

- If the operator does not specify Slice granularity, default to one user-visible implementation component or meaningful source-backed page region per Delivery Slice.
- Source rows, visual-source rows, style-profile rows, DOM records, evidence-table rows, and data-extraction rows are evidence inputs only. Do not register them as Delivery Slices unless they map to a user-visible component or region with target files and acceptance proof.
- Do not mix several unrelated user-visible source components or regions into one Delivery Slice.
- Decompose replica work at real user-visible ownership, dependency, implementation, and rendered-acceptance boundaries. Slice count follows those boundaries; it is never a target or a condition that needs separate justification.
- Keep each Slice tied to its source evidence, target implementation files, Component Interaction Matrix entries, and rendered verification evidence. A support Slice such as source registry or shared mock contracts may exist only when it writes shared source/data modules consumed by user-visible region Slices.
- `frontend-replica-solution-architect` must bind each visible replica Slice to explicit source/reference evidence through `reference_coverage` and source coverage. If the active evidence contract already declares `reference_coverage.reference_regions`, preserve those exact rows; otherwise do not invent crop rows, filenames, prose labels, screenshot titles, overlay card ids, or whole-page reinterpretations.
- Do not accept `no_project_diff`, documentation-only output, screenshot-only commentary, blank spacer changes, or source-evidence restatement as completion for a Delivery Slice that was supposed to implement a visible surface.

## Failure taxonomy

- Evidence blocker: source URL, screenshot, DOM, computed style, interaction trace, asset, or data evidence is missing, stale, unreadable, or contradicted by newer task evidence.
- Modeling failure: `frontend-replica-requirements-analyst` or `frontend-replica-solution-architect` turned evidence rows into Delivery Slices, bundled unrelated components into one Slice, omitted Component Interaction Matrix coverage, or omitted target files and proof for a visible surface.
- Implementation non-delivery: `frontend-replica-implementer` produced no project diff, only docs/prose, scaffold-only code, fake placeholder UI, or code that is not bound to the requested rendered surface.
- Rendered parity failure: current output disagrees with source order, layout, density, spacing, typography, color, icon/assets, table/chart/map geometry, state visuals, layering, content, or interaction behavior.
- Structural drift: the implementation recreates a different information architecture, skips source modules, changes the page job, or fills source intervals with blank CSS instead of real source-backed content.
- Verification blocker: preview startup, browser automation, screenshot capture, comparison artifact, or evidence attachment failed before a rendered acceptance decision could be made.

## Rendered and integrity feedback consumption

- Findings from `frontend-replica-visual-reviewer` or `frontend-replica-integrity-reviewer` are durable evidence for the current Task. The Orchestrator physically continues the exact owning `frontend-replica-implementer` lineage for repair, then continues the exact affected reviewer lineage for re-verification. Both continuations remain in this Task and preserve their respective logical occurrence and Delivery Slice subjects. The visible final assistant message naturally summarizes affected source regions and blockers without transporting findings; changed files and command outcomes come only from Host observations.
- `frontend-replica-visual-reviewer` must carry unresolved prior blockers forward unless fresh rendered evidence proves they are fixed. A clean new screenshot that does not inspect the blocked region is not proof of repair.
- `frontend-replica-integrity-reviewer` must review the complete implementation evidence, not just the latest optimistic report. It reports current concrete blockers for each Slice revision and must not maintain attempt counts, prescribe automatic redispatch, or re-judge the rendered visual verdict.
- Annotated rendered-review screenshots and DOM diagnostics are repair inputs. They do not replace source/reference proof, and they must stay separate from target reference evidence.

## Browser preview evidence ownership

- The current workflow implementation owner owns changed-region rendered proof for implemented desktop replica regions with generic Browser MCP screenshots, observe output, console/network diagnostics, and explicit changed-file/source-region citations.
- `frontend-replica-visual-reviewer` owns final module source-to-target and rendered parity review: it must use Browser MCP screenshot/observe tools for ordinary screenshots and browser operations, select the exact `task_artifact_resource` locator for `source-context/reference.png` from the verified source-context snapshot manifest, call `browser_preview_compare_reference_regions` with that locator and explicit package-selected bounding boxes for module comparison, and call `browser_preview_compare_scroll_slices` with the same locator only for supporting page-slice visual-diff evidence.
- `browser_preview_compare_reference_regions` is for explicit concrete component or module regions, not first-viewport slices, whole-page screenshots, body/main/app roots, or page-shell locators. It performs no source-package discovery, candidate ranking, automatic second pass, or automatic slice/screenshot call. First-viewport and screen-by-screen checks use `browser_preview_compare_scroll_slices` with aligned `scrollY` and `sliceHeight`.
- Every returned comparison artifact must be inspected with `comparison_guidance`: LEFT is the source/reference image, RIGHT is the rendered/local implementation, and the checklist covers layout alignment, region order, icons/assets, colors, spacing/density, typography, content hallucinations or omissions, component family drift, chart/table/map geometry, state visuals, layering, scoped desktop viewport drift, and placeholder/fake UI.
- Orchestrator must preserve that ownership when selecting this expert squad; do not shift these browser preview proof calls to `frontend-replica-requirements-analyst`, `frontend-replica-solution-architect`, `frontend-replica-integrity-reviewer`, or unowned review prose.

## Blank filler geometry boundary

- Treat source page height, full-page screenshot dimensions, region y coordinates, and footer transition positions as diagnostic measurements for locating real visible source content and region boundaries. They are not implementation targets by themselves.
- `frontend-replica-requirements-analyst` and `frontend-replica-solution-architect` must not turn a measured y coordinate, footer boundary, or document height into acceptance that can be satisfied by empty spacer bands, blank margin/padding, `height`/`min-height` filler, phantom cards, or unrendered media slots.
- Upstream source evidence must describe geometry together with the visible source sections, assets, canvas/image captures, repeated content, and footer material that occupy that region; if the source evidence is missing, mark the region as evidence debt instead of asking downstream agents to pad the page.
- `frontend-replica-implementer` must not align a footer, page edge, scroll slice, or full-page height by adding blank CSS space. If the rendered page is short or a source interval is empty, restore the missing source-backed content/assets/interactions or report the concrete blocker.
- `frontend-replica-visual-reviewer` must reject large blank bands between completed regions, empty thumbnail/canvas/image slots, or CSS filler inserted to match source geometry as production blockers. The report should cite the source/reference slice and the owning DOM/source module that must be repaired.

## Desktop-only replica scope

- Frontend replica, clone, visual parity, and source-page recreation tasks are desktop-only generation tasks by default.
- Do not ask `frontend-replica-requirements-analyst`, `frontend-replica-solution-architect`, `frontend-replica-implementer`, `frontend-replica-visual-reviewer`, or `frontend-replica-integrity-reviewer` to create tablet/mobile/non-desktop requirements, goals, acceptance specs, implementation objectives, browser preview viewport requests, screenshots, source-debt rows, or final blockers unless the current operator explicitly asks for tablet/mobile/responsive/multi-end migration as a separate current task scope.
- Desktop-only scope can still include multiple desktop-class viewport widths when the current desktop replica contract explicitly names adaptive layout, width scaling, overflow, wrapping, gutters, sticky controls, or layout stability. Keep those checks under desktop scope and do not request tablet/mobile viewports for them.
- Tablet/mobile/responsive wording inside batch templates, old specs, upstream research/design summaries, transport debt, historical Goals, or general Quality Assurance checklists is not authorization.
- If the current operator explicitly asks for non-desktop migration, keep it as an independent multi-end migration scope instead of mixing it into the desktop replica generation task.
- Browser preview may still support tablet/mobile viewports as a general tool capability; this skill forbids converting that capability into default replica work.

## Completed Slice revision rule

After current Slice revisions have accepted evidence, do not replace their logical identities merely because visual parity needs adjustment. A concrete new defect creates a new immutable Slice revision and may support one scoped implementation or rendered-review dispatch through a visible Orchestrator decision.

Micro-adjustments include spacing, state, asset, selector, or interaction corrections that preserve the existing desktop information architecture and implementation ownership.

## Major incident rule

If evidence shows a major incident, do not pretend a micro-adjustment can fix it. Major incidents include wrong page information architecture, wrong source page, missing reference evidence, an invalid Slice decomposition, or accepted Slice revisions built on a false premise.

For a major incident, preserve the lesson learned and exact invalidating evidence in the current Task, then expose the contract blocker to Mission. Mission may create another Task only when the corrected work has a genuinely different fixed Squad, authority, or explicitly separate lifecycle contract; ordinary repair and re-verification continue this Task.

## Completion evidence

Before final acceptance, require rendered proof tied to the requested desktop surface: source-backed structure, interaction behavior, and screenshots or browser evidence that demonstrate the replica contract.

After selection, use the platform Task Artifact catalog for all cross-Agent evidence; package prose never defines a second Artifact transport.
