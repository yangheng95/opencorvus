import path from "node:path"
import { NamedError } from "@opencorvus-ai/util/error"
import z from "zod"

export namespace ComputerMCPBuiltin {
  export const ServerName = "computer"

  export const ConfigurationError = NamedError.create(
    "ComputerMCPConfigurationError",
    z.object({
      message: z.string().min(1),
      reason: z.enum(["disabled", "unsupported_provider"]),
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

  export type ConfiguredDeclaration =
    | { status: "disabled" }
    | { status: "enabled"; config: LocalDeclaration }

  /** One interpretation of the reserved `computer` MCP declaration for every
   * projection consumer. Computer is a host-native provider: a remote MCP
   * under the reserved name would not share its ownership or evidence
   * contract, while both the shorthand and typed local forms may disable it. */
  export function configuredDeclaration(input: unknown): ConfiguredDeclaration {
    if (!input || typeof input !== "object" || Array.isArray(input)) {
      throw new ConfigurationError({
        message: `Configured MCP server ${ServerName} must use the host-native local provider.`,
        reason: "unsupported_provider",
        serverName: ServerName,
      })
    }
    const declaration = input as { type?: unknown; enabled?: unknown }
    if (declaration.type !== undefined && declaration.type !== "local") {
      const providerType = typeof declaration.type === "string" ? declaration.type : String(declaration.type)
      throw new ConfigurationError({
        message: `Configured MCP server ${ServerName} must use the host-native local provider, got ${providerType}.`,
        reason: "unsupported_provider",
        serverName: ServerName,
        providerType,
      })
    }
    if (declaration.enabled === false) return { status: "disabled" }
    if (declaration.type !== "local") {
      throw new ConfigurationError({
        message: `Configured MCP server ${ServerName} must use the host-native local provider.`,
        reason: "unsupported_provider",
        serverName: ServerName,
      })
    }
    return { status: "enabled", config: input as LocalDeclaration }
  }

  export function requireEnabledConfiguredDeclaration(input: unknown): LocalDeclaration {
    const declaration = configuredDeclaration(input)
    if (declaration.status === "enabled") return declaration.config
    throw new ConfigurationError({
      message: `Configured MCP server ${ServerName} is disabled.`,
      reason: "disabled",
      serverName: ServerName,
    })
  }

  const ToolNames = [
    "session_create",
    "observe",
    "click",
    "type_text",
    "keypress",
    "scroll",
    "drag",
    "session_destroy",
  ] as const

  export type ToolName = (typeof ToolNames)[number]
  export const ImportableToolNames = Object.freeze([...ToolNames])
  export const ImportableToolRefs = Object.freeze(ToolNames.map((name) => `default/mcp/${ServerName}/tool/${name}`))
  export const ScreenshotEvidenceToolRefs = Object.freeze([`default/mcp/${ServerName}/tool/observe`])

  export function command(
    runtime: {
      execPath?: string
      moduleDir?: string
    } = {},
  ) {
    const execPath = runtime.execPath ?? process.execPath
    const moduleDir = runtime.moduleDir ?? import.meta.dir
    const args = isBunRuntime(execPath) ? [path.resolve(moduleDir, "stdio.ts")] : ["mcp", "computer"]
    return [execPath, ...args]
  }

  export function localConfig(
    runtime: {
      execPath?: string
      moduleDir?: string
      hostAdapter?: { endpoint: string; authorization: string; runtimeScope: string }
    } = {},
  ) {
    const environment = {
      ...(runtime.hostAdapter
        ? {
            OPENCORVUS_COMPUTER_HOST_ENDPOINT: runtime.hostAdapter.endpoint,
            OPENCORVUS_COMPUTER_HOST_AUTHORIZATION: runtime.hostAdapter.authorization,
            OPENCORVUS_COMPUTER_RUNTIME_SCOPE: runtime.hostAdapter.runtimeScope,
          }
        : {}),
    }
    return {
      type: "local" as const,
      command: command(runtime),
      ...(Object.keys(environment).length > 0 ? { environment } : {}),
      timeout: 30_000,
    }
  }

  export function withRuntimeScope<T extends { type: "local"; environment?: Record<string, string> }>(
    mcp: T,
    runtimeScope: string,
    hostAdapter: { endpoint: string; authorization: string; runtimeScope: string },
  ): T {
    const adapterEnvironment = { ...mcp.environment }
    return {
      ...mcp,
      environment: {
        ...adapterEnvironment,
        OPENCORVUS_COMPUTER_HOST_ENDPOINT: hostAdapter.endpoint,
        OPENCORVUS_COMPUTER_HOST_AUTHORIZATION: hostAdapter.authorization,
        OPENCORVUS_COMPUTER_RUNTIME_SCOPE: runtimeScope,
      },
    }
  }

  /** Stable capability identity excludes per-process transport coordinates while retaining the logical runtime owner. */
  export function catalogIdentityConfig<T extends { type: "local"; environment?: Record<string, string> }>(mcp: T): T {
    if (!mcp.environment?.OPENCORVUS_COMPUTER_RUNTIME_SCOPE) return mcp
    const environment = { ...mcp.environment }
    delete environment.OPENCORVUS_COMPUTER_HOST_ENDPOINT
    delete environment.OPENCORVUS_COMPUTER_HOST_AUTHORIZATION
    return { ...mcp, environment }
  }
}

function isBunRuntime(execPath: string) {
  return (
    path
      .basename(execPath)
      .toLowerCase()
      .replace(/\.exe$/, "") === "bun"
  )
}
