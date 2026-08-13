import { describe, expect, test } from "bun:test"
import { Config } from "../../src/config/config"
import { configureTaskLoopRunner } from "../../src/engine/queue"
import { ExpertSquadConversationAuthoring } from "../../src/expert-squad/conversation-authoring"
import { PromptProfileResolver } from "../../src/expert-squad/prompt-profile-resolver"
import { MCP } from "../../src/mcp"
import { BrowserMCPBuiltin } from "../../src/mcp/browser/builtin"
import { browserMcpPermissionKeyOf } from "../../src/mcp/browser/permission-plan"
import { Instance } from "../../src/project/instance"
import { EngineService } from "../../src/task-api"
import { buildExpertSquadAuthorDefinition } from "../../src/tool/expert-squad-author"
import { memoryProject } from "../fixture/memory"

describe("Browser MCP projection contract", () => {
  test(
    "projects canonical Browser tools through the Node sidecar with one server identity",
    { timeout: 60_000 },
    async () => {
      await using project = await memoryProject()
      await Instance.provide({
        directory: project.path,
        fn: async () => {
          const profileID = "browser-projection-contract"
          const browserToolRefs = BrowserMCPBuiltin.ImportableToolRefs.slice(0, 2)
          await ExpertSquadConversationAuthoring.author({
            projectDirectory: project.path,
            installationScope: "project",
            replace: false,
            definition: buildExpertSquadAuthorDefinition({
              schema_version: 1,
              namespace: "test",
              id: profileID,
              name: "Browser Projection Contract",
              label: "Browser Projection Contract",
              description: "Projects canonical Browser tools through one default MCP server identity.",
              version: "2026.08.09.1",
              product_pillars: ["code"],
              readme: "# Browser Projection Contract\n\nExercises the canonical Browser MCP projection.\n",
              selector: {
                summary: "Exercise canonical Browser MCP projection.",
                selection_guidance: "Select for the Browser projection contract.",
                instructions: "# Selection\n\nSelect for the Browser projection contract.\n",
              },
              scheduler: {
                prompt: "Coordinate the exact Browser projection contract.",
                default_mcp_tool_refs: [...browserToolRefs],
              },
              agents: {
                "browser-contract-worker": {
                  label: "Browser Contract Worker",
                  description: "Carries the exact Browser projection contract.",
                  base_role: "build",
                  prompt: "Execute the exact Browser projection contract.",
                },
              },
              virtual_workflows: {},
            }),
          })
          const config = Config.Info.parse({
            prompt_profile: { active: profileID },
            mcp: { [BrowserMCPBuiltin.ServerName]: BrowserMCPBuiltin.localConfig() },
          })
          const capability = await PromptProfileResolver.resolveSchedulerCapability({
            projectDirectory: project.path,
            config,
          })

          configureTaskLoopRunner(async () => {})
          const taskID = await EngineService.createTask(
            {
              requestID: "browser-projection-contract-task",
              request: "Project the canonical Browser MCP tools through one server identity",
              productPillar: "code",
              model: "firmware/gpt-5",
              promptProfile: profileID,
              expectedPackageDigest: capability.packageRevision.packageDigest,
            },
            { actor: "user" },
          )

          const owner = MCP.createScopedConnectionOwner("test:browser-projection-contract")
          try {
            const projected = await PromptProfileResolver.projectOrchestratorTools(
              Object.fromEntries(capability.builtInToolIDs.map((toolID) => [toolID, {}])),
              capability,
              {
                taskID,
                projectDirectory: project.path,
                connectionOwner: owner,
              },
            )
            expect(Object.keys(projected).sort()).toEqual(
              [...capability.builtInToolIDs, ...capability.defaultMcpTools.map((entry) => entry.providerName)].sort(),
            )
            expect(
              capability.defaultMcpTools.map((entry) => ({
                ref: entry.ref,
                permission: browserMcpPermissionKeyOf(projected[entry.providerName] as object),
              })),
            ).toEqual(
              browserToolRefs.map((ref) => ({
                ref,
                permission: `browser_${ref.split("/").at(-1)}`,
              })),
            )
          } finally {
            await owner.close()
          }
        },
      })
    },
  )
})
