import {
  McpUiUpdateModelContextRequestSchema,
  isToolVisibilityModelOnly,
} from "@modelcontextprotocol/ext-apps/app-bridge"
import {
  CallToolRequestSchema,
  CallToolResultSchema,
  ListPromptsRequestSchema,
  ListResourceTemplatesRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
  type CallToolResult,
  type Tool,
} from "@modelcontextprotocol/sdk/types.js"
import { Identifier } from "@/id/id"
import { MCP } from "@/mcp"
import { materializeMcpToolResult, materializedMcpAttachmentsToFileParts } from "@/mcp/materialize"
import { PermissionAuthority } from "@/permission/authority"
import { Instance } from "@/project/instance"
import { Session } from "@/session"
import { MessageStore } from "@/session/message-store"
import { toolFailureCauseFromUnknown } from "@/session/tool-failure-cause"
import { SessionRuntimeContractStore, sessionRuntimeToolRecords } from "@/session/runtime-contract"
import { NotFoundError } from "@/storage/db"
import { projectedTaskToolRuntimeBindingOf } from "@/tool/task-tool-execution-scope"
import { NamedError } from "@opencorvus-ai/util/error"
import z from "zod"
import { findInteractiveArtifact } from "./persist"
import type { InteractiveArtifactRecord } from "./schema"

const MAX_TOOL_PAGES = 100

export const McpAppHostForbiddenError = NamedError.create(
  "McpAppHostForbiddenError",
  z.object({ message: z.string() }),
)

function forbidden(message: string): never {
  throw new McpAppHostForbiddenError({ message })
}

export const McpAppHostRequest = z
  .union([
    CallToolRequestSchema,
    ListToolsRequestSchema,
    ListResourcesRequestSchema,
    ListResourceTemplatesRequestSchema,
    ReadResourceRequestSchema,
    ListPromptsRequestSchema,
    McpUiUpdateModelContextRequestSchema,
  ])
  .meta({ ref: "McpAppHostRequest" })

export type McpAppHostRequest = z.infer<typeof McpAppHostRequest>

const REQUEST_KEYS = new Set(["method", "params"])
const PARAM_KEYS: Record<McpAppHostRequest["method"], ReadonlySet<string>> = {
  "tools/list": new Set(["cursor", "_meta"]),
  "tools/call": new Set(["name", "arguments", "_meta"]),
  "resources/list": new Set(["cursor", "_meta"]),
  "resources/templates/list": new Set(["cursor", "_meta"]),
  "resources/read": new Set(["uri", "_meta"]),
  "prompts/list": new Set(["cursor", "_meta"]),
  "ui/update-model-context": new Set(["content", "structuredContent", "_meta"]),
}

function assertExactRequestAuthority(value: unknown): void {
  if (!value || typeof value !== "object" || Array.isArray(value)) return
  const request = value as Record<string, unknown>
  const unknownRoot = Object.keys(request).find((key) => !REQUEST_KEYS.has(key))
  if (unknownRoot) throw new Error(`MCP App Host request contains unsupported root field ${unknownRoot}`)
  if (typeof request.method !== "string") return
  const allowedParams = PARAM_KEYS[request.method as McpAppHostRequest["method"]]
  if (!allowedParams || request.params === undefined) return
  if (!request.params || typeof request.params !== "object" || Array.isArray(request.params)) return
  const unknownParam = Object.keys(request.params).find((key) => !allowedParams.has(key))
  if (unknownParam) {
    throw new Error(`MCP App Host ${request.method} request contains unsupported parameter ${unknownParam}`)
  }
}

function requireMcpApp(input: { sessionID: string; artifactID: string }): InteractiveArtifactRecord & {
  payload: Extract<InteractiveArtifactRecord["payload"], { renderer: "mcp-app@1" }>
} {
  const artifact = findInteractiveArtifact({
    ...input,
    projectID: Instance.project.id,
  })
  if (!artifact) throw new NotFoundError({ message: `Interactive artifact not found: ${input.artifactID}` })
  if (artifact.payload.renderer !== "mcp-app@1") {
    throw new NotFoundError({ message: `Interactive artifact is not an MCP App: ${input.artifactID}` })
  }
  return artifact as InteractiveArtifactRecord & {
    payload: Extract<InteractiveArtifactRecord["payload"], { renderer: "mcp-app@1" }>
  }
}

