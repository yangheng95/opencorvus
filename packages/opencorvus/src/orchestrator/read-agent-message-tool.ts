import { taskIDForSession } from "@/engine/task-session-lineage"
import { MessageStore } from "@/session/message-store"
import { tool } from "ai"
import z from "zod"

export function createReadAgentMessageTool(input: { taskID: string }) {
  return {
    read_agent_message: tool({
      description:
        "Read one exact persisted Agent message and its tool parts by stable Session/message refs from the Task description. " +
        "This is a read-only fact projection: it does not select a latest message, infer success, or materialize an artifact.",
      inputSchema: z
        .object({
          session_id: z.string().min(1).describe("Exact persisted Agent Session identity from Task evidence."),
          message_id: z
            .string()
            .min(1)
            .describe("Exact persisted message identity owned by the selected Agent Session."),
        })
        .strict(),
      execute: async ({ session_id, message_id }) => {
        if (taskIDForSession(session_id) !== input.taskID) {
          throw new Error(`Session ${session_id} does not belong to Task ${input.taskID}`)
        }
        const message = await MessageStore.get({
          sessionID: session_id,
          messageID: message_id,
        })
        const text = message.parts.flatMap((part) => (part.type === "text" ? [part.text] : []))
        const toolFacts = message.parts.flatMap((part) => {
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
        return JSON.stringify(
          {
            session_id,
            message_id,
            role: message.info.role,
            author: message.info.author,
            text,
            tool_facts: toolFacts,
          },
          null,
          2,
        )
      },
    }),
  }
}
