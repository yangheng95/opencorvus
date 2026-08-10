// ABI means Application Binary Interface.

import {
  ArtifactReadLocatorSchema,
  TaskArtifactResourceSetLocatorSchema,
  inspectEngineArtifactEnvelope,
  readExactArtifactsSettled,
  selectExactArtifactSources,
  tool,
} from "@opencorvus-ai/plugin"
import {
  VIRAL_CONTENT_SCHEMA_VERSION,
  ViralContentArtifactTypeSchema,
  parseViralContentArtifact,
  type ViralContentArtifactType,
} from "../lib/viral-content/artifacts"

const expectedSources: Readonly<Record<ViralContentArtifactType, readonly ViralContentArtifactType[]>> = {
  "viral-content/campaign-brief": [],
  "viral-content/audience-dossier": ["viral-content/campaign-brief"],
  "viral-content/trend-dossier": ["viral-content/campaign-brief"],
  "viral-content/concept-set": ["viral-content/audience-dossier", "viral-content/trend-dossier"],
  "viral-content/copy-pack": ["viral-content/concept-set"],
  "viral-content/review": ["viral-content/copy-pack"],
  "viral-content/delivery": [
    "viral-content/campaign-brief",
    "viral-content/audience-dossier",
    "viral-content/trend-dossier",
    "viral-content/concept-set",
    "viral-content/copy-pack",
    "viral-content/review",
  ],
}

const producerByType: Readonly<Record<ViralContentArtifactType, string>> = {
  "viral-content/campaign-brief": "viral-brief-strategist",
  "viral-content/audience-dossier": "viral-audience-researcher",
  "viral-content/trend-dossier": "viral-trend-researcher",
  "viral-content/concept-set": "viral-concept-strategist",
  "viral-content/copy-pack": "viral-copy-producer",
  "viral-content/review": "viral-content-reviewer",
  "viral-content/delivery": "viral-delivery-owner",
}

const labels: Readonly<Record<ViralContentArtifactType, string>> = {
  "viral-content/campaign-brief": "Viral content campaign brief",
  "viral-content/audience-dossier": "Viral content audience dossier",
  "viral-content/trend-dossier": "Viral content trend dossier",
  "viral-content/concept-set": "Viral content concept set",
  "viral-content/copy-pack": "Viral content copy pack",
  "viral-content/review": "Viral content independent review",
  "viral-content/delivery": "Viral content campaign delivery",
}

export default tool({
  description: "Validate and publish one strict viral-content Artifact with exact typed predecessors and immutable resources.",
  args: {
    artifact_type: ViralContentArtifactTypeSchema,
    payload: tool.schema.unknown(),
    resource_set: TaskArtifactResourceSetLocatorSchema.nullable(),
    source_artifact_locators: tool.schema.array(ArtifactReadLocatorSchema),
  },
  async execute(args, context) {
    const payload = parseViralContentArtifact(args.artifact_type, args.payload)
    const expected = expectedSources[args.artifact_type]
    if (args.source_artifact_locators.length !== expected.length) {
      throw new Error(`${args.artifact_type} requires ${expected.length} exact source Artifact locator(s)`)
    }
    const batch = await readExactArtifactsSettled(context.host.engineArtifacts, args.source_artifact_locators)
    if (batch.diagnostics.length > 0) {
      throw new AggregateError(batch.diagnostics.map((item) => item.error), "Viral Content predecessor read failed")
    }
    const observedTypes = new Set<ViralContentArtifactType>()
    for (const read of batch.reads) {
      const envelope = inspectEngineArtifactEnvelope(read, { schemaVersion: VIRAL_CONTENT_SCHEMA_VERSION })
      const sourceType = ViralContentArtifactTypeSchema.parse(envelope.artifact_type)
      if (!expected.includes(sourceType) || observedTypes.has(sourceType)) {
        throw new Error(`${args.artifact_type} received an unexpected or duplicate source ${sourceType}`)
      }
      inspectEngineArtifactEnvelope(read, {
        artifactType: sourceType,
        schemaVersion: VIRAL_CONTENT_SCHEMA_VERSION,
        producer: {
          ownerKind: "projected-worker",
          expertSquadID: "viral-content",
          agentID: producerByType[sourceType],
        },
      })
      parseViralContentArtifact(sourceType, envelope.payload)
      observedTypes.add(sourceType)
    }
    if (expected.some((sourceType) => !observedTypes.has(sourceType))) {
      throw new Error(`${args.artifact_type} is missing a required typed predecessor`)
    }
    const deliveryPublication = args.artifact_type === "viral-content/delivery"
    if (deliveryPublication !== Boolean(args.resource_set)) {
      throw new Error(
        deliveryPublication
          ? "viral-content/delivery requires its exact campaign resource set"
          : "Only viral-content/delivery may publish file resources",
      )
    }
    await selectExactArtifactSources(
      context.host.engineArtifacts,
      batch.reads,
      `Typed predecessors for ${args.artifact_type}`,
    )
    const resources = args.resource_set ? await context.host.taskArtifacts.resources(args.resource_set) : []
    context.metadata({ title: `Viral Content: ${args.artifact_type.split("/")[1]}` })
    const publication = await context.host.engineArtifacts.publish({
      artifact_type: args.artifact_type,
      schema_version: VIRAL_CONTENT_SCHEMA_VERSION,
      label: labels[args.artifact_type],
      payload,
      resources,
      source_artifact_locators: batch.reads.map((read) => read.locator),
    })
    return JSON.stringify({
      artifact_type: args.artifact_type,
      schema_version: VIRAL_CONTENT_SCHEMA_VERSION,
      locator: publication.locator,
      artifact_sha256: publication.sha256,
    })
  },
})
