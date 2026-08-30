import { afterAll, describe, expect, test } from "bun:test"
import path from "node:path"
import { EngineArtifactEnvelopeSchema, readExactArtifact, type EngineArtifactLocator } from "@opencorvus-ai/plugin"
import { Config } from "../../src/config/config"
import { persistEstablishedTask as persistTask } from "../fixture/engine-task"
import { ExpertSquadPackageManager } from "../../src/expert-squad/manager"
import { PromptProfileResolver } from "../../src/expert-squad/prompt-profile-resolver"
import { ExpertSquadRegistry } from "../../src/expert-squad/registry"
import { ensureGitProjectMetadata } from "../../src/engine/git"
import { prepareTaskProcessBinding } from "../../src/engine/task-execution-capsule-binding"
import { Identifier } from "../../src/id/id"
import { Instance } from "../../src/project/instance"
import { ProjectRuntimePaths } from "../../src/project/runtime-paths"
import { Session } from "../../src/session"
import { withTaskScopedPluginToolHost } from "../../src/tool/plugin-tool-host"
import type { TaskToolExecutionScope } from "../../src/tool/task-tool-execution-scope"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"
import {
  CommercialLegalArtifactSchemas,
  parseCommercialLegalArtifact,
  type CommercialLegalArtifactType,
} from "@squads/commercial-legal/lib/commercial-legal/artifacts"
import publishCommercialLegalArtifact from "@squads/commercial-legal/tools/publish-commercial-legal-artifact"

const packageRoot = path.resolve(import.meta.dir, "../../../..", "expert-squads", "builtin", "commercial-legal")
const workflowID = "commercial-legal-review"
const publisherRef = "commercial-legal/shared/publish-commercial-legal-artifact"
const skillRefs = ["commercial-legal/shared/method", "commercial-legal/shared/workflow"] as const
const roles = {
  "commercial-legal-matter-planner": "delegated-worker",
  "commercial-legal-authority-researcher": "deep-research",
  "commercial-legal-contract-analyst": "delegated-worker",
  "commercial-legal-regulatory-analyst": "delegated-worker",
  "commercial-legal-strategy-counsel": "delegated-worker",
  "commercial-legal-fact-checker": "fact-check",
  "commercial-legal-report-writer": "build",
} as const
const dependencies = {
  "commercial-legal-matter-planner": [],
  "commercial-legal-authority-researcher": ["commercial-legal-matter-planner"],
  "commercial-legal-contract-analyst": ["commercial-legal-authority-researcher"],
  "commercial-legal-regulatory-analyst": ["commercial-legal-authority-researcher"],
  "commercial-legal-strategy-counsel": ["commercial-legal-contract-analyst", "commercial-legal-regulatory-analyst"],
  "commercial-legal-fact-checker": ["commercial-legal-strategy-counsel"],
  "commercial-legal-report-writer": ["commercial-legal-fact-checker"],
} as const

const charter = {
  workflow_id: workflowID,
  matter: {
    client_position: "Supplier",
    counterparties: ["Enterprise customer"],
    jurisdictions: ["Mainland China"],
    as_of_date: "2026-08-10",
    transaction: "Business-to-business software subscription",
    documents: ["Subscription agreement"],
    decision_context: "Pre-signing review",
  },
  questions: ["Which clauses require revision before signature?"],
  source_policy: ["Use current official authority"],
  materiality_rules: ["Prioritize enforceability and uncapped exposure"],
  deliverable_sections: ["Risk register", "Proposed revisions"],
  assumptions: ["Both parties are domestic companies"],
  unknowns: ["Customer security classification"],
}

const dossier = {
  workflow_id: workflowID,
  as_of_date: "2026-08-10",
  authorities: [
    {
      id: "authority-1",
      title: "Official commercial law authority",
      issuer: "National legislature",
      jurisdiction: "Mainland China",
      authority_level: "Statute",
      status: "Effective",
      effective_date: "2021-01-01",
      url: "https://example.gov.cn/authority-1",
      supported_propositions: ["Agreements bind the parties according to law"],
      limitations: ["Application depends on exact facts"],
    },
  ],
  document_clauses: [
    {
      document: "Subscription agreement",
      clause_id: "12.1",
      heading: "Liability",
      text: "Supplier liability is unlimited.",
      parties_affected: ["Supplier", "Enterprise customer"],
    },
  ],
  factual_record: ["The supplier provides hosted software"],
  conflicts: [],
  evidence_gaps: ["No data appendix was supplied"],
}

