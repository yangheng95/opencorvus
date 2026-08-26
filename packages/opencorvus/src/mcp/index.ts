import { dynamicTool, type Tool, jsonSchema, type JSONSchema7 } from "ai"
import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js"
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js"
import { getDefaultEnvironment, type StdioServerParameters } from "@modelcontextprotocol/sdk/client/stdio.js"
import { UnauthorizedError } from "@modelcontextprotocol/sdk/client/auth.js"
import {
  type CallToolResult,
  CallToolResultSchema,
  GetPromptResultSchema,
  type GetPromptRequest,
  type JSONRPCMessage,
  ReadResourceResultSchema,
  type ReadResourceRequest,
  type Tool as MCPToolDef,
  PromptListChangedNotificationSchema,
  ResourceListChangedNotificationSchema,
  ToolListChangedNotificationSchema,
} from "@modelcontextprotocol/sdk/types.js"
import { PermissionAuthority } from "@/permission/authority"
import { ReadBuffer, serializeMessage } from "@modelcontextprotocol/sdk/shared/stdio.js"
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js"
import { AsyncLocalStorage } from "node:async_hooks"
import { PassThrough, type Stream } from "node:stream"
import { Config } from "../config/config"
import { Log } from "../util/log"
import { NamedError } from "@opencorvus-ai/util/error"
import z from "zod/v4"
import { Database, NotFoundError } from "../storage/db"
import { Instance, reenterActiveInstance } from "../project/instance"
import { runWithIndependentProjectIdentity } from "../project/independent-project-owner"
import { createInstanceState } from "../project/instance-state"
import { Installation } from "../installation"
import { McpOAuthProvider } from "./oauth-provider"
import { McpOAuthCallback } from "./oauth-callback"
import { oauthAuthorizationLogFields } from "./oauth-log"
import { McpAuth } from "./auth"
import { BrowserMCPBuiltin } from "./browser/builtin"
import { BusEvent } from "../bus/bus-event"
import { Bus } from "@/bus"
import { GlobalBus } from "@/bus/global"
import open from "open"
import { entries, values as objectValues } from "@/util/object"
import { ServeRuntimeMemoryMetrics } from "@/runtime/memory-metrics"
import type { RequestOptions } from "@modelcontextprotocol/sdk/shared/protocol.js"
import { browserMcpBridgeEnvironment } from "./browser/proxy-env"
import { Env } from "@/runtime/env"
import { ProcessSupervisor } from "@/shell/process-supervisor"
import { createHash } from "node:crypto"
import { isToolVisibilityAppOnly } from "@modelcontextprotocol/ext-apps/app-bridge"
import { createLocalMcpProcessDiagnostics, type LocalMcpProcessDiagnostics } from "./local-process-diagnostics"
import {
  assertTaskNetworkCapability,
  readTaskProcessBinding,
  resolveTaskProcessExecution,
  TASK_EXECUTION_CAPSULE_BINDING_PROTOCOL,
} from "@/engine/task-execution-capsule-binding"

export namespace MCP {
  const log = Log.create({ service: "mcp" })
  const DEFAULT_TIMEOUT = 30_000
  const STDIO_GRACEFUL_CLOSE_TIMEOUT_MS = 5_000

  export type ProcessAuthority =
    | Readonly<{ kind: "host"; cwd: string }>
    | Readonly<{ kind: "task"; taskID: string; cwd: string; runtimeIdentity: string }>

  export function hostProcessAuthority(cwd: string): ProcessAuthority {
    return Object.freeze({ kind: "host", cwd })
  }

  export function taskProcessAuthority(taskID: string, cwd: string): ProcessAuthority {
    const binding = readTaskProcessBinding(taskID)
    return Object.freeze({
      kind: "task",
      taskID,
      cwd,
      runtimeIdentity:
        binding.protocol === TASK_EXECUTION_CAPSULE_BINDING_PROTOCOL
          ? binding.runtime_identity_sha256
          : `native:${binding.project_id}:${binding.workspace_root}`,
    })
  }

  function assertMcpCapability(label: string, type: Config.Mcp["type"], authority: ProcessAuthority) {
    if (authority.kind === "task" && type === "remote") {
      assertTaskNetworkCapability({ taskID: authority.taskID, capability: label })
    }
  }

  ServeRuntimeMemoryMetrics.register({
    id: "host-mcp",
    snapshot: () => connectionStats(),
  })

  export const Resource = z
    .object({
      name: z.string(),
      uri: z.string(),
      description: z.string().optional(),
      mimeType: z.string().optional(),
      client: z.string(),
    })
    .meta({ ref: "McpResource" })
  export type Resource = z.infer<typeof Resource>

  export const ToolsChanged = BusEvent.define(
    "mcp.tools.changed",
    z.object({
      server: z.string(),
    }),
  )

  export const ResourcesChanged = BusEvent.define(
    "mcp.resources.changed",
    z.object({
      server: z.string(),
    }),
  )

  export const PromptsChanged = BusEvent.define(
    "mcp.prompts.changed",
    z.object({
      server: z.string(),
    }),
  )

  export const BrowserOpenFailed = BusEvent.define(
    "mcp.browser.open.failed",
    z.object({
      mcpName: z.string(),
      url: z.string(),
    }),
  )

  export const AuthRequired = BusEvent.define(
    "mcp.auth.required",
    z.object({
      name: z.string(),
      message: z.string(),
      reason: z.enum(["needs_auth", "needs_client_registration"]),
    }),
    { tier: 2, badge: true },
  )

  export const Failed = NamedError.create(
    "MCPFailed",
    z.object({
      name: z.string(),
    }),
  )

  export const OAuthStateError = NamedError.create(
    "MCPOAuthStateError",
    z.object({
      mcpName: z.string(),
      message: z.string(),
    }),
  )

  type MCPClient = Client
  export type AppToolBinding = {
    serverID: string
    configDigest: string
    tool: MCPToolDef
    resourceURI: string
    withClient?: <T>(run: (client: MCPClient, timeout: number) => Promise<T>) => Promise<T>
  }
  export type ToolAuthorityBinding = {
    serverID: string
    configDigest: string
    toolDigest: string
  }
  const appToolBindings = new WeakMap<object, AppToolBinding>()
  const toolAuthorityBindings = new WeakMap<object, ToolAuthorityBinding>()
  const appToolResults = new WeakMap<object, CallToolResult>()

  function stableToolUiResourceUri(tool: MCPToolDef): string | undefined {
    const ui = (tool._meta as { ui?: unknown } | undefined)?.ui
    if (ui === undefined) return undefined
    if (!ui || typeof ui !== "object" || Array.isArray(ui)) {
      throw new Error(`MCP tool ${tool.name} _meta.ui must be an object`)
    }
    const resourceURI = (ui as { resourceUri?: unknown }).resourceUri
    if (resourceURI === undefined) return undefined
    if (typeof resourceURI !== "string" || !resourceURI.startsWith("ui://")) {
      throw new Error(`MCP tool ${tool.name} _meta.ui.resourceUri must use ui://`)
    }
    return resourceURI
  }

  const ProjectionPromptPayloadSchema = z
    .object({
      description: z.unknown().optional(),
      messages: z.array(
        z
          .object({
            role: z.unknown(),
            content: z.unknown(),
          })
          .passthrough(),
      ),
    })
    .passthrough()
  export type ProjectionPromptPayload = z.infer<typeof ProjectionPromptPayloadSchema>

  const ProjectionResourcePayloadSchema = z
    .object({
      contents: z.array(z.object({}).passthrough()),
    })
    .passthrough()
  export type ProjectionResourcePayload = z.infer<typeof ProjectionResourcePayloadSchema>

  export const Status = z
    .discriminatedUnion("status", [
      z
        .object({
          status: z.literal("connected"),
        })
        .meta({
          ref: "MCPStatusConnected",
        }),
      z
        .object({
          status: z.literal("disabled"),
        })
        .meta({
          ref: "MCPStatusDisabled",
        }),
      z
        .object({
          status: z.literal("disconnected"),
        })
        .meta({
          ref: "MCPStatusDisconnected",
        }),
      z
        .object({
          status: z.literal("connecting"),
        })
        .meta({
          ref: "MCPStatusConnecting",
        }),
      z
        .object({
          status: z.literal("failed"),
          error: z.string(),
        })
        .meta({
          ref: "MCPStatusFailed",
        }),
      z
        .object({
          status: z.literal("needs_auth"),
        })
        .meta({
          ref: "MCPStatusNeedsAuth",
        }),
      z
        .object({
          status: z.literal("needs_client_registration"),
          error: z.string(),
        })
        .meta({
          ref: "MCPStatusNeedsClientRegistration",
        }),
    ])
    .meta({
      ref: "MCPStatus",
    })
  export type Status = z.infer<typeof Status>

  // Register notification handlers for MCP client
  function registerNotificationHandlers(client: MCPClient, serverName: string, directory: string) {
    const publish = (event: typeof ToolsChanged | typeof ResourcesChanged | typeof PromptsChanged) => {
      GlobalBus.emit("event", {
        directory,
        payload: {
          type: event.type,
          properties: { server: serverName },
        },
      })
    }
    client.setNotificationHandler(ToolListChangedNotificationSchema, async () => {
      log.info("tools list changed notification received", { server: serverName })
      publish(ToolsChanged)
    })
    client.setNotificationHandler(ResourceListChangedNotificationSchema, async () => {
      log.info("resources list changed notification received", { server: serverName })
      publish(ResourcesChanged)
    })
    client.setNotificationHandler(PromptListChangedNotificationSchema, async () => {
      log.info("prompts list changed notification received", { server: serverName })
      publish(PromptsChanged)
    })
  }

  // Convert MCP tool definition to AI SDK Tool type
  function inputSchemaForMcpTool(mcpTool: MCPToolDef): JSONSchema7 {
    const inputSchema = mcpTool.inputSchema

    return {
      ...(inputSchema as JSONSchema7),
      type: "object",
      properties: (inputSchema.properties ?? {}) as JSONSchema7["properties"],
      additionalProperties: false,
    }
  }

  async function convertMcpTool(
    mcpTool: MCPToolDef,
    client: MCPClient,
    timeout: number,
    source: {
      serverID: string
      configDigest: string
      type: Config.Mcp["type"]
      processAuthority: ProcessAuthority
    },
  ): Promise<Tool> {
    const schema = inputSchemaForMcpTool(mcpTool)

    const tool = dynamicTool({
      description: mcpTool.description ?? "",
      inputSchema: jsonSchema(schema),
      execute: async (args: unknown) => {
        assertMcpCapability(`MCP ${source.serverID}/${mcpTool.name}`, source.type, source.processAuthority)
        return callToolWithTaskRecovery({
          client,
          tool: mcpTool,
          args: (args || {}) as Record<string, unknown>,
          timeout,
        })
      },
    })
    toolAuthorityBindings.set(tool, {
      serverID: source.serverID,
      configDigest: source.configDigest,
      toolDigest: toolDefinitionDigest(mcpTool),
    })
    const resourceURI = stableToolUiResourceUri(mcpTool)
    if (resourceURI) {
      appToolBindings.set(tool, {
        ...source,
        tool: mcpTool,
        resourceURI,
      })
    }
    return tool
  }

  export function appToolBinding(tool: object): AppToolBinding | undefined {
    return appToolBindings.get(tool)
  }

  export function toolAuthorityBinding(tool: object): ToolAuthorityBinding | undefined {
    return toolAuthorityBindings.get(tool)
  }

  export function toolDefinitionDigest(tool: MCPToolDef): string {
    return createHash("sha256")
      .update(JSON.stringify(canonicalConfigValue(tool)))
      .digest("hex")
  }

  export function copyAppToolBinding(source: object, target: object): void {
    const binding = appToolBindings.get(source)
    if (binding) appToolBindings.set(target, binding)
    const authority = toolAuthorityBindings.get(source)
    if (authority) toolAuthorityBindings.set(target, authority)
  }

  export function bindAppToolResult<T extends object>(output: T, result: CallToolResult): T {
    appToolResults.set(output, result)
    return output
  }

  export function appToolResult(output: object): CallToolResult | undefined {
    return appToolResults.get(output)
  }

  export async function withBoundAppClient<T>(
    binding: AppToolBinding,
    run: (client: MCPClient, timeout: number) => Promise<T>,
  ): Promise<T> {
    return binding.withClient ? binding.withClient(run) : withAppClient(binding, run)
  }

  export interface ScopedConnectionInput {
    key: string
    mcp: Config.Mcp
    cwd: string
    globalTimeout?: number
    connectionOwner?: ScopedConnectionOwner
    connectionIdentity?: string
    processAuthority: ProcessAuthority
  }

  export interface ScopedToolInput extends ScopedConnectionInput {
    toolName: string
  }

  export interface ScopedPromptInput extends ScopedConnectionInput {
    promptName: string
  }

  export interface ScopedResourceInput extends ScopedConnectionInput {
    resourceName: string
  }

  export const ScopedCapabilityInventory = z
    .object({
      tools: z.array(z.string()),
      prompts: z.array(z.string()),
      resources: z.array(z.string()),
    })
    .strict()
  export type ScopedCapabilityInventory = z.infer<typeof ScopedCapabilityInventory>

  export interface ScopedConnectionOwner {
    readonly id: string
    close(): Promise<void>
  }

  type OwnedScopedConnectionEntry = {
    identity: string
    key: string
    connecting: Promise<McpConnection>
    connection?: McpConnection
    active: number
    idleWaiters: Set<() => void>
  }

  type ScopedConnectionOwnerState = {
    id: string
    entries: Map<string, OwnedScopedConnectionEntry>
    cleanupPending: Set<McpConnection>
    projectState?: McpState
    close?: () => Promise<void>
  }

  function scopedConnectionOwnerKey(input: ScopedConnectionInput, identity: string): string {
    return createHash("sha256")
      .update(
        JSON.stringify(
          canonicalConfigValue({
            identity,
            cwd: input.cwd,
            processAuthority: input.processAuthority,
            mcp: input.mcp,
            globalTimeout: input.globalTimeout ?? null,
          }),
        ),
      )
      .digest("hex")
  }

  type InternalScopedConnectionOwner = ScopedConnectionOwner & {
    use<T>(
      input: ScopedConnectionInput,
      options: Pick<CreateOptions, "skipToolListVerification">,
      run: (client: MCPClient, timeout: number, connection: McpConnection) => Promise<T>,
    ): Promise<T>
  }

