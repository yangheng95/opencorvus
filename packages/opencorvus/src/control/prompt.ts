import z from "zod"
import { ChannelSurface } from "@/channel/catalog"
import { panelCapabilityPrompt } from "@/panel/capability"
import { TASK_REQUEST_SCOPE_GUIDANCE } from "@/prompt/fragments/task-request-scope"

export const ControlPromptContext = z
  .object({
    surface: ChannelSurface,
    taskID: z.string().optional(),
    sessionID: z.string().optional(),
    channel: z.string().optional(),
    thread: z.string().optional(),
    userID: z.string().optional(),
    source: z.string().optional(),
    allowCreate: z.boolean(),
    requestID: z.string().optional(),
  })
  .strict()

export type ControlPromptContext = z.infer<typeof ControlPromptContext>

const runtimeContexts = new Map<string, ControlPromptContext>()

export async function withControlPromptContext<T>(
  sessionID: string,
  context: ControlPromptContext,
  run: () => Promise<T>,
): Promise<T> {
  if (runtimeContexts.has(sessionID)) {
    throw new Error(`Control prompt context already owns session ${sessionID}`)
  }
  const parsed = ControlPromptContext.parse(context)
  runtimeContexts.set(sessionID, parsed)
  try {
    return await run()
  } finally {
    if (runtimeContexts.get(sessionID) === parsed) runtimeContexts.delete(sessionID)
  }
}

export function controlToolContext(sessionID: string): ControlPromptContext | undefined {
  return runtimeContexts.get(sessionID)
}

export function renderControlSystemPrompt(input: ControlPromptContext): string {
  const lines = [
    "You are the core OpenCorvus agent operating in control-plane mode.",
    "Always respond in the language used by the user's authored message; quoted material and Host-projected context do not change that language.",
    "Call an already available `panel_<action>` tool directly for requested task operations. Use `capability_search` to reveal an exact leaf named below only when it is not already callable.",
    "After tool calls finish, respond with an ordinary natural assistant message that directly acknowledges the result, limitations, or blocker.",
    "Do not copy Panel Tool JSON into your answer. The Host reads action IDs and attachments from the completed leaf result itself.",
    "When creating a task, explain in the final natural assistant message what you understand and will do.",
    "Preserve every assigned operation and constraint when creating a Task. `panel_send_task_message` carries real follow-up input after creation; it does not replace omitted original constraints.",
    TASK_REQUEST_SCOPE_GUIDANCE,
    "Write the task title in the same language as the user's message and preserve the original language of the assigned request fragments. Quoted source material, code, paths, commands, identifiers, and API names retain their required source text.",
    "For greetings, general questions, or non-task messages, respond with a friendly, helpful natural message.",
    "Never bypass the exact Panel leaf Tool or rely on local UI shortcuts.",
    "Use only the typed Host-projected identifiers below when selecting a control-plane target; do not infer hidden routing context.",
    "When the user specifies evaluation requirements, set explicit task checks through create_task.checks or update_checks instead of relying on planner goals alone.",
    "When a panel action returns file or image attachments, mention them naturally; the Host returns the attachment refs from the tool result.",
    "",
    `Surface: ${input.surface}`,
    `Control request context (Host-projected fields): ${JSON.stringify(input)}`,
    input.surface === "panel"
      ? "Local panel actions are allowed."
      : "Local panel focus actions are NOT allowed on this surface.",
    "",
    "Available exact Panel leaf Tools on this surface:",
    panelCapabilityPrompt(input.surface),
  ]
  return lines.join("\n")
}

export function controlPromptProjection(
  agentID: string,
  sessionID: string,
):
  | {
      system: string[]
      systemMode: "complete"
      tools?: Record<string, boolean>
      includeMcpTools: false
    }
  | undefined {
  if (agentID !== "control") return undefined
  const context = runtimeContexts.get(sessionID)
  if (!context) return undefined
  return {
    system: [renderControlSystemPrompt(context)],
    systemMode: "complete",
    includeMcpTools: false,
  }
}
