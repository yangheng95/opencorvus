import { describe, expect, test } from "bun:test"
import path from "node:path"
import { Config } from "../../src/config/config"
import { ExpertSquadPackageManager } from "../../src/expert-squad/manager"
import { PromptProfileResolver } from "../../src/expert-squad/prompt-profile-resolver"
import { ExpertSquadRegistry } from "../../src/expert-squad/registry"
import { BrowserMCPBuiltin } from "../../src/mcp/browser/builtin"
import { Instance } from "../../src/project/instance"
import { memoryProject } from "../fixture/memory"

const packageRoot = path.resolve(import.meta.dir, "../../../..", "expert-squads", "builtin", "frontend-replica")
const acceptanceSkillRef = "frontend-replica/shared/acceptance"
const agentIDs = [
  "frontend-replica-explorer",
  "frontend-replica-intent-analyst",
  "frontend-replica-interface-modeler",
  "frontend-replica-source-researcher",
  "frontend-replica-workload-analyst",
  "frontend-replica-implementer",
  "frontend-replica-planner",
] as const

describe("Frontend Replica acceptance package", () => {
  test("loads one shared default fidelity contract", async () => {
    const loaded = await ExpertSquadRegistry.loadSourcePackage(packageRoot)
    const acceptance = loaded.packageSkills.get(acceptanceSkillRef)

    expect(loaded.manifest).toMatchObject({
      schema_version: 2,
      namespace: "builtin",
      id: "frontend-replica",
      version: "2026.08.30.2",
    })
    expect([...loaded.packageSkills.keys()]).toEqual([acceptanceSkillRef])
    expect(acceptance?.content).toContain(
      "require at least 80% (0.80) overall rendered visual fidelity across the accepted desktop replica surface",
    )
    expect(acceptance?.content).toContain(
      "A numeric requirement explicitly stated by the current operator replaces this default for that Task",
    )
    expect(acceptance?.content).toContain(
      "An aggregate result cannot compensate for a missing visible source region",
    )
  })

  test("projects the same acceptance contract to the scheduler and every replica worker", { timeout: 30_000 }, async () => {
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
        const config = Config.Info.parse({
          prompt_profile: { active: "frontend-replica" },
          mcp: { browser: BrowserMCPBuiltin.localConfig() },
        })
        const scheduler = await PromptProfileResolver.resolveSchedulerCapability({
          projectDirectory: project.path,
          config,
        })
        const agents = await Promise.all(
          agentIDs.map((agentID) =>
            PromptProfileResolver.resolveWorkerCapability({
              projectDirectory: project.path,
              config,
              agentID,
            }),
          ),
        )

        expect(scheduler.productionSkills.map((skill) => skill.ref)).toEqual([acceptanceSkillRef])
        expect(agents.map((agent) => agent.productionSkills.map((skill) => skill.ref))).toEqual(
          agentIDs.map(() => [acceptanceSkillRef]),
        )
        expect(agents.map((agent) => agent.productionSkills[0]?.source)).toEqual(agentIDs.map(() => "package"))
      },
    })
  })
})
