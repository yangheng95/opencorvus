# Evolution evaluation and integrity review ownership split

Status: implemented and focus-verified. No live campaign run is claimed by this record.

## Recall

- User request: investigate why Expert Squad self-evolution has never passed end to end, judge the design's
  soundness, identify mechanical defects, and then repair the ones found. The user separately chose the repair
  direction for the ownership deadlock and chose to allow Evolution Lab to become its own evolution target with
  explicit guardrails.
- Acceptance: one typed Artifact has exactly one producing worker; the measured values and the independent
  integrity review are separately owned facts; a Campaign that targets Evolution Lab itself is legal and its
  promotion confirmation says so; existing evidence, digest, and authorization gates are unchanged.
- Hard constraints: do not weaken any promotion gate, do not add a Host workflow gate or fallback, do not make one
  worker publish another worker's typed Artifact, keep every generated artifact regenerated from its canonical
  source, and do not repair a pre-existing unrelated working-tree failure inside this boundary.

## Problem depth and impact

### Observable gap

The evaluation stage could not complete under any prompt. Two independently unimplementable branches existed at the
same time:

- The publisher's owner table required `evolution-lab/evaluation-result` to be published by
  `evolution-safety-auditor`, but only `evolution-evaluator` holds `execute-evolution-metrics`, and that tool returns
  the immutable metric receipt identity solely to its caller. The Safety Auditor therefore had no typed channel to
  obtain the `metric_receipt_resource` that the same publisher demands.
- The Evaluator prompt and `skills/campaign/references/artifact-ownership.md` instead told the Evaluator to publish
  `evolution-lab/evaluation-result` with `integrity_review` set to null. `deriveComparisonRecommendation` adds
  `integrity_review:<slot>` to `required_unavailable_dimensions` whenever that field is absent or unavailable, a
  required-unavailable dimension nulls the aggregate score and forces `inconclusive`, and
  `prepareEvolutionPackageMutation` rejects any recommendation that is not a complete deterministic `promote`.
  Following the shipped prompt therefore made promotion mathematically unreachable.

No recorded live run ever reached the evaluation stage, so neither branch had been observed. The defect was latent
behind the earlier failures catalogued in `2026-08-12-random-expert-squad-self-evolution-e2e.md`.

### Root cause

`022d902e refactor(expert-squad): align workflow execution contracts` moved the `evaluation-result` owner to the
Safety Auditor while the artifact kept carrying both the measured values and the review section. That is the same
class of defect the R7 section of the E2E record already ruled on: a stage was made to publish an Artifact whose
content another role owns. One Artifact carrying two independently owned facts has no correct single owner.

### Why adjacent paths do not cure it

- Reverting the owner to the Evaluator alone leaves the Safety Auditor with no owned typed Artifact, so its node has
  no terminal-success evidence and the Recommendation Owner loses the independent review it must consume.
- Handing the receipt identity to the Auditor through coordination prose would require it to transcribe exact
  locators and scorer values, which R17 already proved is not a reliable Tool protocol.
- Allowing a second `evaluation-result` for the same slot contradicts the explicit duplicate-slot rejection in
  `comparison.ts` and would create two semantic facts for one measurement.
- Dropping the review requirement would remove the reward-hacking, leakage, and lineage defence the campaign exists
  to provide.

## Frozen design

1. `evolution-lab/evaluation-result` drops `integrity_review` and is owned by `evolution-evaluator`, which already
   holds the metric receipt it must equal.
2. A new `evolution-lab/integrity-review@1` carries `case_id`, `arm`, `repetition`, `evaluation_result_locator`,
   `status`, `findings`, `accepted_limitations`, and `unknowns`, and is owned by `evolution-safety-auditor`.
3. The typed publisher requires each review to name an exact Engine Artifact `evaluation-result` produced by
   `evolution-evaluator`, to carry that locator among its direct sources, to match that result's exact slot identity,
   and to keep every finding's evidence locator inside its own direct sources.
4. `deriveComparisonRecommendation` takes `reviews` as a separate input, rejects undeclared and duplicate review
   slots, requires each review to reference the exact evaluation locator of its slot, and derives
   `integrity_review:<slot>` availability, unknowns, and the reward-hacking review from the review Artifacts.
5. The comparison publisher accepts `evolution-lab/integrity-review` as a supported source type and enforces the
   Safety Auditor producer on it.
