import { afterAll, describe, expect, test } from "bun:test"
import { Config } from "../src/config/config"
import { EffectiveConfig } from "../src/config/effective"
import { PromptProfileResolver } from "../src/expert-squad/prompt-profile-resolver"
import { ExpertSquadPackageManager } from "../src/expert-squad/manager"
import { Instance } from "../src/project/instance"
import { resetMemoryDatabase, memoryProject } from "./fixture/memory"
import { MCP } from "../src/mcp"
import { projectedTaskToolRuntimeBindingOf } from "../src/tool/task-tool-execution-scope"
import { configureTaskIngressRunner } from "../src/engine/task-root-ingress-delivery"
import { EngineService } from "../src/task-api"

afterAll(async () => {
  await resetMemoryDatabase()
})

const agentTools = {
  "evolution-observer": [
    "evolution-lab/shared/collect-run-evidence",
    "evolution-lab/shared/publish-evolution-artifact",
  ],
  "evolution-failure-analyst": ["evolution-lab/shared/publish-evolution-artifact"],
  "evolution-experiment-planner": [
    "evolution-lab/shared/expert-squad-package",
    "evolution-lab/shared/publish-evolution-artifact",
    "evolution-lab/shared/rehydrate-evolution-resources",
  ],
  "evolution-candidate-author": [
    "evolution-lab/shared/expert-squad-package",
    "evolution-lab/shared/publish-evolution-artifact",
    "evolution-lab/shared/rehydrate-evolution-resources",
  ],
  "evolution-evaluator": [
    "evolution-lab/shared/collect-run-evidence",
    "evolution-lab/shared/execute-evolution-metrics",
    "evolution-lab/shared/publish-evolution-artifact",
    "evolution-lab/shared/rehydrate-evolution-resources",
  ],
  "evolution-safety-auditor": [
    "evolution-lab/shared/expert-squad-package",
    "evolution-lab/shared/publish-evolution-artifact",
    "evolution-lab/shared/rehydrate-evolution-resources",
  ],
  "evolution-recommendation-owner": ["evolution-lab/shared/publish-evolution-artifact"],
} as const

const workflowDependencies = {
  "evolution-opportunity-analysis": {
    "evolution-observer": [],
    "evolution-failure-analyst": ["evolution-observer"],
  },
  "evolution-candidate-preparation": {
    "evolution-experiment-planner": [],
    "evolution-candidate-author": ["evolution-experiment-planner"],
    "evolution-observer": ["evolution-experiment-planner"],
  },
  "evolution-campaign-evaluation": {
    "evolution-evaluator": [],
    "evolution-safety-auditor": ["evolution-evaluator"],
    "evolution-recommendation-owner": ["evolution-evaluator", "evolution-safety-auditor"],
  },
} as const

describe("Evolution Lab complete package projection", () => {
  test("projects the released package workflow, skills, agents, and exact package tools", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const receipt = await ExpertSquadPackageManager.installPayloadPackage({
          projectDirectory: project.path,
          id: "evolution-lab",
          installationScope: "project",
        })
        expect(receipt).toMatchObject({
          operation: "installed",
          after: {
            installationScope: "project",
            namespace: "builtin",
            id: "evolution-lab",
            version: "2026.08.30.2",
          },
        })
        const config = Config.mergeOverlay(await EffectiveConfig.snapshotCurrent(), {
          prompt_profile: { active: "evolution-lab" },
        })
        const revision = await PromptProfileResolver.resolveActivePackageRevision({
          projectDirectory: project.path,
          config,
        })
        expect(revision).toMatchObject({
          id: "evolution-lab",
          namespace: "builtin",
          version: "2026.08.30.2",
        })

        const scheduler = await PromptProfileResolver.resolveSchedulerCapability({
          projectDirectory: project.path,
          config,
          packageRevision: revision,
        })
        expect(scheduler.expertSquadID).toBe("evolution-lab")
        expect(scheduler.packageRevision).toEqual(revision)
        expect(scheduler.builtInToolIDs).toEqual(
          expect.arrayContaining(["artifact_search", "artifact_read", "artifact_select", "artifact_snapshot"]),
        )
        expect(scheduler.productionSkills.map((grant) => grant.ref)).toEqual(["evolution-lab/shared/campaign"])
        expect(Object.keys(scheduler.virtualWorkflows)).toEqual(Object.keys(workflowDependencies))
        for (const [workflowID, dependencies] of Object.entries(workflowDependencies)) {
          expect(scheduler.virtualWorkflows[workflowID]!.nodes).toEqual(
            Object.fromEntries(
              Object.entries(dependencies).map(([agentID, dependsOn]) => [
                agentID,
                expect.objectContaining({ agent_id: agentID, depends_on: [...dependsOn] }),
              ]),
            ),
          )
        }

        for (const [agentID, expectedTools] of Object.entries(agentTools)) {
          const worker = await PromptProfileResolver.resolveWorkerCapability({
            projectDirectory: project.path,
            config,
            packageRevision: revision,
            agentID,
          })
          expect(worker.expertSquadID).toBe("evolution-lab")
          expect(worker.packageRevision).toEqual(revision)
          expect(worker.productionSkills.map((grant) => grant.ref)).toEqual(["evolution-lab/shared/campaign"])
          expect(worker.packageTools.map((entry) => entry.ref).sort()).toEqual([...expectedTools])
        }

        const observer = await PromptProfileResolver.resolveWorkerCapability({
          projectDirectory: project.path,
          config,
          packageRevision: revision,
          agentID: "evolution-observer",
        })
        const exactEntry = observer.packageTools[0]!
        configureTaskIngressRunner(async () => {})
        const exactTaskID = await EngineService.createTask(
          {
            requestID: "evolution-lab-exact-package-tool",
            request: "Materialize one exact Evolution Lab package Tool definition",
            productPillar: "code",
            model: "firmware/gpt-5",
            promptProfile: "evolution-lab",
            expectedPackageDigest: revision.packageDigest,
          },
          { actor: "user" },
        )
        const owner = MCP.createScopedConnectionOwner("test:evolution-lab-exact-package-tool")
        try {
          const exact = await PromptProfileResolver.exactProjectedExtensionTool({
            capability: observer,
            providerName: exactEntry.providerName,
            runtimeTools: {},
            taskID: exactTaskID,
            projectDirectory: project.path,
            toolDirectory: project.path,
            connectionOwner: owner,
          })
          expect(exact).toBeDefined()
          expect(projectedTaskToolRuntimeBindingOf(exact as object)).toMatchObject({
            providerKind: "package-tool",
            providerName: exactEntry.providerName,
            toolRef: exactEntry.ref,
            packageRevision: revision,
          })
        } finally {
          await owner.close()
        }
      },
    })
  }, 0)
})
