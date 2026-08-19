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
  COMMERCIAL_LEGAL_SCHEMA_VERSION,
  CommercialLegalPublishableArtifactInputSchema,
  CommercialLegalArtifactTypeSchema,
  parseCommercialLegalArtifact,
  type CommercialLegalArtifactType,
} from "../lib/commercial-legal/artifacts"

const expectedSources: Readonly<Record<CommercialLegalArtifactType, readonly CommercialLegalArtifactType[]>> = {
  "commercial-legal/matter-charter": [],
  "commercial-legal/authority-dossier": ["commercial-legal/matter-charter"],
  "commercial-legal/contract-analysis": ["commercial-legal/authority-dossier"],
  "commercial-legal/regulatory-analysis": ["commercial-legal/authority-dossier"],
  "commercial-legal/legal-strategy": ["commercial-legal/contract-analysis", "commercial-legal/regulatory-analysis"],
  "commercial-legal/audit": ["commercial-legal/legal-strategy"],
  "commercial-legal/report": [
    "commercial-legal/matter-charter",
    "commercial-legal/authority-dossier",
    "commercial-legal/contract-analysis",
    "commercial-legal/regulatory-analysis",
    "commercial-legal/legal-strategy",
    "commercial-legal/audit",
  ],
}

const producerByType: Readonly<Record<CommercialLegalArtifactType, string>> = {
  "commercial-legal/matter-charter": "commercial-legal-matter-planner",
  "commercial-legal/authority-dossier": "commercial-legal-authority-researcher",
  "commercial-legal/contract-analysis": "commercial-legal-contract-analyst",
  "commercial-legal/regulatory-analysis": "commercial-legal-regulatory-analyst",
  "commercial-legal/legal-strategy": "commercial-legal-strategy-counsel",
  "commercial-legal/audit": "commercial-legal-fact-checker",
  "commercial-legal/report": "commercial-legal-report-writer",
}

export default tool({
  description: "Validate and publish one Commercial Legal typed Artifact with exact package-owned sources and immutable report resources.",
  args: {
    artifact: CommercialLegalPublishableArtifactInputSchema,
    resource_set: TaskArtifactResourceSetLocatorSchema.nullable(),
    source_artifact_locators: tool.schema.array(ArtifactReadLocatorSchema),
  },
  async execute(args, context) {
    const artifactType = args.artifact.artifact_type
    const payload = parseCommercialLegalArtifact(artifactType, args.artifact.payload)
    const expected = expectedSources[artifactType]
    if (args.source_artifact_locators.length !== expected.length) {
      throw new Error(`${artifactType} requires ${expected.length} exact source Artifact locator(s)`)
    }
    const batch = await readExactArtifactsSettled(context.host.engineArtifacts, args.source_artifact_locators)
    if (batch.diagnostics.length > 0) {
      throw new AggregateError(batch.diagnostics.map((item) => item.error), "Commercial Legal predecessor read failed")
    }
    const observedTypes = new Set<CommercialLegalArtifactType>()
    for (const read of batch.reads) {
      const envelope = inspectEngineArtifactEnvelope(read, { schemaVersion: COMMERCIAL_LEGAL_SCHEMA_VERSION })
      const sourceType = CommercialLegalArtifactTypeSchema.parse(envelope.artifact_type)
      if (!expected.includes(sourceType) || observedTypes.has(sourceType)) {
        throw new Error(`${artifactType} received an unexpected or duplicate source ${sourceType}`)
      }
      inspectEngineArtifactEnvelope(read, {
        artifactType: sourceType,
        schemaVersion: COMMERCIAL_LEGAL_SCHEMA_VERSION,
        producer: {
          ownerKind: "projected-worker",
          expertSquadID: "commercial-legal",
          agentID: producerByType[sourceType],
        },
      })
      parseCommercialLegalArtifact(sourceType, envelope.payload)
      observedTypes.add(sourceType)
    }
    if (expected.some((sourceType) => !observedTypes.has(sourceType))) {
      throw new Error(`${artifactType} is missing a required typed predecessor`)
    }
    const reportPublication = artifactType === "commercial-legal/report"
    if (reportPublication !== Boolean(args.resource_set)) {
      throw new Error(reportPublication ? "commercial-legal/report requires its exact Markdown resource set" : "Only commercial-legal/report may publish file resources")
    }
    await selectExactArtifactSources(context.host.engineArtifacts, batch.reads, `Typed predecessors for ${artifactType}`)
    const resources = args.resource_set ? await context.host.taskArtifacts.resources(args.resource_set) : []
    context.metadata({ title: `Commercial Legal: ${artifactType.split("/")[1]}` })
    const publication = await context.host.engineArtifacts.publish({
      artifact_type: artifactType,
      schema_version: COMMERCIAL_LEGAL_SCHEMA_VERSION,
      label: artifactType,
      payload,
      resources,
    })
    return JSON.stringify({
      artifact_type: artifactType,
      schema_version: COMMERCIAL_LEGAL_SCHEMA_VERSION,
      locator: publication.locator,
      artifact_sha256: publication.sha256,
    })
  },
})
