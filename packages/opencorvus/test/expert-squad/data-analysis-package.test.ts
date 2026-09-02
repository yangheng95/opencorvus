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
  DataAnalysisArtifactSchemas,
  type DataAnalysisArtifactType,
} from "@squads/data-analysis/lib/data-analysis/artifacts"
import publishDataAnalysisArtifact from "@squads/data-analysis/tools/publish-data-analysis-artifact"

const packageRoot = path.resolve(import.meta.dir, "../../../..", "expert-squads", "builtin", "data-analysis")
const skillRefs = ["data-analysis/shared/method", "data-analysis/shared/workflow"]
const publisherRef = "data-analysis/shared/publish-data-analysis-artifact"
const dependencies = {
  "data-analysis-planner": [],
  "data-analysis-data-steward": ["data-analysis-planner"],
  "data-analysis-performance-analyst": ["data-analysis-data-steward"],
  "data-analysis-segment-analyst": ["data-analysis-data-steward"],
  "data-analysis-insight-synthesizer": ["data-analysis-performance-analyst", "data-analysis-segment-analyst"],
  "data-analysis-fact-checker": ["data-analysis-insight-synthesizer"],
  "data-analysis-report-writer": ["data-analysis-fact-checker"],
} as const

const evidence = {
  id: "source-1",
  source: "operations.csv",
  observed_at: "2026-08-10",
  statement: "Revenue and customer counts are available by month and segment.",
  limitation: "Test dataset",
}
const finding = {
  claim: "Revenue increased",
  method: "Quarter-over-quarter comparison",
  result: "Ten percent increase",
  evidence_ids: ["source-1"],
  confidence: "high" as const,
}
const action = {
  action: "Review the strongest segment",
  rationale: "It contributed most of the observed increase",
  owner: "Operations lead",
  timing: "Next planning cycle",
  success_measure: "Sustained contribution margin",
}
function payload<T extends DataAnalysisArtifactType>(artifactType: T, details: unknown) {
  return {
    as_of_date: "2026-08-10",
    summary: `Complete ${artifactType} evidence`,
    evidence: [evidence],
    findings: [finding],
    actions: [action],
    unknowns: ["Later-period performance"],
    details,
  }
}

const samples = {
  "data-analysis/analysis-charter": payload("data-analysis/analysis-charter", {
    objective: "Explain operating performance",
    audience: "Operating leadership",
    scope: ["Monthly operations"],
    decision_questions: ["Which segment drove change?"],
    source_policy: ["Use supplied data and definitions"],
    stopping_conditions: ["All named periods reconcile"],
  }),
  "data-analysis/data-dossier": payload("data-analysis/data-dossier", {
    sources: [evidence],
    coverage: ["Monthly revenue and customers"],
    data_quality: ["Metric definitions reconcile"],
    conflicts: ["No material conflict"],
    gaps: ["Later period unavailable"],
  }),
  "data-analysis/performance-analysis": payload("data-analysis/performance-analysis", {
    analytical_frame: "Trend and variance",
    comparisons: ["Current quarter against prior quarter"],
    calculations: ["Revenue growth equals ten percent"],
    implications: ["Growth quality needs segment review"],
  }),
  "data-analysis/segment-analysis": payload("data-analysis/segment-analysis", {
    analytical_frame: "Segment contribution",
    comparisons: ["Enterprise against small business"],
    calculations: ["Enterprise supplied sixty percent of growth"],
    implications: ["Concentration risk remains"],
  }),
  "data-analysis/insight-brief": payload("data-analysis/insight-brief", {
    priorities: ["Protect contribution margin"],
    tradeoffs: ["Growth against concentration"],
    recommended_sequence: ["Validate segment", "Run retention experiment"],
    measurement_plan: ["Review monthly cohort retention"],
  }),
  "data-analysis/audit": payload("data-analysis/audit", {
    audited_claims: ["Revenue increased ten percent"],
    numerical_checks: ["Growth calculation reproduced"],
    source_checks: ["Metric definition matched"],
    required_corrections: ["Label test data"],
    publication_guidance: "Publish after labeling the dataset",
  }),
  "data-analysis/report": payload("data-analysis/report", {
    title: "Operating Insight Report",
    sections: ["Executive summary", "Analysis", "Actions"],
    audit_resolution: ["Test data label added"],
    markdown_path: "artifacts/data-analysis/report.md",
    interactive_renderer: "document@1" as const,
  }),
} as const

afterAll(async () => {
  await resetMemoryDatabase()
})

