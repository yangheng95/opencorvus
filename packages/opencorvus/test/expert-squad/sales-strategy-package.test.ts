import { afterAll, describe, expect, test } from "bun:test"
import { writeFile } from "node:fs/promises"
import path from "node:path"
import {
  EngineArtifactEnvelopeSchema,
  TaskArtifactResourceSetLocatorSchema,
  type EngineArtifactLocator,
} from "@opencorvus-ai/plugin"
import { Config } from "../../src/config/config"
import { prepareTaskProcessBinding } from "../../src/engine/task-execution-capsule-binding"
import { persistEstablishedTask as persistTask } from "../fixture/engine-task"
import { ExpertSquadPackageManager } from "../../src/expert-squad/manager"
import { PromptProfileResolver } from "../../src/expert-squad/prompt-profile-resolver"
import { ExpertSquadRegistry } from "../../src/expert-squad/registry"
import { ensureGitProjectMetadata } from "../../src/engine/git"
import { Identifier } from "../../src/id/id"
import { Instance } from "../../src/project/instance"
import { ProjectRuntimePaths } from "../../src/project/runtime-paths"
import { Session } from "../../src/session"
import type { TaskToolExecutionScope } from "../../src/tool/task-tool-execution-scope"
import { withTaskScopedPluginToolHost } from "../../src/tool/plugin-tool-host"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"
import {
  SalesStrategyArtifactSchemas,
  type SalesStrategyArtifactType,
} from "@squads/sales-strategy/lib/sales-strategy/artifacts"
import publishSalesStrategyArtifact from "@squads/sales-strategy/tools/publish-sales-strategy-artifact"

const packageRoot = path.resolve(import.meta.dir, "../../../..", "expert-squads", "builtin", "sales-strategy")
const skillRefs = ["sales-strategy/shared/method", "sales-strategy/shared/workflow"]
const publisherRef = "sales-strategy/shared/publish-sales-strategy-artifact"
const dependencies = {
  "sales-strategy-planner": [],
  "sales-customer-researcher": ["sales-strategy-planner"],
  "sales-opportunity-analyst": ["sales-customer-researcher"],
  "sales-positioning-analyst": ["sales-customer-researcher"],
  "sales-strategy-synthesizer": ["sales-opportunity-analyst", "sales-positioning-analyst"],
  "sales-strategy-fact-checker": ["sales-strategy-synthesizer"],
  "sales-playbook-writer": ["sales-strategy-fact-checker"],
} as const

const evidence = {
  id: "source-1",
  source: "accounts.csv",
  observed_at: "2026-08-10",
  statement: "Account needs and sales outcomes are available by segment.",
  limitation: "Test dataset",
}
const finding = {
  claim: "Qualified pipeline increased",
  method: "Segment opportunity comparison",
  result: "Enterprise segment has the strongest fit",
  evidence_ids: ["source-1"],
  confidence: "high" as const,
}
const action = {
  action: "Prioritize the strongest customer segment",
  rationale: "It contributed most of the observed increase",
  owner: "Sales lead",
  timing: "Next planning cycle",
  success_measure: "Qualified opportunity conversion",
}
function payload<T extends SalesStrategyArtifactType>(artifactType: T, details: unknown) {
  return {
    as_of_date: "2026-08-10",
    summary: `Complete ${artifactType} evidence`,
    evidence: [evidence],
    findings: [finding],
    actions: [action],
    unknowns: ["Unobserved account outcomes"],
    details,
  }
}

