# Expert Squad Bounded Catalog and Context

## Outcome

Replace the shared eager Expert Squad catalog with four explicit projections:
a compact paged index for retrieval and display, an exact paged planning
inspection, an exact full Settings detail, and the exact active runtime
projection. Installed package count must not determine model-visible output or
the size of one list response.

## Recall

### User request

- Verify whether the current Expert Squad declarations are correct and whether
  installing many Squads can exhaust model context.
- Add a separate compact information layer for retrieval and display.
- Investigate and complete the full impact surface without piecemeal follow-up.
- Use independent Agents to audit the result.
- The exact target is `D:\myhexin-local\opencorvus-v0.0.35beta`; evidence and
  edits made against `D:\myhexin-local\opencorvus` are invalid for this task.

### Current facts

- The runtime embeds four selectable packages: `base`, `advanced`,
  `research-studio`, and `squad-sdk`.
- The generated Market payload now contains fifteen source packages. Together
  with the separately embedded `squad-sdk` directory, the source tree contains
  sixteen package directories; adding the three internal embedded packages
  yields nineteen authored definitions. Market availability, source authorship,
  physical installation and the effective catalog remain distinct counts.
- This project currently has one project installation,
  `machine-learning-implementation`. The runtime user-global root is
  `Global.Path.config` under `%LOCALAPPDATA%`, where `deep-research` and
  `equity-research` are installed. With the four embedded packages, the current
  effective project catalog therefore has seven Squads before accounting for
  discovery errors. The unrelated legacy `~/.config/opencorvus` tree is not a
  current runtime source and is excluded from the count.
- `ExpertSquadCatalogSchema` and `ExpertSquadSettingsSurfaceSchema` currently
  return arrays of full `ExpertSquadCatalogSummary` objects. Each summary includes
  README, selector instructions and the complete capability projection.
- Mission calls `panel.expert_squad_catalog`, serializes every visible
  recommendation including every workflow summary, persists the tool result,
  and replays it with the Session transcript.
- Registry discovery loads complete catalog packages; Resolver reloads the
  effective and installation lists, so cost scales with installed package trees
  even when the caller only needs identity and display metadata.

### Acceptance criteria

1. Every list/search response is capped at twenty compact entries and carries a
   revision- and query-bound cursor. A first search may scan compact declarations;
   later pages reuse the ranked sequence.
2. Compact entries contain only bounded identity, display, description, product
   pillars, system role and physical source. README bodies, selector instructions,
   workflow text, Agents, Skills, tools, Model Context Protocol resources,
   libraries, assets, absolute paths and package digests are excluded.
3. Exact planning inspection returns selector guidance and at most twenty bounded
   workflow summaries for one selected Squad. Exact Settings detail loads one
   selected package and may return the full declaration.
4. Mission uses bounded capability search and exact inspection. It never receives
   or records the complete held catalog, and abnormal errors expose counts and a
   digest instead of enumerating held IDs.
5. The immutable Mission-held set and central Task creation use the same Host
   authority. Explicit empty restrictions stay empty; later installs do not
   expand a Mission.
6. A Task and every child Session continue to resolve the exact package revision
   fixed at Task creation across catalog, Skill matrix and configuration writes.
7. Settings, Composer, Mission creation, mention search, global references,
   diagnostics and Market use bounded retrieval. Active or selected entries
   outside the first page remain exactly retrievable.
8. Registry reads each external manifest once per cached inventory generation.
   Full tree reads and digests occur only for an exact detail, collision proof or
   active runtime package.
9. Market filtering happens before pagination and exact Market detail loads only
   the selected source and selected installed identities.
10. Positive non-User-Interface contract tests cover 100 installations, query
    cursor isolation, 100 workflows, paged diagnostics, exact detail, Mission
    output, authority and pinned revisions. No User Interface automation test is
    added, modified or run.
11. The real Overlay is inspected through Settings, Composer/Mission selection
    and Market with screenshots and manual visual review.
12. Independent read-only Agents review authority, context surfaces and scale;
    all valid findings are fixed and the final diff is reviewed again before a
    scoped commit.

### Hard constraints

- `expert-squad.jsonc` remains the only declaration source. Do not add a second
  persisted index, compatibility payload, hidden message, count gate, keyword
  router or workflow state machine.
- Search is retrieval only; the Large Language Model still selects ownership.
- Preserve project-over-global precedence, corrupt-project reservation and the
  single `prompt_profile.active` source.
- Preserve the untracked user file
  `expert-squads/builtin/equity-research/report.md`.
- Follow the repository's generated OpenAPI, JavaScript Software Development Kit,
  documentation, real-page visual review, independent review, commit and safe
  push contracts.

### Sources read

- Root `AGENTS.md`.
- `specs/current/architecture/04-extensions.md` and `07-panel.md`.
- `specs/records/2026-08/2026-08-02-mission-planning-prompt-rearchitecture.md`.
- Expert Squad Registry, catalog schemas, Resolver, Manager, Panel tool, Mission
  session/routes, capability catalog/search, Task package binding, Skill mounts,
  Settings/global routes, Overlay services/components and focused tests.

