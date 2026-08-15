import z from "zod"

export const InteractionUserInput = z
  .object({
    surface: z.string().min(1),
    text: z.string(),
    structured: z.record(z.string(), z.any()).optional(),
  })
  .strict()

export type InteractionUserInput = z.infer<typeof InteractionUserInput>
