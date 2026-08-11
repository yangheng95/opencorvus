# Ten-domain Expert Squad expansion

## Recall

### User request

- Add ten more domain Expert Squads after the existing twenty-nine shipped Squads.
- Every new Squad must own a dedicated Skill or another durable package asset.
- Continue the prior requirement that a shipped Squad must save and project its corresponding Skill; prefer a reusable open-source Skill when its exact license can be closed.

### Acceptance metrics

1. Add exactly ten new bundled Market packages: `cybersecurity-assurance`, `cloud-platform-architecture`, `data-engineering-reliability`, `scientific-research-design`, `healthcare-operations`, `education-program-design`, `supply-chain-logistics`, `manufacturing-quality`, `real-estate-due-diligence`, and `ecommerce-merchandising`.
2. Every package has one scheduler, four worker Agents, three independent root nodes, one explicit join node, one selector, one package-local Skill, and one reusable asset template stored under that Skill.
3. Scheduler and all four workers project the same exact package Skill reference. The generated payload contains the Skill and asset bytes in the package snapshot.
4. The first four Skills are bounded adaptations of pinned MIT upstream Skills; provenance and the upstream license are saved inside each package. The remaining six are clean-room authored and state their professional-review and action-authority boundaries.
5. The generated Market payload grows from twenty-five to thirty-five entries. Combined with four embedded packages, generated public facts report thirty-nine unique shipped and Skill-complete Squads.
6. The bilingual checklist shows the new ten domains, their source confidence, saved Skill and asset evidence, and supports selection, physical drag ordering, parallel declaration, persistence, copy, and reset on the exact final revision.
7. Focused package tests load every source package through `ExpertSquadRegistry`, install its generated payload revision through `ExpertSquadPackageManager`, and resolve scheduler/worker Skill projections through `PromptProfileResolver`.
8. A subprocess-backed production HTTP test crosses Market discovery, detail, project installation, and settings detail for all ten packages inside an isolated `OPENCORVUS_HOME` and temporary project.
9. Skill Creator validates all ten Skill folders. Generated payload/public facts are reproducible from the exact staged package sources.
10. An implementation-independent Agent performs a final read-only review. All valid findings are resolved before commit and push.

### Hard constraints

- Preserve all unrelated dirty-worktree changes. Do not reset, clean, stash, overwrite, or stage parallel work.
- Do not add, modify, or run User Interface automation tests. UI acceptance uses the real built page, physical interaction, screenshots, layout measurement, and browser console evidence.
- Do not treat fixtures or direct Manager calls as full E2E. The production-route test must start a real local HTTP server in a subprocess and make real requests.
- High-stakes domains do not issue professional advice, approvals, diagnoses, certifications, transactions, or operational actions. They produce evidence packs for authorized human decision owners.
- One current package implementation and one saved Skill source of truth per domain; no compatibility path or fallback package.

### Materials read

- Repository `AGENTS.md` and `specs/current/architecture/04-extensions.md`.
- Existing ten-package implementation and tests from commit `b1bd8db475977ba2b6eec525935adf33d8a55f04`.
- Skill Creator guidance and its `init_skill.py` / `quick_validate.py` workflow.
- GitHub `awesome-copilot` Skill collection and MIT license at `3f0bba475ec40b9680e1d0311b9caffeec5ad4c3`; selected inputs: `agent-owasp-compliance` and `cloud-design-patterns`.
- `vaquarkhan/data-engineering-agent-skills` and MIT license at `421ef57e8d42c464b29339193c18dd5bd2946bc2`; selected input: `data-quality-and-contract-testing`.
- `K-Dense-AI/scientific-agent-skills` and the individually MIT-licensed `scientific-brainstorming` Skill at `7eb9c23c32ecf7f8c19cb45ded3150534ccefe6a`.

### Repository search results

- Starting source and remote are both `b1bd8db475977ba2b6eec525935adf33d8a55f04` on `main`.
- Current unique shipped inventory is twenty-nine: four embedded packages plus twenty-five bundled Market payload entries.
- Existing coverage already owns finance, legal, tax, human resources, marketing, sales, customer success, data analysis, research, content, frontend, product, procurement, localization, meetings, knowledge, office, and video. The ten selected domains are not present as package identities.
- Payload generation reads the exact Git index package set, then validates every generated package through the production Registry.
- The shared checklist already consumes manifest-generated shipped facts, so the shipped count updates through the generator while its candidate research list must be replaced explicitly.

### Independent Agent feedback before implementation

- None. The mandatory independent Agent review happens after implementation and first-pass verification.

## Domain package design

