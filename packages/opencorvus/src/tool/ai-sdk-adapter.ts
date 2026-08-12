import { tool } from "ai"
import type { Tool } from "./tool"
import { currentTaskToolInvocationSurface } from "./task-tool-invocation"
import { resolveSessionExecutionAuthority } from "@/engine/task-session-lineage"

type InitializedTool = Awaited<ReturnType<Tool.Info["init"]>>
type ToolExecutionResult = Awaited<ReturnType<InitializedTool["execute"]>>

type AiSdkExecutionOptions = {
  toolCallId?: unknown
  abortSignal?: AbortSignal
  opencorvus?: {
    projectID?: unknown
    sessionID?: unknown
    messageID?: unknown
    toolCallID?: unknown
    toolPartID?: unknown
    providerName?: unknown
    invocationAuthority?: unknown
  }
}

export type ToolInfoAiSdkAdapterInput = {
  info: Tool.Info
  agent: string
  taskID?: string
  signal?: AbortSignal
  initCtx?: Tool.InitContext
  beforeExecute?: (args: unknown) => void | Promise<void>
  afterExecute?: (args: unknown, result: ToolExecutionResult) => void | Promise<void>
  onExecuteError?: (args: unknown, error: unknown) => void | Promise<void>
}

export async function createAiSdkToolFromInfo(input: ToolInfoAiSdkAdapterInput) {
  const initialized = await input.info.init(input.initCtx)
  return tool({
    description: initialized.description,
    inputSchema: initialized.parameters,
    execute: async (args, options) => {
      const execution = requireAiSdkToolExecutionContext(options, input.info.id)
      const abort =
        (options as AiSdkExecutionOptions | undefined)?.abortSignal ?? input.signal ?? new AbortController().signal
      await input.beforeExecute?.(args)
      try {
        if (!input.taskID) throw new Error(`${input.info.id} requires explicit Task execution authority`)
        const executionAuthority = await resolveSessionExecutionAuthority({
          sessionID: execution.sessionID,
          projectID: execution.projectID,
          expected: { kind: "task", taskID: input.taskID },
        })
        const result = await initialized.execute(args as never, {
          sessionID: execution.sessionID,
          messageID: execution.messageID,
          callID: execution.toolCallID,
          agent: input.agent,
          abort,
          messages: [],
          executionAuthority,
          executionSurface: execution.executionSurface,
          extra: {
            taskID: input.taskID,
            projectID: execution.projectID,
            toolPartID: execution.toolPartID,
            invocationAuthority: execution.invocationAuthority,
          },
          metadata: () => {},
        })
        await input.afterExecute?.(args, result)
        return result
      } catch (error) {
        await input.onExecuteError?.(args, error)
        throw error
      }
    },
  })
}

function requireAiSdkToolExecutionContext(options: unknown, toolName: string) {
  const sdk = options as AiSdkExecutionOptions | undefined
  const meta = sdk?.opencorvus
  const requireField = (name: keyof NonNullable<AiSdkExecutionOptions["opencorvus"]>) => {
    const value = meta?.[name]
    return typeof value === "string" && value.trim().length > 0 ? value : undefined
  }
  const projectID = requireField("projectID")
  const sessionID = requireField("sessionID")
  const messageID = requireField("messageID")
  const toolCallID = requireField("toolCallID")
  const toolPartID = requireField("toolPartID")
  const providerName = requireField("providerName")
  if (!projectID || !sessionID || !messageID || !toolCallID || !toolPartID || !providerName) {
    throw new Error(
      `${toolName}: missing real tool execution identity; refusing to run because ownership cannot be tied to a persisted message.`,
    )
  }
  if (sdk?.toolCallId !== toolCallID) {
    throw new Error(`${toolName}: AI SDK tool call ID does not match the persisted execution call ID.`)
  }
  const identity = { projectID, sessionID, messageID, toolCallID, toolPartID, providerName }
  return {
    projectID,
    sessionID,
    messageID,
    toolCallID,
    toolPartID,
    invocationAuthority: meta?.invocationAuthority,
    executionSurface: currentTaskToolInvocationSurface(meta?.invocationAuthority, identity),
  }
}
