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
  SalesStrategyArtifactLabels,
  SalesStrategyPublishableArtifactInputSchema,
  SalesStrategyArtifactTypeSchema,
  SALESSTRATEGY_TERMINAL_ARTIFACT_TYPE,
  parseSalesStrategyArtifact,
  type SalesStrategyArtifactType,
} from "../lib/sales-strategy/artifacts"

const expectedSources: Readonly<Record<SalesStrategyArtifactType, readonly SalesStrategyArtifactType[]>> = {
  "sales-strategy/research-charter": [],
  "sales-strategy/customer-dossier": ["sales-strategy/research-charter"],
  "sales-strategy/opportunity-analysis": ["sales-strategy/customer-dossier"],
  "sales-strategy/positioning-analysis": ["sales-strategy/customer-dossier"],
  "sales-strategy/strategy-brief": ["sales-strategy/opportunity-analysis", "sales-strategy/positioning-analysis"],
  "sales-strategy/audit": ["sales-strategy/strategy-brief"],
  "sales-strategy/playbook": ["sales-strategy/research-charter", "sales-strategy/customer-dossier", "sales-strategy/opportunity-analysis", "sales-strategy/positioning-analysis", "sales-strategy/strategy-brief", "sales-strategy/audit"],
}

const producerByType: Readonly<Record<SalesStrategyArtifactType, string>> = {
  "sales-strategy/research-charter": "sales-strategy-planner",
  "sales-strategy/customer-dossier": "sales-customer-researcher",
  "sales-strategy/opportunity-analysis": "sales-opportunity-analyst",
  "sales-strategy/positioning-analysis": "sales-positioning-analyst",
  "sales-strategy/strategy-brief": "sales-strategy-synthesizer",
  "sales-strategy/audit": "sales-strategy-fact-checker",
  "sales-strategy/playbook": "sales-playbook-writer",
}

export default tool({
  description: "Validate and publish one complete sales-strategy Artifact ABI value with exact sources and immutable resources.",
  args: {
    artifact: SalesStrategyPublishableArtifactInputSchema,
    resource_set: TaskArtifactResourceSetLocatorSchema.nullable(),
    source_artifact_locators: tool.schema.array(ArtifactReadLocatorSchema),
  },
  async execute(args, context) {
    const artifactType = args.artifact.artifact_type
    const payload = parseSalesStrategyArtifact(artifactType, args.artifact.payload)
    const expected = expectedSources[artifactType]
    if (args.source_artifact_locators.length !== expected.length) {
      throw new Error(artifactType + " requires " + expected.length + " exact source Artifact locator(s)")
    }
    const batch = await readExactArtifactsSettled(context.host.engineArtifacts, args.source_artifact_locators)
    if (batch.diagnostics.length > 0) {
      throw new AggregateError(batch.diagnostics.map((item) => item.error), "Sales Strategy & Customer Research predecessor read failed")
    }
    const observedTypes = new Set<SalesStrategyArtifactType>()
    for (const read of batch.reads) {
      const envelope = inspectEngineArtifactEnvelope(read, { schemaVersion: 1 })
      const sourceType = SalesStrategyArtifactTypeSchema.parse(envelope.artifact_type)
      if (!expected.includes(sourceType) || observedTypes.has(sourceType)) {
        throw new Error(artifactType + " received an unexpected or duplicate source " + sourceType)
      }
      inspectEngineArtifactEnvelope(read, {
        artifactType: sourceType,
        schemaVersion: 1,
        producer: {
          ownerKind: "projected-worker",
          expertSquadID: "sales-strategy",
          agentID: producerByType[sourceType],
        },
      })
      parseSalesStrategyArtifact(sourceType, envelope.payload)
      observedTypes.add(sourceType)
    }
    if (expected.some((sourceType) => !observedTypes.has(sourceType))) {
      throw new Error(artifactType + " is missing a required typed predecessor")
    }
    const isTerminal = artifactType === SALESSTRATEGY_TERMINAL_ARTIFACT_TYPE
    if (isTerminal !== (args.resource_set !== null)) {
      throw new Error(
        isTerminal
          ? "sales-strategy/playbook requires the exact canonical report resource set"
          : artifactType + " must not attach a terminal report resource set",
      )
    }
    await selectExactArtifactSources(context.host.engineArtifacts, batch.reads, "Typed predecessors for " + artifactType)
    const resources = args.resource_set ? await context.host.taskArtifacts.resources(args.resource_set) : []
    const publication = await context.host.engineArtifacts.publish({
      artifact_type: artifactType,
      schema_version: 1,
      label: SalesStrategyArtifactLabels[artifactType],
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
