import { NamedError } from "@opencorvus-ai/util/error"
import z from "zod"

export namespace BrowserMCPBuiltin {
  export const ServerName = "browser"

  export const ConfigurationError = NamedError.create(
    "BrowserMCPConfigurationError",
    z.object({
      message: z.string().min(1),
      reason: z.literal("unsupported_provider"),
      serverName: z.literal(ServerName),
      providerType: z.string().min(1).optional(),
    }),
  )

  export type LocalDeclaration = {
    type: "local"
    command: string[]
    environment?: Record<string, string>
    enabled?: boolean
    timeout?: number
  }

  export type ConfiguredDeclaration = { status: "disabled" } | { status: "enabled"; config: LocalDeclaration }

  // MCP means Model Context Protocol. This is the canonical Browser MCP subset that
  // imported expert squads may project after an explicit evidence-backed replacement.
  export const ImportableToolNames = [
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

  /** Interpret the reserved `browser` declaration once for configuration and
   * projection. The server identity carries Browser ownership, permission and
   * result semantics, so an unrelated local or remote provider cannot occupy
   * it. Ordinary local options remain configurable around the exact builtin
   * command, and the strict shorthand may disable the provider. */
  export function configuredDeclaration(input: unknown): ConfiguredDeclaration {
    if (!input || typeof input !== "object" || Array.isArray(input)) {
      throw unsupportedProvider()
    }
    const declaration = input as { type?: unknown; command?: unknown; enabled?: unknown }
    if (declaration.type === undefined && declaration.enabled === false) return { status: "disabled" }
    if (declaration.type !== "local") {
      const providerType = declaration.type === undefined ? undefined : String(declaration.type)
      throw unsupportedProvider(providerType)
    }
    if (!isBuiltinLocalConfig(declaration as { type: string; command?: string[] })) {
      throw unsupportedProvider("local")
    }
    if (declaration.enabled === false) return { status: "disabled" }
    return { status: "enabled", config: input as LocalDeclaration }
  }

  export async function resolveStdioProcess(input: { env?: NodeJS.ProcessEnv } = {}) {
    // Configuration imports this module while ProcessSupervisor is still being
    // initialized. Keep the physical launcher behind the capability boundary
    // so provider identity never evaluates the process-control graph.
    const { BrowserMCPNodeLauncher } = await import("./node-launcher")
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

  function unsupportedProvider(providerType?: string) {
    const detail = providerType === "local" ? " the built-in Browser command" : " the built-in Browser local provider"
    const got = providerType && providerType !== "local" ? `, got ${providerType}` : ""
    return new ConfigurationError({
      message: `Configured MCP server ${ServerName} must use${detail}${got}.`,
      reason: "unsupported_provider",
      serverName: ServerName,
      providerType,
    })
  }
}
