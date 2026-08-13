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
  HrOperationsArtifactLabels,
  HrOperationsPublishableArtifactInputSchema,
  HrOperationsArtifactTypeSchema,
  HROPERATIONS_TERMINAL_ARTIFACT_TYPE,
  parseHrOperationsArtifact,
  type HrOperationsArtifactType,
} from "../lib/hr-operations/artifacts"

const expectedSources: Readonly<Record<HrOperationsArtifactType, readonly HrOperationsArtifactType[]>> = {
  "hr-operations/operating-charter": [],
  "hr-operations/evidence-dossier": ["hr-operations/operating-charter"],
  "hr-operations/workforce-analysis": ["hr-operations/evidence-dossier"],
  "hr-operations/process-analysis": ["hr-operations/evidence-dossier"],
  "hr-operations/operating-plan-draft": ["hr-operations/process-analysis", "hr-operations/workforce-analysis"],
  "hr-operations/audit": ["hr-operations/operating-plan-draft"],
  "hr-operations/operating-plan": ["hr-operations/operating-charter", "hr-operations/evidence-dossier", "hr-operations/workforce-analysis", "hr-operations/process-analysis", "hr-operations/operating-plan-draft", "hr-operations/audit"],
}

const producerByType: Readonly<Record<HrOperationsArtifactType, string>> = {
  "hr-operations/operating-charter": "human-resources-operations-planner",
  "hr-operations/evidence-dossier": "human-resources-evidence-curator",
  "hr-operations/workforce-analysis": "workforce-analyst",
  "hr-operations/process-analysis": "people-process-analyst",
  "hr-operations/operating-plan-draft": "organization-operations-synthesizer",
  "hr-operations/audit": "human-resources-fact-checker",
  "hr-operations/operating-plan": "human-resources-operating-plan-writer",
}

export default tool({
  description: "Validate and publish one complete hr-operations Artifact ABI value with exact sources and immutable resources.",
  args: {
    artifact: HrOperationsPublishableArtifactInputSchema,
    resource_set: TaskArtifactResourceSetLocatorSchema.nullable(),
    source_artifact_locators: tool.schema.array(ArtifactReadLocatorSchema),
  },
  async execute(args, context) {
    const artifactType = args.artifact.artifact_type
    const payload = parseHrOperationsArtifact(artifactType, args.artifact.payload)
    const expected = expectedSources[artifactType]
    if (args.source_artifact_locators.length !== expected.length) {
      throw new Error(artifactType + " requires " + expected.length + " exact source Artifact locator(s)")
    }
    const batch = await readExactArtifactsSettled(context.host.engineArtifacts, args.source_artifact_locators)
    if (batch.diagnostics.length > 0) {
      throw new AggregateError(batch.diagnostics.map((item) => item.error), "Human Resources & Organization Operations predecessor read failed")
    }
    const observedTypes = new Set<HrOperationsArtifactType>()
    for (const read of batch.reads) {
      const envelope = inspectEngineArtifactEnvelope(read, { schemaVersion: 1 })
      const sourceType = HrOperationsArtifactTypeSchema.parse(envelope.artifact_type)
      if (!expected.includes(sourceType) || observedTypes.has(sourceType)) {
        throw new Error(artifactType + " received an unexpected or duplicate source " + sourceType)
      }
      inspectEngineArtifactEnvelope(read, {
        artifactType: sourceType,
        schemaVersion: 1,
        producer: {
          ownerKind: "projected-worker",
          expertSquadID: "hr-operations",
          agentID: producerByType[sourceType],
        },
      })
      parseHrOperationsArtifact(sourceType, envelope.payload)
      observedTypes.add(sourceType)
    }
    if (expected.some((sourceType) => !observedTypes.has(sourceType))) {
      throw new Error(artifactType + " is missing a required typed predecessor")
    }
    const isTerminal = artifactType === HROPERATIONS_TERMINAL_ARTIFACT_TYPE
    if (isTerminal !== (args.resource_set !== null)) {
      throw new Error(
        isTerminal
          ? "hr-operations/operating-plan requires the exact canonical report resource set"
          : artifactType + " must not attach a terminal report resource set",
      )
    }
    await selectExactArtifactSources(context.host.engineArtifacts, batch.reads, "Typed predecessors for " + artifactType)
    const resources = args.resource_set ? await context.host.taskArtifacts.resources(args.resource_set) : []
    const publication = await context.host.engineArtifacts.publish({
      artifact_type: artifactType,
      schema_version: 1,
      label: HrOperationsArtifactLabels[artifactType],
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
