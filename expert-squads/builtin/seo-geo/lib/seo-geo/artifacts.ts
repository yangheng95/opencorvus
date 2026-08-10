import { tool } from "@opencorvus-ai/plugin"

// ABI means Application Binary Interface. URL means Uniform Resource Locator.
export const SeoGeoArtifactTypes = ["seo-geo/discovery-brief","seo-geo/source-dossier","seo-geo/search-analysis","seo-geo/generative-analysis","seo-geo/discoverability-strategy","seo-geo/audit","seo-geo/optimization-plan"] as const
export const SeoGeoArtifactTypeSchema = tool.schema.enum(SeoGeoArtifactTypes)

const EvidenceSchema = tool.schema.object({
  statement: tool.schema.string().trim().min(1),
  source: tool.schema.string().trim().min(1),
  source_url: tool.schema.string().trim().url().nullable(),
  as_of: tool.schema.string().trim().min(1),
}).strict()

const FindingSchema = tool.schema.object({
  finding: tool.schema.string().trim().min(1),
  evidence_indexes: tool.schema.array(tool.schema.number().int().nonnegative()),
  confidence: tool.schema.enum(["high", "medium", "low"]),
}).strict()

export const SeoGeoArtifactPayloadSchema = tool.schema.object({
  stage: tool.schema.string().trim().min(1),
  scope: tool.schema.string().trim().min(1),
  as_of: tool.schema.string().trim().min(1),
  evidence: tool.schema.array(EvidenceSchema),
  findings: tool.schema.array(FindingSchema),
  decisions: tool.schema.array(tool.schema.string().trim().min(1)),
  unknowns: tool.schema.array(tool.schema.string().trim().min(1)),
  resource_roles: tool.schema.array(tool.schema.object({ role: tool.schema.string().trim().min(1), path: tool.schema.string().trim().min(1) }).strict()),
}).strict()

export const seoGeoArtifactDependencies = {
  "seo-geo/discovery-brief": [],
  "seo-geo/source-dossier": [
    "seo-geo/discovery-brief"
  ],
  "seo-geo/search-analysis": [
    "seo-geo/source-dossier"
  ],
  "seo-geo/generative-analysis": [
    "seo-geo/source-dossier"
  ],
  "seo-geo/discoverability-strategy": [
    "seo-geo/generative-analysis",
    "seo-geo/search-analysis"
  ],
  "seo-geo/audit": [
    "seo-geo/discoverability-strategy"
  ],
  "seo-geo/optimization-plan": [
    "seo-geo/audit"
  ]
} as const

export function parseSeoGeoArtifact(type: string, payload: unknown) {
  const artifactType = SeoGeoArtifactTypeSchema.parse(type)
  return { artifactType, payload: SeoGeoArtifactPayloadSchema.parse(payload) }
}
