import {
  EngineArtifactLocatorSchema,
  inspectEngineArtifactEnvelope,
  readExactArtifactsSettled,
  selectExactArtifactSources,
  TaskArtifactResourceSetLocatorSchema,
  tool,
} from "@opencorvus-ai/plugin"
import {
  SeoGeoPublishableArtifactInputSchema,
  SeoGeoArtifactTypeSchema,
  seoGeoArtifactDependencies,
  parseSeoGeoArtifact,
} from "../lib/seo-geo/artifacts"

const producerByType = {
  "seo-geo/discovery-brief": "seo-geo-planner",
  "seo-geo/source-dossier": "seo-geo-source-researcher",
  "seo-geo/search-analysis": "seo-geo-search-analyst",
  "seo-geo/generative-analysis": "seo-geo-generative-analyst",
  "seo-geo/discoverability-strategy": "seo-geo-strategist",
  "seo-geo/audit": "seo-geo-fact-checker",
  "seo-geo/optimization-plan": "seo-geo-plan-writer",
} as const

export default tool({
  description: "Validate and publish one strict seo-geo Artifact ABI value with exact selected predecessors and immutable resources.",
  args: {
    artifact: SeoGeoPublishableArtifactInputSchema,
    resource_set: TaskArtifactResourceSetLocatorSchema.nullable(),
    predecessor_artifact_locators: tool.schema.array(EngineArtifactLocatorSchema).describe("Exact typed Engine Artifact predecessors required by this stage; use [] for a root stage. Original file evidence is selected separately through real read/select and retained by the Host in output provenance."),
  },
  async execute(args, context) {
    const parsed = parseSeoGeoArtifact(args.artifact.artifact_type, args.artifact.payload)
    if (context.agent !== producerByType[parsed.artifactType])
      throw new Error("SEO & Generative Engine Optimization " + parsed.artifactType + " must be published by " + producerByType[parsed.artifactType])
    const batch = await readExactArtifactsSettled(context.host.engineArtifacts, args.predecessor_artifact_locators)
    if (batch.diagnostics.length) throw new AggregateError(batch.diagnostics.map(item => item.error), "SEO & Generative Engine Optimization predecessor read failed")
    const sources = batch.reads.map(read => inspectEngineArtifactEnvelope(read, { schemaVersion: 1 }))
    const expectedTypes = [...seoGeoArtifactDependencies[parsed.artifactType]].sort()
    const actualTypes = sources.map((source) => source.artifact_type).sort()
    if (JSON.stringify(actualTypes) !== JSON.stringify(expectedTypes))
      throw new Error("SEO & Generative Engine Optimization " + parsed.artifactType + " requires exact predecessor types " + expectedTypes.join(", "))
    for (const source of sources) {
      const sourceType = SeoGeoArtifactTypeSchema.parse(source.artifact_type)
      if (
        source.producer.owner_kind !== "projected-worker" ||
        source.producer.expert_squad_id !== "seo-geo" ||
        source.producer.agent_id !== producerByType[sourceType]
      ) throw new Error("SEO & Generative Engine Optimization source " + sourceType + " has the wrong projected worker producer")
      parseSeoGeoArtifact(sourceType, source.payload)
    }
    await selectExactArtifactSources(context.host.engineArtifacts, batch.reads, "Typed predecessors for " + parsed.artifactType)
    const resources = args.resource_set ? await context.host.taskArtifacts.resources(args.resource_set) : []
    if (parsed.artifactType === "seo-geo/optimization-plan" && resources.length === 0)
      throw new Error("SEO & Generative Engine Optimization terminal delivery requires its canonical immutable resource set")
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
