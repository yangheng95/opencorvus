# Expert Squad Roadmap Checklist and Skill Completeness

## Recall

### User request

- Investigate shipped OpenCorvus Expert Squads and Expert Squads commonly associated with WorkBuddy-style work.
- Deliver a web checklist where the operator can select candidates, drag them into priority order, and explicitly declare which future package implementations may run in parallel.
- Every Expert Squad must save and project a corresponding Skill. Prefer an auditable open-source Skill; author a package-local Skill only when no suitable reusable Skill exists.
- Rework shipped Squads that do not satisfy the saved-Skill contract and perform corresponding End-to-End (E2E) acceptance.
- After reviewing the checklist direction, open ten independent implementation swimlanes and design and add all ten proposed Expert Squads in parallel.

### Current repository identity and ownership

- Authoritative checkout: `D:\myhexin-local\opencorvus`.
- Starting source: `main@2c7e990b300c4e76a31ac8276905468400a53660` with `origin/main` at the same commit and a clean working tree.
- The older `2026-08-10-workbuddy-expert-squad-expansion-and-e2e.md` record describes an earlier archive/target correction and old runtime evidence. It is useful history, but its repository identity and E2E status are not current evidence for this task.

### Repository investigation

- The starting shipped inventory contains nineteen unique Squads:
  - embedded and immediately selectable: `base`, `advanced`, `research-studio`, `squad-sdk`;
  - bundled Market payload: fifteen further packages under `expert-squads/builtin/**`.
- Sixteen of nineteen already contain at least one package-local `SKILL.md` and project it through `package_skill_refs`.
- Three fail the requested saved-Skill contract:
  - `base`: no package-local Skill and no package Skill projection;
  - `advanced`: no package-local Skill and no package Skill projection; the scheduler-only `default/skill/grill-me` grant is a platform Skill, not a Skill saved by this package;
  - `frontend-innovate`: no package-local Skill and no package Skill projection despite being present in the bundled Market payload.
- Registry loading, manifest resource selection, content-addressed revision materialization, Task package binding, and `PromptProfileResolver` grants already form one runtime authority. The repair must extend that chain, not introduce a checklist-backed runtime source.
- Settings is not the correct owner for planning order. It reads runtime package facts and the one active profile; it must not define Agent ordering, workflow topology, or future package implementation priority.
- The public Astro market already owns a manifest-derived factual projection and is the correct surface for a non-runtime planning page.

### WorkBuddy and open-source investigation

- WorkBuddy documentation directly identifies the Marketing Campaign Team as a preset team and describes parallel content, campaign, Search Engine Optimization (SEO), and brand-analysis work followed by leader synthesis.
- WorkBuddy's public work page describes software-development and content-creation teams as representative team tasks. Public evidence does not prove that every current client ships them as installed presets.
- Public WorkBuddy documentation says Expert capability is supplied through Skills and Model Context Protocol (MCP) resources. A named team therefore cannot be treated as Skill-complete without package evidence.
- Preferred reusable Skill sources for later user-approved additions:
  - `coreyhaines31/marketingskills`, Massachusetts Institute of Technology (MIT) license, for marketing, SEO, content, sales, and growth;
  - `obra/superpowers`, MIT license, for selected software planning, testing, debugging, parallel work, and review methods;
  - `Tencent/BrowserSkill`, MIT license and explicit WorkBuddy support, for browser research and real-page acceptance;
  - `claude-office-skills/skills`, repository-level MIT with per-Skill license review still required, for office/business candidates;
  - `claude-office-skills/contract-review-skill`, MIT license, for contract review with an explicit non-legal-advice boundary.
- WorkBuddy SkillHub recommendations that lack a precise source repository, fixed revision, and redistribution license remain `license_review` candidates and cannot be approved for packaging.

### Hard constraints

- `expert-squad.jsonc` remains the only package declaration source. The generated checklist facts must derive shipped package identity and Skill counts from current manifests and embedded/payload source closures.
- Checklist state is a versioned browser-local planning document only. It must never write `opencorvus.jsonc`, `prompt_profile.active`, Expert Squad installation state, or the Task queue.
- Drag order means operator priority. It does not silently schedule runtime Agents or infer workflow dependencies.
- The parallel declaration must name package-owned mutable paths and the one serialized convergence boundary: payload regeneration, shared catalog/generated facts, shared documentation, complete verification, final review, commit, and push.
- Open-source candidates require a precise source URL, license state, review date, and planned package-local Skill path. Unknown licenses fail closed.
- No User Interface (UI) automation test may be added, changed, or run. UI acceptance uses a real desktop page, real interactions, screenshots, console/network evidence, and human visual review.
- Positive non-UI tests cover candidate/model invariants and the current twenty-nine-package saved-Skill invariant after the ten-lane expansion.
- Preserve unrelated work. Stage only task-owned paths, regenerate payload from the exact Git index, independently review the final diff, commit, inspect the complete outgoing set, and push only the authorized reviewed delivery.
- The runtime exposes four concurrent Agent slots, including the main Agent. Ten logical swimlanes therefore execute in waves across one main and three implementation Agents. A swimlane remains independently owned even when one Agent completes multiple lanes.

