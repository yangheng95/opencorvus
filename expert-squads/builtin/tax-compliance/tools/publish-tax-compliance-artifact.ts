// ABI means Application Binary Interface.

import {
  ArtifactReadLocatorSchema,
  TaskArtifactResourceSetLocatorSchema,
  inspectEngineArtifactEnvelope,
  readExactArtifactsSettled,
  selectExactArtifactSources,
  tool,
} from "@opencorvus-ai/plugin"
import {
  TAX_COMPLIANCE_SCHEMA_VERSION,
  TaxComplianceArtifactTypeSchema,
  parseTaxComplianceArtifact,
  type TaxComplianceArtifactType,
} from "../lib/tax-compliance/artifacts"

const expectedSources: Readonly<Record<TaxComplianceArtifactType, readonly TaxComplianceArtifactType[]>> = {
  "tax-compliance/engagement-charter": [],
  "tax-compliance/evidence-dossier": ["tax-compliance/engagement-charter"],
  "tax-compliance/accounting-controls-analysis": ["tax-compliance/evidence-dossier"],
  "tax-compliance/tax-obligation-analysis": ["tax-compliance/evidence-dossier"],
  "tax-compliance/compliance-plan": ["tax-compliance/accounting-controls-analysis", "tax-compliance/tax-obligation-analysis"],
  "tax-compliance/audit": ["tax-compliance/compliance-plan"],
  "tax-compliance/report": [
    "tax-compliance/engagement-charter",
    "tax-compliance/evidence-dossier",
    "tax-compliance/accounting-controls-analysis",
    "tax-compliance/tax-obligation-analysis",
    "tax-compliance/compliance-plan",
    "tax-compliance/audit",
  ],
}

const producerByType: Readonly<Record<TaxComplianceArtifactType, string>> = {
  "tax-compliance/engagement-charter": "tax-compliance-engagement-planner",
  "tax-compliance/evidence-dossier": "tax-compliance-authority-researcher",
  "tax-compliance/accounting-controls-analysis": "tax-compliance-accounting-controls-analyst",
  "tax-compliance/tax-obligation-analysis": "tax-compliance-tax-obligation-analyst",
  "tax-compliance/compliance-plan": "tax-compliance-remediation-analyst",
  "tax-compliance/audit": "tax-compliance-fact-checker",
  "tax-compliance/report": "tax-compliance-report-writer",
}

export default tool({
  description: "Validate and publish one Tax Compliance typed Artifact with exact package-owned sources and immutable report resources.",
  args: {
    artifact_type: TaxComplianceArtifactTypeSchema,
    payload: tool.schema.unknown(),
    resource_set: TaskArtifactResourceSetLocatorSchema.nullable(),
    source_artifact_locators: tool.schema.array(ArtifactReadLocatorSchema),
  },
  async execute(args, context) {
    const payload = parseTaxComplianceArtifact(args.artifact_type, args.payload)
    const expected = expectedSources[args.artifact_type]
    if (args.source_artifact_locators.length !== expected.length) {
      throw new Error(`${args.artifact_type} requires ${expected.length} exact source Artifact locator(s)`)
    }
    const batch = await readExactArtifactsSettled(context.host.engineArtifacts, args.source_artifact_locators)
    if (batch.diagnostics.length > 0) {
      throw new AggregateError(batch.diagnostics.map((item) => item.error), "Tax Compliance predecessor read failed")
    }
    const observedTypes = new Set<TaxComplianceArtifactType>()
    for (const read of batch.reads) {
      const envelope = inspectEngineArtifactEnvelope(read, { schemaVersion: TAX_COMPLIANCE_SCHEMA_VERSION })
      const sourceType = TaxComplianceArtifactTypeSchema.parse(envelope.artifact_type)
      if (!expected.includes(sourceType) || observedTypes.has(sourceType)) {
        throw new Error(`${args.artifact_type} received an unexpected or duplicate source ${sourceType}`)
      }
      inspectEngineArtifactEnvelope(read, {
        artifactType: sourceType,
        schemaVersion: TAX_COMPLIANCE_SCHEMA_VERSION,
        producer: {
          ownerKind: "projected-worker",
          expertSquadID: "tax-compliance",
          agentID: producerByType[sourceType],
        },
      })
      parseTaxComplianceArtifact(sourceType, envelope.payload)
      observedTypes.add(sourceType)
    }
    if (expected.some((sourceType) => !observedTypes.has(sourceType))) {
      throw new Error(`${args.artifact_type} is missing a required typed predecessor`)
    }
    const reportPublication = args.artifact_type === "tax-compliance/report"
    if (reportPublication !== Boolean(args.resource_set)) {
      throw new Error(reportPublication ? "tax-compliance/report requires its exact Markdown resource set" : "Only tax-compliance/report may publish file resources")
    }
    await selectExactArtifactSources(context.host.engineArtifacts, batch.reads, `Typed predecessors for ${args.artifact_type}`)
    const resources = args.resource_set ? await context.host.taskArtifacts.resources(args.resource_set) : []
    context.metadata({ title: `Tax Compliance: ${args.artifact_type.split("/")[1]}` })
    const publication = await context.host.engineArtifacts.publish({
      artifact_type: args.artifact_type,
      schema_version: TAX_COMPLIANCE_SCHEMA_VERSION,
      label: args.artifact_type,
      payload,
      resources,
      source_artifact_locators: batch.reads.map((read) => read.locator),
    })
    return JSON.stringify({
      artifact_type: args.artifact_type,
      schema_version: TAX_COMPLIANCE_SCHEMA_VERSION,
      locator: publication.locator,
      artifact_sha256: publication.sha256,
    })
  },
})
