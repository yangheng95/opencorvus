import { expect, test } from "bun:test"
import {
  EngineArtifactEnvelopeSchema,
  EvolutionArtifactSchemas,
  createEvolutionArtifactReferences,
  evolutionArtifactProvenance,
  EvolutionArtifactReferenceError,
  resolveEvolutionIntegrityReviews,
  type EngineArtifactLocator,
} from "@opencorvus-ai/plugin"

const producer = {
  owner_kind: "projected-worker" as const, expert_squad_id: "evolution-lab",
  package_revision: { scope: "built_in" as const, project_id: null, namespace: "builtin", id: "evolution-lab",
    version: "2026.09.27.9", package_digest: "a".repeat(64) },
  agent_id: "evolution-safety-auditor", projection_hash: "b".repeat(64),
  session_id: "source-session", message_id: "source-message", tool_call_id: "source-call",
}
const mission = { owner_kind: "mission" as const, mission_id: "mission", session_id: "mission-session",
  message_id: "import-message", tool_call_id: "import-call" }
function locator(id: string): EngineArtifactLocator {
  return { source: "engine_artifact", artifact_id: id, catalog_revision: 1, expected_sha256: "c".repeat(64) }
}
function native(id: string, payload: unknown, type = "evolution-lab/integrity-review") {
  return { locator: locator(id), envelope: EngineArtifactEnvelopeSchema.parse({
    artifact_type: type, schema_version: 1, producer, payload, resources: [],
    observed_artifact_locators: [], source_artifact_locators: [],
  }) }
}
function imported(id: string, source: ReturnType<typeof native>) {
  const old = source.envelope.import_lineage
  const prior = old ? [{ ...old, prior_imports: undefined }, ...(old.prior_imports ?? [])] : []
  return { locator: locator(id), envelope: EngineArtifactEnvelopeSchema.parse({
    ...source.envelope, producer: mission,
    import_lineage: {
      source_task_id: `task-${source.locator.artifact_id}`, source_locator: source.locator,
      source_kind: "expert_output", source_producer: source.envelope.producer,
      source_provenance: { observed_artifact_locators: [], source_artifact_locators: source.envelope.source_artifact_locators },
      ...(prior.length ? { prior_imports: prior.map(({ prior_imports: ignored, ...fact }) => fact) } : {}),
    },
  }) }
}

test("resolves all transported identities while preserving independent native publications", () => {
  const original = native("original", { value: 1 })
  const first = imported("first", original)
  const second = imported("second", first)
  const parallel = imported("parallel", original)
  const independent = native("independent", { value: 1 })
  const references = createEvolutionArtifactReferences([second, parallel, independent])
  expect(references.resolve(original.locator).map((item) => item.locator.artifact_id)).toEqual(["parallel", "second"])
  expect(references.resolve(first.locator).map((item) => item.locator.artifact_id)).toEqual(["parallel", "second"])
  expect(references.resolve(second.locator).map((item) => item.locator.artifact_id)).toEqual(["second", "parallel"])
  expect(references.resolve(independent.locator).map((item) => item.locator.artifact_id)).toEqual(["independent"])
  expect(evolutionArtifactProvenance(second.envelope)).toEqual({ producer, sources: [] })
  expect(() => createEvolutionArtifactReferences([independent]).require(original.locator)).toThrow(
    new EvolutionArtifactReferenceError("missing_source", original.locator),
  )
})

test("reports contradictory payloads attributed to the same exact imported original", () => {
  const original = native("source", { value: 1 })
  const copy = imported("copy", original)
  const changed = { ...imported("changed", original), envelope: { ...copy.envelope, payload: { value: 2 } } }
  expect(() => createEvolutionArtifactReferences([copy, changed])).toThrow(
    new EvolutionArtifactReferenceError("conflicting_identity", changed.locator),
  )
})

test("resolves explicit revisions across transport aliases without replacing independent Reviews", () => {
  const evaluation = native("evaluation", { score: 1 }, "evolution-lab/evaluation-result")
  const importedEvaluation = imported("local-evaluation", evaluation)
  const review = EvolutionArtifactSchemas["evolution-lab/integrity-review"].parse({
    case_id: "case", arm: "baseline", repetition: 0, evaluation_result_locator: evaluation.locator,
    status: "reviewed", findings: [], accepted_limitations: [], unknowns: [],
  })
  const original = native("review", review)
  const a = imported("review-copy-a", original)
  const b = imported("review-copy-b", original)
  const independent = native("independent-review", review)
  const revision = native("revision", { ...review, evaluation_result_locator: importedEvaluation.locator,
    revision: { supersedes: [original.locator], reason: "Reconsidered the same recorded evidence." } })
  const references = createEvolutionArtifactReferences([importedEvaluation, a, b, independent, revision])
  const resolved = resolveEvolutionIntegrityReviews([a, b, independent, revision].map((item) => ({
    locator: item.locator, value: EvolutionArtifactSchemas["evolution-lab/integrity-review"].parse(item.envelope.payload),
  })), references.key)
  expect(resolved.superseded.map((item) => item.locator)).toEqual([a.locator, b.locator])
  expect(resolved.current.map((item) => item.locator)).toEqual([independent.locator, revision.locator])
  const allCopies = native("revision-all-copies", { ...review,
    evaluation_result_locator: importedEvaluation.locator,
    revision: { supersedes: [a.locator, b.locator], reason: "Explicitly identifies both delivered copies of the same original." },
  })
  const allCopyReferences = createEvolutionArtifactReferences([importedEvaluation, a, b, allCopies])
  const merged = resolveEvolutionIntegrityReviews([a, b, allCopies].map((item) => ({
    locator: item.locator, value: EvolutionArtifactSchemas["evolution-lab/integrity-review"].parse(item.envelope.payload),
  })), allCopyReferences.key)
  expect(merged.superseded.map((item) => item.locator)).toEqual([a.locator, b.locator])
  expect(merged.current.map((item) => item.locator)).toEqual([allCopies.locator])
})
