import {
  ArtifactReadLocatorSchema,
  EngineArtifactEnvelopeSchema,
  TaskArtifactResourceSetLocatorSchema,
  tool,
  type EngineArtifactLocator,
  type ToolContext,
} from "@opencorvus-ai/plugin"
import {
  MarketingGrowthArtifactTypeSchema,
  marketingGrowthArtifactDependencies,
  parseMarketingGrowthArtifact,
} from "../lib/marketing-growth/artifacts"

const producerByType = {
  "marketing-growth/growth-brief": "marketing-growth-planner",
  "marketing-growth/evidence-dossier": "marketing-growth-evidence-researcher",
  "marketing-growth/audience-analysis": "marketing-growth-audience-analyst",
  "marketing-growth/channel-analysis": "marketing-growth-channel-analyst",
  "marketing-growth/growth-strategy": "marketing-growth-strategist",
  "marketing-growth/audit": "marketing-growth-fact-checker",
  "marketing-growth/campaign-plan": "marketing-growth-campaign-writer",
} as const

async function readSource(locator: EngineArtifactLocator, context: ToolContext) {
  let offset = 0
  let text = ""
  for (;;) {
    const result = await context.host.engineArtifacts.read({ locator, byte_offset: offset, max_bytes: 65_536, delivery: "inline" })
    if (result.chunk.text === undefined) throw new Error("Marketing & Growth Strategy source Artifact must be readable JSON text")
    text += result.chunk.text
    if (result.chunk.complete) break
    if (result.chunk.next_offset === null) throw new Error("Marketing & Growth Strategy source Artifact ended before completion")
    offset = result.chunk.next_offset
  }
  await context.host.engineArtifacts.select({ locator, purpose: "Exact predecessor for Marketing & Growth Strategy" })
  return EngineArtifactEnvelopeSchema.parse(JSON.parse(text))
}

export default tool({
  description: "Validate and publish one strict marketing-growth Artifact ABI value with exact selected predecessors and immutable resources.",
  args: {
    artifact_type: MarketingGrowthArtifactTypeSchema,
    payload: tool.schema.unknown(),
    resource_set: TaskArtifactResourceSetLocatorSchema.nullable(),
    source_artifact_locators: tool.schema.array(ArtifactReadLocatorSchema),
  },
  async execute(args, context) {
    const parsed = parseMarketingGrowthArtifact(args.artifact_type, args.payload)
    if (context.agent !== producerByType[parsed.artifactType])
      throw new Error("Marketing & Growth Strategy " + parsed.artifactType + " must be published by " + producerByType[parsed.artifactType])
    const sources = await Promise.all(args.source_artifact_locators.map((locator) => readSource(locator, context)))
    const expectedTypes = [...marketingGrowthArtifactDependencies[parsed.artifactType]].sort()
    const actualTypes = sources.map((source) => source.artifact_type).sort()
    if (JSON.stringify(actualTypes) !== JSON.stringify(expectedTypes))
      throw new Error("Marketing & Growth Strategy " + parsed.artifactType + " requires exact predecessor types " + expectedTypes.join(", "))
    for (const source of sources) {
      const sourceType = MarketingGrowthArtifactTypeSchema.parse(source.artifact_type)
      if (
        source.producer.owner_kind !== "projected-worker" ||
        source.producer.expert_squad_id !== "marketing-growth" ||
        source.producer.agent_id !== producerByType[sourceType]
      ) throw new Error("Marketing & Growth Strategy source " + sourceType + " has the wrong projected worker producer")
    }
    const resources = args.resource_set ? await context.host.taskArtifacts.resources(args.resource_set) : []
    if (parsed.artifactType === "marketing-growth/campaign-plan" && resources.length === 0)
      throw new Error("Marketing & Growth Strategy terminal delivery requires its canonical immutable resource set")
    const publication = await context.host.engineArtifacts.publish({
      artifact_type: parsed.artifactType,
      schema_version: 1,
      label: parsed.artifactType,
      payload: parsed.payload,
      resources,
      source_artifact_locators: args.source_artifact_locators,
    })
    return JSON.stringify({ artifact_type: parsed.artifactType, schema_version: 1, locator: publication.locator, artifact_sha256: publication.sha256 })
  },
})
