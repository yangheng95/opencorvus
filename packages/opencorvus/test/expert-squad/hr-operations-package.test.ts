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
  HrOperationsArtifactSchemas,
  type HrOperationsArtifactType,
} from "@squads/hr-operations/lib/hr-operations/artifacts"
import publishHrOperationsArtifact from "@squads/hr-operations/tools/publish-hr-operations-artifact"

const packageRoot = path.resolve(import.meta.dir, "../../../..", "expert-squads", "builtin", "hr-operations")
const skillRefs = ["hr-operations/shared/method", "hr-operations/shared/workflow"]
const publisherRef = "hr-operations/shared/publish-hr-operations-artifact"
const dependencies = {
  "human-resources-operations-planner": [],
  "human-resources-evidence-curator": ["human-resources-operations-planner"],
  "workforce-analyst": ["human-resources-evidence-curator"],
  "people-process-analyst": ["human-resources-evidence-curator"],
  "organization-operations-synthesizer": ["people-process-analyst", "workforce-analyst"],
  "human-resources-fact-checker": ["organization-operations-synthesizer"],
  "human-resources-operating-plan-writer": ["human-resources-fact-checker"],
} as const

const evidence = {
  id: "source-1",
  source: "aggregate-workforce.csv",
  observed_at: "2026-08-10",
  statement: "Aggregate headcount and people-process measures are available by function.",
  limitation: "Test dataset",
}
const finding = {
  claim: "Onboarding cycle time improved",
  method: "Function and period comparison",
  result: "Ten percent shorter cycle time",
  evidence_ids: ["source-1"],
  confidence: "high" as const,
}
const action = {
  action: "Standardize the strongest onboarding practice",
  rationale: "It contributed most of the cycle-time improvement",
  owner: "People operations lead",
  timing: "Next planning cycle",
  success_measure: "Sustained onboarding cycle-time improvement",
}
function payload<T extends HrOperationsArtifactType>(artifactType: T, details: unknown) {
  return {
    as_of_date: "2026-08-10",
    summary: `Complete ${artifactType} evidence`,
    evidence: [evidence],
    findings: [finding],
    actions: [action],
    unknowns: ["Later-period workforce outcomes"],
    details,
  }
}

const samples = {
  "hr-operations/operating-charter": payload("hr-operations/operating-charter", {
    objective: "Improve aggregate workforce and people-process operations",
    audience: "Organization leadership",
    scope: ["Aggregate workforce and onboarding process"],
    decision_questions: ["Which workforce and process changes are evidenced?"],
    source_policy: ["Use supplied data and definitions"],
    stopping_conditions: ["All named periods reconcile"],
  }),
  "hr-operations/evidence-dossier": payload("hr-operations/evidence-dossier", {
    sources: [evidence],
    coverage: ["Aggregate headcount, movement, and onboarding cycle time"],
    data_quality: ["Metric definitions reconcile"],
    conflicts: ["No material conflict"],
    gaps: ["Later period unavailable"],
  }),
  "hr-operations/workforce-analysis": payload("hr-operations/workforce-analysis", {
    analytical_frame: "Trend and variance",
    comparisons: ["Current quarter against prior quarter"],
    calculations: ["Onboarding cycle time improved ten percent"],
    implications: ["Capacity and process evidence must be reconciled"],
  }),
  "hr-operations/process-analysis": payload("hr-operations/process-analysis", {
    analytical_frame: "Segment contribution",
    comparisons: ["Functions against organization aggregate"],
    calculations: ["One function supplied sixty percent of improvement"],
    implications: ["Concentration risk remains"],
  }),
  "hr-operations/operating-plan-draft": payload("hr-operations/operating-plan-draft", {
    priorities: ["Improve onboarding consistency"],
    tradeoffs: ["Process speed against control quality"],
    recommended_sequence: ["Validate segment", "Run retention experiment"],
    measurement_plan: ["Review monthly cohort retention"],
  }),
  "hr-operations/audit": payload("hr-operations/audit", {
    audited_claims: ["Onboarding cycle time improved ten percent"],
    numerical_checks: ["Cycle-time calculation reproduced"],
    source_checks: ["Metric definition matched"],
    required_corrections: ["Label test data"],
    publication_guidance: "Publish after labeling the dataset",
  }),
  "hr-operations/operating-plan": payload("hr-operations/operating-plan", {
    title: "Human Resources Operating Plan",
    sections: ["Executive summary", "Analysis", "Actions"],
    audit_resolution: ["Test data label added"],
    markdown_path: "artifacts/hr-operations/operating-plan.md",
    interactive_renderer: "document@1" as const,
  }),
} as const

