# Evolution failure-attribution source integrity

## Recall

- User request: run a complete random Expert Squad Work-mode evolution with exact `openai/gpt-5.6-luna`, render the final Artifacts, repair root causes, and deliver changes through staged commits and pushes.
- Acceptance: an `evolution-lab/failure-attribution@1` publication is durable only when it binds the exact selected `evolution-lab/opportunity@1` predecessor; a later Campaign must consume that immutable provenance without repair redispatch.
- Hard constraints: preserve streaming LLM calls, one publisher and one evidence truth source, no Host workflow-routing gate or fallback, positive non-UI contract tests, no UI automation, real-page evidence only, and no credential material in source or logs.
- Sources read: the isolated Luna SQLite catalog and tool inputs, `evolution-failure-analyst/system.md`, `publish-evolution-artifact.ts`, the Evolution Artifact schemas, Campaign predecessor validation, and `evolution-artifact-evidence-host.test.ts`.
- Whole-repository search: `failure-attribution`, `source_selection_refs`, `source_artifact_locators`, and `publish-evolution-artifact` definitions and call sites were searched across the plugin, runtime, package, generated payload, tests, and specs.
- Independent feedback: the read-only reviewer confirmed rev63 analyzed and selected rev57 but published with no top-level source locator, leaving `source_artifact_locators=[]`; the Campaign validator then correctly rejected the immutable attribution. After the first implementation, the reviewer found no static P0/P1/P2 and the focused Host contract passed. The required fresh Luna verification later exposed the provider-call shape failure recorded below, so that static result is not final acceptance.

## Observed failure

Fresh isolated run `opencorvus-luna-final-fresh-34c2573048144d698a8a8d0218bd22bb` reached opportunity rev57 and failure-attribution rev63. The analyst completely read and selected rev57. Its successful publisher call nevertheless supplied only the typed payload and no publication source. The typed publisher accepted this and persisted rev63 with an empty semantic source set. Candidate preparation could not publish its Campaign because the Campaign integrity check requires the attribution to identify the exact opportunity.

The first bad transition is therefore the failure-attribution publisher accepting a source-free artifact, not resource loss, Campaign schema failure, provider failure, or a planner ordering mistake. Redispatch cannot repair the immutable rev63 envelope.

A separate prompt contradiction amplified recovery cost: the Experiment Planner was told to materialize the parent package even though `prepare_candidate` requires the Candidate Author's managed worktree and the Campaign publisher already derives the baseline identity. The Host correctly refused that planner-owned call. Planner authority ends at the frozen Campaign; parent package materialization remains solely with the later Candidate Author.

### Fresh verification failure after the first repair

Fresh isolated run `opencorvus-luna-after-attribution-64a0e3a99ea949b2b3b874c3cb8dbb19`
reached a valid `evolution-lab/opportunity` but failed every Failure Analyst publication. The provider-exposed JSON
Schema correctly declared four top-level properties (`artifact`, `resource_set`, `parent_resource_set`, and
`source_artifact_locators`) with `additionalProperties=false`. The actual model call nevertheless placed the latter
three correlated controls inside `artifact`. Once `owner_evidence` was corrected, the package tool accessed the
missing top-level array and threw raw `TypeError: Cannot read properties of undefined (reading 'length')`.

The direct trigger is therefore correlated publication state split across sibling arguments that the live model did
not preserve after repeated explicit prompt repair. The deeper runtime defect is that package-tool capsule execution
passes decoded arguments directly to `definition.execute` instead of parsing `definition.inputSchema`; provider-side
schema projection is not a trusted runtime validation boundary. Prompt repetition did not cure either defect.

## Repair boundary

1. The typed Evolution publisher must require exactly one Engine Artifact source for `evolution-lab/failure-attribution`.
2. It must completely read that source, prove type `evolution-lab/opportunity`, prove the expected Evolution observer producer, and require the attribution payload's `owner_evidence` to name that same locator.
3. Missing, extra, wrong-type, wrong-producer, or payload-mismatched sources return `EvolutionArtifactIntegrityError` before persistence.
4. The Failure Analyst prompt must explicitly put the exact selected opportunity locator in `source_artifact_locators` inside the publisher's single top-level `artifact` argument; it must not imply that a prior selection is attached automatically.
5. Generated embedded package payload is regenerated from the canonical package source. No compatibility path or post-publication repair is added.
6. The Experiment Planner prompt must not call candidate preparation or claim a candidate worktree. It freezes the Campaign only; the Candidate Author owns parent-package preparation after the development Campaign exists.
7. The publisher exposes one correlated `artifact` argument. Its selected discriminated-union branch contains the
   strict payload and the exact resource/source controls for that same publication; there is no sibling control state
   for the model to reassemble.
8. The native package-tool worker parses the decoded call through its frozen Zod `inputSchema` before execution, so
   malformed input produces the schema's typed error and can never reach package business code as `undefined`.

## Positive verification

- Extend the real package-tool host test to select one opportunity, publish a failure attribution, and assert its durable envelope contains the exact opportunity source.
- Exercise the missing-source input as the typed integrity-error contract and assert no failure-attribution Artifact is persisted.
- Introspect the frozen publisher and prove it exposes exactly one top-level `artifact` argument whose attribution
  branch requires `resource_set` and `source_artifact_locators`; execute a malformed call through the real native
  package-tool process and prove schema validation happens before publisher code.
- Run the focused Evolution Artifact test, package projection/generation checks, relevant typechecks, docs check, and diff check.
- Obtain independent read-only review after implementation, then commit and push this repair as its own stage before the next fresh Luna run.
