import z from "zod"

export const TerminalLifecycleReferenceSchema = z
  .object({
    terminalEventID: z.string().min(1),
  })
  .strict()

export type TerminalLifecycleReference = z.infer<typeof TerminalLifecycleReferenceSchema>