const samples = {
  "sales-strategy/research-charter": payload("sales-strategy/research-charter", {
    objective: "Prioritize sales opportunities and positioning",
    audience: "Sales leadership",
    scope: ["Named customer segments"],
    decision_questions: ["Which segment has the strongest evidenced fit?"],
    source_policy: ["Use supplied data and definitions"],
    stopping_conditions: ["All named periods reconcile"],
  }),
  "sales-strategy/customer-dossier": payload("sales-strategy/customer-dossier", {
    sources: [evidence],
    coverage: ["Customer needs, buying signals, and outcomes"],
    data_quality: ["Metric definitions reconcile"],
    conflicts: ["No material conflict"],
    gaps: ["Later period unavailable"],
  }),
  "sales-strategy/opportunity-analysis": payload("sales-strategy/opportunity-analysis", {
    analytical_frame: "Trend and variance",
    comparisons: ["Current quarter against prior quarter"],
    calculations: ["Enterprise fit ranks highest on stated criteria"],
    implications: ["Opportunity priority must reflect reachability"],
  }),
  "sales-strategy/positioning-analysis": payload("sales-strategy/positioning-analysis", {
    analytical_frame: "Segment contribution",
    comparisons: ["Enterprise against small business"],
    calculations: ["Enterprise supplied sixty percent of growth"],
    implications: ["Concentration risk remains"],
  }),
  "sales-strategy/strategy-brief": payload("sales-strategy/strategy-brief", {
    priorities: ["Focus the highest-fit reachable segment"],
    tradeoffs: ["Growth against concentration"],
    recommended_sequence: ["Validate segment", "Run retention experiment"],
    measurement_plan: ["Review monthly cohort retention"],
  }),
  "sales-strategy/audit": payload("sales-strategy/audit", {
    audited_claims: ["Qualified pipeline increased ten percent"],
    numerical_checks: ["Opportunity score reproduced"],
    source_checks: ["Metric definition matched"],
    required_corrections: ["Label test data"],
    publication_guidance: "Publish after labeling the dataset",
  }),
  "sales-strategy/playbook": payload("sales-strategy/playbook", {
    title: "Sales Strategy Playbook",
    sections: ["Executive summary", "Analysis", "Actions"],
    audit_resolution: ["Test data label added"],
    markdown_path: "artifacts/sales-strategy/playbook.md",
    interactive_renderer: "document@1" as const,
  }),
} as const

