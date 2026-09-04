import { taskIDForSession } from "@/engine/task-session-lineage"
import { Session } from "@/session"
import { MessageStore } from "@/session/message-store"
import { tool } from "ai"
import z from "zod"

export function createReadAgentMessageTool(input: { taskID: string }) {
  return {
    read_agent_message: tool({
      description:
        "Read an ordered batch of exact persisted Agent messages and their tool parts by globally unique message refs from the Task description. " +
        "This is a read-only fact projection: it does not select a latest message, infer success, or materialize an artifact. " +
        "For final worker reports, submit every independent exact dispatch settlement final_message_id in one call; a completed Tool step is not a final report.",
      inputSchema: z
        .object({
          message_ids: z
            .array(z.string().min(1))
            .min(1)
            .max(8)
            .superRefine((messageIDs, context) => {
              const seen = new Set<string>()
              messageIDs.forEach((messageID, index) => {
                if (seen.has(messageID)) {
                  context.addIssue({ code: "custom", path: [index], message: "Message identities must be unique" })
                }
                seen.add(messageID)
              })
            })
            .describe("One to eight exact globally unique persisted Agent message identities from Task evidence, in result order."),
        })
        .strict(),
      execute: async ({ message_ids }) => {
        const messages = await Promise.all(
          message_ids.map(async (message_id) => {
            const session_id = Session.messageOccurrenceSessionID(message_id)
            if (!session_id) throw new Error(`Message ${message_id} is not persisted`)
            if (taskIDForSession(session_id) !== input.taskID) {
              throw new Error(`Message ${message_id} does not belong to Task ${input.taskID}`)
            }
            const message = await MessageStore.get({
              sessionID: session_id,
              messageID: message_id,
            })
            const text = message.parts.flatMap((part) => (part.type === "text" ? [part.text] : []))
            const tool_facts = message.parts.flatMap((part) => {
              if (part.type !== "tool") return []
              return [
                {
                  part_id: part.id,
                  call_id: part.callID,
                  tool_name: part.tool,
                  status: part.state.status,
                  input: part.state.input,
                  ...(part.state.status === "completed" ? { output: part.state.output } : {}),
                  ...(part.state.status === "error" ? { failure: part.state.failure } : {}),
                },
              ]
            })
            return {
              session_id,
              message_id,
              role: message.info.role,
              author: message.info.author,
              finish: message.info.role === "assistant" ? message.info.finish ?? null : null,
              time_completed: message.info.role === "assistant" ? message.info.time.completed ?? null : null,
              text,
              tool_facts,
            }
          }),
        )
        return JSON.stringify(
          { messages },
          null,
          2,
        )
      },
    }),
  }
}