const values: Record<CommercialLegalArtifactType, unknown> = {
  "commercial-legal/matter-charter": charter,
  "commercial-legal/authority-dossier": dossier,
  "commercial-legal/contract-analysis": {
    workflow_id: workflowID,
    clause_assessments: [
      {
        document: "Subscription agreement",
        clause_id: "12.1",
        issue: "Unlimited supplier liability",
        rule: "Contractual risk allocation is interpreted from the agreed text and mandatory law",
        application: "The clause allocates all covered loss to the supplier without a cap",
        conclusion: "The clause creates material uncapped exposure",
        authority_ids: ["authority-1"],
        risk_level: "high",
        recommendation: "Add a defined aggregate cap and stated exclusions",
        proposed_language: "Aggregate liability is capped at fees paid during the preceding twelve months.",
      },
    ],
    cross_clause_conflicts: [],
    assumptions: ["No mandatory rule prohibits the proposed allocation"],
    unresolved_questions: ["Whether special regulated data is processed"],
  },
  "commercial-legal/regulatory-analysis": {
    workflow_id: workflowID,
    domains: [
      {
        domain: "Data protection",
        applicability: "uncertain",
        factual_basis: ["The service is hosted", "No data appendix was supplied"],
        authority_ids: ["authority-1"],
        obligations: ["Confirm processing roles before signature"],
        exposure: ["Unallocated compliance responsibility"],
        actions: ["Obtain a completed data-flow schedule"],
      },
    ],
    cross_domain_dependencies: ["Data classification affects security obligations"],
    evidence_gaps: ["Data categories are unknown"],
  },
  "commercial-legal/legal-strategy": {
    workflow_id: workflowID,
    executive_position: "Revise liability and complete the data schedule before signature.",
    priority_risks: [
      {
        id: "risk-1",
        subject: "Unlimited liability",
        risk_level: "high",
        factual_basis: ["Clause 12.1 has no cap"],
        authority_ids: ["authority-1"],
        consequence: "Unbounded contractual exposure",
        recommendation: "Negotiate an aggregate cap",
        residual_risk: "Carve-outs remain subject to negotiation",
      },
    ],
    proposed_revisions: [
      {
        document: "Subscription agreement",
        clause_id: "12.1",
        current_effect: "Unlimited supplier liability",
        proposed_language: "Aggregate liability is capped at fees paid during the preceding twelve months.",
        rationale: "Align exposure with transaction value",
        authority_ids: ["authority-1"],
      },
    ],
    negotiation_positions: [
      {
        issue: "Liability cap",
        preferred_position: "One times annual fees",
        alternative_position: "Two times annual fees",
        walk_away_condition: "Uncapped ordinary breach liability",
      },
    ],
    signing_actions: [{ action: "Complete the data schedule", owner: "Legal operations", due: "Before signature" }],
    residual_risks: ["Final enforceability depends on negotiated text and facts"],
    disclaimer: "Legal research and risk analysis; obtain qualified local counsel advice.",
  },
  "commercial-legal/audit": {
    workflow_id: workflowID,
    reviewed_artifact_type: "commercial-legal/legal-strategy",
    checks: [
      {
        subject: "Liability strategy traceability",
        result: "verified",
        evidence: ["risk-1", "authority-1"],
        explanation: "The recommendation maps to the supplied clause and authority record.",
      },
    ],
    required_corrections: ["State that the data classification remains unknown"],
    accepted_limitations: ["No data appendix was supplied"],
    coverage_summary: "All material strategy items were reviewed.",
    publication_guidance: "Publish after incorporating the stated correction.",
  },
  "commercial-legal/report": {
    workflow_id: workflowID,
    title: "Commercial Legal Review",
    as_of_date: "2026-08-10",
    jurisdictions: ["Mainland China"],
    executive_summary: "Revise liability and complete the data schedule before signature.",
    section_inventory: ["Scope", "Authority", "Clause analysis", "Regulatory analysis", "Strategy"],
    citation_count: 1,
    audit_resolution: ["The unknown data classification is stated explicitly"],
    markdown_path: "artifacts/commercial-legal/report.md",
    disclaimer: "Legal research and risk analysis; obtain qualified local counsel advice.",
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

describe("Commercial Legal Expert Squad", () => {
  test("loads the exact self-contained package and complete active projection", async () => {
    const source = await ExpertSquadRegistry.loadSourcePackage(packageRoot)
    expect(source.manifest).toMatchObject({
      schema_version: 2,
      namespace: "builtin",
      id: "commercial-legal",
      name: "Commercial Legal",
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
        const config = Config.Info.parse({ prompt_profile: { active: "commercial-legal" } })
        const scheduler = await PromptProfileResolver.resolveSchedulerCapability({
          projectDirectory: project.path,
          config,
        })
        const projection = await PromptProfileResolver.resolveSkillProjection({
          projectDirectory: project.path,
          config,
        })
        expect(scheduler.expertSquadID).toBe("commercial-legal")
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
    expect(Object.keys(values).sort()).toEqual(Object.keys(CommercialLegalArtifactSchemas).sort())
    for (const [artifactType, payload] of Object.entries(values)) {
      expect(parseCommercialLegalArtifact(artifactType as CommercialLegalArtifactType, payload)).toEqual(payload)
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
          title: "Commercial Legal typed Application Binary Interface",
        })
        const taskID = Identifier.ascending("task")
        const started = Date.now()
        persistTask({
          taskID,
          rootSession: session,
          now: started,
          title: "Commercial Legal typed Application Binary Interface",
          request: "Publish a typed commercial legal evidence chain",
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
            id: "commercial-legal",
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
          ["commercial-legal-matter-planner", "charter"],
          ["commercial-legal-authority-researcher", "dossier"],
        ] as const) {
          const assistantMessage = await Session.updateMessage({
            id: `message-commercial-legal-${suffix}`,
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
            id: `step-commercial-legal-${suffix}`,
            sessionID: session.id,
            messageID: assistantMessage.id,
            type: "step-start",
          })
          await Session.updatePart({
            id: `part-commercial-legal-${suffix}`,
            sessionID: session.id,
            messageID: assistantMessage.id,
            type: "tool",
            callID: `call-commercial-legal-${suffix}`,
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
          messageID: `message-commercial-legal-${suffix}`,
          toolCallID: `call-commercial-legal-${suffix}`,
          toolPartID: `part-commercial-legal-${suffix}`,
          executionSurface: {},
          owner: {
            kind: "projected-worker",
            expertSquadID: "commercial-legal",
            packageRevision: {
              scope: "project",
              projectID: Instance.project.id,
              namespace: "builtin",
              id: "commercial-legal",
              version: loaded.manifest.version,
              packageDigest: loaded.packageDigest,
            },
            agentID,
            projectionHash: "a".repeat(64),
            workerTurnDescriptorID: `descriptor-commercial-legal-${suffix}`,
            workerTurnDescriptorHash: "b".repeat(64),
          },
        })

        let charterLocator!: EngineArtifactLocator
        await withTaskScopedPluginToolHost(scope("commercial-legal-matter-planner", "charter"), async (host) => {
          const receipt = JSON.parse(
            await publishCommercialLegalArtifact.execute(
              {
                artifact: { artifact_type: "commercial-legal/matter-charter", payload: charter },
                resource_set: null,
                source_artifact_locators: [],
              },
              { host, metadata() {} } as never,
            ),
          ) as { locator: EngineArtifactLocator }
          charterLocator = receipt.locator
        })

        await withTaskScopedPluginToolHost(scope("commercial-legal-authority-researcher", "dossier"), async (host) => {
          const receipt = JSON.parse(
            await publishCommercialLegalArtifact.execute(
              {
                artifact: { artifact_type: "commercial-legal/authority-dossier", payload: dossier },
                resource_set: null,
                source_artifact_locators: [charterLocator],
              },
              { host, metadata() {} } as never,
            ),
          ) as { locator: EngineArtifactLocator }
          const exact = await readExactArtifact(host.engineArtifacts, receipt.locator)
          const envelope = EngineArtifactEnvelopeSchema.parse(JSON.parse(new TextDecoder().decode(exact.bytes)))
          expect(envelope).toMatchObject({
            artifact_type: "commercial-legal/authority-dossier",
            schema_version: 1,
            payload: dossier,
            source_artifact_locators: [charterLocator],
          })
        })
      },
    })
  }, 0)
})
