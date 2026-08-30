import { afterAll, describe, expect, test } from "bun:test"
import path from "node:path"
import { EngineArtifactEnvelopeSchema, readExactArtifact, type EngineArtifactLocator } from "@opencorvus-ai/plugin"
import { Config } from "../../src/config/config"
import { ensureGitProjectMetadata } from "../../src/engine/git"
import { persistEstablishedTask as persistTask } from "../fixture/engine-task"
import { prepareTaskProcessBinding } from "../../src/engine/task-execution-capsule-binding"
import { ExpertSquadPackageManager } from "../../src/expert-squad/manager"
import { PromptProfileResolver } from "../../src/expert-squad/prompt-profile-resolver"
import { ExpertSquadRegistry } from "../../src/expert-squad/registry"
import { Identifier } from "../../src/id/id"
import { Instance } from "../../src/project/instance"
import { ProjectRuntimePaths } from "../../src/project/runtime-paths"
import { Session } from "../../src/session"
import { withTaskScopedPluginToolHost } from "../../src/tool/plugin-tool-host"
import type { TaskToolExecutionScope } from "../../src/tool/task-tool-execution-scope"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"
import {
  TaxComplianceArtifactSchemas,
  parseTaxComplianceArtifact,
  type TaxComplianceArtifactType,
} from "@squads/tax-compliance/lib/tax-compliance/artifacts"
import publishTaxComplianceArtifact from "@squads/tax-compliance/tools/publish-tax-compliance-artifact"

const packageRoot = path.resolve(import.meta.dir, "../../../..", "expert-squads", "builtin", "tax-compliance")
const workflowID = "tax-compliance-assessment"
const publisherRef = "tax-compliance/shared/publish-tax-compliance-artifact"
const skillRefs = ["tax-compliance/shared/method", "tax-compliance/shared/workflow"] as const
const roles = {
  "tax-compliance-engagement-planner": "delegated-worker",
  "tax-compliance-authority-researcher": "deep-research",
  "tax-compliance-accounting-controls-analyst": "delegated-worker",
  "tax-compliance-tax-obligation-analyst": "delegated-worker",
  "tax-compliance-remediation-analyst": "delegated-worker",
  "tax-compliance-fact-checker": "fact-check",
  "tax-compliance-report-writer": "build",
} as const
const dependencies = {
  "tax-compliance-engagement-planner": [],
  "tax-compliance-authority-researcher": ["tax-compliance-engagement-planner"],
  "tax-compliance-accounting-controls-analyst": ["tax-compliance-authority-researcher"],
  "tax-compliance-tax-obligation-analyst": ["tax-compliance-authority-researcher"],
  "tax-compliance-remediation-analyst": [
    "tax-compliance-accounting-controls-analyst",
    "tax-compliance-tax-obligation-analyst",
  ],
  "tax-compliance-fact-checker": ["tax-compliance-remediation-analyst"],
  "tax-compliance-report-writer": ["tax-compliance-fact-checker"],
} as const

const charter = {
  workflow_id: workflowID,
  entities: ["Example Software Company"],
  jurisdictions: ["Mainland China"],
  reporting_framework: "Applicable enterprise accounting standards",
  periods: ["2026 Q2"],
  as_of_date: "2026-08-10",
  transactions: ["Domestic software subscriptions", "Cross-border technical service purchase"],
  taxes_in_scope: ["Value-added tax", "Enterprise income tax", "Withholding"],
  currencies: ["Chinese yuan"],
  materiality_rules: ["Prioritize filing exposure and unsupported deductions"],
  data_cutoff: "2026-07-31",
  questions: ["Which records, filings, and corrections are required?"],
  assumptions: ["The entity is a resident enterprise"],
  unknowns: ["Cross-border service performance location"],
}

