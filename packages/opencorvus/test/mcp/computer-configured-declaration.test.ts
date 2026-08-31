import { afterEach, describe, expect, test } from "bun:test"
import { Config } from "@/config/config"
import { ConversationCapability } from "@/conversation/capability"
import { BrowserMCPBuiltin } from "@/mcp/browser/builtin"
import { ComputerMCPBuiltin } from "@/mcp/computer/builtin"
import { MCP } from "@/mcp"
import { Instance } from "@/project/instance"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"
import { prepareConversationMcpCatalog } from "../fixture/conversation-mcp"

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

describe("the configured declaration is the Computer provider", () => {
  test("keeps live adapter rotation distinct while preserving the logical Computer Catalog identity", () => {
    const first = ComputerMCPBuiltin.localConfig({
      hostAdapter: {
        endpoint: "http://127.0.0.1:31001/computer/runtime",
        authorization: "first-authorization",
        runtimeScope: "session:stable-computer:computer",
      },
    })
    const second = ComputerMCPBuiltin.localConfig({
      hostAdapter: {
        endpoint: "http://127.0.0.1:31002/computer/runtime",
        authorization: "second-authorization",
        runtimeScope: "session:stable-computer:computer",
      },
    })

    expect({
      liveIdentityChanged: MCP.TestHooks.runtimeConfigIdentity(first) !== MCP.TestHooks.runtimeConfigIdentity(second),
      computerCatalogIdentityStable:
        MCP.TestHooks.catalogConfigDigest(ComputerMCPBuiltin.ServerName, first) ===
        MCP.TestHooks.catalogConfigDigest(ComputerMCPBuiltin.ServerName, second),
      ordinaryServerStillBindsTransport:
        MCP.TestHooks.catalogConfigDigest("ordinary-local-mcp", first) !==
        MCP.TestHooks.catalogConfigDigest("ordinary-local-mcp", second),
    }).toEqual({
      liveIdentityChanged: true,
      computerCatalogIdentityStable: true,
      ordinaryServerStillBindsTransport: true,
    })
  })

  test("configuration declares the builtin provider itself, not a disabled stub", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const config = await Config.get()
        const computer = config.mcp?.[ComputerMCPBuiltin.ServerName]

        // The entry a project inherits without customizing anything is the
        // builtin's own declaration — the same one execution runs. It used to
        // be `{enabled: false}`, which nothing honoured and which made
        // configuration, status and execution describe different capabilities.
        expect(computer).toEqual(ComputerMCPBuiltin.localConfig())
      },
    })
  }, 60_000)

  test("configuration turning Computer off preserves the exact ordinary provider projection", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        await ConversationCapability.update("work", {
          kind: "mcp_server",
          ref: BrowserMCPBuiltin.ServerName,
          assigned: true,
        })
        await ConversationCapability.update("work", {
          kind: "mcp_server",
          ref: ComputerMCPBuiltin.ServerName,
          assigned: true,
        })
        await Config.updateProjectPatchAtomic(() => ({
          mcp: { [ComputerMCPBuiltin.ServerName]: { ...ComputerMCPBuiltin.localConfig(), enabled: false } },
        }))

        const config = await Config.get()
        const catalog = await prepareConversationMcpCatalog(
          config,
          "work",
          "session-computer-configured-declaration",
        )

        expect(catalog.names).toEqual([
          "browser_check",
          "browser_click",
          "browser_count",
          "browser_diagnostics_get",
          "browser_dialog_history",
          "browser_dialog_policy_set",
          "browser_double_click",
          "browser_download",
          "browser_download_history",
          "browser_drag_and_drop",
          "browser_evaluate",
          "browser_frame_click",
          "browser_frame_get_text",
          "browser_frame_type",
          "browser_frames",
          "browser_get_attribute",
          "browser_get_perf",
          "browser_get_text",
          "browser_get_url",
          "browser_get_value",
          "browser_go_back",
          "browser_go_forward",
          "browser_hover",
          "browser_is_visible",
          "browser_keyboard_shortcut",
          "browser_navigate",
          "browser_observe",
          "browser_press_key",
          "browser_reload",
          "browser_screenshot",
          "browser_scroll",
          "browser_select_option",
          "browser_session_create",
          "browser_session_destroy",
          "browser_session_status",
          "browser_storage_state_export",
          "browser_storage_state_import",
          "browser_tabs",
          "browser_type",
          "browser_uncheck",
          "browser_upload_file",
          "browser_viewport_set",
          "browser_wait_for_load",
          "browser_wait_for_selector",
          "browser_wait_for_url",
        ])
      },
    })
  }, 60_000)

  test("the reserved Computer name reports the exact configuration contract for a remote provider", () => {
    const parsed = Config.Info.safeParse({
      mcp: {
        [ComputerMCPBuiltin.ServerName]: {
          type: "remote",
          url: "https://computer.example.invalid/mcp",
          transport: "streamable-http",
          oauth: false,
        },
      },
    })

    expect(
      parsed.success
        ? { result: "configured" }
        : {
            result: "configuration-error",
            errorName: parsed.error.name,
            issue: parsed.error.issues[0],
          },
    ).toEqual({
      result: "configuration-error",
      errorName: "ZodError",
      issue: {
        code: "custom",
        path: ["mcp", ComputerMCPBuiltin.ServerName, "type"],
        message: "Configured MCP server computer must use the host-native local provider, got remote.",
      },
    })
  })
})