### Independent Agent feedback

Three read-only Agents investigated in parallel without modifying files or delegating further:

- Repository audit established the nineteen-package inventory, sixteen compliant packages, the three exact repair targets, the Skill entity-to-production-grant chain, and the missing shipped-inventory invariant.
- WorkBuddy research separated one officially named preset team, two official representative team tasks, one community-observed content package, inferred candidates, and reusable open-source Skill sources with license caveats.
- UI/architecture audit selected an Astro decision page, versioned local planning state, native desktop drag ordering with explicit move controls, and manual browser E2E. It rejected Overlay Settings and the real Task reorder route as the wrong authorities.

## Root-cause and impact boundary

The defect is not merely a missing badge. Three shipped packages have no package-local Skill entity for Registry to load, no manifest ref for Resolver to grant, and therefore no Skill bytes in the exact embedded or payload revision. A page-only label would conceal the runtime gap.

The planning page has a different authority boundary. Shipped facts come from the package sources; researched candidates are reviewed proposals; user selection/order/declaration is a local draft. Combining those three into runtime configuration would create a second package and scheduling source, so they remain explicit layers.

## Acceptance criteria

1. The bilingual public checklist displays current shipped availability, precise Skill readiness, research confidence, source and license status, and candidate purpose.
2. The operator can select candidates, drag selected cards into priority order, move them with explicit controls, mark parallel eligibility, add a note, refresh without losing the draft, reset, and copy/export a human-readable parallel-work declaration.
3. The declaration states exclusive package paths, selected priority, parallel lanes, dependencies, and serialized convergence work. It does not claim to execute the plan.
4. Generated shipped facts cover all twenty-nine unique shipped Squads after expansion and classify `base`, `advanced`, and `frontend-innovate` as repaired only after real package Skill entities and manifest projections exist.
5. `base`, `advanced`, and `frontend-innovate` each contain a package-local authored method Skill. The embedded file maps or generated payload include the exact Skill bytes, and scheduler/worker projections grant the Skill where the method is required.
6. A positive shipped-inventory checker loads every exact source package and proves at least one package Skill entity and at least one selected package Skill projection for every shipped identity.
7. Web data/model tests, package tests, package and web type checks/builds, generated payload checks, route/docs checks, and `git diff --check` pass for the touched scope.
8. A real checklist page is opened on an isolated local server. Selection, mouse drag, move controls, parallel toggle, note, reload persistence, export, reset, long source links, console, network, and desktop layout are manually inspected with screenshots.
9. A production server route in an isolated runtime exposes exact package detail/projection showing the repaired Skill grants. If a real provider-backed workflow is not run, it is reported separately as unverified and not conflated with package and page E2E.
10. An independent read-only Agent reviews the final sources, generated output, tests, documentation, Git ownership, and acceptance evidence; every valid finding is resolved before commit and push.
11. Ten new Market packages are added: `browser-research-acceptance`, `office-delivery`, `product-management`, `customer-success`, `finance-operations`, `meeting-knowledge`, `procurement-vendor`, `localization-adaptation`, `knowledge-base-operations`, and `product-video`.
12. Every new package contains at least one package-local Skill, projects it to its scheduler and every Agent that relies on it, loads through the real Registry, and is present in the exact generated payload closure.
13. MIT-licensed upstream Skills are preferred where their executable contract fits OpenCorvus. Candidates with unclear redistribution terms use a clean authored Skill instead of copying uncertain bytes. Every reused source records repository, license, and pinned revision evidence.
14. Each lane has a focused positive package test. A shared acceptance pass proves all ten package identities, Skill resources, manifest projections, workflow topology, payload details, installability, and production Skill grants without treating static fixtures as full provider E2E.

## Ten implementation swimlanes