const dossier = {
  workflow_id: workflowID,
  as_of_date: "2026-08-10",
  authorities: [
    {
      id: "tax-authority-1",
      title: "Official tax administration authority",
      issuer: "National tax authority",
      jurisdiction: "Mainland China",
      authority_level: "Administrative authority",
      status: "Effective",
      effective_date: "2026-01-01",
      applicable_period: "2026 Q2",
      url: "https://example.gov.cn/tax-authority-1",
      supported_propositions: ["Tax treatment must follow the effective rule for the reporting period"],
      limitations: ["Exact treatment depends on transaction facts"],
    },
  ],
  accounting_records: [
    {
      id: "record-1",
      record_type: "Revenue ledger",
      period: "2026 Q2",
      provenance: "Entity-provided general ledger extract",
      observed_value: "1000000",
      currency_or_unit: "Chinese yuan",
      limitations: ["Invoice-level reconciliation is pending"],
    },
  ],
  filing_facts: ["Quarterly filing receipt was supplied"],
  reconciled_definitions: ["Revenue means recognized subscription revenue for 2026 Q2"],
  conflicts: [],
  evidence_gaps: ["Cross-border service contract was not supplied"],
}

const calculation = {
  id: "calculation-1",
  subject: "Revenue reconciliation",
  inputs: ["Ledger revenue: 1000000 Chinese yuan", "Adjustment: 0 Chinese yuan"],
  formula: "Ledger revenue plus adjustment",
  result: "1000000",
  currency_or_unit: "Chinese yuan",
  rounding: "Nearest Chinese yuan",
  authority_ids: ["tax-authority-1"],
}

