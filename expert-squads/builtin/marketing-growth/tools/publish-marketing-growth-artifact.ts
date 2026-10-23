import {
  EngineArtifactLocatorSchema,
  inspectEngineArtifactEnvelope,
  readExactArtifactsSettled,
  selectExactArtifactSources,
  TaskArtifactResourceSetLocatorSchema,
  tool,
} from "@opencorvus-ai/plugin"
import {
  MarketingGrowthPublishableArtifactInputSchema,
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

export default tool({
  description: "Validate and publish one strict marketing-growth Artifact ABI value with exact selected predecessors and immutable resources.",
  args: {
    artifact: MarketingGrowthPublishableArtifactInputSchema,
    resource_set: TaskArtifactResourceSetLocatorSchema.nullable(),
    predecessor_artifact_locators: tool.schema.array(EngineArtifactLocatorSchema).describe("Exact typed Engine Artifact predecessors required by this stage; use [] for a root stage. Original file evidence is selected separately through real read/select and retained by the Host in output provenance."),
  },
  async execute(args, context) {
    const parsed = parseMarketingGrowthArtifact(args.artifact.artifact_type, args.artifact.payload)
    if (context.agent !== producerByType[parsed.artifactType])
      throw new Error("Marketing & Growth Strategy " + parsed.artifactType + " must be published by " + producerByType[parsed.artifactType])
    const batch = await readExactArtifactsSettled(context.host.engineArtifacts, args.predecessor_artifact_locators)
    if (batch.diagnostics.length) throw new AggregateError(batch.diagnostics.map(item => item.error), "Marketing & Growth Strategy predecessor read failed")
    const sources = batch.reads.map(read => inspectEngineArtifactEnvelope(read, { schemaVersion: 1 }))
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
      parseMarketingGrowthArtifact(sourceType, source.payload)
    }
    await selectExactArtifactSources(context.host.engineArtifacts, batch.reads, "Typed predecessors for " + parsed.artifactType)
    const resources = args.resource_set ? await context.host.taskArtifacts.resources(args.resource_set) : []
    if (parsed.artifactType === "marketing-growth/campaign-plan" && resources.length === 0)
      throw new Error("Marketing & Growth Strategy terminal delivery requires its canonical immutable resource set")
    const publication = await context.host.engineArtifacts.publish({
      artifact_type: parsed.artifactType,
      schema_version: 1,
      label: parsed.artifactType,
      payload: parsed.payload,
      resources,
    })
    return JSON.stringify({ artifact_type: parsed.artifactType, schema_version: 1, locator: publication.locator, artifact_sha256: publication.sha256 })
  },
})
