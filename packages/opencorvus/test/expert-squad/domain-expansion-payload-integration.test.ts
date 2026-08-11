import { afterAll, describe, expect, test } from "bun:test"
import path from "node:path"
import { Config } from "../../src/config/config"
import { ExpertSquadPackageManager } from "../../src/expert-squad/manager"
import { PromptProfileResolver } from "../../src/expert-squad/prompt-profile-resolver"
import { ExpertSquadRegistry } from "../../src/expert-squad/registry"
import { Instance } from "../../src/project/instance"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"

const squadIDs = [
  "cybersecurity-assurance",
  "cloud-platform-architecture",
  "data-engineering-reliability",
  "scientific-research-design",
  "healthcare-operations",
  "education-program-design",
  "supply-chain-logistics",
  "manufacturing-quality",
  "real-estate-due-diligence",
  "ecommerce-merchandising",
] as const

const sourceRoot = (id: string) => path.resolve(import.meta.dir, "../../../..", "expert-squads", "builtin", id)

afterAll(async () => {
  await resetMemoryDatabase()
})

describe("Ten-domain generated payload integration", () => {
  test("retains the prior ten additions with one saved Skill in the seventy-five-package Market payload", async () => {
    await using project = await memoryProject()
    const market = await ExpertSquadPackageManager.payloadMarket({ projectDirectory: project.path })
    const additions = market
      .filter((entry) => squadIDs.includes(entry.id as (typeof squadIDs)[number]))
      .map((entry) => ({ id: entry.id, skillCount: entry.skillCount }))

    expect(market).toHaveLength(75)
    expect(additions).toEqual([...squadIDs].sort().map((id) => ({ id, skillCount: 1 })))
  })

  test("installs every generated revision and resolves its exact Skill and parallel-to-join workflow", async () => {
    await using project = await memoryProject()

    await Instance.provide({
      directory: project.path,
      fn: async () => {
        for (const id of squadIDs) {
          const source = await ExpertSquadRegistry.loadSourcePackage(sourceRoot(id))
          const receipt = await ExpertSquadPackageManager.installPayloadPackage({
            projectDirectory: project.path,
            id,
            installationScope: "project",
          })
          const detail = await ExpertSquadPackageManager.payloadMarketDetail({ projectDirectory: project.path, id })

          expect(receipt).toMatchObject({ operation: "installed", after: { id, installationScope: "project" } })
          expect(detail).toMatchObject({
            id,
            version: source.version,
            packageDigest: source.packageDigest,
            skillCount: 1,
            installations: [{ installedPackageDigest: source.packageDigest, updateAvailable: false }],
          })

          const config = Config.Info.parse({ prompt_profile: { active: id } })
          const revision = await PromptProfileResolver.resolveActivePackageRevision({
            projectDirectory: project.path,
            config,
          })
          const scheduler = await PromptProfileResolver.resolveSchedulerCapability({
            projectDirectory: project.path,
            config,
            packageRevision: revision,
          })
          const expectedRef = `${id}/shared/method`
          const workflows = Object.values(source.manifest.capability_projection.virtual_workflows)

          expect(scheduler.productionSkills.map((skill) => skill.ref)).toEqual([expectedRef])
          expect(Object.keys(scheduler.virtualWorkflows)).toEqual(
            Object.keys(source.manifest.capability_projection.virtual_workflows),
          )
          expect(
            workflows.every((workflow) => {
              const nodes = Object.values(workflow.nodes)
              return (
                nodes.filter((node) => node.depends_on.length === 0).length === 3 &&
                nodes.filter((node) => node.depends_on.length === 3).length === 1
              )
            }),
          ).toBe(true)

          for (const agentID of Object.keys(source.manifest.capability_projection.agents)) {
            const worker = await PromptProfileResolver.resolveWorkerCapability({
              projectDirectory: project.path,
              config,
              packageRevision: revision,
              agentID,
            })
            expect(worker.productionSkills.map((skill) => skill.ref)).toEqual([expectedRef])
          }
        }
      },
    })
  }, 60_000)
})
