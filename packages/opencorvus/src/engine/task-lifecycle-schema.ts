import z from "zod"

export const TaskTerminalOccurrenceSchema = z.object({
  epoch: z.number().int().positive(),
  status: z.enum(["completed", "failed", "cancelled"]),
  terminalEventID: z.string().min(1),
  terminalAt: z.number(),
  terminalError: z.string().optional(),
  terminalReason: z.literal("interrupted").optional(),
})

export const TaskLifecycleProjectionSchema = z.object({
  taskID: z.string().min(1),
  epoch: z.number().int().positive(),
  openedEventID: z.string().min(1),
  openedAt: z.number(),
  status: z.enum(["active", "cancelling", "completed", "failed", "cancelled"]),
  requestEventID: z.string().optional(),
  terminalEventID: z.string().optional(),
  terminalAt: z.number().optional(),
  terminalError: z.string().optional(),
  terminalReason: z.literal("interrupted").optional(),
  previousTerminal: TaskTerminalOccurrenceSchema.optional(),
})

export type TaskLifecycleProjection = z.infer<typeof TaskLifecycleProjectionSchema>
export type TaskTerminalOccurrence = z.infer<typeof TaskTerminalOccurrenceSchema>
