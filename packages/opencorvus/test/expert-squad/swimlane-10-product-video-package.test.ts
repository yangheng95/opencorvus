import { afterAll, describe, expect, test } from "bun:test"
import path from "node:path"
import { Config } from "../../src/config/config"
import { ExpertSquadPackageManager } from "../../src/expert-squad/manager"
import { PromptProfileResolver } from "../../src/expert-squad/prompt-profile-resolver"
import { ExpertSquadRegistry } from "../../src/expert-squad/registry"
import { Instance } from "../../src/project/instance"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"

afterAll(async () => {
  await resetMemoryDatabase()
})

const packageRoot = path.resolve(import.meta.dir, "../../../..", "expert-squads", "builtin", "product-video")

const agentIDs = [
  "product-video-brief-strategist",
  "product-video-narrative-producer",
  "product-video-visual-planner",
  "product-video-delivery-reviewer",
]

describe("Product Video Production Expert Squad package", () => {
  test("loads the complete parallel planning and join contract", async () => {
    const loaded = await ExpertSquadRegistry.loadSourcePackage(packageRoot)
    const workflow = loaded.manifest.capability_projection.virtual_workflows["product-video-production-handoff"]!

    expect(loaded.manifest).toMatchObject({
      schema_version: 1,
      namespace: "builtin",
      id: "product-video",
      name: "Product Video Production",
      label: "Product Video Production",
      version: "2026.08.10.1",
      product_pillars: ["work"],
    })
    expect(Object.keys(loaded.manifest.capability_projection.agents)).toEqual(agentIDs)
    expect([...loaded.packageSkills.keys()]).toEqual(["product-video/shared/method"])
    expect(Object.fromEntries(Object.entries(workflow.nodes).map(([id, node]) => [id, node.depends_on]))).toEqual({
      "product-video-brief-strategist": [],
      "product-video-narrative-producer": ["product-video-brief-strategist"],
      "product-video-visual-planner": ["product-video-brief-strategist"],
      "product-video-delivery-reviewer": ["product-video-narrative-producer", "product-video-visual-planner"],
    })
  })

  test("imports and projects the package Skill to scheduler and every worker", async () => {
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
        const config = Config.Info.parse({ prompt_profile: { active: "product-video" } })
        const revision = await PromptProfileResolver.resolveActivePackageRevision({
          projectDirectory: project.path,
          config,
        })
        const scheduler = await PromptProfileResolver.resolveSchedulerCapability({
          projectDirectory: project.path,
          config,
          packageRevision: revision,
        })

        expect(scheduler).toMatchObject({
          expertSquadID: "product-video",
          packageRevision: { id: "product-video", version: "2026.08.10.1" },
        })
        expect(scheduler.productionSkills.map((skill) => skill.ref)).toEqual(["product-video/shared/method"])
        expect(Object.keys(scheduler.virtualWorkflows)).toEqual(["product-video-production-handoff"])

        for (const agentID of agentIDs) {
          const worker = await PromptProfileResolver.resolveWorkerCapability({
            projectDirectory: project.path,
            config,
            packageRevision: revision,
            agentID,
          })
          expect(worker.productionSkills.map((skill) => skill.ref)).toEqual(["product-video/shared/method"])
        }
      },
    })
  }, 30_000)
})