afterAll(async () => {
  await resetMemoryDatabase()
})
describe("Sales Strategy expert squad package", () => {
  test("loads its complete typed package and seven-node parallel workflow", async () => {
    const loaded = await ExpertSquadRegistry.loadSourcePackage(packageRoot)
    expect(loaded.manifest).toMatchObject({
      schema_version: 1,
      namespace: "builtin",
      id: "sales-strategy",
      name: "Sales Strategy & Customer Research",
      version: "2026.08.13.1",
      product_pillars: ["work"],
    })
    expect(Object.keys(loaded.manifest.capability_projection.agents)).toEqual(Object.keys(dependencies))
    expect([...loaded.packageSkills.keys()]).toEqual(skillRefs)
    expect([...loaded.packageToolBundles.keys()]).toEqual([publisherRef])
    const workflow = loaded.manifest.capability_projection.virtual_workflows["sales-strategy-playbook"]!
    expect(Object.fromEntries(Object.entries(workflow.nodes).map(([id, node]) => [id, node.depends_on]))).toEqual(
      dependencies,
    )
  })

  test("parses one complete current value for every package Artifact codec", () => {
    expect(
      Object.entries(samples).map(([type, sample]) =>
        SalesStrategyArtifactSchemas[type as SalesStrategyArtifactType].parse(sample),
      ),
    ).toHaveLength(7)
  })

  test("projects the exact workflow, Skills, and typed publisher through the active package", async () => {
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
        const config = Config.Info.parse({ prompt_profile: { active: "sales-strategy" } })
        const scheduler = await PromptProfileResolver.resolveSchedulerCapability({
          projectDirectory: project.path,
          config,
        })
        expect(scheduler.expertSquadID).toBe("sales-strategy")
        expect(scheduler.productionSkills.map((entry) => entry.ref)).toEqual(skillRefs)
        expect(Object.keys(scheduler.virtualWorkflows)).toEqual(["sales-strategy-playbook"])
        for (const agentID of Object.keys(dependencies)) {
          const worker = await PromptProfileResolver.resolveWorkerCapability({
            projectDirectory: project.path,
            config,
            agentID,
          })
          expect(worker.expertSquadID).toBe("sales-strategy")
          expect(worker.productionSkills.map((entry) => entry.ref)).toEqual(skillRefs)
          expect(worker.packageTools.map((entry) => entry.ref)).toEqual([publisherRef])
        }
      },
    })
  }, 30_000)

  test("publishes and consumes exact typed predecessor evidence in a real memory Task", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const loaded = await ExpertSquadRegistry.loadSourcePackage(packageRoot)
        const session = Session.prepareRootNext({ kind: "root", directory: Instance.directory, title: "Sales Strategy typed Artifact chain" })
        const taskID = Identifier.ascending("task")
        const started = Date.now()
        await ensureGitProjectMetadata()
        persistTask({
          taskID,
          rootSession: session,
          now: started,
          title: "Sales Strategy typed Artifact chain",
          request: "Publish and consume exact Sales Strategy evidence",
          productPillar: "work",
          source: "test",
          priority: "normal",
          metadata: { actor: "user" },
          projectID: Instance.project.id,
          packageRevision: {
            scope: "project",
            projectID: Instance.project.id,
            namespace: "builtin",
            id: "sales-strategy",
            version: loaded.manifest.version,
            packageDigest: loaded.packageDigest,
          },
          executionCapsuleBinding: await prepareTaskProcessBinding({
            mode: "native",
            taskID,
            projectID: Instance.project.id,
            rootDirectory: project.path,
            packageRevisionSHA256: loaded.packageDigest,
            timeCreated: started,
          }),
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
        const assistantMessage = await Session.updateMessage({
          id: Identifier.ascending("message"),
          sessionID: session.id,
          role: "assistant",
          author: "sales-strategy-planner",
          time: { created: started, completed: started + 1 },
          parentID: userMessage.id,
          modelID: "test",
          providerID: "test",
          agent: "sales-strategy-planner",
          path: { cwd: project.path, root: project.path },
          cost: 0,
          tokens: { input: 0, output: 0, reasoning: 0, total: 0, cache: { read: 0, write: 0 } },
          finish: "stop",
        })
        const scope: TaskToolExecutionScope = {
          kind: "task",
          projectID: Instance.project.id,
          projectDirectory: project.path,
          taskID,
          taskRuntimeDirectory: ProjectRuntimePaths.taskRoot(project.path, taskID),
          sessionID: session.id,
          messageID: assistantMessage.id,
          toolCallID: "call-sales-strategy-chain",
          toolPartID: "part-sales-strategy-chain",
          executionSurface: {},
          owner: {
            kind: "projected-worker",
            expertSquadID: "sales-strategy",
            packageRevision: {
              scope: "project",
              projectID: Instance.project.id,
              namespace: "builtin",
              id: "sales-strategy",
              version: loaded.manifest.version,
              packageDigest: loaded.packageDigest,
            },
            agentID: "sales-strategy-planner",
            projectionHash: "a".repeat(64),
            workerTurnDescriptorID: "descriptor-sales-strategy-chain",
            workerTurnDescriptorHash: "b".repeat(64),
          },
        }
        await withTaskScopedPluginToolHost(scope, async (host) => {
          const charterReceipt = JSON.parse(
            await publishSalesStrategyArtifact.execute(
              {
                artifact: {
                  artifact_type: "sales-strategy/research-charter",
                  payload: samples["sales-strategy/research-charter"],
                },
                resource_set: null,
                source_artifact_locators: [],
              },
              { host } as never,
            ),
          ) as { locator: EngineArtifactLocator }
          ;(scope.owner as { agentID: string }).agentID = "sales-customer-researcher"
          const dossierReceipt = JSON.parse(
            await publishSalesStrategyArtifact.execute(
              {
                artifact: {
                  artifact_type: "sales-strategy/customer-dossier",
                  payload: samples["sales-strategy/customer-dossier"],
                },
                resource_set: null,
                source_artifact_locators: [charterReceipt.locator],
              },
              { host } as never,
            ),
          ) as { locator: EngineArtifactLocator; artifact_sha256: string }
          const dossierRead = await host.engineArtifacts.read({
            locator: dossierReceipt.locator,
            byte_offset: 0,
            max_bytes: 65_536,
            delivery: "inline",
          })
          const dossierEnvelope = EngineArtifactEnvelopeSchema.parse(JSON.parse(dossierRead.chunk.text!))
          expect(dossierEnvelope).toMatchObject({
            artifact_type: "sales-strategy/customer-dossier",
            schema_version: 1,
            payload: samples["sales-strategy/customer-dossier"],
            source_artifact_locators: [charterReceipt.locator],
            producer: {
              owner_kind: "projected-worker",
              expert_squad_id: "sales-strategy",
              agent_id: "sales-customer-researcher",
            },
          })
          expect(dossierReceipt.artifact_sha256).toMatch(/^[a-f0-9]{64}$/)

          const publish = async (
            artifactType: keyof typeof samples,
            producer: keyof typeof dependencies,
            sources: EngineArtifactLocator[],
            resourceSet: ReturnType<typeof TaskArtifactResourceSetLocatorSchema.parse> | null = null,
          ) => {
            ;(scope.owner as { agentID: string }).agentID = producer
            return JSON.parse(
              await publishSalesStrategyArtifact.execute(
                {
                  artifact: { artifact_type: artifactType, payload: samples[artifactType] } as never,
                  resource_set: resourceSet,
                  source_artifact_locators: sources,
                },
                { host } as never,
              ),
            ) as { locator: EngineArtifactLocator; artifact_sha256: string }
          }
          const performanceReceipt = await publish("sales-strategy/opportunity-analysis", "sales-opportunity-analyst", [
            dossierReceipt.locator,
          ])
          const segmentReceipt = await publish("sales-strategy/positioning-analysis", "sales-positioning-analyst", [
            dossierReceipt.locator,
          ])
          const insightReceipt = await publish("sales-strategy/strategy-brief", "sales-strategy-synthesizer", [
            performanceReceipt.locator,
            segmentReceipt.locator,
          ])
          const auditReceipt = await publish("sales-strategy/audit", "sales-strategy-fact-checker", [
            insightReceipt.locator,
          ])
          const stage = await host.taskArtifacts.stage({ trees: ["sales-strategy-delivery"] })
          await writeFile(
            path.join(stage.treeDirectories["sales-strategy-delivery"]!, "playbook.md"),
            "# Sales Strategy Playbook\n",
          )
          const publication = await host.taskArtifacts.publish(stage, {
            snapshot_kind: "catalog",
            files: [{ tree: "sales-strategy-delivery", path: "playbook.md", media_type: "text/markdown" }],
          })
          const resourceSet = TaskArtifactResourceSetLocatorSchema.parse({
            snapshot: publication.snapshot,
            tree: "sales-strategy-delivery",
          })
          const playbookSources = [
            charterReceipt.locator,
            dossierReceipt.locator,
            performanceReceipt.locator,
            segmentReceipt.locator,
            insightReceipt.locator,
            auditReceipt.locator,
          ]
          const playbookReceipt = await publish(
            "sales-strategy/playbook",
            "sales-playbook-writer",
            playbookSources,
            resourceSet,
          )
          const playbookRead = await host.engineArtifacts.read({
            locator: playbookReceipt.locator,
            byte_offset: 0,
            max_bytes: 65_536,
            delivery: "inline",
          })
          const playbookEnvelope = EngineArtifactEnvelopeSchema.parse(JSON.parse(playbookRead.chunk.text!))
          expect(playbookEnvelope.resources.map((resource) => resource.path)).toEqual(["playbook.md"])
          expect(
            [...playbookEnvelope.source_artifact_locators].sort((left, right) =>
              left.artifact_id.localeCompare(right.artifact_id),
            ),
          ).toEqual([...playbookSources].sort((left, right) => left.artifact_id.localeCompare(right.artifact_id)))
          expect(playbookEnvelope.producer).toMatchObject({
            owner_kind: "projected-worker",
            expert_squad_id: "sales-strategy",
            agent_id: "sales-playbook-writer",
          })
          expect(playbookReceipt.artifact_sha256).toMatch(/^[a-f0-9]{64}$/)
        })
      },
    })
  }, 30_000)
})