  /**
   * Tear down the Computer logical session this owner's scope names.
   *
   * A scoped owner's id IS its Computer runtime scope — both are derived from
   * the same Session (and Task) identity — but closing the owner only closed
   * MCP connections, and the host backend's own `close` is a no-op. The
   * desktop session, its driver authorization and its preserved state
   * therefore outlived the Session that created them, until the whole Project
   * Instance was disposed. The owner's settlement now invokes the sole destroy
   * primitive for its scope, so Project disposal is the outer safety net it
   * was meant to be rather than the only owner.
   */
  async function destroyOwnedComputerRuntimeScope(runtimeScope: string): Promise<void> {
    const { ComputerHostRuntime } = await import("./computer/host-runtime")
    try {
      await ComputerHostRuntime.destroy(runtimeScope)
    } catch (error) {
      // A scope that never took a Computer session has nothing to destroy, and
      // a failed teardown must not mask the MCP close that already succeeded.
      log.info("scoped Computer runtime teardown did not settle", {
        runtimeScope,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  export function createScopedConnectionOwner(id: string): ScopedConnectionOwner {
    const normalizedID = id.trim()
    if (!normalizedID) throw new Error("Scoped MCP connection owner requires a non-empty id")
    const entries = new Map<string, OwnedScopedConnectionEntry>()
    const cleanupPending = new Set<McpConnection>()
    const ownerState: ScopedConnectionOwnerState = { id: normalizedID, entries, cleanupPending }
    let closed = false
    let closePromise: Promise<void> | undefined

    const registerOwnerState = async () => {
      if (ownerState.projectState) return ownerState.projectState
      const projectState = await state()
      projectState.scopedOwners.add(ownerState)
      ownerState.projectState = projectState
      return projectState
    }

    const waitForIdle = async (entry: OwnedScopedConnectionEntry) => {
      if (entry.active === 0) return
      await new Promise<void>((resolve) => entry.idleWaiters.add(resolve))
    }

    const owner: InternalScopedConnectionOwner = {
      id: normalizedID,
      async use(input, options, run) {
        if (closed) throw new Error(`Scoped MCP connection owner ${normalizedID} is closed`)
        const identity = input.connectionIdentity?.trim()
        if (!identity) {
          throw new Error(`Scoped MCP connection owner ${normalizedID} requires connectionIdentity`)
        }
        await registerOwnerState()
        const ownerKey = scopedConnectionOwnerKey(input, identity)
        let entry = entries.get(ownerKey)
        if (!entry) {
          let candidate!: OwnedScopedConnectionEntry
          const connecting = createSafely(identity, input.mcp, {
            processAuthority: input.processAuthority,
            cwd: input.cwd,
            authKey: false,
            globalTimeout: input.globalTimeout,
            onCleanupPending: (connection) => cleanupPending.add(connection),
            ...options,
          })
            .then((result) => {
              if (!result.mcpConnection) {
                const status = result.status
                const detail = "error" in status ? `: ${status.error}` : `: ${status.status}`
                throw new Error(`Scoped MCP server ${input.key} did not connect${detail}`)
              }
              return result.mcpConnection
            })
            .catch((error) => {
              if (entries.get(ownerKey) === candidate) entries.delete(ownerKey)
              throw error
            })
          candidate = {
            identity,
            key: identity,
            connecting,
            active: 0,
            idleWaiters: new Set(),
          }
          entry = candidate
          entries.set(ownerKey, candidate)
        }
        entry.active++
        try {
          const connection = entry.connection ?? (await entry.connecting)
          entry.connection = connection
          connection.lastUsedAt = Date.now()
          return await run(connection.client, effectiveTimeout(input.mcp, input.globalTimeout), connection)
        } finally {
          entry.active--
          if (entry.connection) entry.connection.lastUsedAt = Date.now()
          if (entry.active === 0) {
            for (const resolve of entry.idleWaiters) resolve()
            entry.idleWaiters.clear()
          }
        }
      },
      async close() {
        closePromise ??= (async () => {
          closed = true
          const owned = [...entries.values()]
          await Promise.all(owned.map(waitForIdle))
          const connections = await Promise.allSettled(
            owned.map(async (entry) => entry.connection ?? (await entry.connecting)),
          )
          for (const result of connections) {
            if (result.status === "fulfilled") cleanupPending.add(result.value)
          }
          const closeResults = await Promise.allSettled(
            [...cleanupPending].map(async (connection) => {
              await closeConnection(connection.key, connection)
              cleanupPending.delete(connection)
            }),
          )
          const errors = [...connections, ...closeResults].flatMap((result) =>
            result.status === "rejected" ? [result.reason] : [],
          )
          if (errors.length > 0) {
            await transferScopedCleanupToInstance(cleanupPending)
            entries.clear()
            ownerState.projectState?.scopedOwners.delete(ownerState)
            ownerState.projectState = undefined
            throw new AggregateError(errors, `Failed to close scoped MCP connection owner ${normalizedID}`)
          }
          entries.clear()
          ownerState.projectState?.scopedOwners.delete(ownerState)
          ownerState.projectState = undefined
          await destroyOwnedComputerRuntimeScope(normalizedID)
        })()
        try {
          await closePromise
        } catch (error) {
          closePromise = undefined
          throw error
        }
      },
    }
    ownerState.close = () => owner.close()
    return owner
  }

  const SCOPED_CAPABILITY_LIMIT = 2_048

  async function collectScopedCapabilityPages<T>(input: {
    kind: "tool" | "prompt" | "resource"
    list: (cursor: string | undefined) => Promise<{ items: T[]; nextCursor?: string }>
  }): Promise<T[]> {
    const result: T[] = []
    const cursors = new Set<string>()
    let cursor: string | undefined
    do {
      const page = await input.list(cursor)
      result.push(...page.items)
      if (result.length > SCOPED_CAPABILITY_LIMIT) {
        throw new Error(`Scoped MCP server exceeds the ${SCOPED_CAPABILITY_LIMIT} ${input.kind} capability limit`)
      }
      cursor = page.nextCursor
      if (!cursor) break
      if (cursors.has(cursor)) throw new Error(`Scoped MCP server repeated ${input.kind} pagination cursor ${cursor}`)
      cursors.add(cursor)
    } while (cursor)
    return result
  }

  function exactScopedCapabilityNames(kind: "tool" | "prompt" | "resource", values: Array<{ name: string }>) {
    const names = values.map((value) => value.name).sort((left, right) => left.localeCompare(right))
    for (let index = 1; index < names.length; index++) {
      if (names[index - 1] === names[index]) {
        throw new Error(`Scoped MCP server repeats ${kind} capability ${JSON.stringify(names[index])}`)
      }
    }
    return names
  }

  export async function inspectScopedCapabilities(input: ScopedConnectionInput): Promise<ScopedCapabilityInventory> {
    return withScopedClient(
      input,
      async (client, timeout) => {
        const capabilities = client.getServerCapabilities()
        const tools = capabilities?.tools
          ? await collectScopedCapabilityPages({
              kind: "tool",
              async list(cursor) {
                const page = await client.listTools(cursor ? { cursor } : undefined, mcpRequestOptions(timeout))
                return { items: page.tools, nextCursor: page.nextCursor }
              },
            })
          : []
        const prompts = capabilities?.prompts
          ? await collectScopedCapabilityPages({
              kind: "prompt",
              async list(cursor) {
                const page = await client.listPrompts(cursor ? { cursor } : undefined, mcpRequestOptions(timeout))
                return { items: page.prompts, nextCursor: page.nextCursor }
              },
            })
          : []
        const resources = capabilities?.resources
          ? await collectScopedCapabilityPages({
              kind: "resource",
              async list(cursor) {
                const page = await client.listResources(cursor ? { cursor } : undefined, mcpRequestOptions(timeout))
                return { items: page.resources, nextCursor: page.nextCursor }
              },
            })
          : []
        return ScopedCapabilityInventory.parse({
          tools: exactScopedCapabilityNames("tool", tools),
          prompts: exactScopedCapabilityNames("prompt", prompts),
          resources: exactScopedCapabilityNames("resource", resources),
        })
      },
      { skipToolListVerification: true },
    )
  }

  export async function scopedTool(input: ScopedToolInput): Promise<Tool> {
    const mcpTool = await scopedToolInfo(input)
    if (isToolVisibilityAppOnly(mcpTool)) {
      throw new Error(`Scoped MCP tool ${input.key}/${input.toolName} is app-only and cannot be projected to the model`)
    }
    const schema = inputSchemaForMcpTool(mcpTool)
    const tool = dynamicTool({
      description: mcpTool.description ?? "",
      inputSchema: jsonSchema(schema),
      execute: async (args: unknown) =>
        callScopedTool({
          ...input,
          args: (args || {}) as Record<string, unknown>,
        }),
    })
    toolAuthorityBindings.set(tool, {
      serverID: input.key,
      configDigest: mcpConfigDigest(input.mcp),
      toolDigest: toolDefinitionDigest(mcpTool),
    })
    const resourceURI = stableToolUiResourceUri(mcpTool)
    if (resourceURI) {
      appToolBindings.set(tool, {
        serverID: input.key,
        configDigest: mcpConfigDigest(input.mcp),
        tool: mcpTool,
        resourceURI,
        withClient: (run) => withScopedClient(input, run),
      })
    }
    return tool
  }

  export async function scopedToolInfo(input: ScopedToolInput): Promise<MCPToolDef> {
    return withScopedClient(input, async (_client, _timeout, connection) => {
      const mcpTool = connection.tools.find((item) => item.name === input.toolName)
      if (!mcpTool) throw new Error(`Scoped MCP server ${input.key} does not expose tool ${input.toolName}`)
      return mcpTool
    })
  }

  export async function callScopedTool(
    input: ScopedToolInput & { args: Record<string, unknown> },
  ): Promise<CallToolResult> {
    assertMcpCapability(`MCP ${input.key}/${input.toolName}`, input.mcp.type, input.processAuthority)
    return withScopedClient(
      input,
      async (client, timeout, connection) => {
        const tool = connection.tools.find((item) => item.name === input.toolName)
        if (!tool) throw new Error(`Scoped MCP server ${input.key} does not expose tool ${input.toolName}`)
        return callToolWithTaskRecovery({ client, tool, args: input.args, timeout })
      },
      { skipToolListVerification: true },
    )
  }

  async function scopedPromptInfoFromClient(
    client: MCPClient,
    timeout: number,
    input: ScopedPromptInput,
  ): Promise<PromptInfo> {
    if (!client.getServerCapabilities()?.prompts) {
      throw new Error(`Scoped MCP server ${input.key} does not expose prompts`)
    }
    const result = await client.listPrompts(undefined, mcpRequestOptions(timeout))
    const prompt = result.prompts.find((item) => item.name === input.promptName)
    if (!prompt) throw new Error(`Scoped MCP server ${input.key} does not expose prompt ${input.promptName}`)
    return prompt
  }

  export async function scopedPromptInfo(input: ScopedPromptInput): Promise<PromptInfo> {
    return withScopedClient(input, async (client, timeout) => scopedPromptInfoFromClient(client, timeout, input), {
      skipToolListVerification: true,
    })
  }

  export async function getScopedPrompt(
    input: ScopedPromptInput & { args?: Record<string, string> },
  ): Promise<GetPromptResult> {
    return withScopedClient(
      input,
      async (client, timeout) =>
        GetPromptResultSchema.parse(
          await client.getPrompt(
            {
              name: input.promptName,
              arguments: input.args,
            },
            mcpRequestOptions(timeout),
          ),
        ),
      { skipToolListVerification: true },
    )
  }

  export async function getScopedPromptProjectionPayload(
    input: ScopedPromptInput & { args?: Record<string, string> },
  ): Promise<ProjectionPromptPayload> {
    return withScopedClient(
      input,
      async (client, timeout) =>
        client.request(
          {
            method: "prompts/get",
            params: {
              name: input.promptName,
              arguments: input.args,
            },
          } satisfies GetPromptRequest,
          ProjectionPromptPayloadSchema,
          mcpRequestOptions(timeout),
        ),
      { skipToolListVerification: true },
    )
  }

  async function scopedResourceInfoFromClient(
    client: MCPClient,
    timeout: number,
    input: ScopedResourceInput,
  ): Promise<ResourceInfo> {
    if (!client.getServerCapabilities()?.resources) {
      throw new Error(`Scoped MCP server ${input.key} does not expose resources`)
    }
    const result = await client.listResources(undefined, mcpRequestOptions(timeout))
    const resource = result.resources.find((item) => item.name === input.resourceName)
    if (!resource) throw new Error(`Scoped MCP server ${input.key} does not expose resource ${input.resourceName}`)
    return resource
  }

  export async function scopedResourceInfo(input: ScopedResourceInput): Promise<ResourceInfo> {
    return withScopedClient(input, async (client, timeout) => scopedResourceInfoFromClient(client, timeout, input), {
      skipToolListVerification: true,
    })
  }

  export async function readScopedResource(input: ScopedResourceInput): Promise<ReadResourceResult> {
    return withScopedClient(
      input,
      async (client, timeout) => {
        const resource = await scopedResourceInfoFromClient(client, timeout, input)
        return ReadResourceResultSchema.parse(
          await client.readResource(
            {
              uri: resource.uri,
            },
            mcpRequestOptions(timeout),
          ),
        )
      },
      { skipToolListVerification: true },
    )
  }

  export async function readScopedResourceProjectionPayload(
    input: ScopedResourceInput,
  ): Promise<ProjectionResourcePayload> {
    return withScopedClient(
      input,
      async (client, timeout) => {
        const resource = await scopedResourceInfoFromClient(client, timeout, input)
        return client.request(
          {
            method: "resources/read",
            params: {
              uri: resource.uri,
            },
          } satisfies ReadResourceRequest,
          ProjectionResourcePayloadSchema,
          mcpRequestOptions(timeout),
        )
      },
      { skipToolListVerification: true },
    )
  }

  async function settleScopedCleanup(pending: Set<McpConnection>, label: string) {
    const results = await Promise.allSettled(
      [...pending].map(async (connection) => {
        await closeConnection(connection.key, connection)
        pending.delete(connection)
      }),
    )
    const errors = results.flatMap((result) => (result.status === "rejected" ? [result.reason] : []))
    if (errors.length > 0) throw new AggregateError(errors, label)
  }

  async function transferScopedCleanupToInstance(pending: Set<McpConnection>) {
    const s = await state()
    for (const connection of pending) queueConnectionCleanup(s, connection.key, connection)
    pending.clear()
  }

  async function withScopedClient<T>(
    input: ScopedConnectionInput,
    run: (client: MCPClient, timeout: number, connection: McpConnection) => Promise<T>,
    options: Pick<CreateOptions, "skipToolListVerification"> = {},
  ): Promise<T> {
    if (input.cwd !== input.processAuthority.cwd) {
      throw new Error(
        `Scoped MCP ${input.key} cwd ${input.cwd} does not match explicit ${input.processAuthority.kind} process authority ${input.processAuthority.cwd}`,
      )
    }
    if (input.processAuthority.kind === "task") {
      await resolveTaskProcessExecution({
        taskID: input.processAuthority.taskID,
        cwd: input.processAuthority.cwd,
      })
    }
    assertMcpCapability(`MCP ${input.key}`, input.mcp.type, input.processAuthority)
    if (input.connectionOwner) {
      return (input.connectionOwner as InternalScopedConnectionOwner).use(input, options, run)
    }
    const poolKey = scopedLocalPoolKey(input, options)
    const pool = scopedLocalConnectionPoolStorage.getStore()
    if (poolKey && pool) {
      const pooled = await acquireScopedLocalConnection(pool, poolKey, input, options)
      try {
        const timeout = effectiveTimeout(input.mcp, input.globalTimeout)
        return await run(pooled.connection.client, timeout, pooled.connection)
      } finally {
        releaseScopedLocalConnection(pooled.entry)
      }
    }
    const cleanupPending = new Set<McpConnection>()
    const result = await createSafely(input.key, input.mcp, {
      processAuthority: input.processAuthority,
      cwd: input.cwd,
      authKey: false,
      globalTimeout: input.globalTimeout,
      onCleanupPending: (connection) => cleanupPending.add(connection),
      ...options,
    })
    if (!result.mcpConnection) {
      const status = result.status
      const detail = "error" in status ? `: ${status.error}` : `: ${status.status}`
      const connectionError = new Error(`Scoped MCP server ${input.key} did not connect${detail}`)
      try {
        await settleScopedCleanup(cleanupPending, `Failed to close scoped MCP server ${input.key}`)
      } catch (cleanupError) {
        await transferScopedCleanupToInstance(cleanupPending)
        throw new AggregateError(
          [connectionError, cleanupError],
          `Scoped MCP server ${input.key} failed and leaked cleanup`,
        )
      }
      throw connectionError
    }
    cleanupPending.add(result.mcpConnection)
    let runResult: T | undefined
    let runError: unknown
    try {
      const timeout = effectiveTimeout(input.mcp, input.globalTimeout)
      runResult = await run(result.mcpConnection.client, timeout, result.mcpConnection)
    } catch (error) {
      runError = error
    }
    let cleanupError: unknown
    try {
      await settleScopedCleanup(cleanupPending, `Failed to close scoped MCP server ${input.key}`)
    } catch (error) {
      cleanupError = error
      await transferScopedCleanupToInstance(cleanupPending)
    }
    if (runError && cleanupError) {
      throw new AggregateError([runError, cleanupError], `Scoped MCP server ${input.key} request and cleanup failed`)
    }
    if (runError) throw runError
    if (cleanupError) throw cleanupError
    return runResult as T
  }

  type ScopedLocalPoolEntry = {
    connecting: Promise<McpConnection>
    connection?: McpConnection
    active: number
  }

  type ScopedLocalPoolLease = {
    entry: ScopedLocalPoolEntry
    connection: McpConnection
  }

  type ScopedLocalConnectionPool = {
    entries: Map<string, ScopedLocalPoolEntry>
    cleanupPending: Set<McpConnection>
  }

  const scopedLocalConnectionPoolStorage = new AsyncLocalStorage<ScopedLocalConnectionPool>()

  export async function withScopedConnectionPool<T>(run: () => Promise<T>): Promise<T> {
    if (scopedLocalConnectionPoolStorage.getStore()) return run()
    const pool: ScopedLocalConnectionPool = {
      entries: new Map<string, ScopedLocalPoolEntry>(),
      cleanupPending: new Set<McpConnection>(),
    }
    let runResult: T | undefined
    let runError: unknown
    try {
      runResult = await scopedLocalConnectionPoolStorage.run(pool, run)
    } catch (error) {
      runError = error
    }
    let closeError: unknown
    try {
      await closeScopedLocalConnectionPool(pool)
    } catch (error) {
      await transferScopedCleanupToInstance(pool.cleanupPending)
      closeError = error
    }
    if (runError && closeError) {
      throw new AggregateError([runError, closeError], "Scoped MCP projection failed and connection cleanup failed.")
    }
    if (runError) throw runError
    if (closeError) throw closeError
    return runResult as T
  }

  async function closeScopedLocalConnectionPool(pool: ScopedLocalConnectionPool): Promise<void> {
    const entries = [...pool.entries.values()]
    pool.entries.clear()
    const connectionResults = await Promise.allSettled(
      entries.map(async (entry) => entry.connection ?? (await entry.connecting)),
    )
    for (const result of connectionResults) {
      if (result.status === "fulfilled") pool.cleanupPending.add(result.value)
    }
    const closeResults = await Promise.allSettled(
      [...pool.cleanupPending].map(async (connection) => {
        await closeConnection(connection.key, connection)
        pool.cleanupPending.delete(connection)
      }),
    )
    const errors = [...connectionResults, ...closeResults].flatMap((result) =>
      result.status === "rejected" ? [result.reason] : [],
    )
    if (errors.length > 0) throw new AggregateError(errors, "Failed to close scoped MCP projection connections.")
  }

  function scopedLocalPoolKey(
    input: ScopedConnectionInput,
    options: Pick<CreateOptions, "skipToolListVerification">,
  ): string | undefined {
    if (input.mcp.type !== "local" || options.skipToolListVerification !== true) return undefined
    return JSON.stringify({
      processAuthority: input.processAuthority,
      command: input.mcp.command,
      cwd: input.cwd,
      environment: input.mcp.environment ?? {},
      globalTimeout: input.globalTimeout,
      timeout: input.mcp.timeout,
    })
  }

  async function acquireScopedLocalConnection(
    pool: ScopedLocalConnectionPool,
    poolKey: string,
    input: ScopedConnectionInput,
    options: Pick<CreateOptions, "skipToolListVerification">,
  ): Promise<ScopedLocalPoolLease> {
    const existing = pool.entries.get(poolKey)
    if (existing) {
      existing.active++
      const connection = existing.connection ?? (await existing.connecting)
      existing.connection = connection
      connection.lastUsedAt = Date.now()
      return { entry: existing, connection }
    }
    const connecting = createSafely(input.key, input.mcp, {
      processAuthority: input.processAuthority,
      cwd: input.cwd,
      authKey: false,
      globalTimeout: input.globalTimeout,
      onCleanupPending: (connection) => pool.cleanupPending.add(connection),
      ...options,
    }).then((result) => {
      if (!result.mcpConnection) {
        const status = result.status
        const detail = "error" in status ? `: ${status.error}` : `: ${status.status}`
        throw new Error(`Scoped MCP server ${input.key} did not connect${detail}`)
      }
      return result.mcpConnection
    })
    const entry: ScopedLocalPoolEntry = {
      connecting,
      active: 1,
    }
    pool.entries.set(poolKey, entry)
    try {
      const connection = await connecting
      entry.connection = connection
      connection.lastUsedAt = Date.now()
      return { entry, connection }
    } catch (error) {
      if (pool.entries.get(poolKey) === entry) pool.entries.delete(poolKey)
      throw error
    }
  }

  function releaseScopedLocalConnection(entry: ScopedLocalPoolEntry) {
    entry.active--
    if (entry.connection) entry.connection.lastUsedAt = Date.now()
  }

  type PendingOAuthFlow = {
    state: string
    revision: McpAuth.Revision
    correlationID: string
  }
  const pendingOAuthFlows = new Map<string, PendingOAuthFlow>()

  // Prompt cache types
  export type PromptInfo = Awaited<ReturnType<MCPClient["listPrompts"]>>["prompts"][number]
  export type GetPromptResult = Awaited<ReturnType<MCPClient["getPrompt"]>>

  export type ResourceInfo = Awaited<ReturnType<MCPClient["listResources"]>>["resources"][number]
  export type ReadResourceResult = Awaited<ReturnType<MCPClient["readResource"]>>
  type McpEntry = NonNullable<Config.Info["mcp"]>[string]
  export type RemoteMcpConfig = Extract<Config.Mcp, { type: "remote" }>
  function isMcpConfigured(entry: McpEntry | undefined): entry is Config.Mcp {
    return typeof entry === "object" && entry !== null && "type" in entry
  }
  function isMcpDisabledOverride(entry: McpEntry) {
    return (
      typeof entry === "object" &&
      entry !== null &&
      !("type" in entry) &&
      (entry as { enabled?: unknown }).enabled === false
    )
  }
  function builtinConfigForDisabledOverride(name: string, entry: McpEntry): Config.Mcp | undefined {
    if (!isMcpDisabledOverride(entry)) return
    if (name === BrowserMCPBuiltin.ServerName) return BrowserMCPBuiltin.localConfig()
  }

  function errorMessage(error: unknown) {
    return error instanceof Error ? error.message : String(error)
  }

  function credentialSafeErrorMessage(error: unknown, credentialSecret?: string) {
    const message = errorMessage(error)
    if (!credentialSecret) return message
    const formEncoded = new URLSearchParams({ credential: credentialSecret }).toString().slice("credential=".length)
    return [...new Set([credentialSecret, encodeURIComponent(credentialSecret), formEncoded])]
      .filter(Boolean)
      .reduce((safe, sensitive) => safe.replaceAll(sensitive, "[redacted]"), message)
  }

  function mcpNotFound(name: string) {
    return new NotFoundError({ message: `MCP server not found: ${name}` })
  }

  function mcpAuthKey(mcpName: string): string {
    return McpAuth.scopedKey({ projectID: Instance.project.id, mcpName })
  }

  function requireMcpEntry(config: NonNullable<Config.Info["mcp"]>, name: string): McpEntry {
    const entry = config[name]
    if (!entry) throw mcpNotFound(name)
    return entry
  }

  export function effectiveTimeout(mcp?: Config.Mcp, globalTimeout?: number): number {
    return mcp?.timeout ?? globalTimeout ?? DEFAULT_TIMEOUT
  }

  export function mcpRequestOptions(timeout: number): RequestOptions {
    return {
      resetTimeoutOnProgress: true,
      timeout,
    }
  }

  function terminalTaskStatus(status: PermissionAuthority.McpTask["status"]): boolean {
    return status === "completed" || status === "failed" || status === "cancelled"
  }

  async function recoverMcpTask(
    client: MCPClient,
    task: PermissionAuthority.McpTask,
    timeout: number,
    signal?: AbortSignal,
  ): Promise<CallToolResult> {
    let current = task
    while (!terminalTaskStatus(current.status)) {
      if (current.status === "input_required") {
        return CallToolResultSchema.parse(
          await client.experimental.tasks.getTaskResult(current.taskId, CallToolResultSchema, {
            ...mcpRequestOptions(timeout),
            signal,
          }),
        )
      }
      const pollInterval = current.pollInterval ?? 1_000
      await new Promise<void>((resolve, reject) => {
        const finish = () => {
          if (signal) signal.removeEventListener("abort", aborted)
          resolve()
        }
        const timer = setTimeout(finish, pollInterval)
        const aborted = () => {
          clearTimeout(timer)
          reject(signal?.reason ?? new Error("MCP task recovery was aborted"))
        }
        if (signal?.aborted) aborted()
        else signal?.addEventListener("abort", aborted, { once: true })
      })
      current = PermissionAuthority.recordMcpTask(
        await client.experimental.tasks.getTask(current.taskId, { ...mcpRequestOptions(timeout), signal }),
      )
    }
    if (current.status === "completed") {
      return CallToolResultSchema.parse(
        await client.experimental.tasks.getTaskResult(current.taskId, CallToolResultSchema, {
          ...mcpRequestOptions(timeout),
          signal,
        }),
      )
    }
    throw new Error(
      `MCP task ${current.taskId} ended as ${current.status}: ${current.statusMessage ?? "no status message"}`,
    )
  }

  /** Execute one MCP Tool only from inside PermissionAuthority, resuming its protocol Task when present. */
  export async function callToolWithTaskRecovery(input: {
    client: MCPClient
    tool: MCPToolDef
    args: Record<string, unknown>
    timeout: number
    signal?: AbortSignal
  }): Promise<CallToolResult> {
    const execution = PermissionAuthority.requireMcpExecutionContext()
    if (execution.task) return recoverMcpTask(input.client, execution.task, input.timeout, input.signal)
    const params = { name: input.tool.name, arguments: input.args }
    const taskSupport = input.tool.execution?.taskSupport
    if (taskSupport !== "optional" && taskSupport !== "required") {
      return CallToolResultSchema.parse(
        await input.client.callTool(params, CallToolResultSchema, {
          ...mcpRequestOptions(input.timeout),
          signal: input.signal,
        }),
      )
    }
    const stream = input.client.experimental.tasks.callToolStream(params, CallToolResultSchema, {
      ...mcpRequestOptions(input.timeout),
      signal: input.signal,
      task: {},
    })
    for await (const message of stream) {
      if (message.type === "taskCreated" || message.type === "taskStatus") {
        PermissionAuthority.recordMcpTask(message.task)
        continue
      }
      if (message.type === "result") return CallToolResultSchema.parse(message.result)
      throw message.error
    }
    throw new Error(`MCP task Tool ${input.tool.name} ended without a result`)
  }

  export function mcpFetchRequestInit(timeout: number): RequestInit {
    return { signal: AbortSignal.timeout(timeout) }
  }

  function unsupportedRemoteTransport(transport: never): never {
    throw new Error(`Unsupported remote MCP transport: ${String(transport)}`)
  }

  export function materializeRemoteRequest(mcp: RemoteMcpConfig, requestInit?: RequestInit, credentialSecret?: string) {
    const headers = new Headers(requestInit?.headers)
    let hasHeaders = requestInit?.headers !== undefined
    for (const [name, value] of Object.entries(mcp.headers ?? {})) {
      headers.set(name, value)
      hasHeaders = true
    }
    const url = new URL(mcp.url)
    if (mcp.credential) {
      if (!credentialSecret) throw new Error("MCP static credential is not configured")
      switch (mcp.credential.type) {
        case "query":
          url.searchParams.set(mcp.credential.name, credentialSecret)
          break
        case "bearer":
          headers.set("Authorization", `Bearer ${credentialSecret}`)
          hasHeaders = true
          break
        case "header":
          headers.set(mcp.credential.name, credentialSecret)
          hasHeaders = true
          break
      }
    }
    const materializedRequestInit =
      requestInit || hasHeaders ? { ...requestInit, ...(hasHeaders ? { headers } : {}) } : undefined
    return { url, requestInit: materializedRequestInit }
  }

  export function createRemoteTransport(
    mcp: RemoteMcpConfig,
    authProvider?: McpOAuthProvider,
    requestInit?: RequestInit,
    credentialSecret?: string,
  ) {
    const materialized = materializeRemoteRequest(mcp, requestInit, credentialSecret)
    const options = {
      authProvider,
      requestInit: materialized.requestInit,
    }
    switch (mcp.transport) {
      case "sse":
        return {
          name: "SSE",
          transport: new SSEClientTransport(materialized.url, options),
        }
      case "streamable-http":
        return {
          name: "StreamableHTTP",
          transport: new StreamableHTTPClientTransport(materialized.url, options),
        }
    }
    return unsupportedRemoteTransport(mcp.transport)
  }

  function supervisorStreamClosed(stream: NodeJS.ReadableStream | NodeJS.WritableStream | null): boolean {
    if (!stream) return true
    const state = stream as {
      closed?: boolean
      destroyed?: boolean
    }
    return Boolean(state.closed || state.destroyed)
  }

  async function waitForSupervisorStreamClose(
    stream: NodeJS.ReadableStream | NodeJS.WritableStream | null,
    label: string,
  ) {
    if (supervisorStreamClosed(stream)) return
    await ProcessSupervisor.awaitWithTimeout(
      new Promise<void>((resolve) => {
        stream?.once("close", () => resolve())
      }),
      ProcessSupervisor.TERMINATION_EXIT_TIMEOUT_MS,
      `${label} did not close after process exit`,
    )
  }

  class SupervisedStdioClientTransport implements Transport {
    private readBuffer = new ReadBuffer()
    private handle?: ProcessSupervisor.Handle
    private lastHandle?: ProcessSupervisor.Handle
    private closePromise?: Promise<void>
    private exitObserved?: Promise<void>
    private stderrStream: PassThrough | Stream | null = null

    onclose?: () => void
    onerror?: (error: Error) => void
    onmessage?: (message: JSONRPCMessage) => void

    constructor(
      private readonly server: StdioServerParameters,
      private readonly processAuthority: ProcessAuthority,
    ) {
      if (server.stderr === "pipe" || server.stderr === "overlapped") {
        this.stderrStream = new PassThrough()
      } else if (server.stderr && typeof server.stderr === "object") {
        this.stderrStream = server.stderr
      }
    }

    get stderr(): Stream | null {
      return this.stderrStream
    }

    get pid(): number | null {
      return this.handle?.pid ?? null
    }

    async start(): Promise<void> {
      if (this.handle) throw new Error("SupervisedStdioClientTransport already started.")
      const command = {
        executable: this.server.command,
        args: this.server.args ?? [],
        cwd: this.server.cwd,
        env: {
          ...getDefaultEnvironment(),
          ...this.server.env,
        },
        stdin: "pipe" as const,
        owner: "mcp-stdio",
      }
      const handle =
        this.processAuthority.kind === "task"
          ? await ProcessSupervisor.spawnTaskCommand(
              { taskID: this.processAuthority.taskID, cwd: this.processAuthority.cwd },
              command,
            )
          : await ProcessSupervisor.spawnHostCommand({ ...command, cwd: this.processAuthority.cwd })
      this.handle = handle
      this.lastHandle = handle
      handle.stdout?.on("data", (chunk: Buffer) => {
        this.readBuffer.append(chunk)
        this.processReadBuffer()
      })
      handle.stdout?.on("error", (error) => {
        this.onerror?.(error)
      })
      handle.stderr?.on("data", (chunk: Buffer) => {
        if (writableSupervisorStream(this.stderrStream)) {
          this.stderrStream.write(chunk)
        } else if (this.server.stderr === undefined || this.server.stderr === "inherit") {
          process.stderr.write(chunk)
        }
      })
      handle.stderr?.on("error", (error) => {
        this.onerror?.(error)
      })
      this.exitObserved = handle.exited
        .then(
          () => undefined,
          (error) => {
            this.onerror?.(error instanceof Error ? error : new Error(String(error)))
          },
        )
        .finally(() => {
          if (this.handle === handle) this.handle = undefined
          if (this.stderrStream instanceof PassThrough) this.stderrStream.end()
          this.onclose?.()
        })
    }

    private processReadBuffer() {
      while (true) {
        try {
          const message = this.readBuffer.readMessage()
          if (message === null) break
          this.onmessage?.(message)
        } catch (error) {
          this.onerror?.(error instanceof Error ? error : new Error(String(error)))
        }
      }
    }

    async close(): Promise<void> {
      this.closePromise ??= this.closeOnce()
      await this.closePromise
    }

    private async closeOnce(): Promise<void> {
      const handle = this.handle ?? this.lastHandle
      this.handle = undefined
      this.readBuffer.clear()
      if (!handle) return
      try {
        handle.stdin?.end()
      } catch {
        // The MCP process may have already exited after a startup failure.
      }
      const exitedGracefully = await ProcessSupervisor.awaitWithTimeout(
        handle.exited.then(() => true),
        STDIO_GRACEFUL_CLOSE_TIMEOUT_MS,
        `MCP stdio process ${handle.pid} did not exit after stdin close`,
      ).catch(() => false)
      let disposed = false
      if (!exitedGracefully) {
        await ProcessSupervisor.disposeAndWaitForExit(handle, `MCP stdio process ${handle.pid}`)
        disposed = true
      }
      await this.exitObserved
      if (!disposed) {
        await ProcessSupervisor.disposeAndWaitForExit(handle, `MCP stdio process ${handle.pid}`)
      }
      await Promise.all([
        waitForSupervisorStreamClose(handle.stdin, `MCP stdio process ${handle.pid} stdin`),
        waitForSupervisorStreamClose(handle.stdout, `MCP stdio process ${handle.pid} stdout`),
        waitForSupervisorStreamClose(handle.stderr, `MCP stdio process ${handle.pid} stderr`),
      ])
      await settleClosedProcessHandle()
    }

    send(message: JSONRPCMessage): Promise<void> {
      return new Promise((resolve) => {
        const stdin = this.handle?.stdin
        if (!stdin) throw new Error("Not connected")
        const payload = serializeMessage(message)
        if (stdin.write(payload)) {
          resolve()
        } else {
          stdin.once("drain", resolve)
        }
      })
    }
  }

  type McpState = {
    projectID: string
    status: Record<string, Status>
    statusIdentity: Record<string, string | undefined>
    clients: Record<string, MCPClient>
    connections: Record<string, McpConnection>
    connecting: Record<string, Promise<void> | undefined>
    connectingIdentity: Record<string, string | undefined>
    durableIdentity: Record<string, string | undefined>
    durableGeneration: Record<string, number | undefined>
    connectionAttempts: Set<Promise<void>>
    cleanupPending: Set<string>
    connectionCleanupPending: Map<string, Set<McpConnection>>
    scopedOwners: Set<ScopedConnectionOwnerState>
    reconcilePending: Set<string>
    runtimeConnectionOverrides: Record<string, { ownerIdentity: string; ownerGeneration: number; config: Config.Mcp }>
    runtimeControlTails: Map<string, Promise<void>>
  }

  type ClosableTransport = { close: () => Promise<void> | void }
  type StdioStream = {
    closed?: boolean
    destroyed?: boolean
    once(event: "close", listener: () => void): unknown
  }
  type WritableSupervisorStream = Stream & {
    write(chunk: Buffer): boolean
  }
  function writableSupervisorStream(stream: PassThrough | Stream | null): stream is WritableSupervisorStream {
    return !!stream && typeof (stream as WritableSupervisorStream).write === "function"
  }
  type StdioChildProcess = {
    pid?: number
    exitCode: number | null
    signalCode?: NodeJS.Signals | null
    stdin?: StdioStream | null
    stdout?: StdioStream | null
    stderr?: StdioStream | null
    once(event: "close", listener: () => void): unknown
  }
  type ClosableTransportWithStdioProcess = ClosableTransport & {
    _process?: StdioChildProcess
    __opencorvusProcessToClose?: StdioChildProcess
    start?: () => Promise<void>
  }
  const closedStdioProcesses = new WeakSet<StdioChildProcess>()

  type McpConnection = {
    key: string
    type: Config.Mcp["type"]
    client: MCPClient
    tools: MCPToolDef[]
    transport?: ClosableTransport
    command?: string[]
    cwd?: string
    createdAt: number
    lastUsedAt: number
    sharedProjectScoped: boolean
    configIdentity: string
    ownerGeneration?: number
  }
  const connectionCleanupAttempts = new WeakMap<McpConnection, Promise<void>>()
  const intentionalConnectionClosures = new WeakSet<McpConnection>()

  function publishRuntimeConnection(
    state: McpState,
    name: string,
    connection: McpConnection,
    status: Status,
    statusIdentity: string,
  ) {
    state.connections[name] = connection
    state.clients[name] = connection.client
    state.status[name] = status
    state.statusIdentity[name] = statusIdentity
    connection.client.onclose = () => {
      if (intentionalConnectionClosures.has(connection)) return
      if (state.connections[name] !== connection || state.durableGeneration[name] !== connection.ownerGeneration) {
        return
      }
      delete state.connections[name]
      if (state.clients[name] === connection.client) delete state.clients[name]
      state.status[name] = { status: "disconnected" }
      state.statusIdentity[name] = connection.configIdentity
      queueConnectionCleanup(state, name, connection)
      void settleConnectionCleanup(state, name, connection).catch((error) => {
        log.warn("MCP unexpected-close cleanup failed", {
          name,
          type: connection.type,
          error: errorMessage(error),
        })
      })
      log.warn("MCP transport closed unexpectedly", {
        name,
        type: connection.type,
      })
    }
  }

  class McpCreateCleanupError extends Error {
    constructor(
      readonly connection: McpConnection,
      readonly status: Status,
      readonly cleanupError: unknown,
    ) {
      super(`MCP connection startup failed and cleanup did not settle: ${errorMessage(cleanupError)}`, {
        cause: cleanupError,
      })
      this.name = "McpCreateCleanupError"
    }
  }

  function cleanupConnection(
    key: string,
    mcp: Config.Mcp,
    client: MCPClient | undefined,
    transport: ClosableTransport | undefined,
    cwd?: string,
  ): McpConnection {
    const cleanupClient =
      client ??
      ({
        close: async () => {},
      } as MCPClient)
    return {
      key,
      type: mcp.type,
      client: cleanupClient,
      tools: [],
      transport,
      command: mcp.type === "local" ? mcp.command : undefined,
      cwd,
      createdAt: Date.now(),
      lastUsedAt: Date.now(),
      sharedProjectScoped: false,
      configIdentity: mcpConfigIdentity(mcp),
    }
  }

  function canonicalConfigValue(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(canonicalConfigValue)
    if (!value || typeof value !== "object") return value
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalConfigValue(item)]),
    )
  }

  function mcpConfigIdentity(mcp: McpEntry) {
    if (!isMcpConfigured(mcp)) return JSON.stringify(canonicalConfigValue(mcp))
    return JSON.stringify(canonicalConfigValue({ ...mcp, enabled: mcp.enabled !== false }))
  }

  function mcpConfigDigest(mcp: McpEntry) {
    return createHash("sha256").update(mcpConfigIdentity(mcp)).digest("hex")
  }

  interface CreateOptions {
    processAuthority: ProcessAuthority
    cwd?: string
    authKey?: string | false
    globalTimeout?: number
    skipToolListVerification?: boolean
    onCleanupPending?: (connection: McpConnection) => void
  }

  function stdioProcessForTransport(transport: ClosableTransport): StdioChildProcess | undefined {
    const tracked = transport as ClosableTransportWithStdioProcess
    return tracked.__opencorvusProcessToClose ?? tracked._process
  }

  function stdioProcessHasExited(processToClose: StdioChildProcess | undefined) {
    return !processToClose || processToClose.exitCode !== null || processToClose.signalCode !== null
  }

  function stdioProcessHasClosed(processToClose: StdioChildProcess | undefined) {
    return !processToClose || closedStdioProcesses.has(processToClose)
  }

  function trackStdioProcessClose(processToClose: StdioChildProcess | undefined) {
    if (!processToClose || stdioProcessHasClosed(processToClose)) return
    processToClose.once("close", () => {
      closedStdioProcesses.add(processToClose)
    })
  }

  function trackStdioTransportProcess<T extends ClosableTransport>(transport: T): T {
    const tracked = transport as ClosableTransportWithStdioProcess
    const originalStart = tracked.start?.bind(transport)
    if (originalStart) {
      tracked.start = async () => {
        try {
          await originalStart()
        } finally {
          if (tracked._process) {
            tracked.__opencorvusProcessToClose = tracked._process
            trackStdioProcessClose(tracked._process)
          }
        }
      }
    }
    const originalClose = tracked.close.bind(transport)
    let closePromise: Promise<void> | undefined
    tracked.close = async () => {
      if (tracked._process) tracked.__opencorvusProcessToClose = tracked._process
      closePromise ??= Promise.resolve(originalClose())
      await closePromise
    }
    return transport
  }

  async function terminateStdioProcessTree(processToClose: StdioChildProcess | undefined, label: string) {
    if (!processToClose?.pid || stdioProcessHasExited(processToClose)) return
    await ProcessSupervisor.terminateProcessTree(processToClose.pid, `${label} process tree ${processToClose.pid}`)
  }

  async function waitForStdioProcessClose(processToClose: StdioChildProcess | undefined): Promise<boolean> {
    if (stdioProcessHasClosed(processToClose)) return true
    try {
      await ProcessSupervisor.awaitWithTimeout(
        new Promise<void>((resolve) => {
          processToClose?.once("close", () => resolve())
        }),
        ProcessSupervisor.TERMINATION_EXIT_TIMEOUT_MS,
        `MCP stdio process ${processToClose?.pid ?? "unknown"} did not close after transport cleanup`,
      )
      return true
    } catch {
      return stdioProcessHasClosed(processToClose)
    }
  }

  async function waitForStdioStreamClose(stream: StdioStream | null | undefined) {
    if (stream && !stream.closed && !stream.destroyed) {
      await ProcessSupervisor.awaitWithTimeout(
        new Promise<void>((resolve) => {
          stream.once("close", () => resolve())
        }),
        ProcessSupervisor.TERMINATION_EXIT_TIMEOUT_MS,
        "MCP stdio stream did not close after transport cleanup",
      )
    }
  }

  async function waitForStdioStreamsClosed(processToClose: StdioChildProcess | undefined) {
    if (!processToClose) return
    await Promise.all([
      waitForStdioStreamClose(processToClose.stdin),
      waitForStdioStreamClose(processToClose.stdout),
      waitForStdioStreamClose(processToClose.stderr),
    ])
  }

  async function settleClosedProcessHandle() {
    await new Promise<void>((resolve) => setImmediate(resolve))
    await new Promise<void>((resolve) => setTimeout(resolve, 0))
  }

  async function closeTransport(
    name: string,
    transport: ClosableTransport,
    processToClose: StdioChildProcess | undefined = stdioProcessForTransport(transport),
  ) {
    let closeError: unknown
    try {
      await Promise.resolve(transport.close())
    } catch (error) {
      closeError = error
    }
    const processAfterClose = processToClose ?? stdioProcessForTransport(transport)
    if (!processAfterClose && closeError) throw closeError
    const processClosedAfterClose = await waitForStdioProcessClose(processAfterClose)
    if (!processClosedAfterClose && !stdioProcessHasExited(processAfterClose)) {
      await terminateStdioProcessTree(processAfterClose, "MCP stdio transport")
    }
    const processClosedAfterTerminate = await waitForStdioProcessClose(processAfterClose)
    if (!processClosedAfterTerminate) {
      throw new Error(`MCP stdio process ${processAfterClose?.pid ?? "unknown"} did not close after transport cleanup`)
    }
    await waitForStdioStreamsClosed(processAfterClose)
    await settleClosedProcessHandle()
    if (closeError) {
      log.warn("MCP transport close reported an error after the stdio process was proven closed", {
        name,
        error: closeError,
      })
    }
  }

  async function closeConnection(name: string, connection: McpConnection | undefined) {
    if (!connection) return
    intentionalConnectionClosures.add(connection)
    const processToClose = connection.transport ? stdioProcessForTransport(connection.transport) : undefined
    let clientCloseError: unknown
    try {
      await connection.client.close()
    } catch (error) {
      clientCloseError = error
    }
    if (connection.transport) {
      await closeTransport(name, connection.transport, processToClose)
      if (clientCloseError) {
        log.warn("MCP client close reported an error after its transport was proven closed", {
          name,
          error: clientCloseError,
        })
      }
      return
    }
    if (clientCloseError) throw clientCloseError
  }

  async function rejectReplacementAfterCloseFailure(
    state: McpState,
    name: string,
    replacement: McpConnection | undefined,
    closeError: unknown,
  ): Promise<never> {
    try {
      await closeOrQueueUnpublished(state, name, replacement)
    } catch (replacementError) {
      throw new AggregateError(
        [closeError, replacementError],
        `MCP server ${name} failed to close both the prior and unpublished replacement connections`,
      )
    }
    throw closeError
  }

  async function closeOrQueueUnpublished(state: McpState, name: string, connection: McpConnection | undefined) {
    try {
      await closeConnection(name, connection)
    } catch (error) {
      queueConnectionCleanup(state, name, connection)
      throw error
    }
  }

  async function closeClientAndTransport(
    name: string,
    client: Client | undefined,
    transport: ClosableTransport | undefined,
  ) {
    const processToClose = transport ? stdioProcessForTransport(transport) : undefined
    let clientCloseError: unknown
    try {
      await client?.close()
    } catch (error) {
      clientCloseError = error
    }
    if (transport) {
      await closeTransport(name, transport, processToClose)
      if (clientCloseError) {
        log.warn("MCP client close reported an error after its transport was proven closed", {
          name,
          error: clientCloseError,
        })
      }
      return
    }
    if (clientCloseError) throw clientCloseError
  }

  async function createSafely(key: string, mcp: Config.Mcp, options: CreateOptions) {
    try {
      return await create(key, mcp, options)
    } catch (error) {
      if (error instanceof McpCreateCleanupError) {
        options.onCleanupPending?.(error.connection)
        log.error("mcp startup failed and cleanup remains pending", {
          key,
          type: mcp.type,
          error: errorMessage(error.cleanupError),
        })
        return {
          mcpClient: undefined,
          mcpConnection: undefined,
          status: error.status,
        }
      }
      const message = errorMessage(error)
      log.error("mcp startup failed before status was available", {
        key,
        type: mcp.type,
        error: message,
      })
      return {
        mcpClient: undefined,
        mcpConnection: undefined,
        status: {
          status: "failed" as const,
          error: message,
        },
      }
    }
  }

  const state = createInstanceState(
    async () => {
      // A configure that died between its definition commit and its promotion
      // left a staged secret; settling it here is what makes startup — not an
      // arbitrary later config commit — the crash owner, and it runs before
      // any status or connection is projected from the configuration below.
      await settleStagedCredentials({
        projectAuthPrefix: `${Instance.project.id}:`,
        definitions: ((await Config.getProject()).mcp ?? {}) as NonNullable<Config.Info["mcp"]>,
      })
      const cfg = await Config.get()
      const config = (cfg.mcp ?? {}) as NonNullable<Config.Info["mcp"]>
      const clients: Record<string, MCPClient> = {}
      const connections: Record<string, McpConnection> = {}
      const status: Record<string, Status> = {}
      const statusIdentity: Record<string, string | undefined> = {}
      const connecting: Record<string, Promise<void> | undefined> = {}
      const connectingIdentity: Record<string, string | undefined> = {}
      const durableIdentity: Record<string, string | undefined> = {}
      const durableGeneration: Record<string, number | undefined> = {}
      const connectionAttempts = new Set<Promise<void>>()
      const cleanupPending = new Set<string>()
      const connectionCleanupPending = new Map<string, Set<McpConnection>>()
      const scopedOwners = new Set<ScopedConnectionOwnerState>()
      const reconcilePending = new Set<string>()
      const runtimeConnectionOverrides: McpState["runtimeConnectionOverrides"] = {}
      const runtimeControlTails = new Map<string, Promise<void>>()

      for (const [key, mcp] of entries(config)) {
        durableIdentity[key] = mcpConfigIdentity(mcp)
        durableGeneration[key] = 1
        if (isMcpDisabledOverride(mcp)) {
          status[key] = { status: "disabled" }
          statusIdentity[key] = mcpConfigIdentity(mcp)
          continue
        }
        if (!isMcpConfigured(mcp)) {
          log.error("Ignoring MCP config entry without type", { key })
          continue
        }

        status[key] = mcp.enabled === false ? { status: "disabled" } : { status: "disconnected" }
        statusIdentity[key] = mcpConfigIdentity(mcp)
      }
      const snapshot = {
        projectID: Instance.project.id,
        status,
        statusIdentity,
        clients,
        connections,
        connecting,
        connectingIdentity,
        durableIdentity,
        durableGeneration,
        connectionAttempts,
        cleanupPending,
        connectionCleanupPending,
        scopedOwners,
        reconcilePending,
        runtimeConnectionOverrides,
        runtimeControlTails,
      }
      return snapshot
    },
    async (state) => {
      const connecting = [...state.connectionAttempts]
      const settledConnections = await Promise.allSettled(connecting)
      await Promise.all([...state.scopedOwners].map((owner) => owner.close?.()))
      for (const key of Object.keys(state.connecting)) delete state.connecting[key]
      for (const key of Object.keys(state.connectingIdentity)) delete state.connectingIdentity[key]
      const connections = new Set([
        ...objectValues(state.connections),
        ...[...state.connectionCleanupPending.values()].flatMap((pending) => [...pending]),
      ])
      await Promise.all([...connections].map((connection) => closeConnection(connection.key, connection)))
      for (const key of Object.keys(state.connections)) delete state.connections[key]
      for (const key of Object.keys(state.clients)) delete state.clients[key]
      const projectAuthPrefix = `${state.projectID}:`
      for (const authKey of pendingOAuthFlows.keys()) {
        if (authKey.startsWith(projectAuthPrefix)) pendingOAuthFlows.delete(authKey)
      }
      const connectionError = settledConnections.find(
        (result): result is PromiseRejectedResult => result.status === "rejected",
      )
      if (connectionError) throw connectionError.reason
    },
    "mcp",
  )

  function startConnection(
    state: McpState,
    key: string,
    mcp: Config.Mcp,
    independent = false,
    ownerIdentity = mcpConfigIdentity(mcp),
    ownerGeneration = state.durableGeneration[key],
  ) {
    const identity = mcpConfigIdentity(mcp)
    if (state.connecting[key]) return state.connecting[key]
    state.status[key] = { status: "connecting" }
    state.statusIdentity[key] = identity
    state.connectingIdentity[key] = identity
    const directory = Instance.directory

    let connection!: Promise<void>
    const run = async () => {
      await new Promise<void>((resolve) => setTimeout(resolve, 0))
      const result = await createSafely(key, mcp, {
        processAuthority: { kind: "host", cwd: directory },
        onCleanupPending: (cleanup) => {
          cleanup.ownerGeneration = ownerGeneration
          queueConnectionCleanup(state, key, cleanup)
        },
      })
      if (
        state.connecting[key] !== connection ||
        state.connectingIdentity[key] !== identity ||
        state.durableIdentity[key] !== ownerIdentity ||
        state.durableGeneration[key] !== ownerGeneration
      ) {
        await closeOrQueueUnpublished(state, key, result.mcpConnection)
        return
      }
      const existingConnection = state.connections[key]
      if (existingConnection && existingConnection !== result.mcpConnection) {
        try {
          await closeConnection(key, existingConnection)
        } catch (error) {
          await rejectReplacementAfterCloseFailure(state, key, result.mcpConnection, error)
        }
      }
      if (
        state.connecting[key] !== connection ||
        state.connectingIdentity[key] !== identity ||
        state.durableIdentity[key] !== ownerIdentity ||
        state.durableGeneration[key] !== ownerGeneration ||
        state.connections[key] !== existingConnection
      ) {
        await closeOrQueueUnpublished(state, key, result.mcpConnection)
        return
      }
      state.status[key] = result.status
      state.statusIdentity[key] = identity
      if (result.mcpConnection) {
        result.mcpConnection.ownerGeneration = ownerGeneration
        publishRuntimeConnection(state, key, result.mcpConnection, result.status, identity)
      } else {
        delete state.connections[key]
        delete state.clients[key]
      }
    }
    const started = independent ? runWithIndependentProjectIdentity({ directory, fn: run }) : run()
    connection = started.finally(() => {
      state.connectionAttempts.delete(connection)
      if (state.connecting[key] === connection) {
        delete state.connecting[key]
        delete state.connectingIdentity[key]
      }
    })
    state.connecting[key] = connection
    state.connectionAttempts.add(connection)
    return connection
  }

  function effectiveRuntimeMcp(state: McpState, key: string, configured: McpEntry): McpEntry
  function effectiveRuntimeMcp(state: McpState, key: string, configured: undefined): undefined
  function effectiveRuntimeMcp(state: McpState, key: string, configured: McpEntry | undefined): McpEntry | undefined
  function effectiveRuntimeMcp(state: McpState, key: string, configured: McpEntry | undefined): McpEntry | undefined {
    if (!configured) return
    const configuredIdentity = mcpConfigIdentity(configured)
    const override = state.runtimeConnectionOverrides[key]
    if (
      override &&
      (override.ownerIdentity !== configuredIdentity || override.ownerGeneration !== state.durableGeneration[key])
    )
      return configured
    return override?.config ?? configured
  }

  function exactConnectedRuntime(state: McpState, key: string, configured: McpEntry | undefined) {
    const mcp = effectiveRuntimeMcp(state, key, configured)
    if (!isMcpConfigured(mcp) || mcp.enabled === false) return
    const identity = mcpConfigIdentity(mcp)
    const connection = state.connections[key]
    const client = state.clients[key]
    if (
      state.status[key]?.status !== "connected" ||
      state.statusIdentity[key] !== identity ||
      connection?.configIdentity !== identity ||
      connection.ownerGeneration !== state.durableGeneration[key] ||
      client !== connection.client
    )
      return
    return { client, connection, mcp }
  }

  async function withRuntimeControl<T>(state: McpState, name: string, run: () => Promise<T>): Promise<T> {
    const previous = state.runtimeControlTails.get(name) ?? Promise.resolve()
    let finish!: () => void
    const turn = new Promise<void>((resolve) => {
      finish = resolve
    })
    const tail = previous.then(() => turn)
    state.runtimeControlTails.set(name, tail)
    await previous
    try {
      return await run()
    } finally {
      finish()
      if (state.runtimeControlTails.get(name) === tail) state.runtimeControlTails.delete(name)
    }
  }

  async function ensureConfiguredConnections(
    state: McpState,
    config: NonNullable<Config.Info["mcp"]>,
    assertSucceeded = true,
    waitForStarted = true,
    independent = false,
  ) {
    const tasks: Promise<void>[] = []
    for (const [key, configuredMcp] of entries(config)) {
      const configuredIdentity = mcpConfigIdentity(configuredMcp)
      if (state.durableIdentity[key] !== configuredIdentity) continue
      const mcp = effectiveRuntimeMcp(state, key, configuredMcp)
      const activeOverride = state.runtimeConnectionOverrides[key]
      const runtimeOwnerIdentity =
        activeOverride?.ownerIdentity === configuredIdentity ? activeOverride.ownerIdentity : undefined
      const runtimeOwnerGeneration =
        activeOverride?.ownerIdentity === configuredIdentity &&
        activeOverride.ownerGeneration === state.durableGeneration[key]
          ? activeOverride.ownerGeneration
          : state.durableGeneration[key]
      if (!isMcpConfigured(mcp)) continue
      const identity = mcpConfigIdentity(mcp)
      const pending = state.connecting[key]
      if (pending && state.connectingIdentity[key] !== identity) {
        delete state.connecting[key]
        delete state.connectingIdentity[key]
      }
      const existing = state.connections[key]
      if (
        existing &&
        (existing.configIdentity !== identity || existing.ownerGeneration !== state.durableGeneration[key])
      ) {
        await closeConnection(key, existing)
        if (state.connections[key] === existing) {
          delete state.connections[key]
          delete state.clients[key]
        } else {
          continue
        }
        if (state.durableIdentity[key] !== configuredIdentity) continue
      }
      if (mcp.enabled === false) {
        if (state.connecting[key]) {
          delete state.connecting[key]
          delete state.connectingIdentity[key]
        }
        const disabledConnection = state.connections[key]
        await closeConnection(key, disabledConnection)
        if (state.connections[key] === disabledConnection) {
          delete state.connections[key]
          delete state.clients[key]
        } else {
          continue
        }
        if (state.durableIdentity[key] !== configuredIdentity) continue
        state.status[key] = { status: "disabled" }
        state.statusIdentity[key] = identity
        continue
      }
      if (
        state.statusIdentity[key] !== identity ||
        (state.status[key]?.status === "connected" &&
          (state.connections[key]?.configIdentity !== identity ||
            state.connections[key]?.ownerGeneration !== state.durableGeneration[key])) ||
        (state.status[key]?.status === "connecting" &&
          (!state.connecting[key] || state.connectingIdentity[key] !== identity))
      ) {
        state.status[key] = { status: "disconnected" }
        state.statusIdentity[key] = identity
      }
      if (state.status[key]?.status === "connected") continue
      if (
        state.status[key]?.status === "connecting" &&
        state.connecting[key] &&
        state.connectingIdentity[key] === identity
      ) {
        tasks.push(state.connecting[key])
        continue
      }
      if (state.status[key]?.status !== "disconnected") continue
      tasks.push(
        startConnection(
          state,
          key,
          mcp,
          independent,
          runtimeOwnerIdentity ?? configuredIdentity,
          runtimeOwnerGeneration,
        ),
      )
    }
    if (waitForStarted) await Promise.all(tasks)
    if (assertSucceeded && waitForStarted) assertConfiguredConnectionsSucceeded(state, config)
  }

  function assertConfiguredConnectionsSucceeded(state: McpState, config: NonNullable<Config.Info["mcp"]>) {
    for (const [key, configuredMcp] of entries(config)) {
      if (state.durableIdentity[key] !== mcpConfigIdentity(configuredMcp)) continue
      const mcp = effectiveRuntimeMcp(state, key, configuredMcp)
      if (!isMcpConfigured(mcp) || mcp.enabled === false) continue
      if (state.statusIdentity[key] !== mcpConfigIdentity(mcp)) continue
      const status = state.status[key]
      if (status?.status !== "failed") continue
      throw new Error(`MCP server ${key} failed to connect: ${status.error}`)
    }
  }

  async function markClientListFailure(
    state: McpState,
    clientName: string,
    label: "tools" | "prompts" | "resources",
    error: unknown,
    expectedConnection?: McpConnection,
  ): Promise<Status> {
    const message = errorMessage(error)
    log.error(`failed to get ${label}`, { clientName, error: message })
    const connection = state.connections[clientName]
    if (expectedConnection && connection !== expectedConnection) {
      return state.status[clientName] ?? { status: "disconnected" }
    }
    const status = {
      status: "failed" as const,
      error: message,
    }
    state.status[clientName] = status
    queueConnectionCleanup(state, clientName, connection)
    try {
      if (connection) await settleConnectionCleanup(state, clientName, connection)
    } catch (cleanupError) {
      log.warn(`failed to close ${clientName} after its ${label} projection failed; queued exact cleanup`, {
        clientName,
        error: errorMessage(cleanupError),
      })
      return status
    }
    return status
  }

  async function failClientList(
    state: McpState,
    clientName: string,
    label: "tools" | "prompts" | "resources",
    error: unknown,
    expectedConnection?: McpConnection,
  ): Promise<never> {
    await markClientListFailure(state, clientName, label, error, expectedConnection)
    throw error
  }

  // Helper function to fetch prompts for a specific client
  async function fetchPromptsForClient(
    state: McpState,
    clientName: string,
    client: Client,
    timeout: number,
    connection?: McpConnection,
  ) {
    if (!client.getServerCapabilities()?.prompts) return {}
    let prompts: Awaited<ReturnType<Client["listPrompts"]>>
    try {
      prompts = await client.listPrompts(undefined, mcpRequestOptions(timeout))
    } catch (error) {
      return failClientList(state, clientName, "prompts", error, connection)
    }

    const commands: Record<string, PromptInfo & { client: string }> = {}

    for (const prompt of prompts.prompts) {
      const sanitizedClientName = clientName.replace(/[^a-zA-Z0-9_-]/g, "_")
      const sanitizedPromptName = prompt.name.replace(/[^a-zA-Z0-9_-]/g, "_")
      const key = sanitizedClientName + ":" + sanitizedPromptName

      commands[key] = { ...prompt, client: clientName }
    }
    return commands
  }

  async function fetchResourcesForClient(
    state: McpState,
    clientName: string,
    client: Client,
    timeout: number,
    connection?: McpConnection,
  ) {
    if (!client.getServerCapabilities()?.resources) return {}
    let resources: Awaited<ReturnType<Client["listResources"]>>
    try {
      resources = await client.listResources(undefined, mcpRequestOptions(timeout))
    } catch (error) {
      return failClientList(state, clientName, "resources", error, connection)
    }

    const commands: Record<string, ResourceInfo & { client: string }> = {}

    for (const resource of resources.resources) {
      const encodedClientName = Buffer.from(clientName, "utf8").toString("base64url")
      const encodedResourceURI = Buffer.from(resource.uri, "utf8").toString("base64url")
      const key = "client:" + encodedClientName + ":uri:" + encodedResourceURI

      commands[key] = { ...resource, client: clientName }
    }
    return commands
  }

  export async function add(name: string, mcp: Config.Mcp) {
    const s = await state()
    const durableIdentity = s.durableIdentity[name]
    const durableGeneration = s.durableGeneration[name]
    const inputIdentity = mcpConfigIdentity(mcp)
    if (durableIdentity && durableIdentity !== inputIdentity) {
      throw new Error(`MCP server ${name} does not match its durable configuration`)
    }
    const ownerStillCurrent = () =>
      s.durableIdentity[name] === durableIdentity && s.durableGeneration[name] === durableGeneration
    const existing = s.connections[name]
    const result = await createSafely(name, mcp, {
      processAuthority: { kind: "host", cwd: Instance.directory },
      onCleanupPending: (cleanup) => {
        cleanup.ownerGeneration = durableGeneration
        queueConnectionCleanup(s, name, cleanup)
      },
    })
    if (!ownerStillCurrent()) {
      await closeOrQueueUnpublished(s, name, result.mcpConnection)
      return { status: s.status }
    }
    if (!result.mcpConnection) {
      if (s.connections[name] === existing && !existing) {
        s.status[name] = result.status
        s.statusIdentity[name] = mcpConfigIdentity(mcp)
        delete s.connections[name]
        delete s.clients[name]
      }
      return {
        status: s.status,
      }
    }
    try {
      await closeConnection(name, existing)
    } catch (error) {
      await rejectReplacementAfterCloseFailure(s, name, result.mcpConnection, error)
    }
    if (!ownerStillCurrent() || s.connections[name] !== existing) {
      await closeOrQueueUnpublished(s, name, result.mcpConnection)
      return { status: s.status }
    }
    result.mcpConnection.ownerGeneration = durableIdentity === inputIdentity ? durableGeneration : undefined
    publishRuntimeConnection(s, name, result.mcpConnection, result.status, mcpConfigIdentity(mcp))

    return {
      status: s.status,
    }
  }

  export const RemoveConfiguredInput = z
    .object({
      names: z.array(z.string().trim().min(1)).min(1),
    })
    .strict()
    .meta({ ref: "MCPRemoveConfiguredInput" })

  export const ConfigureRequest = z
    .object({
      name: z.string().trim().min(1),
      config: Config.Mcp,
      credentialSecret: z.string().min(1).optional(),
    })
    .strict()

  export const ConfigureInput = ConfigureRequest.superRefine((input, context) => {
    const hasStaticCredential = input.config.type === "remote" && !!input.config.credential
    if (hasStaticCredential === !!input.credentialSecret) return
    context.addIssue({
      code: "custom",
      path: ["credentialSecret"],
      message: hasStaticCredential
        ? "Static MCP credential secret is required"
        : "MCP credential secret requires a static credential descriptor",
    })
  })

  export async function configure(name: string, mcp: Config.Mcp, credentialSecret?: string) {
    const parsed = ConfigureInput.parse({ name, config: mcp, credentialSecret })
    const s = await state()
    return withRuntimeControl(s, parsed.name, async () => {
      const staticCredential = parsed.credentialSecret
        ? McpAuth.StaticCredential.parse({ secret: parsed.credentialSecret })
        : undefined
      const authKey = mcpAuthKey(parsed.name)

      // The secret is STAGED before the definition commits and promoted to the
      // active credential after it — the active credential the previous
      // definition serves is never destroyed ahead of the commit that retires
      // it. Every interruption converges: a crash before the definition
      // commit leaves a staged secret matching no committed definition, which
      // reconciliation drops; a crash between commit and promotion leaves a
      // staged secret matching the committed definition, which reconciliation
      // promotes. No window leaves an enabled definition whose secret is
      // durably absent.
      const stagedIdentity =
        parsed.config.type === "remote" && parsed.config.credential && staticCredential
          ? { serverUrl: parsed.config.url, credentialIdentity: configuredCredentialIdentity(parsed.config)! }
          : undefined
      if (stagedIdentity && staticCredential) {
        await McpAuth.stageStaticCredential(
          authKey,
          staticCredential.secret,
          stagedIdentity.serverUrl,
          stagedIdentity.credentialIdentity,
        )
      }
      try {
        await Config.updateProjectPatchAtomic(() => ({
          mcp: {
            [parsed.name]: parsed.config,
          },
        }))
      } catch (error) {
        // The definition never committed; the staged secret is dropped and
        // the previously active credential was never touched.
        try {
          if (stagedIdentity) await McpAuth.clearStagedStaticCredential(authKey)
        } catch (rollbackError) {
          throw new AggregateError(
            [error, rollbackError],
            `MCP server ${parsed.name} definition commit and staged credential drop failed`,
          )
        }
        throw error
      }
      if (stagedIdentity) {
        await McpAuth.promoteStagedStaticCredential(authKey, stagedIdentity)
      }

      if (staticCredential) {
        const existing = s.connections[parsed.name]
        if (existing?.configIdentity === mcpConfigIdentity(parsed.config)) {
          queueConnectionCleanup(s, parsed.name, existing)
          await settleConnectionCleanup(s, parsed.name, existing)
          s.status[parsed.name] = { status: "disconnected" }
          s.statusIdentity[parsed.name] = mcpConfigIdentity(parsed.config)
        }
      }
      await ensureConfiguredConnections(s, { [parsed.name]: parsed.config }, false)
      return {
        status: s.status,
      }
    })
  }

  async function removeStoredAuth(mcpName: string): Promise<void> {
    const authKey = mcpAuthKey(mcpName)
    try {
      await McpAuth.remove(authKey)
      log.info("removed oauth credentials", { mcpName })
    } finally {
      McpOAuthCallback.cancelPending(authKey)
      pendingOAuthFlows.delete(authKey)
    }
  }

  export async function removeConfigured(raw: z.input<typeof RemoveConfiguredInput>) {
    const { names: rawNames } = RemoveConfiguredInput.parse(raw)
    const names = [...new Set(rawNames)]
    const s = await state()
    const effectiveMcp = ((await Config.get()).mcp ?? {}) as NonNullable<Config.Info["mcp"]>
    const committedDefinitions = new Set<string>()
    const retryNames = new Set<string>()
    const updated = await Config.updateProjectPatchAtomic(async (currentProject) => {
      const projectMcp = (currentProject.mcp ?? {}) as NonNullable<Config.Info["mcp"]>
      for (const name of names) {
        if (projectMcp[name]) {
          committedDefinitions.add(name)
          continue
        }
        if (s.cleanupPending.has(name)) {
          retryNames.add(name)
          continue
        }
        if (!effectiveMcp[name] && (await McpAuth.get(mcpAuthKey(name)))) {
          retryNames.add(name)
          continue
        }
        throw mcpNotFound(name)
      }

      return {
        mcp: Object.fromEntries([...committedDefinitions].map((name) => [name, null])),
      }
    })
    return updated
  }

  function authIdentity(entry: McpEntry | undefined) {
    if (!entry || !isMcpConfigured(entry) || entry.type !== "remote") return
    if (entry.credential) {
      return JSON.stringify(canonicalConfigValue({ url: entry.url, credential: entry.credential }))
    }
    if (entry.oauth === false) return
    return JSON.stringify(canonicalConfigValue({ url: entry.url, oauth: entry.oauth }))
  }

  function configuredCredentialIdentity(entry: McpEntry | undefined) {
    if (!entry || !isMcpConfigured(entry) || entry.type !== "remote") return
    if (entry.credential) {
      return createHash("sha256")
        .update(JSON.stringify(canonicalConfigValue({ url: entry.url, credential: entry.credential })))
        .digest("hex")
    }
    if (entry.oauth === false) return
    const oauth = typeof entry.oauth === "object" ? entry.oauth : undefined
    return McpOAuthProvider.credentialIdentity(entry.url, {
      clientId: oauth?.clientId,
      clientSecret: oauth?.clientSecret,
      scope: oauth?.scope,
    })
  }

  async function assertCredentialIdentity(name: string, expected: McpEntry) {
    const current = (await Config.get()).mcp?.[name]
    if (!current || authIdentity(current) !== authIdentity(expected)) {
      throw new Error(`MCP credential identity changed while ${name} was connecting`)
    }
  }

  function invalidatePendingConnection(state: McpState, name: string) {
    delete state.connecting[name]
    delete state.connectingIdentity[name]
  }

  function queueConnectionCleanup(state: McpState, name: string, connection: McpConnection | undefined) {
    if (!connection) return
    const pending = state.connectionCleanupPending.get(name) ?? new Set<McpConnection>()
    pending.add(connection)
    state.connectionCleanupPending.set(name, pending)
    if (state.connections[name] === connection) {
      delete state.connections[name]
      if (state.clients[name] === connection.client) delete state.clients[name]
    }
  }

  async function settleConnectionCleanup(state: McpState, name: string, connection: McpConnection) {
    let attempt = connectionCleanupAttempts.get(connection)
    if (!attempt) {
      attempt = closeConnection(name, connection)
      connectionCleanupAttempts.set(connection, attempt)
    }
    try {
      await attempt
    } finally {
      if (connectionCleanupAttempts.get(connection) === attempt) {
        connectionCleanupAttempts.delete(connection)
      }
    }
    const pending = state.connectionCleanupPending.get(name)
    pending?.delete(connection)
    if (pending?.size === 0) state.connectionCleanupPending.delete(name)
  }

  async function cleanupRemovedProjectNames(names: readonly string[]) {
    const s = await state()
    for (const name of names) s.cleanupPending.add(name)
    for (const name of names) {
      invalidatePendingConnection(s, name)
      delete s.clients[name]
      delete s.status[name]
      delete s.statusIdentity[name]
      delete s.runtimeConnectionOverrides[name]
      queueConnectionCleanup(s, name, s.connections[name])
      McpOAuthCallback.cancelPending(mcpAuthKey(name))
      pendingOAuthFlows.delete(mcpAuthKey(name))
    }
    const tasks = names.flatMap((name) =>
      [...(s.connectionCleanupPending.get(name) ?? [])].map((connection) =>
        settleConnectionCleanup(s, name, connection),
      ),
    )
    tasks.push(McpAuth.removeMany(names.map((name) => mcpAuthKey(name))))
    const results = await Promise.allSettled(tasks)
    const failures = results.filter((result): result is PromiseRejectedResult => result.status === "rejected")
    if (failures.length > 0) {
      throw new AggregateError(
        failures.map((failure) => failure.reason),
        "MCP definition is absent, but runtime cleanup did not fully settle",
      )
    }
    for (const name of names) s.cleanupPending.delete(name)
  }

  /**
   * Settle staged configure secrets against the committed project
   * configuration. This is the crash owner: a configure that died between its
   * definition commit and its promotion leaves a staged secret whose identity
   * matches the committed definition, and nothing else would promote it until
   * an unrelated config commit happened to arrive.
   */
  async function settleStagedCredentials(input: {
    projectAuthPrefix: string
    definitions: NonNullable<Config.Info["mcp"]>
    names?: ReadonlySet<string>
  }) {
    const entries = await McpAuth.all()
    for (const [authKey, entry] of Object.entries(entries)) {
      if (!authKey.startsWith(input.projectAuthPrefix) || !entry.stagedStaticCredential) continue
      const stagedName = authKey.slice(input.projectAuthPrefix.length)
      if (input.names && !input.names.has(stagedName)) continue
      const definition = input.definitions[stagedName]
      const nextIdentity = configuredCredentialIdentity(definition)
      const nextUrl = definition && "type" in definition && definition.type === "remote" ? definition.url : undefined
      if (
        nextIdentity &&
        nextUrl &&
        entry.stagedStaticCredential.serverUrl === nextUrl &&
        entry.stagedStaticCredential.credentialIdentity === nextIdentity
      ) {
        await McpAuth.promoteStagedStaticCredential(authKey, {
          serverUrl: nextUrl,
          credentialIdentity: nextIdentity,
        })
      } else {
        await McpAuth.clearStagedStaticCredential(authKey)
      }
    }
  }

  export async function reconcileProjectConfig(input: { before: Config.Info; after: Config.Info }) {
    const before = (input.before.mcp ?? {}) as NonNullable<Config.Info["mcp"]>
    const after = (input.after.mcp ?? {}) as NonNullable<Config.Info["mcp"]>
    const s = await state()
    const initialNames = [
      ...new Set([
        ...Object.keys(before),
        ...Object.keys(after),
        ...s.cleanupPending,
        ...s.connectionCleanupPending.keys(),
        ...s.reconcilePending,
      ]),
    ]
    const changed = initialNames.filter((name) => {
      const previous = before[name]
      const next = after[name]
      if (!previous || !next) return previous !== next
      return mcpConfigIdentity(previous) !== mcpConfigIdentity(next)
    })
    const removedNames: string[] = []
    for (const name of changed) {
      s.reconcilePending.add(name)
      const previous = before[name]
      const next = after[name]
      s.durableGeneration[name] = (s.durableGeneration[name] ?? 0) + 1
      if (next) {
        s.durableIdentity[name] = mcpConfigIdentity(next)
      } else {
        delete s.durableIdentity[name]
      }
      delete s.runtimeConnectionOverrides[name]
      invalidatePendingConnection(s, name)
      const connection = s.connections[name]
      delete s.clients[name]
      queueConnectionCleanup(s, name, connection)
      if (authIdentity(previous) !== authIdentity(next) && authIdentity(previous)) {
        // Live flow state dies with the identity it was opened under. The
        // stored credential's retirement is NOT decided here: the durable
        // store's own identity, compared against the committed definition
        // after staged settlement below, is the single authority — deciding
        // it from the config diff instead deleted the very secret a
        // completed identity-changing configure had just promoted.
        McpOAuthCallback.cancelPending(mcpAuthKey(name))
        pendingOAuthFlows.delete(mcpAuthKey(name))
      } else if (authIdentity(previous)) {
        await McpAuth.invalidate(mcpAuthKey(name))
      }
      if (!next) {
        s.cleanupPending.add(name)
        removedNames.push(name)
        delete s.status[name]
        delete s.statusIdentity[name]
        continue
      }
      if (!isMcpConfigured(next) || next.enabled === false) {
        s.status[name] = { status: "disabled" }
        s.statusIdentity[name] = mcpConfigIdentity(next)
        continue
      }
      s.status[name] = { status: "disconnected" }
      s.statusIdentity[name] = mcpConfigIdentity(next)
    }
    const projectAuthPrefix = `${s.projectID}:`
    // Settle staged configure secrets BEFORE computing orphans and stale
    // credentials: a staged secret whose identity matches the committed
    // definition is a crash-interrupted configure's missing promotion; any
    // other staged secret belongs to no committed definition and is dropped.
    // Running this first keeps the stale-credential sweep from removing an
    // entry whose promotion would have made it current.
    // A staged secret is settled only by the commit that changed its own
    // definition — otherwise an unrelated project-config commit landing
    // between a configure's stage and its definition commit would drop a
    // secret that is still in flight. Whatever a crash leaves behind is
    // settled by the startup owner.
    await settleStagedCredentials({ projectAuthPrefix, definitions: after, names: new Set(changed) })
    const authEntries = await McpAuth.all()
    const projectAuthNames = Object.keys(authEntries)
      .filter((authKey) => authKey.startsWith(projectAuthPrefix))
      .map((authKey) => authKey.slice(projectAuthPrefix.length))
      .filter(Boolean)
    const authOrphanNames = projectAuthNames.filter((name) => !!name && !after[name])
    const staleCredentialNames = projectAuthNames.filter((name) => {
      const nextIdentity = configuredCredentialIdentity(after[name])
      if (!nextIdentity) return !!after[name]
      const stored = authEntries[mcpAuthKey(name)]
      if (!stored) return false
      if (!stored.serverUrl) return true
      if (stored.serverUrl !== (after[name] as Extract<McpEntry, { type: "remote" }>).url) return true
      return stored.credentialIdentity !== nextIdentity
    })
    const names = [...new Set([...initialNames, ...authOrphanNames, ...staleCredentialNames])]
    const authOrphans = new Set(authOrphanNames)
    const staleCredentials = new Set(staleCredentialNames)
    const changedNames = new Set(changed)
    const retryNames = names.filter(
      (name) => !changedNames.has(name) && (s.cleanupPending.has(name) || authOrphans.has(name)) && !after[name],
    )
    // Every credential the durable store proves stale against the committed
    // definition is retired here, whether or not this commit changed that
    // definition — one authority, no config-diff second opinion.
    const credentialRetryNames = names.filter((name) => staleCredentials.has(name))
    if (
      changed.length === 0 &&
      retryNames.length === 0 &&
      credentialRetryNames.length === 0 &&
      s.connectionCleanupPending.size === 0 &&
      s.reconcilePending.size === 0
    )
      return
    const cleanupTasks: Promise<void>[] = []
    if (credentialRetryNames.length > 0) {
      cleanupTasks.push(McpAuth.removeMany(credentialRetryNames.map((name) => mcpAuthKey(name))))
    }
    for (const [name, pending] of s.connectionCleanupPending) {
      for (const connection of pending) cleanupTasks.push(settleConnectionCleanup(s, name, connection))
    }

    const cleanup = await Promise.allSettled(cleanupTasks)
    const failures = cleanup.filter((result): result is PromiseRejectedResult => result.status === "rejected")
    if (failures.length > 0) {
      throw new AggregateError(
        failures.map((failure) => failure.reason),
        "MCP configuration committed, but runtime cleanup did not fully settle",
      )
    }
    for (const name of removedNames) s.cleanupPending.delete(name)
    for (const name of names) s.reconcilePending.delete(name)
    if (retryNames.length > 0) await cleanupRemovedProjectNames(retryNames)
  }

  export async function projectStatus() {
    const project = await Config.getProject()
    const config = (project.mcp ?? {}) as NonNullable<Config.Info["mcp"]>
    const s = await state()
    const result: Record<string, Status> = {}
    for (const [name, configuredEntry] of entries(config)) {
      const entry = effectiveRuntimeMcp(s, name, configuredEntry)
      if (isMcpDisabledOverride(entry) || (isMcpConfigured(entry) && entry.enabled === false)) {
        result[name] = { status: "disabled" }
        continue
      }
      if (!isMcpConfigured(entry)) continue
      result[name] =
        s.statusIdentity[name] === mcpConfigIdentity(entry)
          ? (s.status[name] ?? { status: "disconnected" })
          : { status: "disconnected" }
    }
    return result
  }

  async function create(key: string, mcp: Config.Mcp, options: CreateOptions) {
    if (mcp.enabled === false) {
      log.info("mcp server disabled", { key })
      return {
        mcpClient: undefined,
        mcpConnection: undefined,
        status: { status: "disabled" as const },
      }
    }

    const cfg = options.cwd ? undefined : await Config.get()
    const globalTimeout = options.globalTimeout ?? cfg?.experimental?.mcp_timeout
    const requestTimeout = effectiveTimeout(mcp, globalTimeout)
    const directory = options.cwd ?? Instance.directory
    const builtinBrowser = mcp.type === "local" && BrowserMCPBuiltin.isBuiltinLocalConfig(mcp)

    log.info("found", { key, type: mcp.type })
    let mcpClient: MCPClient | undefined
    let mcpTransport: ClosableTransport | undefined
    let connectionCwd: string | undefined
    let status: Status | undefined = undefined
    let localDiagnostics: LocalMcpProcessDiagnostics | undefined
    let localFailure: ((error: unknown) => Extract<Status, { status: "failed" }>) | undefined

    if (mcp.type === "remote") {
      // OAuth is enabled by default for remote servers unless explicitly disabled with oauth: false
      const oauthDisabled = mcp.oauth === false
      const oauthConfig = typeof mcp.oauth === "object" ? mcp.oauth : undefined
      const authKey = oauthDisabled
        ? undefined
        : options.authKey === false
          ? undefined
          : (options.authKey ?? mcpAuthKey(key))
      let authProvider: McpOAuthProvider | undefined
      let staticCredentialSecret: string | undefined

      if (mcp.credential) {
        const staticCredential = await McpAuth.getForUrl(mcpAuthKey(key), mcp.url, configuredCredentialIdentity(mcp))
        staticCredentialSecret = staticCredential?.staticCredential?.secret
        if (!staticCredentialSecret) throw new Error(`MCP server ${key} static credential is not configured`)
      }

      if (authKey) {
        const correlationID = crypto.randomUUID()
        authProvider = new McpOAuthProvider(
          key,
          authKey,
          mcp.url,
          {
            clientId: oauthConfig?.clientId,
            clientSecret: oauthConfig?.clientSecret,
            scope: oauthConfig?.scope,
          },
          {
            onRedirect: async (url) => {
              log.info(
                "oauth redirect requested",
                oauthAuthorizationLogFields({
                  mcpName: key,
                  authorizationUrl: url,
                  correlationID,
                }),
              )
              // Store the URL - actual browser opening is handled by startAuth
            },
          },
          // A connection reads; it must not revoke a flow to do so. Over a
          // never-leased credential its refresh writes stay unfenced.
          await McpAuth.revision(authKey).then((generation) => (generation === "" ? undefined : generation)),
          () => assertCredentialIdentity(key, mcp),
          undefined,
          correlationID,
        )
      }

      let transportName: string
      let transport: ReturnType<typeof createRemoteTransport>["transport"]
      try {
        const remote = createRemoteTransport(
          mcp,
          authProvider,
          mcpFetchRequestInit(requestTimeout),
          staticCredentialSecret,
        )
        transportName = remote.name
        transport = remote.transport
      } catch (error) {
        throw new Error(credentialSafeErrorMessage(error, staticCredentialSecret))
      }

      let client: Client | undefined
      try {
        client = new Client({
          name: "opencorvus",
          version: Installation.VERSION,
        })
        await client.connect(transport, mcpRequestOptions(requestTimeout))
        registerNotificationHandlers(client, key, directory)
        mcpClient = client
        mcpTransport = transport
        log.info("connected", { key, transport: transportName })
        status = { status: "connected" }
      } catch (error) {
        const lastError = new Error(credentialSafeErrorMessage(error, staticCredentialSecret))

        // Handle OAuth-specific errors
        if (error instanceof UnauthorizedError && authKey) {
          log.info("mcp server requires authentication", { key, transport: transportName })

          // Check if this is a "needs registration" error
          if (lastError.message.includes("registration") || lastError.message.includes("client_id")) {
            status = {
              status: "needs_client_registration" as const,
              error: "Server does not support dynamic client registration. Please provide clientId in config.",
            }
            Bus.publishOwned(AuthRequired, {
              name: key,
              message: `Server "${key}" requires a pre-registered client ID. Add clientId to your config.`,
              reason: "needs_client_registration",
            })
          } else {
            status = { status: "needs_auth" as const }
            Bus.publishOwned(AuthRequired, {
              name: key,
              message: `Server "${key}" requires authentication. Run: opencorvus mcp auth ${key}`,
              reason: "needs_auth",
            })
          }
          try {
            await closeClientAndTransport(key, client, transport)
          } catch (cleanupError) {
            throw new McpCreateCleanupError(
              cleanupConnection(key, mcp, client, transport, connectionCwd),
              status,
              new Error(credentialSafeErrorMessage(cleanupError, staticCredentialSecret)),
            )
          }
        } else {
          log.debug("transport connection failed", {
            key,
            transport: transportName,
            url: mcp.url,
            error: lastError.message,
          })
          status = {
            status: "failed" as const,
            error: lastError.message,
          }
          try {
            await closeClientAndTransport(key, client, transport)
          } catch (cleanupError) {
            throw new McpCreateCleanupError(
              cleanupConnection(key, mcp, client, transport, connectionCwd),
              status,
              new Error(credentialSafeErrorMessage(cleanupError, staticCredentialSecret)),
            )
          }
        }
      }
    }

    if (mcp.type === "local") {
      const [configuredCommand, ...configuredArgs] = mcp.command
      const baseEnvironment = localMcpBaseEnvironment(configuredCommand, mcp)
      const diagnosticID = crypto.randomUUID()
      const initializeLocalDiagnostics = (environment: Readonly<Record<string, string>>) => {
        const diagnostics = createLocalMcpProcessDiagnostics({
          environment,
          onDiagnostic: (diagnostic) => log.info("local mcp stderr", { key, diagnostic }),
        })
        const failure = (error: unknown): Extract<Status, { status: "failed" }> => {
          diagnostics.finish()
          const safeError = diagnostics.sanitize(errorMessage(error))
          log.error("local mcp startup failed", {
            key,
            diagnosticID,
            cwd: directory,
            error: safeError,
            stderr: diagnostics.tail(),
          })
          return {
            status: "failed",
            error: `Local MCP startup failed (diagnostic ID: ${diagnosticID})`,
          }
        }
        return { diagnostics, failure }
      }
      let transport: SupervisedStdioClientTransport | undefined
      let client: Client | undefined
      try {
        const processPlan = builtinBrowser
          ? await BrowserMCPBuiltin.resolveStdioProcess({
              env: await browserMcpBridgeEnvironment(baseEnvironment),
            })
          : {
              executable: configuredCommand,
              args: configuredArgs,
              env: baseEnvironment,
            }
        const cwd = directory
        connectionCwd = cwd
        const env = Object.fromEntries(
          Object.entries(processPlan.env).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
        )
        const initialized = initializeLocalDiagnostics(env)
        localDiagnostics = initialized.diagnostics
        localFailure = initialized.failure
        const diagnostics = initialized.diagnostics
        transport = new SupervisedStdioClientTransport(
          {
            stderr: "pipe",
            command: processPlan.executable,
            args: processPlan.args,
            cwd,
            env,
          },
          options.processAuthority,
        )
        transport.stderr?.on("data", (chunk: Buffer) => diagnostics.write(chunk))
        transport.stderr?.once("end", () => diagnostics.finish())
        client = new Client({
          name: "opencorvus",
          version: Installation.VERSION,
        })
        await client.connect(transport, mcpRequestOptions(requestTimeout))
        registerNotificationHandlers(client, key, directory)
        mcpClient = client
        mcpTransport = transport
        status = {
          status: "connected",
        }
      } catch (error) {
        let diagnostics = localDiagnostics
        let failure = localFailure
        if (!diagnostics || !failure) {
          const initialized = initializeLocalDiagnostics(
            Object.fromEntries(
              Object.entries(baseEnvironment).filter(
                (entry): entry is [string, string] => typeof entry[1] === "string",
              ),
            ),
          )
          diagnostics = initialized.diagnostics
          failure = initialized.failure
          localDiagnostics = diagnostics
          localFailure = failure
        }
        let cleanupError: unknown
        try {
          await closeClientAndTransport(key, client, transport)
        } catch (error) {
          cleanupError = error
        }
        status = failure(error)
        if (cleanupError) {
          throw new McpCreateCleanupError(
            cleanupConnection(key, mcp, client, transport, connectionCwd),
            status,
            new Error(diagnostics.sanitize(errorMessage(cleanupError))),
          )
        }
      }
    }

    if (!status) {
      status = {
        status: "failed" as const,
        error: "Unknown error",
      }
    }

    if (!mcpClient) {
      return {
        mcpClient: undefined,
        mcpConnection: undefined,
        status,
      }
    }

    let result: Awaited<ReturnType<Client["listTools"]>> | undefined
    let listToolsError = ""
    if (!options.skipToolListVerification) {
      try {
        result = await mcpClient.listTools(undefined, mcpRequestOptions(requestTimeout))
      } catch (err) {
        listToolsError = localDiagnostics?.sanitize(errorMessage(err)) ?? errorMessage(err)
        log.error("failed to get tools from client", { key, error: listToolsError })
      }
    }
    if (!result && !options.skipToolListVerification) {
      const failureMessage = listToolsError || "MCP listTools returned no result"
      let cleanupError: unknown
      try {
        await closeClientAndTransport(key, mcpClient, mcpTransport)
      } catch (error) {
        cleanupError = error
      }
      status = localFailure ? localFailure(failureMessage) : { status: "failed", error: failureMessage }
      if (cleanupError) {
        throw new McpCreateCleanupError(
          cleanupConnection(key, mcp, mcpClient, mcpTransport, connectionCwd),
          status,
          localDiagnostics ? new Error(localDiagnostics.sanitize(errorMessage(cleanupError))) : cleanupError,
        )
      }
      return {
        mcpClient: undefined,
        mcpConnection: undefined,
        status: {
          ...status,
        },
      }
    }

    const tools = result?.tools ?? []
    log.info("create() successfully created client", { key, toolCount: tools.length })
    const mcpConnection: McpConnection = {
      key,
      type: mcp.type,
      client: mcpClient,
      tools,
      transport: mcpTransport,
      command: mcp.type === "local" ? mcp.command : undefined,
      cwd: connectionCwd,
      createdAt: Date.now(),
      lastUsedAt: Date.now(),
      sharedProjectScoped: builtinBrowser,
      configIdentity: mcpConfigIdentity(mcp),
    }
    return {
      mcpClient,
      mcpConnection,
      status,
    }
  }

  function localMcpBaseEnvironment(cmd: string, mcp: Extract<Config.Mcp, { type: "local" }>) {
    return {
      ...Env.snapshot(),
      ...(cmd === "opencorvus" ? { BUN_BE_BUN: "1" } : {}),
      ...mcp.environment,
    }
  }

  export async function status() {
    const s = await state()
    const cfg = await Config.get()
    const config = (cfg.mcp ?? {}) as NonNullable<Config.Info["mcp"]>
    const result: Record<string, Status> = {}

    // Include all configured MCPs from config, not just connected ones
    for (const [key, configuredMcp] of entries(config)) {
      const mcp = effectiveRuntimeMcp(s, key, configuredMcp)
      if (isMcpDisabledOverride(mcp)) {
        result[key] = { status: "disabled" }
        continue
      }
      if (!isMcpConfigured(mcp)) continue
      if (mcp.enabled === false) {
        result[key] = { status: "disabled" }
        continue
      }
      result[key] =
        s.statusIdentity[key] === mcpConfigIdentity(mcp)
          ? (s.status[key] ?? { status: "disconnected" })
          : { status: "disconnected" }
    }

    return result
  }

  function exactConfiguredServers(
    config: NonNullable<Config.Info["mcp"]>,
    serverIDs: readonly string[],
  ): NonNullable<Config.Info["mcp"]> {
    const selected: NonNullable<Config.Info["mcp"]> = {}
    for (const serverID of serverIDs) {
      const entry = requireMcpEntry(config, serverID)
      selected[serverID] = entry
    }
    return selected
  }

  export async function clients() {
    return state().then((state) => state.clients)
  }

  export async function connectionStats() {
    const states = await Promise.all(state.inspectAll().map((entry) => entry.state))
    const connections = new Set<McpConnection>()
    let scopedConnecting = 0
    for (const project of states) {
      for (const connection of objectValues(project.connections)) connections.add(connection)
      for (const pending of project.connectionCleanupPending.values()) {
        for (const connection of pending) connections.add(connection)
      }
      for (const owner of project.scopedOwners) {
        for (const entry of owner.entries.values()) {
          if (entry.connection) connections.add(entry.connection)
          else scopedConnecting++
        }
        for (const connection of owner.cleanupPending) connections.add(connection)
      }
    }
    const connected = [...connections]
    return {
      projects: states.length,
      connected: connected.length,
      local: connected.filter((connection) => connection.type === "local").length,
      remote: connected.filter((connection) => connection.type === "remote").length,
      localStdioTransports: connected.filter((connection) => connection.type === "local" && connection.transport)
        .length,
      connecting: states.reduce(
        (total, project) => total + objectValues(project.connecting).filter(Boolean).length,
        scopedConnecting,
      ),
      failedAwaitingReconnect: states.reduce(
        (total, project) => total + objectValues(project.status).filter((status) => status.status === "failed").length,
        0,
      ),
    }
  }

  export async function connect(name: string) {
    const s = await state()
    return withRuntimeControl(s, name, async () => {
      const ownerGeneration = s.durableGeneration[name]
      const cfg = await Config.get()
      const config = (cfg.mcp ?? {}) as NonNullable<Config.Info["mcp"]>
      const mcp = requireMcpEntry(config, name)
      const ownerIdentity = mcpConfigIdentity(mcp)
      if (s.durableGeneration[name] !== ownerGeneration || s.durableIdentity[name] !== ownerIdentity) {
        throw new Error(`MCP server ${name} configuration changed before connection started`)
      }
      const mcpToConnect = isMcpConfigured(mcp) ? mcp : builtinConfigForDisabledOverride(name, mcp)
      if (!mcpToConnect) throw mcpNotFound(name)

      const enabledMcp = { ...mcpToConnect, enabled: true } as Config.Mcp
      const identity = mcpConfigIdentity(enabledMcp)
      const ownedCleanup = [...(s.connectionCleanupPending.get(name) ?? [])].filter(
        (connection) => connection.configIdentity === identity && connection.ownerGeneration === ownerGeneration,
      )
      await Promise.all(ownedCleanup.map((connection) => settleConnectionCleanup(s, name, connection)))
      const currentAfterCleanup = (await Config.get()).mcp?.[name]
      if (
        !currentAfterCleanup ||
        mcpConfigIdentity(currentAfterCleanup) !== ownerIdentity ||
        s.durableGeneration[name] !== ownerGeneration
      ) {
        throw new Error(`MCP server ${name} configuration changed while prior cleanup was settling`)
      }
      s.runtimeConnectionOverrides[name] = {
        ownerIdentity,
        ownerGeneration: ownerGeneration!,
        config: enabledMcp,
      }
      if (!s.connections[name] && !s.connecting[name] && s.statusIdentity[name] === identity) {
        s.status[name] = { status: "disconnected" }
      }
      await ensureConfiguredConnections(s, { [name]: mcp })
      const status = s.status[name]
      const current = (await Config.get()).mcp?.[name]
      const connected =
        current &&
        mcpConfigIdentity(current) === ownerIdentity &&
        s.durableGeneration[name] === ownerGeneration &&
        status?.status === "connected" &&
        s.statusIdentity[name] === identity &&
        s.connections[name]?.configIdentity === identity &&
        s.connections[name]?.ownerGeneration === ownerGeneration
      if (!connected) {
        const reason =
          status && "error" in status && status.error ? `: ${status.error}` : `: ${status?.status ?? "unknown"}`
        throw new Error(`MCP server ${name} did not connect${reason}`)
      }
    })
  }

  export async function disconnect(name: string) {
    const s = await state()
    const ownerGeneration = s.durableGeneration[name]
    const cfg = await Config.get()
    const config = (cfg.mcp ?? {}) as NonNullable<Config.Info["mcp"]>
    const configured = requireMcpEntry(config, name)
    const ownerIdentity = mcpConfigIdentity(configured)
    if (s.durableGeneration[name] !== ownerGeneration || s.durableIdentity[name] !== ownerIdentity) return
    return withRuntimeControl(s, name, async () => {
      const owner = (await Config.get()).mcp?.[name]
      if (!owner || mcpConfigIdentity(owner) !== ownerIdentity || s.durableGeneration[name] !== ownerGeneration) return
      const runtimeEntry = effectiveRuntimeMcp(s, name, owner)
      const runtimeIdentity = mcpConfigIdentity(runtimeEntry)
      const pending = s.connecting[name]
      if (pending) await pending
      const current = (await Config.get()).mcp?.[name]
      if (!current || mcpConfigIdentity(current) !== ownerIdentity || s.durableGeneration[name] !== ownerGeneration)
        return
      const completed = s.connections[name]
      if (completed?.configIdentity === runtimeIdentity && completed.ownerGeneration === ownerGeneration)
        queueConnectionCleanup(s, name, completed)
      s.status[name] = { status: "disabled" }
      s.statusIdentity[name] = runtimeIdentity
      const ownedConnections = [...(s.connectionCleanupPending.get(name) ?? [])].filter(
        (connection) => connection.configIdentity === runtimeIdentity && connection.ownerGeneration === ownerGeneration,
      )
      await Promise.all(ownedConnections.map((connection) => settleConnectionCleanup(s, name, connection)))
      const override = s.runtimeConnectionOverrides[name]
      if (override?.ownerIdentity === ownerIdentity && override.ownerGeneration === ownerGeneration)
        delete s.runtimeConnectionOverrides[name]
      const latest = (await Config.get()).mcp?.[name]
      if (!latest || mcpConfigIdentity(latest) !== ownerIdentity || s.durableGeneration[name] !== ownerGeneration)
        return
      s.status[name] = { status: "disabled" }
      s.statusIdentity[name] = ownerIdentity
    })
  }

  export async function tools(processAuthority: ProcessAuthority) {
    const cfg = await Config.get()
    return toolsForConfig(
      (cfg.mcp ?? {}) as NonNullable<Config.Info["mcp"]>,
      cfg.experimental?.mcp_timeout,
      processAuthority,
    )
  }

  async function toolsForConfig(
    config: NonNullable<Config.Info["mcp"]>,
    defaultTimeout: number | undefined,
    processAuthority: ProcessAuthority,
  ) {
    if (processAuthority.kind === "task") {
      const enabled = entries(config).filter(
        (entry): entry is [string, Config.Mcp] => isMcpConfigured(entry[1]) && entry[1].enabled !== false,
      )
      for (const [key, mcp] of enabled) assertMcpCapability(`MCP ${key}`, mcp.type, processAuthority)
      const inventories = await Promise.all(
        enabled.map(async ([key, mcp]) => ({
          key,
          mcp,
          inventory: await inspectScopedCapabilities({
            key,
            mcp,
            cwd: processAuthority.cwd,
            processAuthority,
            globalTimeout: defaultTimeout,
          }),
        })),
      )
      const result: Record<string, Tool> = {}
      for (const { key, mcp, inventory } of inventories) {
        for (const toolName of inventory.tools) {
          const sanitizedClientName = key.replace(/[^a-zA-Z0-9_-]/g, "_")
          const sanitizedToolName = toolName.replace(/[^a-zA-Z0-9_-]/g, "_")
          result[sanitizedClientName + "_" + sanitizedToolName] = await scopedTool({
            key,
            mcp,
            cwd: processAuthority.cwd,
            processAuthority,
            globalTimeout: defaultTimeout,
            toolName,
          })
        }
      }
      return result
    }
    const result: Record<string, Tool> = {}
    const s = await state()
    await ensureConfiguredConnections(s, config)
    const clientsSnapshot = await clients()
    const selectedServerIDs = new Set(Object.keys(config))

    const connectedClients = entries(clientsSnapshot).filter(([clientName]) => {
      if (!selectedServerIDs.has(clientName)) return false
      return exactConnectedRuntime(s, clientName, config[clientName])?.client === clientsSnapshot[clientName]
    })

    const toolsResults = await Promise.all(
      connectedClients.map(async ([clientName, client]) => {
        const runtime = exactConnectedRuntime(s, clientName, config[clientName])
        if (!runtime || runtime.client !== client) return
        let toolsResult: Awaited<ReturnType<Client["listTools"]>>
        try {
          const timeout = effectiveTimeout(runtime.mcp, defaultTimeout)
          toolsResult = await client.listTools(undefined, mcpRequestOptions(timeout))
        } catch (error) {
          return failClientList(s, clientName, "tools", error, runtime.connection)
        }
        if (exactConnectedRuntime(s, clientName, config[clientName])?.connection !== runtime.connection) return
        return { clientName, client, toolsResult, mcp: runtime.mcp }
      }),
    )

    for (const toolResult of toolsResults) {
      if (!toolResult) continue
      const { clientName, client, toolsResult, mcp } = toolResult
      const timeout = effectiveTimeout(mcp, defaultTimeout)
      for (const mcpTool of toolsResult.tools) {
        if (isToolVisibilityAppOnly(mcpTool)) continue
        const sanitizedClientName = clientName.replace(/[^a-zA-Z0-9_-]/g, "_")
        const sanitizedToolName = mcpTool.name.replace(/[^a-zA-Z0-9_-]/g, "_")
        result[sanitizedClientName + "_" + sanitizedToolName] = await convertMcpTool(mcpTool, client, timeout, {
          serverID: clientName,
          configDigest: mcpConfigDigest(mcp),
          type: mcp.type,
          processAuthority: { kind: "host", cwd: Instance.directory },
        })
      }
    }
    return result
  }

  export async function toolsForServers(configSnapshot: Config.Info, serverIDs: readonly string[]) {
    const config = exactConfiguredServers((configSnapshot.mcp ?? {}) as NonNullable<Config.Info["mcp"]>, serverIDs)
    return toolsForConfig(config, configSnapshot.experimental?.mcp_timeout, {
      kind: "host",
      cwd: Instance.directory,
    })
  }

  async function promptsForConfig(config: NonNullable<Config.Info["mcp"]>, defaultTimeout: number | undefined) {
    const s = await state()
    await ensureConfiguredConnections(s, config)
    const clientsSnapshot = await clients()

    const prompts = Object.fromEntries(
      (
        await Promise.all(
          entries(clientsSnapshot).map(async ([clientName, client]) => {
            const runtime = exactConnectedRuntime(s, clientName, config[clientName])
            if (!runtime || runtime.client !== client) return []
            const timeout = effectiveTimeout(runtime.mcp, defaultTimeout)
            const values = await fetchPromptsForClient(s, clientName, client, timeout, runtime.connection)
            if (exactConnectedRuntime(s, clientName, config[clientName])?.connection !== runtime.connection) return []
            return entries(values)
          }),
        )
      ).flat(),
    ) as Record<string, PromptInfo & { client: string }>

    return prompts
  }

  export async function prompts() {
    const cfg = await Config.get()
    return promptsForConfig((cfg.mcp ?? {}) as NonNullable<Config.Info["mcp"]>, cfg.experimental?.mcp_timeout)
  }

  export async function promptsForServers(configSnapshot: Config.Info, serverIDs: readonly string[]) {
    return promptsForConfig(
      exactConfiguredServers((configSnapshot.mcp ?? {}) as NonNullable<Config.Info["mcp"]>, serverIDs),
      configSnapshot.experimental?.mcp_timeout,
    )
  }

  async function resourcesForConfig(config: NonNullable<Config.Info["mcp"]>, defaultTimeout: number | undefined) {
    const s = await state()
    await ensureConfiguredConnections(s, config)
    const clientsSnapshot = await clients()

    const result = Object.fromEntries(
      (
        await Promise.all(
          entries(clientsSnapshot).map(async ([clientName, client]) => {
            const runtime = exactConnectedRuntime(s, clientName, config[clientName])
            if (!runtime || runtime.client !== client) return []
            const timeout = effectiveTimeout(runtime.mcp, defaultTimeout)
            const values = await fetchResourcesForClient(s, clientName, client, timeout, runtime.connection)
            if (exactConnectedRuntime(s, clientName, config[clientName])?.connection !== runtime.connection) return []
            return entries(values)
          }),
        )
      ).flat(),
    ) as Record<string, ResourceInfo & { client: string }>

    return result
  }

  export async function resources() {
    const cfg = await Config.get()
    return resourcesForConfig((cfg.mcp ?? {}) as NonNullable<Config.Info["mcp"]>, cfg.experimental?.mcp_timeout)
  }

  export async function resourcesForServers(configSnapshot: Config.Info, serverIDs: readonly string[]) {
    return resourcesForConfig(
      exactConfiguredServers((configSnapshot.mcp ?? {}) as NonNullable<Config.Info["mcp"]>, serverIDs),
      configSnapshot.experimental?.mcp_timeout,
    )
  }

  export async function getPrompt(clientName: string, name: string, args?: Record<string, string>) {
    const cfg = await Config.get()
    const s = await state()
    const runtime = exactConnectedRuntime(s, clientName, cfg.mcp?.[clientName])

    if (!runtime) {
      log.warn("client not found for prompt", {
        clientName,
      })
      throw mcpNotFound(clientName)
    }

    try {
      return await runtime.client.getPrompt(
        {
          name: name,
          arguments: args,
        },
        mcpRequestOptions(effectiveTimeout(runtime.mcp, cfg.experimental?.mcp_timeout)),
      )
    } catch (error) {
      log.error("failed to get prompt from MCP server", {
        clientName,
        promptName: name,
        error: errorMessage(error),
      })
      throw error
    }
  }

  export async function readResource(clientName: string, resourceUri: string) {
    const cfg = await Config.get()
    const s = await state()
    const runtime = exactConnectedRuntime(s, clientName, cfg.mcp?.[clientName])

    if (!runtime) {
      log.warn("client not found for resource", {
        clientName: clientName,
      })
      throw mcpNotFound(clientName)
    }

    try {
      return await runtime.client.readResource(
        {
          uri: resourceUri,
        },
        mcpRequestOptions(effectiveTimeout(runtime.mcp, cfg.experimental?.mcp_timeout)),
      )
    } catch (error) {
      log.error("failed to read resource from MCP server", {
        clientName: clientName,
        resourceUri: resourceUri,
        error: errorMessage(error),
      })
      throw error
    }
  }

  export async function withAppClient<T>(
    input: { serverID: string; configDigest: string },
    run: (client: MCPClient, timeout: number) => Promise<T>,
  ): Promise<T> {
    const cfg = await Config.get()
    const config = (cfg.mcp ?? {}) as NonNullable<Config.Info["mcp"]>
    const entry = requireMcpEntry(config, input.serverID)
    const s = await state()
    const runtimeEntry = effectiveRuntimeMcp(s, input.serverID, entry)
    if (!isMcpConfigured(runtimeEntry) || runtimeEntry.enabled === false) {
      throw new Error(`MCP App server ${input.serverID} is not enabled`)
    }
    const currentDigest = mcpConfigDigest(runtimeEntry)
    if (currentDigest !== input.configDigest) {
      throw new Error(`MCP App server ${input.serverID} configuration changed after the artifact was created`)
    }
    await ensureConfiguredConnections(s, { [input.serverID]: entry })
    const currentConfig = await Config.get()
    const currentEntry = requireMcpEntry((currentConfig.mcp ?? {}) as NonNullable<Config.Info["mcp"]>, input.serverID)
    const runtime = exactConnectedRuntime(s, input.serverID, currentEntry)
    if (!runtime) {
      throw new Error(`MCP App server ${input.serverID} is not connected`)
    }
    if (mcpConfigDigest(runtime.mcp) !== input.configDigest) {
      throw new Error(`MCP App server ${input.serverID} configuration changed after the artifact was created`)
    }
    return run(runtime.client, effectiveTimeout(runtime.mcp, currentConfig.experimental?.mcp_timeout))
  }

  /**
   * Start OAuth authentication flow for an MCP server.
   * Returns the authorization URL that should be opened in a browser.
   */
  async function startAuthFlow(mcpName: string): Promise<{ authorizationUrl: string; flow?: PendingOAuthFlow }> {
    const cfg = await Config.get()
    const config = (cfg.mcp ?? {}) as NonNullable<Config.Info["mcp"]>
    const mcpConfig = requireMcpEntry(config, mcpName)

    if (!isMcpConfigured(mcpConfig)) {
      throw new Error(`MCP server ${mcpName} is disabled or missing configuration`)
    }

    if (mcpConfig.type !== "remote") {
      throw new Error(`MCP server ${mcpName} is not a remote server`)
    }

    if (mcpConfig.oauth === false) {
      throw new Error(`MCP server ${mcpName} has OAuth explicitly disabled`)
    }
    const s = await state()
    const ownerIdentity = mcpConfigIdentity(mcpConfig)
    const ownerGeneration = s.durableGeneration[mcpName]
    if (s.durableIdentity[mcpName] !== ownerIdentity || ownerGeneration === undefined) {
      throw new Error(`MCP server ${mcpName} configuration changed before OAuth startup`)
    }
    const assertCurrentOAuthOwner = async (stage: string) => {
      const current = (await Config.get()).mcp?.[mcpName]
      if (
        !current ||
        mcpConfigIdentity(current) !== ownerIdentity ||
        s.durableGeneration[mcpName] !== ownerGeneration
      ) {
        throw new Error(`MCP server ${mcpName} configuration changed ${stage}`)
      }
    }
    await Promise.all(
      [...(s.connectionCleanupPending.get(mcpName) ?? [])].map((connection) =>
        settleConnectionCleanup(s, mcpName, connection),
      ),
    )
    await assertCurrentOAuthOwner("while OAuth cleanup was settling")
    const authTimeout = effectiveTimeout(mcpConfig, cfg.experimental?.mcp_timeout)

    // Start the callback server. It is an adapter over a port; the durable
    // credential store, not the listener's own map, decides which states name
    // live flows and what finishing one means.
    await McpOAuthCallback.ensureRunning(durableFlowAuthority(Instance.directory))
    await assertCurrentOAuthOwner("while the OAuth callback server was starting")

    // Generate and store a cryptographically secure state parameter BEFORE creating the provider
    // The SDK will call provider.state() to read this value
    const oauthState = Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
    const correlationID = crypto.randomUUID()
    const authKey = mcpAuthKey(mcpName)
    const previousFlow = pendingOAuthFlows.get(authKey)
    if (previousFlow) McpOAuthCallback.cancelPending(authKey)
    pendingOAuthFlows.delete(authKey)
    await assertCredentialIdentity(mcpName, mcpConfig)
    const oauthConfig = typeof mcpConfig.oauth === "object" ? mcpConfig.oauth : undefined
    const oauthProviderConfig = {
      clientId: oauthConfig?.clientId,
      clientSecret: oauthConfig?.clientSecret,
      scope: oauthConfig?.scope,
    }
    // Revoking the previous flow and establishing this one's lease is one
    // store write, so no competitor can read the superseded generation as
    // current in between. The lease carries the server identity from the
    // start: a bare entry with no serverUrl sits in credential
    // reconciliation's stale class, and any concurrent project-config commit
    // would collect it out from under the flow.
    const authRevision = await McpAuth.beginCredentialLease(
      authKey,
      mcpConfig.url,
      McpOAuthProvider.credentialIdentity(mcpConfig.url, oauthProviderConfig),
    )
    await McpAuth.updateOAuthState(
      authKey,
      oauthState,
      authRevision,
      mcpConfig.url,
      McpOAuthProvider.credentialIdentity(mcpConfig.url, oauthProviderConfig),
    )
    try {
      await assertCurrentOAuthOwner("while OAuth state was being prepared")
    } catch (ownerError) {
      try {
        await McpAuth.clearOAuthStateIfOwned(authKey, authRevision)
      } catch (cleanupError) {
        throw new AggregateError(
          [ownerError, cleanupError],
          `MCP server ${mcpName} OAuth ownership and state cleanup failed`,
        )
      }
      throw ownerError
    }

    // Create a new auth provider for this flow
    // OAuth config is optional - if not provided, we'll use auto-discovery
    let capturedUrl: URL | undefined
    const authProvider = new McpOAuthProvider(
      mcpName,
      authKey,
      mcpConfig.url,
      oauthProviderConfig,
      {
        onRedirect: async (url) => {
          capturedUrl = url
        },
      },
      authRevision,
      () => assertCredentialIdentity(mcpName, mcpConfig),
      oauthState,
      correlationID,
    )

    const { transport } = createRemoteTransport(mcpConfig, authProvider, mcpFetchRequestInit(authTimeout))
    let client: Client | undefined
    let retainOAuthState = false
    let businessResult: { authorizationUrl: string; flow?: PendingOAuthFlow } | undefined
    let businessError: unknown

    // Try to connect - this will trigger the OAuth flow
    try {
      client = new Client({
        name: "opencorvus",
        version: Installation.VERSION,
      })
      await client.connect(transport, mcpRequestOptions(authTimeout))
      await assertCurrentOAuthOwner("before the OAuth probe result was published")
      // If we get here, we're already authenticated
      businessResult = { authorizationUrl: "" }
    } catch (error) {
      if (error instanceof UnauthorizedError && capturedUrl) {
        try {
          await assertCurrentOAuthOwner("before the OAuth authorization flow was published")
          if ((await McpAuth.revision(authKey)) !== authRevision) {
            throw new Error(`MCP auth lease was revoked: ${authKey}`)
          }
          pendingOAuthFlows.set(authKey, { state: oauthState, revision: authRevision, correlationID })
          retainOAuthState = true
          businessResult = {
            authorizationUrl: capturedUrl.toString(),
            flow: { state: oauthState, revision: authRevision, correlationID },
          }
        } catch (ownerError) {
          businessError = ownerError
        }
      } else {
        businessError = error
      }
    }

    let authStateCleanupError: unknown
    if (!retainOAuthState) {
      try {
        if (pendingOAuthFlows.get(authKey)?.revision === authRevision) pendingOAuthFlows.delete(authKey)
        await McpAuth.clearOAuthStateIfOwned(authKey, authRevision)
      } catch (error) {
        authStateCleanupError = error
      }
    }
    try {
      await closeClientAndTransport(mcpName, client, transport)
    } catch (cleanupError) {
      const cleanup = cleanupConnection(mcpName, mcpConfig, client, transport)
      cleanup.ownerGeneration = ownerGeneration
      queueConnectionCleanup(s, mcpName, cleanup)
      log.warn("OAuth probe cleanup remains pending", {
        mcpName,
        error: errorMessage(cleanupError),
      })
    }
    if (businessResult && !businessError) {
      try {
        await assertCurrentOAuthOwner("before the OAuth result returned")
        if (retainOAuthState) {
          const pending = pendingOAuthFlows.get(authKey)
          if (
            (await McpAuth.revision(authKey)) !== authRevision ||
            pending?.revision !== authRevision ||
            pending.state !== oauthState
          ) {
            throw new Error(`MCP auth lease was revoked: ${authKey}`)
          }
        }
      } catch (ownerError) {
        businessError = ownerError
        if (retainOAuthState) {
          const pending = pendingOAuthFlows.get(authKey)
          if (pending?.revision === authRevision && pending.state === oauthState) {
            pendingOAuthFlows.delete(authKey)
            McpOAuthCallback.cancelPending(authKey)
          }
          try {
            await McpAuth.clearOAuthStateIfOwned(authKey, authRevision)
          } catch (cleanupError) {
            authStateCleanupError = cleanupError
          }
          retainOAuthState = false
        }
      }
    }
    if (businessError && authStateCleanupError) {
      throw new AggregateError(
        [businessError, authStateCleanupError],
        `MCP server ${mcpName} OAuth startup and state cleanup failed`,
      )
    }
    if (businessError) throw businessError
    if (authStateCleanupError) throw authStateCleanupError
    return businessResult!
  }

  export async function startAuth(mcpName: string): Promise<{ authorizationUrl: string }> {
    const result = await startAuthFlow(mcpName)
    return { authorizationUrl: result.authorizationUrl }
  }

  /**
   * Complete OAuth authentication after user authorizes in browser.
   * Opens the browser and waits for callback.
   */
  export async function authenticate(mcpName: string): Promise<Status> {
    const { authorizationUrl, flow } = await startAuthFlow(mcpName)

    if (!authorizationUrl) {
      // Already authenticated
      const s = await state()
      return s.status[mcpName] ?? { status: "connected" }
    }

    // Get the state that was already generated and stored in startAuth()
    const authKey = mcpAuthKey(mcpName)
    if (!flow) {
      throw new Error("OAuth state not found - this should not happen")
    }
    const oauthState = flow.state

    // The SDK has already added the state parameter to the authorization URL
    // We just need to open the browser
    log.info(
      "opening browser for oauth",
      oauthAuthorizationLogFields({
        mcpName,
        authorizationUrl,
        correlationID: flow.correlationID,
      }),
    )

    // Register the callback BEFORE opening the browser to avoid race condition
    // when the IdP has an active SSO session and redirects immediately
    // Register under the project-scoped auth key so same-name MCP servers
    // in different active projects keep independent callback ownership.
    const callbackSettlement = McpOAuthCallback.waitForCallbackSettlement(oauthState, authKey, flow.correlationID)

    try {
      const subprocess = await open(authorizationUrl)
      // The open package spawns a detached process and returns immediately.
      // We need to listen for errors which fire asynchronously:
      // - "error" event: command not found (ENOENT)
      // - "exit" with non-zero code: command exists but failed (e.g., no display)
      await new Promise<void>((resolve, reject) => {
        // Give the process a moment to fail if it's going to
        const timeout = setTimeout(() => resolve(), 500)
        subprocess.on("error", (error) => {
          clearTimeout(timeout)
          reject(error)
        })
        subprocess.on("exit", (code) => {
          if (code !== null && code !== 0) {
            clearTimeout(timeout)
            reject(new Error(`Browser open failed with exit code ${code}`))
          }
        })
      })
    } catch (error) {
      // Browser opening failed (e.g., in remote/headless sessions like SSH, devcontainers)
      // Emit event so CLI can display the URL for manual opening
      log.warn("failed to open browser, user must open URL manually", { mcpName, error })
      Bus.publishOwned(BrowserOpenFailed, { mcpName, url: authorizationUrl })
    }

    // Wait for callback using the already-registered promise
    const callback = await callbackSettlement
    if (callback.status === "rejected") throw callback.error

    return finishAuthCallback(mcpName, callback.code, oauthState)
  }

  /**
   * Rebuild a flow owner from the durable credential entry.
   *
   * The flow's facts — its OAuth state, its PKCE verifier and its lease
   * generation — are all durable; only the in-process owner record is not. A
   * process restart between authorize and callback therefore used to reject a
   * completion whose every durable fact matched. The rebuilt owner carries the
   * durable lease generation, so all of its writes stay exactly as fenced as
   * the original flow's.
   */
  /**
   * The durable owner of this project's OAuth flows.
   *
   * A callback can arrive with no caller waiting for it in this process — the
   * waiter timed out, its flow was cancelled and re-minted, or the listener
   * outlived the `authenticate` call that started it. None of that makes the
   * callback forged, and every fact the completion needs is already durable.
   * The listener asks here instead of reading its own map's emptiness as
   * evidence of an attack.
   */
  function durableFlowAuthority(directory: string): McpOAuthCallback.CallbackAuthority {
    async function inProject<R>(label: string, fn: () => Promise<R>): Promise<R> {
      const outcome = await reenterActiveInstance({ directory, fn: async () => ({ value: await fn() }) })
      if (!outcome) throw new Error(`Cannot ${label}: project ${directory} is no longer active`)
      return outcome.value
    }

    return {
      resolveState(oauthState) {
        return inProject("resolve the OAuth callback's flow", async () => {
          const prefix = `${Instance.project.id}:`
          for (const [authKey, entry] of Object.entries(await McpAuth.all())) {
            if (!authKey.startsWith(prefix) || entry.oauthState !== oauthState) continue
            return { mcpName: authKey.slice(prefix.length) }
          }
          return undefined
        })
      },
      async finish(input) {
        await inProject("finish the OAuth flow", () =>
          finishAuthCallback(input.mcpName, input.authorizationCode, input.oauthState),
        )
      },
    }
  }

  async function rebuildPendingOAuthFlowFromDurableFacts(authKey: string): Promise<PendingOAuthFlow | undefined> {
    const entry = await McpAuth.get(authKey)
    if (!entry?.oauthState || !entry.codeVerifier || !entry.revision) return undefined
    return { state: entry.oauthState, revision: entry.revision, correlationID: crypto.randomUUID() }
  }

  async function assertOAuthState(mcpName: string, authKey: string, oauthState: string): Promise<PendingOAuthFlow> {
    let owner = pendingOAuthFlows.get(authKey)
    if (owner && owner.state !== oauthState) {
      // A stale in-memory owner must not veto the durable fact another
      // process minted since: if the durable state matches the callback, the
      // durable flow is the current one and the local record is dropped.
      const rebuilt = await rebuildPendingOAuthFlowFromDurableFacts(authKey)
      if (rebuilt?.state === oauthState) {
        if (pendingOAuthFlows.get(authKey) === owner) pendingOAuthFlows.delete(authKey)
        owner = rebuilt
      }
    }
    owner ??= await rebuildPendingOAuthFlowFromDurableFacts(authKey)
    if (!owner) {
      throw new OAuthStateError({ mcpName, message: "OAuth flow is no longer current" })
    }
    if (owner.state !== oauthState) {
      throw new OAuthStateError({ mcpName, message: "OAuth state mismatch - potential CSRF attack" })
    }
    const storedState = await McpAuth.getOAuthState(authKey)
    if (!storedState) {
      if (pendingOAuthFlows.get(authKey) === owner) pendingOAuthFlows.delete(authKey)
      throw new OAuthStateError({ mcpName, message: "OAuth state not found" })
    }
    if (storedState !== oauthState) {
      await McpAuth.clearOAuthStateIfOwned(authKey, owner.revision)
      if (pendingOAuthFlows.get(authKey) === owner) pendingOAuthFlows.delete(authKey)
      throw new OAuthStateError({ mcpName, message: "OAuth state mismatch - potential CSRF attack" })
    }
    return owner
  }

  export async function finishAuthCallback(
    mcpName: string,
    authorizationCode: string,
    oauthState: string,
  ): Promise<Status> {
    const cfg = await Config.get()
    const config = (cfg.mcp ?? {}) as NonNullable<Config.Info["mcp"]>
    const mcpConfig = requireMcpEntry(config, mcpName)
    if (!isMcpConfigured(mcpConfig)) {
      throw new Error(`MCP server ${mcpName} is disabled or missing configuration`)
    }
    if (mcpConfig.type !== "remote") {
      throw new Error(`MCP server ${mcpName} is not a remote server`)
    }
    const authKey = mcpAuthKey(mcpName)
    const owner = await assertOAuthState(mcpName, authKey, oauthState)
    try {
      return await finishAuth(mcpName, authorizationCode, owner)
    } finally {
      await McpAuth.clearOAuthStateIfOwned(authKey, owner.revision)
      if (pendingOAuthFlows.get(authKey) === owner) pendingOAuthFlows.delete(authKey)
    }
  }

  /**
   * Complete OAuth authentication with the authorization code. Private and
   * flow-required: the ONLY finish path is finishAuthCallback, whose
   * assertOAuthState resolves the owner — live or rebuilt from the durable
   * facts — under the state fence. There is no second, weaker finish.
   */
  async function finishAuth(mcpName: string, authorizationCode: string, flow: PendingOAuthFlow): Promise<Status> {
    const cfg = await Config.get()
    const config = (cfg.mcp ?? {}) as NonNullable<Config.Info["mcp"]>
    const mcpConfig = requireMcpEntry(config, mcpName)
    const authKey = mcpAuthKey(mcpName)

    const owner = flow
    if (!isMcpConfigured(mcpConfig)) {
      throw new Error(`MCP server ${mcpName} is disabled or missing configuration`)
    }
    if (mcpConfig.type !== "remote") {
      throw new Error(`MCP server ${mcpName} is not a remote server`)
    }
    const oauthConfig = typeof mcpConfig.oauth === "object" ? mcpConfig.oauth : undefined
    const authRevision = owner.revision
    const authProvider = new McpOAuthProvider(
      mcpName,
      authKey,
      mcpConfig.url,
      {
        clientId: oauthConfig?.clientId,
        clientSecret: oauthConfig?.clientSecret,
        scope: oauthConfig?.scope,
      },
      {
        onRedirect: async () => {},
      },
      authRevision,
      () => assertCredentialIdentity(mcpName, mcpConfig),
      undefined,
      owner.correlationID,
    )
    const authTimeout = effectiveTimeout(mcpConfig, cfg.experimental?.mcp_timeout)
    const { transport } = createRemoteTransport(mcpConfig, authProvider, mcpFetchRequestInit(authTimeout))

    try {
      // Call finishAuth on the transport
      await transport.finishAuth(authorizationCode)

      // Clear the code verifier after successful auth
      await McpAuth.clearCodeVerifier(authKey, authRevision)
      await McpAuth.clearOAuthState(authKey, authRevision)

      // Re-add the MCP server to establish connection
      if (pendingOAuthFlows.get(authKey) === owner) pendingOAuthFlows.delete(authKey)
      const result = await add(mcpName, mcpConfig)

      const statusRecord = result.status as Record<string, Status>
      const status = statusRecord[mcpName]
      if (!status) throw new Error("Unknown error after auth")
      if (status.status === "failed") throw new Error(status.error)
      return status
    } catch (error) {
      log.error("failed to finish oauth", { mcpName, correlationID: owner.correlationID, error })
      throw error
    } finally {
      if (pendingOAuthFlows.get(authKey) === owner) pendingOAuthFlows.delete(authKey)
      await closeTransport(mcpName, transport)
    }
  }

  /**
   * Remove OAuth credentials for an MCP server.
   */
  export async function removeAuth(mcpName: string): Promise<void> {
    const cfg = await Config.get()
    const config = (cfg.mcp ?? {}) as NonNullable<Config.Info["mcp"]>
    requireMcpEntry(config, mcpName)
    await removeStoredAuth(mcpName)
  }

  /**
   * Check if an MCP server supports OAuth (remote servers support OAuth by default unless explicitly disabled).
   */
  export async function supportsOAuth(mcpName: string): Promise<boolean> {
    const cfg = await Config.get()
    const config = (cfg.mcp ?? {}) as NonNullable<Config.Info["mcp"]>
    const mcpConfig = requireMcpEntry(config, mcpName)
    if (!isMcpConfigured(mcpConfig)) return false
    return mcpConfig.type === "remote" && mcpConfig.oauth !== false
  }

  /**
   * Check if an MCP server has stored OAuth tokens.
   */
  export async function hasStoredTokens(mcpName: string): Promise<boolean> {
    const entry = await McpAuth.get(mcpAuthKey(mcpName))
    return !!entry?.tokens
  }

  export type AuthStatus = "authenticated" | "expired" | "not_authenticated"

  /**
   * Get the authentication status for an MCP server.
   */
  export async function getAuthStatus(mcpName: string): Promise<AuthStatus> {
    const hasTokens = await hasStoredTokens(mcpName)
    if (!hasTokens) return "not_authenticated"
    const expired = await McpAuth.isTokenExpired(mcpAuthKey(mcpName))
    return expired ? "expired" : "authenticated"
  }

  // ---------------------------------------------------------------------------
  // Scoped MCP capability projections consumed by package and host tool surfaces.
  // ---------------------------------------------------------------------------

  export async function serverPrompts() {
    const promptsMap = await prompts()
    return Object.entries(promptsMap).map(([key, prompt]) => ({
      key,
      name: ((prompt as Record<string, unknown>).name as string) ?? key,
      title: (prompt as Record<string, unknown>).description as string | undefined,
      description: (prompt as Record<string, unknown>).description as string | undefined,
      arguments: (prompt as Record<string, unknown>).arguments,
      client: (prompt as { client?: string }).client ?? key.split("_")[0] ?? key,
    }))
  }

  export async function serverResources() {
    const resourcesMap = await resources()
    return Object.entries(resourcesMap).map(([key, resource]) => ({
      key,
      name: ((resource as Record<string, unknown>).name as string) ?? key,
      title: (resource as Record<string, unknown>).description as string | undefined,
      description: (resource as Record<string, unknown>).description as string | undefined,
      mimeType: (resource as Record<string, unknown>).mimeType as string | undefined,
      uri: ((resource as Record<string, unknown>).uri as string) ?? key,
      client: (resource as { client?: string }).client ?? key.split("_")[0] ?? key,
    }))
  }
}