### Repository-wide searches performed

- All Expert Squad catalog/recommendation/settings/Market producers and consumers.
- All Mission visible-Squad, launch/resume, `panel.create_task`, package revision,
  Skill projection and config-overlay authority paths.
- Tool-result persistence/replay, Composer/Mission/mention/global Settings list
  consumers, Registry discovery and full-package load paths.
- Embedded source, generated Market payload, project installation and the exact
  `Global.Path.config` user-global installation identities.

### Independent Agent feedback

Three independent read-only audits ran against the corrected target without
modifying files or delegating further. They found and drove closure of: Mission
held-set and Task-creation authority, Task-pinned catalog and Skill projection,
canonical project-directory authority, Registry declaration/full-load
duplication, unbounded persisted Mission catalog output, Settings/Composer/Market
pagination, selected/active exact retrieval, bounded diagnostic and Market
fields, exact-detail I/O, cursor declaration revision, deterministic physical
scope ordering, and missing scale/authority regression tests. Their final pass
was rerun after the last implementation changes; all reported runtime,
authority, context-surface, cache and scale findings were closed, with the
final verification evidence recorded below.

## Root-cause boundary

The current catalog summary is doing four incompatible jobs at once: enumeration,
search/display, planning guidance and full Settings detail. Because every caller
starts from that rich object, installation count multiplies package I/O, network
payload, client memory and persisted model context. Response filtering after the
rich catalog is built cannot fix the root cause.

The replacement must derive a compact declaration index from the manifest,
page it at the server boundary, and load rich data only for one exact identity.
Host-held Mission IDs and Task-bound package revisions remain authority facts;
they must not be reconstructed from or disclosed through a bulk model catalog.

## Implementation plan

1. Add bounded index, search page, exact inspection, inventory status,
   diagnostics page, exact Settings detail, Market page and Market detail schemas.
2. Split Registry manifest declaration discovery from exact full-package loading;
   reuse one bounded, generation-invalidated inventory cache.
3. Refactor Resolver search, inspection, detail and active projection so list
   callers never construct rich summaries.
4. Replace Mission bulk Panel catalog with held-filtered capability search plus
   exact planning inspection; close central Task and resume authority.
5. Project Task-pinned revisions through Session catalog, Skill matrix, Skill
   overrides and overlay validation using one authority resolver.
6. Replace eager Settings, Composer, Mission, mention, global-reference and Market
   consumers with bounded server retrieval and selected-only detail.
7. Regenerate public contracts and update current architecture and documentation
   indexes.
8. Run focused positive tests, typechecks, route/document checks and scale
   evidence; then perform real-page screenshot review.
9. Request final independent read-only review, fix every valid finding, rerun
   affected acceptance, commit only owned files and evaluate the safe-push set.

## Evidence log

- Current runtime inventory: four embedded packages, two user-global external
  installations and one project external installation, for seven effective
  selectable Squads. The bundled Market contains fifteen installable payloads;
  external physical installations remain three.
- `catalog-index.test.ts`: twelve positive contracts cover one bounded index,
  exact full detail, selected-only installed loading, 100 manifest declarations,
  100 held Mission capability search, query-isolated paging, 100 workflows,
  declaration-revision invalidation, 45 diagnostics, two-page Market retrieval,
  deterministic project/global Market ordering, routes and corrupt project
  reservation. Final focused run: 12 passed, 0 failed, 67 assertions.
- Final combined backend authority and bounded-catalog run: twenty-four tests
  passed with 135 assertions, covering held-only
  capability discovery, canonical subdirectory worktree, typed resume mismatch,
  central held/unheld/missing-profile Task creation and exact Task package
  revision projection through catalog, Skill matrix and Skill override.
- Overlay bounded Composer/Market service contracts passed (two tests, five
  assertions) after exact active/selected merge, exact page-external Market
  reconciliation and handled server-search failure were added.
- JavaScript Software Development Kit generation completed after the bounded
  route schemas changed. Generated `inspect` and `settingsDetail` requests now
  carry their exact `id`, scope, namespace and workflow cursor parameters.
- `capability_search` input is bounded as well as its output: query strings,
  owner references, kind arrays and expected catalog revisions all have explicit
  schema limits before a tool call can enter durable history.
- Final OpenCorvus backend, Overlay and JavaScript SDK typechecks passed;
  `api:routes-check`, `docs:check`, `version:check` and Git whitespace diff check
  passed. The final context-surface Agent rerun found no remaining P0, P1 or P2.
- Visual review used the actual `0.0.38-beta` main frontend and a live backend.
  It confirmed the `v0.0.38beta` footer, `Mission Board`, Settings navigation,
  the installed-package settings and Squad Market layouts. An initially reused port 5173
  was proven to serve a different checkout's `0.0.35beta` frontend and was
  discarded; the accepted review used a dedicated target-tree Vite server whose
  transformed `main.tsx` contained the bounded catalog implementation.
