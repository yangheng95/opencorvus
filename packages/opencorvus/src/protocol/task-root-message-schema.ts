import z from "zod"
import { Identifier } from "@/id/id"

export const TaskRootMessageKind = z.enum(["operator", "orchestrator", "mission"])
export type TaskRootMessageKind = z.infer<typeof TaskRootMessageKind>

export const SchedulerDeliveryReference = z
  .object({
    eventID: Identifier.schema("protocol_event"),
    inboxID: Identifier.schema("protocol_inbox"),
    sequence: z.number().int().positive(),
    threadID: z.string().min(1),
    targetTaskExecutionEpoch: z.number().int().positive(),
    replyTo: Identifier.schema("protocol_event").optional(),
  })
  .strict()
export type SchedulerDeliveryReference = z.infer<typeof SchedulerDeliveryReference>

export const TaskRootMessageProvenance = z
  .object({
    protocol: z.literal("task-root-message"),
    taskID: Identifier.schema("task"),
    kind: TaskRootMessageKind,
    source: z.string().min(1),
    schedulerDelivery: SchedulerDeliveryReference.optional(),
  })
  .strict()

export type TaskRootMessageProvenance = z.infer<typeof TaskRootMessageProvenance>