6. `evolution-safety-auditor` now declares `depends_on: ["evolution-evaluator", "evolution-experiment-planner"]`.
   The Auditor genuinely consumes the Evaluator's Artifacts, so this is a truthful dependency join and not imposed
   serialization.
7. Evolution history projects reviews as their own family: the comparison graph collects them, `completeness`
   counts reviewed slots from them, each detail slot exposes its `review` identity and `integrity_review` payload,
   an orphan review is reachable through the evaluation it reviews, and reviews are excluded from the generic
   related-artifact list.
8. Evolution Lab may be the exact Campaign target. Nothing in the schema or manager excluded it before and nothing
   does now; the prompts, Skill, and README no longer forbid it when it is the target, and
   `evolutionMutationConfirmationText` appends an explicit line naming it as the evolution trust root so the
   authorizing operator sees that the confirmation changes future evidence validation and authorization behaviour.
   Every other gate, including the byte-exact confirmation match, is unchanged.

## Positive verification

- `test/evolution-comparison.test.ts`: 1 passed. Reviews are supplied as separate located Artifacts and the complete
  promote matrix is reproduced.
- `test/evolution-lab-package-projection.test.ts`: 1 passed / 38 assertions, including the new Auditor dependency.
- `test/expert-squad-evolution-mutation.test.ts`: 1 passed / 19 assertions. The full authorization, promotion, and
  restoration chain runs on the split ABI, and the history detail slots read `reviewed` integrity status from the
  review Artifacts.
- `test/artifact-publisher-authority.test.ts`: 3 passed.
- `test/evolution-artifact-evidence-host.test.ts`: 5 passed / 3 failed. The three failures are
  `Artifact provenance requires persisted Tool Part ...` and were reproduced identically on the unmodified `HEAD`
  version of every file in this boundary, so they belong to the unrelated in-progress Session work already present in
  the worktree.
- Plugin and OpenCorvus typechecks pass. `check:expert-squad-topology` reports 119 manifests and 131 workflows.
  `docs:check` reports 332 operations across 25 groups. `api:routes-check` passes 6 rules across 34 files. The
  embedded Expert Squad payload, `packages/sdk/openapi.json`, and the generated JavaScript SDK were regenerated from
  canonical sources.

## Campaign resume: the primitive already exists

The follow-up investigation into "a failed campaign must restart from scratch" found no missing Host capability, so
none was added.

- `resolveCrossTaskArtifactSources` already accepts a `terminal_lifecycle` authority for a source Task whose status is
  `failed` or `cancelled` (`packages/opencorvus/src/engine/cross-task-artifact-import.ts:259`), and rejects only the
  mismatch between requested authority and actual lifecycle.
- `create_task.artifact_sources` already exposes that branch to the model as
  `{authority:'terminal_lifecycle',source_task_id,locator}` for "failed/cancelled recovery"
  (`packages/opencorvus/src/panel/capability.ts:351`), and the Mission prompt teaches both it
  (`src/prompt/core/mission-core.txt:48,251`) and `resume_task` for reopening a failed Task as a new occurrence
  (`:282`).
- Evolution predecessor correlation depends only on Host-owned `import_lineage` — `source_task_id`, `source_locator`,
  `source_provenance`, `source_producer` — and never on the import authority kind
  (`expert-squads/builtin/evolution-lab/tools/publish-evolution-artifact.ts:169-207`). Evidence imported from a failed
  stage therefore correlates exactly as evidence from a completed stage.

The real gap was that Evolution Lab's own contract never said so, so a stage failure read as a dead campaign. The
Evolution Lab orchestrator prompt and campaign Skill now state that published evidence survives its producing Task's
terminal lifecycle, that a failed stage is continued through `resume_task` or a `terminal_lifecycle` import rather
than re-derived, and that a slot already holding a valid Artifact is never published twice. No Host mechanism, gate,
state, or second evidence source was introduced.

The isolated E2E controller retains its run root on failure — it deletes only the copied credential
(`script/expert-squad-evolution-e2e.ts:463`) and writes `outcome: "failed"` without removing the home, project, or
SQLite database — but `fs.mkdir(runRoot, { recursive: false })` (`:378`) refuses to reuse an existing root, so the
retained evidence cannot currently be relaunched against. Adding a controller resume mode is safe harness work, but it
must reuse the recorded target selection instead of drawing a new one; re-running unbiased selection against a
retained project would silently invalidate the run. That work is not attempted here.