async function withArtifactMcpClient<T>(
  artifact: ReturnType<typeof requireMcpApp>,
  run: (
    client: Parameters<Parameters<typeof MCP.withAppClient>[1]>[0],
    timeout: number,
  ) => Promise<T>,
): Promise<T> {
  const authority = artifact.payload.server.authority
  if (authority.kind === "configured") {
    return MCP.withAppClient(
      {
        serverID: artifact.payload.server.id,
        configDigest: artifact.payload.server.configDigest,
      },
      run,
    )
  }
  const contract = SessionRuntimeContractStore.get(artifact.sessionID)
  if (!contract) {
    forbidden(
      `MCP App expert-squad authority ${authority.expertSquadID} is inactive for session ${artifact.sessionID}`,
    )
  }
  if (
    contract.identity.taskID !== authority.taskID ||
    contract.identity.expertSquadID !== authority.expertSquadID ||
    contract.identity.agentID !== authority.agentID ||
    contract.identity.projectionHash !== authority.projectionHash
  ) {
    forbidden("MCP App expert-squad authority does not match the active session runtime contract")
  }
  const runtimeTool = sessionRuntimeToolRecords(contract).projectedTools[authority.providerName]
  const projected = projectedTaskToolRuntimeBindingOf(runtimeTool)
  if (
    !runtimeTool ||
    !projected ||
    projected.taskID !== authority.taskID ||
    projected.expertSquadID !== authority.expertSquadID ||
    projected.agentID !== authority.agentID ||
    projected.projectionHash !== authority.projectionHash ||
    projected.providerKind !== authority.providerKind ||
    projected.toolRef !== authority.toolRef ||
    projected.providerName !== authority.providerName ||
    projected.mcpServerConfigSHA256 !== authority.mcpServerConfigSHA256
  ) {
    forbidden("MCP App expert-squad authority is stale or no longer projected by the active runtime")
  }
  const binding = MCP.appToolBinding(runtimeTool)
  if (
    !binding ||
    binding.serverID !== artifact.payload.server.id ||
    binding.configDigest !== artifact.payload.server.configDigest ||
    binding.tool.name !== artifact.payload.tool.name ||
    binding.resourceURI !== artifact.payload.resource.uri
  ) {
    forbidden("MCP App expert-squad runtime binding does not match the durable artifact authority")
  }
  return MCP.withBoundAppClient(binding, run)
}

function runtimeToolName(serverID: string, toolName: string): string {
  const safeServer = serverID.replace(/[^a-zA-Z0-9_-]/g, "_")
  const safeTool = toolName.replace(/[^a-zA-Z0-9_-]/g, "_")
  return `${safeServer}_${safeTool}`
}

async function findAppVisibleTool(
  client: Parameters<Parameters<typeof MCP.withAppClient>[1]>[0],
  timeout: number,
  name: string,
): Promise<Tool> {
  let cursor: string | undefined
  const seen = new Set<string>()
  for (let pageIndex = 0; pageIndex < MAX_TOOL_PAGES; pageIndex++) {
    const result = await client.listTools(cursor ? { cursor } : undefined, { timeout })
    const tool = result.tools.find((candidate) => candidate.name === name)
    if (tool) {
      if (isToolVisibilityModelOnly(tool)) {
        forbidden(`MCP App cannot call model-only tool ${name}`)
      }
      return tool
    }
    cursor = result.nextCursor
    if (!cursor) throw new Error(`MCP App tool not found on the bound server: ${name}`)
    if (seen.has(cursor)) throw new Error(`MCP tool listing repeated pagination cursor ${cursor}`)
    seen.add(cursor)
  }
  throw new Error(`MCP tool listing exceeded ${MAX_TOOL_PAGES} pages`)
}

function appContextText(
  artifact: ReturnType<typeof requireMcpApp>,
  params: z.infer<typeof McpUiUpdateModelContextRequestSchema>["params"],
): string {
  const content = (params.content ?? []).map((item) => {
    if (item.type !== "text") {
      throw new Error(`OpenCorvus MCP App context currently accepts text content only, received ${item.type}`)
    }
    return item.text
  })
  if (params.structuredContent && Object.keys(params.structuredContent).length > 0) {
    content.push(`Structured context:\n${JSON.stringify(params.structuredContent, null, 2)}`)
  }
  if (content.length === 0) return ""
  return `[MCP App context: ${artifact.payload.title}]\n${content.join("\n\n")}`
}

async function updateModelContext(
  artifact: ReturnType<typeof requireMcpApp>,
  params: z.infer<typeof McpUiUpdateModelContextRequestSchema>["params"],
): Promise<Record<string, never>> {
  const metadata = { origin: "mcp-app-context", artifactID: artifact.id }
  const existing = (await MessageStore.parts(artifact.messageID)).find(
    (part) =>
      part.type === "text" && part.metadata?.origin === metadata.origin && part.metadata?.artifactID === artifact.id,
  )
  const text = appContextText(artifact, params)
  if (!text) {
    if (existing) {
      await Session.removePart({
        sessionID: artifact.sessionID,
        messageID: artifact.messageID,
        partID: existing.id,
      })
    }
    return {}
  }
  await Session.updatePart({
    id: existing?.id ?? Identifier.ascending("part"),
    sessionID: artifact.sessionID,
    messageID: artifact.messageID,
    type: "text",
    text,
    kind: "context",
    source: "mcp_app",
    metadata,
  })
  return {}
}