afterAll(async () => {
  await resetMemoryDatabase()
})
describe("Human Resources Operations expert squad package", () => {
  test("loads its complete typed package and seven-node parallel workflow", async () => {
    const loaded = await ExpertSquadRegistry.loadSourcePackage(packageRoot)
    expect(loaded.manifest).toMatchObject({
      schema_version: 2,
      namespace: "builtin",
      id: "hr-operations",
      name: "Human Resources & Organization Operations",
      version: "2026.08.30.2",
      product_pillars: ["work"],
    })
    expect(Object.keys(loaded.manifest.capability_projection.agents)).toEqual(Object.keys(dependencies))
    expect([...loaded.packageSkills.keys()]).toEqual(skillRefs)
    expect([...loaded.packageToolBundles.keys()]).toEqual([publisherRef])
    const workflow = loaded.manifest.capability_projection.virtual_workflows["people-operations-plan"]!
    expect(Object.fromEntries(Object.entries(workflow.nodes).map(([id, node]) => [id, node.depends_on]))).toEqual(
      dependencies,
    )
  })

  test("parses one complete current value for every package Artifact codec", () => {
    expect(
      Object.entries(samples).map(([type, sample]) =>
        HrOperationsArtifactSchemas[type as HrOperationsArtifactType].parse(sample),
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
        const config = Config.Info.parse({ prompt_profile: { active: "hr-operations" } })
        const scheduler = await PromptProfileResolver.resolveSchedulerCapability({
          projectDirectory: project.path,
          config,
        })
        expect(scheduler.expertSquadID).toBe("hr-operations")
        expect(scheduler.productionSkills.map((entry) => entry.ref)).toEqual(skillRefs)
        expect(Object.keys(scheduler.virtualWorkflows)).toEqual(["people-operations-plan"])
        for (const agentID of Object.keys(dependencies)) {
          const worker = await PromptProfileResolver.resolveWorkerCapability({
            projectDirectory: project.path,
            config,
            agentID,
          })
          expect(worker.expertSquadID).toBe("hr-operations")
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
        const session = Session.prepareRootNext({ kind: "root", directory: Instance.directory, title: "Human Resources Operations typed Artifact chain" })
        const taskID = Identifier.ascending("task")
        const started = Date.now()
        await ensureGitProjectMetadata()
        persistTask({
          taskID,
          rootSession: session,
          now: started,
          title: "Human Resources Operations typed Artifact chain",
          request: "Publish and consume exact Human Resources Operations evidence",
          productPillar: "work",
          source: "test",
          priority: "normal",
          metadata: { actor: "user" },
          projectID: Instance.project.id,
          packageRevision: {
            scope: "project",
            projectID: Instance.project.id,
            namespace: "builtin",
            id: "hr-operations",
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
          author: "human-resources-operations-planner",
          time: { created: started },
          parentID: userMessage.id,
          modelID: "test",
          providerID: "test",
          agent: "human-resources-operations-planner",
          path: { cwd: project.path, root: project.path },
          cost: 0,
          tokens: { input: 0, output: 0, reasoning: 0, total: 0, cache: { read: 0, write: 0 } },
        })
        await Session.updatePart({
          id: "step-hr-operations-chain",
          sessionID: session.id,
          messageID: assistantMessage.id,
          type: "step-start",
        })
        await Session.updatePart({
          id: "part-hr-operations-chain",
          sessionID: session.id,
          messageID: assistantMessage.id,
          type: "tool",
          callID: "call-hr-operations-chain",
          tool: publisherRef,
          state: { status: "running", input: {}, time: { start: started + 1 } },
        })
        const scope: TaskToolExecutionScope = {
          kind: "task",
          projectID: Instance.project.id,
          projectDirectory: project.path,
          taskID,
          taskRuntimeDirectory: ProjectRuntimePaths.taskRoot(project.path, taskID),
          sessionID: session.id,
          messageID: assistantMessage.id,
          toolCallID: "call-hr-operations-chain",
          toolPartID: "part-hr-operations-chain",
          executionSurface: {},
          owner: {
            kind: "projected-worker",
            expertSquadID: "hr-operations",
            packageRevision: {
              scope: "project",
              projectID: Instance.project.id,
              namespace: "builtin",
              id: "hr-operations",
              version: loaded.manifest.version,
              packageDigest: loaded.packageDigest,
            },
            agentID: "human-resources-operations-planner",
            projectionHash: "a".repeat(64),
            workerTurnDescriptorID: "descriptor-hr-operations-chain",
            workerTurnDescriptorHash: "b".repeat(64),
          },
        }
        await withTaskScopedPluginToolHost(scope, async (host) => {
          const charterReceipt = JSON.parse(
            await publishHrOperationsArtifact.execute(
              {
                artifact: {
                  artifact_type: "hr-operations/operating-charter",
                  payload: samples["hr-operations/operating-charter"],
                },
                resource_set: null,
                source_artifact_locators: [],
              },
              { host } as never,
            ),
          ) as { locator: EngineArtifactLocator }
          ;(scope.owner as { agentID: string }).agentID = "human-resources-evidence-curator"
          const dossierReceipt = JSON.parse(
            await publishHrOperationsArtifact.execute(
              {
                artifact: {
                  artifact_type: "hr-operations/evidence-dossier",
                  payload: samples["hr-operations/evidence-dossier"],
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
            artifact_type: "hr-operations/evidence-dossier",
            schema_version: 1,
            payload: samples["hr-operations/evidence-dossier"],
            source_artifact_locators: [charterReceipt.locator],
            producer: {
              owner_kind: "projected-worker",
              expert_squad_id: "hr-operations",
              agent_id: "human-resources-evidence-curator",
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
              await publishHrOperationsArtifact.execute(
                {
                  artifact: { artifact_type: artifactType, payload: samples[artifactType] } as never,
                  resource_set: resourceSet,
                  source_artifact_locators: sources,
                },
                { host } as never,
              ),
            ) as { locator: EngineArtifactLocator; artifact_sha256: string }
          }
          const performanceReceipt = await publish("hr-operations/workforce-analysis", "workforce-analyst", [
            dossierReceipt.locator,
          ])
          const segmentReceipt = await publish("hr-operations/process-analysis", "people-process-analyst", [
            dossierReceipt.locator,
          ])
          const insightReceipt = await publish(
            "hr-operations/operating-plan-draft",
            "organization-operations-synthesizer",
            [performanceReceipt.locator, segmentReceipt.locator],
          )
          const auditReceipt = await publish("hr-operations/audit", "human-resources-fact-checker", [
            insightReceipt.locator,
          ])
          const stage = await host.taskArtifacts.stage({ trees: ["hr-operations-delivery"] })
          await writeFile(
            path.join(stage.treeDirectories["hr-operations-delivery"]!, "operating-plan.md"),
            "# Human Resources Operating Plan\n",
          )
          const publication = await host.taskArtifacts.publish(stage, {
            snapshot_kind: "catalog",
            files: [{ tree: "hr-operations-delivery", path: "operating-plan.md", media_type: "text/markdown" }],
          })
          const resourceSet = TaskArtifactResourceSetLocatorSchema.parse({
            snapshot: publication.snapshot,
            tree: "hr-operations-delivery",
          })
          const operatingPlanSources = [
            charterReceipt.locator,
            dossierReceipt.locator,
            performanceReceipt.locator,
            segmentReceipt.locator,
            insightReceipt.locator,
            auditReceipt.locator,
          ]
          const operatingPlanReceipt = await publish(
            "hr-operations/operating-plan",
            "human-resources-operating-plan-writer",
            operatingPlanSources,
            resourceSet,
          )
          const operatingPlanRead = await host.engineArtifacts.read({
            locator: operatingPlanReceipt.locator,
            byte_offset: 0,
            max_bytes: 65_536,
            delivery: "inline",
          })
          const operatingPlanEnvelope = EngineArtifactEnvelopeSchema.parse(JSON.parse(operatingPlanRead.chunk.text!))
          expect(operatingPlanEnvelope.resources.map((resource) => resource.path)).toEqual(["operating-plan.md"])
          expect(
            [...operatingPlanEnvelope.source_artifact_locators].sort((left, right) =>
              left.artifact_id.localeCompare(right.artifact_id),
            ),
          ).toEqual([...operatingPlanSources].sort((left, right) => left.artifact_id.localeCompare(right.artifact_id)))
          expect(operatingPlanEnvelope.producer).toMatchObject({
            owner_kind: "projected-worker",
            expert_squad_id: "hr-operations",
            agent_id: "human-resources-operating-plan-writer",
          })
          expect(operatingPlanReceipt.artifact_sha256).toMatch(/^[a-f0-9]{64}$/)
        })
      },
    })
  }, 30_000)
})
