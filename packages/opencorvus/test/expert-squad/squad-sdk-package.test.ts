import { describe, expect, test } from "bun:test"
import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"
import { pathToFileURL } from "node:url"
import path from "node:path"
import { Config } from "../../src/config/config"
import { PromptProfileResolver } from "../../src/expert-squad/prompt-profile-resolver"
import { ExpertSquadRegistry } from "../../src/expert-squad/registry"
import { readExpertSquadInstallationMetadata } from "../../src/expert-squad/installation-metadata"
import { BrowserMCPBuiltin } from "../../src/mcp/browser/builtin"
import { Instance } from "../../src/project/instance"
import { Skill } from "../../src/skill/skill"
import { SkillMount } from "../../src/skill/mounts"
import { authorProjectExpertSquad, ExpertSquadAuthorParameters } from "../../src/tool/expert-squad-author"
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
const schedulerMutationTools = ["expert_squad_author", "multica_catalog", "multica_preview", "multica_import"] as const
const packageSkills = ["squad-sdk/shared/authoring", "squad-sdk/shared/import"] as const
const agentIDs = [
  "squad-sdk-contract-reviewer",
  "squad-sdk-import-analyst",
  "squad-sdk-planner",
  "squad-sdk-source-analyst",
] as const

describe("Generate Expert Squads expert squad", () => {
  test("loads one self-contained package with exact authoring and import workflows", async () => {
    const loaded = await ExpertSquadRegistry.loadSourcePackage(packageRoot)
    const workflows = loaded.manifest.capability_projection.virtual_workflows

    expect(loaded.manifest).toMatchObject({
      schema_version: 1,
      namespace: "builtin",
      id: "squad-sdk",
      version: "2026.08.30.1",
      system_role: "expert_squad_generator",
    })
    expect(loaded.manifest.capability_projection.scheduler.built_in_tool_ids).toEqual([...schedulerTools])
    expect(Object.keys(loaded.manifest.capability_projection.agents).sort()).toEqual([...agentIDs])
    expect([...loaded.packageSkills.keys()]).toEqual([...packageSkills])
    expect(Object.keys(workflows)).toEqual(["sdk-authoring", "heterogeneous-import"])
    expect(workflows["sdk-authoring"]!.nodes).toEqual({
      "squad-sdk-planner": {
        agent_id: "squad-sdk-planner",
        description: "Publishes the canonical package blueprint and flat Planner/parallel-worker topology.",
        depends_on: [],
      },
      "source-analysis": {
        agent_id: "squad-sdk-source-analyst",
        description: "Validates source algorithm, actors, evidence flow, resources, and portability constraints.",
        depends_on: ["squad-sdk-planner"],
      },
      "contract-review": {
        agent_id: "squad-sdk-contract-reviewer",
        description: "Independently validates the exact blueprint and closure against SDK invariants.",
        depends_on: ["squad-sdk-planner"],
      },
    })
    expect(workflows["heterogeneous-import"]!.nodes).toEqual({
      "squad-sdk-planner": {
        agent_id: "squad-sdk-planner",
        description: "Publishes the import boundary, mapping responsibilities, and acceptance allocation.",
        depends_on: [],
      },
      "import-analysis": {
        agent_id: "squad-sdk-import-analyst",
        description: "Validates source roster, instructions, Skill closure, MCP capabilities, and portability blockers.",
        depends_on: ["squad-sdk-planner"],
      },
      "contract-review": {
        agent_id: "squad-sdk-contract-reviewer",
        description: "Independently validates the exact preview, mapping, and source digests.",
        depends_on: ["squad-sdk-planner"],
      },
    })
  })

  test(
    "projects package-local methods and Host write tools only through the active Squad scheduler",
    { timeout: 90_000 },
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
          const sourcePackage = await ExpertSquadRegistry.loadSourcePackage(packageRoot)
          const architectTurn = await PromptProfileResolver.resolveWorkerTurnProjection({
            projectDirectory: project.path,
            config,
            agentID: "squad-sdk-planner",
          })
          const importerTurn = await PromptProfileResolver.resolveWorkerTurnProjection({
            projectDirectory: project.path,
            config,
            agentID: "squad-sdk-import-analyst",
          })
          const reviewerTurn = await PromptProfileResolver.resolveWorkerTurnProjection({
            projectDirectory: project.path,
            config,
            agentID: "squad-sdk-contract-reviewer",
          })
          const sourceTurn = await PromptProfileResolver.resolveWorkerTurnProjection({
            projectDirectory: project.path,
            config,
            agentID: "squad-sdk-source-analyst",
          })
          const architect = architectTurn.workerCapability
          const importer = importerTurn.workerCapability
          const reviewer = reviewerTurn.workerCapability
          const source = sourceTurn.workerCapability
          const architectSkills = await SkillMount.resolve({
            identity: { ...architect.identity, expertSquadID: architect.expertSquadID },
            runtime: architect.runtime,
            scope: "session",
            projectDirectory: project.path,
            skillProjection: architectTurn.skillProjection,
            availableToolNames: architect.builtInToolIDs,
          })
          const importerSkills = await SkillMount.resolve({
            identity: { ...importer.identity, expertSquadID: importer.expertSquadID },
            runtime: importer.runtime,
            scope: "session",
            projectDirectory: project.path,
            skillProjection: importerTurn.skillProjection,
            availableToolNames: importer.builtInToolIDs,
          })
          const reviewerSkills = await SkillMount.resolve({
            identity: { ...reviewer.identity, expertSquadID: reviewer.expertSquadID },
            runtime: reviewer.runtime,
            scope: "session",
            projectDirectory: project.path,
            skillProjection: reviewerTurn.skillProjection,
            availableToolNames: reviewer.builtInToolIDs,
          })
          const materializedAuthoringSkill = await Skill.materialize(architectSkills.skills[0]!.skill)
          const authoringContract = JSON.parse(
            await readFile(
              path.join(path.dirname(materializedAuthoringSkill), "references", "definition-contract.json"),
              "utf8",
            ),
          )
          const authoringQualityMethod = await readFile(
            path.join(path.dirname(materializedAuthoringSkill), "references", "authoring-quality-method.md"),
            "utf8",
          )

          expect(scheduler.expertSquadID).toBe("squad-sdk")
          expect(scheduler.packageRevision.packageDigest).toBe(sourcePackage.packageDigest)
          expect(scheduler.builtInToolIDs).toEqual(expect.arrayContaining([...schedulerTools]))
          const toolOwners = {
            orchestrator: scheduler.builtInToolIDs,
            "squad-sdk-contract-reviewer": reviewer.builtInToolIDs,
            "squad-sdk-import-analyst": importer.builtInToolIDs,
            "squad-sdk-planner": architect.builtInToolIDs,
            "squad-sdk-source-analyst": source.builtInToolIDs,
          }
          expect(
            Object.fromEntries(
              schedulerMutationTools.map((toolID) => [
                toolID,
                Object.entries(toolOwners)
                  .filter(([, toolIDs]) => toolIDs.includes(toolID))
                  .map(([owner]) => owner),
              ]),
            ),
          ).toEqual({
            expert_squad_author: ["orchestrator"],
            multica_catalog: ["orchestrator"],
            multica_preview: ["orchestrator"],
            multica_import: ["orchestrator"],
          })
          expect(scheduler.productionSkills.map((entry) => entry.ref)).toEqual([...packageSkills])
          expect(Object.keys(scheduler.virtualWorkflows)).toEqual(["sdk-authoring", "heterogeneous-import"])
          expect(architect.productionSkills.map((entry) => entry.ref)).toEqual(["squad-sdk/shared/authoring"])
          expect(importer.productionSkills.map((entry) => entry.ref)).toEqual(["squad-sdk/shared/import"])
          expect(architectSkills).toMatchObject({
            tool_available: true,
            skills: [{ ref: "squad-sdk/shared/authoring", name: "squad-sdk-authoring", enabled: true }],
          })
          expect(importerSkills).toMatchObject({
            tool_available: true,
            skills: [{ ref: "squad-sdk/shared/import", name: "squad-sdk-heterogeneous-import", enabled: true }],
          })
          expect(reviewerSkills).toMatchObject({
            tool_available: true,
            skills: [
              { ref: "squad-sdk/shared/authoring", name: "squad-sdk-authoring", enabled: true },
              { ref: "squad-sdk/shared/import", name: "squad-sdk-heterogeneous-import", enabled: true },
            ],
          })
          expect(authoringContract).toMatchObject({
            contract_owner: "squad-sdk",
            tool_input: {
              schema_version: 1,
              agents: {
                "briefing-planner": { base_role: "delegated-worker" },
                "evidence-researcher": { base_role: "deep-research" },
                "briefing-writer": { base_role: "build" },
                "claim-checker": { base_role: "fact-check" },
              },
              virtual_workflows: {
                "verified-briefing": {
                  nodes: {
                    "briefing-planner": {
                      description: "Freeze the evidence boundary, briefing structure, and worker acceptance allocation.",
                    },
                    "evidence-researcher": {
                      description: "Collect public evidence and record contradictions and unknowns.",
                      depends_on: ["briefing-planner"],
                    },
                    "briefing-writer": {
                      description: "Build the source-backed briefing from the Planner contract.",
                      depends_on: ["briefing-planner"],
                    },
                    "claim-checker": {
                      description: "Independently check load-bearing claims and explicit unknowns.",
                      depends_on: ["briefing-planner"],
                    },
                  },
                },
              },
            },
          })
          expect(authoringContract.tool_input.agents["evidence-researcher"].package_tool_refs).toEqual([
            "source-backed-briefing/shared/publish-source-evidence",
          ])
          expect(authoringContract.tool_input.scheduler.package_skill_refs).toEqual([
            "source-backed-briefing/shared/method",
          ])
          expect(authoringContract.tool_input.agents["evidence-researcher"].package_skill_refs).toEqual([
            "source-backed-briefing/shared/method",
          ])
          expect(authoringContract.tool_input.agents["briefing-writer"].package_skill_refs).toEqual([
            "source-backed-briefing/shared/method",
          ])
          expect(authoringQualityMethod).toContain("Decide whether to create a Squad")
          expect(authoringQualityMethod).toContain("Verify positive production behavior")
          expect(Object.keys(authoringContract.tool_input.extra_files)).toEqual([
            "skills/method/SKILL.md",
            "tools/publish-source-evidence.ts",
          ])
        },
      })
    },
  )

  test("authors the visible positive contract with its package-owned typed publisher", async () => {
    await using authoringProject = await memoryProject()
    const contract = JSON.parse(
      await readFile(path.join(packageRoot, "skills", "authoring", "references", "definition-contract.json"), "utf8"),
    )
    const input = ExpertSquadAuthorParameters.parse(contract.tool_input)
    const trace = { taskID: "task_visible_authoring_contract", sessionID: "session_visible_authoring_contract" }

    const receipt = await Instance.provide({
      directory: authoringProject.path,
      fn: () => authorProjectExpertSquad(input, trace),
    })
    const loaded = await ExpertSquadRegistry.loadPackage(receipt.targetRoot)

    expect(receipt).toMatchObject({
      id: "source-backed-briefing",
      installationScope: "project",
      generation: {
        method: "sdk_authoring",
        task_id: trace.taskID,
        session_id: trace.sessionID,
      },
    })
    expect(loaded.manifest.capability_projection.agents["evidence-researcher"]!.package_tool_refs).toEqual([
      "source-backed-briefing/shared/publish-source-evidence",
    ])
    expect([...loaded.packageToolBundles.keys()]).toEqual(["source-backed-briefing/shared/publish-source-evidence"])
    expect(
      loaded.packageToolBundles.get("source-backed-briefing/shared/publish-source-evidence")!.snapshot,
    ).toMatchObject({
      entry: "tools/publish-source-evidence.ts",
      files: [{ path: "tools/publish-source-evidence.ts", extension: ".ts" }],
    })

    const prepared = loaded.packageToolBundles.get("source-backed-briefing/shared/publish-source-evidence")!
    const compiledBytes = await readFile(prepared.bundlePath)
    expect(createHash("sha256").update(compiledBytes).digest("hex")).toBe(prepared.snapshot.compiledBundleSHA256)
    const executable = (await import(pathToFileURL(prepared.bundlePath).href)) as {
      default?: { description?: unknown; execute?: unknown }
    }
    expect(executable.default).toMatchObject({
      description: "Publish the source-backed briefing evidence through its typed package ABI.",
      execute: expect.any(Function),
    })
  }, 0)

  test("is available from a clean project catalog as an embedded system package", { timeout: 30_000 }, async () => {
    await using project = await memoryProject()
    const generatedSquads = await PromptProfileResolver.settingsDetail({
      projectDirectory: project.path,
      id: "squad-sdk",
      installationScope: "built_in",
    })

    expect(generatedSquads).toMatchObject({
      id: "squad-sdk",
      name: "Generate Expert Squads",
      built_in: true,
      editable: false,
      system_role: "expert_squad_generator",
      source: { kind: "built_in" },
    })
  })

  test(
    "publishes a traceable generated Expert Squad into the current project catalog",
    { timeout: 30_000 },
    async () => {
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
              description: "Exercises the canonical project-owned Expert Squad generation contract.",
              version: "2026.08.07.1",
              product_pillars: ["work"],
              readme: "# Generated Project Contract\n\nA generated project-owned Expert Squad contract fixture.\n",
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
      const generated = await PromptProfileResolver.settingsDetail({
        projectDirectory: authoringProject.path,
        namespace: "test",
        id: generatedID,
        installationScope: "project",
      })
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
    },
  )
})