function terminalTime(start: number): number {
  return Math.max(Date.now(), start + 1)
}

async function callTool(input: {
  artifact: ReturnType<typeof requireMcpApp>
  params: z.infer<typeof CallToolRequestSchema>["params"]
  signal?: AbortSignal
  client: Parameters<Parameters<typeof MCP.withAppClient>[1]>[0]
  timeout: number
}): Promise<CallToolResult> {
  await Session.getInProject({
    sessionID: input.artifact.sessionID,
    projectID: Instance.project.id,
  })
  const currentTool = await findAppVisibleTool(input.client, input.timeout, input.params.name)
  const args = input.params.arguments ?? {}
  const toolName = runtimeToolName(input.artifact.payload.server.id, currentTool.name)
  const callID = Identifier.ascending("call")
  const partID = Identifier.ascending("part")
  const start = Date.now()
  const source = {
    origin: "mcp-app",
    artifactID: input.artifact.id,
    serverID: input.artifact.payload.server.id,
    toolName: currentTool.name,
  }

  await Session.updatePart({
    id: partID,
    sessionID: input.artifact.sessionID,
    messageID: input.artifact.messageID,
    type: "tool",
    callID,
    tool: toolName,
    metadata: source,
    state: {
      status: "running",
      input: args,
      title: currentTool.title ?? currentTool.name,
      metadata: source,
      time: { start },
    },
  })

  try {
    const result = CallToolResultSchema.parse(
      await PermissionAuthority.authorizeAndExecute(
        {
          projectID: Instance.project.id,
          sessionID: input.artifact.sessionID,
          messageID: input.artifact.messageID,
          toolCallID: callID,
          toolPartID: partID,
          providerKind: "mcp_app",
          providerID: input.artifact.payload.server.id,
          providerDigest: `${input.artifact.payload.server.configDigest}:${MCP.toolDefinitionDigest(currentTool)}`,
          toolName,
          args: {
            arguments: args,
            destructiveHint: currentTool.annotations?.destructiveHint === true,
          },
        },
        () =>
          MCP.callToolWithTaskRecovery({
            client: input.client,
            tool: currentTool,
            args,
            timeout: input.timeout,
            signal: input.signal,
          }),
      ),
    )
    const materialized = await materializeMcpToolResult({
      projectID: Instance.project.id,
      result,
      serverName: input.artifact.payload.server.id,
    })
    await Session.updatePart({
      id: partID,
      sessionID: input.artifact.sessionID,
      messageID: input.artifact.messageID,
      type: "tool",
      callID,
      tool: toolName,
      metadata: source,
      state: {
        status: "completed",
        input: args,
        output: materialized.text,
        title: currentTool.title ?? currentTool.name,
        metadata: { ...materialized.metadata, ...source },
        attachments: materializedMcpAttachmentsToFileParts({
          attachments: materialized.attachments,
          sessionID: input.artifact.sessionID,
          messageID: input.artifact.messageID,
        }),
        time: { start, end: terminalTime(start) },
      },
    })
    return result
  } catch (error) {
    await Session.updatePart({
      id: partID,
      sessionID: input.artifact.sessionID,
      messageID: input.artifact.messageID,
      type: "tool",
      callID,
      tool: toolName,
      metadata: source,
      state: {
        status: "error",
        input: args,
        failure: toolFailureCauseFromUnknown({
          error,
          originSite: "interactive-artifact.mcp-app-host",
          classification: "tool-execution",
        }),
        metadata: source,
        time: { start, end: terminalTime(start) },
      },
    })
    throw error
  }
}

export async function handleMcpAppHostRequest(input: {
  sessionID: string
  artifactID: string
  request: unknown
  signal?: AbortSignal
}): Promise<unknown> {
  const artifact = requireMcpApp(input)
  assertExactRequestAuthority(input.request)
  const request = McpAppHostRequest.parse(input.request)
  if (request.method === "ui/update-model-context") {
    return updateModelContext(artifact, request.params)
  }
  return withArtifactMcpClient(
    artifact,
    async (client, timeout) => {
      switch (request.method) {
        case "tools/list": {
          const result = await client.listTools(request.params, { timeout, signal: input.signal })
          return {
            ...result,
            tools: result.tools.filter((tool) => !isToolVisibilityModelOnly(tool)),
          }
        }
        case "tools/call":
          return callTool({
            artifact,
            params: request.params,
            signal: input.signal,
            client,
            timeout,
          })
        case "resources/list":
          return client.listResources(request.params, { timeout, signal: input.signal })
        case "resources/templates/list":
          return client.listResourceTemplates(request.params, { timeout, signal: input.signal })
        case "resources/read":
          return client.readResource(request.params, { timeout, signal: input.signal })
        case "prompts/list":
          return client.listPrompts(request.params, { timeout, signal: input.signal })
      }
    },
  )
}
