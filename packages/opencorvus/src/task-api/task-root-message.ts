import z from "zod"
import { Identifier } from "@/id/id"

export const TaskRootMessageKind = z.enum(["operator", "orchestrator", "mission"])
export type TaskRootMessageKind = z.infer<typeof TaskRootMessageKind>

export const TaskRootMessageProvenance = z
  .object({
    protocol: z.literal("task-root-message"),
    taskID: Identifier.schema("task"),
    kind: TaskRootMessageKind,
    source: z.string().min(1),
  })
  .strict()

export type TaskRootMessageProvenance = z.infer<typeof TaskRootMessageProvenance>
