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
  OMNICHANNEL_SCHEMA_VERSION,
  OmnichannelPublishableArtifactInputSchema,
  OmnichannelArtifactTypeSchema,
  parseOmnichannelArtifact,
  type OmnichannelArtifactType,
} from "../lib/omnichannel-distribution/artifacts"

const expectedSources: Readonly<Record<OmnichannelArtifactType, readonly OmnichannelArtifactType[]>> = {
  "omnichannel-distribution/campaign-brief": [],
  "omnichannel-distribution/channel-spec-dossier": ["omnichannel-distribution/campaign-brief"],
  "omnichannel-distribution/rights-compliance-matrix": ["omnichannel-distribution/campaign-brief"],
  "omnichannel-distribution/channel-pack": [
    "omnichannel-distribution/channel-spec-dossier",
    "omnichannel-distribution/rights-compliance-matrix",
  ],
  "omnichannel-distribution/measurement-plan": [
    "omnichannel-distribution/channel-spec-dossier",
    "omnichannel-distribution/rights-compliance-matrix",
  ],
  "omnichannel-distribution/distribution-plan": [
    "omnichannel-distribution/channel-pack",
    "omnichannel-distribution/measurement-plan",
  ],
  "omnichannel-distribution/readiness-review": ["omnichannel-distribution/distribution-plan"],
  "omnichannel-distribution/delivery": [
    "omnichannel-distribution/campaign-brief",
    "omnichannel-distribution/channel-spec-dossier",
    "omnichannel-distribution/rights-compliance-matrix",
    "omnichannel-distribution/channel-pack",
    "omnichannel-distribution/measurement-plan",
    "omnichannel-distribution/distribution-plan",
    "omnichannel-distribution/readiness-review",
  ],
}

const producerByType: Readonly<Record<OmnichannelArtifactType, string>> = {
  "omnichannel-distribution/campaign-brief": "distribution-brief-planner",
  "omnichannel-distribution/channel-spec-dossier": "channel-spec-researcher",
  "omnichannel-distribution/rights-compliance-matrix": "rights-compliance-analyst",
  "omnichannel-distribution/channel-pack": "channel-adaptation-producer",
  "omnichannel-distribution/measurement-plan": "distribution-measurement-planner",
  "omnichannel-distribution/distribution-plan": "distribution-plan-synthesizer",
  "omnichannel-distribution/readiness-review": "distribution-readiness-reviewer",
  "omnichannel-distribution/delivery": "omnichannel-delivery-owner",
}

const labels: Readonly<Record<OmnichannelArtifactType, string>> = {
  "omnichannel-distribution/campaign-brief": "Omnichannel campaign brief",
  "omnichannel-distribution/channel-spec-dossier": "Omnichannel channel specification dossier",
  "omnichannel-distribution/rights-compliance-matrix": "Omnichannel rights and compliance matrix",
  "omnichannel-distribution/channel-pack": "Omnichannel channel adaptation pack",
  "omnichannel-distribution/measurement-plan": "Omnichannel measurement plan",
  "omnichannel-distribution/distribution-plan": "Omnichannel joined distribution plan",
  "omnichannel-distribution/readiness-review": "Omnichannel readiness review",
  "omnichannel-distribution/delivery": "Omnichannel delivery bundle",
}

export default tool({
  description: "Validate and publish one strict omnichannel-distribution Artifact with exact typed predecessors and immutable resources.",
  args: {
    artifact: OmnichannelPublishableArtifactInputSchema,
    resource_set: TaskArtifactResourceSetLocatorSchema.nullable(),
    source_artifact_locators: tool.schema.array(ArtifactReadLocatorSchema),
  },
  async execute(args, context) {
    const artifactType = args.artifact.artifact_type
    const payload = parseOmnichannelArtifact(artifactType, args.artifact.payload)
    const expected = expectedSources[artifactType]
    if (args.source_artifact_locators.length !== expected.length) {
      throw new Error(`${artifactType} requires ${expected.length} exact source Artifact locator(s)`)
    }
    const batch = await readExactArtifactsSettled(context.host.engineArtifacts, args.source_artifact_locators)
    if (batch.diagnostics.length > 0) {
      throw new AggregateError(
        batch.diagnostics.map((item) => item.error),
        "Omnichannel Distribution predecessor read failed",
      )
    }
    const observedTypes = new Set<OmnichannelArtifactType>()
    for (const read of batch.reads) {
      const envelope = inspectEngineArtifactEnvelope(read, { schemaVersion: OMNICHANNEL_SCHEMA_VERSION })
      const sourceType = OmnichannelArtifactTypeSchema.parse(envelope.artifact_type)
      if (!expected.includes(sourceType) || observedTypes.has(sourceType)) {
        throw new Error(`${artifactType} received an unexpected or duplicate source ${sourceType}`)
      }
      inspectEngineArtifactEnvelope(read, {
        artifactType: sourceType,
        schemaVersion: OMNICHANNEL_SCHEMA_VERSION,
        producer: {
          ownerKind: "projected-worker",
          expertSquadID: "omnichannel-distribution",
          agentID: producerByType[sourceType],
        },
      })
      parseOmnichannelArtifact(sourceType, envelope.payload)
      observedTypes.add(sourceType)
    }
    if (expected.some((sourceType) => !observedTypes.has(sourceType))) {
      throw new Error(`${artifactType} is missing a required typed predecessor`)
    }
    const deliveryPublication = artifactType === "omnichannel-distribution/delivery"
    if (deliveryPublication !== Boolean(args.resource_set)) {
      throw new Error(
        deliveryPublication
          ? "omnichannel-distribution/delivery requires its exact bundle resource set"
          : "Only omnichannel-distribution/delivery may publish file resources",
      )
    }
    await selectExactArtifactSources(
      context.host.engineArtifacts,
      batch.reads,
      `Typed predecessors for ${artifactType}`,
    )
    const resources = args.resource_set ? await context.host.taskArtifacts.resources(args.resource_set) : []
    context.metadata({ title: `Omnichannel Distribution: ${artifactType.split("/")[1]}` })
    const publication = await context.host.engineArtifacts.publish({
      artifact_type: artifactType,
      schema_version: OMNICHANNEL_SCHEMA_VERSION,
      label: labels[artifactType],
      payload,
      resources,
      source_artifact_locators: batch.reads.map((read) => read.locator),
    })
    return JSON.stringify({
      artifact_type: artifactType,
      schema_version: OMNICHANNEL_SCHEMA_VERSION,
      locator: publication.locator,
      artifact_sha256: publication.sha256,
    })
  },
})