## Declared descriptive identity becomes a V1 mutable surface

Candidate mutation previously covered only the package's text files, so a Squad could evolve what its prompts say but
never what the Squad declares itself to be. `compareCandidateIntegrity` now normalizes a fixed set of declared
descriptive fields before the frozen-manifest comparison: top-level `name`, `label`, `description`,
`selector.summary`, `selector.selection_guidance`, every agent `label` and `description`, and every workflow and
workflow-node `label` and `description`. Those values steer selection and dispatch and grant no capability.

Everything else in the manifest remains byte-frozen under the unchanged equality rule — tool identifiers, every
`*_refs` array, `base_role`, prompt paths, agent keys, workflow keys and `depends_on` edges — so a candidate can
evolve what a Squad says it is and never what it is allowed to do. Adding or removing an agent or workflow still
changes manifest structure and is still rejected. A candidate whose only change is descriptive is now valid, so the
"at least one change" rule accepts either a mutable text path or a descriptive field.

`test/evolution-candidate-manifest-surface.test.ts` proves the boundary in four cases: a descriptive-only revision is
accepted, agent and node descriptions evolve together with a prompt, a scheduler tool grant added alongside a
descriptive edit is rejected with the typed frozen-field error, and a version-only revision is still rejected.

## Composition seam and failed-stage resume evidence

`8e69acd8` (2026-08-16) tightened `assistantActionFactScope` to require a persisted Tool Part and a preceding
persisted `step-start` Provider step boundary before any Artifact publication, but did not update the
`evolution-artifact-evidence-host.test.ts` fixtures; that file's last change predates the requirement and is not its
descendant. Three cases were therefore red on committed `HEAD`, and they are exactly the cases that drive the real
publisher through a real host, so no real-publisher composition test could be written or trusted.

Each affected fixture created its assistant Message already completed and then declared a `toolPartID` that was never
persisted. Parts are immutable after assistant completion, so the repair creates each assistant Message in flight —
which is also what production does while a tool executes — and persists a `step-start` part plus the exact declared
Tool Part before the scope is used. Step-start identifiers are chosen to sort before their Tool Part identifier
because the ordering predicate falls back to an identifier comparison when both rows share `time_created`. Four such
chains were missing across the file. The same file was also migrated to the split ABI: the obsolete second
`evaluation-result` publication became an `evolution-lab/integrity-review` publication, and the comparison now sources
both the evaluation result and its review. That file is `8` passed / `83` assertions, from `3` passed / `5` failed and
`40` assertions before this work.

The isolated E2E controller's own evidence summarizer also still enforced the pre-split contract: it required every
`evolution-lab/evaluation-result` to be produced by the Safety Auditor and to carry a `reviewed` `integrity_review`.
It now requires evaluation results from the Evaluator, accepts `evolution-lab/integrity-review` as a declared
recommendation source, requires each review to be produced by the Safety Auditor with `status = "reviewed"`, and
passes the reviews into the deterministic comparison. Its contract suite is `14` passed / `33` assertions.

Cross-Task recovery from a failed producing Task was already covered generically by
`test/task-terminal-artifact-closure.test.ts`, but it asserted only the import mapping. It now also asserts that the
imported envelope retains the four `import_lineage` facts Evolution predecessor correlation actually consumes —
`source_task_id`, `source_locator`, a `projected-worker` `source_producer`, and `source_provenance.source_artifact_locators` —
so the documented claim that a failed stage's evidence stays usable is backed by evidence rather than by inference.
That file is `10` passed / `56` assertions.

## Package recovery no longer trades safety for liveness

`packageStateAt` classified every `loadCatalogPackage` failure as `partial`, and `packageStateIsDisposable` treats
`partial` as overwritable or discardable. A permission fault, file lock, or device error while inspecting an installed
package could therefore let crash recovery discard a valid installed revision. Making that failure throw instead was
rejected: background reconciliation runs while a project or catalog opens, and a blocking throw there is the exact
shape of the Windows startup incident this repository already recorded twice.

