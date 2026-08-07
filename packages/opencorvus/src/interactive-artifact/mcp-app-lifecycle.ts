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
