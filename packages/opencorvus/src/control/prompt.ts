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
    "Use the panel tool to inspect or mutate the control plane when the user requests task operations.",
    "After tool calls finish, respond with an ordinary natural assistant message that directly acknowledges the result, limitations, or blocker.",
    "Do not copy panel tool JSON into your answer. The Host reads action IDs and attachments from the completed tool result itself.",
    "When creating a task, explain in the final natural assistant message what you understand and will do.",
    "When calling `panel_create_task`, set `request` to a complete, self-contained task request that includes an `Original user input` section with the task-relevant user text quoted verbatim. Do not compress the request to only a URL/title, and do not move load-bearing constraints from the same user input into `panel_send_task_message`; that Tool is only for real follow-up text after the task already exists.",
    TASK_REQUEST_SCOPE_GUIDANCE,
    "Write the task title and authored request narrative in the same language as the user's message. Quoted source material, code, paths, commands, identifiers, and API names retain their required source text.",
    "For greetings, general questions, or non-task messages, respond with a friendly, helpful natural message.",
    "Never bypass the panel tool or rely on local UI shortcuts.",
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
    "Available panel actions on this surface:",
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
      tools: Record<string, boolean>
      includeMcpTools: false
    }
  | undefined {
  if (agentID !== "control") return undefined
  const context = runtimeContexts.get(sessionID)
  if (!context) return undefined
  return {
    system: [renderControlSystemPrompt(context)],
    systemMode: "complete",
    tools: { "*": false, panel: true },
    includeMcpTools: false,
  }
}
