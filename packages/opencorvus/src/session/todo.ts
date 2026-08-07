import { BusEvent } from "@/bus/bus-event"
import z from "zod"

export namespace Todo {
  export const Info = z
    .object({
      content: z.string().describe("Brief description of the task"),
      status: z.enum(["pending", "in_progress", "completed", "cancelled"]).describe("Current status of the task"),
      priority: z.enum(["high", "medium", "low"]).describe("Priority level of the task"),
    })
    .meta({ ref: "Todo" })
  export type Info = z.infer<typeof Info>

  export const Event = {
    Updated: BusEvent.define(
      "todo.updated",
      z.object({
        sessionID: z.string(),
        todos: z.array(Info),
        updatedAt: z.number().int().positive(),
      }),
    ),
  }
}