Both halves are now closed. A package whose own content proves it incomplete — a missing member, reported as `ENOENT`
or `ENOTDIR` — remains `partial` and disposable. Every other inspection failure becomes a new `undetermined` state
that is neither disposable nor digest-matching, so no reconciliation branch can act destructively on a package the
environment merely refused to read, and the condition is logged. Background reconciliation additionally isolates each
journal: an unreconcilable journal is retained and reported, and the scan continues to the next entry instead of
failing the surrounding open. Explicit operator-initiated `reconcileCommittedPackageMutation` still surfaces its error
to its caller.

`test/expert-squad-recovery-resilience.test.ts` proves the liveness half with a corrupt journal and a journal whose
filename disagrees with its manifest identity: both resolve without throwing and both files survive for a later
explicit reconciliation.

## Operability and record integrity

- `check:evolution-e2e` now names the isolated live controller in `packages/opencorvus/package.json`, matching the
  existing manual `check:*-e2e` convention. Continuous integration references no `check:*-e2e` script, so this makes
  the controller discoverable without making an unattended live run part of any automated gate.
- The 2026-08 record index linked `2026-08-06-expert-squad-self-evolution-architecture.md`, which exists neither in
  the worktree nor in `git log --all`. The entry now states plainly that the file is missing, drops the dead link, and
  names the current authorities for those conclusions rather than deleting the fact that the decision was made.

## Reviewed and dismissed

`docs/code-smell-report.md` R3C-16 reports that `evolution-history.ts` casts `as FrozenArtifact<T>` after only a
runtime string comparison. The cast is sound: `frozenRead` verifies `envelope.artifact_type` equals the catalog
artifact type and assigns `payload` only from `EvolutionArtifactSchemas[catalog.artifactType].safeParse`, so a defined
payload is already the parsed value of that exact type. The finding is a readability observation, not a validation
gap, and no behavioural change was made for it.

## Not attempted

The audit finding that "nothing accumulates into a test that would catch the next composition failure" remains true,
and the fixture machinery a new seam test needs is currently red on committed `HEAD` for an unrelated reason.

`8e69acd8 fix: converge compaction control and artifact causality` (2026-08-16) tightened
`assistantActionFactScope` to require both a persisted Tool Part and a preceding persisted `step-start` Provider
step boundary before any Artifact publication
(`packages/opencorvus/src/agent/artifact-read-facts.ts:165-204`). It did not update the three
`evolution-artifact-evidence-host.test.ts` cases that drive the real publisher through a real host; that file's last
change is `627146cc` (2026-08-15) and the requirement commit is not its ancestor. Those three cases declare
`toolPartID` inside their execution scope but never persist the Tool Part or a `step-start` part, and the file
contains no `step-start` fixture at all. The same three failures reproduce with every file in this record's boundary
reverted to `HEAD`.

Repairing them requires giving each case a complete persisted provenance chain — `step-start`, the exact declared Tool
Part, and persisted completed read facts for every predecessor the publisher reads — because
`completeArtifactReadsBeforePublication` reconstructs those facts from persisted Parts rather than from the live
operation. The canonical pattern is `test/artifact-read-facts-provider-input.test.ts:146-156`. A `step-start`
identifier must sort before the declared Tool Part identifier, since the ordering predicate falls back to an
identifier comparison when both rows share `time_created`. Until that chain exists, any new real-publisher seam test
would be red for reasons unrelated to its own contract.

## Known remaining work

- No automated test drives a real model through the evaluation stage. The real-publisher machinery is green and usable
  again, but a live-model stage test remains unwritten.
- The isolated E2E controller still cannot relaunch against a retained run root, so a failed live campaign is re-run
  from scratch even though the product supports continuing it.
- Manifest topology — agent sets, workflow graphs, tool and reference grants — remains frozen. Opening it needs an
  explicit decision about whether a candidate may alter its own capability grants, plus Software Development Kit
  authoring validation and Trial isolation before it is safe.
- `evolution-history.ts` still loads every project evolution Artifact into memory before paginating, and
  `integrityIssuesForTarget` still compares campaigns against artifacts quadratically with a canonical serialization
  per comparison. Both are read-path performance items with no correctness consequence and were left untouched.
- `test/metrics-evidence-runtime.test.ts` reports one failure with a SQLite `near "where"` syntax error, and
  `src/engine/task-root-ingress-delivery.ts` reports a typecheck error on an `ActivationAttempt` property. Neither
  file is inside this repair boundary; both belong to the unrelated in-progress worktree changes.
