import type { ToolSet } from "ai"
import { createAiSdkToolFromInfo } from "@/tool/ai-sdk-adapter"
import { RequestOrchestratorDecisionTool } from "@/tool/request-orchestrator-decision"
import { SendMailboxMessageTool } from "@/tool/send-mailbox-message"

/**
 * A2A (Agent-to-Agent) worker communication runtime tools.
 * Exact runtime contracts skip the global registry, so task workers must merge
 * this helper into their concrete runAgentSession toolKit.
 */
export async function createAgentCoordinationRuntimeTools(input: {
  agentID: string
  taskID?: string
  signal?: AbortSignal
}): Promise<ToolSet> {
  return {
    request_orchestrator_decision: await createAiSdkToolFromInfo({
      info: RequestOrchestratorDecisionTool,
      agent: input.agentID,
      taskID: input.taskID,
      signal: input.signal,
    }),
    send_mailbox_message: await createAiSdkToolFromInfo({
      info: SendMailboxMessageTool,
      agent: input.agentID,
      taskID: input.taskID,
      signal: input.signal,
    }),
  }
}
