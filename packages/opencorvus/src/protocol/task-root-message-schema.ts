import z from "zod"
import { Identifier } from "@/id/id"

export const TaskRootMessageKind = z.enum(["operator", "orchestrator", "mission", "goal-controller"])
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

export const TaskOperatorMessageRequest = z.object({
  version: z.literal(1),
  requestID: z.string().min(1).max(200).refine((value) => value.trim() === value),
  fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
}).strict()
export type TaskOperatorMessageRequest = z.infer<typeof TaskOperatorMessageRequest>

export const TaskRootMessageProvenance = z
  .object({
    protocol: z.literal("task-root-message"),
    taskID: Identifier.schema("task"),
    kind: TaskRootMessageKind,
    source: z.string().min(1),
    schedulerDelivery: SchedulerDeliveryReference.optional(),
    operatorRequest: TaskOperatorMessageRequest.optional(),
  })
  .strict()
  .refine((value) => !value.operatorRequest || (value.kind === "operator" && !value.schedulerDelivery), {
    path: ["operatorRequest"],
    message: "A Task operator request belongs to a directly authored operator Message.",
  })

export type TaskRootMessageProvenance = z.infer<typeof TaskRootMessageProvenance>
