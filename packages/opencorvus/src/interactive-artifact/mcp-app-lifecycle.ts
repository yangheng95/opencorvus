import { Identifier } from "@/id/id"
import { MCP } from "@/mcp"
import { Instance } from "@/project/instance"
import { Session } from "@/session"
import {
  projectedTaskToolRuntimeBindingOf,
  type ProjectedTaskToolRuntimeBinding,
} from "@/tool/task-tool-execution-scope"
import { materializeMcpAppArtifact } from "./mcp-app"
import { updateMcpAppToolLifecycle } from "./persist"
import { McpAppToolLifecycle, type InteractiveArtifactRecord } from "./schema"
import { canonicalDigestSource, canonicalJSONValue } from "@/util/canonical-digest"

type ExpertSquadAuthority = {
  kind: "expert-squad"
  taskID: string
  expertSquadID: string
  agentID: string
  projectionHash: string
  providerKind: "package-mcp-tool" | "default-mcp-tool"
  toolRef: string
  providerName: string
  mcpServerConfigSHA256: string
}

export type McpAppAuthority = { kind: "configured" } | ExpertSquadAuthority

export type McpAppToolLifecycleIdentity = Readonly<{
  session_id: string
  message_id: string
  server_id: string
  config_digest: string
  tool_definition_digest: string
  resource_uri: string
  authority: McpAppAuthority
}>

export class McpAppToolLifecycleOwnerConflictError extends Error {
  override readonly name = "McpAppToolLifecycleOwnerConflictError"

  constructor(
    public readonly tool_name: string,
    public readonly existing_identity: McpAppToolLifecycleIdentity,
    public readonly candidate_identity: McpAppToolLifecycleIdentity,
  ) {
    super(`MCP App lifecycle owner conflict for provider Tool ${tool_name}`)
  }
}

function expertSquadAuthority(binding: ProjectedTaskToolRuntimeBinding): ExpertSquadAuthority {
  if (
    (binding.providerKind !== "package-mcp-tool" && binding.providerKind !== "default-mcp-tool") ||
    !binding.mcpServerConfigSHA256
  ) {
    throw new Error(`Projected MCP App tool ${binding.providerName} has no exact MCP server configuration identity`)
  }
  return {
    kind: "expert-squad",
    taskID: binding.taskID,
    expertSquadID: binding.expertSquadID,
    agentID: binding.agentID,
    projectionHash: binding.projectionHash,
    providerKind: binding.providerKind,
    toolRef: binding.toolRef,
    providerName: binding.providerName,
    mcpServerConfigSHA256: binding.mcpServerConfigSHA256,
  }
}

export function mcpAppAuthorityForRuntimeTool(tool: object): McpAppAuthority {
  const projected = projectedTaskToolRuntimeBindingOf(tool)
  return projected ? expertSquadAuthority(projected) : { kind: "configured" }
}

type RunningArtifact = {
  artifact: InteractiveArtifactRecord
  input: Record<string, unknown>
}

export function createMcpAppToolLifecycle(input: {
  sessionID: string
  messageID: string
  binding: MCP.AppToolBinding
  authority: McpAppAuthority
}) {
  const identity: McpAppToolLifecycleIdentity = Object.freeze({
    session_id: input.sessionID,
    message_id: input.messageID,
    server_id: input.binding.serverID,
    config_digest: input.binding.configDigest,
    tool_definition_digest: MCP.toolDefinitionDigest(input.binding.tool),
    resource_uri: input.binding.resourceURI,
    authority: Object.freeze({ ...input.authority }),
  })
  const identitySha256 = canonicalDigestSource("mcp-app-tool-lifecycle-identity-v1", identity).sha256
  const calls = new Map<string, Promise<RunningArtifact>>()

  const start = (toolCallID: string): Promise<RunningArtifact> => {
    let pending = calls.get(toolCallID)
    if (pending) return pending
    pending = (async () => {
      const artifact = await materializeMcpAppArtifact({
        sessionID: input.sessionID,
        messageID: input.messageID,
        binding: input.binding,
        authority: input.authority,
        lifecycle: {
          status: "input-streaming",
          partialInput: {},
        },
      })
      await Session.updatePart({
        type: "interactive-artifact",
        artifactID: artifact.id,
        id: Identifier.ascending("part"),
        sessionID: input.sessionID,
        messageID: input.messageID,
      })
      return { artifact, input: {} }
    })()
    calls.set(toolCallID, pending)
    pending.catch(() => calls.delete(toolCallID))
    return pending
  }

  const update = async (
    toolCallID: string,
    lifecycle:
      | { status: "input-streaming"; partialInput: Record<string, unknown> }
      | { status: "running"; input: Record<string, unknown> }
      | { status: "completed"; input: Record<string, unknown>; result: unknown }
      | { status: "cancelled"; input: Record<string, unknown>; reason?: string }
      | { status: "error"; input: Record<string, unknown>; message: string },
  ) => {
    const current = await start(toolCallID)
    if ("input" in lifecycle) current.input = lifecycle.input
    return updateMcpAppToolLifecycle({
      sessionID: input.sessionID,
      artifactID: current.artifact.id,
      projectID: Instance.project.id,
      lifecycle: McpAppToolLifecycle.parse(lifecycle),
    })
  }

  return {
    identity,
    identitySha256,
    started(toolCallID: string) {
      return calls.has(toolCallID)
    },
    start,
    partial(toolCallID: string, partialInput: Record<string, unknown>) {
      return update(toolCallID, { status: "input-streaming", partialInput })
    },
    input(toolCallID: string, toolInput: Record<string, unknown>) {
      return update(toolCallID, { status: "running", input: toolInput })
    },
    complete(toolCallID: string, toolInput: Record<string, unknown>, result: unknown) {
      return update(toolCallID, { status: "completed", input: toolInput, result })
    },
    cancel(toolCallID: string, toolInput: Record<string, unknown>, reason?: string) {
      return update(toolCallID, {
        status: "cancelled",
        input: toolInput,
        ...(reason?.trim() ? { reason: reason.trim().slice(0, 2_000) } : {}),
      })
    },
    fail(toolCallID: string, toolInput: Record<string, unknown>, error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      return update(toolCallID, {
        status: "error",
        input: toolInput,
        message: (message.trim() || "MCP App tool execution failed").slice(0, 2_000),
      })
    },
  }
}

export type McpAppToolLifecycleController = ReturnType<typeof createMcpAppToolLifecycle>

export function registerMcpAppToolLifecycleController(
  registry: Map<string, McpAppToolLifecycleController>,
  toolName: string,
  candidate: McpAppToolLifecycleController,
): McpAppToolLifecycleController {
  const existing = registry.get(toolName)
  if (!existing) {
    registry.set(toolName, candidate)
    return candidate
  }
  if (
    existing.identitySha256 !== candidate.identitySha256 ||
    canonicalJSONValue(existing.identity) !== canonicalJSONValue(candidate.identity)
  ) {
    throw new McpAppToolLifecycleOwnerConflictError(toolName, existing.identity, candidate.identity)
  }
  return existing
}
