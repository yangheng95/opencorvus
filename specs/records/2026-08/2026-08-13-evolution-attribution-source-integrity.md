# Evolution failure-attribution source integrity

## Recall

- User request: run a complete random Expert Squad Work-mode evolution with exact `openai/gpt-5.6-luna`, render the final Artifacts, repair root causes, and deliver changes through staged commits and pushes.
- Acceptance: an `evolution-lab/failure-attribution@1` publication is durable only when it binds the exact selected `evolution-lab/opportunity@1` predecessor; a later Campaign must consume that immutable provenance without repair redispatch.
- Hard constraints: preserve streaming LLM calls, one publisher and one evidence truth source, no Host workflow-routing gate or fallback, positive non-UI contract tests, no UI automation, real-page evidence only, and no credential material in source or logs.
- Sources read: the isolated Luna SQLite catalog and tool inputs, `evolution-failure-analyst/system.md`, `publish-evolution-artifact.ts`, the Evolution Artifact schemas, Campaign predecessor validation, and `evolution-artifact-evidence-host.test.ts`.
- Whole-repository search: `failure-attribution`, `source_selection_refs`, `source_artifact_locators`, and `publish-evolution-artifact` definitions and call sites were searched across the plugin, runtime, package, generated payload, tests, and specs.
- Independent feedback: the read-only reviewer confirmed rev63 analyzed and selected rev57 but published with no top-level source locator, leaving `source_artifact_locators=[]`; the Campaign validator then correctly rejected the immutable attribution. After implementation, the reviewer found no P0/P1/P2, independently passed the focused Host contract with 20 assertions, and verified the generated payload is byte-exact with all three changed canonical package files.

## Observed failure

Fresh isolated run `opencorvus-luna-final-fresh-34c2573048144d698a8a8d0218bd22bb` reached opportunity rev57 and failure-attribution rev63. The analyst completely read and selected rev57. Its successful publisher call nevertheless supplied only the typed payload and no publication source. The typed publisher accepted this and persisted rev63 with an empty semantic source set. Candidate preparation could not publish its Campaign because the Campaign integrity check requires the attribution to identify the exact opportunity.

The first bad transition is therefore the failure-attribution publisher accepting a source-free artifact, not resource loss, Campaign schema failure, provider failure, or a planner ordering mistake. Redispatch cannot repair the immutable rev63 envelope.

A separate prompt contradiction amplified recovery cost: the Experiment Planner was told to materialize the parent package even though `prepare_candidate` requires the Candidate Author's managed worktree and the Campaign publisher already derives the baseline identity. The Host correctly refused that planner-owned call. Planner authority ends at the frozen Campaign; parent package materialization remains solely with the later Candidate Author.

## Repair boundary

1. The typed Evolution publisher must require exactly one Engine Artifact source for `evolution-lab/failure-attribution`.
2. It must completely read that source, prove type `evolution-lab/opportunity`, prove the expected Evolution observer producer, and require the attribution payload's `owner_evidence` to name that same locator.
3. Missing, extra, wrong-type, wrong-producer, or payload-mismatched sources return `EvolutionArtifactIntegrityError` before persistence.
4. The Failure Analyst prompt must explicitly pass the exact selected opportunity locator as the publisher's top-level source input; it must not imply that a prior selection is attached automatically.
5. Generated embedded package payload is regenerated from the canonical package source. No compatibility path or post-publication repair is added.
6. The Experiment Planner prompt must not call candidate preparation or claim a candidate worktree. It freezes the Campaign only; the Candidate Author owns parent-package preparation after the development Campaign exists.

## Positive verification

- Extend the real package-tool host test to select one opportunity, publish a failure attribution, and assert its durable envelope contains the exact opportunity source.
- Exercise the missing-source input as the typed integrity-error contract and assert no failure-attribution Artifact is persisted.
- Run the focused Evolution Artifact test, package projection/generation checks, relevant typechecks, docs check, and diff check.
- Obtain independent read-only review after implementation, then commit and push this repair as its own stage before the next fresh Luna run.
