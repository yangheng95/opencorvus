import z from "zod"
import { Tool } from "./tool"
import DESCRIPTION from "./todo.txt"
import { Todo } from "../session/todo"
import { TodoStore } from "../session/todo-store"

export const TodoTool = Tool.define("todo", {
  description: DESCRIPTION,
  parameters: z.discriminatedUnion("action", [
    z.object({ action: z.literal("read") }).strict(),
    z
      .object({
        action: z.literal("write"),
        todos: z.array(Todo.Info).describe("The complete updated checklist; an empty array clears it."),
      })
      .strict(),
  ]),
  async execute(params, ctx) {
    if (params.action === "write") {
      await TodoStore.update({ sessionID: ctx.sessionID, todos: params.todos })
    }
    const todos = await TodoStore.get(ctx.sessionID)
    return {
      title: `${todos.filter((x) => x.status !== "completed").length} todos`,
      metadata: {
        todos,
      },
      output: JSON.stringify(todos, null, 2),
    }
  },
})
