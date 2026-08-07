import z from "zod"

export const TerminalLifecycleReferenceSchema = z
  .object({
    terminalEventID: z.string().min(1),
    terminalStatus: z.enum(["completed", "failed", "cancelled"]),
    timeCompleted: z.number().int().positive(),
    terminalError: z.string().min(1).optional(),
    terminalReason: z.literal("interrupted").optional(),
  })
  .strict()

export type TerminalLifecycleReference = z.infer<typeof TerminalLifecycleReferenceSchema>
