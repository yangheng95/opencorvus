import { describe, expect, test } from "bun:test"
import path from "node:path"
import { Config } from "../../src/config/config"
import { PromptProfileResolver } from "../../src/expert-squad/prompt-profile-resolver"
import { ExpertSquadRegistry } from "../../src/expert-squad/registry"
import { readExpertSquadInstallationMetadata } from "../../src/expert-squad/installation-metadata"
import { BrowserMCPBuiltin } from "../../src/mcp/browser/builtin"
import { Instance } from "../../src/project/instance"
import { authorProjectExpertSquad } from "../../src/tool/expert-squad-author"
import { memoryProject } from "../fixture/memory"

const packageRoot = path.resolve(import.meta.dir, "../../../..", "expert-squads", "builtin", "squad-sdk")
const schedulerTools = [
  "dispatch_agent",
  "manage_task",
  "read",
  "expert_squad_author",
  "multica_catalog",
  "multica_preview",
  "multica_import",
] as const
const packageSkills = ["squad-sdk/shared/authoring", "squad-sdk/shared/import"] as const
const agentIDs = [
  "squad-sdk-contract-reviewer",
  "squad-sdk-import-analyst",
  "squad-sdk-package-architect",
  "squad-sdk-source-analyst",
] as const

describe("Generate Agent Squads expert squad", () => {
  test("loads one self-contained package with exact authoring and import workflows", async () => {
    const loaded = await ExpertSquadRegistry.loadSourcePackage(packageRoot)
    const workflows = loaded.manifest.capability_projection.virtual_workflows

    expect(loaded.manifest).toMatchObject({
      schema_version: 1,
      namespace: "builtin",
      id: "squad-sdk",
      version: "2026.08.07.1",
      system_role: "expert_squad_generator",
    })
    expect(loaded.manifest.capability_projection.scheduler.built_in_tool_ids).toEqual([...schedulerTools])
    expect(Object.keys(loaded.manifest.capability_projection.agents).sort()).toEqual([...agentIDs])
    expect([...loaded.packageSkills.keys()]).toEqual([...packageSkills])
    expect(Object.keys(workflows)).toEqual(["sdk-authoring", "heterogeneous-import"])
    expect(workflows["sdk-authoring"]!.nodes).toEqual({
      "source-analysis": {
        agent_id: "squad-sdk-source-analyst",
        description: "Publishes the source algorithm and package-boundary evidence.",
        depends_on: [],
      },
      "package-architecture": {
        agent_id: "squad-sdk-package-architect",
        description: "Publishes the complete SDK authoring blueprint.",
        depends_on: ["source-analysis"],
      },
      "contract-review": {
        agent_id: "squad-sdk-contract-reviewer",
        description: "Publishes the independent positive validation of the exact blueprint.",
        depends_on: ["package-architecture"],
      },
    })
    expect(workflows["heterogeneous-import"]!.nodes).toEqual({
      "import-analysis": {
        agent_id: "squad-sdk-import-analyst",
        description: "Publishes source, portability, and mapping analysis for the selected external Squad.",
        depends_on: [],
      },
      "contract-review": {
        agent_id: "squad-sdk-contract-reviewer",
        description: "Publishes independent positive validation of the blocker-free preview and exact mapping.",
        depends_on: ["import-analysis"],
      },
    })
  })

  test(
    "projects package-local methods and Host write tools only through the active Squad scheduler",
    { timeout: 30_000 },
    async () => {
      await using project = await memoryProject()
      await Instance.provide({
        directory: project.path,
        fn: async () => {
          const config = Config.Info.parse({
            prompt_profile: { active: "squad-sdk" },
            mcp: { browser: BrowserMCPBuiltin.localConfig() },
          })
          const scheduler = await PromptProfileResolver.resolveSchedulerCapability({
            projectDirectory: project.path,
            config,
          })
          const architect = await PromptProfileResolver.resolveWorkerCapability({
            projectDirectory: project.path,
            config,
            agentID: "squad-sdk-package-architect",
          })
          const importer = await PromptProfileResolver.resolveWorkerCapability({
            projectDirectory: project.path,
            config,
            agentID: "squad-sdk-import-analyst",
          })

          expect(scheduler.expertSquadID).toBe("squad-sdk")
          expect(scheduler.builtInToolIDs).toEqual(expect.arrayContaining([...schedulerTools]))
          expect(scheduler.productionSkills.map((entry) => entry.ref)).toEqual([...packageSkills])
          expect(Object.keys(scheduler.virtualWorkflows)).toEqual(["sdk-authoring", "heterogeneous-import"])
          expect(architect.productionSkills.map((entry) => entry.ref)).toEqual(["squad-sdk/shared/authoring"])
          expect(importer.productionSkills.map((entry) => entry.ref)).toEqual(["squad-sdk/shared/import"])
        },
      })
    },
  )

  test("is available from a clean project catalog as an embedded system package", async () => {
    await using project = await memoryProject()
    const catalog = await PromptProfileResolver.settingsCatalog(project.path)
    const generatedSquads = catalog.find((squad) => squad.id === "squad-sdk")

    expect(generatedSquads).toMatchObject({
      id: "squad-sdk",
      name: "Generate Agent Squads",
      built_in: true,
      editable: false,
      system_role: "expert_squad_generator",
      source: { kind: "built_in" },
    })
  })

  test("publishes a traceable generated Agent Squad into the current project catalog", { timeout: 30_000 }, async () => {
    await using authoringProject = await memoryProject()
    const generatedID = "generated-project-contract"
    const trace = { taskID: "task_generated_project", sessionID: "session_generated_project" }

    const receipt = await Instance.provide({
      directory: authoringProject.path,
      fn: () =>
        authorProjectExpertSquad(
          {
            schema_version: 1,
            namespace: "test",
            id: generatedID,
            name: "Generated Project Contract",
            label: "Generated Project Contract",
            description: "Exercises the canonical project-owned Agent Squad generation contract.",
            version: "2026.08.07.1",
            product_pillars: ["work"],
            readme: "# Generated Project Contract\n\nA generated project-owned Agent Squad contract fixture.\n",
            selector: {
              summary: "Use for the generated project contract fixture.",
              selection_guidance: "Select only for the generated project contract fixture.",
              instructions: "# Selection\n\nSelect for the generated project contract fixture.\n",
            },
            scheduler: {
              prompt: "Coordinate the generated project contract fixture through direct dispatch.",
            },
            agents: {
              "contract-worker": {
                label: "Contract Worker",
                description: "Produces the generated project contract fixture outcome.",
                base_role: "build",
                prompt: "Produce the requested generated project contract fixture outcome.",
              },
            },
            virtual_workflows: {},
          },
          trace,
        ),
    })
    const projectCatalog = await PromptProfileResolver.settingsCatalog(authoringProject.path)
    const generated = projectCatalog.find((squad) => squad.id === generatedID)
    const metadata = await readExpertSquadInstallationMetadata(receipt.targetRoot)

    expect(receipt).toMatchObject({
      id: generatedID,
      installationScope: "project",
      replaced: false,
      generation: {
        generator_expert_squad_id: "squad-sdk",
        method: "sdk_authoring",
        task_id: trace.taskID,
        session_id: trace.sessionID,
      },
    })
    expect(receipt.targetRoot).toBe(
      path.join(authoringProject.path, ".opencorvus", "expert-squads", "test", generatedID),
    )
    expect(metadata).toEqual({ schema_version: 1, generation: receipt.generation })
    expect(generated).toMatchObject({
      id: generatedID,
      name: "Generated Project Contract",
      source: {
        kind: "installed_package",
        installation_scope: "project",
        generation: receipt.generation,
      },
    })
  })
})
