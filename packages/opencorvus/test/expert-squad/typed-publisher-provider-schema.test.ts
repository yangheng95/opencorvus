import { describe, expect, test } from "bun:test"
import publishCommercialLegalArtifact from "../../../../expert-squads/builtin/commercial-legal/tools/publish-commercial-legal-artifact"
import publishDataAnalysisArtifact from "../../../../expert-squads/builtin/data-analysis/tools/publish-data-analysis-artifact"
import publishHrOperationsArtifact from "../../../../expert-squads/builtin/hr-operations/tools/publish-hr-operations-artifact"
import publishMarketingGrowthArtifact from "../../../../expert-squads/builtin/marketing-growth/tools/publish-marketing-growth-artifact"
import publishOmnichannelArtifact from "../../../../expert-squads/builtin/omnichannel-distribution/tools/publish-omnichannel-artifact"
import publishSalesStrategyArtifact from "../../../../expert-squads/builtin/sales-strategy/tools/publish-sales-strategy-artifact"
import publishSeoGeoArtifact from "../../../../expert-squads/builtin/seo-geo/tools/publish-seo-geo-artifact"
import publishTaxComplianceArtifact from "../../../../expert-squads/builtin/tax-compliance/tools/publish-tax-compliance-artifact"
import publishViralContentArtifact from "../../../../expert-squads/builtin/viral-content/tools/publish-viral-content-artifact"

const publishers = [
  {
    publisher: publishCommercialLegalArtifact,
    artifactTypes: [
      "commercial-legal/matter-charter",
      "commercial-legal/authority-dossier",
      "commercial-legal/contract-analysis",
      "commercial-legal/regulatory-analysis",
      "commercial-legal/legal-strategy",
      "commercial-legal/audit",
      "commercial-legal/report",
    ],
  },
  {
    publisher: publishDataAnalysisArtifact,
    artifactTypes: [
      "data-analysis/analysis-charter",
      "data-analysis/data-dossier",
      "data-analysis/performance-analysis",
      "data-analysis/segment-analysis",
      "data-analysis/insight-brief",
      "data-analysis/audit",
      "data-analysis/report",
    ],
  },
  {
    publisher: publishHrOperationsArtifact,
    artifactTypes: [
      "hr-operations/operating-charter",
      "hr-operations/evidence-dossier",
      "hr-operations/workforce-analysis",
      "hr-operations/process-analysis",
      "hr-operations/operating-plan-draft",
      "hr-operations/audit",
      "hr-operations/operating-plan",
    ],
  },
  {
    publisher: publishMarketingGrowthArtifact,
    artifactTypes: [
      "marketing-growth/growth-brief",
      "marketing-growth/evidence-dossier",
      "marketing-growth/audience-analysis",
      "marketing-growth/channel-analysis",
      "marketing-growth/growth-strategy",
      "marketing-growth/audit",
      "marketing-growth/campaign-plan",
    ],
  },
  {
    publisher: publishOmnichannelArtifact,
    artifactTypes: [
      "omnichannel-distribution/campaign-brief",
      "omnichannel-distribution/channel-spec-dossier",
      "omnichannel-distribution/rights-compliance-matrix",
      "omnichannel-distribution/channel-pack",
      "omnichannel-distribution/measurement-plan",
      "omnichannel-distribution/distribution-plan",
      "omnichannel-distribution/readiness-review",
      "omnichannel-distribution/delivery",
    ],
  },
  {
    publisher: publishSalesStrategyArtifact,
    artifactTypes: [
      "sales-strategy/research-charter",
      "sales-strategy/customer-dossier",
      "sales-strategy/opportunity-analysis",
      "sales-strategy/positioning-analysis",
      "sales-strategy/strategy-brief",
      "sales-strategy/audit",
      "sales-strategy/playbook",
    ],
  },
  {
    publisher: publishSeoGeoArtifact,
    artifactTypes: [
      "seo-geo/discovery-brief",
      "seo-geo/source-dossier",
      "seo-geo/search-analysis",
      "seo-geo/generative-analysis",
      "seo-geo/discoverability-strategy",
      "seo-geo/audit",
      "seo-geo/optimization-plan",
    ],
  },
  {
    publisher: publishTaxComplianceArtifact,
    artifactTypes: [
      "tax-compliance/engagement-charter",
      "tax-compliance/evidence-dossier",
      "tax-compliance/accounting-controls-analysis",
      "tax-compliance/tax-obligation-analysis",
      "tax-compliance/compliance-plan",
      "tax-compliance/audit",
      "tax-compliance/report",
    ],
  },
  {
    publisher: publishViralContentArtifact,
    artifactTypes: [
      "viral-content/campaign-brief",
      "viral-content/audience-dossier",
      "viral-content/trend-dossier",
      "viral-content/concept-set",
      "viral-content/copy-pack",
      "viral-content/review",
      "viral-content/delivery",
    ],
  },
] as const

describe("built-in typed publisher provider schemas", () => {
  test("project every published Artifact type as one correlated strict payload branch", () => {
    const projected = publishers.map(({ publisher, artifactTypes }) => {
      const schema = publisher.introspect().inputSchema as {
        properties: { artifact: { oneOf: Array<Record<string, unknown>> } }
      }
      const branches = schema.properties.artifact.oneOf as Array<{
        additionalProperties: boolean
        properties: {
          artifact_type: { const: string }
          payload: { type: string; additionalProperties: boolean }
        }
        required: string[]
      }>
      return {
        artifactTypes: branches.map((branch) => branch.properties.artifact_type.const),
        payloadTypes: branches.map((branch) => branch.properties.payload.type),
        payloadStrictness: branches.map((branch) => branch.properties.payload.additionalProperties),
        branchStrictness: branches.map((branch) => branch.additionalProperties),
        required: branches.map((branch) => branch.required),
        expectedArtifactTypes: [...artifactTypes],
      }
    })

    expect(projected).toEqual(
      publishers.map(({ artifactTypes }) => ({
        artifactTypes: [...artifactTypes],
        payloadTypes: artifactTypes.map(() => "object"),
        payloadStrictness: artifactTypes.map(() => false),
        branchStrictness: artifactTypes.map(() => false),
        required: artifactTypes.map(() => ["artifact_type", "payload"]),
        expectedArtifactTypes: [...artifactTypes],
      })),
    )
  })
})
