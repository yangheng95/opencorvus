// ABI means Application Binary Interface. JSON means JavaScript Object Notation.
// SHA-256 means Secure Hash Algorithm 256-bit.

import {
  ArtifactReadLocatorSchema,
  TaskArtifactResourceSetLocatorSchema,
  inspectEngineArtifactEnvelope,
  readExactArtifactsSettled,
  selectExactArtifactSources,
  tool,
} from "@opencorvus-ai/plugin"
import {
  DataAnalysisArtifactLabels,
  DataAnalysisPublishableArtifactInputSchema,
  DataAnalysisArtifactTypeSchema,
  DATAANALYSIS_TERMINAL_ARTIFACT_TYPE,
  parseDataAnalysisArtifact,
  type DataAnalysisArtifactType,
} from "../lib/data-analysis/artifacts"

const expectedSources: Readonly<Record<DataAnalysisArtifactType, readonly DataAnalysisArtifactType[]>> = {
  "data-analysis/analysis-charter": [],
  "data-analysis/data-dossier": ["data-analysis/analysis-charter"],
  "data-analysis/performance-analysis": ["data-analysis/data-dossier"],
  "data-analysis/segment-analysis": ["data-analysis/data-dossier"],
  "data-analysis/insight-brief": ["data-analysis/performance-analysis", "data-analysis/segment-analysis"],
  "data-analysis/audit": ["data-analysis/insight-brief"],
  "data-analysis/report": ["data-analysis/analysis-charter", "data-analysis/data-dossier", "data-analysis/performance-analysis", "data-analysis/segment-analysis", "data-analysis/insight-brief", "data-analysis/audit"],
}

const producerByType: Readonly<Record<DataAnalysisArtifactType, string>> = {
  "data-analysis/analysis-charter": "data-analysis-planner",
  "data-analysis/data-dossier": "data-analysis-data-steward",
  "data-analysis/performance-analysis": "data-analysis-performance-analyst",
  "data-analysis/segment-analysis": "data-analysis-segment-analyst",
  "data-analysis/insight-brief": "data-analysis-insight-synthesizer",
  "data-analysis/audit": "data-analysis-fact-checker",
  "data-analysis/report": "data-analysis-report-writer",
}

export default tool({
  description: "Validate and publish one complete data-analysis Artifact ABI value with exact sources and immutable resources.",
  args: {
    artifact: DataAnalysisPublishableArtifactInputSchema,
    resource_set: TaskArtifactResourceSetLocatorSchema.nullable(),
    source_artifact_locators: tool.schema.array(ArtifactReadLocatorSchema),
  },
  async execute(args, context) {
    const artifactType = args.artifact.artifact_type
    const payload = parseDataAnalysisArtifact(artifactType, args.artifact.payload)
    const expected = expectedSources[artifactType]
    if (args.source_artifact_locators.length !== expected.length) {
      throw new Error(artifactType + " requires " + expected.length + " exact source Artifact locator(s)")
    }
    const batch = await readExactArtifactsSettled(context.host.engineArtifacts, args.source_artifact_locators)
    if (batch.diagnostics.length > 0) {
      throw new AggregateError(batch.diagnostics.map((item) => item.error), "Data Analysis & Business Insights predecessor read failed")
    }
    const observedTypes = new Set<DataAnalysisArtifactType>()
    for (const read of batch.reads) {
      const envelope = inspectEngineArtifactEnvelope(read, { schemaVersion: 1 })
      const sourceType = DataAnalysisArtifactTypeSchema.parse(envelope.artifact_type)
      if (!expected.includes(sourceType) || observedTypes.has(sourceType)) {
        throw new Error(artifactType + " received an unexpected or duplicate source " + sourceType)
      }
      inspectEngineArtifactEnvelope(read, {
        artifactType: sourceType,
        schemaVersion: 1,
        producer: {
          ownerKind: "projected-worker",
          expertSquadID: "data-analysis",
          agentID: producerByType[sourceType],
        },
      })
      parseDataAnalysisArtifact(sourceType, envelope.payload)
      observedTypes.add(sourceType)
    }
    if (expected.some((sourceType) => !observedTypes.has(sourceType))) {
      throw new Error(artifactType + " is missing a required typed predecessor")
    }
    const isTerminal = artifactType === DATAANALYSIS_TERMINAL_ARTIFACT_TYPE
    if (isTerminal !== (args.resource_set !== null)) {
      throw new Error(
        isTerminal
          ? "data-analysis/report requires the exact canonical report resource set"
          : artifactType + " must not attach a terminal report resource set",
      )
    }
    await selectExactArtifactSources(context.host.engineArtifacts, batch.reads, "Typed predecessors for " + artifactType)
    const resources = args.resource_set ? await context.host.taskArtifacts.resources(args.resource_set) : []
    const publication = await context.host.engineArtifacts.publish({
      artifact_type: artifactType,
      schema_version: 1,
      label: DataAnalysisArtifactLabels[artifactType],
      payload,
      resources,
      source_artifact_locators: batch.reads.map((read) => read.locator),
    })
    return JSON.stringify({
      artifact_type: artifactType,
      schema_version: 1,
      locator: publication.locator,
      artifact_sha256: publication.sha256,
    })
  },
})
