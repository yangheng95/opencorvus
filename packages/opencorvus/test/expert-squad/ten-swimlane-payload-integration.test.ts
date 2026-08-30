import { afterAll, describe, expect, test } from "bun:test"
import path from "node:path"
import { Config } from "../../src/config/config"
import { ExpertSquadPackageManager } from "../../src/expert-squad/manager"
import { PromptProfileResolver } from "../../src/expert-squad/prompt-profile-resolver"
import { ExpertSquadRegistry } from "../../src/expert-squad/registry"
import { Instance } from "../../src/project/instance"
import { payloadPackageSources } from "../../generated/expert-squad-payload"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"
import { analyzeExpertSquadWorkflowTopology } from "@opencorvus-ai/sdk/expert-squad-authoring"
import { agentCapabilityGrants, allCapabilityGrants, schedulerCapabilityGrants } from "./capability-grant-fixture"

const newSquadIDs = [
  "browser-research-acceptance",
  "office-delivery",
  "product-management",
  "customer-success",
  "finance-operations",
  "meeting-knowledge",
  "procurement-vendor",
  "localization-adaptation",
  "knowledge-base-operations",
  "product-video",
] as const

afterAll(async () => {
  await resetMemoryDatabase()
})

const sourceRoot = (id: string) => path.resolve(import.meta.dir, "../../../..", "expert-squads", "builtin", id)

function projectedSkillCount(manifest: ExpertSquadRegistry.Manifest) {
  const refs = new Set<string>()
  for (const grants of allCapabilityGrants(manifest)) {
    for (const ref of [...grants.defaultSkillRefs, ...grants.packageSkillRefs]) refs.add(ref)
  }
  return refs.size
}

describe("Ten-swimlane generated payload integration", () => {
  test("publishes every new Skill-complete package in the generated Market payload", async () => {
    await using project = await memoryProject()
    const market = await ExpertSquadPackageManager.payloadMarket({ projectDirectory: project.path })
    const additions = market
      .filter((entry) => newSquadIDs.includes(entry.id as (typeof newSquadIDs)[number]))
      .map((entry) => ({ id: entry.id, skillCount: entry.skillCount }))

    expect(market).toHaveLength(payloadPackageSources.length)
    const expected = await Promise.all(
      [...newSquadIDs].sort().map(async (id) => {
        const source = await ExpertSquadRegistry.loadSourcePackage(sourceRoot(id))
        return { id, skillCount: projectedSkillCount(source.manifest) }
      }),
    )
    expect(additions).toEqual(expected)
  })

  test("installs every generated package revision and projects its Skills to scheduler and workers", async () => {
    await using project = await memoryProject()

    await Instance.provide({
      directory: project.path,
      fn: async () => {
        for (const id of newSquadIDs) {
          const source = await ExpertSquadRegistry.loadSourcePackage(sourceRoot(id))
          const receipt = await ExpertSquadPackageManager.installPayloadPackage({
            projectDirectory: project.path,
            id,
            installationScope: "project",
          })
          const detail = await ExpertSquadPackageManager.payloadMarketDetail({
            projectDirectory: project.path,
            id,
          })

          expect(receipt).toMatchObject({
            operation: "installed",
            after: { installationScope: "project", namespace: "builtin", id },
          })
          expect(detail).toMatchObject({
            namespace: "builtin",
            id,
            version: source.version,
            packageDigest: source.packageDigest,
            skillCount: projectedSkillCount(source.manifest),
            installations: [
              {
                installationScope: "project",
                installedVersion: source.version,
                installedPackageDigest: source.packageDigest,
                updateAvailable: false,
              },
            ],
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
          const schedulerProjection = schedulerCapabilityGrants(source.manifest)
          const workflowIDs = Object.keys(source.manifest.capability_projection.virtual_workflows)

          expect(revision).toMatchObject({
            namespace: "builtin",
            id,
            version: source.version,
            packageDigest: source.packageDigest,
          })
          expect(scheduler.productionSkills.map((skill) => skill.ref)).toEqual([
            ...schedulerProjection.defaultSkillRefs,
            ...schedulerProjection.packageSkillRefs,
          ])
          expect(Object.keys(scheduler.virtualWorkflows)).toEqual(workflowIDs)

          const topology = analyzeExpertSquadWorkflowTopology(source.manifest)
          expect(topology.length).toBeGreaterThan(0)
          expect(
            topology.every(
              (workflow) => workflow.maximum_parallel_width >= 2,
            ),
          ).toBe(true)

          for (const agentID of Object.keys(source.manifest.capability_projection.agents)) {
            const worker = await PromptProfileResolver.resolveWorkerCapability({
              projectDirectory: project.path,
              config,
              packageRevision: revision,
              agentID,
            })
            expect(worker.productionSkills.map((skill) => skill.ref)).toEqual([
              ...agentCapabilityGrants(source.manifest, agentID).defaultSkillRefs,
              ...agentCapabilityGrants(source.manifest, agentID).packageSkillRefs,
            ])
          }
        }
      },
    })
  }, 0)
})