const values: Record<TaxComplianceArtifactType, unknown> = {
  "tax-compliance/engagement-charter": charter,
  "tax-compliance/evidence-dossier": dossier,
  "tax-compliance/accounting-controls-analysis": {
    workflow_id: workflowID,
    treatments: [
      {
        subject: "Subscription revenue",
        reporting_period: "2026 Q2",
        accounting_treatment: "Recognize according to performance of the subscription obligation",
        journal_entry_logic: ["Debit receivable or cash", "Credit subscription revenue"],
        authority_ids: ["tax-authority-1"],
        source_record_ids: ["record-1"],
        book_tax_difference: "No difference established from supplied evidence",
      },
    ],
    reconciliations: [calculation],
    document_chain_findings: ["Invoice-level reconciliation remains incomplete"],
    control_findings: [
      {
        control: "Quarterly invoice-to-ledger reconciliation",
        finding: "The supplied file lacks invoice-level linkage",
        risk_level: "medium",
        action: "Complete and approve an invoice-to-ledger reconciliation",
      },
    ],
    assumptions: ["The ledger extract is complete for the period"],
    unresolved_questions: ["Whether any credit notes were issued after period end"],
  },
  "tax-compliance/tax-obligation-analysis": {
    workflow_id: workflowID,
    obligations: [
      {
        tax: "Value-added tax",
        jurisdiction: "Mainland China",
        period: "2026 Q2",
        taxable_event: "Domestic software subscription supply",
        tax_base: "Source-backed taxable consideration after verified adjustments",
        rate_or_treatment: "Apply the officially effective treatment after taxpayer-status confirmation",
        filing_deadline: "Confirm from the official calendar for the filing period",
        payment_deadline: "Confirm from the official calendar for the filing period",
        authority_ids: ["tax-authority-1"],
        conclusion: "A filing obligation exists; rate and deadline require the missing taxpayer-status evidence",
      },
    ],
    calculations: [calculation],
    withholding_and_indirect_tax: ["Assess withholding after obtaining the cross-border service contract"],
    filing_positions: ["Do not finalize the rate without taxpayer-status evidence"],
    evidence_requirements: ["Taxpayer-status record", "Cross-border service contract"],
    unresolved_questions: ["Cross-border service performance location"],
  },
  "tax-compliance/compliance-plan": {
    workflow_id: workflowID,
    executive_position:
      "Complete invoice reconciliation and cross-border evidence before finalizing amended positions.",
    priority_risks: [
      {
        id: "tax-risk-1",
        subject: "Unsupported filing position",
        risk_level: "high",
        factual_basis: ["Taxpayer-status evidence was not supplied"],
        authority_ids: ["tax-authority-1"],
        consequence: "Incorrect rate or treatment may be applied",
        remediation: "Obtain status evidence and recompute before filing correction",
        residual_exposure: "Professional review remains required",
      },
    ],
    book_tax_reconciliation: [calculation],
    remediation_actions: [
      {
        action: "Complete invoice-to-ledger reconciliation",
        owner: "Financial controller",
        due: "Before the next filing",
        evidence_required: ["Approved reconciliation schedule"],
      },
    ],
    filing_calendar: [
      {
        obligation: "Value-added tax filing",
        jurisdiction: "Mainland China",
        period: "2026 Q2",
        due: "Official calendar date to be confirmed",
        owner: "Tax manager",
      },
    ],
    retention_plan: ["Retain official authority, ledgers, invoices, reconciliations, and filing receipts"],
    residual_exposures: ["Cross-border treatment remains unresolved pending the contract"],
    disclaimer: "Compliance research and planning; obtain qualified accounting and tax professional review.",
  },
  "tax-compliance/audit": {
    workflow_id: workflowID,
    reviewed_artifact_type: "tax-compliance/compliance-plan",
    checks: [
      {
        subject: "Revenue reconciliation",
        result: "verified",
        evidence: ["calculation-1", "record-1"],
        recalculation: "1000000 plus 0 equals 1000000 Chinese yuan",
        explanation: "The stated result follows the declared inputs and rounding.",
      },
    ],
    required_corrections: ["Label the filing due date as unconfirmed"],
    accepted_limitations: ["Taxpayer status and cross-border contract are missing"],
    coverage_summary: "The synthesized compliance plan and calculation were reviewed.",
    publication_guidance: "Publish after incorporating the stated correction.",
  },
  "tax-compliance/report": {
    workflow_id: workflowID,
    title: "Tax Compliance Assessment",
    as_of_date: "2026-08-10",
    entities: ["Example Software Company"],
    jurisdictions: ["Mainland China"],
    periods: ["2026 Q2"],
    executive_summary: "Complete reconciliation and missing evidence before finalizing amended positions.",
    section_inventory: ["Scope", "Authority", "Accounting", "Tax obligations", "Remediation"],
    calculation_count: 1,
    citation_count: 1,
    audit_resolution: ["The filing due date is explicitly marked unconfirmed"],
    markdown_path: "artifacts/tax-compliance/report.md",
    disclaimer: "Compliance research and planning; obtain qualified accounting and tax professional review.",
  },
}

async function taskProcessBinding(taskID: string, packageDigest: string, timeCreated: number) {
  await ensureGitProjectMetadata()
  return prepareTaskProcessBinding({
    mode: "native",
    taskID,
    projectID: Instance.project.id,
    rootDirectory: Instance.directory,
    packageRevisionSHA256: packageDigest,
    timeCreated,
  })
}

afterAll(async () => {
  await resetMemoryDatabase()
})

