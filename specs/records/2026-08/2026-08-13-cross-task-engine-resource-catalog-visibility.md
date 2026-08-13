# Cross-Task Engine Resource Catalog Visibility

## Recall

### User requirements

- Run the Work-mode Artifact evolution end to end in a random isolated project, on random ports, with an isolated development SQLite database.
- Copy the canonical OpenCorvus Provider identity into the isolated runtime, prove the actual model is exactly `openai/gpt-5.6-luna`, randomly install an available Expert Squad, and keep Evolution Lab held by the Mission.
- Inspect real rendered pages, screenshots, SQLite rows, immutable resources, generated documents, charts, Iterations, and Metrics.
- Investigate every failure through trigger, data/control flow, shared contract, impact, and regression boundary; do not trade one defect for another.
- Use an independent read-only agent, focused positive checks, staged commits, normal upstream integration, and push.

### Acceptance metrics

1. A completed source Task exposes only the exact deliverables selected by its current `TaskCompletionDecision`.
2. When a selected deliverable carries Task Artifact resources, cross-Task import re-materializes exact target-owned bytes and records those target refs in the imported Engine Artifact.
3. The target Task Artifact Catalog enumerates each such current target ref as a canonical `task_artifact_resource` entry; `artifact_read` returns the exact bytes and SHA-256.
4. An `engine_resource` snapshot that is not referenced by a selected current/historical Engine Artifact revision is not catalog-visible.
5. Artifact cursor membership remains frozen across pagination and a fresh search observes subsequently committed referenced resources.
6. A fresh isolated exact-Luna E2E reaches Campaign, exactly two Trials, Iterations, Metric specifications/results, comparison recommendation, `document@1`, and `chart@1`; real pages and immutable bytes are independently reviewed.

### Hard constraints

- The Artifact Catalog remains the single discovery/read/select authority. Do not teach agents to parse an Engine envelope and hand-copy resource locators.
- Do not expose every physical `engine_resource` snapshot: preparation happens before the Engine receipt transaction, so an unreferenced or failed preparation snapshot is not a semantic Catalog artifact.
- Do not add a fallback, fuzzy selector, latest-wins rule, compatibility route, Host workflow gate, or non-streaming model call.
- No UI automation tests. UI acceptance uses the real `/ui` page, screenshots, and manual inspection.
- Preserve unrelated worktree changes. Deliver this repair in its own reviewed commit and push stage.

### Materials read and repository search

- `packages/opencorvus/src/artifact-catalog/index.ts`
- `packages/opencorvus/src/task-artifact/store.ts`
- `packages/opencorvus/src/engine/cross-task-artifact-import.ts`
- `packages/opencorvus/test/task-terminal-artifact-closure.test.ts`
- `packages/opencorvus/test/orchestrator/conversation-turn-declared-outputs.test.ts`
- `packages/opencorvus/test/artifact-catalog-cursor.test.ts`
- `packages/plugin/src/task-artifact.ts`
- `specs/current/architecture/02-data.md`
- Full-worktree searches for `snapshot_kind`, `engine_resource`, `searchTaskArtifacts`, `snapshotCandidate`, `resourceCandidate`, and cross-Task import writers.

### Independent agent feedback

The independent read-only reviewer reproduced the same failure in the isolated run and required the same safety boundary: the target Catalog must expose only `engine_resource` refs that are actually referenced by a persisted target Engine Artifact revision. It explicitly rejected exposing all physical snapshots or making agents parse wrapper JSON.

## Live failure evidence

The isolated run selected project-scoped
`builtin/laboratory-quality-assurance@2026.08.13.1` from a 114-package pool and held it with Evolution Lab. Controller, Session, and Provider usage records all identify `openai/gpt-5.6-luna`.

The diagnostic Task completed with an exact `TaskCompletionDecision` whose sole deliverable was a Markdown Task Artifact resource. The opportunity Task imported that deliverable:

- the import writer published a target-owned snapshot with `snapshot_kind="engine_resource"`;
- the target Engine Artifact envelope stored the current target resource locator, bytes, media type, and SHA-256;
- the manifest and Markdown file existed on disk and recomputed exactly;
- `artifact_search` with `sources:["task_artifact"]` returned `catalog_total=0`.

The observer could read the Engine wrapper but could not materialize it as a file, because materialization correctly requires a `task_artifact_resource` locator. It therefore published an opportunity with the qualified review pack marked unavailable, and the candidate-preparation Task imported that degraded opportunity and attribution.

There was no byte loss and the Host did not corrupt the source. The failure is discovery/projection loss between a persisted target Engine resource reference and the target Task Artifact Catalog.

## Root cause and impact

### First bad transition

`publishImportedTaskArtifactResources` intentionally produces an `engine_resource` snapshot before the target Engine receipt is committed. After the receipt commits, `searchTaskArtifacts` still applies an unconditional
`record.manifest.snapshot_kind === "catalog"` filter. Therefore the resource remains invisible even though a current Engine Artifact now references it.

### Why the previous repair was incomplete

The Catalog already has `resourceCandidate` and emits canonical resource locators for catalog snapshots, but the provider-level filter removes every `engine_resource` record before candidate derivation. The local candidate implementation is correct; the provider membership contract is incomplete.

### Shared impact

The defect affects every cross-Task import of an Engine Artifact or Task Artifact carrying resources, independent of Expert Squad or model. Downstream agents may see a wrapper that declares resources while the canonical Catalog cannot discover/read/select those resources. This degrades opportunity analysis, Campaign inputs, candidate authoring, Trial evidence, generated documents, and rendered Artifact details.

### Excluded causes

- SQLite integrity and foreign keys are healthy.
- Source and target manifests and resource bytes/SHA-256 match.
- The completed-source authority expansion and cross-Task compare-and-swap checks succeeded.
- The missing resource is not a Provider outage, model locator typo, renderer failure, or filesystem deletion.

## Design

1. Keep `catalog` snapshots visible as their parent snapshot plus resource candidates.
2. Derive the set of `engine_resource` snapshot identities referenced by the exact Engine Artifact revisions admitted by the current search revision/version scope.
3. Admit only matching verified `engine_resource` records, and emit only their resource candidates. The physical snapshot remains an Engine receipt dependency, not a second top-level semantic artifact.
4. Bind membership to the existing Engine catalog revision upper bound and Task Artifact publication-sequence upper bound so pagination stays frozen.
5. Keep strict manifest/ref verification and existing read/select authority unchanged.

## Positive verification

- Complete a real source Task with a resource deliverable.
- Resolve, prepare, and persist the cross-Task import into a target Task.
- Search the target Task Catalog and assert the exact current target `task_artifact_resource` locator is returned.
- Read that returned locator and assert complete text/bytes/SHA-256.
- Publish an unreferenced `engine_resource` snapshot and assert the visible result remains the explicitly referenced resource set.
- Paginate more referenced resources than one page, add another committed referenced resource after the first cursor, prove the cursor returns the frozen initial set, and prove a fresh search returns the new set.
- Run focused Bun tests, package typecheck, docs check, and `git diff --check`.
- Obtain independent read-only implementation review.
- Start a new isolated exact-Luna run and complete the full real-page render and database closure.

## Delivery stages

1. Commit and push this frozen diagnosis and plan.
2. Commit and push the Catalog implementation, positive tests, and current architecture update after independent review.
3. Run a fresh exact-Luna E2E. If it exposes another shared defect, freeze evidence and repeat the same bounded stage rather than mixing unrelated repairs.
4. Commit and push final E2E evidence only after document/chart rendering, database/resource closure, cleanup, and independent final review pass.