| Package | Parallel roots | Join owner | Saved Skill and asset | Source decision |
| --- | --- | --- | --- | --- |
| `cybersecurity-assurance` | threat evidence, control coverage, incident readiness | assurance integrator | `cybersecurity-assurance/shared/method`; `assets/security-assurance-register.md` | bounded adaptation of GitHub `agent-owasp-compliance`, MIT |
| `cloud-platform-architecture` | workload requirements, reliability, cost/operations | architecture decision owner | `cloud-platform-architecture/shared/method`; `assets/cloud-decision-record.md` | bounded adaptation of GitHub `cloud-design-patterns`, MIT |
| `data-engineering-reliability` | source contracts, pipeline resilience, observability | data release integrator | `data-engineering-reliability/shared/method`; `assets/data-product-contract.md` | bounded adaptation of `data-quality-and-contract-testing`, MIT |
| `scientific-research-design` | evidence landscape, hypothesis alternatives, rigor/ethics | research decision integrator | `scientific-research-design/shared/method`; `assets/research-decision-register.md` | bounded adaptation of K-Dense `scientific-brainstorming`, MIT |
| `healthcare-operations` | service-flow evidence, capacity/access, safety/privacy | operations improvement owner | `healthcare-operations/shared/method`; `assets/healthcare-operations-register.md` | clean-room; no clinical advice or patient-specific decision |
| `education-program-design` | learner evidence, curriculum structure, assessment/accessibility | learning-program integrator | `education-program-design/shared/method`; `assets/learning-program-blueprint.md` | clean-room; no credential or learner-outcome fabrication |
| `supply-chain-logistics` | demand/inventory, transport constraints, disruption risk | logistics plan owner | `supply-chain-logistics/shared/method`; `assets/logistics-control-tower.md` | clean-room; no purchase, shipment, or customs action |
| `manufacturing-quality` | process evidence, defect analysis, control verification | quality disposition owner | `manufacturing-quality/shared/method`; `assets/nonconformance-register.md` | clean-room; no safety certification or production release authority |
| `real-estate-due-diligence` | property documents, market/financial evidence, physical/regulatory risk | diligence pack owner | `real-estate-due-diligence/shared/method`; `assets/property-diligence-register.md` | clean-room; no legal, appraisal, investment, or transaction advice |
| `ecommerce-merchandising` | catalog evidence, demand/pricing, experience/operations | merchandising plan owner | `ecommerce-merchandising/shared/method`; `assets/merchandising-test-plan.md` | clean-room; no price or inventory mutation |

## Implementation sequence

1. Initialize the ten Skill folders with Skill Creator, then replace scaffolds with concise package-local Skills and assets.
2. Add each manifest, selector, README, scheduler prompt, four worker prompts, Skill, asset, and provenance/license closure when applicable.
3. Add focused package/integration/production-route tests and update the checklist candidate source.
4. Stage only task-owned package sources before generating payload and public facts; verify reproducibility.
5. Run package tests, real HTTP E2E, Skill validation, typecheck, docs checks, web build, and real-page visual/interaction acceptance.
6. Obtain independent review, resolve findings, commit only task-owned paths, inspect `upstream..HEAD`, and push if the outgoing set remains authorized.

## Evidence log

- Added the exact ten planned package IDs. Each package has one scheduler, four workers, three independent root nodes, one explicit three-input join, one selector, one package-local Skill, and one reusable Markdown asset template stored inside the Skill closure.
- `cybersecurity-assurance` and `cloud-platform-architecture` save bounded adaptations and MIT notices from `github/awesome-copilot@3f0bba475ec40b9680e1d0311b9caffeec5ad4c3`; `data-engineering-reliability` saves the MIT notice and provenance for `vaquarkhan/data-engineering-agent-skills@421ef57e8d42c464b29339193c18dd5bd2946bc2`; `scientific-research-design` saves the individually MIT-licensed K-Dense input at `7eb9c23c32ecf7f8c19cb45ded3150534ccefe6a`. The other six Skills are marked clean-room and state professional-review and action-authority boundaries.
- Skill Creator `quick_validate.py` returned `Skill is valid!` for all ten Skill folders.
- `bun test test/expert-squad/domain-expansion-packages.test.ts`: 11 pass, 0 fail, 160 assertions. The real Registry loads Skill and asset bytes; the Manager installs all source packages; the Resolver grants the exact Skill to scheduler and workers.
- Generated payload contains thirty-five bundled Market packages. `bun test test/expert-squad/domain-expansion-payload-integration.test.ts`: 2 pass, 0 fail, 92 assertions across Market listing, generated install, digest identity, Skill projection, and three-root join topology.
- `bun test test/expert-squad/domain-expansion-production-route-e2e.test.ts`: 1 pass, 0 fail, 7 assertions. An isolated subprocess and dynamic HTTP server completed forty production-route requests across Market search, detail, payload install, and settings detail for all ten packages.
- `bun run typecheck` in `packages/opencorvus`: exit 0. `bun run build` in `packages/web`: exit 0 and built the Chinese and English checklist routes; the build retained pre-existing Starlight and target-transform warnings.
- Combined focused rerun: 14 pass, 0 fail, 259 assertions. `bun run docs:check`: `docs:check ok (329 ops, 25 groups)`. Regenerating payload and public facts from the exact staged package sources preserved both SHA-256 file hashes.
- `bun run check` in `packages/web` reached Astro diagnostics but is currently blocked by a TypeScript diagnostic in the unrelated, untracked parallel-work file `packages/web/script/generate-expert-squad-distribution.ts:56`; this Task did not modify or stage that file. The production web build itself passes.
- Real built-page acceptance used an isolated local server at a 1280 x 720 desktop viewport. The exact final revision showed `39/39 SKILL READY`, ten shipped candidate cards, ten dedicated asset paths, and no horizontal overflow or browser console warnings/errors. Physical pointer drag moved `healthcare-operations` ahead of `scientific-research-design`; selection and parallel enablement produced a 2/2 declaration; copy returned both selected IDs; reload preserved the note and 2/2 state; reset restored 0/0, empty note, and canonical order.
- Exact-final visual evidence is stored in `specs/artifacts/2026-08-10-domain-expert-squad-expansion/`: hero and 39/39 facts, 2/2 Skill-and-asset declaration, corrected asset layout, and physical-drag ordering. A failed full-page capture that repeated the hero instead of the inventory was removed rather than retained as evidence.
- Independent read-only review validated all ten package closures, upstream pins and notices, generated Market counts, the 40-request production-route exercise, the 14-test focused suite, typecheck, and staged ownership. Its only finding was the failed full-page capture; that evidence was removed and this claim was narrowed before the final review pass.
