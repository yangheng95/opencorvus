import { BrowserMCPNodeLauncher } from "./node-launcher"

export namespace BrowserMCPBuiltin {
  export const ServerName = "browser"

  // MCP means Model Context Protocol. This is the canonical Browser MCP subset that
  // imported expert squads may project after an explicit evidence-backed replacement.
  const ImportableToolNames = [
    "session_create",
    "session_destroy",
    "viewport_set",
    "navigate",
    "diagnostics_get",
    "screenshot",
    "observe",
    "click",
    "hover",
    "type",
    "press_key",
    "select_option",
    "check",
    "uncheck",
    "scroll",
    "wait_for_selector",
    "wait_for_load",
  ] as const

  export const ImportableToolRefs = Object.freeze(
    ImportableToolNames.map((name) => `default/mcp/${ServerName}/tool/${name}`),
  )
  export const ScreenshotEvidenceToolRefs = Object.freeze([
    `default/mcp/${ServerName}/tool/screenshot`,
    `default/mcp/${ServerName}/tool/observe`,
  ])

  export function command(
    runtime: {
      execPath?: string
      moduleDir?: string
    } = {},
  ) {
    const execPath = runtime.execPath ?? process.execPath
    return [execPath, "mcp", "browser"]
  }

  export function localConfig(
    runtime: {
      execPath?: string
      moduleDir?: string
    } = {},
  ) {
    return {
      type: "local" as const,
      command: command(runtime),
      timeout: 30_000,
    }
  }

  export function isBuiltinLocalConfig(config: { type: string; command?: string[] }): boolean {
    if (config.type !== "local" || !Array.isArray(config.command)) return false
    return JSON.stringify(config.command) === JSON.stringify(command())
  }

  export async function resolveStdioProcess(input: { env?: NodeJS.ProcessEnv } = {}) {
    const runtime = await BrowserMCPNodeLauncher.resolveRuntime({ transport: "stdio" })
    return Object.freeze({
      executable: runtime.node,
      args: [runtime.bundle, "stdio"],
      env: await BrowserMCPNodeLauncher.childEnvironment({
        packaged: runtime.packaged,
        env: input.env,
      }),
    })
  }
}
