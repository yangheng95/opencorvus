import { tool } from "@opencorvus-ai/plugin"

// ABI means Application Binary Interface. URL means Uniform Resource Locator.
export const MarketingGrowthArtifactTypes = ["marketing-growth/growth-brief","marketing-growth/evidence-dossier","marketing-growth/audience-analysis","marketing-growth/channel-analysis","marketing-growth/growth-strategy","marketing-growth/audit","marketing-growth/campaign-plan"] as const
export const MarketingGrowthArtifactTypeSchema = tool.schema.enum(MarketingGrowthArtifactTypes)

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

export const MarketingGrowthArtifactPayloadSchema = tool.schema.object({
  stage: tool.schema.string().trim().min(1),
  scope: tool.schema.string().trim().min(1),
  as_of: tool.schema.string().trim().min(1),
  evidence: tool.schema.array(EvidenceSchema),
  findings: tool.schema.array(FindingSchema),
  decisions: tool.schema.array(tool.schema.string().trim().min(1)),
  unknowns: tool.schema.array(tool.schema.string().trim().min(1)),
  resource_roles: tool.schema.array(tool.schema.object({ role: tool.schema.string().trim().min(1), path: tool.schema.string().trim().min(1) }).strict()),
}).strict()

export const marketingGrowthArtifactDependencies = {
  "marketing-growth/growth-brief": [],
  "marketing-growth/evidence-dossier": [
    "marketing-growth/growth-brief"
  ],
  "marketing-growth/audience-analysis": [
    "marketing-growth/evidence-dossier"
  ],
  "marketing-growth/channel-analysis": [
    "marketing-growth/evidence-dossier"
  ],
  "marketing-growth/growth-strategy": [
    "marketing-growth/audience-analysis",
    "marketing-growth/channel-analysis"
  ],
  "marketing-growth/audit": [
    "marketing-growth/growth-strategy"
  ],
  "marketing-growth/campaign-plan": [
    "marketing-growth/audit"
  ]
} as const

export function parseMarketingGrowthArtifact(type: string, payload: unknown) {
  const artifactType = MarketingGrowthArtifactTypeSchema.parse(type)
  return { artifactType, payload: MarketingGrowthArtifactPayloadSchema.parse(payload) }
}
