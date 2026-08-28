import { afterEach, describe, expect, test } from "bun:test"
import { Config } from "@/config/config"
import { ConversationCapability } from "@/conversation/capability"
import { BrowserMCPBuiltin } from "@/mcp/browser/builtin"
import { Instance } from "@/project/instance"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

describe("the reserved Browser server identity", () => {
  test("configuration materializes and interprets the exact builtin provider", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const config = await Config.get()
        const browser = config.mcp?.[BrowserMCPBuiltin.ServerName]

        expect({ browser, declaration: BrowserMCPBuiltin.configuredDeclaration(browser) }).toEqual({
          browser: BrowserMCPBuiltin.localConfig(),
          declaration: { status: "enabled", config: BrowserMCPBuiltin.localConfig() },
        })
      },
    })
  }, 60_000)

  test("the explicit disable override settles to the disabled provider state", () => {
    expect(BrowserMCPBuiltin.configuredDeclaration({ enabled: false })).toEqual({ status: "disabled" })
    expect(BrowserMCPBuiltin.configuredDeclaration({ ...BrowserMCPBuiltin.localConfig(), enabled: false })).toEqual({
      status: "disabled",
    })
  })

  test("an assigned disabled Browser settles to the empty Conversation projection", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const config = Config.Info.parse({
          mcp: { [BrowserMCPBuiltin.ServerName]: { enabled: false } },
          primary_assistant_capabilities: {
            chat: { skill_refs: [], mcp_server_refs: [BrowserMCPBuiltin.ServerName] },
          },
        })

        expect({
          assignment: ConversationCapability.assignment(config, "chat"),
          tools: await ConversationCapability.runtimeMcpTools(config, "chat", "session-disabled-browser"),
        }).toEqual({
          assignment: { skill_refs: [], mcp_server_refs: [BrowserMCPBuiltin.ServerName] },
          tools: {},
        })
      },
    })
  }, 60_000)

  test("the exact builtin declaration keeps configurable local options", () => {
    const configured = {
      ...BrowserMCPBuiltin.localConfig(),
      environment: { OPENCORVUS_BROWSER_MODE: "isolated" },
      timeout: 45_000,
    }

    expect(Config.Info.parse({ mcp: { [BrowserMCPBuiltin.ServerName]: configured } }).mcp?.browser).toEqual(configured)
  })

  test("a remote provider maps to the reserved identity's configuration error", () => {
    const parsed = Config.Info.safeParse({
      mcp: {
        [BrowserMCPBuiltin.ServerName]: {
          type: "remote",
          url: "https://browser.example.invalid/mcp",
          transport: "streamable-http",
          oauth: false,
        },
      },
    })

    expect(
      parsed.success
        ? { result: "configured" }
        : { result: "configuration-error", errorName: parsed.error.name, issue: parsed.error.issues[0] },
    ).toEqual({
      result: "configuration-error",
      errorName: "ZodError",
      issue: {
        code: "custom",
        path: ["mcp", BrowserMCPBuiltin.ServerName, "type"],
        message: "Configured MCP server browser must use the built-in Browser local provider, got remote.",
      },
    })
  })

  test("a different local command maps to the reserved identity's command error", () => {
    const parsed = Config.Info.safeParse({
      mcp: {
        [BrowserMCPBuiltin.ServerName]: {
          type: "local",
          command: [process.execPath, "mcp", "different-browser"],
        },
      },
    })

    expect(
      parsed.success
        ? { result: "configured" }
        : { result: "configuration-error", errorName: parsed.error.name, issue: parsed.error.issues[0] },
    ).toEqual({
      result: "configuration-error",
      errorName: "ZodError",
      issue: {
        code: "custom",
        path: ["mcp", BrowserMCPBuiltin.ServerName, "command"],
        message: "Configured MCP server browser must use the built-in Browser command.",
      },
    })
  })
})