| Lane | Package | Skill decision | Mutable ownership |
| --- | --- | --- | --- |
| 01 | `browser-research-acceptance` | Adapt the MIT-licensed Tencent BrowserSkill method to OpenCorvus browser evidence and acceptance boundaries | `expert-squads/builtin/browser-research-acceptance/**` |
| 02 | `office-delivery` | Author a clean-room office delivery method because candidate sub-Skill licenses require per-directory review | `expert-squads/builtin/office-delivery/**` |
| 03 | `product-management` | Adapt selected MIT `obra/superpowers` planning and verification concepts without importing its global startup protocol | `expert-squads/builtin/product-management/**` |
| 04 | `customer-success` | Adapt relevant MIT `marketingskills` customer/revenue operations concepts | `expert-squads/builtin/customer-success/**` |
| 05 | `finance-operations` | Author a finance-operations control and review Skill with explicit non-advisory boundaries | `expert-squads/builtin/finance-operations/**` |
| 06 | `meeting-knowledge` | Author a meeting capture, decision, action, and knowledge-publication Skill | `expert-squads/builtin/meeting-knowledge/**` |
| 07 | `procurement-vendor` | Author a vendor comparison, diligence, and approval-evidence Skill | `expert-squads/builtin/procurement-vendor/**` |
| 08 | `localization-adaptation` | Author a terminology, locale adaptation, and linguistic quality Skill | `expert-squads/builtin/localization-adaptation/**` |
| 09 | `knowledge-base-operations` | Author a source-grounded knowledge lifecycle Skill | `expert-squads/builtin/knowledge-base-operations/**` |
| 10 | `product-video` | Author a product-video planning and production-evidence Skill that fails closed when media-generation capability is absent | `expert-squads/builtin/product-video/**` |

All lanes may create package-owned manifests, Agents, workflows, Skills, and focused tests. They may not concurrently edit the generated payload, public Market facts, shared indexes, shared documentation, or Git staging. Those surfaces remain the serialized convergence boundary.

## Implementation plan

1. Add reviewed candidate data and a build-time generated lean shipped-Squad Skill fact projection.
2. Add a pure checklist state model for versioned parsing, ordering, selection, parallel declarations, and Markdown export.
3. Add bilingual `/market/checklist/` pages using the current public-site layout, native desktop drag ordering, explicit move controls, local persistence, and a market entry point.
4. Author package-local delivery/design method Skills for `base`, `advanced`, and `frontend-innovate`; wire exact manifest projections and embedded source closure imports.
5. Stage exact package sources and regenerate the bundled Expert Squad payload and web facts from the Git index.
6. Add focused positive non-UI contract coverage and update the current architecture's embedded-Squad count and saved-Skill invariant.
7. Run focused checks, then real-page and isolated production-route E2E acceptance.
8. Execute the ten package-owned swimlanes in parallel waves, each with a real package-local Skill and focused positive Registry/runtime coverage.
9. Regenerate the shared payload and public checklist facts once from the exact reviewed package sources, then run ten-package installation and production-grant acceptance.
10. Obtain independent final review, fix findings, rerun affected checks, commit task-owned files, inspect `upstream..HEAD`, and push the current branch if the outgoing set remains authorized.

## Evidence log

- The bilingual checklist model test passed with four tests, 157 assertions.
- `packages/web` type-aware Astro check passed with zero errors; one pre-existing unused-variable hint remains in `qa/dedupe-lead.cjs`.
- The static web build produced both checklist routes among 123 pages.
- Real-page acceptance on the final twenty-nine-package revision verified three selected delivered candidates, two explicit parallel-review lanes, visible research-confidence labels, note persistence after reload, auxiliary move controls, physical mouse drag from `product-management` above `office-delivery`, exact clipboard export, reset, ten selectable shipped candidates, zero horizontal overflow, and an empty warning/error console.
- Raw screenshots are stored under `specs/artifacts/2026-08-10-expert-squad-checklist/`.
- All ten package-owned implementation swimlanes completed. Every package has four Agents, one explicit parallel-to-join workflow, and one saved package Skill; the three external adaptations pin MIT upstream commits and the remaining seven Skills are clean-room authored.
- The generated Market payload now contains twenty-five packages; combined with four embedded packages, the public generated projection contains twenty-nine unique Skill-complete shipped Squads.
- The ten-package generated-payload integration test installs each exact project revision through the Manager and resolves scheduler and all workers through `PromptProfileResolver`; it verifies package detail, digest, workflow, and production Skill grants without claiming fixture-only coverage as E2E: two tests, 102 assertions.
- The production-route E2E starts a real local HTTP server in a subprocess with an isolated `OPENCORVUS_HOME` and real temporary project. For every new package it crosses `market`, `market/detail`, `install-payload`, and `settings/detail`, then verifies the installed digest, one scheduler/worker Skill projection, four workers, and the four-node parallel-to-join workflow. It also crosses built-in detail for repaired `base` and `advanced`, Market install/detail for repaired `frontend-innovate`, and the active runtime catalog to prove the repaired Base production grant: forty-six successful HTTP requests, one test, twelve assertions.
- A real provider-backed LLM workflow was not run and remains explicitly unverified; package distribution/projection E2E and real-page E2E are the completed acceptance boundaries for this change.
