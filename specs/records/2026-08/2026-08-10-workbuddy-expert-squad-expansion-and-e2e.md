# WorkBuddy Expert Squad Expansion and End-to-End Acceptance

## Recall

### User request and repository correction

- Investigate Expert Squads commonly associated with WorkBuddy-style work and provide a web checklist with drag ordering and an explicit parallel-work declaration.
- Implement enough selected Expert Squads in parallel and run real End-to-End (E2E) acceptance with exactly `openai/gpt-5.6-terra`; if that model is unavailable, report and stop without substituting another provider or model.
- The authoritative target is `D:\myhexin-local\opencorvus-v0.0.35beta`, whose remote is `https://github.com/yangheng95/opencorvus.git` and whose delivery branch is `main`.
- Work initially performed in `D:\myhexin-local\opencorvus` belongs to the `opencorvus-archive.git` remote. Its commits, Tasks, Sessions, Artifacts, and E2E evidence are not accepted as delivery evidence for this repository. They may be used only as reviewed migration input and defect evidence.

### Selected scope

Implement nine self-contained packages:

1. `commercial-legal`
2. `data-analysis`
3. `marketing-growth`
4. `sales-strategy`
5. `tax-compliance`
6. `hr-operations`
7. `seo-geo`
8. `viral-content`
9. `omnichannel-distribution`

`product-video` remains excluded until this repository owns a mature media authoring and validation chain that produces and verifies a real MP4 or WebM resource. A script or storyboard is not an accepted substitute.

### Acceptance criteria

- Each package is a complete source package under `expert-squads/builtin/<id>/` with one immutable binding workflow, exact Agent roster, package-local Skills, package-owned Artifact codecs, and one typed publisher.
- Every declared workflow node runs once. Independent branches overlap in real Session time, while joins start only after all declared predecessors complete.
- The final Build role publishes canonical project files, the package-owned terminal Artifact, and matching Interactive Artifact presentation where applicable.
- Managed Build publication uses one immutable authority: commit, successful `merge_back`, exact returned `primary_head`, commit-bound `artifact_snapshot`, then typed and Interactive publication. It cannot fall back to mutable primary files.
- Positive non-User-Interface (UI) tests cover source package loading, exact Prompt Profile projection, payload installation, typed producer-to-consumer publication, native Task process authority, image normalization, and immutable snapshot authority. No negative or UI automation tests are added or run.
- Real E2E uses a fresh isolated runtime, fresh Git project, production routes, exact package revision, exact `openai/gpt-5.6-terra`, real Task/Session/Artifact persistence, terminal decisions, parallel timing, canonical resources, and Interactive Artifact records.
- UI evidence uses a real page and human-inspected screenshot only. It is not stored as an automated test, fixture, or baseline.
- A read-only independent Agent reviews final source, tests, documentation, Git ownership, and E2E evidence with no unresolved blocker.

### Hard constraints

- `prompt_profile.active` remains the sole active Expert Squad selection and `PromptProfileResolver` remains the sole runtime projection source.
- No fallback, compatibility alias, Host workflow gate, state machine, hidden/synthetic message, prompt keyword lint, hard-coded legal/tax rule, or cross-package private dependency.
- Package identity is manifest `id`; folder, namespace, label, selector, and similarity do not infer identity.
- Generated payload is regenerated from the precise Git index after package sources are staged.
- Unrelated dirty work in this repository is preserved. Existing edits in Expert Squad catalog, Session message, tool, web, and specs indexes remain owned by their authors unless a precise non-overlapping hunk is required.
- No archive Task or runtime identifier is presented as current-repository evidence. Every accepted E2E identifier must originate from this repository's fresh run.

### Materials and repository search

- Read this repository's `AGENTS.md`, Expert Squad authoring Skill, Build prompt, package tool runtime, Artifact Catalog tool/store, task-session lineage, provider image preparation, package payload generator, and current package tests.
- Read existing `deep-research`, `equity-research`, `evolution-lab`, `base`, `advanced`, and `research-studio` package patterns.
- Confirmed all nine selected package directories are absent in this repository.
- Confirmed the current Build prompt still snapshots after writing without commit-bound `source_commit`; the Artifact tool/store has no merge-back publication authority binding.
- Confirmed provider image preparation lacks the reviewed GIF-to-PNG normalization path.
- Confirmed the native package-tool process and delegated Session authority fixes from the archive attempt are absent here and must be re-evaluated against this repository's current implementation.
- Confirmed the payload generator reads package sources from the Git index.

### Independent Agent feedback

- Legal/compliance design: seven-role legal and tax workflows use authority research, two parallel analyses, synthesis/remediation, one-predecessor fact checking, and Build-owned reports; every conclusion is jurisdiction-, period-, as-of-, and source-bound.
- Business operations design: data, sales, and Human Resources use plan → evidence → two parallel analyses → synthesis → audit → delivery, with typed package-owned evidence rather than prompt-only claims.
- Content design: evidence-led viral content and validated omnichannel bundles are implementable; real external posting and real product-video rendering are outside the current connector/tool boundary.
- Final migration review must verify that newer target-repository APIs have not already replaced or invalidated any archive implementation detail.

## Implementation plan

1. Preserve and inventory both worktrees; stop the archive-only smoke server and make no further archive changes.
2. Mechanically transfer only the nine canonical package source closures and their dedicated positive package tests into this repository, then validate them against the current Software Development Kit (SDK), Registry, Package Manager, and Prompt Profile Resolver.
3. Re-investigate and implement the shared native Package Tool, delegated Session authority, provider image normalization, and commit-bound snapshot fixes against this repository's current definitions and callers. Delete or adapt any archive detail that is no longer valid; do not add compatibility paths.
4. Update Build core and package authoring/final-role prompts so managed publication follows the single commit-bound authority.
5. Stage exact owned sources, regenerate the payload once, update exact package-name coverage, and run focused positive non-UI tests plus typecheck from a frozen Git-index snapshot.
6. Obtain independent read-only review and resolve every valid finding.
7. Start a fresh isolated production server from this repository, run exact Terra preflight, then execute fresh Tasks for all nine packages. Stop immediately on actual model unavailability; never substitute.
8. Cross-check live board, transcript, database, canonical files, typed/Interactive Artifacts, parallel timing, and terminal completion. Perform real checklist-page visual review without creating UI tests.
9. Record only this repository's accepted evidence, commit owned paths, inspect `upstream..HEAD`, and push only if every outgoing commit belongs to this authorized and reviewed delivery.

## Current status

- Archive run stopped; port `47915` has no listener.
- Correct target identity confirmed: `main@e555c3c14fab4d8398ebaadb9e568f8407315568`, `origin=https://github.com/yangheng95/opencorvus.git`.
- Correct target contains unrelated dirty work that must remain untouched.
- All nine self-contained package closures and eight package-test files are present in the correct target; the generated payload was rebuilt once from the exact staged package sources.
- Combined package acceptance passes `28/28` with `331` exact assertions. The name/catalog contract passes `2/2` with `41` assertions. Native package execution, process authority, image normalization, and immutable commit publication pass `10/10` with `28` assertions.
- Frozen-index `packages/opencorvus` typecheck passes. Root `docs:check` passes with `322` operations across `25` groups.
- Root typecheck is not used as acceptance evidence because the shared dirty worktree currently links the frozen Overlay to an independently modified SDK API; the task-owned backend package typecheck is isolated and green.
- Independent final review and fresh correct-repository E2E remain pending. No archive Task identifier is accepted.
