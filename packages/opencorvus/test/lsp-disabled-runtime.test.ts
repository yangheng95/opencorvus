import { afterAll, expect, test } from "bun:test"
import { LSP } from "../src/lsp"
import { Instance } from "../src/project/instance"
import { builtInToolProviderState } from "../src/tool/global-tools"
import { Flag } from "../src/flag/flag"
import { GLOBAL_TOOL_ID_SET } from "../src/tool/tool-id-catalog"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterAll(resetMemoryDatabase)

test("Language Server Protocol runtime and Agent tool remain fully disabled", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      expect({
        serverIDs: await LSP.TestHooks.serverIDs(),
        lifecycle: await LSP.TestHooks.lifecycle(),
        status: await LSP.status(),
        workspaceSymbols: await LSP.Host.workspaceSymbol("OpenCorvus"),
        flags: {
          downloadsDisabled: Flag.OPENCORVUS_DISABLE_LSP_DOWNLOAD,
          experimentalTool: Flag.OPENCORVUS_EXPERIMENTAL_LSP_TOOL,
          experimentalTy: Flag.OPENCORVUS_EXPERIMENTAL_LSP_TY,
        },
        toolCatalog: {
          declared: GLOBAL_TOOL_ID_SET.has("lsp"),
          provider: builtInToolProviderState("lsp", { batchToolEnabled: true }),
        },
      }).toEqual({
        serverIDs: [],
        lifecycle: { spawning: 0, broken: 0, clients: 0 },
        status: [],
        workspaceSymbols: [],
        flags: {
          downloadsDisabled: true,
          experimentalTool: false,
          experimentalTy: false,
        },
        toolCatalog: {
          declared: false,
          provider: "unavailable",
        },
      })
    },
  })
})
