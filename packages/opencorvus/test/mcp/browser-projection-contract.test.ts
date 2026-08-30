import { describe, expect, test } from "bun:test"
import { Config } from "../../src/config/config"
import { configureTaskIngressRunner } from "../../src/engine/task-root-ingress-delivery"
import { ExpertSquadConversationAuthoring } from "../../src/expert-squad/conversation-authoring"
import { PromptProfileResolver } from "../../src/expert-squad/prompt-profile-resolver"
import { MCP } from "../../src/mcp"
import { BrowserMCPBuiltin } from "../../src/mcp/browser/builtin"
import { browserMcpPermissionKeyOf } from "../../src/mcp/browser/permission-plan"
import { Instance } from "../../src/project/instance"
import { EngineService } from "../../src/task-api"
import { Database } from "../../src/storage/db"
import { buildExpertSquadAuthorDefinition } from "../../src/tool/expert-squad-author"
import { memoryProject } from "../fixture/memory"
import { capabilityRef, CapabilityRefCodec } from "@opencorvus-ai/util/capability-ref"

describe("Browser MCP projection contract", () => {
  test(
    "projects canonical Browser tools through the Node sidecar with one server identity",
    { timeout: 180_000 },
    async () => {
      await using project = await memoryProject()
      try {
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
              schema_version: 2,
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
                capability_refs: browserToolRefs
                  .map((localRef) =>
                    CapabilityRefCodec.encode(
                      capabilityRef({
                        kind: "mcp_tool",
                        source: "project",
                        owner_ref: "default-mcp-registry",
                        local_ref: localRef,
                      }),
                    ),
                  )
                  .sort(),
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

          configureTaskIngressRunner(async () => {})
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
            const projectedToolIDs = PromptProfileResolver.schedulerRuntimeToolIDs(capability)
            expect(projectedToolIDs.filter((toolID) => capability.builtInToolIDs.includes(toolID)).sort()).toEqual(
              capability.builtInToolIDs.filter((toolID) => toolID !== "capability_search").sort(),
            )
            const exact = Object.fromEntries(
              await Promise.all(
                capability.defaultMcpTools.map(async (entry) => {
                  const materialized = await PromptProfileResolver.exactProjectedExtensionTool({
                    capability,
                    providerName: entry.providerName,
                    runtimeTools: {},
                    taskID,
                    projectDirectory: project.path,
                    toolDirectory: project.path,
                    connectionOwner: owner,
                  })
                  if (!materialized) throw new Error(`Exact Browser Tool ${entry.providerName} is unavailable.`)
                  return [entry.providerName, materialized] as const
                }),
              ),
            )
            expect(
              capability.defaultMcpTools.map((entry) => ({
                ref: entry.ref,
                permission: browserMcpPermissionKeyOf(exact[entry.providerName] as object),
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
      } finally {
      }
    },
  )
})
