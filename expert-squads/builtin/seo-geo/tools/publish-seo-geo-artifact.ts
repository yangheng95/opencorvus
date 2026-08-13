import {
  ArtifactReadLocatorSchema,
  EngineArtifactEnvelopeSchema,
  TaskArtifactResourceSetLocatorSchema,
  tool,
  type EngineArtifactLocator,
  type ToolContext,
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

async function readSource(locator: EngineArtifactLocator, context: ToolContext) {
  let offset = 0
  let text = ""
  for (;;) {
    const result = await context.host.engineArtifacts.read({ locator, byte_offset: offset, max_bytes: 65_536, delivery: "inline" })
    if (result.chunk.text === undefined) throw new Error("SEO & Generative Engine Optimization source Artifact must be readable JSON text")
    text += result.chunk.text
    if (result.chunk.complete) break
    if (result.chunk.next_offset === null) throw new Error("SEO & Generative Engine Optimization source Artifact ended before completion")
    offset = result.chunk.next_offset
  }
  await context.host.engineArtifacts.select({ locator, purpose: "Exact predecessor for SEO & Generative Engine Optimization" })
  return EngineArtifactEnvelopeSchema.parse(JSON.parse(text))
}

export default tool({
  description: "Validate and publish one strict seo-geo Artifact ABI value with exact selected predecessors and immutable resources.",
  args: {
    artifact: SeoGeoPublishableArtifactInputSchema,
    resource_set: TaskArtifactResourceSetLocatorSchema.nullable(),
    source_artifact_locators: tool.schema.array(ArtifactReadLocatorSchema),
  },
  async execute(args, context) {
    const parsed = parseSeoGeoArtifact(args.artifact.artifact_type, args.artifact.payload)
    if (context.agent !== producerByType[parsed.artifactType])
      throw new Error("SEO & Generative Engine Optimization " + parsed.artifactType + " must be published by " + producerByType[parsed.artifactType])
    const sources = await Promise.all(args.source_artifact_locators.map((locator) => readSource(locator, context)))
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
    }
    const resources = args.resource_set ? await context.host.taskArtifacts.resources(args.resource_set) : []
    if (parsed.artifactType === "seo-geo/optimization-plan" && resources.length === 0)
      throw new Error("SEO & Generative Engine Optimization terminal delivery requires its canonical immutable resource set")
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
