import {
  EngineArtifactEnvelopeSchema,
  evolutionArtifactProvenance,
  readExactArtifactsSettled,
  inspectEngineArtifactEnvelope,
  selectExactArtifactSources,
  type ArtifactReadLocator,
  type EngineArtifactLocator,
  type ToolContext,
} from "@opencorvus-ai/plugin"
import { EvolutionArtifactIntegrityError, parseEvolutionArtifact } from "./artifacts"

export const evolutionArtifactOwner = {
  "evolution-lab/opportunity": "evolution-observer",
  "evolution-lab/failure-attribution": "evolution-failure-analyst",
  "evolution-lab/campaign-spec": "evolution-experiment-planner",
  "evolution-lab/candidate-revision": "evolution-candidate-author",
  "evolution-lab/run-evidence-bundle": "evolution-evaluator",
  "evolution-lab/evaluation-result": "evolution-evaluator",
  "evolution-lab/integrity-review": "evolution-safety-auditor",
  "evolution-lab/comparison-recommendation": "evolution-recommendation-owner",
} as const

export function assertEvolutionArtifactOwner(artifactType: keyof typeof evolutionArtifactOwner, agentID: string) {
  const expectedAgent = evolutionArtifactOwner[artifactType]
  if (agentID !== expectedAgent)
    throw new EvolutionArtifactIntegrityError(
      `${artifactType} must be published by Evolution Lab worker ${expectedAgent}`,
    )
}

export function requireEvolutionWorkerProducer(
  envelope: ReturnType<typeof EngineArtifactEnvelopeSchema.parse>,
  agentID: string,
) {
  const { producer } = evolutionArtifactProvenance(envelope)
  if (
    producer?.owner_kind !== "projected-worker" ||
    producer.expert_squad_id !== "evolution-lab" ||
    producer.package_revision.id !== "evolution-lab" ||
    producer.agent_id !== agentID
  )
    throw new EvolutionArtifactIntegrityError(
      `${envelope.artifact_type} must be produced by Evolution Lab worker ${agentID}`,
    )
}

export async function readEngineArtifactEnvelope(
  locator: EngineArtifactLocator,
  context: ToolContext,
  purpose = "Exact Evolution Artifact predecessor",
  select = true,
) {
  const batch = await readExactArtifactsSettled(context.host.engineArtifacts, [locator])
  if (batch.diagnostics.length)
    throw new AggregateError(
      batch.diagnostics.map((item) => item.error),
      "Evolution predecessor read failed",
    )
  const envelope = inspectEngineArtifactEnvelope(batch.reads[0]!, { schemaVersion: 1 })
  const type = envelope.artifact_type
  if (type in evolutionArtifactOwner) {
    const artifactType = type as keyof typeof evolutionArtifactOwner
    requireEvolutionWorkerProducer(envelope, evolutionArtifactOwner[artifactType])
    parseEvolutionArtifact(artifactType, envelope.payload)
  }
  if (select) await selectExactArtifactSources(context.host.engineArtifacts, batch.reads, purpose)
  return envelope
}

export async function selectEvolutionEvidence(
  locators: readonly ArtifactReadLocator[],
  context: ToolContext,
  purpose: string,
) {
  const batch = await readExactArtifactsSettled(context.host.engineArtifacts, locators)
  if (batch.diagnostics.length)
    throw new AggregateError(
      batch.diagnostics.map((item) => item.error),
      "Evolution evidence read failed",
    )
  await selectExactArtifactSources(context.host.engineArtifacts, batch.reads, purpose)
}