describe("Data Analysis expert squad package", () => {
  test("loads its complete typed package and seven-node parallel workflow", async () => {
    const loaded = await ExpertSquadRegistry.loadSourcePackage(packageRoot)
    expect(loaded.manifest).toMatchObject({
      schema_version: 2,
      namespace: "builtin",
      id: "data-analysis",
      name: "Data Analysis & Business Insights",
      version: "2026.09.02.1",
      product_pillars: ["work"],
    })
    expect(Object.keys(loaded.manifest.capability_projection.agents)).toEqual(Object.keys(dependencies))
    expect([...loaded.packageSkills.keys()]).toEqual(skillRefs)
    expect([...loaded.packageToolBundles.keys()]).toEqual([publisherRef])
    const workflow = loaded.manifest.capability_projection.virtual_workflows["operating-insight-report"]!
    expect(Object.fromEntries(Object.entries(workflow.nodes).map(([id, node]) => [id, node.depends_on]))).toEqual(
      dependencies,
    )
  }, 120_000)

  test("parses one complete current value for every package Artifact codec", () => {
    expect(
      Object.entries(samples).map(([type, sample]) =>
        DataAnalysisArtifactSchemas[type as DataAnalysisArtifactType].parse(sample),
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
        const config = Config.Info.parse({ prompt_profile: { active: "data-analysis" } })
        const scheduler = await PromptProfileResolver.resolveSchedulerCapability({
          projectDirectory: project.path,
          config,
        })
        expect(scheduler.expertSquadID).toBe("data-analysis")
        expect(scheduler.productionSkills.map((entry) => entry.ref)).toEqual(skillRefs)
        expect(Object.keys(scheduler.virtualWorkflows)).toEqual(["operating-insight-report"])
        for (const agentID of Object.keys(dependencies)) {
          const worker = await PromptProfileResolver.resolveWorkerCapability({
            projectDirectory: project.path,
            config,
            agentID,
          })
          expect(worker.expertSquadID).toBe("data-analysis")
          expect(worker.productionSkills.map((entry) => entry.ref)).toEqual(skillRefs)
          expect(worker.packageTools.map((entry) => entry.ref)).toEqual([publisherRef])
        }
      },
    })
  }, 120_000)

  test("publishes and consumes exact typed predecessor evidence in a real memory Task", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const loaded = await ExpertSquadRegistry.loadSourcePackage(packageRoot)
        const session = Session.prepareRootNext({ kind: "root", directory: Instance.directory, title: "Data Analysis typed Artifact chain" })
        const taskID = Identifier.ascending("task")
        const started = Date.now()
        await ensureGitProjectMetadata()
        persistTask({
          taskID,
          rootSession: session,
          now: started,
          title: "Data Analysis typed Artifact chain",
          request: "Publish and consume exact Data Analysis evidence",
          productPillar: "work",
          source: "test",
          priority: "normal",
          metadata: { actor: "user" },
          projectID: Instance.project.id,
          packageRevision: {
            scope: "project",
            projectID: Instance.project.id,
            namespace: "builtin",
            id: "data-analysis",
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
        let invocation = 0
        const publish = async (
          artifactType: keyof typeof samples,
          producer: keyof typeof dependencies,
          sources: EngineArtifactLocator[],
          attachReportResource = false,
        ) => {
          const created = started + 10 + invocation++ * 10
          const assistantMessage = await Session.updateMessage({
            id: Identifier.ascending("message"),
            sessionID: session.id,
            role: "assistant",
            author: producer,
            time: { created },
            parentID: userMessage.id,
            modelID: "test",
            providerID: "test",
            agent: producer,
            path: { cwd: project.path, root: project.path },
            cost: 0,
            tokens: { input: 0, output: 0, reasoning: 0, total: 0, cache: { read: 0, write: 0 } },
          })
          await Session.updatePart({
            id: Identifier.ascending("part"),
            sessionID: session.id,
            messageID: assistantMessage.id,
            type: "step-start",
          })
          const toolPart = await Session.updatePart({
            id: Identifier.ascending("part"),
            sessionID: session.id,
            messageID: assistantMessage.id,
            type: "tool",
            callID: Identifier.ascending("tool"),
            tool: publisherRef,
            state: { status: "running", input: {}, time: { start: created + 1 } },
          })
          const scope: TaskToolExecutionScope = {
            kind: "task",
            projectID: Instance.project.id,
            projectDirectory: project.path,
            taskID,
            taskRuntimeDirectory: ProjectRuntimePaths.taskRoot(project.path, taskID),
            sessionID: session.id,
            messageID: assistantMessage.id,
            toolCallID: toolPart.callID,
            toolPartID: toolPart.id,
            executionSurface: {},
            owner: {
              kind: "projected-worker",
              expertSquadID: "data-analysis",
              packageRevision: {
                scope: "project",
                projectID: Instance.project.id,
                namespace: "builtin",
                id: "data-analysis",
                version: loaded.manifest.version,
                packageDigest: loaded.packageDigest,
              },
              agentID: producer,
              projectionHash: "a".repeat(64),
              workerTurnDescriptorID: Identifier.ascending("artifact"),
              workerTurnDescriptorHash: "b".repeat(64),
            },
          }
          return withTaskScopedPluginToolHost(scope, async (host) => {
            let resourceSet: ReturnType<typeof TaskArtifactResourceSetLocatorSchema.parse> | null = null
            if (attachReportResource) {
              const stage = await host.taskArtifacts.stage({ trees: ["data-analysis-delivery"] })
              await writeFile(
                path.join(stage.treeDirectories["data-analysis-delivery"]!, "report.md"),
                "# Operating Insight Report\n",
              )
              const publication = await host.taskArtifacts.publish(stage, {
                snapshot_kind: "catalog",
                files: [{ tree: "data-analysis-delivery", path: "report.md", media_type: "text/markdown" }],
              })
              resourceSet = TaskArtifactResourceSetLocatorSchema.parse({
                snapshot: publication.snapshot,
                tree: "data-analysis-delivery",
              })
            }
            const receipt = JSON.parse(
              await publishDataAnalysisArtifact.execute(
                {
                  artifact: { artifact_type: artifactType, payload: samples[artifactType] } as never,
                  resource_set: resourceSet,
                  source_artifact_locators: sources,
                },
                { host } as never,
              ),
            ) as { locator: EngineArtifactLocator; artifact_sha256: string }
            const read = await host.engineArtifacts.read({
              locator: receipt.locator,
              byte_offset: 0,
              max_bytes: 65_536,
              delivery: "inline",
            })
            return {
              receipt,
              envelope: EngineArtifactEnvelopeSchema.parse(JSON.parse(read.chunk.text!)),
            }
          })
        }

        const charter = await publish("data-analysis/analysis-charter", "data-analysis-planner", [])
        const dossier = await publish("data-analysis/data-dossier", "data-analysis-data-steward", [
          charter.receipt.locator,
        ])
        expect(dossier.envelope).toMatchObject({
          artifact_type: "data-analysis/data-dossier",
          schema_version: 1,
          payload: samples["data-analysis/data-dossier"],
          source_artifact_locators: [charter.receipt.locator],
          producer: {
            owner_kind: "projected-worker",
            expert_squad_id: "data-analysis",
            agent_id: "data-analysis-data-steward",
          },
        })
        expect(dossier.receipt.artifact_sha256).toMatch(/^[a-f0-9]{64}$/)

        const performance = await publish(
          "data-analysis/performance-analysis",
          "data-analysis-performance-analyst",
          [dossier.receipt.locator],
        )
        const segment = await publish("data-analysis/segment-analysis", "data-analysis-segment-analyst", [
          dossier.receipt.locator,
        ])
        const insight = await publish("data-analysis/insight-brief", "data-analysis-insight-synthesizer", [
          performance.receipt.locator,
          segment.receipt.locator,
        ])
        const audit = await publish("data-analysis/audit", "data-analysis-fact-checker", [
          insight.receipt.locator,
        ])
        const reportSources = [
          charter.receipt.locator,
          dossier.receipt.locator,
          performance.receipt.locator,
          segment.receipt.locator,
          insight.receipt.locator,
          audit.receipt.locator,
        ]
        const report = await publish(
          "data-analysis/report",
          "data-analysis-report-writer",
          reportSources,
          true,
        )
        expect(report.envelope.resources.map((resource) => resource.path)).toEqual(["report.md"])
        expect(
          [...report.envelope.source_artifact_locators].sort((left, right) =>
            left.artifact_id.localeCompare(right.artifact_id),
          ),
        ).toEqual([...reportSources].sort((left, right) => left.artifact_id.localeCompare(right.artifact_id)))
        expect(report.envelope.producer).toMatchObject({
          owner_kind: "projected-worker",
          expert_squad_id: "data-analysis",
          agent_id: "data-analysis-report-writer",
        })
        expect(report.receipt.artifact_sha256).toMatch(/^[a-f0-9]{64}$/)
      },
    })
  }, 120_000)
})
