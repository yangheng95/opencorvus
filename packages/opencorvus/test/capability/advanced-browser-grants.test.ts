import { expect, test } from "bun:test"
import { Config } from "../../src/config/config"
import { PromptProfileResolver } from "../../src/expert-squad/prompt-profile-resolver"
import { BrowserMCPBuiltin } from "../../src/mcp/browser/builtin"
import { Instance } from "../../src/project/instance"
import { memoryProject } from "../fixture/memory"

test("Advanced browser responsibilities resolve exact Browser execution grants on their own worker turns", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const config = Config.Info.parse({
        prompt_profile: { active: "advanced" },
        mcp: { browser: BrowserMCPBuiltin.localConfig() },
      })
      for (const agentID of [
        "implementation-engineer",
        "test-engineer",
        "interface-integrity-reviewer",
        "visual-reviewer",
        "interface-investigator",
      ]) {
        const { workerCapability: capability } = await PromptProfileResolver.resolveWorkerTurnProjection({
          projectDirectory: project.path,
          config,
          agentID,
        })
        expect(capability.defaultMcpTools.map((entry) => entry.ref).sort()).toEqual(
          [...BrowserMCPBuiltin.ImportableToolRefs].sort(),
        )
        const harness = PromptProfileResolver.workerHarnessGrants({
          taskID: "tsk_browser-grants",
          capability,
          projectedToolIDs: capability.builtInToolIDs,
          stageToolIDs: [],
        })
        expect(
          harness.grants
            .filter((grant) => grant.ref.kind === "mcp_tool")
            .map((grant) => ({
              name: grant.ref.local_ref,
              access: grant.access,
            }))
            .sort((a, b) => a.name.localeCompare(b.name)),
        ).toEqual(
          capability.defaultMcpTools
            .map((entry) => ({ name: entry.providerName, access: "discover_execute" }))
            .sort((a, b) => a.name.localeCompare(b.name)),
        )
      }
    },
  })
}, 120_000)
