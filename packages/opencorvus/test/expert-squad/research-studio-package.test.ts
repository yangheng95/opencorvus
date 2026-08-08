import { describe, expect, test } from "bun:test"
import path from "node:path"
import { Config } from "../../src/config/config"
import { builtInPackageSources } from "../../src/expert-squad/builtin"
import { PromptProfileResolver } from "../../src/expert-squad/prompt-profile-resolver"
import { ExpertSquadRegistry } from "../../src/expert-squad/registry"
import { Instance } from "../../src/project/instance"
import { ORCHESTRATOR_SCHEDULER_ROLE_BASE_TOOL_IDS } from "../../src/agent/tool-pool-data"
import { memoryProject } from "../fixture/memory"

const packageRoot = path.resolve(
  import.meta.dir,
  "../../src/expert-squad/builtin/research-studio",
)
const reportQualitySkillRef = "research-studio/shared/analysis-report-quality"

describe("Research Studio report-quality package", () => {
  test("loads the complete package-owned report model closure", async () => {
    const loaded = await ExpertSquadRegistry.loadSourcePackage(packageRoot)
    const reportSkill = loaded.packageSkills.get(reportQualitySkillRef)

    expect(loaded.manifest).toMatchObject({
      id: "research-studio",
      name: "Research Studio",
      version: "2026.08.08.1",
      product_pillars: ["code", "work"],
    })
    expect(reportSkill?.snapshot.files.map((file) => file.path)).toEqual([
      "references/decision-research-report-template.md",
      "references/decision-research-report.schema.json",
      "SKILL.md",
    ])
    const schemaFile = reportSkill!.bundle.files["references/decision-research-report.schema.json"]!
    const schemaText = typeof schemaFile === "string" ? schemaFile : schemaFile.content
    expect(JSON.parse(schemaText)).toMatchObject({
      title: "Decision Research Report V1",
      type: "object",
    })
    const embedded = builtInPackageSources.find((pkg) => pkg.id === "research-studio")!
    const embeddedSchemaFile =
      embedded.files["skills/analysis-report-quality/references/decision-research-report.schema.json"]
    const embeddedSchemaText =
      typeof embeddedSchemaFile === "string" ? embeddedSchemaFile : embeddedSchemaFile.content
    expect(embeddedSchemaText).toBe(schemaText)
    expect(JSON.parse(embeddedSchemaText)).toMatchObject({
      title: "Decision Research Report V1",
      type: "object",
    })
  })

  test("projects the package Skill to every report evidence owner", { timeout: 30_000 }, async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const config = Config.Info.parse({ prompt_profile: { active: "research-studio" } })
        const scheduler = await PromptProfileResolver.resolveSchedulerCapability({
          projectDirectory: project.path,
          config,
        })
        const sourcePackage = await ExpertSquadRegistry.loadSourcePackage(packageRoot)
        const agents = await Promise.all(
          ["research-studio-analyst", "research-studio-fact-checker", "research-studio-writer"].map((agentID) =>
            PromptProfileResolver.resolveWorkerCapability({
              projectDirectory: project.path,
              config,
              agentID,
            }),
          ),
        )

        expect(scheduler.builtInToolIDs).toEqual([
          ...ORCHESTRATOR_SCHEDULER_ROLE_BASE_TOOL_IDS,
          "read",
          "browser_preview_capture",
        ])
        expect(scheduler.packageRevision.packageDigest).toBe(sourcePackage.packageDigest)
        expect(agents.map((agent) => agent.productionSkills.map((skill) => skill.ref))).toEqual([
          [reportQualitySkillRef],
          [reportQualitySkillRef],
          ["default/skill/design-taste-frontend", reportQualitySkillRef],
        ])
        expect(agents.map((agent) => agent.productionSkills.find((skill) => skill.ref === reportQualitySkillRef)?.source)).toEqual([
          "package",
          "package",
          "package",
        ])
      },
    })
  })
})
