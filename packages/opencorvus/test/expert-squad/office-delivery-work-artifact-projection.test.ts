import { afterAll, describe, expect, test } from "bun:test"
import path from "node:path"
import { AgentToolPool } from "../../src/agent/tool-pool-contract"
import { promptToolSwitchesForAgentRun } from "../../src/agent/runner"
import { Config } from "../../src/config/config"
import { ExpertSquadPackageManager } from "../../src/expert-squad/manager"
import { PromptProfileResolver } from "../../src/expert-squad/prompt-profile-resolver"
import { ExpertSquadRegistry } from "../../src/expert-squad/registry"
import { Instance } from "../../src/project/instance"
import { WORK_ARTIFACT_TOOL_IDS } from "../../src/work/harness"
import { toolSwitchAllows } from "../../src/tool/execution-surface"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"

const packageRoot = path.resolve(import.meta.dir, "../../../..", "expert-squads", "builtin", "office-delivery")
const workArtifactSkillRef = "default/skill/work-artifacts"

afterAll(async () => {
  await resetMemoryDatabase()
})

describe("Office Delivery Work Artifact production capability", () => {
  test("projects the qualified Work Artifact tools and Skill only when the builder declares them", async () => {
    const loaded = await ExpertSquadRegistry.loadSourcePackage(packageRoot)
    const builder = loaded.manifest.capability_projection.agents["office-delivery-builder"]!

    expect(builder.built_in_tool_ids).toEqual([...WORK_ARTIFACT_TOOL_IDS])
    expect(builder.default_skill_refs).toEqual([workArtifactSkillRef])
    expect(
      WORK_ARTIFACT_TOOL_IDS.map((toolID) =>
        AgentToolPool.projectableRuntimeTemplateBuiltInToolIDs("build").has(toolID),
      ),
    ).toEqual(WORK_ARTIFACT_TOOL_IDS.map(() => true))
    const switches = promptToolSwitchesForAgentRun({
      role: "build",
      extraToolNames: [],
      explicitProjectedToolNames: builder.built_in_tool_ids,
    })
    expect(WORK_ARTIFACT_TOOL_IDS.map((toolID) => toolSwitchAllows(toolID, switches))).toEqual(
      WORK_ARTIFACT_TOOL_IDS.map(() => true),
    )

    await using project = await memoryProject()
    await ExpertSquadPackageManager.importDirectory({
      projectDirectory: project.path,
      sourceDirectory: packageRoot,
      installationScope: "project",
    })

    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const config = Config.Info.parse({ prompt_profile: { active: "office-delivery" } })
        const revision = await PromptProfileResolver.resolveActivePackageRevision({
          projectDirectory: project.path,
          config,
        })
        const capability = await PromptProfileResolver.resolveWorkerCapability({
          projectDirectory: project.path,
          config,
          packageRevision: revision,
          agentID: "office-delivery-builder",
        })

        expect(WORK_ARTIFACT_TOOL_IDS.map((toolID) => capability.builtInToolIDs.includes(toolID))).toEqual(
          WORK_ARTIFACT_TOOL_IDS.map(() => true),
        )
        expect(capability.builtInToolIDs.includes("artifact_publish")).toBe(true)
        expect(capability.productionSkills).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              authority: "manifest",
              source: "default",
              ref: workArtifactSkillRef,
              skill: expect.objectContaining({
                name: "work-artifacts",
                required_tools: [...WORK_ARTIFACT_TOOL_IDS],
              }),
            }),
          ]),
        )
      },
    })
  }, 30_000)
})
