import { afterAll, describe, expect, test } from "bun:test"
import path from "node:path"
import { Config } from "../../src/config/config"
import { ExpertSquadPackageManager } from "../../src/expert-squad/manager"
import { PromptProfileResolver } from "../../src/expert-squad/prompt-profile-resolver"
import { ExpertSquadRegistry } from "../../src/expert-squad/registry"
import { Instance } from "../../src/project/instance"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"

const squadIDs = [
  "public-health-surveillance",
  "medical-imaging-quality-assurance",
  "veterinary-care-operations",
  "industrial-hygiene-exposure-assessment",
  "battery-safety-reliability",
  "materials-failure-analysis",
  "digital-forensics-incident-investigation",
  "anti-money-laundering-compliance",
  "customs-trade-compliance",
  "forestry-wildfire-resource-management",
] as const

const fiveAgentSquads = new Set<string>([
  "medical-imaging-quality-assurance",
  "veterinary-care-operations",
  "digital-forensics-incident-investigation",
  "anti-money-laundering-compliance",
  "customs-trade-compliance",
  "forestry-wildfire-resource-management",
])
const sourceRoot = (id: string) => path.resolve(import.meta.dir, "../../../..", "expert-squads", "builtin", id)

afterAll(async () => {
  await resetMemoryDatabase()
})

describe("Seventh ten-domain generated payload integration", () => {
  test("publishes exactly ten additions with one saved Skill in the one-hundred-five-package Market payload", async () => {
    await using project = await memoryProject()
    const market = await ExpertSquadPackageManager.payloadMarket({ projectDirectory: project.path })
    const additions = market
      .filter((entry) => squadIDs.includes(entry.id as (typeof squadIDs)[number]))
      .map((entry) => ({ id: entry.id, skillCount: entry.skillCount }))

    expect(market).toHaveLength(105)
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
          expect(receipt).toMatchObject({
            operation: "installed",
            after: { id, installationScope: "project", version: source.version, packageDigest: source.packageDigest },
          })
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
          const skillRef = id + "/shared/method"
          const nodes = Object.values(Object.values(source.manifest.capability_projection.virtual_workflows)[0]!.nodes)
          const expectedAgentCount = fiveAgentSquads.has(id) ? 5 : 4
          const expectedRootCount = expectedAgentCount - 1
          expect(revision).toMatchObject({ id, version: source.version, packageDigest: source.packageDigest })
          expect(scheduler.productionSkills.map((skill) => skill.ref)).toEqual([skillRef])
          expect(Object.keys(scheduler.virtualWorkflows)).toHaveLength(1)
          expect(Object.keys(source.manifest.capability_projection.agents)).toHaveLength(expectedAgentCount)
          expect(nodes.filter((node) => node.depends_on.length === 0)).toHaveLength(expectedRootCount)
          expect(nodes.filter((node) => node.depends_on.length === expectedRootCount)).toHaveLength(1)
          for (const agentID of Object.keys(source.manifest.capability_projection.agents)) {
            const worker = await PromptProfileResolver.resolveWorkerCapability({
              projectDirectory: project.path,
              config,
              packageRevision: revision,
              agentID,
            })
            expect(worker.productionSkills.map((skill) => skill.ref)).toEqual([skillRef])
          }
        }
      },
    })
  }, 60_000)
})