describe("Tax Compliance Expert Squad", () => {
  test("loads the exact self-contained package and complete active projection", async () => {
    const source = await ExpertSquadRegistry.loadSourcePackage(packageRoot)
    expect(source.manifest).toMatchObject({
      schema_version: 2,
      namespace: "builtin",
      id: "tax-compliance",
      name: "Tax Compliance",
      version: "2026.08.30.1",
      product_pillars: ["work"],
    })
    expect([...source.packageSkills.keys()].sort()).toEqual([...skillRefs].sort())
    expect([...source.packageToolBundles.keys()]).toEqual([publisherRef])
    expect(
      Object.fromEntries(
        Object.entries(source.manifest.capability_projection.agents).map(([agentID, projection]) => [
          agentID,
          projection.base_role,
        ]),
      ),
    ).toEqual(roles)
    expect(
      Object.fromEntries(
        Object.entries(source.manifest.capability_projection.virtual_workflows[workflowID]!.nodes).map(
          ([nodeID, node]) => [nodeID, node.depends_on],
        ),
      ),
    ).toEqual(dependencies)

    await using project = await memoryProject()
    await ExpertSquadPackageManager.importDirectory({
      projectDirectory: project.path,
      sourceDirectory: packageRoot,
      replace: false,
      installationScope: "project",
    })
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const config = Config.Info.parse({ prompt_profile: { active: "tax-compliance" } })
        const scheduler = await PromptProfileResolver.resolveSchedulerCapability({
          projectDirectory: project.path,
          config,
        })
        const projection = await PromptProfileResolver.resolveSkillProjection({
          projectDirectory: project.path,
          config,
        })
        expect(scheduler.expertSquadID).toBe("tax-compliance")
        expect(scheduler.productionSkills.map((entry) => entry.ref)).toEqual([...skillRefs])
        expect(scheduler.virtualWorkflows[workflowID]!.nodes).toEqual(
          Object.fromEntries(
            Object.entries(dependencies).map(([agentID, dependsOn]) => [
              agentID,
              expect.objectContaining({ agent_id: agentID, depends_on: [...dependsOn] }),
            ]),
          ),
        )
        expect(projection.projectedAgentIDs).toEqual(Object.keys(roles).sort())
        for (const [agentID, baseRole] of Object.entries(roles)) {
          const worker = await PromptProfileResolver.resolveWorkerCapability({
            projectDirectory: project.path,
            config,
            agentID,
          })
          expect(worker.identity.baseRole).toBe(baseRole)
          expect(worker.productionSkills.map((entry) => entry.ref)).toEqual([...skillRefs])
          expect(worker.packageTools.map((entry) => entry.ref)).toEqual([publisherRef])
          expect(worker.builtInToolIDs).toEqual(
            expect.arrayContaining(["artifact_search", "artifact_read", "artifact_select", "artifact_snapshot"]),
          )
        }
      },
    })
  }, 0)

  test("parses one complete current value for every package Artifact codec", () => {
    expect(Object.keys(values).sort()).toEqual(Object.keys(TaxComplianceArtifactSchemas).sort())
    for (const [artifactType, payload] of Object.entries(values)) {
      expect(parseTaxComplianceArtifact(artifactType as TaxComplianceArtifactType, payload)).toEqual(payload)
    }
  })

  test("publishes and consumes an exact typed predecessor in a real Task tool Host", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const loaded = await ExpertSquadRegistry.loadSourcePackage(packageRoot)
        const session = Session.prepareRootNext({
          kind: "root",
          directory: Instance.directory,
          title: "Tax Compliance typed Application Binary Interface",
        })
        const taskID = Identifier.ascending("task")
        const started = Date.now()
        persistTask({
          taskID,
          rootSession: session,
          now: started,
          title: "Tax Compliance typed Application Binary Interface",
          request: "Publish a typed tax compliance evidence chain",
          productPillar: "work",
          source: "test",
          priority: "normal",
          metadata: {
            actor: "mission",
            mission: { id: `mission-${Identifier.uuid4First8()}`, session_id: Identifier.ascending("session") },
          },
          projectID: Instance.project.id,
          packageRevision: {
            scope: "project",
            projectID: Instance.project.id,
            namespace: "builtin",
            id: "tax-compliance",
            version: loaded.manifest.version,
            packageDigest: loaded.packageDigest,
          },
          executionCapsuleBinding: await taskProcessBinding(taskID, loaded.packageDigest, started),
        })
        const userMessage = await Session.updateMessage({
          id: Identifier.ascending("message"),
          sessionID: session.id,
          role: "user",
          author: "user",
          time: { created: started },
          agent: "user",
          model: { providerID: "test", modelID: "test" },
        })
        for (const [agentID, suffix] of [
          ["tax-compliance-engagement-planner", "charter"],
          ["tax-compliance-authority-researcher", "dossier"],
        ] as const) {
          const assistantMessage = await Session.updateMessage({
            id: `message-tax-compliance-${suffix}`,
            sessionID: session.id,
            role: "assistant",
            author: agentID,
            time: { created: started },
            parentID: userMessage.id,
            modelID: "test",
            providerID: "test",
            agent: agentID,
            path: { cwd: project.path, root: project.path },
            cost: 0,
            tokens: { input: 0, output: 0, reasoning: 0, total: 0, cache: { read: 0, write: 0 } },
          })
          await Session.updatePart({
            id: `step-tax-compliance-${suffix}`,
            sessionID: session.id,
            messageID: assistantMessage.id,
            type: "step-start",
          })
          await Session.updatePart({
            id: `part-tax-compliance-${suffix}`,
            sessionID: session.id,
            messageID: assistantMessage.id,
            type: "tool",
            callID: `call-tax-compliance-${suffix}`,
            tool: publisherRef,
            state: { status: "running", input: {}, time: { start: started + 1 } },
          })
        }

        const scope = (agentID: keyof typeof roles, suffix: string): TaskToolExecutionScope => ({
          kind: "task",
          projectID: Instance.project.id,
          projectDirectory: project.path,
          taskID,
          taskRuntimeDirectory: ProjectRuntimePaths.taskRoot(project.path, taskID),
          sessionID: session.id,
          messageID: `message-tax-compliance-${suffix}`,
          toolCallID: `call-tax-compliance-${suffix}`,
          toolPartID: `part-tax-compliance-${suffix}`,
          executionSurface: {},
          owner: {
            kind: "projected-worker",
            expertSquadID: "tax-compliance",
            packageRevision: {
              scope: "project",
              projectID: Instance.project.id,
              namespace: "builtin",
              id: "tax-compliance",
              version: loaded.manifest.version,
              packageDigest: loaded.packageDigest,
            },
            agentID,
            projectionHash: "c".repeat(64),
            workerTurnDescriptorID: `descriptor-tax-compliance-${suffix}`,
            workerTurnDescriptorHash: "d".repeat(64),
          },
        })

        let charterLocator!: EngineArtifactLocator
        await withTaskScopedPluginToolHost(scope("tax-compliance-engagement-planner", "charter"), async (host) => {
          const receipt = JSON.parse(
            await publishTaxComplianceArtifact.execute(
              {
                artifact: { artifact_type: "tax-compliance/engagement-charter", payload: charter },
                resource_set: null,
                source_artifact_locators: [],
              },
              { host, metadata() {} } as never,
            ),
          ) as { locator: EngineArtifactLocator }
          charterLocator = receipt.locator
        })

        await withTaskScopedPluginToolHost(scope("tax-compliance-authority-researcher", "dossier"), async (host) => {
          const receipt = JSON.parse(
            await publishTaxComplianceArtifact.execute(
              {
                artifact: { artifact_type: "tax-compliance/evidence-dossier", payload: dossier },
                resource_set: null,
                source_artifact_locators: [charterLocator],
              },
              { host, metadata() {} } as never,
            ),
          ) as { locator: EngineArtifactLocator }
          const exact = await readExactArtifact(host.engineArtifacts, receipt.locator)
          const envelope = EngineArtifactEnvelopeSchema.parse(JSON.parse(new TextDecoder().decode(exact.bytes)))
          expect(envelope).toMatchObject({
            artifact_type: "tax-compliance/evidence-dossier",
            schema_version: 1,
            payload: dossier,
            source_artifact_locators: [charterLocator],
          })
        })
      },
    })
  }, 0)
})
